'use strict';
// ===== 画面 =====

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pct = (a, b) => Math.max(0, Math.min(100, (a / b) * 100)) + '%';
const APP_TITLE = '学びクエスト';

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

// ---------- 部品 ----------
function icon(name, cls = '') {
  return `<svg class="gi ${cls}" viewBox="0 0 512 512" aria-hidden="true"><path d="${ICONS[name] || ''}"/></svg>`;
}
function avatar(id, { size = 72, lv } = {}) {
  const c = CHAR_BY_ID[id];
  const level = lv ?? charLevel(id);
  const st = charStage(level);
  return `<div class="avatar st${st} r${c.r}" style="--el:${ELEMENTS[c.el].color};--sz:${size}px">
    ${icon(charIcon(id, level))}${st >= 2 ? '<span class="crown">♛</span>' : ''}</div>`;
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
      <span class="pill" title="スター">⭐<b>${p.stars}</b></span>
      <span class="pill" title="ガチャチケット">🎫<b>${p.tickets}</b></span>
      <span class="pill fire" title="連続日数">🔥<b>${currentStreak()}</b></span>
    </div>
    <button class="icon-btn" id="gear" aria-label="設定">${icon('cog')}</button>
  </div>`;
  $('#gear').onclick = () => { Sound.tap(); openSettings(); };
  $('#tb-me').onclick = () => { Sound.tap(); go('zukan'); };
}

function renderNav() {
  const nav = $('#nav');
  if (!S.player || document.body.classList.contains('fullmode')) { nav.innerHTML = ''; return; }
  const items = [
    ['home', 'castle', 'ホーム', claimableCount()],
    ['adventure', 'treasure-map', '冒険', 0],
    ['gacha', 'open-treasure-chest', 'ガチャ', S.player.tickets > 0 || S.player.stars >= GACHA.cost1 ? '!' : 0],
    ['zukan', 'battle-gear', '仲間', 0],
    ['records', 'scroll-unfurled', '記録', 0],
  ];
  nav.innerHTML = items.map(([id, ic, label, badge]) =>
    `<button class="nav-btn ${current.name === id ? 'on' : ''}" data-go="${id}">
      <span class="nav-ic">${icon(ic)}</span><span>${label}</span>${badge ? `<i class="badge">${badge}</i>` : ''}</button>`).join('');
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
      await modal(`<div class="m-emo fire">${icon('flame')}</div>
        <h2>${ev.streak >= 2 ? `連続${ev.streak}日目！` : '今日も勉強おつかれさま！'}</h2>
        <p>${ev.streak >= 2 ? '毎日続けていてえらい！' : '毎日続けるとボーナスが増えていくぞ'}</p>
        <div class="rw-big">⭐+${ev.stars}${ev.tickets ? ` 🎫+${ev.tickets}` : ''}</div>
        <button class="btn gold wide" data-v="ok">受け取る</button>`);
    } else if (ev.type === 'target') {
      Sound.levelup(); FX.confetti(140);
      await modal(`<div class="m-emo gold">${icon('laurel-crown')}</div>
        <h2>今日の目標時間を達成！</h2>
        <p>おうちの人と決めた<b>${fmtMin(ev.target)}</b>をクリアした！</p>
        <div class="rw-big">⭐+${ev.stars}</div>
        <button class="btn gold wide" data-v="ok">やったー！</button>`, { cls: 'shine' });
    } else if (ev.type === 'levelup') {
      Sound.levelup(); FX.confetti(140);
      await modal(`<div class="lvup">LEVEL UP!</div>
        <div class="lv-big">Lv.${ev.from} → <b>Lv.${ev.to}</b></div>
        ${ev.newTitle ? `<div class="new-title">称号<br>「${ev.newTitle}」を獲得！</div>` : ''}
        <div class="rw-big">⭐+${ev.stars}${ev.tickets ? ` 🎫+${ev.tickets}` : ''}</div>
        <button class="btn gold wide" data-v="ok">やったー！</button>`, { cls: 'shine' });
    } else if (ev.type === 'charlv') {
      const evolving = charStage(ev.to) > charStage(ev.from);
      const showLv = evolving ? ev.from : ev.to;
      Sound.levelup();
      await modal(`<div class="m-av bounce">${avatar(ev.id, { size: 110, lv: showLv })}</div>
        <h2>${charName(ev.id, showLv)}がレベルアップ！</h2>
        <div class="lv-big">Lv.${ev.from} → <b>Lv.${ev.to}</b></div>
        <p>強さが上がった！ ⚔️ ${charPower(ev.id)}</p>
        <button class="btn gold wide" data-v="ok">OK</button>`);
    } else if (ev.type === 'evolve') {
      const m = openModal(`<p class="evo-msg" id="evo-msg">おや…？ ${charName(ev.id, ev.fromLv)}の様子が…！</p>
        <div class="evo-box"><div id="evo-av" class="evo-flash">${avatar(ev.id, { size: 130, lv: ev.fromLv })}</div></div>
        <button class="btn gold wide hidden" data-v="ok" id="evo-ok">すごい！</button>`, { cls: 'evo' });
      Sound.evolve();
      await sleep(1900);
      $('#evo-av', m.el).className = 'pop';
      $('#evo-av', m.el).innerHTML = avatar(ev.id, { size: 150, lv: ev.toLv });
      $('#evo-msg', m.el).innerHTML = `<b>${charName(ev.id, ev.toLv)}</b>に進化した！`;
      $('#evo-ok', m.el).classList.remove('hidden');
      FX.confetti(160); FX.burstAt($('#evo-av', m.el), 60, true);
      await m.done;
    } else if (ev.type === 'clear') {
      Sound.win(); FX.confetti(100);
      const nw = ev.newWorld;
      await modal(`<div class="m-emo gold">${icon('trophy')}</div><h2>ステージクリア！</h2>
        <div class="defeated">${ev.clears.map(i => { const s = stageInfo(i); return `<span>${icon(s.enemy.e)}<small>${s.enemy.n}</small></span>`; }).join('')}</div>
        <p>を倒した！</p>
        <div class="rw-big">⭐+${ev.stars}${ev.tickets ? ` 🎫+${ev.tickets}` : ''}</div>
        ${nw ? `<div class="new-world" style="--b1:${nw.region.bg[0]};--b2:${nw.region.bg[1]}">✈️ 新しい地域へ出発！<br>
          <b>${nw.region.flag} ${nw.region.name}</b>${nw.loop ? `<br><small>伝説モード ループ${nw.loop + 1}</small>` : ''}</div>` : ''}
        <button class="btn gold wide" data-v="ok">次の街へ ✈️</button>`, { cls: 'shine' });
      Sound.levelup();
      await cityModal(ev.arrive, { arrive: true });
    }
  }
  renderTopbar(); renderNav();
}

// ---------- 初回 ----------
SCREENS.onboard = (el, params) => {
  if (!params.step || params.step === 1) {
    el.innerHTML = `<div class="onboard">
      <div class="logo"><span class="logo-emo">${icon('winged-sword')}</span><h1>学び<br>クエスト</h1></div>
      <p class="lead">勉強した時間で仲間を育て、<br>ボスを倒して世界を救え！</p>
      <div class="card"><label class="lbl">プレイヤー名</label>
      <input id="name" class="input" maxlength="10" placeholder="名前を入力" autocomplete="off"></div>
      <button class="btn big gold" id="next">次へ ▶</button>
      ${cloudOn() && !S.cloud ? '<button class="link small" id="restore">おうちの人と連携して、前の記録を引き継ぐ</button>' : ''}</div>`;
    if ($('#restore')) $('#restore').onclick = () => { Sound.tap(); openLinkModal(); };
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
    <h2 class="center">${esc(params.name)}さん、<br>最初の仲間を選ぼう！</h2>
    <div class="starters">${STARTERS.map(id => {
      const c = CHAR_BY_ID[id], sub = SUBJECT_BY_EL[c.el];
      return `<button class="starter" data-id="${id}" style="--c:${ELEMENTS[c.el].color}">
        ${avatar(id, { size: 84, lv: 1 })}<b>${c.names[0]}</b>${elTag(c.el)}
        <small>${sub.icon}${sub.name}で<br>よく育つ</small></button>`;
    }).join('')}</div></div>`;
  $$('.starter', el).forEach(b => b.onclick = async () => {
    const id = b.dataset.id;
    Sound.unlock();
    startGame(params.name, id);
    Sound.levelup(); FX.confetti(150);
    await modal(`<div class="m-av bounce">${avatar(id, { size: 120 })}</div>
      <h2>${charName(id)}が仲間になった！</h2>
      <p>冒険開始ボーナス</p><div class="rw-big">🎫 ガチャチケット ×1</div>
      <button class="btn gold wide" data-v="ok">冒険に出発！</button>`, { cls: 'shine' });
    go('home');
  });
};

// ---------- ホーム ----------
function sceneHtml(st) {
  const left = st.hp - (st.i === S.stage.i ? S.stage.dmg : 0);
  const ws = SUBJECT_BY_EL[st.enemy.weak];
  return `<div class="scene" style="--b1:${st.world.bg[0]};--b2:${st.world.bg[1]}">
    <div class="scene-head"><div class="place"><small>${st.region.flag} ${st.region.name} ${st.sub + 1}/6${st.loop ? ` <span class="loop">ループ${st.loop + 1}</span>` : ''}</small>
      <b>${st.city.name}</b></div><button class="trivia-btn" id="trivia">💡 豆知識</button></div>
    <div class="ground"></div>
    <div class="ally bob">${avatar(S.partner, { size: 86 })}</div>
    <div class="vs">VS</div>
    <div class="foe ${st.boss ? 'boss' : ''}" id="foe">
      <div class="foe-name">${st.boss ? '👑 ' : ''}${st.enemy.n}</div>
      <div class="foe-emo" id="foe-emo">${icon(st.enemy.e)}</div>
      <div class="hp"><i id="foe-hp" style="width:${pct(left, st.hp)}"></i><span id="foe-hptext">${left} / ${st.hp}</span></div>
    </div>
    <div class="weak">弱点：<b style="color:${ws.color}">${ws.icon} ${ws.name}</b></div>
  </div>`;
}

// 保護者ページで決めた「今日の目標時間」と「おすすめ教科」
function promiseHtml(t) {
  const target = targetFor(today());
  const prio = S.parent.priority;
  if (!target && !prio.length) return '';
  const left = Math.max(0, target - t.minutes);
  return `<div class="card promise"><h3>🏠 おうちの人との約束</h3>
    ${target ? `<div class="pr-row"><span>今日の目標 <b>${fmtMin(target)}</b></span>
      <span class="${left ? '' : 'ok'}">${left ? `あと${fmtMin(left)}` : '✅ 達成！'}</span></div>
      <div class="bar promise-bar"><i style="width:${pct(t.minutes, target)}"></i></div>
      ${left ? `<p class="small muted">達成すると ⭐+${TARGET_BONUS.stars}</p>` : ''}` : ''}
    ${prio.length ? `<div class="pr-subs"><span class="small">おすすめ教科（⭐×${PRIORITY_STAR_RATE}）</span>
      ${prio.map(id => `<button class="chip pr-chip" data-s="${id}" style="background:${SUBJECT_BY_ID[id].color}">${SUBJECT_BY_ID[id].icon} ${SUBJECT_BY_ID[id].name}
        <small>${fmtMin(t.bySubject.find(x => x.sub.id === id).min)}</small></button>`).join('')}</div>` : ''}
  </div>`;
}

function missionsHtml() {
  return missionList().map(m => {
    const rw = m.reward.tickets ? `🎫×${m.reward.tickets}` : `⭐×${m.reward.stars}`;
    const action = m.claimed ? '<span class="claimed">✅</span>'
      : m.done ? `<button class="btn mini gold wiggle" data-claim="${m.id}">受け取る</button>`
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
    <button class="btn big gold pulse" id="start">${icon('crossed-swords', 'btn-ic')} 勉強スタート</button>
    ${showGachaHint ? `<button class="card hint-card" id="ghint">🎫 ガチャチケットを持っています！<br><b>ガチャで新しい仲間をゲットしよう ▶</b></button>` : ''}
    <div class="card">
      <h3>🕒 今日の勉強 <span class="today-min">${fmtMin(t.minutes)}</span></h3>
      <div class="today-bar">${t.minutes ? t.bySubject.filter(x => x.min).map(x =>
        `<i style="flex:${x.min};background:${x.sub.color}" title="${x.sub.name}">${x.sub.icon}</i>`).join('') : '<span class="muted">まだ記録がありません。さっそく始めよう！</span>'}</div>
    </div>
    ${promiseHtml(t)}
    <div class="card"><h3>🎯 今日のミッション</h3><div id="missions">${missionsHtml()}</div></div>`;
  $('#start').onclick = () => { Sound.tap(); go('setup'); };
  $$('.pr-chip', el).forEach(b => b.onclick = () => { Sound.tap(); go('setup', { subject: b.dataset.s }); });
  $('#trivia').onclick = () => { Sound.tap(); cityModal(st.i); };
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

// ---------- 準備 ----------
SCREENS.setup = (el, params) => {
  let subj = params.subject || S.settings.lastSubject || SUBJECTS[0].id;
  let goal = S.settings.lastGoal || 15;
  const st = currentStage();
  const pel = CHAR_BY_ID[S.partner].el;
  const draw = () => {
    const { dmg, weak } = damagePerMin(subj, st);
    el.innerHTML = `<div class="setup">
      <button class="link back" id="back">← 戻る</button>
      <h2>何を勉強する？</h2>
      <p class="muted small">${st.region.flag} ${st.city.name}の守護者「${st.enemy.n}」は <b style="color:${SUBJECT_BY_ID[st.city.subject].color}">${SUBJECT_BY_ID[st.city.subject].name}</b> が弱点</p>
      <div class="subj-grid">${SUBJECTS.map(s => `<button class="subj ${s.id === subj ? 'sel' : ''}" data-s="${s.id}" style="--c:${s.color}">
        <span class="si">${s.icon}</span><span class="sn">${s.name}</span>
        ${isPriority(s.id) ? `<em class="tag prio">おすすめ ⭐×${PRIORITY_STAR_RATE}</em>` : ''}
        ${s.el === st.enemy.weak ? '<em class="tag hot">この街の弱点 ×2</em>' : ''}
        ${s.el === pel ? '<em class="tag">仲間が育つ</em>' : ''}</button>`).join('')}</div>
      <p class="muted small">「その他」は宿題・読書・プリント・ドリルなど</p>
      <h2>何分がんばる？</h2>
      <div class="goal-row">${GOAL_OPTIONS.map(g => `<button class="goal ${g === goal ? 'sel' : ''}" data-g="${g}">${g}<small>分</small></button>`).join('')}</div>
      <div class="card preview">
        <div>目標を達成すると獲得できる報酬</div>
        <div class="pv-row"><span>⭐ <b>${starsFor(goal, true, subj)}</b></span><span>🧠 <b>${Math.round(goal * 12)}</b></span><span>⚔️ <b>${dmg * goal}</b>${weak ? '<em class="tag hot">×2</em>' : ''}</span></div>
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
  try { if ('wakeLock' in navigator && !wakeLock) wakeLock = await navigator.wakeLock.request('screen'); } catch (e) { /* 非対応 */ }
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
    <div class="t-head">${subjChip(a.subject)}<span class="t-goal">🎯 目標 ${fmtMin(a.goal)}</span></div>
    <div class="ring-wrap" id="ringwrap">
      <svg viewBox="0 0 220 220" class="ring"><circle cx="110" cy="110" r="96" class="ring-bg"/>
        <circle cx="110" cy="110" r="96" class="ring-fg" id="ringfg" stroke-dasharray="${RING_LEN}" stroke-dashoffset="${RING_LEN}"/></svg>
      <div class="ring-text"><div id="ttime" class="ttime">00:00</div><div id="tsub" class="t-subtext"></div></div>
    </div>
    <div class="t-buddy"><div class="bubble" id="bubble">一緒にがんばろう！</div><div class="bob">${avatar(S.partner, { size: 92 })}</div></div>
    <div class="t-live">
      <div class="live"><span>⭐</span><b id="lstars">0</b></div>
      <div class="live"><span>🧠</span><b id="lxp">0</b></div>
      <div class="live"><span>⚔️</span><b id="ldmg">0</b></div>
    </div>
    <div class="t-btns"><button class="btn ghost" id="pause"></button><button class="btn gold" id="fin">🏁 終わる</button></div>
    <button class="link small" id="cancel">やめる（記録しない）</button>
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
    $('#tsub').textContent = paused ? '☕ 休憩中' : met ? '🎉 達成！ボーナスタイム' : `残り ${mmss(goalSec - sec)}`;
    ring.setAttribute('stroke-dashoffset', RING_LEN * (1 - Math.min(1, sec / goalSec)));
    $('#ringwrap').classList.toggle('met', met);
    $('#ringwrap').classList.toggle('paused', paused);
    $('#pause').textContent = paused ? '▶ 再開' : '⏸ 休憩';
    document.title = `${mmss(sec)} ${sub.name} | ${APP_TITLE}`;

    if (min !== lastMin) {
      const first = lastMin === -1;
      lastMin = min;
      $('#lstars').textContent = starsFor(min, met, a.subject);
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
      modal(`<div class="m-emo gold">${icon('laurel-crown')}</div><h2>目標達成！</h2>
        <p>${fmtMin(a.goal)}やり切った！<br>続けるとさらに⭐が増えるぞ</p>
        <div class="m-btns"><button class="btn ghost" data-v="fin">終わる</button><button class="btn gold" data-v="cont">続ける！</button></div>`)
        .then(v => { busy = false; if (v === 'fin') finishFlow(true); });
    } else if (min >= MAX_SESSION_MIN && !paused) {
      togglePause();
      busy = true;
      modal(`<div class="m-emo gold">${icon('trophy')}</div><h2>${MAX_SESSION_MIN}分も集中した！</h2><p>すごい集中力！ 少し体を休めよう。</p>
        <button class="btn gold wide" data-v="ok">終わりにする</button>`).then(() => { busy = false; finishFlow(true); });
    }
  };
  $('#pause').onclick = () => { Sound.tap(); togglePause(); update(); };
  $('#fin').onclick = () => { Sound.tap(); finishFlow(false); };
  $('#cancel').onclick = async () => {
    Sound.tap();
    const v = await modal(`<div class="m-emo">${icon('cancel')}</div><h2>本当にやめる？</h2><p>今回の記録は残りません</p>
      <div class="m-btns"><button class="btn ghost" data-v="quit">やめる</button><button class="btn gold" data-v="cont">続ける</button></div>`);
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
    const v = await modal(`<div class="m-emo">${icon('hourglass')}</div><h2>まだ1分たっていません</h2><p>1分以上勉強すると記録できます</p>
      <div class="m-btns"><button class="btn ghost" data-v="quit">やめる</button><button class="btn gold" data-v="cont">続ける</button></div>`);
    if (v === 'quit') { cancelActive(); go('home'); }
    return;
  }
  if (!skipConfirm) {
    const met = sec >= a.goal * 60;
    const v = await modal(`<div class="m-emo">${icon('checkered-flag')}</div><h2>${fmtMin(min)}がんばった！</h2>
      <p>${met ? '終わりにする？' : `目標まであと ${mmss(a.goal * 60 - sec)}！<br>達成するとボーナスがもらえるぞ`}</p>
      <div class="m-btns"><button class="btn ghost" data-v="cont">まだ続ける</button><button class="btn gold" data-v="fin">終わる</button></div>`);
    if (v !== 'fin' || !S.active) return;
  }
  const res = finishSession(a.subject, min, a.goal, activeElapsedSecAt(a) >= a.goal * 60);
  go('result', res);
}
function activeElapsedSecAt(a) {
  const now = a.pausedAt || Date.now();
  return Math.floor((now - a.startedAt - a.pausedTotal) / 1000);
}

// ---------- 結果 ----------
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
    <div class="res-title">ナイスファイト！</div>
    <div class="res-sub">${subjChip(r.subject)}を <b class="big-num" id="rmin">0</b> 分がんばった！</div>
    ${r.goalMet ? '<div class="goal-badge">🎯 目標達成ボーナス！</div>' : ''}
    <div class="card rewards">
      <div class="rw-row" id="row1"><span class="rw-ic">⭐</span><span class="rw-l">スター${r.prio ? ` <em class="tag prio">おすすめ ×${PRIORITY_STAR_RATE}</em>` : ''}</span><b>+<span id="rstars">0</span></b></div>
      <div class="rw-row" id="row2"><span class="rw-ic">🧠</span><span class="rw-l">経験値 <span class="lvl" id="plv">Lv.${r.xpBefore.level}</span></span><b>+<span id="rxp">0</span></b>
        <div class="bar xp"><i id="pbar"></i></div></div>
      <div class="rw-row" id="row3"><span class="rw-ic" style="color:${ELEMENTS[CHAR_BY_ID[r.partner].el].color}">${icon(charIcon(r.partner, r.charBefore.level))}</span><span class="rw-l">${charName(r.partner, r.charBefore.level)} <span class="lvl" id="clv">Lv.${r.charBefore.level}</span>
        ${r.match ? '<em class="tag">得意 ×1.5</em>' : ''}</span><b>+<span id="rcexp">0</span></b>
        <div class="bar cexp"><i id="cbar"></i></div></div>
    </div>
    <div class="card battle" id="battle" style="--b1:${st.world.bg[0]};--b2:${st.world.bg[1]}">
      <div class="bt-title">⚔️ ボスに攻撃！</div>
      <div class="arena">
        <div class="ally" id="ally">${avatar(r.partner, { size: 70, lv: r.charBefore.level })}</div>
        <div class="foe ${st.boss ? 'boss' : ''}" id="rfoe"><div class="foe-name">${st.enemy.n}</div><div class="foe-emo" id="rfoe-emo">${icon(st.enemy.e)}</div>
          <div class="hp"><i id="rhp" style="width:${pct(hp0, st.hp)}"></i><span id="rhptext">${hp0} / ${st.hp}</span></div></div>
      </div>
      <div class="bt-msg" id="btmsg">&nbsp;</div>
    </div>
    <button class="btn big gold" id="next" disabled>次へ ▶</button></div>`;

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
  const critMsg = b.firstWeak ? '<span class="crit-msg">効果は抜群だ！</span><br>' : '';
  if (critMsg) $('#btmsg').innerHTML = critMsg;
  await sleep(500);
  if (cleared) {
    foe.classList.add('defeated');
    $('#rfoe').insertAdjacentHTML('beforeend', '<div class="stamp">撃破！</div>');
    Sound.win(); FX.confetti(120);
    $('#btmsg').innerHTML = critMsg + `${st.enemy.n}を倒した！${b.clears.length > 1 ? `<br>さらに${b.clears.length - 1}体倒したぞ！` : ''}`;
  } else {
    $('#btmsg').innerHTML = critMsg + `${b.total}のダメージ！ あと<b>${st.hp - b.endDmg}</b>で倒せる！`;
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

// ---------- 冒険（世界一周マップ） ----------
function cityState(i) { return i < S.stage.i ? 'cleared' : i === S.stage.i ? 'now' : 'locked'; }

function mapSvg(region, base) {
  const m = MAPS[region.id];
  const cities = CITIES.filter(c => c.region === region.id);
  const idx = c => base + CITIES.indexOf(c);
  let route = '';
  for (let k = 0; k < cities.length - 1; k++) {
    const [x1, y1] = m.pts[cities[k].id], [x2, y2] = m.pts[cities[k + 1].id];
    route += `<line class="route ${idx(cities[k + 1]) <= S.stage.i ? 'done' : ''}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
  }
  const dots = cities.map(c => {
    const [x, y] = m.pts[c.id];
    const i = idx(c), stt = cityState(i);
    const [dx, dy, anchor] = c.lab;
    return `<g class="city ${stt}" data-i="${i}">
      <circle cx="${x}" cy="${y}" r="13" fill="transparent"/>
      ${stt === 'now' ? `<circle class="ring2" cx="${x}" cy="${y}" r="6"/>` : ''}
      <circle class="dot" cx="${x}" cy="${y}" r="${c.boss ? 6 : 4.5}"/>
      <text x="${x + dx}" y="${y + dy}" text-anchor="${anchor}" font-size="11">${c.name}</text></g>`;
  }).join('');
  return `<svg viewBox="0 0 ${m.w} ${m.h}" role="img" aria-label="${region.name}の地図">
    <path class="map-grid" d="${m.grid}"/>
    ${m.land.map(l => `<path class="land ${l.main ? 'main' : ''}" d="${l.d}"/>`).join('')}
    ${m.borders ? `<path class="borders" d="${m.borders}"/>` : ''}${m.frames ? `<path class="frames" d="${m.frames}"/>` : ''}
    ${route}${dots}</svg>`;
}

SCREENS.adventure = (el, params) => {
  const cur = S.stage.i;
  const now = stageInfo(cur);
  const base = now.loop * STAGES_PER_LOOP;
  const maxR = now.loop ? REGIONS.length - 1 : now.regionIdx;
  const ri = Math.min(params.r ?? now.regionIdx, maxR);
  const region = REGIONS[ri];
  const cities = CITIES.filter(c => c.region === region.id);
  const cleared = cities.filter(c => base + CITIES.indexOf(c) < cur).length;
  el.innerHTML = `<h2 class="page-title">世界一周の旅 ${now.loop ? `<span class="loop">伝説ループ${now.loop + 1}</span>` : ''}</h2>
    <div class="region-tabs">${REGIONS.map((r, k) => `<button data-r="${k}" class="${k === ri ? 'on' : ''}" ${k > maxR ? 'disabled' : ''}>
      ${k > maxR ? '🔒' : r.flag} ${r.short || r.name}</button>`).join('')}</div>
    <div class="map-card"><div class="map-title">${region.flag} ${region.name}<small>${cleared} / ${cities.length} 都市クリア</small></div>
      ${mapSvg(region, base)}</div>
    <p class="muted small">街をタップすると、守護者と豆知識が見られます。各地域の6都市で、6教科すべてが弱点として登場します。</p>
    <div class="city-list">${cities.map(c => {
      const i = base + CITIES.indexOf(c), stt = cityState(i), sub = SUBJECT_BY_ID[c.subject];
      const st = stageInfo(i);
      return `<button class="city-row ${stt} ${c.boss ? 'boss' : ''}" data-i="${i}">
        <span class="cr-ic">${icon(c.e)}</span>
        <span class="cr-main"><b>${c.name}</b><small>${c.country}</small></span>
        ${subjChip(c.subject)}
        <span class="cr-state">${stt === 'cleared' ? '✔ 撃破' : stt === 'now' ? `HP ${st.hp - S.stage.dmg}` : '🔒'}</span></button>`;
    }).join('')}</div>
    <button class="btn big gold" id="adv-go">${icon('crossed-swords', 'btn-ic')} ${now.city.name}で勉強する</button>`;
  $$('.region-tabs button', el).forEach(b => b.onclick = () => { Sound.tap(); go('adventure', { r: +b.dataset.r }); });
  $$('[data-i]', el).forEach(b => b.onclick = () => { Sound.tap(); cityModal(+b.dataset.i); });
  $('#adv-go').onclick = () => { Sound.tap(); go('setup', { subject: now.city.subject }); };
};

// 街の詳細（守護者・弱点教科・豆知識）
async function cityModal(i, { arrive = false } = {}) {
  const st = stageInfo(i), c = st.city, stt = cityState(i);
  const sub = SUBJECT_BY_ID[c.subject];
  const left = stt === 'now' ? st.hp - S.stage.dmg : stt === 'cleared' ? 0 : st.hp;
  const open = stt !== 'locked';
  const v = await modal(`${arrive ? '<div class="arrive">NEW CITY ARRIVAL</div>' : ''}
    <div class="city-head"><div class="flag">${st.region.flag}</div><div><h2>${c.name}</h2><small>${c.country}</small></div></div>
    <div class="city-subj"><div>この街の弱点教科<div class="why">${c.why}</div></div>${subjChip(c.subject)}</div>
    <div class="guardian">${icon(c.e)}<div style="flex:1"><b>守護者：${c.n}</b>${c.boss ? ' <span class="tag hot">BOSS</span>' : ''}
      <div class="hp"><i style="width:${pct(left, st.hp)}"></i><span>${left} / ${st.hp}</span></div></div></div>
    ${open ? `<ul class="trivia">${c.facts.map(f => `<li>${f}</li>`).join('')}</ul>`
      : '<p class="muted small" style="margin-top:12px">🔒 この街に到着すると豆知識が読めるようになります</p>'}
    <div class="m-btns">${stt === 'now'
      ? `<button class="btn ghost" data-v="close">閉じる</button><button class="btn gold" data-v="study">${sub.name}で攻撃</button>`
      : '<button class="btn gold" data-v="close">閉じる</button>'}</div>`, { dismiss: true, cls: arrive ? 'shine' : '' });
  if (v === 'study') go('setup', { subject: c.subject });
}

// ---------- ガチャ ----------
SCREENS.gacha = el => {
  const p = S.player;
  const left = GACHA.pityMax - S.gacha.pity;
  const caps = Array.from({ length: 14 }, (_, i) => {
    const colors = ['#ff6b9a', '#4fc3f7', '#ffd54f', '#81c784', '#ba68c8', '#ff8a65'];
    return `<i style="left:${8 + (i * 37) % 78}%;top:${18 + ((i * 53) % 60)}%;background:${colors[i % colors.length]}"></i>`;
  }).join('');
  el.innerHTML = `<div class="gacha">
    <h2 class="g-title">召喚ゲート</h2>
    <div class="machine" id="machine"><div class="dome">${caps}</div><div class="mbody"><div class="slot"></div><div class="handle" id="handle"></div></div></div>
    <div class="pity">★★★確定まで あと<b>${left}</b>回</div>
    <div class="g-btns">
      <button class="btn gold" data-k="ticket" ${p.tickets < 1 ? 'disabled' : ''}>🎫 チケットで引く <small>残り${p.tickets}枚</small></button>
      <button class="btn" data-k="one" ${p.stars < GACHA.cost1 ? 'disabled' : ''}>⭐${GACHA.cost1}で1回引く</button>
      <button class="btn pink" data-k="ten" ${p.stars < GACHA.cost10 ? 'disabled' : ''}>⭐${GACHA.cost10}で10連！<small>★★以上1体確定</small></button>
    </div>
    <p class="muted small center">⭐は勉強1分につき1個もらえる</p>
    <details class="card rates"><summary>排出確率</summary>
      <p>★★★ ${GACHA.rates[3]}% ／ ★★ ${GACHA.rates[2]}% ／ ★ ${GACHA.rates[1]}%</p>
      <p>${GACHA.pityMax}回引くまでに必ず★★★が出ます。<br>同じ仲間が出た場合は、その仲間の経験値になります。</p>
      <p>このガチャは勉強でためた⭐と🎫だけで引けます（お金は一切かかりません）。</p></details>
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
    <div class="g-tap hidden" id="gtap">タップして開けよう！</div></div>`;
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
      ${x.isNew ? '' : `<small>ダブり！ EXP+${x.bonus}</small>`}</div>`;
  };
  const single = res.results.length === 1 ? res.results[0] : null;
  ov.querySelector('.g-stage').innerHTML = `<div class="g-results ${single ? 'single' : 'multi'}">${res.results.map(card).join('')}</div>
    <div class="g-actions">
      ${single && single.id !== S.partner ? `<button class="btn ghost" id="gpart">パートナーにする</button>` : ''}
      <button class="btn gold" id="gok">OK</button></div>`;
  await new Promise(r => {
    $('#gok', ov).onclick = r;
    const gp = $('#gpart', ov);
    if (gp) gp.onclick = () => { S.partner = single.id; save(); Sound.coin(); gp.textContent = '✅ パートナーになった！'; gp.disabled = true; };
  });
  Sound.tap();
  ov.classList.add('out');
  setTimeout(() => ov.remove(), 200);
  await runEvents(res.events);
  if (current.name === 'gacha') render();
}

// ---------- 仲間 ----------
SCREENS.zukan = el => {
  const owned = Object.keys(S.chars).length;
  const id = S.partner, c = CHAR_BY_ID[id], o = S.chars[id];
  const st = charStage(o.level);
  const nextEvo = st < 2 ? EVOLVE_LV[st] : null;
  const sub = SUBJECT_BY_EL[c.el];
  el.innerHTML = `<h2 class="page-title">仲間 <span class="muted">${owned} / ${CHARACTERS.length}</span></h2>
    <div class="card partner-card" style="--el:${ELEMENTS[c.el].color}">
      <div class="pc-tag">パートナー</div>
      <div class="bob">${avatar(id, { size: 110 })}</div>
      <div class="pc-info"><div>${rarityTag(c.r)} ${elTag(c.el)}</div><h3>${charName(id)} <span class="lvl">Lv.${o.level}</span></h3>
        <div class="bar cexp"><i style="width:${o.level >= CHAR_MAX_LV ? '100%' : pct(o.exp, charExpNeed(o.level))}"></i></div>
        <p class="small">⚔️ 強さ ${charPower(id)}　${sub.icon}${sub.name}でよく育つ</p>
        <p class="small">${nextEvo ? `✨ Lv${nextEvo}で進化！` : '👑 最終形態！'}</p></div>
    </div>
    <div class="zukan">${CHARACTERS.map(ch => {
      const has = !!S.chars[ch.id];
      return `<button class="z-cell ${has ? '' : 'unknown'} ${ch.id === S.partner ? 'is-partner' : ''}" data-id="${ch.id}" style="--el:${ELEMENTS[ch.el].color}">
        ${has ? avatar(ch.id, { size: 56 }) : `<div class="avatar silhouette" style="--sz:56px">${icon(ch.forms[0])}</div>`}
        <small>${has ? charName(ch.id) : '？？？'}</small>
        <span class="z-meta">${has ? `Lv.${S.chars[ch.id].level}` : ''} <span class="rarity r${ch.r}">${RARITY[ch.r].stars}</span></span></button>`;
    }).join('')}</div>`;
  $$('.z-cell', el).forEach(b => b.onclick = () => { Sound.tap(); charDetail(b.dataset.id); });
};

async function charDetail(id) {
  const c = CHAR_BY_ID[id], o = S.chars[id];
  if (!o) {
    await modal(`<div class="m-av"><div class="avatar silhouette" style="--sz:110px">${icon(c.forms[0])}</div></div>
      <h2>？？？</h2><p>${rarityTag(c.r)} ${elTag(c.el)}</p><p>ガチャで出会えるかも…！</p>
      <button class="btn gold wide" data-v="ok">閉じる</button>`, { dismiss: true });
    return;
  }
  const st = charStage(o.level);
  const sub = SUBJECT_BY_EL[c.el];
  const evo = c.forms.map((f, i) => i <= st
    ? `<div class="evo-step" style="color:${ELEMENTS[c.el].color}">${icon(f)}<small>${c.names[i]}</small></div>`
    : `<div class="evo-step locked">${icon(f, 'sil')}<small>Lv${EVOLVE_LV[i - 1]}で進化</small></div>`).join('<span class="path">›</span>');
  const isP = id === S.partner;
  const v = await modal(`<div class="m-av bounce">${avatar(id, { size: 120 })}</div>
    <h2>${charName(id)}</h2><p>${rarityTag(c.r)} ${elTag(c.el)}</p>
    <div class="stat-grid"><div><small>レベル</small><b>${o.level}</b></div><div><small>強さ</small><b>${charPower(id)}</b></div><div><small>出会った数</small><b>${o.count}</b></div></div>
    <div class="bar cexp"><i style="width:${o.level >= CHAR_MAX_LV ? '100%' : pct(o.exp, charExpNeed(o.level))}"></i></div>
    <p class="small">${sub.icon}${sub.name}を勉強すると経験値×1.5</p>
    <div class="evo-line">${evo}</div>
    <div class="m-btns"><button class="btn ghost" data-v="close">閉じる</button>
    ${isP ? '<button class="btn" disabled>パートナー</button>' : '<button class="btn gold" data-v="partner">パートナーにする</button>'}</div>`, { dismiss: true });
  if (v === 'partner') {
    S.partner = id; save();
    Sound.coin();
    render();
  }
}

// ---------- 記録 ----------
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
  let cal = ['日', '月', '火', '水', '木', '金', '土'].map(d => `<div class="cal-h">${d}</div>`).join('');
  for (let i = 0; i < firstDow; i++) cal += '<div></div>';
  let monthMin = 0;
  for (let d = 1; d <= nDays; d++) {
    const k = dateKey(new Date(y, m, d));
    const mins = byDate[k] || 0;
    monthMin += mins;
    const stamp = mins >= 30 ? '💮' : mins > 0 ? '⭐' : '';
    cal += `<div class="cal-d ${k === t ? 'today' : ''} ${mins ? 'has' : ''}"><span>${d}</span>${stamp ? `<i>${stamp}</i>` : ''}${mins ? `<small>${mins}</small>` : ''}</div>`;
  }

  // 1週間
  const week = [];
  for (let i = 6; i >= 0; i--) {
    const k = dayOffset(t, -i);
    const ss = S.sessions.filter(s => s.date === k);
    week.push({ k, total: ss.reduce((a, s) => a + s.minutes, 0),
      parts: SUBJECTS.map(sub => ({ sub, min: ss.filter(s => s.subject === sub.id).reduce((a, s) => a + s.minutes, 0) })).filter(x => x.min) });
  }
  const wMax = Math.max(30, ...week.map(w => w.total));
  const dows = ['日', '月', '火', '水', '木', '金', '土'];
  const weekHtml = week.map(w => {
    const [yy, mm, dd] = w.k.split('-').map(Number);
    return `<div class="wk-col"><small class="wk-v">${w.total || ''}</small><div class="wk-bar">${w.parts.map(p =>
      `<i style="height:${(p.min / wMax) * 100}%;background:${p.sub.color}"></i>`).join('')}</div>
      <small>${dows[new Date(yy, mm - 1, dd).getDay()]}</small></div>`;
  }).join('');

  const subTotals = SUBJECTS.map(sub => ({ sub, min: S.sessions.filter(s => s.subject === sub.id).reduce((a, s) => a + s.minutes, 0) }));
  const sMax = Math.max(1, ...subTotals.map(x => x.min));
  const recent = S.sessions.slice(-10).reverse();

  el.innerHTML = `<h2 class="page-title">記録</h2>
    <div class="stat-grid big">
      <div><small>合計</small><b>${fmtMin(totalMin)}</b></div>
      <div><small>勉強した日数</small><b>${days}日</b></div>
      <div><small>連続記録</small><b>🔥${currentStreak()}日</b></div>
    </div>
    <div class="card"><div class="cal-nav"><button class="icon-btn" id="prevm">◀</button>
      <h3>${y}年${m + 1}月 <span class="muted small">${fmtMin(monthMin)}</span></h3>
      <button class="icon-btn" id="nextm" ${off >= 0 ? 'disabled' : ''}>▶</button></div>
      <div class="cal">${cal}</div><p class="small muted">⭐ 勉強した日　💮 30分以上</p></div>
    <div class="card"><h3>この1週間</h3><div class="week">${weekHtml}</div></div>
    <div class="card"><h3>教科別</h3>${subTotals.map(x => `<div class="sub-row"><span class="sr-name">${x.sub.icon} ${x.sub.name}</span>
      <div class="sr-bar"><i style="width:${(x.min / sMax) * 100}%;background:${x.sub.color}"></i></div><span class="sr-v">${fmtMin(x.min)}</span></div>`).join('')}</div>
    <div class="card"><h3>最近の記録</h3>${recent.length ? recent.map(s => {
      const d = new Date(s.at);
      return `<div class="recent"><span class="muted">${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}</span>
        ${subjChip(s.subject)}<b>${fmtMin(s.minutes)}</b>${s.goalMet ? '🎯' : ''}</div>`;
    }).join('') : '<p class="muted">まだ記録がありません</p>'}</div>`;
  $('#prevm').onclick = () => { Sound.tap(); go('records', { m: off - 1 }); };
  $('#nextm').onclick = () => { Sound.tap(); go('records', { m: off + 1 }); };
};

// ---------- 設定 ----------
function openSettings() {
  const m = openModal(`<h2>⚙️ 設定</h2>
    <label class="lbl">名前</label><input id="setname" class="input" maxlength="10" value="${esc(S.player.name)}">
    <label class="row-check"><input type="checkbox" id="setsound" ${S.settings.sound ? 'checked' : ''}> 効果音を鳴らす</label>
    <div class="parent">
      <h3>保護者の方へ</h3>
      <p class="small">${S.cloud ? 'データはこのブラウザと、保護者のアカウントに保存されます。' : 'データはこのブラウザ内にのみ保存されます。'}料金は一切かかりません。ガチャは勉強時間でためた⭐と🎫だけで引けます。1回の記録は最大${MAX_SESSION_MIN}分です。</p>
      ${cloudOn() ? (S.cloud
        ? `<p class="cloud-state ${S.cloud.lost ? 'lost' : ''}">${S.cloud.lost ? '⚠️ 連携が切れています。保護者ページで新しいコードを出して、連携し直してください。' : '✅ 保護者と連携中（記録は自動で保護者に届きます。ほかの端末でも続きから遊べます）'}</p>
           <div class="m-btns">${S.cloud.lost ? '<button class="btn mini" id="link">連携し直す</button>' : ''}<button class="btn ghost mini" id="unlink">連携を解除</button></div>`
        : `<button class="btn mini wide parent-link" id="link">🔗 保護者と連携する</button>
           <p class="small">保護者ページ（${location.host}${location.pathname.replace(/[^/]*$/, '')}parent.html）で Google アカウントにログインし、表示された6桁のコードを入力します。</p>`)
      : `<a class="btn mini wide parent-link" href="parent.html">👪 保護者ページを開く</a>
      <p class="small">勉強時間の確認や、1日の目標時間・優先する教科の設定ができます。</p>`}
      <div class="m-btns"><button class="btn ghost mini" id="export">データをダウンロード</button><button class="btn ghost mini" id="import">データを読み込む</button></div>
      <input type="file" id="importfile" accept="application/json" hidden>
      <button class="link danger" id="reset">最初からやり直す</button>
    </div>
    <p class="credit">キャラクター・敵アイコン：<a href="https://game-icons.net/" target="_blank" rel="noopener">game-icons.net</a>（Lorc, Delapouite ほか / CC BY 3.0）<br>地図データ：Natural Earth</p>
    <button class="btn gold wide" id="setclose">閉じる</button>`, { dismiss: false });
  const el = m.el;
  if ($('#link', el)) $('#link', el).onclick = () => { m.close(); openLinkModal(); };
  if ($('#unlink', el)) $('#unlink', el).onclick = () => {
    if (!confirm('保護者との連携を解除しますか？（この端末の記録は残ります）')) return;
    Cloud.leave(S.cloud.pid); Cloud.stopChild(); cloudStarted = false; S.cloud = null; saveQuiet(); m.close(); render();
  };
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
      if (!confirm('現在のデータを上書きして読み込みますか？')) return;
      S = normalize(d);
      save(); m.close(); go(S.player ? 'home' : 'onboard');
    } catch (err) { alert('読み込めませんでした。ファイルを確認してください。'); }
  };
  $('#reset', el).onclick = () => {
    const ans = prompt('すべてのデータが消えます。やり直す場合は「リセット」と入力してください。');
    if (ans === 'リセット') { localStorage.removeItem(SAVE_KEY); S = defaultState(); m.close(); go('onboard'); }
  };
}

// 保護者ページ（別のタブ）で設定が変わったら取り込む
window.addEventListener('storage', e => {
  if (e.key !== SAVE_KEY || !e.newValue) return;
  try { S.parent = normalize(JSON.parse(e.newValue)).parent; } catch (err) { return; }
  if (['home', 'setup'].includes(current.name)) render();
});

// ---------- 保護者との連携（Firebase） ----------
function cloudOn() { return !!(window.Cloud && Cloud.enabled); }

async function openLinkModal() {
  const m = openModal(`<h2>🔗 保護者と連携</h2>
    <p class="small">保護者ページに表示された6桁のコードを入力してね</p>
    <input id="lcode" class="input code-input" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="off" placeholder="000000">
    <p class="small err" id="lerr"></p>
    <div class="m-btns"><button class="btn ghost" data-v="close">やめる</button><button class="btn gold" id="lgo">連携する</button></div>`, { dismiss: true });
  const inp = $('#lcode', m.el), btn = $('#lgo', m.el);
  inp.focus();
  btn.onclick = async () => {
    const code = inp.value.trim();
    if (!/^\d{6}$/.test(code)) { $('#lerr', m.el).textContent = '6桁の数字を入力してください'; return; }
    btn.disabled = true; btn.textContent = '連携中…';
    try {
      const { pid, cloudSave, cloudRev } = await Cloud.linkChild(code);
      m.close();
      await finishLink(pid, cloudSave, cloudRev);
    } catch (e) {
      $('#lerr', m.el).textContent = e.message && /[ぁ-ん]/.test(e.message) ? e.message : '連携できませんでした。コードを確かめてください';
      btn.disabled = false; btn.textContent = '連携する';
    }
  };
  inp.onkeydown = e => { if (e.key === 'Enter') btn.click(); };
}

async function finishLink(pid, cloudSave, cloudRev) {
  let useCloud = false, c = null;
  if (cloudSave) {
    c = normalize(JSON.parse(cloudSave));
    if (c.player && !S.player) useCloud = true;
    else if (c.player && S.player) {
      const v = await modal(`<h2>記録が2つあります</h2>
        <p class="small">どちらの記録で続けますか？ 選ばなかった方は消えます。</p>
        <div class="m-btns col"><button class="btn ghost" data-v="local">この端末の記録<br><small>${esc(S.player.name)} Lv.${S.player.level}</small></button>
        <button class="btn gold" data-v="cloud">保護者に届いている記録<br><small>${esc(c.player.name)} Lv.${c.player.level}</small></button></div>`);
      useCloud = v === 'cloud';
    }
  }
  if (useCloud) S = fromCloud(c);
  // この端末の記録を使うときは、クラウドの記録を上書きする（cloudRev を基準にするので合わせない）
  S.cloud = { pid, rev: cloudRev, dirty: !useCloud && !!S.player };
  saveQuiet();
  await startCloud();
  Sound.levelup(); FX.confetti(80);
  await modal(`<div class="m-emo gold">${icon('linked-rings')}</div><h2>連携できた！</h2>
    <p>勉強の記録がおうちの人に届くようになったよ</p><button class="btn gold wide" data-v="ok">OK</button>`);
  go(!S.player ? 'onboard' : S.active ? 'timer' : 'home');
}

// ---- 同期 ----
// 端末ごとの記録はクラウドの「更新番号（rev）」で管理する。
//   この端末に変更がない → クラウドの新しい記録をそのまま使う
//   この端末にも変更がある → 2つを合わせてクラウドに書く（mergeSaves）
let cloudStarted = false, syncing = false, syncTimer = null, changeSeq = 0, queuedRemote = null;

// クラウドの記録を使うとき、この端末だけのもの（タイマー・効果音の設定・保護者の設定・連携情報）は残す
function fromCloud(remote) {
  const st = normalize(remote);
  st.active = S.active; st.settings = S.settings; st.parent = S.parent; st.cloud = S.cloud;
  return st;
}
function cloudPayload(st) { const { cloud, ...rest } = st; return rest; }

// store.js の save() から呼ばれる
function onCloudSave() {
  if (!S.cloud || S.cloud.lost) return;
  S.cloud.dirty = true;
  changeSeq++;
  saveQuiet();
  clearTimeout(syncTimer);
  syncTimer = setTimeout(syncNow, 1500);
}

async function syncNow() {
  clearTimeout(syncTimer);
  if (!cloudStarted || !S.cloud || S.cloud.lost || !S.cloud.dirty || syncing) return;
  syncing = true;
  const seq = changeSeq;
  let ok = false;
  try {
    const res = await Cloud.commit(S.cloud.pid, S.cloud.rev || 0,
      newer => cloudPayload(newer ? mergeSaves(normalize(JSON.parse(newer)), S) : S));
    if (res.merged) S = fromCloud(mergeSaves(normalize(res.save), S));
    S.cloud.rev = res.rev;
    if (changeSeq === seq) S.cloud.dirty = false;
    saveQuiet();
    if (res.merged) refreshAfterSync();
    ok = true;
  } catch (e) { console.warn('クラウド保存に失敗', e); }
  syncing = false;
  if (S.cloud && S.cloud.dirty) syncTimer = setTimeout(syncNow, ok ? 1500 : 15000);
  if (queuedRemote) { const r = queuedRemote; queuedRemote = null; onRemote(r); }
}

// ほかの端末がクラウドに書いた記録を受け取る
function onRemote(r) {
  if (!S.cloud || r.rev <= (S.cloud.rev || 0)) return;
  if (syncing) { queuedRemote = r; return; }
  if (S.cloud.dirty) { syncNow(); return; }   // 書くときに合わせる
  let remote;
  try { remote = JSON.parse(r.save); } catch (e) { return; }
  S = fromCloud(remote);
  S.cloud.rev = r.rev;
  saveQuiet();
  refreshAfterSync();
}
function refreshAfterSync() {
  if (!S.player) return;
  if ($('.modal-back') || $('.g-overlay')) { renderTopbar(); renderNav(); return; }
  if (['home', 'adventure', 'zukan', 'records', 'gacha'].includes(current.name)) render();
  else { renderTopbar(); renderNav(); }
}

// 連携中なら、保護者の設定とほかの端末の記録を受け取り、この端末の記録を送る
async function startCloud() {
  if (!cloudOn() || !S.cloud) return;
  cloudStarted = false;
  const ok = await Cloud.startChild(S.cloud.pid, {
    onParent: parent => {
      if (!parent || !S.cloud) return;
      const next = { ...S.parent, target: { ...S.parent.target, ...(parent.target || {}) }, priority: parent.priority || [] };
      if (JSON.stringify(next) === JSON.stringify(S.parent)) return;
      S.parent = next;
      saveQuiet();
      if (['home', 'setup'].includes(current.name)) render();
    },
    onRemote,
    onUnlinked: () => {
      if (!S.cloud) return;
      Cloud.stopChild(); cloudStarted = false;
      S.cloud = { ...S.cloud, lost: true };
      saveQuiet();
    },
  });
  if (!S.cloud) return;
  if (!ok) { S.cloud = { ...S.cloud, lost: true }; saveQuiet(); return; }
  delete S.cloud.lost;
  cloudStarted = true;
  saveQuiet();
  if (S.cloud.dirty) syncNow();
}
window.addEventListener('cloud-ready', () => {
  if (current.name === 'onboard' && !current.params.step && cloudOn() && !$('#name').value) render();   // 「前の記録を引き継ぐ」を出す
  startCloud();
});
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') syncNow(); });

// ---------- 起動 ----------
document.addEventListener('pointerdown', () => Sound.unlock(), { once: true });
if (!S.player) go('onboard');
else if (S.active) go('timer');
else go('home');
