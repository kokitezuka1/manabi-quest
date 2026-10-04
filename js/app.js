'use strict';
// ===== がめん =====

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pct = (a, b) => Math.max(0, Math.min(100, (a / b) * 100)) + '%';
const APP_TITLE = 'まなびクエスト';

let current = { name: 'home', params: {} };
let timerHandle = null, wakeLock = null;
const SCREENS = {};

function go(name, params = {}) {
  leaveTimer();
  current = { name, params };
  render();
  window.scrollTo(0, 0);
}

function render() {
  ensureDaily();
  const full = ['onboard', 'timer', 'result', 'setup'].includes(current.name);
  document.body.classList.toggle('fullmode', full);
  renderTopbar();
  renderNav();
  const el = $('#screen');
  el.innerHTML = '';
  el.className = 'screen-' + current.name;
  SCREENS[current.name](el, current.params);
}

// ---------- ぶひん ----------
function avatar(id, { size = 72, lv } = {}) {
  const c = CHAR_BY_ID[id];
  const level = lv ?? charLevel(id);
  const st = charStage(level);
  return `<div class="avatar st${st} r${c.r}" style="--el:${ELEMENTS[c.el].color};--sz:${size}px">
    <span class="emo">${charEmoji(id, level)}</span>${st >= 2 ? '<span class="crown">👑</span>' : ''}</div>`;
}
function rarityTag(r) { return `<span class="rarity r${r}">${RARITY[r].stars}</span>`; }
function elTag(el) { const e = ELEMENTS[el]; return `<span class="eltag" style="background:${e.color}">${e.icon}${e.name}</span>`; }
function subjChip(id) { const s = SUBJECT_BY_ID[id]; return `<span class="chip" style="background:${s.color}">${s.icon} ${s.name}</span>`; }

function renderTopbar() {
  const tb = $('#topbar');
  const p = S.player;
  if (!p || document.body.classList.contains('fullmode')) { tb.innerHTML = ''; return; }
  tb.innerHTML = `<div class="tb">
    <button class="tb-me" id="tb-me">${avatar(S.partner, { size: 40 })}
      <div class="tb-info"><div class="tb-name">${esc(p.name)} <span class="lv">Lv.${p.level}</span></div>
      <div class="bar xp"><i style="width:${pct(p.xp, xpNeed(p.level))}"></i></div></div></button>
    <div class="tb-cur">
      <span class="pill" title="ほし">⭐<b>${p.stars}</b></span>
      <span class="pill" title="ガチャチケット">🎫<b>${p.tickets}</b></span>
      <span class="pill fire" title="れんぞく">🔥<b>${currentStreak()}</b></span>
    </div>
    <button class="icon-btn" id="gear" aria-label="せってい">⚙️</button>
  </div>`;
  $('#gear').onclick = () => { Sound.tap(); openSettings(); };
  $('#tb-me').onclick = () => { Sound.tap(); go('zukan'); };
}

function renderNav() {
  const nav = $('#nav');
  if (!S.player || document.body.classList.contains('fullmode')) { nav.innerHTML = ''; return; }
  const items = [
    ['home', '🏠', 'ホーム', claimableCount()],
    ['adventure', '🗺️', 'ぼうけん', 0],
    ['gacha', '🎁', 'ガチャ', S.player.tickets > 0 || S.player.stars >= GACHA.cost1 ? '!' : 0],
    ['zukan', '📚', 'なかま', 0],
    ['records', '📅', 'きろく', 0],
  ];
  nav.innerHTML = items.map(([id, ic, label, badge]) =>
    `<button class="nav-btn ${current.name === id ? 'on' : ''}" data-go="${id}">
      <span class="nav-ic">${ic}</span><span>${label}</span>${badge ? `<i class="badge">${badge}</i>` : ''}</button>`).join('');
  $$('.nav-btn', nav).forEach(b => b.onclick = () => { Sound.tap(); go(b.dataset.go); });
}

// ---------- モーダル ----------
function openModal(html, { cls = '', dismiss = false } = {}) {
  const back = document.createElement('div');
  back.className = 'modal-back';
  back.innerHTML = `<div class="modal ${cls}">${html}</div>`;
  $('#modal-root').appendChild(back);
  let resolve;
  const done = new Promise(r => resolve = r);
  const close = v => {
    if (back.classList.contains('out')) return;
    back.classList.add('out');
    setTimeout(() => back.remove(), 200);
    resolve(v);
  };
  back.addEventListener('click', e => {
    const b = e.target.closest('[data-v]');
    if (b) { Sound.tap(); close(b.dataset.v); }
    else if (dismiss && e.target === back) close(null);
  });
  return { el: back.querySelector('.modal'), close, done };
}
const modal = (html, opts) => openModal(html, opts).done;

async function runEvents(events) {
  for (const ev of events) {
    if (ev.type === 'login') {
      Sound.coin();
      await modal(`<div class="m-emo">🔥</div>
        <h2>${ev.streak >= 2 ? `れんぞく ${ev.streak}にちめ！` : 'きょうも がんばったね！'}</h2>
        <p>${ev.streak >= 2 ? 'まいにち つづけて えらい！' : 'まいにち つづけると ボーナスが ふえるよ'}</p>
        <div class="rw-big">⭐+${ev.stars}${ev.tickets ? ` 🎫+${ev.tickets}` : ''}</div>
        <button class="btn gold wide" data-v="ok">うけとる</button>`);
    } else if (ev.type === 'levelup') {
      Sound.levelup(); FX.confetti(140);
      await modal(`<div class="lvup">LEVEL UP!</div>
        <div class="lv-big">Lv.${ev.from} → <b>Lv.${ev.to}</b></div>
        ${ev.newTitle ? `<div class="new-title">しょうごう<br>「${ev.newTitle}」を ゲット！</div>` : ''}
        <div class="rw-big">⭐+${ev.stars}${ev.tickets ? ` 🎫+${ev.tickets}` : ''}</div>
        <button class="btn gold wide" data-v="ok">やったー！</button>`, { cls: 'shine' });
    } else if (ev.type === 'charlv') {
      const evolving = charStage(ev.to) > charStage(ev.from);
      const showLv = evolving ? ev.from : ev.to;
      Sound.levelup();
      await modal(`<div class="m-av bounce">${avatar(ev.id, { size: 110, lv: showLv })}</div>
        <h2>${charName(ev.id, showLv)} が レベルアップ！</h2>
        <div class="lv-big">Lv.${ev.from} → <b>Lv.${ev.to}</b></div>
        <p>つよさ が あがった！ ⚔️ ${charPower(ev.id)}</p>
        <button class="btn gold wide" data-v="ok">OK</button>`);
    } else if (ev.type === 'evolve') {
      const m = openModal(`<p class="evo-msg" id="evo-msg">おや…？ ${charName(ev.id, ev.fromLv)} の ようすが…！</p>
        <div class="evo-box"><div id="evo-av" class="evo-flash">${avatar(ev.id, { size: 130, lv: ev.fromLv })}</div></div>
        <button class="btn gold wide hidden" data-v="ok" id="evo-ok">すごい！</button>`, { cls: 'evo' });
      Sound.evolve();
      await sleep(1900);
      $('#evo-av', m.el).className = 'pop';
      $('#evo-av', m.el).innerHTML = avatar(ev.id, { size: 150, lv: ev.toLv });
      $('#evo-msg', m.el).innerHTML = `<b>${charName(ev.id, ev.toLv)}</b> に しんかした！`;
      $('#evo-ok', m.el).classList.remove('hidden');
      FX.confetti(160); FX.burstAt($('#evo-av', m.el), 60, true);
      await m.done;
    } else if (ev.type === 'clear') {
      Sound.win(); FX.confetti(100);
      const nw = ev.newWorld;
      await modal(`<div class="m-emo">🏆</div><h2>ステージ クリア！</h2>
        <div class="defeated">${ev.clears.map(i => { const s = stageInfo(i); return `<span>${s.enemy.e}<small>${s.enemy.n}</small></span>`; }).join('')}</div>
        <p>を たおした！</p>
        <div class="rw-big">⭐+${ev.stars}${ev.tickets ? ` 🎫+${ev.tickets}` : ''}</div>
        ${nw ? `<div class="new-world" style="--b1:${nw.world.bg[0]};--b2:${nw.world.bg[1]}">🎊 あたらしい せかいが ひらいた！<br>
          <b>${nw.world.icon} ${nw.world.name}</b>${nw.loop ? `<br><small>でんせつモード ループ${nw.loop + 1}</small>` : ''}</div>` : ''}
        <button class="btn gold wide" data-v="ok">つぎへ</button>`, { cls: 'shine' });
    }
  }
  renderTopbar(); renderNav();
}

// ---------- はじめて ----------
SCREENS.onboard = (el, params) => {
  if (!params.step || params.step === 1) {
    el.innerHTML = `<div class="onboard">
      <div class="logo"><span class="logo-emo">📚⚔️✨</span><h1>まなび<br>クエスト</h1></div>
      <p class="lead">べんきょうした じかんで<br>なかまを そだてて ボスを たおそう！</p>
      <div class="card"><label class="lbl">きみの なまえは？</label>
      <input id="name" class="input" maxlength="10" placeholder="なまえ" autocomplete="off"></div>
      <button class="btn big gold" id="next">つぎへ ▶</button></div>`;
    const inp = $('#name');
    $('#next').onclick = () => {
      const name = inp.value.trim();
      if (!name) { inp.classList.add('shake'); setTimeout(() => inp.classList.remove('shake'), 400); inp.focus(); return; }
      Sound.tap();
      go('onboard', { step: 2, name });
    };
    inp.onkeydown = e => { if (e.key === 'Enter') $('#next').click(); };
    return;
  }
  el.innerHTML = `<div class="onboard">
    <h2 class="center">${esc(params.name)}さん、<br>さいしょの なかまを えらんでね！</h2>
    <div class="starters">${STARTERS.map(id => {
      const c = CHAR_BY_ID[id], sub = SUBJECT_BY_EL[c.el];
      return `<button class="starter" data-id="${id}" style="--c:${ELEMENTS[c.el].color}">
        ${avatar(id, { size: 84, lv: 1 })}<b>${c.names[0]}</b>${elTag(c.el)}
        <small>${sub.icon}${sub.name} で<br>よく そだつ</small></button>`;
    }).join('')}</div></div>`;
  $$('.starter', el).forEach(b => b.onclick = async () => {
    const id = b.dataset.id;
    Sound.unlock();
    startGame(params.name, id);
    Sound.levelup(); FX.confetti(150);
    await modal(`<div class="m-av bounce">${avatar(id, { size: 120 })}</div>
      <h2>${charName(id)} が なかまに なった！</h2>
      <p>はじめての プレゼント</p><div class="rw-big">🎫 ガチャチケット ×1</div>
      <button class="btn gold wide" data-v="ok">ぼうけんに しゅっぱつ！</button>`, { cls: 'shine' });
    go('home');
  });
};

// ---------- ホーム ----------
function sceneHtml(st) {
  const left = st.hp - (st.i === S.stage.i ? S.stage.dmg : 0);
  const ws = SUBJECT_BY_EL[st.enemy.weak];
  return `<div class="scene" style="--b1:${st.world.bg[0]};--b2:${st.world.bg[1]}">
    <div class="scene-head">${st.world.icon} ${st.world.name} <b>${st.sub + 1}/3</b>${st.loop ? ` <span class="loop">ループ${st.loop + 1}</span>` : ''}</div>
    <div class="ground"></div>
    <div class="ally bob">${avatar(S.partner, { size: 86 })}</div>
    <div class="vs">VS</div>
    <div class="foe ${st.boss ? 'boss' : ''}" id="foe">
      <div class="foe-name">${st.boss ? '👑 ' : ''}${st.enemy.n}</div>
      <div class="foe-emo" id="foe-emo">${st.enemy.e}</div>
      <div class="hp"><i id="foe-hp" style="width:${pct(left, st.hp)}"></i><span id="foe-hptext">${left} / ${st.hp}</span></div>
    </div>
    <div class="weak">よわてん：<b style="color:${ws.color}">${ws.icon} ${ws.name}</b></div>
  </div>`;
}

function missionsHtml() {
  return missionList().map(m => {
    const rw = m.reward.tickets ? `🎫×${m.reward.tickets}` : `⭐×${m.reward.stars}`;
    const action = m.claimed ? '<span class="claimed">✅</span>'
      : m.done ? `<button class="btn mini gold wiggle" data-claim="${m.id}">うけとる</button>`
      : `<span class="rw">${rw}</span>`;
    return `<div class="mission ${m.done ? 'done' : ''} ${m.bonus ? 'bonus' : ''}">
      <div class="m-text">${m.label}<div class="bar"><i style="width:${pct(m.cur, m.max)}"></i></div></div>${action}</div>`;
  }).join('');
}

SCREENS.home = el => {
  const st = currentStage();
  const t = todayStats();
  const showGachaHint = S.gacha.total === 0 && S.player.tickets > 0;
  el.innerHTML = `${sceneHtml(st)}
    <button class="btn big gold pulse" id="start">📚 べんきょう スタート！</button>
    ${showGachaHint ? `<button class="card hint-card" id="ghint">🎫 ガチャチケットを もっているよ！<br><b>ガチャで あたらしい なかまを ゲットしよう ▶</b></button>` : ''}
    <div class="card">
      <h3>🕒 きょうの べんきょう <span class="today-min">${fmtMin(t.minutes)}</span></h3>
      <div class="today-bar">${t.minutes ? t.bySubject.filter(x => x.min).map(x =>
        `<i style="flex:${x.min};background:${x.sub.color}" title="${x.sub.name}">${x.sub.icon}</i>`).join('') : '<span class="muted">まだ だよ。いっしょに がんばろう！</span>'}</div>
    </div>
    <div class="card"><h3>🎯 きょうの ミッション</h3><div id="missions">${missionsHtml()}</div></div>`;
  $('#start').onclick = () => { Sound.tap(); go('setup'); };
  if (showGachaHint) $('#ghint').onclick = () => { Sound.tap(); go('gacha'); };
  $('#missions').onclick = e => {
    const b = e.target.closest('[data-claim]');
    if (!b) return;
    const rw = claimMission(b.dataset.claim);
    if (!rw) return;
    Sound.coin(); FX.burstAt(b, 30, true);
    floatText(b, rw.tickets ? `🎫+${rw.tickets}` : `⭐+${rw.stars}`, 'gold');
    $('#missions').innerHTML = missionsHtml();
    renderTopbar(); renderNav();
  };
};

// ---------- じゅんび ----------
SCREENS.setup = el => {
  let subj = S.settings.lastSubject || SUBJECTS[0].id;
  let goal = S.settings.lastGoal || 15;
  const st = currentStage();
  const pel = CHAR_BY_ID[S.partner].el;
  const draw = () => {
    const { dmg, weak } = damagePerMin(subj, st);
    el.innerHTML = `<div class="setup">
      <button class="link back" id="back">← もどる</button>
      <h2>なにを べんきょうする？</h2>
      <div class="subj-grid">${SUBJECTS.map(s => `<button class="subj ${s.id === subj ? 'sel' : ''}" data-s="${s.id}" style="--c:${s.color}">
        <span class="si">${s.icon}</span><span class="sn">${s.name}</span>
        ${s.el === st.enemy.weak ? '<em class="tag hot">ボスに ×2</em>' : ''}
        ${s.el === pel ? '<em class="tag">なかまが そだつ</em>' : ''}</button>`).join('')}</div>
      <p class="muted small">「そのほか」は しゅくだい・どくしょ・プリント など</p>
      <h2>なんぷん がんばる？</h2>
      <div class="goal-row">${GOAL_OPTIONS.map(g => `<button class="goal ${g === goal ? 'sel' : ''}" data-g="${g}">${g}<small>${funpun(g)}</small></button>`).join('')}</div>
      <div class="card preview">
        <div>たっせい したら もらえる！</div>
        <div class="pv-row"><span>⭐ <b>${goal + 5}</b></span><span>🧠 <b>${Math.round(goal * 12)}</b></span><span>⚔️ <b>${dmg * goal}</b>${weak ? '<em class="tag hot">×2</em>' : ''}</span></div>
      </div>
      <button class="btn big gold pulse" id="go">▶ スタート！</button></div>`;
    $('#back').onclick = () => { Sound.tap(); go('home'); };
    $$('.subj', el).forEach(b => b.onclick = () => { Sound.tap(); subj = b.dataset.s; draw(); });
    $$('.goal', el).forEach(b => b.onclick = () => { Sound.tap(); goal = +b.dataset.g; draw(); });
    $('#go').onclick = () => { Sound.coin(); startActive(subj, goal); go('timer'); };
  };
  draw();
};

// ---------- タイマー ----------
const RING_LEN = 2 * Math.PI * 96;
function mmss(sec) {
  const h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, s = sec % 60;
  const p = n => String(n).padStart(2, '0');
  return (h ? h + ':' + p(m) : p(m)) + ':' + p(s);
}
async function requestWake() {
  try { if ('wakeLock' in navigator && !wakeLock) wakeLock = await navigator.wakeLock.request('screen'); } catch (e) { /* たいおうしていない */ }
}
function leaveTimer() {
  if (timerHandle) { clearInterval(timerHandle); timerHandle = null; }
  if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
  document.title = APP_TITLE;
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (current.name === 'timer') { wakeLock = null; requestWake(); }
  else if (current.name === 'home' && S.daily.date !== today()) render();
});

SCREENS.timer = el => {
  const a = S.active;
  if (!a) { go('home'); return; }
  const sub = SUBJECT_BY_ID[a.subject];
  const st = currentStage();
  const { dmg: dpm } = damagePerMin(a.subject, st);
  el.innerHTML = `<div class="timer" style="--c:${sub.color}">
    <div class="t-head">${subjChip(a.subject)}<span class="t-goal">🎯 もくひょう ${fmtMin(a.goal)}</span></div>
    <div class="ring-wrap" id="ringwrap">
      <svg viewBox="0 0 220 220" class="ring"><circle cx="110" cy="110" r="96" class="ring-bg"/>
        <circle cx="110" cy="110" r="96" class="ring-fg" id="ringfg" stroke-dasharray="${RING_LEN}" stroke-dashoffset="${RING_LEN}"/></svg>
      <div class="ring-text"><div id="ttime" class="ttime">00:00</div><div id="tsub" class="t-subtext"></div></div>
    </div>
    <div class="t-buddy"><div class="bubble" id="bubble">いっしょに がんばろう！</div><div class="bob">${avatar(S.partner, { size: 92 })}</div></div>
    <div class="t-live">
      <div class="live"><span>⭐</span><b id="lstars">0</b></div>
      <div class="live"><span>🧠</span><b id="lxp">0</b></div>
      <div class="live"><span>⚔️</span><b id="ldmg">0</b></div>
    </div>
    <div class="t-btns"><button class="btn ghost" id="pause"></button><button class="btn gold" id="fin">🏁 おわる！</button></div>
    <button class="link small" id="cancel">やめる（きろく しない）</button>
  </div>`;

  let lastMin = -1, busy = false;
  const ring = $('#ringfg');
  const update = () => {
    if (!S.active) return;
    const sec = activeElapsedSec();
    const min = Math.min(Math.floor(sec / 60), MAX_SESSION_MIN);
    const goalSec = a.goal * 60;
    const met = sec >= goalSec;
    const paused = !!a.pausedAt;
    $('#ttime').textContent = mmss(sec);
    $('#tsub').textContent = paused ? '☕ きゅうけいちゅう' : met ? `🎉 たっせい！ ボーナスタイム` : `のこり ${mmss(goalSec - sec)}`;
    ring.setAttribute('stroke-dashoffset', RING_LEN * (1 - Math.min(1, sec / goalSec)));
    $('#ringwrap').classList.toggle('met', met);
    $('#ringwrap').classList.toggle('paused', paused);
    $('#pause').textContent = paused ? '▶ さいかい' : '⏸ きゅうけい';
    document.title = `${mmss(sec)} ${sub.name} | ${APP_TITLE}`;

    if (min !== lastMin) {
      const first = lastMin === -1;
      lastMin = min;
      $('#lstars').textContent = min + (met ? 5 : 0);
      $('#lxp').textContent = Math.round(min * 10 * (met ? 1.2 : 1));
      $('#ldmg').textContent = min * dpm;
      if (!first && min > 0) {
        $$('.live', el).forEach(x => { x.classList.remove('pop'); void x.offsetWidth; x.classList.add('pop'); });
        $('#bubble').textContent = CHEERS[Math.floor(Math.random() * CHEERS.length)];
        $('#bubble').classList.remove('pop'); void $('#bubble').offsetWidth; $('#bubble').classList.add('pop');
      }
    }
    if (busy) return;
    if (met && !a.goalNotified) {
      a.goalNotified = true; save();
      busy = true;
      Sound.chime(); FX.confetti(100);
      modal(`<div class="m-emo">🎉</div><h2>もくひょう たっせい！</h2>
        <p>すごい！ ${fmtMin(a.goal)} がんばったね！<br>つづけると もっと ⭐ が もらえるよ</p>
        <div class="m-btns"><button class="btn ghost" data-v="fin">おわる</button><button class="btn gold" data-v="cont">つづける！</button></div>`)
        .then(v => { busy = false; if (v === 'fin') finishFlow(true); });
    } else if (min >= MAX_SESSION_MIN && !paused) {
      togglePause();
      busy = true;
      modal(`<div class="m-emo">🏅</div><h2>${MAX_SESSION_MIN}ぷん がんばったよ！</h2><p>すごすぎる！ からだを やすめよう。</p>
        <button class="btn gold wide" data-v="ok">おわりにする</button>`).then(() => { busy = false; finishFlow(true); });
    }
  };
  $('#pause').onclick = () => { Sound.tap(); togglePause(); update(); };
  $('#fin').onclick = () => { Sound.tap(); finishFlow(false); };
  $('#cancel').onclick = async () => {
    Sound.tap();
    const v = await modal(`<div class="m-emo">🤔</div><h2>ほんとうに やめる？</h2><p>きろくは のこらないよ</p>
      <div class="m-btns"><button class="btn ghost" data-v="quit">やめる</button><button class="btn gold" data-v="cont">つづける</button></div>`);
    if (v === 'quit') { cancelActive(); go('home'); }
  };
  update();
  timerHandle = setInterval(update, 250);
  requestWake();
};

async function finishFlow(skipConfirm) {
  const a = S.active;
  if (!a) return;
  const sec = activeElapsedSec();
  const min = Math.min(Math.floor(sec / 60), MAX_SESSION_MIN);
  if (min < 1) {
    const v = await modal(`<div class="m-emo">⏱️</div><h2>まだ 1ぷん たってないよ</h2><p>1ぷん いじょう がんばると きろく できるよ！</p>
      <div class="m-btns"><button class="btn ghost" data-v="quit">やめる</button><button class="btn gold" data-v="cont">つづける</button></div>`);
    if (v === 'quit') { cancelActive(); go('home'); }
    return;
  }
  if (!skipConfirm) {
    const met = sec >= a.goal * 60;
    const v = await modal(`<div class="m-emo">🏁</div><h2>${fmtMin(min)} がんばったね！</h2>
      <p>${met ? 'おわりに する？' : `もくひょうまで あと ${mmss(a.goal * 60 - sec)}！<br>たっせい すると ボーナスが もらえるよ`}</p>
      <div class="m-btns"><button class="btn ghost" data-v="cont">まだ つづける</button><button class="btn gold" data-v="fin">おわる！</button></div>`);
    if (v !== 'fin' || !S.active) return;
  }
  const res = finishSession(a.subject, min, a.goal, activeElapsedSecAt(a) >= a.goal * 60);
  go('result', res);
}
function activeElapsedSecAt(a) {
  const now = a.pausedAt || Date.now();
  return Math.floor((now - a.startedAt - a.pausedTotal) / 1000);
}

// ---------- けっか ----------
async function animBar(bar, label, from, to, need, maxLv) {
  bar.style.transition = 'none';
  bar.style.width = pct(from.v, need(from.lv));
  void bar.offsetWidth;
  let lv = from.lv;
  const ups = Math.min(to.lv - from.lv, 5);
  for (let k = 0; k < ups; k++) {
    bar.style.transition = 'width .45s ease-out'; bar.style.width = '100%';
    await sleep(470);
    lv = k === ups - 1 ? to.lv : lv + 1;
    label.textContent = 'Lv.' + lv;
    label.classList.remove('pop'); void label.offsetWidth; label.classList.add('pop');
    Sound.coin();
    bar.style.transition = 'none'; bar.style.width = '0%'; void bar.offsetWidth;
  }
  bar.style.transition = 'width .6s ease-out';
  bar.style.width = to.lv >= (maxLv || Infinity) ? '100%' : pct(to.v, need(to.lv));
  await sleep(620);
}

SCREENS.result = async (el, r) => {
  const sub = SUBJECT_BY_ID[r.subject];
  const b = r.battle;
  const st = stageInfo(b.start);
  const hp0 = st.hp - b.startDmg;
  const cleared = b.clears.length > 0;
  const p = S.player, pc = S.chars[r.partner];
  el.innerHTML = `<div class="result">
    <div class="res-title">やったね！</div>
    <div class="res-sub">${subjChip(r.subject)} を <b class="big-num" id="rmin">0</b> ${funpun(r.minutes)} がんばった！</div>
    ${r.goalMet ? '<div class="goal-badge">🎯 もくひょう たっせい ボーナス！</div>' : ''}
    <div class="card rewards">
      <div class="rw-row" id="row1"><span class="rw-ic">⭐</span><span class="rw-l">ほし</span><b>+<span id="rstars">0</span></b></div>
      <div class="rw-row" id="row2"><span class="rw-ic">🧠</span><span class="rw-l">けいけんち <span class="lvl" id="plv">Lv.${r.xpBefore.level}</span></span><b>+<span id="rxp">0</span></b>
        <div class="bar xp"><i id="pbar"></i></div></div>
      <div class="rw-row" id="row3"><span class="rw-ic">${charEmoji(r.partner, r.charBefore.level)}</span><span class="rw-l">${charName(r.partner, r.charBefore.level)} <span class="lvl" id="clv">Lv.${r.charBefore.level}</span>
        ${r.match ? '<em class="tag">とくい ×1.5</em>' : ''}</span><b>+<span id="rcexp">0</span></b>
        <div class="bar cexp"><i id="cbar"></i></div></div>
    </div>
    <div class="card battle" id="battle" style="--b1:${st.world.bg[0]};--b2:${st.world.bg[1]}">
      <div class="bt-title">⚔️ ボスに こうげき！</div>
      <div class="arena">
        <div class="ally" id="ally">${avatar(r.partner, { size: 70, lv: r.charBefore.level })}</div>
        <div class="foe ${st.boss ? 'boss' : ''}" id="rfoe"><div class="foe-name">${st.enemy.n}</div><div class="foe-emo" id="rfoe-emo">${st.enemy.e}</div>
          <div class="hp"><i id="rhp" style="width:${pct(hp0, st.hp)}"></i><span id="rhptext">${hp0} / ${st.hp}</span></div></div>
      </div>
      <div class="bt-msg" id="btmsg">&nbsp;</div>
    </div>
    <button class="btn big gold" id="next" disabled>つぎへ ▶</button></div>`;

  await sleep(400);
  Sound.coin();
  await countUp($('#rmin'), 0, r.minutes, 700);

  $('#row1').classList.add('show'); Sound.coin();
  await countUp($('#rstars'), 0, r.stars, 600);
  FX.burstAt($('#row1'), 16, true);

  $('#row2').classList.add('show'); Sound.tick();
  countUp($('#rxp'), 0, r.xp, 700);
  await animBar($('#pbar'), $('#plv'), { lv: r.xpBefore.level, v: r.xpBefore.xp }, { lv: p.level, v: p.xp }, xpNeed);

  $('#row3').classList.add('show'); Sound.tick();
  countUp($('#rcexp'), 0, r.cexp, 700);
  await animBar($('#cbar'), $('#clv'), { lv: r.charBefore.level, v: r.charBefore.exp }, { lv: pc.level, v: pc.exp }, charExpNeed, CHAR_MAX_LV);

  // バトル
  $('#battle').classList.add('show');
  $('#battle').scrollIntoView({ behavior: 'smooth', block: 'center' });
  await sleep(600);
  const hits = Math.max(3, Math.min(8, Math.ceil(r.minutes / 4)));
  const foe = $('#rfoe-emo'), hpBar = $('#rhp'), hpText = $('#rhptext'), ally = $('#ally');
  const toFirst = cleared ? hp0 : b.total;
  let shown = 0, hpNow = hp0;
  for (let k = 0; k < hits; k++) {
    const dmgShow = Math.round(b.total * (k + 1) / hits) - shown;
    shown += dmgShow;
    hpNow = Math.max(0, hp0 - Math.round(toFirst * (k + 1) / hits));
    ally.classList.remove('attack'); void ally.offsetWidth; ally.classList.add('attack');
    await sleep(150);
    b.firstWeak ? Sound.crit() : Sound.hit();
    foe.classList.remove('hurt'); void foe.offsetWidth; foe.classList.add('hurt');
    floatText(foe, '-' + dmgShow, b.firstWeak ? 'crit' : 'dmg');
    hpBar.style.width = pct(hpNow, st.hp);
    hpText.textContent = `${hpNow} / ${st.hp}`;
    await sleep(Math.max(220, 900 / hits));
  }
  const critMsg = b.firstWeak ? '<span class="crit-msg">こうかは ばつぐんだ！</span><br>' : '';
  if (critMsg) $('#btmsg').innerHTML = critMsg;
  await sleep(500);
  if (cleared) {
    foe.classList.add('defeated');
    $('#rfoe').insertAdjacentHTML('beforeend', '<div class="stamp">げきは！</div>');
    Sound.win(); FX.confetti(120);
    $('#btmsg').innerHTML = critMsg + `${st.enemy.n} を たおした！${b.clears.length > 1 ? `<br>さらに ${b.clears.length - 1}たい たおしたぞ！` : ''}`;
  } else {
    $('#btmsg').innerHTML = critMsg + `${b.total} の ダメージ！ あと <b>${st.hp - b.endDmg}</b> で たおせる！`;
  }
  await sleep(400);
  const next = $('#next');
  next.disabled = false;
  next.classList.add('pulse');
  next.onclick = async () => {
    next.disabled = true;
    Sound.tap();
    await runEvents(r.events);
    go('home');
  };
};

// ---------- ぼうけん ----------
SCREENS.adventure = el => {
  const cur = S.stage.i;
  const loop = Math.floor(cur / STAGES_PER_LOOP);
  const base = loop * STAGES_PER_LOOP;
  const curW = Math.floor((cur - base) / 3);
  let html = `<h2 class="page-title">🗺️ ぼうけんマップ ${loop ? `<span class="loop">でんせつ ループ${loop + 1}</span>` : ''}</h2>
    <p class="muted small center">べんきょう すると なかまが こうげき！ よわてんの かもくなら ダメージ ×2</p>`;
  WORLDS.forEach((w, wi) => {
    if (wi > curW + 1) {
      html += `<div class="world locked hidden-w"><div class="w-head">❓ ？？？</div></div>`;
      return;
    }
    if (wi === curW + 1) {
      html += `<div class="world locked"><div class="w-head">🔒 ${w.icon} ${w.name}</div><p class="small">${WORLDS[wi - 1].enemies[2].n} を たおすと ひらくよ</p></div>`;
      return;
    }
    html += `<div class="world" style="--b1:${w.bg[0]};--b2:${w.bg[1]}"><div class="w-head">${w.icon} ${w.name}</div><div class="nodes">`;
    for (let k = 0; k < 3; k++) {
      const st = stageInfo(base + wi * 3 + k);
      const ws = SUBJECT_BY_EL[st.enemy.weak];
      if (st.i < cur) html += `<div class="node cleared"><span class="n-emo">${st.enemy.e}</span><small>${st.enemy.n}</small><b>✅ クリア</b></div>`;
      else if (st.i === cur) html += `<div class="node now ${st.boss ? 'boss' : ''}"><span class="n-emo">${st.enemy.e}</span><small>${st.enemy.n}</small>
          <div class="hp"><i style="width:${pct(st.hp - S.stage.dmg, st.hp)}"></i></div><b>よわてん ${ws.icon}${ws.name}</b></div>`;
      else html += `<div class="node ${st.boss ? 'boss' : ''}"><span class="n-emo dim">${st.enemy.e}</span><small>${st.boss ? 'ボス' : '？？？'}</small><b>HP ${st.hp}</b></div>`;
      if (k < 2) html += '<span class="path">›</span>';
    }
    html += '</div></div>';
  });
  html += `<button class="btn big gold" id="adv-go">📚 べんきょうして こうげき！</button>`;
  el.innerHTML = html;
  $('#adv-go').onclick = () => { Sound.tap(); go('setup'); };
  const now = $('.node.now', el);
  if (now) setTimeout(() => now.scrollIntoView({ block: 'center', behavior: 'smooth' }), 100);
};

// ---------- ガチャ ----------
SCREENS.gacha = el => {
  const p = S.player;
  const left = GACHA.pityMax - S.gacha.pity;
  const caps = Array.from({ length: 14 }, (_, i) => {
    const colors = ['#ff6b9a', '#4fc3f7', '#ffd54f', '#81c784', '#ba68c8', '#ff8a65'];
    return `<i style="left:${8 + (i * 37) % 78}%;top:${18 + ((i * 53) % 60)}%;background:${colors[i % colors.length]}"></i>`;
  }).join('');
  el.innerHTML = `<div class="gacha">
    <h2 class="g-title">✨ なかまガチャ ✨</h2>
    <div class="machine" id="machine"><div class="dome">${caps}</div><div class="mbody"><div class="slot"></div><div class="handle" id="handle"></div></div></div>
    <div class="pity">★★★ かくていまで あと <b>${left}</b> かい</div>
    <div class="g-btns">
      <button class="btn gold" data-k="ticket" ${p.tickets < 1 ? 'disabled' : ''}>🎫 チケットで ひく <small>のこり ${p.tickets}まい</small></button>
      <button class="btn" data-k="one" ${p.stars < GACHA.cost1 ? 'disabled' : ''}>⭐${GACHA.cost1} で 1かい ひく</button>
      <button class="btn pink" data-k="ten" ${p.stars < GACHA.cost10 ? 'disabled' : ''}>⭐${GACHA.cost10} で 10れん！<small>★★いじょう 1たい かくてい</small></button>
    </div>
    <p class="muted small center">⭐ は べんきょう 1ぷんで 1こ もらえるよ</p>
    <details class="card rates"><summary>でる かくりつ</summary>
      <p>★★★ ${GACHA.rates[3]}% ／ ★★ ${GACHA.rates[2]}% ／ ★ ${GACHA.rates[1]}%</p>
      <p>${GACHA.pityMax}かい ひくまでに かならず ★★★ が でるよ。<br>おなじ なかまが でたら、その なかまの けいけんちに なるよ。</p>
      <p>このガチャは べんきょうで ためた ⭐ と 🎫 だけで ひけます（おかねは かかりません）。</p></details>
  </div>`;
  $$('.g-btns .btn', el).forEach(b => b.onclick = () => doPull(b.dataset.k));
};

async function doPull(kind) {
  const res = pullGacha(kind);
  if (!res) return;
  renderTopbar(); renderNav();
  const best = Math.max(...res.results.map(x => x.r));
  const fakeOut = best === 3 && Math.random() < 0.35;
  const handle = $('#handle');
  if (handle) handle.classList.add('turn');
  Sound.drum();
  const ov = document.createElement('div');
  ov.className = 'g-overlay';
  ov.innerHTML = `<div class="g-stage"><div class="capsule drop c${fakeOut ? 2 : best}" id="cap"><div class="cap-top"></div><div class="cap-bot"></div></div>
    <div class="g-tap hidden" id="gtap">タップして あけよう！</div></div>`;
  document.body.appendChild(ov);
  await sleep(1400);
  const cap = $('#cap', ov);
  if (fakeOut) {
    cap.classList.add('shake');
    await sleep(700);
    cap.classList.remove('c2'); cap.classList.add('c3', 'flash');
    Sound.reveal(2); FX.burstAt(cap, 50, true);
    await sleep(500);
  }
  $('#gtap', ov).classList.remove('hidden');
  await new Promise(r => ov.addEventListener('click', r, { once: true }));
  $('#gtap', ov).classList.add('hidden');
  cap.classList.add('open');
  ov.classList.add('flashbg', 'rar' + best);
  Sound.reveal(best);
  await sleep(450);
  FX.confetti(best === 3 ? 220 : best === 2 ? 90 : 30);

  const card = (x, i) => {
    const c = CHAR_BY_ID[x.id];
    return `<div class="g-card r${x.r}" style="animation-delay:${i * 0.12}s">
      ${x.isNew ? '<span class="new">NEW!</span>' : ''}
      ${avatar(x.id, { size: res.results.length > 1 ? 54 : 120 })}
      ${rarityTag(x.r)}<b>${charName(x.id)}</b>${res.results.length === 1 ? elTag(c.el) : ''}
      ${x.isNew ? '' : `<small>かさなった！ EXP+${x.bonus}</small>`}</div>`;
  };
  const single = res.results.length === 1 ? res.results[0] : null;
  ov.querySelector('.g-stage').innerHTML = `<div class="g-results ${single ? 'single' : 'multi'}">${res.results.map(card).join('')}</div>
    <div class="g-actions">
      ${single && single.id !== S.partner ? `<button class="btn ghost" id="gpart">パートナーに する</button>` : ''}
      <button class="btn gold" id="gok">OK</button></div>`;
  await new Promise(r => {
    $('#gok', ov).onclick = r;
    const gp = $('#gpart', ov);
    if (gp) gp.onclick = () => { S.partner = single.id; save(); Sound.coin(); gp.textContent = '✅ パートナーに なった！'; gp.disabled = true; };
  });
  Sound.tap();
  ov.classList.add('out');
  setTimeout(() => ov.remove(), 200);
  await runEvents(res.events);
  if (current.name === 'gacha') render();
}

// ---------- なかま ----------
SCREENS.zukan = el => {
  const owned = Object.keys(S.chars).length;
  const id = S.partner, c = CHAR_BY_ID[id], o = S.chars[id];
  const st = charStage(o.level);
  const nextEvo = st < 2 ? EVOLVE_LV[st] : null;
  const sub = SUBJECT_BY_EL[c.el];
  el.innerHTML = `<h2 class="page-title">📚 なかま <span class="muted">${owned} / ${CHARACTERS.length}</span></h2>
    <div class="card partner-card" style="--el:${ELEMENTS[c.el].color}">
      <div class="pc-tag">パートナー</div>
      <div class="bob">${avatar(id, { size: 110 })}</div>
      <div class="pc-info"><div>${rarityTag(c.r)} ${elTag(c.el)}</div><h3>${charName(id)} <span class="lvl">Lv.${o.level}</span></h3>
        <div class="bar cexp"><i style="width:${o.level >= CHAR_MAX_LV ? '100%' : pct(o.exp, charExpNeed(o.level))}"></i></div>
        <p class="small">⚔️ つよさ ${charPower(id)}　${sub.icon}${sub.name}で よく そだつ</p>
        <p class="small">${nextEvo ? `✨ Lv${nextEvo} で しんか！` : '👑 さいごの すがた！'}</p></div>
    </div>
    <div class="zukan">${CHARACTERS.map(ch => {
      const has = !!S.chars[ch.id];
      return `<button class="z-cell ${has ? '' : 'unknown'} ${ch.id === S.partner ? 'is-partner' : ''}" data-id="${ch.id}" style="--el:${ELEMENTS[ch.el].color}">
        ${has ? avatar(ch.id, { size: 56 }) : `<div class="avatar silhouette" style="--sz:56px"><span class="emo">${ch.forms[0]}</span></div>`}
        <small>${has ? charName(ch.id) : '？？？'}</small>
        <span class="z-meta">${has ? `Lv.${S.chars[ch.id].level}` : ''} <span class="rarity r${ch.r}">${RARITY[ch.r].stars}</span></span></button>`;
    }).join('')}</div>`;
  $$('.z-cell', el).forEach(b => b.onclick = () => { Sound.tap(); charDetail(b.dataset.id); });
};

async function charDetail(id) {
  const c = CHAR_BY_ID[id], o = S.chars[id];
  if (!o) {
    await modal(`<div class="m-av"><div class="avatar silhouette" style="--sz:110px"><span class="emo">${c.forms[0]}</span></div></div>
      <h2>？？？</h2><p>${rarityTag(c.r)} ${elTag(c.el)}</p><p>ガチャで であえるかも…！</p>
      <button class="btn gold wide" data-v="ok">とじる</button>`, { dismiss: true });
    return;
  }
  const st = charStage(o.level);
  const sub = SUBJECT_BY_EL[c.el];
  const evo = c.forms.map((f, i) => i <= st
    ? `<div class="evo-step"><span>${f}</span><small>${c.names[i]}</small></div>`
    : `<div class="evo-step locked"><span class="sil">${f}</span><small>Lv${EVOLVE_LV[i - 1]}で しんか</small></div>`).join('<span class="path">›</span>');
  const isP = id === S.partner;
  const v = await modal(`<div class="m-av bounce">${avatar(id, { size: 120 })}</div>
    <h2>${charName(id)}</h2><p>${rarityTag(c.r)} ${elTag(c.el)}</p>
    <div class="stat-grid"><div><small>レベル</small><b>${o.level}</b></div><div><small>つよさ</small><b>${charPower(id)}</b></div><div><small>であった かず</small><b>${o.count}</b></div></div>
    <div class="bar cexp"><i style="width:${o.level >= CHAR_MAX_LV ? '100%' : pct(o.exp, charExpNeed(o.level))}"></i></div>
    <p class="small">${sub.icon} ${sub.name} を べんきょうすると けいけんち ×1.5</p>
    <div class="evo-line">${evo}</div>
    <div class="m-btns"><button class="btn ghost" data-v="close">とじる</button>
    ${isP ? '<button class="btn" disabled>パートナー</button>' : '<button class="btn gold" data-v="partner">パートナーに する</button>'}</div>`, { dismiss: true });
  if (v === 'partner') {
    S.partner = id; save();
    Sound.coin();
    render();
  }
}

// ---------- きろく ----------
SCREENS.records = (el, params) => {
  const off = params.m || 0;
  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth() + off, 1);
  const byDate = {};
  for (const s of S.sessions) byDate[s.date] = (byDate[s.date] || 0) + s.minutes;
  const totalMin = S.sessions.reduce((a, s) => a + s.minutes, 0);
  const days = Object.keys(byDate).length;

  // カレンダー
  const y = base.getFullYear(), m = base.getMonth();
  const firstDow = new Date(y, m, 1).getDay();
  const nDays = new Date(y, m + 1, 0).getDate();
  const t = today();
  let cal = ['にち', 'げつ', 'か', 'すい', 'もく', 'きん', 'ど'].map(d => `<div class="cal-h">${d}</div>`).join('');
  for (let i = 0; i < firstDow; i++) cal += '<div></div>';
  let monthMin = 0;
  for (let d = 1; d <= nDays; d++) {
    const k = dateKey(new Date(y, m, d));
    const mins = byDate[k] || 0;
    monthMin += mins;
    const stamp = mins >= 30 ? '💮' : mins > 0 ? '⭐' : '';
    cal += `<div class="cal-d ${k === t ? 'today' : ''} ${mins ? 'has' : ''}"><span>${d}</span>${stamp ? `<i>${stamp}</i>` : ''}${mins ? `<small>${mins}</small>` : ''}</div>`;
  }

  // 1しゅうかん
  const week = [];
  for (let i = 6; i >= 0; i--) {
    const k = dayOffset(t, -i);
    const ss = S.sessions.filter(s => s.date === k);
    week.push({ k, total: ss.reduce((a, s) => a + s.minutes, 0),
      parts: SUBJECTS.map(sub => ({ sub, min: ss.filter(s => s.subject === sub.id).reduce((a, s) => a + s.minutes, 0) })).filter(x => x.min) });
  }
  const wMax = Math.max(30, ...week.map(w => w.total));
  const dows = ['にち', 'げつ', 'か', 'すい', 'もく', 'きん', 'ど'];
  const weekHtml = week.map(w => {
    const [yy, mm, dd] = w.k.split('-').map(Number);
    return `<div class="wk-col"><small class="wk-v">${w.total || ''}</small><div class="wk-bar">${w.parts.map(p =>
      `<i style="height:${(p.min / wMax) * 100}%;background:${p.sub.color}"></i>`).join('')}</div>
      <small>${dows[new Date(yy, mm - 1, dd).getDay()]}</small></div>`;
  }).join('');

  const subTotals = SUBJECTS.map(sub => ({ sub, min: S.sessions.filter(s => s.subject === sub.id).reduce((a, s) => a + s.minutes, 0) }));
  const sMax = Math.max(1, ...subTotals.map(x => x.min));
  const recent = S.sessions.slice(-10).reverse();

  el.innerHTML = `<h2 class="page-title">📅 きろく</h2>
    <div class="stat-grid big">
      <div><small>ごうけい</small><b>${fmtMin(totalMin)}</b></div>
      <div><small>べんきょうした日</small><b>${days}にち</b></div>
      <div><small>れんぞく</small><b>🔥${currentStreak()}にち</b></div>
    </div>
    <div class="card"><div class="cal-nav"><button class="icon-btn" id="prevm">◀</button>
      <h3>${y}ねん ${m + 1}がつ <span class="muted small">${fmtMin(monthMin)}</span></h3>
      <button class="icon-btn" id="nextm" ${off >= 0 ? 'disabled' : ''}>▶</button></div>
      <div class="cal">${cal}</div><p class="small muted">⭐ べんきょうした日　💮 30ぷん いじょう</p></div>
    <div class="card"><h3>この 1しゅうかん</h3><div class="week">${weekHtml}</div></div>
    <div class="card"><h3>かもくべつ</h3>${subTotals.map(x => `<div class="sub-row"><span class="sr-name">${x.sub.icon} ${x.sub.name}</span>
      <div class="sr-bar"><i style="width:${(x.min / sMax) * 100}%;background:${x.sub.color}"></i></div><span class="sr-v">${fmtMin(x.min)}</span></div>`).join('')}</div>
    <div class="card"><h3>さいきんの きろく</h3>${recent.length ? recent.map(s => {
      const d = new Date(s.at);
      return `<div class="recent"><span class="muted">${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}</span>
        ${subjChip(s.subject)}<b>${fmtMin(s.minutes)}</b>${s.goalMet ? '🎯' : ''}</div>`;
    }).join('') : '<p class="muted">まだ きろくが ないよ</p>'}</div>`;
  $('#prevm').onclick = () => { Sound.tap(); go('records', { m: off - 1 }); };
  $('#nextm').onclick = () => { Sound.tap(); go('records', { m: off + 1 }); };
};

// ---------- せってい ----------
function openSettings() {
  const m = openModal(`<h2>⚙️ せってい</h2>
    <label class="lbl">なまえ</label><input id="setname" class="input" maxlength="10" value="${esc(S.player.name)}">
    <label class="row-check"><input type="checkbox" id="setsound" ${S.settings.sound ? 'checked' : ''}> こうかおん を ならす</label>
    <div class="parent">
      <h3>おうちの かたへ</h3>
      <p class="small">データは このブラウザの中だけに ほぞんされます。お金は かかりません。ガチャは べんきょう時間で ためた ⭐ と 🎫 だけで ひけます。1回の きろくは さいだい ${MAX_SESSION_MIN}分 です。</p>
      <div class="m-btns"><button class="btn ghost mini" id="export">データを ダウンロード</button><button class="btn ghost mini" id="import">データを よみこむ</button></div>
      <input type="file" id="importfile" accept="application/json" hidden>
      <button class="link danger" id="reset">さいしょから やりなおす</button>
    </div>
    <button class="btn gold wide" id="setclose">とじる</button>`, { dismiss: false });
  const el = m.el;
  $('#setclose', el).onclick = () => {
    const name = $('#setname', el).value.trim();
    if (name) S.player.name = name;
    S.settings.sound = $('#setsound', el).checked;
    save(); Sound.tap(); m.close(); render();
  };
  $('#export', el).onclick = () => {
    const blob = new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `manabi-quest-${today()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  $('#import', el).onclick = () => $('#importfile', el).click();
  $('#importfile', el).onchange = async e => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      if (!d.player || !d.chars) throw new Error('bad');
      if (!confirm('いまの データを うわがきして よみこみますか？')) return;
      S = { ...defaultState(), ...d, settings: { ...defaultState().settings, ...(d.settings || {}) } };
      save(); m.close(); go(S.player ? 'home' : 'onboard');
    } catch (err) { alert('よみこめませんでした。ファイルを かくにんしてください。'); }
  };
  $('#reset', el).onclick = () => {
    const ans = prompt('すべての データが きえます。やりなおす ときは「リセット」と にゅうりょく してください。');
    if (ans === 'リセット') { localStorage.removeItem(SAVE_KEY); S = defaultState(); m.close(); go('onboard'); }
  };
}

// ---------- スタート ----------
document.addEventListener('pointerdown', () => Sound.unlock(), { once: true });
if (!S.player) go('onboard');
else if (S.active) go('timer');
else go('home');
