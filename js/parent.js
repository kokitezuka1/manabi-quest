'use strict';
// ===== 保護者ページ =====
// 連携（Firebase）が使えるとき：保護者は Google アカウントでログインし、子どもの端末とコードで連携する。
//   子どもの記録はクラウドから読み、目標時間と優先教科をクラウドに書き込む。
// 使えないとき：ゲームと同じ端末・ブラウザの保存データ（localStorage）を読み書きする。

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const DOWS = ['日', '月', '火', '水', '木', '金', '土'];
const UNLOCK_KEY = 'manabi-quest-parent-unlocked';

let day = today();          // 表示している日
let draft = null;           // 編集中の設定（保存するまで反映しない）
let mode = null;            // 'cloud' | 'local'（決まるまで null）
const cloud = { user: null, fam: null, state: null, code: null, offs: [] };

function parseKey(key) { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d); }
function dayLabel(key) { const d = parseKey(key); return `${d.getMonth() + 1}月${d.getDate()}日（${DOWS[d.getDay()]}）`; }
function hhmm(t) { const d = new Date(t); return d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0'); }
function minutesOn(key) { return S.sessions.filter(s => s.date === key).reduce((a, s) => a + sessionMin(s), 0); }
function subjectMinutes(sessions) {
  return SUBJECTS.map(sub => ({ sub, min: sessions.filter(s => s.subject === sub.id).reduce((a, s) => a + sessionMin(s), 0) }));
}
function freshDraft() { return JSON.parse(JSON.stringify(S.parent)); }
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.h);
  toast.h = setTimeout(() => t.classList.remove('show'), 2600);
}
function isUnlocked() {
  if (!S.parent.pin) return true;
  try { return sessionStorage.getItem(UNLOCK_KEY) === S.parent.pin; } catch (e) { return false; }
}

function render() {
  const root = $('#root');
  if (!mode) { root.innerHTML = `${headerHtml()}<section class="card"><p class="muted">読み込み中…</p></section>`; return; }
  if (mode === 'cloud') { renderCloud(root); return; }
  S = load();
  if (!draft) draft = freshDraft();
  if (!isUnlocked()) { renderLock(root); return; }
  if (!S.player) {
    root.innerHTML = `${headerHtml()}<section class="card empty">
      <h2>まだゲームが始まっていません</h2>
      <p>お子さまが「学びクエスト」を始めると、ここで勉強時間を確認できるようになります。</p>
      <p class="note">このページは、お子さまがゲームで使っている端末・ブラウザと同じもので開いてください。</p>
      <a class="btn" href="index.html">ゲームを開く</a></section>`;
    return;
  }
  root.innerHTML = headerHtml() + reviewHtml() + giftHtml() + dayHtml() + weekHtml() + settingsHtml() + resetHtml() + pinHtml() + footHtml();
  bind();
  bindReview();
  bindGift();
  bindReset();
}

// ---------- クラウド連携モード ----------
function renderCloud(root) {
  if (cloud.user === undefined) { root.innerHTML = `${headerHtml()}<section class="card"><p class="muted">読み込み中…</p></section>`; return; }
  if (!cloud.user) {
    S = defaultState();
    root.innerHTML = `${headerHtml()}<section class="card login">
      <h2>ログイン</h2>
      <p>お子さまの勉強の記録を見たり、目標時間を決めたりするには、保護者の Google アカウントでログインしてください。</p>
      <button class="btn google" id="login">Google でログイン</button>
      <p class="note">お子さまにはアカウントは不要です。ログイン後に表示される6桁のコードを、お子さまのゲーム画面で入力して連携します。</p>
      ${localKid() ? `<hr><p class="note">この端末でお子さまがゲームをしていて、連携しない場合は、こちらから記録の確認と勉強の承認ができます。</p>
      <button class="btn ghost" id="uselocal">連携せずに、この端末の記録を見る</button>` : ''}
    </section>${footHtml()}`;
    if ($('#uselocal')) $('#uselocal').onclick = () => { mode = 'local'; draft = null; render(); };
    $('#login').onclick = async () => {
      try { await Cloud.signInParent(); } catch (e) { if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') toast('ログインできませんでした（' + (e.code || e.message) + '）'); }
    };
    return;
  }
  S = cloudState();
  if (!draft) draft = freshDraft();
  if (!kidDevices().length) {
    root.innerHTML = `${headerHtml()}<section class="card pair">
      <h2>お子さまの端末と連携</h2>
      <ol class="steps">
        <li>下のボタンで6桁のコードを出します（10分間有効）</li>
        <li>お子さまの端末でゲームを開き、⚙️設定 →「保護者と連携する」を押します<br><small>まだゲームを始めていない端末なら、最初の画面の「おうちの人と連携して、前の記録を引き継ぐ」</small></li>
        <li>コードを入力すると連携完了。この画面が自動で切り替わります</li>
      </ol>
      ${codeHtml()}
    </section>${accountHtml(false)}${footHtml()}`;
    bindCloud();
    return;
  }
  if (!S.player) {
    root.innerHTML = `${headerHtml()}<section class="card empty">
      <h2>連携しました</h2><p>お子さまがゲームで勉強を始めると、ここに記録が表示されます。</p></section>${accountHtml(true)}${footHtml()}`;
    bindCloud();
    return;
  }
  root.innerHTML = headerHtml() + reviewHtml() + giftHtml() + dayHtml() + weekHtml() + settingsHtml() + resetHtml() + accountHtml(true) + footHtml();
  bind();
  bindCloud();
  bindReview();
  bindGift();
  bindReset();
}

// クラウドの記録に、保護者の設定（目標時間・優先教科）を重ねたもの
function cloudState() {
  let st = defaultState();
  try { if (cloud.state && cloud.state.save) st = normalize(JSON.parse(cloud.state.save)); } catch (e) { /* 壊れたデータは無視 */ }
  const p = (cloud.fam && cloud.fam.parent) || {};
  st.parent = { ...defaultParent(), target: { ...defaultParent().target, ...(p.target || {}) }, priority: p.priority || [] };
  return st;
}

function codeHtml() {
  const c = cloud.code;
  if (c && c.expiresAt > Date.now()) {
    const left = Math.ceil((c.expiresAt - Date.now()) / 60000);
    return `<div class="code-box"><small>連携コード</small><b>${c.code.slice(0, 3)} ${c.code.slice(3)}</b><small>あと約${left}分有効</small></div>`;
  }
  return `<button class="btn" id="newcode">${c ? 'コードを出し直す' : '連携コードを出す'}</button>`;
}

// 連携している子どもの端末（古い版の childUid にも対応）
function kidDevices(fam = cloud.fam) {
  if (!fam) return [];
  const list = [...(fam.childUids || [])];
  if (fam.childUid && !list.includes(fam.childUid)) list.push(fam.childUid);
  return list;
}

function accountHtml(linked) {
  const u = cloud.user;
  return `<section class="card">
    <h2>アカウント</h2>
    <p class="note">ログイン中：${esc(u.email || u.displayName || '')}</p>
    ${linked ? `<p class="note">連携中のお子さまの端末：<b>${kidDevices().length}台</b>${cloud.state && cloud.state.updatedAt ? `<br>最後に記録が届いた時刻：${fmtStamp(cloud.state.updatedAt)}` : ''}</p>
      <details class="relink"><summary>端末を追加する（タブレットとPCなど）</summary>
        <p class="note">新しいコードを出し、追加したい端末のゲームで入力してください。どの端末でも同じ記録の続きから遊べます。</p>
        ${codeHtml()}
      </details>
      <details class="relink2"><summary>すべての端末の連携を解除する</summary>
        <p class="note">使わなくなった端末があるときなどに。解除したあと、使う端末だけ連携し直してください。記録はクラウドに残ります。</p>
        <button class="btn ghost" id="unlinkall">すべて解除</button>
      </details>` : ''}
    <div class="save-row"><button class="btn ghost" id="logout">ログアウト</button></div>
  </section>`;
}
function fmtStamp(ts) {
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()} ${hhmm(d)}`;
}

function bindCloud() {
  if ($('#newcode')) $('#newcode').onclick = async e => {
    e.target.disabled = true;
    try { cloud.code = await Cloud.createPairCode(cloud.user.uid); render(); }
    catch (err) { toast('コードを出せませんでした'); e.target.disabled = false; }
  };
  if (cloud.code && $('.relink')) $('.relink').open = true;
  if ($('#unlinkall')) $('#unlinkall').onclick = async () => {
    if (!confirm('すべての端末の連携を解除しますか？')) return;
    try { await Cloud.unlinkAll(cloud.user.uid); toast('連携を解除しました'); } catch (e) { toast('解除できませんでした'); }
  };
  $('#logout').onclick = async () => { if (confirm('ログアウトしますか？')) await Cloud.signOut(); };
}

function startCloudMode() {
  mode = 'cloud';
  cloud.user = undefined;
  render();
  Cloud.onParentAuth(async user => {
    cloud.offs.forEach(f => f()); cloud.offs = [];
    cloud.fam = cloud.state = cloud.code = null;
    draft = null;
    cloud.user = user;
    if (!user) { render(); return; }
    try { await Cloud.ensureFamily(user.uid); } catch (e) { toast('データを読み込めませんでした'); }
    let prevKids;   // 最初の読み込みでは通知しない
    cloud.offs.push(Cloud.watchFamily(user.uid, fam => {
      const kids = kidDevices(fam);
      if (prevKids !== undefined && kids.some(k => !prevKids.includes(k))) {
        if (cloud.code) Cloud.deletePairCode(cloud.code.code);
        cloud.code = null;
        toast('お子さまの端末と連携しました');
      }
      prevKids = kids;
      cloud.fam = fam;
      pruneReviews();
      pruneGifts();
      softRender();
    }));
    cloud.offs.push(Cloud.watchChildState(user.uid, st => { cloud.state = st; pruneReviews(); pruneGifts(); softRender(); }));
  });
}

function headerHtml() {
  const p = S.player;
  return `<header class="head">
    <div><p class="eyebrow">学びクエスト</p><h1>保護者ページ</h1></div>
    ${p ? `<div class="kid"><b>${esc(p.name)}</b> さん<small>Lv.${p.level}・連続 ${currentStreak()}日</small></div>` : ''}
  </header>`;
}

// ---------- 勉強の承認 ----------
// クラウドでは、承認したあと、お子さまの端末が⭐に反映するまで「反映待ち」と表示する
function sentReviews() { return mode === 'cloud' && cloud.fam && cloud.fam.reviews || {}; }
function reviewHtml() {
  const sent = sentReviews();
  const ps = pendingSessions();
  const todo = ps.filter(s => !sent[s.at]), waiting = ps.filter(s => sent[s.at]);
  const warn = mode === 'local' && !S.parent.pin
    ? '<p class="alert">⚠️ 暗証番号が設定されていないため、お子さまが自分で承認できてしまいます。下の「暗証番号（PIN）」で設定してください。</p>' : '';
  if (!ps.length) return `<section class="card review"><h2>勉強の承認</h2>${warn}<p class="muted">承認を待っている勉強はありません。</p>
    <p class="note">お子さまが勉強を終えると、ここに申請が届きます。承認すると、勉強した時間に応じた⭐がお子さまに入ります。</p></section>`;
  return `<section class="card review"><h2>勉強の承認 <span class="count">${todo.length}</span></h2>${warn}
    <p class="note">内容を確認して承認すると⭐が入ります。実際より長いときは、時間を直してから承認してください。</p>
    ${todo.length ? `<ul class="rv-list">${todo.slice().reverse().map(s => {
      const sub = SUBJECT_BY_ID[s.subject];
      return `<li data-at="${s.at}">
        <div class="rv-head"><span class="rv-when">${dayLabel(s.date)} ${hhmm(s.at - s.minutes * 60000)}〜${hhmm(s.at)}</span>
          <span class="rv-sub">${sub.icon} ${sub.name}${s.prio ? '<em class="prio">優先</em>' : ''}</span></div>
        <div class="rv-body"><label class="rv-min"><input type="number" inputmode="numeric" min="1" max="${s.minutes}" value="${s.minutes}"> 分<small>申請 ${fmtMin(s.minutes)}${s.goalMet ? `・目標${s.goal}分達成` : ''}</small></label>
          <span class="rv-star">⭐<b>${s.stars}</b></span></div>
        <div class="rv-btns"><button class="btn ghost rv-ng">却下</button><button class="btn rv-ok">承認</button></div></li>`;
    }).join('')}</ul>
    ${todo.length >= 2 ? `<div class="save-row"><button class="btn" id="rv-all">申請どおりにすべて承認（${todo.length}件）</button></div>` : ''}` : ''}
    ${waiting.length ? `<p class="note">✓ 承認済み・お子さまの端末に反映待ち：${waiting.length}件（お子さまがゲームを開くと⭐が入ります）</p>` : ''}
  </section>`;
}
async function decide(decisions) {
  if (mode === 'cloud') {
    try { await Cloud.saveReviews(cloud.user.uid, decisions); } catch (e) { toast('保存できませんでした'); return false; }
  } else {
    S = load();
    applyReviews(decisions);
  }
  render();
  return true;
}
function bindReview() {
  $$('.rv-list li').forEach(li => {
    const s = S.sessions.find(x => String(x.at) === li.dataset.at);
    if (!s) return;
    const inp = $('input', li), star = $('.rv-star b', li);
    inp.oninput = () => { const v = Math.round(+inp.value); star.textContent = v >= 1 && v <= s.minutes ? reviewStars(s, v) : '—'; };
    $('.rv-ok', li).onclick = async () => {
      const v = Math.round(+inp.value);
      if (!(v >= 1 && v <= s.minutes)) { toast(`1〜${s.minutes}分で入力してください`); inp.focus(); return; }
      if (await decide({ [s.at]: { st: 'ok', min: v } })) toast(`承認しました（⭐${reviewStars(s, v)}）`);
    };
    $('.rv-ng', li).onclick = async () => {
      if (!confirm(`${SUBJECT_BY_ID[s.subject].name} ${fmtMin(s.minutes)}を却下しますか？（⭐は入りません）`)) return;
      if (await decide({ [s.at]: { st: 'ng' } })) toast('却下しました');
    };
  });
  if ($('#rv-all')) $('#rv-all').onclick = async () => {
    const sent = sentReviews();
    const list = pendingSessions().filter(s => !sent[s.at]);
    if (!confirm(`${list.length}件をすべて申請どおりに承認しますか？`)) return;
    if (await decide(Object.fromEntries(list.map(s => [s.at, { st: 'ok', min: s.minutes }])))) toast(`${list.length}件を承認しました`);
  };
}
// お子さまの端末に反映された承認を、クラウドから消す
function pruneReviews() {
  const sent = sentReviews();
  if (!cloud.state || !Object.keys(sent).length) return;
  const st = cloudState();
  const done = Object.keys(sent).filter(at => { const s = st.sessions.find(x => String(x.at) === at); return !s || s.review !== 'pending'; });
  if (done.length) Cloud.pruneReviews(cloud.user.uid, done).catch(() => {});
}

// ---------- ⭐のプレゼント ----------
const GIFT_PRESETS = [10, 30, 50, 100];
let giftDraft = { stars: 30, msg: '' };   // 入力中の内容（再描画しても消えないように）
function sentGifts() {
  const sent = mode === 'cloud' && cloud.fam && cloud.fam.gifts || {};
  const got = new Set(S.gifts.map(g => g.id));
  return Object.values(sent).filter(g => !got.has(g.id));   // 送ったけれど、まだお子さまの端末が受け取っていないもの
}
function giftHtml() {
  const waiting = sentGifts();
  const recent = S.gifts.slice(-5).reverse();
  const d = new Date();
  return `<section class="card gift"><h2>⭐をプレゼント</h2>
    <p class="note">お手伝いをしたときや、よくがんばった日などに、⭐を贈れます（1回 ${GIFT_MAX}個まで）。</p>
    ${mode === 'local' && !S.parent.pin ? '<p class="alert">⚠️ 暗証番号が未設定のため、お子さまが自分で⭐を贈れてしまいます。下の「暗証番号（PIN）」で設定してください。</p>' : ''}
    <div class="gift-presets">${GIFT_PRESETS.map(n => `<button class="btn ghost ${giftDraft.stars === n ? 'on' : ''}" data-g="${n}">⭐${n}</button>`).join('')}</div>
    <label class="gift-row">個数<input id="g-stars" type="number" inputmode="numeric" min="1" max="${GIFT_MAX}" value="${giftDraft.stars}"></label>
    <label class="gift-row">ひとこと（なくてもOK）<input id="g-msg" maxlength="40" placeholder="例：お手伝いありがとう！" value="${esc(giftDraft.msg)}"></label>
    <div class="save-row"><button class="btn" id="g-send">⭐${giftDraft.stars}を贈る</button></div>
    ${waiting.length ? `<p class="note">🎁 お子さまの端末に届くのを待っています：⭐${waiting.reduce((a, g) => a + g.stars, 0)}（${waiting.length}件）。お子さまがゲームを開くと届きます。</p>` : ''}
    ${recent.length ? `<h3>最近のプレゼント</h3><ul class="gift-list">${recent.map(g => {
      const t = new Date(g.at);
      return `<li><span>${t.getMonth() + 1}/${t.getDate()} ${hhmm(t)}</span><b>⭐${g.stars}</b><span class="gmsg">${esc(g.msg || '')}</span></li>`;
    }).join('')}</ul>` : ''}
  </section>`;
}
function bindGift() {
  const inp = $('#g-stars'), msg = $('#g-msg'), btn = $('#g-send');
  if (!inp) return;
  const sync = () => { const v = Math.round(+inp.value); giftDraft.stars = v; btn.textContent = v >= 1 && v <= GIFT_MAX ? `⭐${v}を贈る` : '贈る'; $$('[data-g]').forEach(b => b.classList.toggle('on', +b.dataset.g === v)); };
  inp.oninput = sync;
  msg.oninput = () => { giftDraft.msg = msg.value; };
  $$('[data-g]').forEach(b => b.onclick = () => { inp.value = b.dataset.g; sync(); });
  btn.onclick = async () => {
    const stars = Math.round(+inp.value);
    if (!(stars >= 1 && stars <= GIFT_MAX)) { toast(`1〜${GIFT_MAX}個で入力してください`); inp.focus(); return; }
    if (!confirm(`${S.player.name}さんに ⭐${stars} を贈りますか？`)) return;
    const id = Date.now();
    const gift = { id, stars, msg: msg.value.trim().slice(0, 40), at: id };
    if (mode === 'cloud') {
      try { await Cloud.sendGift(cloud.user.uid, gift); } catch (e) { toast('送れませんでした'); return; }
    } else {
      S = load();
      applyGifts([gift]);
    }
    giftDraft = { stars: 30, msg: '' };
    toast(`⭐${stars}を贈りました`);
    render();
  };
}
// お子さまの端末が受け取ったプレゼントを、クラウドから消す
function pruneGifts() {
  const sent = cloud.fam && cloud.fam.gifts;
  if (!cloud.state || !sent || !Object.keys(sent).length) return;
  const got = new Set(cloudState().gifts.map(g => String(g.id)));
  const done = Object.keys(sent).filter(id => got.has(id));
  if (done.length) Cloud.pruneGifts(cloud.user.uid, done).catch(() => {});
}

// ---------- 仲間のリセット ----------
let resetOpen = false;   // 開いたまま再描画されても閉じないように
function resetHtml() {
  const owned = Object.keys(S.chars);
  const byRank = RANKS.map(r => [r, owned.filter(id => CHAR_BY_ID[id].r === r).length]).filter(([, n]) => n);
  const plan = planReset(S);
  const now = stageInfo(S.stage.i), to = stageInfo(plan.stage);
  const contracts = CONTRACT_ORDER.filter(k => S.contracts[k] > 0).map(k => `${CONTRACTS[k].name}×${S.contracts[k]}`).join('、');
  const fam = mode === 'cloud' && cloud.fam && cloud.fam.reset;
  const waiting = fam && !(S.lastReset && S.lastReset.id === fam.id);
  const p = S.player;
  return `<section class="card reset">
    <details id="resetbox" ${resetOpen ? 'open' : ''}><summary><h2>仲間のリセット</h2></summary>
    <p class="note">お子さまの仲間を、Dランクの仲間1体（Lv1）だけにして、やり直してもらいます。元には戻せません。</p>
    ${waiting ? '<p class="alert">リセットを送りました。お子さまがゲームを開くと反映されます。</p>' : ''}
    <h3>今の状態</h3>
    <ul class="reset-now">
      <li>仲間：${owned.length}体（${byRank.map(([r, n]) => `${RARITY[r].label} ${n}`).join('・')}）</li>
      <li>パートナー：${S.partner ? `${charName(S.partner)}（${RARITY[CHAR_BY_ID[S.partner].r].label}ランク Lv.${charLevel(S.partner)}・強さ ${charPower(S.partner)}）` : 'なし'}</li>
      <li>冒険：${now.region.flag} ${now.city.name}（${S.stage.i + 1}番目の街）</li>
      <li>⭐ ${p.stars}・🎫 ${p.tickets}${contracts ? `・${contracts}` : ''}</li>
    </ul>
    <h3>リセットすると</h3>
    <ul class="reset-now">
      <li>仲間：<b>${CHAR_BY_ID[plan.id].names[0]}</b>（Dランク Lv.1・強さ ${RARITY[1].base + RARITY[1].perLv}）だけになります</li>
      <li>冒険：<b>${to.region.flag} ${to.city.name}（${plan.stage + 1}番目の街）</b>${plan.stage < S.stage.i ? 'まで戻ります（Dランクで倒せる強さの街）' : 'のまま'}</li>
      <li>一度クリアした街を倒し直しても、チケットと契約書は出ません（⭐は出ます）</li>
      <li>レベル・勉強の記録・連続日数はそのままです</li>
    </ul>
    <label class="check"><input type="checkbox" id="rs-contracts" ${contracts ? 'checked' : 'disabled'}> 持っている契約書も消す${contracts ? '' : '（持っていません）'}</label>
    <label class="check"><input type="checkbox" id="rs-stars"> ⭐とチケットも0にする</label>
    <p class="note">⭐や契約書が残っていると、すぐにガチャで強い仲間を引き直せます。</p>
    <div class="save-row"><button class="btn danger" id="rs-go" ${waiting ? 'disabled' : ''}>リセットする</button></div>
    </details>
  </section>`;
}
function bindReset() {
  const box = $('#resetbox');
  if (!box) return;
  box.ontoggle = () => { resetOpen = box.open; };
  $('#rs-go').onclick = async () => {
    const cmd = { id: Date.now(), contracts: $('#rs-contracts').checked, stars: $('#rs-stars').checked };
    if (!confirm(`${S.player.name}さんの仲間をリセットしますか？\nDランクの仲間1体だけになり、元には戻せません。`)) return;
    if (mode === 'cloud') {
      try { await Cloud.sendReset(cloud.user.uid, cmd); } catch (e) { toast('送れませんでした'); return; }
      toast('リセットを送りました');
    } else {
      S = load();
      applyReset(cmd);
      toast('リセットしました');
    }
    render();
  };
}

// ---------- その日の勉強 ----------
function dayHtml() {
  const ss = S.sessions.filter(s => s.date === day);
  const total = ss.reduce((a, s) => a + sessionMin(s), 0);
  const target = targetFor(day);
  const isToday = day === today();
  const a = S.active;
  let status = '<span class="pill muted">目標未設定</span>';
  if (target) {
    status = total >= target ? '<span class="pill good">✓ 目標達成</span>'
      : `<span class="pill warn">あと ${fmtMin(target - total)}</span>`;
  }
  const subs = subjectMinutes(ss);
  const sMax = Math.max(1, ...subs.map(x => x.min));
  const shown = subs.filter(x => x.min || S.parent.priority.includes(x.sub.id));
  return `<section class="card">
    <div class="day-nav">
      <button class="icon" id="prev" aria-label="前の日">‹</button>
      <h2>${isToday ? '今日' : dayLabel(day)}${isToday ? `<small>${dayLabel(day)}</small>` : ''}</h2>
      <button class="icon" id="next" aria-label="次の日" ${isToday ? 'disabled' : ''}>›</button>
    </div>
    ${!isToday ? '<button class="link center" id="today">今日に戻る</button>' : ''}
    <div class="hero">
      <div class="hero-num"><b>${total}</b><span>分</span>${target ? `<span class="of">／ 目標 ${fmtMin(target)}</span>` : ''}</div>
      ${status}
    </div>
    ${target ? `<div class="meter" role="progressbar" aria-valuemin="0" aria-valuemax="${target}" aria-valuenow="${total}"><i style="width:${Math.min(100, total / target * 100)}%"></i></div>` : ''}
    ${isToday && a ? `<p class="live">● いま勉強中：${SUBJECT_BY_ID[a.subject].name}（${a.pausedAt ? '休憩中・' : ''}${Math.floor(activeElapsedSec() / 60)}分経過）</p>` : ''}
    <h3>教科ごと</h3>
    ${shown.length ? `<div class="subj-list">${shown.map(x => `<div class="subj-row">
        <span class="sname">${x.sub.icon} ${x.sub.name}${S.parent.priority.includes(x.sub.id) ? '<em class="prio">優先</em>' : ''}</span>
        <span class="sbar"><i style="width:${x.min / sMax * 100}%"></i></span>
        <span class="smin">${fmtMin(x.min)}</span></div>`).join('')}</div>`
      : '<p class="muted">この日の記録はありません。</p>'}
    ${ss.length ? `<h3>記録</h3><ul class="sessions">${ss.slice().reverse().map(s => `<li>
        <span class="time">${hhmm(s.at - s.minutes * 60000)}〜${hhmm(s.at)}</span>
        <span>${SUBJECT_BY_ID[s.subject].icon} ${SUBJECT_BY_ID[s.subject].name}</span>
        <b class="${s.review === 'ng' ? 'ng' : ''}">${s.okMin ? `<s>${fmtMin(s.minutes)}</s> ` : ''}${fmtMin(s.okMin ?? s.minutes)}</b>${s.goalMet ? '<span class="tag">目標達成</span>' : ''}${reviewTag(s)}</li>`).join('')}</ul>` : ''}
  </section>`;
}

function reviewTag(s) {
  if (s.review === 'pending') return sentReviews()[s.at] ? '<span class="tag">反映待ち</span>' : '<span class="tag wait">承認待ち</span>';
  if (s.review === 'ok') return `<span class="tag ok">承認 ⭐${s.gotStars}</span>`;
  if (s.review === 'ng') return '<span class="tag ng">却下</span>';
  return '';
}

// ---------- 最近7日間 ----------
function weekHtml() {
  const t = today();
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const k = dayOffset(t, -i);
    days.push({ k, min: minutesOn(k), target: targetFor(k) });
  }
  const max = Math.max(30, ...days.map(d => Math.max(d.min, d.target)));
  const total = days.reduce((a, d) => a + d.min, 0);
  const withTarget = days.filter(d => d.target);
  const met = withTarget.filter(d => d.min >= d.target).length;
  const weekSessions = S.sessions.filter(s => s.date >= days[0].k && s.date <= t);
  const subs = subjectMinutes(weekSessions);
  const sMax = Math.max(1, ...subs.map(x => x.min));
  return `<section class="card">
    <h2>最近7日間</h2>
    <div class="stats">
      <div><small>合計</small><b>${fmtMin(total)}</b></div>
      <div><small>1日平均</small><b>${fmtMin(Math.round(total / 7))}</b></div>
      <div><small>目標達成</small><b>${withTarget.length ? `${met} / ${withTarget.length}日` : '—'}</b></div>
    </div>
    <div class="chart" role="img" aria-label="最近7日間の勉強時間">
      ${days.map(d => {
        const dd = parseKey(d.k);
        const tip = `${dd.getMonth() + 1}/${dd.getDate()}（${DOWS[dd.getDay()]}） ${fmtMin(d.min)}${d.target ? ` ／ 目標 ${fmtMin(d.target)}` : ''}`;
        return `<button class="col ${d.k === day ? 'on' : ''}" data-day="${d.k}" title="${tip}" aria-label="${tip}">
          <span class="val">${d.min || ''}</span>
          <span class="plot">
            ${d.target ? `<span class="goal" style="bottom:${d.target / max * 100}%"></span>` : ''}
            <span class="bar ${d.target && d.min >= d.target ? 'met' : ''}" style="height:${d.min / max * 100}%"></span>
          </span>
          <span class="dow ${dd.getDay() === 0 || dd.getDay() === 6 ? 'we' : ''}">${DOWS[dd.getDay()]}</span></button>`;
      }).join('')}
    </div>
    <p class="note">棒をタップするとその日の記録を表示します。点線は目標時間です。</p>
    <h3>教科のバランス（7日間）</h3>
    <div class="subj-list">${subs.map(x => `<div class="subj-row">
      <span class="sname">${x.sub.icon} ${x.sub.name}${S.parent.priority.includes(x.sub.id) ? '<em class="prio">優先</em>' : ''}</span>
      <span class="sbar"><i style="width:${x.min / sMax * 100}%"></i></span>
      <span class="smin">${fmtMin(x.min)}</span></div>`).join('')}</div>
  </section>`;
}

// ---------- 設定 ----------
function targetSelect(id, value, options = TARGET_OPTIONS) {
  return `<select id="${id}">${options.map(m => `<option value="${m}" ${m === value ? 'selected' : ''}>${m ? fmtMin(m) : '設定しない'}</option>`).join('')}</select>`;
}
function settingsHtml() {
  const d = draft;
  const dirty = JSON.stringify(d) !== JSON.stringify(S.parent);
  return `<section class="card">
    <h2>学習の設定</h2>
    <h3>1日の目標学習時間</h3>
    <div class="targets">
      <label>平日（月〜金）${targetSelect('t-weekday', d.target.weekday)}</label>
      <label>土日${targetSelect('t-weekend', d.target.weekend, WEEKEND_TARGET_OPTIONS)}</label>
    </div>
    <p class="note">お子さまのホーム画面に「今日の目標」と残り時間が表示されます。達成すると ⭐+${TARGET_BONUS.stars} のボーナス。</p>
    <h3>優先して学習させたい教科</h3>
    <div class="prio-grid">${SUBJECTS.map(s => {
      const on = d.priority.includes(s.id);
      return `<button class="prio-btn ${on ? 'on' : ''}" data-s="${s.id}" aria-pressed="${on}">
        <span class="pi">${s.icon}</span>${s.name}<span class="check">${on ? '優先' : ''}</span></button>`;
    }).join('')}</div>
    <p class="note">選んだ教科には「おすすめ」の印がつき、勉強すると ⭐が${PRIORITY_STAR_RATE}倍になります。1〜2教科にしぼるのがおすすめです。</p>
    <div class="save-row">
      ${dirty ? '<button class="btn ghost" id="revert">元に戻す</button>' : ''}
      <button class="btn" id="save" ${dirty ? '' : 'disabled'}>${dirty ? '保存する' : '保存済み'}</button>
    </div>
  </section>`;
}

function pinHtml() {
  const has = !!S.parent.pin;
  return `<section class="card">
    <h2>暗証番号（PIN）</h2>
    <p class="note">${has ? 'このページを開くときに4桁の暗証番号が必要です。' : '4桁の暗証番号を設定すると、お子さまが設定を変えられないようにできます。'}</p>
    <div class="pin-row">
      <input id="newpin" inputmode="numeric" pattern="[0-9]*" maxlength="4" placeholder="${has ? '新しい4桁' : '4桁の数字'}" autocomplete="off">
      <button class="btn ghost" id="setpin">${has ? '変更' : '設定'}</button>
      ${has ? '<button class="btn ghost" id="clearpin">解除</button>' : ''}
    </div>
  </section>`;
}

function footHtml() {
  return `<footer class="foot">
    <p>${mode === 'cloud' ? 'どの端末からでも、同じ Google アカウントでログインすれば確認・設定できます。'
      : 'データはこの端末のブラウザ内にだけ保存されています。お子さまがゲームで使っている端末・ブラウザで、このページを開いてください。'}</p>
    <a href="index.html">← ゲーム画面へ</a>
  </footer>`;
}

function bind() {
  const go = k => { day = k; render(); };
  $('#prev').onclick = () => go(dayOffset(day, -1));
  $('#next').onclick = () => { if (day < today()) go(dayOffset(day, 1)); };
  if ($('#today')) $('#today').onclick = () => go(today());
  $$('.col').forEach(b => b.onclick = () => { go(b.dataset.day); window.scrollTo({ top: 0, behavior: 'smooth' }); });

  $('#t-weekday').onchange = e => { draft.target.weekday = +e.target.value; render(); };
  $('#t-weekend').onchange = e => { draft.target.weekend = +e.target.value; render(); };
  $$('.prio-btn').forEach(b => b.onclick = () => {
    const id = b.dataset.s;
    draft.priority = draft.priority.includes(id) ? draft.priority.filter(x => x !== id)
      : SUBJECTS.map(s => s.id).filter(x => x === id || draft.priority.includes(x));   // 教科の並び順を保つ
    render();
  });
  if ($('#revert')) $('#revert').onclick = () => { draft = freshDraft(); render(); };
  $('#save').onclick = async () => {
    const next = { target: { ...draft.target }, priority: [...draft.priority] };
    if (mode === 'cloud') {
      try { await Cloud.saveParentSettings(cloud.user.uid, next); } catch (e) { toast('保存できませんでした'); return; }
      draft = null;
    } else {
      saveParent({ ...S.parent, ...next });
      draft = freshDraft();
    }
    render();
    toast('保存しました。お子さまの画面に反映されます');
  };

  if (!$('#setpin')) return;
  $('#setpin').onclick = () => {
    const v = $('#newpin').value.trim();
    if (!/^\d{4}$/.test(v)) { toast('4桁の数字を入力してください'); $('#newpin').focus(); return; }
    saveParent({ ...S.parent, pin: v });
    try { sessionStorage.setItem(UNLOCK_KEY, v); } catch (e) { /* 使えない環境 */ }
    draft = null;
    render();
    toast('暗証番号を設定しました');
  };
  if ($('#clearpin')) $('#clearpin').onclick = () => {
    if (!confirm('暗証番号を解除しますか？')) return;
    saveParent({ ...S.parent, pin: '' });
    draft = null;
    render();
    toast('暗証番号を解除しました');
  };
}

function renderLock(root) {
  root.innerHTML = `${headerHtml()}<section class="card lock">
    <h2>暗証番号を入力</h2>
    <input id="pin" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off" aria-label="暗証番号">
    <button class="btn" id="unlock">開く</button>
    <details><summary>暗証番号を忘れた場合</summary>
      <p class="note">ゲーム画面の ⚙️設定 → 保護者の方へ → 「データをダウンロード」で保存したファイルを開くと、"pin" の項目で確認できます。</p></details>
  </section>`;
  const inp = $('#pin');
  const tryOpen = () => {
    if (inp.value === S.parent.pin) {
      try { sessionStorage.setItem(UNLOCK_KEY, inp.value); } catch (e) { /* 使えない環境 */ }
      render();
    } else { inp.value = ''; inp.classList.add('shake'); setTimeout(() => inp.classList.remove('shake'), 400); toast('暗証番号が違います'); }
  };
  $('#unlock').onclick = tryOpen;
  inp.oninput = () => { if (inp.value.length === 4) tryOpen(); };
  inp.focus();
}

// ゲーム（別のタブ）で記録が増えたら表示を更新する。編集中の設定はそのまま残す
// 承認の時間を入力している途中なら、書き換えないで入力が終わってから更新する
function editing() { return !!document.activeElement?.closest('.rv-list, .gift'); }
// 入力が終わったら更新する（ボタンを押すまで待てるよう、少し遅らせる）
function softRender() {
  if (!editing()) { render(); return; }
  document.activeElement.addEventListener('blur', () => setTimeout(() => { if (!editing()) render(); }, 600), { once: true });
}
window.addEventListener('storage', e => { if (e.key === SAVE_KEY && mode === 'local') softRender(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && mode === 'local') render(); });
setInterval(() => {
  if (document.activeElement?.tagName === 'SELECT' || editing()) return;
  if (mode === 'cloud' && cloud.code) render();   // コードの残り時間
  else if (S.active && day === today() && (mode === 'cloud' || isUnlocked())) render();
}, 30000);

// 連携（Firebase）が使えるかどうかで動きを切り替える
// この端末に、連携していないゲームの記録があるか
function localKid() { const l = load(); return !!l.player && !l.cloud; }
function decideMode() {
  if (mode) return;
  if (window.Cloud && Cloud.enabled) startCloudMode();
  else { mode = 'local'; render(); }
}
window.addEventListener('cloud-ready', decideMode);
setTimeout(decideMode, 5000);   // 読み込みに失敗したときは、この端末のデータで表示
// ゲームの設定から「連携せずに、この端末で保護者ページを開く」で来たとき
if (new URLSearchParams(location.search).has('local') && localKid()) mode = 'local';
render();
