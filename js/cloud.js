// ===== 保護者と子どもの連携（Firebase） =====
// 保護者：Google アカウントでログイン → 6桁の連携コードを発行
// 子ども：ゲームでコードを入力（匿名ログイン）→ 記録をクラウドに保存し、保護者の設定を受け取る
//
// データの形（Firestore）
//   families/{保護者のuid}            { parentUid, childUid, parent: { target, priority }, pairCode, linkedAt }
//   families/{保護者のuid}/state/child { save: ゲームの保存データ(JSON文字列), updatedAt }
//   pairCodes/{6桁}                  { parentUid, expiresAt }   … 10分で期限切れ
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {
  getAuth, connectAuthEmulator, onAuthStateChanged, signInAnonymously, signInWithPopup, signInWithRedirect,
  signInWithCredential, GoogleAuthProvider, signOut,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import {
  getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp, Timestamp,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';

const CODE_MINUTES = 10;
// ?emulator=1 で開くと、手元の Firebase エミュレーターにつなぐ（開発・テスト用）
const useEmulator = new URLSearchParams(location.search).has('emulator');
const config = useEmulator ? { apiKey: 'demo-key', authDomain: 'demo-manabi.firebaseapp.com', projectId: 'demo-manabi', appId: 'demo' }
  : (typeof FIREBASE_CONFIG !== 'undefined' ? FIREBASE_CONFIG : null);

// 保護者ページとゲームでログイン状態を分ける（同じ端末で保護者がログインしても、子どもの連携が切れないように）
const role = location.pathname.endsWith('parent.html') ? 'parent' : 'child';
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
let childPid = null, pushTimer = null, pending = null, unwatchParent = null;

async function childUser() {
  await authReady;
  return auth.currentUser || (await signInAnonymously(auth)).user;
}

// 連携コードで保護者とつなぐ。クラウドに前の記録があれば返す（端末の買い替えなど）
async function linkChild(code) {
  const user = await childUser();
  const snap = await getDoc(doc(db, 'pairCodes', code)).catch(() => null);
  if (!snap || !snap.exists()) throw new Error('コードが見つかりません');
  const { parentUid, expiresAt } = snap.data();
  if (expiresAt.toMillis() < Date.now()) throw new Error('コードの有効期限が切れています');
  await updateDoc(famRef(parentUid), { childUid: user.uid, pairCode: code, linkedAt: serverTimestamp() });
  const st = await getDoc(stateRef(parentUid)).catch(() => null);
  return { pid: parentUid, cloudSave: st && st.exists() ? st.data().save : null };
}

// 連携済みの端末で、保存のたびにクラウドへ送り、保護者の設定を受け取る
async function startChild(pid, onParent) {
  stopChild();
  const user = await authReady;
  if (!user) return false;   // ブラウザのデータが消えて匿名ログインが切れた → 連携し直しが必要
  childPid = pid;
  unwatchParent = onSnapshot(famRef(pid), s => {
    if (!s.exists() || s.data().childUid !== user.uid) { onParent(null, 'unlinked'); return; }
    onParent(s.data().parent || null);
  }, () => onParent(null, 'error'));
  return true;
}
function stopChild() {
  if (unwatchParent) unwatchParent();
  unwatchParent = null; childPid = null;
}
function pushSave(state) {
  if (!childPid) return;
  const { cloud, ...rest } = state;
  pending = { pid: childPid, save: JSON.stringify(rest) };
  clearTimeout(pushTimer);
  pushTimer = setTimeout(flush, 1500);
}
function flush() {
  clearTimeout(pushTimer);
  if (!pending) return;
  const { pid, save } = pending;
  pending = null;
  setDoc(stateRef(pid), { save, updatedAt: serverTimestamp() }).catch(e => console.warn('クラウド保存に失敗', e));
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });

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
  if (!s.exists()) await setDoc(famRef(uid), { parentUid: uid, childUid: null, parent: { target: { weekday: 0, weekend: 0 }, priority: [] }, createdAt: serverTimestamp() });
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
function unlinkChild(uid) { return updateDoc(famRef(uid), { childUid: null }); }

window.Cloud = {
  enabled: !!config,
  // 子ども
  linkChild, startChild, stopChild, pushSave, flush,
  // 保護者
  signInParent, testSignIn, onParentAuth, ensureFamily, createPairCode, deletePairCode, watchFamily, watchChildState,
  saveParentSettings, unlinkChild, signOut: () => signOut(auth),
  CODE_MINUTES,
};
window.dispatchEvent(new Event('cloud-ready'));
