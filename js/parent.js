'use strict';
// ===== 保護者ページ =====
// ゲームと同じ端末・ブラウザの保存データ（localStorage）を読み、目標時間と優先教科だけを書き込む。

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const DOWS = ['日', '月', '火', '水', '木', '金', '土'];
const UNLOCK_KEY = 'manabi-quest-parent-unlocked';

let day = today();          // 表示している日
let draft = null;           // 編集中の設定（保存するまで反映しない）

function parseKey(key) { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d); }
function dayLabel(key) { const d = parseKey(key); return `${d.getMonth() + 1}月${d.getDate()}日（${DOWS[d.getDay()]}）`; }
function hhmm(t) { const d = new Date(t); return d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0'); }
function minutesOn(key) { return S.sessions.filter(s => s.date === key).reduce((a, s) => a + s.minutes, 0); }
function subjectMinutes(sessions) {
  return SUBJECTS.map(sub => ({ sub, min: sessions.filter(s => s.subject === sub.id).reduce((a, s) => a + s.minutes, 0) }));
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
  S = load();
  if (!draft) draft = freshDraft();
  const root = $('#root');
  if (!isUnlocked()) { renderLock(root); return; }
  if (!S.player) {
    root.innerHTML = `${headerHtml()}<section class="card empty">
      <h2>まだゲームが始まっていません</h2>
      <p>お子さまが「学びクエスト」を始めると、ここで勉強時間を確認できるようになります。</p>
      <p class="note">このページは、お子さまがゲームで使っている端末・ブラウザと同じもので開いてください。</p>
      <a class="btn" href="index.html">ゲームを開く</a></section>`;
    return;
  }
  root.innerHTML = headerHtml() + dayHtml() + weekHtml() + settingsHtml() + pinHtml() + footHtml();
  bind();
}

function headerHtml() {
  const p = S.player;
  return `<header class="head">
    <div><p class="eyebrow">学びクエスト</p><h1>保護者ページ</h1></div>
    ${p ? `<div class="kid"><b>${esc(p.name)}</b> さん<small>Lv.${p.level}・連続 ${currentStreak()}日</small></div>` : ''}
  </header>`;
}

// ---------- その日の勉強 ----------
function dayHtml() {
  const ss = S.sessions.filter(s => s.date === day);
  const total = ss.reduce((a, s) => a + s.minutes, 0);
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
        <b>${fmtMin(s.minutes)}</b>${s.goalMet ? '<span class="tag">目標達成</span>' : ''}</li>`).join('')}</ul>` : ''}
  </section>`;
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
function targetSelect(id, value) {
  return `<select id="${id}">${TARGET_OPTIONS.map(m => `<option value="${m}" ${m === value ? 'selected' : ''}>${m ? fmtMin(m) : '設定しない'}</option>`).join('')}</select>`;
}
function settingsHtml() {
  const d = draft;
  const dirty = JSON.stringify(d) !== JSON.stringify(S.parent);
  return `<section class="card">
    <h2>学習の設定</h2>
    <h3>1日の目標学習時間</h3>
    <div class="targets">
      <label>平日（月〜金）${targetSelect('t-weekday', d.target.weekday)}</label>
      <label>土日${targetSelect('t-weekend', d.target.weekend)}</label>
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
    <p>データはこの端末のブラウザ内にだけ保存されています。お子さまがゲームで使っている端末・ブラウザで、このページを開いてください。</p>
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
  $('#save').onclick = () => {
    saveParent({ ...S.parent, target: { ...draft.target }, priority: [...draft.priority] });
    draft = freshDraft();
    render();
    toast('保存しました。お子さまの画面に反映されます');
  };

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
window.addEventListener('storage', e => { if (e.key === SAVE_KEY) render(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') render(); });
setInterval(() => { if (S.active && isUnlocked() && day === today() && document.activeElement?.tagName !== 'SELECT') render(); }, 30000);
render();
