'use strict';
// ===== 運営ページ =====
// 運営（Firestore の admins/{uid} があるアカウント）が、連携している家庭の進み具合を見て、
// イベント（ピックアップガチャ）を設定する。連携していない端末の記録は、その端末の中にしかないので見えない。

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const NEAR = 0.8;   // ここまで進んだら「クリア間近」

const A = { user: undefined, admin: false, families: null, loading: false, events: null, edit: null };

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.h);
  toast.h = setTimeout(() => t.classList.remove('show'), 2600);
}
function stamp(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ---------- 家庭ごとのまとめ ----------
function summarize(f) {
  let st;
  try { st = normalize(JSON.parse(f.state.save)); } catch (e) { return null; }
  S = st;   // store.js の関数は S を見るので、この家庭の記録にする
  const p = st.player;
  if (!p) return { name: '（まだ始めていない）', empty: true };
  const i = st.stage.i, loop = Math.floor(i / CITIES.length), k = i % CITIES.length;
  const regular = CHARACTERS.filter(c => !c.limited), limited = CHARACTERS.filter(c => c.limited);
  const has = id => !!st.chars[id];
  const log = courseLog();
  const groups = COURSE_GROUPS.map(g => {
    const list = COURSES.filter(c => c.group === g.id);
    return { g, done: list.filter(c => log[c.id] && log[c.id].ok).length, total: list.length };
  });
  const t = today(), weekFrom = dayOffset(t, -6);
  const counted = st.sessions.filter(s => s.review !== 'ng');
  const pt = st.partner && CHAR_BY_ID[st.partner] ? st.partner : null;
  const s = {
    name: p.name, level: p.level, title: titleFor(p.level), streak: currentStreak(),
    stage: stageInfo(i), loop, k, cities: CITIES.length,
    owned: regular.filter(c => has(c.id)).length, regular: regular.length,
    ownedLimited: limited.filter(c => has(c.id)).length, limited: limited.length,
    byRank: RANKS.map(r => [r, regular.filter(c => c.r === r && has(c.id)).length, regular.filter(c => c.r === r).length]),
    partner: pt ? { name: charName(pt), rank: RARITY[CHAR_BY_ID[pt].r].label, lv: charLevel(pt), max: charMaxLv(pt), lb: charLb(pt), power: charPower(pt) } : null,
    maxed: Object.keys(st.chars).filter(id => CHAR_BY_ID[id] && charLb(id) >= LIMIT_BREAK.max && charLevel(id) >= charMaxLv(id)).length,
    coursesDone: groups.reduce((a, x) => a + x.done, 0), coursesTotal: COURSES.length, groups,
    totalMin: counted.reduce((a, x) => a + sessionMin(x), 0),
    weekMin: counted.filter(x => x.date >= weekFrom).reduce((a, x) => a + sessionMin(x), 0),
    lastStudy: st.sessions.length ? Math.max(...st.sessions.map(x => x.at)) : 0,
    stars: p.stars, tickets: p.tickets, contracts: contractCount(), pulls: st.gacha.total || 0,
    pending: pendingSessions().length,
  };
  s.alerts = alertsFor(s);
  return s;
}
// クリアが近いもの（新しい内容を足すめやす）
function alertsFor(s) {
  const a = [];
  if (s.loop >= 1) a.push({ lv: 'done', text: `世界一周クリア（${s.loop + 1}周目・伝説モード）` });
  else if (s.k / s.cities >= NEAR) a.push({ lv: 'near', text: `世界一周まであと${s.cities - s.k}都市` });
  if (s.owned >= s.regular) a.push({ lv: 'done', text: '仲間をコンプリート' });
  else if (s.owned / s.regular >= NEAR) a.push({ lv: 'near', text: `仲間コンプリートまであと${s.regular - s.owned}体` });
  for (const g of s.groups) {
    if (g.done >= g.total) a.push({ lv: 'done', text: `${g.g.short}の講座を全部受講` });
    else if (g.done / g.total >= NEAR) a.push({ lv: 'near', text: `${g.g.short}の講座 あと${g.total - g.done}` });
  }
  const lastTitle = TITLES[TITLES.length - 1][0];
  if (s.level >= lastTitle) a.push({ lv: 'done', text: `称号コンプリート（Lv${lastTitle}〜）` });
  else if (s.level >= lastTitle * NEAR) a.push({ lv: 'near', text: `最後の称号までLv${lastTitle - s.level}` });
  if (s.partner && s.partner.lb >= LIMIT_BREAK.max && s.partner.lv >= s.partner.max) a.push({ lv: 'near', text: 'パートナーが育ちきった' });
  return a;
}

// ---------- 画面 ----------
function render() {
  const root = $('#root');
  const head = `<header class="head"><div><p class="eyebrow">学びクエスト</p><h1>運営ページ</h1></div>
    ${A.user ? `<button class="btn ghost" id="logout">ログアウト</button>` : ''}</header>`;
  if (A.user === undefined) { root.innerHTML = `${head}<section class="card"><p class="muted">読み込み中…</p></section>`; return; }
  if (!window.Cloud || !Cloud.enabled) { root.innerHTML = `${head}<section class="card"><p>連携（Firebase）が使えないため、運営ページは開けません。</p></section>`; return; }
  if (!A.user) {
    root.innerHTML = `${head}<section class="card login"><h2>ログイン</h2>
      <p>運営用の Google アカウントでログインしてください。</p>
      <button class="btn google" id="login">Google でログイン</button></section>`;
    $('#login').onclick = async () => {
      try { await Cloud.signInParent(); } catch (e) { if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') toast('ログインできませんでした（' + (e.code || e.message) + '）'); }
    };
    return;
  }
  if (!A.admin) {
    root.innerHTML = `${head}<section class="card"><h2>運営として登録されていません</h2>
      <p>このアカウントを運営にするには、Firebase コンソールで次の手順を1回だけ行ってください。</p>
      <ol class="steps">
        <li>Firestore Database → 「コレクションを開始」</li>
        <li>コレクション ID：<code>admins</code></li>
        <li>ドキュメント ID：<code class="uid">${esc(A.user.uid)}</code>（このアカウントの ID）</li>
        <li>フィールドを1つ（例：<code>role</code> = <code>owner</code>）入れて保存</li>
        <li>このページを開き直す</li>
      </ol>
      <p class="note">あわせて、リポジトリの <code>firestore.rules</code>（運営の権限が入った新しい版）を Firestore のルールに貼って「公開」してください。</p>
      <p class="note">ログイン中：${esc(A.user.email || '')}</p></section>`;
    bindHead();
    return;
  }
  root.innerHTML = head + overviewHtml() + familiesHtml() + eventsHtml();
  bindHead();
  bindFamilies();
  bindEvents();
}
function bindHead() { if ($('#logout')) $('#logout').onclick = async () => { if (confirm('ログアウトしますか？')) await Cloud.signOut(); }; }

function summaries() {
  return (A.families || []).map(f => ({ f, s: f.state ? summarize(f) : null }));
}
function overviewHtml() {
  if (!A.families) return `<section class="card"><h2>利用者の状況</h2><p class="muted">${A.loading ? '読み込み中…' : ''}</p>
    <div class="save-row"><button class="btn" id="reload">読み込む</button></div></section>`;
  const list = summaries().filter(x => x.s && !x.s.empty);
  const alerts = list.flatMap(x => x.s.alerts.map(a => ({ ...a, who: x.s.name })));
  const active = list.filter(x => x.s.lastStudy >= Date.now() - 7 * 864e5).length;
  return `<section class="card"><h2>利用者の状況</h2>
    <div class="stats">
      <div><small>連携している家庭</small><b>${A.families.length}</b></div>
      <div><small>遊んでいる子ども</small><b>${list.length}人</b></div>
      <div><small>この7日に勉強</small><b>${active}人</b></div>
    </div>
    <h3>クリアが近いもの（新しい内容を足すめやす）</h3>
    ${alerts.length ? `<ul class="alerts">${alerts.map(a => `<li class="${a.lv}"><b>${esc(a.who)}</b>：${esc(a.text)}</li>`).join('')}</ul>`
      : '<p class="muted">まだありません。</p>'}
    <p class="note">「クリア間近」は8割以上進んだもの。連携していない端末の記録は見えません。</p>
    <div class="save-row"><button class="btn ghost" id="reload">最新にする</button></div>
  </section>`;
}
function familiesHtml() {
  if (!A.families) return '';
  const rows = summaries();
  if (!rows.length) return '<section class="card"><h2>家庭ごと</h2><p class="muted">連携している家庭はまだありません。</p></section>';
  return `<section class="card"><h2>家庭ごと</h2>${rows.map(({ f, s }) => {
    const kids = (f.fam.childUids || []).length + (f.fam.childUid && !(f.fam.childUids || []).includes(f.fam.childUid) ? 1 : 0);
    if (!s || s.empty) return `<div class="fam"><h3>${s ? esc(s.name) : '（記録なし）'}</h3><p class="note">端末 ${kids}台・最後の記録 ${stamp(f.state && f.state.updatedAt)}</p></div>`;
    const pct = (a, b) => Math.round(a / b * 100);
    return `<details class="fam"><summary><span class="fname"><b>${esc(s.name)}</b> Lv.${s.level} <small>${esc(s.title)}</small></span>
        <span class="fsub">🔥${s.streak}日・7日で${fmtMin(s.weekMin)}・最後の記録 ${stamp(f.state.updatedAt)}</span>
        ${s.alerts.length ? `<span class="fchips">${s.alerts.map(a => `<em class="${a.lv}">${esc(a.text)}</em>`).join('')}</span>` : ''}</summary>
      <table class="kv">
        <tr><th>冒険</th><td>${s.stage.region.flag} ${esc(s.stage.city.name)}（${s.k + 1} / ${s.cities}都市${s.loop ? `・${s.loop + 1}周目` : ''}）<div class="bar"><i style="width:${pct(s.k, s.cities)}%"></i></div></td></tr>
        <tr><th>パートナー</th><td>${s.partner ? `${esc(s.partner.name)}（${s.partner.rank}ランク Lv.${s.partner.lv}/${s.partner.max}・限界突破${s.partner.lb}・強さ${s.partner.power}）` : '—'}</td></tr>
        <tr><th>仲間</th><td>${s.owned} / ${s.regular}（${s.byRank.map(([r, n, t]) => `${RARITY[r].label} ${n}/${t}`).join('・')}）・限定 ${s.ownedLimited}/${s.limited}・育ちきった仲間 ${s.maxed}<div class="bar"><i style="width:${pct(s.owned, s.regular)}%"></i></div></td></tr>
        <tr><th>講座</th><td>${s.coursesDone} / ${s.coursesTotal}（${s.groups.map(g => `${esc(g.g.short)} ${g.done}/${g.total}`).join('・')}）<div class="bar"><i style="width:${pct(s.coursesDone, s.coursesTotal)}%"></i></div></td></tr>
        <tr><th>勉強</th><td>合計 ${fmtMin(s.totalMin)}・この7日 ${fmtMin(s.weekMin)}・承認待ち ${s.pending}件</td></tr>
        <tr><th>持ち物</th><td>⭐${s.stars}・🎫${s.tickets}・契約書${s.contracts}枚・ガチャ${s.pulls}回</td></tr>
        <tr><th>端末</th><td>${kids}台</td></tr>
      </table></details>`;
  }).join('')}</section>`;
}
function bindFamilies() { $$('#reload').forEach(b => b.onclick = loadFamilies); }
async function loadFamilies() {
  A.loading = true; render();
  try { A.families = await Cloud.listFamilies(); }
  catch (e) { toast('読み込めませんでした（' + (e.code || e.message) + '）'); }
  A.loading = false;
  render();
}

// ---------- イベント（ピックアップガチャ） ----------
function evStatus(e) { const t = today(); return t < e.start ? '予定' : t > e.end ? '終了' : '開催中'; }
function blankEvent() { const t = today(); return { id: Date.now(), name: '', start: t, end: dayOffset(t, 6), pickup: [], rate: 50 }; }
function eventsHtml() {
  const list = A.events || [];
  const e = A.edit;
  const chars = [...CHARACTERS].sort((a, b) => (b.limited ? 1 : 0) - (a.limited ? 1 : 0) || b.r - a.r);
  return `<section class="card"><h2>イベント（ピックアップガチャ）</h2>
    <p class="note">期間中、ピックアップした仲間が出やすくなります（そのランクが出たとき、決めた割合でピックアップの仲間になる）。「限定」の仲間はイベントでしか出ません。連携している端末のガチャ画面に表示されます。</p>
    ${A.events === null ? '<p class="muted">読み込み中…</p>' : list.length ? `<ul class="evlist">${list.slice().sort((a, b) => b.start.localeCompare(a.start)).map(x => `<li>
      <div><span class="evst ${evStatus(x)}">${evStatus(x)}</span><b>${esc(x.name)}</b><small>${x.start} 〜 ${x.end}・${x.rate}%</small>
        <small>${x.pickup.filter(id => CHAR_BY_ID[id]).map(id => `${CHAR_BY_ID[id].names[0]}（${RARITY[CHAR_BY_ID[id].r].label}${CHAR_BY_ID[id].limited ? '・限定' : ''}）`).join('、')}</small></div>
      <div class="evbtns"><button class="btn ghost" data-edit="${x.id}">編集</button><button class="btn ghost" data-del="${x.id}">削除</button></div></li>`).join('')}</ul>`
      : '<p class="muted">イベントはまだありません。</p>'}
    ${e ? `<div class="evform">
      <h3>${list.some(x => x.id === e.id) ? 'イベントを編集' : '新しいイベント'}</h3>
      <label>イベント名<input id="ev-name" maxlength="30" value="${esc(e.name)}" placeholder="例：冬休みピックアップ"></label>
      <div class="targets"><label>はじまり<input id="ev-start" type="date" value="${e.start}"></label><label>おわり<input id="ev-end" type="date" value="${e.end}"></label></div>
      <label>ピックアップの割合（%）<input id="ev-rate" type="number" min="10" max="100" value="${e.rate}"></label>
      <h3>ピックアップする仲間</h3>
      <div class="pickgrid">${chars.map(c => `<label class="pk ${c.limited ? 'lim' : ''}"><input type="checkbox" value="${c.id}" ${e.pickup.includes(c.id) ? 'checked' : ''}>
        <span>${RARITY[c.r].label}</span>${esc(c.names[0])}${c.limited ? '<em>限定</em>' : ''}</label>`).join('')}</div>
      <div class="save-row"><button class="btn ghost" id="ev-cancel">やめる</button><button class="btn" id="ev-save">保存して公開</button></div>
    </div>` : '<div class="save-row"><button class="btn" id="ev-new">イベントを作る</button></div>'}
  </section>`;
}
function bindEvents() {
  if ($('#ev-new')) $('#ev-new').onclick = () => { A.edit = blankEvent(); render(); };
  $$('[data-edit]').forEach(b => b.onclick = () => { A.edit = JSON.parse(JSON.stringify(A.events.find(x => String(x.id) === b.dataset.edit))); render(); });
  $$('[data-del]').forEach(b => b.onclick = async () => {
    const x = A.events.find(e => String(e.id) === b.dataset.del);
    if (!x || !confirm(`「${x.name}」を削除しますか？`)) return;
    await saveList(A.events.filter(e => e !== x), '削除しました');
  });
  if (!$('#ev-save')) return;
  $('#ev-cancel').onclick = () => { A.edit = null; render(); };
  $('#ev-save').onclick = async () => {
    const e = { ...A.edit, name: $('#ev-name').value.trim(), start: $('#ev-start').value, end: $('#ev-end').value,
      rate: Math.round(+$('#ev-rate').value), pickup: $$('.pickgrid input:checked').map(i => i.value) };
    if (!e.name) { toast('イベント名を入れてください'); return; }
    if (!e.start || !e.end || e.end < e.start) { toast('期間を確かめてください'); return; }
    if (!(e.rate >= 10 && e.rate <= 100)) { toast('割合は10〜100%にしてください'); return; }
    if (!e.pickup.length) { toast('ピックアップする仲間を選んでください'); return; }
    const list = (A.events || []).filter(x => x.id !== e.id);
    await saveList([...list, e], '保存しました。連携している端末に届きます');
    A.edit = null;
    render();
  };
}
async function saveList(list, msg) {
  try { await Cloud.saveEvents(list); toast(msg); } catch (err) { toast('保存できませんでした（' + (err.code || err.message) + '）'); }
}

// ---------- 起動 ----------
let offEvents = null;
function start() {
  if (!window.Cloud || !Cloud.enabled) { A.user = null; render(); return; }
  Cloud.onParentAuth(async user => {
    if (offEvents) { offEvents(); offEvents = null; }
    A.user = user; A.admin = false; A.families = null; A.events = null; A.edit = null;
    if (user) A.admin = await Cloud.isAdmin(user.uid);
    render();
    if (!A.admin) return;
    offEvents = Cloud.watchEvents(list => { A.events = list || []; if (!A.edit) render(); });   // 編集中は書きかけを消さない
    loadFamilies();
  });
}
window.addEventListener('cloud-ready', start);
render();
