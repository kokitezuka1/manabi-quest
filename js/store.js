'use strict';
// ===== セーブデータとゲームのルール =====

const SAVE_KEY = 'manabi-quest-v1';

function dateKey(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function today() { return dateKey(new Date()); }
function dayOffset(key, n) {
  const [y, m, d] = key.split('-').map(Number);
  return dateKey(new Date(y, m - 1, d + n));
}

function defaultState() {
  return {
    v: 1,
    player: null,              // { name, level, xp, stars, tickets, createdAt }
    chars: {},                 // { [id]: { level, exp, count } }
    partner: null,
    stage: { i: 0, dmg: 0, ver: 2 },
    sessions: [],              // { subject, minutes, goal, goalMet, date, at }
    daily: { date: '', claimed: [] },
    streak: { count: 0, last: '' },
    gacha: { pity: 0, total: 0 },
    settings: { sound: true, lastGoal: 15, lastSubject: null },
    active: null,              // タイマー実行中の情報
    parent: defaultParent(),   // 保護者ページで決める目標時間と優先教科
    cloud: null,               // 保護者と連携中なら { pid: 保護者のID }
  };
}
function defaultParent() {
  return { target: { weekday: 0, weekend: 0 }, priority: [], pin: '' };   // target: 1日の目標（分）、0は未設定
}

let S = load();

function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      return normalize(JSON.parse(raw));
    }
  } catch (e) { /* 壊れたデータは無視 */ }
  return defaultState();
}
function normalize(d) {
  const base = defaultState();
  const parent = { ...base.parent, ...(d.parent || {}) };
  parent.target = { ...base.parent.target, ...(parent.target || {}) };
  return migrate({ ...base, ...d, settings: { ...base.settings, ...(d.settings || {}) }, parent });
}
// 旧データを今の形に直す
function migrate(st) {
  // 冒険の進み具合：アメリカを回っている途中なら、クリアした数だけ新しいアメリカの旅を進める。
  // ヨーロッパ以降にいるなら、同じ街に移す。
  if (!st.stage.ver) {
    const n = OLD_CITY_ORDER.length;
    const loop = Math.floor(st.stage.i / n), k = st.stage.i % n;
    const ni = k < 6 ? k : CITIES.findIndex(c => c.id === OLD_CITY_ORDER[k]);
    st.stage = { i: loop * CITIES.length + ni, dmg: 0, ver: 2 };
  }
  // 旧キャラIDを新キャラIDに置き換える
  const chars = {};
  for (const [id, o] of Object.entries(st.chars || {})) {
    const nid = CHAR_BY_ID[id] ? id : OLD_CHAR_IDS[id];
    if (nid) chars[nid] = o;
  }
  st.chars = chars;
  if (st.partner && !CHAR_BY_ID[st.partner]) st.partner = OLD_CHAR_IDS[st.partner] || Object.keys(chars)[0] || null;
  return st;
}
function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* 容量オーバーなど */ }
  if (S.cloud && window.Cloud) window.Cloud.pushSave(S);   // 保護者と連携中ならクラウドにも送る
}

// ---------- プレイヤー ----------
function startGame(name, starterId) {
  const keep = { parent: S.parent, cloud: S.cloud };   // 連携と保護者の設定は引き継ぐ
  S = { ...defaultState(), ...keep };
  S.player = { name, level: 1, xp: 0, stars: 0, tickets: 1, createdAt: Date.now() };
  S.chars[starterId] = { level: 1, exp: 0, count: 1 };
  S.partner = starterId;
  save();
}

function xpNeed(lv) { return 40 + lv * 20; }
function titleFor(lv) {
  let t = TITLES[0][1];
  for (const [l, name] of TITLES) if (lv >= l) t = name;
  return t;
}

function addXp(amount, events) {
  const p = S.player;
  const from = p.level;
  p.xp += amount;
  let stars = 0, tickets = 0;
  while (p.xp >= xpNeed(p.level)) {
    p.xp -= xpNeed(p.level);
    p.level++;
    stars += 5;
    if (p.level % 5 === 0) tickets++;
  }
  if (p.level > from) {
    p.stars += stars;
    p.tickets += tickets;
    events.push({ type: 'levelup', from, to: p.level, stars, tickets, newTitle: titleFor(p.level) !== titleFor(from) ? titleFor(p.level) : null });
  }
}

// ---------- 仲間 ----------
function charExpNeed(lv) { return 30 + lv * 15; }
function charStage(lv) { return lv >= EVOLVE_LV[1] ? 2 : lv >= EVOLVE_LV[0] ? 1 : 0; }
function charLevel(id) { return S.chars[id] ? S.chars[id].level : 1; }
function charIcon(id, lv) { return CHAR_BY_ID[id].forms[charStage(lv ?? charLevel(id))]; }
function charName(id, lv) { return CHAR_BY_ID[id].names[charStage(lv ?? charLevel(id))]; }
function charPower(id) {
  const c = CHAR_BY_ID[id];
  return RARITY[c.r].base + charLevel(id) * c.r;
}

function addCharExp(id, amount, events) {
  const o = S.chars[id];
  const from = o.level;
  o.exp += amount;
  while (o.level < CHAR_MAX_LV && o.exp >= charExpNeed(o.level)) {
    o.exp -= charExpNeed(o.level);
    o.level++;
  }
  if (o.level >= CHAR_MAX_LV) o.exp = 0;
  if (o.level > from) events.push({ type: 'charlv', id, from, to: o.level });
  if (charStage(o.level) > charStage(from)) events.push({ type: 'evolve', id, fromLv: from, toLv: o.level });
}

// ---------- ステージ（世界一周） ----------
const STAGES_PER_LOOP = CITIES.length;
function stageInfo(i) {
  const loop = Math.floor(i / STAGES_PER_LOOP);
  const k = i % STAGES_PER_LOOP;
  const city = CITIES[k];
  const region = REGION_BY_ID[city.region];
  const sub = CITIES.filter(c => c.region === city.region).indexOf(city);
  const enemy = { e: city.e, n: city.n, weak: SUBJECT_BY_ID[city.subject].el, boss: !!city.boss };
  // 旧バージョン（1周24都市）と同じ上がり方で、都市が増えた分だけ1都市のHPを軽くする
  const j = i * 24 / STAGES_PER_LOOP;
  const raw = Math.max(100, (120 + j * 90 + j * j * 6) * 0.6) * (enemy.boss ? 1.6 : 1);
  return { i, loop, k, city, region, world: region, regionIdx: REGIONS.indexOf(region), sub, enemy, boss: enemy.boss, hp: Math.round(raw / 10) * 10 };
}
function currentStage() { return stageInfo(S.stage.i); }

function damagePerMin(subjectId, stage) {
  const base = 10 + (S.partner ? charPower(S.partner) : 5);
  const weak = SUBJECT_BY_ID[subjectId].el === stage.enemy.weak;
  return { dmg: base * (weak ? 2 : 1), weak };
}

// 1分ずつ攻撃して、倒したら次のステージへ
function dealDamage(minutes, subjectId, events) {
  const start = S.stage.i, startDmg = S.stage.dmg;
  const firstWeak = damagePerMin(subjectId, stageInfo(start)).weak;
  let total = 0;
  const clears = [];
  for (let m = 0; m < minutes; m++) {
    const st = stageInfo(S.stage.i);
    const { dmg } = damagePerMin(subjectId, st);
    total += dmg;
    S.stage.dmg += dmg;
    if (S.stage.dmg >= st.hp) {
      clears.push(st.i);
      S.stage.i++;
      S.stage.dmg = 0;
    }
  }
  if (clears.length) {
    let stars = 0, tickets = 0;
    for (const ci of clears) {
      const st = stageInfo(ci);
      stars += st.boss ? 40 : 15;
      if (st.boss) tickets += 1;
    }
    S.player.stars += stars;
    S.player.tickets += tickets;
    const newWorld = clears.some(ci => stageInfo(ci).boss) ? stageInfo(S.stage.i) : null;
    events.push({ type: 'clear', clears, stars, tickets, newWorld, arrive: S.stage.i });
  }
  return { start, startDmg, firstWeak, total, clears, endStage: S.stage.i, endDmg: S.stage.dmg };
}

// ---------- 連続記録 ----------
function currentStreak() {
  const t = today();
  if (S.streak.last === t || S.streak.last === dayOffset(t, -1)) return S.streak.count;
  return 0;
}
function touchStreak(events) {
  const t = today();
  if (S.streak.last === t) return;
  S.streak.count = S.streak.last === dayOffset(t, -1) ? S.streak.count + 1 : 1;
  S.streak.last = t;
  const stars = 5 + Math.min(S.streak.count, 7) * 5;
  const tickets = [3, 7, 14, 21, 30, 50, 100].includes(S.streak.count) ? (S.streak.count >= 7 ? 2 : 1) : 0;
  S.player.stars += stars;
  S.player.tickets += tickets;
  events.push({ type: 'login', streak: S.streak.count, stars, tickets });
}

// ---------- 勉強終了 ----------
function finishSession(subject, minutes, goal, goalMet) {
  const events = [];
  const p = S.player;
  const xpBefore = { level: p.level, xp: p.xp };
  const partner = S.partner;
  const charBefore = { level: S.chars[partner].level, exp: S.chars[partner].exp };

  touchStreak(events);

  const xp = Math.round(minutes * 10 * (goalMet ? 1.2 : 1));
  const stars = starsFor(minutes, goalMet, subject);
  const prio = isPriority(subject);
  p.stars += stars;
  const before = todayStats().minutes;
  S.sessions.push({ subject, minutes, goal, goalMet, date: today(), at: Date.now() });
  const target = targetFor(today());
  if (target && before < target && before + minutes >= target) {
    p.stars += TARGET_BONUS.stars;
    events.push({ type: 'target', target, stars: TARGET_BONUS.stars });
  }

  addXp(xp, events);
  const match = CHAR_BY_ID[partner].el === SUBJECT_BY_ID[subject].el;
  const cexp = Math.round(minutes * 10 * (match ? 1.5 : 1));
  addCharExp(partner, cexp, events);
  const battle = dealDamage(minutes, subject, events);

  S.active = null;
  save();
  return { subject, minutes, goal, goalMet, xp, stars, prio, cexp, match, partner, xpBefore, charBefore, battle, events };
}
function starsFor(minutes, goalMet, subject) {
  const base = minutes + (goalMet ? 5 : 0);
  return isPriority(subject) ? Math.round(base * PRIORITY_STAR_RATE) : base;
}

// ---------- 保護者の設定 ----------
function isWeekend(key) {
  const [y, m, d] = key.split('-').map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  return dow === 0 || dow === 6;
}
function targetFor(key) { return S.parent.target[isWeekend(key) ? 'weekend' : 'weekday'] || 0; }
function isPriority(subject) { return S.parent.priority.includes(subject); }
// 保護者ページから保存する。別のタブでゲームが開いていても上書きしないよう、最新のデータに parent だけ書き込む
function saveParent(parent) {
  S = load();
  S.parent = parent;
  save();
}

// ---------- ガチャ ----------
function rollRarity(forceMin) {
  if (S.gacha.pity >= GACHA.pityMax - 1) return 3;
  const x = Math.random() * 100;
  let r = x < GACHA.rates[3] ? 3 : x < GACHA.rates[3] + GACHA.rates[2] ? 2 : 1;
  if (forceMin && r < forceMin) r = forceMin;
  return r;
}

function pullGacha(kind) {
  const p = S.player;
  const n = kind === 'ten' ? 10 : 1;
  if (kind === 'ticket') { if (p.tickets < 1) return null; p.tickets--; }
  else if (kind === 'one') { if (p.stars < GACHA.cost1) return null; p.stars -= GACHA.cost1; }
  else if (kind === 'ten') { if (p.stars < GACHA.cost10) return null; p.stars -= GACHA.cost10; }

  const results = [], events = [];
  for (let k = 0; k < n; k++) {
    const needR2 = n === 10 && k === 9 && !results.some(x => x.r >= 2);
    const r = rollRarity(needR2 ? 2 : 0);
    S.gacha.pity = r === 3 ? 0 : S.gacha.pity + 1;
    S.gacha.total++;
    const pool = CHARACTERS.filter(c => c.r === r);
    const c = pool[Math.floor(Math.random() * pool.length)];
    if (!S.chars[c.id]) {
      S.chars[c.id] = { level: 1, exp: 0, count: 1 };
      results.push({ id: c.id, r, isNew: true });
    } else {
      S.chars[c.id].count++;
      const bonus = 100 * r;
      addCharExp(c.id, bonus, events);
      results.push({ id: c.id, r, isNew: false, bonus });
    }
  }
  save();
  return { results, events };
}

// ---------- ミッション ----------
function ensureDaily() {
  if (S.daily.date !== today()) { S.daily = { date: today(), claimed: [] }; save(); }
}
function todayStats() {
  const t = today();
  const ss = S.sessions.filter(s => s.date === t);
  return {
    minutes: ss.reduce((a, s) => a + s.minutes, 0),
    subjects: new Set(ss.map(s => s.subject)).size,
    goals: ss.filter(s => s.goalMet).length,
    sessions: ss.length,
    bySubject: SUBJECTS.map(sub => ({ sub, min: ss.filter(s => s.subject === sub.id).reduce((a, s) => a + s.minutes, 0) })),
  };
}
function missionList() {
  ensureDaily();
  const t = todayStats();
  const list = MISSIONS.map(m => {
    const cur = Math.min(m.cur(t), m.max);
    return { ...m, cur, done: cur >= m.max, claimed: S.daily.claimed.includes(m.id) };
  });
  const allDone = list.every(m => m.claimed);
  list.push({ id: 'all', label: 'ミッションを全てクリア！', reward: ALL_MISSION_BONUS,
    cur: list.filter(m => m.claimed).length, max: MISSIONS.length, done: allDone, claimed: S.daily.claimed.includes('all'), bonus: true });
  return list;
}
function claimableCount() { return missionList().filter(m => m.done && !m.claimed).length; }
function claimMission(id) {
  const m = missionList().find(x => x.id === id);
  if (!m || !m.done || m.claimed) return null;
  S.daily.claimed.push(id);
  S.player.stars += m.reward.stars || 0;
  S.player.tickets += m.reward.tickets || 0;
  save();
  return m.reward;
}

// ---------- タイマー ----------
function startActive(subject, goal) {
  S.active = { subject, goal, startedAt: Date.now(), pausedAt: null, pausedTotal: 0, goalNotified: false };
  S.settings.lastGoal = goal;
  S.settings.lastSubject = subject;
  save();
}
function activeElapsedSec() {
  const a = S.active;
  if (!a) return 0;
  const now = a.pausedAt || Date.now();
  return Math.max(0, Math.floor((now - a.startedAt - a.pausedTotal) / 1000));
}
function togglePause() {
  const a = S.active;
  if (a.pausedAt) { a.pausedTotal += Date.now() - a.pausedAt; a.pausedAt = null; }
  else a.pausedAt = Date.now();
  save();
}
function cancelActive() { S.active = null; save(); }

// ---------- 表示 ----------
function fmtMin(m) {
  if (m < 60) return m + '分';
  const h = Math.floor(m / 60), r = m % 60;
  return h + '時間' + (r ? r + '分' : '');
}
