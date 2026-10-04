// ===== 保護者と子どもの連携（Firebase） =====
// 保護者：Google アカウントでログイン → 6桁の連携コードを発行
// 子ども：ゲームでコードを入力（匿名ログイン）→ 記録をクラウドに保存し、保護者の設定を受け取る
//         端末はいくつでも連携でき、どの端末でもクラウドの最新の記録から続けられる
//
// データの形（Firestore）
//   families/{保護者のuid}            { parentUid, childUids: [子どもの端末のuid…], parent: { target, priority }, pairCode, linkedAt,
//                                       reviews: { [記録のat]: { st: 'ok' | 'ng', min } } … 保護者の承認。子どもの端末が⭐に反映したら消す
//                                       reset: { id, contracts, stars } … 保護者が押した「仲間のリセット」。子どもの端末は id ごとに1回だけ当てはめる
//                                       gifts: { [id]: { id, stars, msg, at } } … ⭐のプレゼント。子どもの端末が受け取ったら消す }
//                                     （古い版では childUid に1台だけ入っている）
//   families/{保護者のuid}/state/child { save: ゲームの保存データ(JSON文字列), rev: 更新番号, updatedAt, by: 書いた端末 }
//   pairCodes/{6桁}                  { parentUid, expiresAt }   … 10分で期限切れ
const CODE_MINUTES = 10;
// ?emulator=1 で開くと、手元の Firebase エミュレーターにつなぐ（開発・テスト用）
const useEmulator = new URLSearchParams(location.search).has('emulator');
const config = useEmulator ? { apiKey: 'demo-key', authDomain: 'demo-manabi.firebaseapp.com', projectId: 'demo-manabi', appId: 'demo' }
  : (typeof FIREBASE_CONFIG !== 'undefined' ? FIREBASE_CONFIG : null);

// 保護者ページとゲームでログイン状態を分ける（同じ端末で保護者がログインしても、子どもの連携が切れないように）
const role = location.pathname.endsWith('parent.html') ? 'parent' : 'child';
// SDK は連携を使うときだけ読み込む
const SDK = 'https://www.gstatic.com/firebasejs/12.19.0/';
const [{ initializeApp }, {
  getAuth, connectAuthEmulator, onAuthStateChanged, signInAnonymously, signInWithPopup, signInWithRedirect,
  signInWithCredential, GoogleAuthProvider, signOut,
}, {
  getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp, Timestamp,
  runTransaction, arrayUnion, arrayRemove, deleteField,
}] = config ? await Promise.all(['firebase-app.js', 'firebase-auth.js', 'firebase-firestore.js'].map(f => import(SDK + f))) : [{}, {}, {}];

let auth, db;
if (config) {
  const app = initializeApp(config, role);
  auth = getAuth(app);
  db = getFirestore(app);
  if (useEmulator) {
    connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, 'localhost', 8080);
  }
}

const famRef = pid => doc(db, 'families', pid);
const stateRef = pid => doc(db, 'families', pid, 'state', 'child');
// 最初のログイン状態がわかるまで待つ
const authReady = config ? new Promise(r => { const off = onAuthStateChanged(auth, u => { off(); r(u); }); }) : Promise.resolve(null);

// ---------- 子ども（ゲーム）側 ----------
let offs = [];
const hasChild = (fam, uid) => !!fam && ((fam.childUids || []).includes(uid) || fam.childUid === uid);

async function childUser() {
  await authReady;
  return auth.currentUser || (await signInAnonymously(auth)).user;
}

// 連携コードで保護者とつなぐ。クラウドに記録があれば返す（2台目の端末・買い替えなど）
async function linkChild(code) {
  const user = await childUser();
  const snap = await getDoc(doc(db, 'pairCodes', code)).catch(() => null);
  if (!snap || !snap.exists()) throw new Error('コードが見つかりません');
  const { parentUid, expiresAt } = snap.data();
  if (expiresAt.toMillis() < Date.now()) throw new Error('コードの有効期限が切れています');
  await updateDoc(famRef(parentUid), { childUids: arrayUnion(user.uid), pairCode: code, linkedAt: serverTimestamp() });
  const st = await getDoc(stateRef(parentUid)).catch(() => null);
  const d = st && st.exists() ? st.data() : null;
  return { pid: parentUid, cloudSave: d ? d.save : null, cloudRev: d ? d.rev || 0 : 0 };
}

// 連携中の端末で、保護者の設定とほかの端末の記録を受け取る
async function startChild(pid, { onParent, onReviews, onReset, onGifts, onRemote, onUnlinked }) {
  stopChild();
  await authReady;
  const user = auth.currentUser;
  if (!user) return false;   // ブラウザのデータが消えて匿名ログインが切れた → 連携し直しが必要
  const denied = e => { if (e.code === 'permission-denied') onUnlinked(); };   // 連携を解除された
  offs.push(onSnapshot(famRef(pid), s => {
    if (!hasChild(s.exists() ? s.data() : null, user.uid)) { onUnlinked(); return; }
    onParent(s.data().parent || null);
    onReviews(s.data().reviews || {});
    onReset(s.data().reset || null);
    onGifts(Object.values(s.data().gifts || {}));
  }, denied));
  offs.push(onSnapshot(stateRef(pid), s => {
    if (!s.exists() || s.metadata.hasPendingWrites) return;
    const d = s.data();
    onRemote({ save: d.save, rev: d.rev || 0 });
  }, denied));
  return true;
}
function stopChild() { offs.forEach(f => f()); offs = []; }

// クラウドに記録を書く。baseRev より新しい記録がクラウドにあれば、build(クラウドの記録) で合わせてから書く
async function commit(pid, baseRev, build) {
  const uid = auth.currentUser && auth.currentUser.uid;
  return runTransaction(db, async tx => {
    const s = await tx.get(stateRef(pid));
    const cur = s.exists() ? s.data() : null;
    const curRev = cur ? cur.rev || 0 : 0;
    const newer = cur && curRev > baseRev ? cur.save : null;
    const save = build(newer);
    const rev = curRev + 1;
    tx.set(stateRef(pid), { save: JSON.stringify(save), rev, updatedAt: serverTimestamp(), by: uid });
    return { rev, save, merged: !!newer };
  });
}
// この端末の連携だけを外す
function leave(pid) {
  const uid = auth.currentUser && auth.currentUser.uid;
  return uid ? updateDoc(famRef(pid), { childUids: arrayRemove(uid) }).catch(() => {}) : Promise.resolve();
}

// ---------- 保護者側 ----------
async function signInParent() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try { await signInWithPopup(auth, provider); }
  catch (e) {
    if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment'].includes(e.code)) await signInWithRedirect(auth, provider);
    else throw e;
  }
}
// エミュレーターでのテスト用ログイン
async function testSignIn(email) {
  if (!useEmulator) return;
  await signInWithCredential(auth, GoogleAuthProvider.credential(JSON.stringify({ sub: email, email, email_verified: true })));
}
function onParentAuth(cb) {
  return onAuthStateChanged(auth, u => cb(u && !u.isAnonymous ? u : null));
}
async function ensureFamily(uid) {
  const s = await getDoc(famRef(uid));
  if (!s.exists()) await setDoc(famRef(uid), { parentUid: uid, childUids: [], parent: { target: { weekday: 0, weekend: 0 }, priority: [] }, createdAt: serverTimestamp() });
}
async function createPairCode(uid) {
  for (let k = 0; k < 5; k++) {
    const code = String(Math.floor(Math.random() * 1e6)).padStart(6, '0');
    const expiresAt = Timestamp.fromMillis(Date.now() + CODE_MINUTES * 60000);
    try {
      await setDoc(doc(db, 'pairCodes', code), { parentUid: uid, expiresAt });
      return { code, expiresAt: expiresAt.toMillis() };
    } catch (e) { /* 使用中のコード → 別の番号で */ }
  }
  throw new Error('コードを発行できませんでした');
}
function deletePairCode(code) { return deleteDoc(doc(db, 'pairCodes', code)).catch(() => {}); }
function watchFamily(uid, cb) { return onSnapshot(famRef(uid), s => cb(s.exists() ? s.data() : null)); }
function watchChildState(uid, cb) {
  return onSnapshot(stateRef(uid), s => cb(s.exists() ? s.data() : null), () => cb(null));
}
function saveParentSettings(uid, parent) { return updateDoc(famRef(uid), { parent }); }
// 承認・却下を書く（decisions: { [記録のat]: { st, min } }）
function saveReviews(uid, decisions) {
  return updateDoc(famRef(uid), Object.fromEntries(Object.entries(decisions).map(([at, d]) => ['reviews.' + at, d])));
}
// 仲間のリセットを子どもの端末に送る
function sendReset(uid, cmd) { return updateDoc(famRef(uid), { reset: cmd }); }
// ⭐をプレゼントする／受け取られたプレゼントを消す
function sendGift(uid, gift) { return updateDoc(famRef(uid), { ['gifts.' + gift.id]: gift }); }
function pruneGifts(uid, ids) { return updateDoc(famRef(uid), Object.fromEntries(ids.map(id => ['gifts.' + id, deleteField()]))); }
// 子どもの端末に反映された承認を消す
function pruneReviews(uid, ats) {
  return updateDoc(famRef(uid), Object.fromEntries(ats.map(at => ['reviews.' + at, deleteField()])));
}
function unlinkAll(uid) { return updateDoc(famRef(uid), { childUids: [], childUid: null }); }

window.Cloud = {
  enabled: !!config,
  // 子ども
  linkChild, startChild, stopChild, commit, leave,
  // 保護者
  signInParent, testSignIn, onParentAuth, ensureFamily, createPairCode, deletePairCode, watchFamily, watchChildState,
  saveParentSettings, saveReviews, pruneReviews, sendReset, sendGift, pruneGifts, unlinkAll, signOut: () => signOut(auth),
  CODE_MINUTES,
};
window.dispatchEvent(new Event('cloud-ready'));
