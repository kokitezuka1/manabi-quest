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
    stage: { i: 0, dmg: 0, ver: 2, best: 0 },   // best: いちばん先まで進んだ街（リセットで戻ったときに使う）
    sessions: [],              // { subject, minutes, goal, goalMet, date, at, stars, prio, review, okMin, gotStars }
                               //   review: 'pending'（おうちの人の承認待ち）| 'ok'（承認）| 'ng'（却下）。古い記録にはない
    reviewNews: [],            // おうちの人が承認・却下した結果（まだ子どもに見せていないもの）
    lastReset: null,           // 最後に当てはめた「仲間のリセット」{ id, contracts, stars }
    resetNews: null,           // リセットされたことのお知らせ（まだ子どもに見せていないもの）
    gifts: [],                 // おうちの人からもらった⭐のプレゼント { id, stars, msg, at }（最近の50件）
    giftNews: [],              // まだ子どもに見せていないプレゼント
    daily: { date: '', claimed: [] },
    streak: { count: 0, last: '' },
    gacha: { pity: 0, total: 0 },   // pity: 前にSが出てから引いた回数
    contracts: {},             // 持っている契約書 { a: 枚数, s: 枚数, ssel: 枚数 }
    gv: 2,                     // ガチャのルールの版（2 = D〜Sランク・限界突破）
    settings: { sound: true, lastGoal: 15, lastSubject: null },
    active: null,              // タイマー実行中の情報
    parent: defaultParent(),   // 保護者ページで決める目標時間と優先教科
    cloud: null,               // 保護者と連携中なら { pid: 保護者のID }
  };
}
function defaultParent() {
  // target: 1日の目標（分）、0は未設定。courseDefault: 1講座の⭐、courseStars: 講座ごとに変えた⭐ { [講座id]: ⭐ }
  return { target: { weekday: 0, weekend: 0 }, priority: [], pin: '', courseDefault: COURSE_STARS, courseStars: {} };
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
  return migrate({ ...base, ...d, settings: { ...base.settings, ...(d.settings || {}) }, parent, contracts: { ...(d.contracts || {}) } }, d.gv || 1);
}
// 旧データを今の形に直す
function migrate(st, gv) {
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
  if (st.stage.best == null) st.stage.best = st.stage.i;
  // ★1〜3のガチャ → D〜Sランク：今までのダブりを限界突破に変え、リニューアル記念にA契約書を1枚
  if (gv < 2) {
    for (const o of Object.values(st.chars)) o.lb = Math.min(LIMIT_BREAK.max, Math.max(0, (o.count || 1) - 1));
    st.gacha = { ...st.gacha, pity: Math.min(st.gacha.pity || 0, GACHA.pityMax - 1) };
    if (st.player) st.contracts.a = (st.contracts.a || 0) + 1;
    st.gv = 2;
  }
  return st;
}
function save() {
  S.savedAt = Date.now();
  saveQuiet();
  if (S.cloud && typeof onCloudSave === 'function') onCloudSave();   // 保護者と連携中ならクラウドにも送る（app.js）
}
// 端末に書くだけ（クラウドから受け取った記録を保存するときなど）
function saveQuiet() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* 容量オーバーなど */ }
}

// 2つの端末の記録を合わせる。勉強の記録は両方残し、それ以外（⭐・冒険・仲間など）は新しく保存された方に合わせる
function mergeSaves(a, b) {
  const [newer, older] = (b.savedAt || 0) >= (a.savedAt || 0) ? [b, a] : [a, b];
  const key = x => x.at + '|' + x.subject + '|' + x.minutes;
  const seen = new Set(newer.sessions.map(key));
  const extra = older.sessions.filter(x => !seen.has(key(x)));
  if (!extra.length) return { ...newer };
  return { ...newer, sessions: [...newer.sessions, ...extra].sort((x, y) => x.at - y.at) };
}

// ---------- プレイヤー ----------
function startGame(name, starterId) {
  const keep = { parent: S.parent, cloud: S.cloud };   // 連携と保護者の設定は引き継ぐ
  S = { ...defaultState(), ...keep };
  S.player = { name, level: 1, xp: 0, stars: 0, tickets: 1, createdAt: Date.now() };
  S.chars[starterId] = { level: 1, exp: 0, count: 1, lb: 0 };
  S.partner = starterId;
  save();
}

// レベルが上がるほど、次のレベルまでに必要な経験値が大きく増える
function xpNeed(lv) { return Math.round(40 + lv * 20 + lv * lv * 1.5); }
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
function charExpNeed(lv) { return 30 + lv * 15 + lv * lv; }
function charLb(id) { return S.chars[id] ? S.chars[id].lb || 0 : 0; }
// レベルの上限：ランクごとの上限 + 限界突破1回ごとに +4
function charMaxLv(id, lb = charLb(id)) { return RARITY[CHAR_BY_ID[id].r].maxLv + lb * LIMIT_BREAK.lvPer; }
function charStage(lv) { return lv >= EVOLVE_LV[1] ? 2 : lv >= EVOLVE_LV[0] ? 1 : 0; }
function charLevel(id) { return S.chars[id] ? S.chars[id].level : 1; }
function charIcon(id, lv) { return CHAR_BY_ID[id].forms[charStage(lv ?? charLevel(id))]; }
function charName(id, lv) { return CHAR_BY_ID[id].names[charStage(lv ?? charLevel(id))]; }
function charPower(id) {
  const rk = RARITY[CHAR_BY_ID[id].r];
  return Math.round((rk.base + charLevel(id) * rk.perLv) * (1 + charLb(id) * LIMIT_BREAK.powerPer));
}

function addCharExp(id, amount, events) {
  const o = S.chars[id];
  const from = o.level, max = charMaxLv(id);
  o.exp += amount;
  while (o.level < max && o.exp >= charExpNeed(o.level)) {
    o.exp -= charExpNeed(o.level);
    o.level++;
  }
  if (o.level >= max) o.exp = 0;   // 上限に達したら、限界突破するまで育たない
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
  // 進むほど敵のHPがどんどん増える（仲間を育てて強くしないと倒しにくくなる）
  const raw = (100 + i * 60 + i * i * 2.2) * (enemy.boss ? 1.6 : 1);
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
  const best = S.stage.best ?? S.stage.i;   // ここより手前の街は、前に一度クリアしている
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
      S.stage.best = Math.max(best, S.stage.i);
    }
  }
  if (clears.length) {
    let stars = 0, tickets = 0;
    const contracts = [];
    for (const ci of clears) {
      const st = stageInfo(ci);
      stars += st.boss ? 40 : 15;
      if (st.boss && ci >= best) {   // チケットと契約書は、はじめてクリアしたときだけ
        tickets += 1;
        contracts.push(st.region.last ? 'ssel' : 'a');   // ボスを倒すとA契約書、大陸の最後のボスならS選択契約書
      }
    }
    S.player.stars += stars;
    S.player.tickets += tickets;
    contracts.forEach(addContract);
    const newWorld = clears.some(ci => stageInfo(ci).boss) ? stageInfo(S.stage.i) : null;
    events.push({ type: 'clear', clears, stars, tickets, contracts, newWorld, arrive: S.stage.i });
  }
  return { start, startDmg, firstWeak, total, clears, endStage: S.stage.i, endDmg: S.stage.dmg };
}

// ---------- 仲間のリセット（保護者ページから） ----------
const RESET_CITY_MIN = 30;   // リセット後は、Dランク Lv1 で1つの街を約30分以内に倒せるところまで戻る
// リセットしたらどうなるか（st: 保存データ）
function planReset(st) {
  const el = CHAR_BY_ID[st.partner] ? CHAR_BY_ID[st.partner].el : 'fire';
  const id = CHARACTERS.find(c => c.r === 1 && c.el === el).id;   // 今のパートナーと同じ属性のDランク
  const dmg = 10 + RARITY[1].base + RARITY[1].perLv;              // Dランク Lv1 の1分のダメージ
  let i = st.stage.i;
  while (i > 0 && stageInfo(i).hp / dmg > RESET_CITY_MIN) i--;
  return { id, stage: i };
}
// 仲間をDランク1体（Lv1）だけにする。cmd: { id, contracts: 契約書も消す, stars: ⭐と🎫も0にする }
function applyReset(cmd) {
  if (!cmd || !cmd.id || !S.player || (S.lastReset && S.lastReset.id === cmd.id)) return false;
  const plan = planReset(S);
  S.chars = { [plan.id]: { level: 1, exp: 0, count: 1, lb: 0 } };
  S.partner = plan.id;
  S.stage = { i: plan.stage, dmg: 0, ver: 2, best: Math.max(S.stage.best ?? S.stage.i, S.stage.i) };
  if (cmd.contracts) S.contracts = {};
  if (cmd.stars) { S.player.stars = 0; S.player.tickets = 0; }
  S.lastReset = { ...cmd };
  S.resetNews = plan;
  save();
  return true;
}

// ---------- ⭐のプレゼント（保護者ページから） ----------
const GIFT_MAX = 1000;
// list: [{ id, stars, msg, at }]。まだ受け取っていないものだけ⭐を入れる
function applyGifts(list) {
  if (!list || !S.player) return 0;
  const got = new Set(S.gifts.map(g => g.id));
  const fresh = list.filter(g => g && g.id && !got.has(g.id)).sort((a, b) => a.id - b.id);
  for (const g of fresh) {
    const stars = Math.max(1, Math.min(GIFT_MAX, Math.round(+g.stars) || 0));
    const gift = { id: g.id, stars, msg: String(g.msg || '').slice(0, 40), at: g.at || g.id };
    S.player.stars += stars;
    S.gifts.push(gift);
    S.giftNews.push(gift);
  }
  if (!fresh.length) return 0;
  S.gifts = S.gifts.slice(-50);
  S.giftNews = S.giftNews.slice(-20);
  save();
  return fresh.length;
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
  const contract = STREAK_CONTRACTS[S.streak.count] || null;
  S.player.stars += stars;
  S.player.tickets += tickets;
  if (contract) addContract(contract);
  events.push({ type: 'login', streak: S.streak.count, stars, tickets, contract });
}

// ---------- 勉強終了 ----------
// course: 講座をチェックしたときは講座の id（⭐は講座の⭐、時間は勉強時間として数える）
function finishSession(subject, minutes, goal, goalMet, course = null) {
  const events = [];
  const p = S.player;
  const xpBefore = { level: p.level, xp: p.xp };
  const partner = S.partner;
  const charBefore = { level: S.chars[partner].level, exp: S.chars[partner].exp };

  touchStreak(events);

  const xp = Math.round(minutes * 10 * (goalMet ? 1.2 : 1));
  // 勉強の⭐はすぐには入らない。おうちの人が承認したら入る（applyReviews）
  const stars = course ? courseStarsFor(course) : starsFor(minutes, goalMet, subject);
  const prio = !course && isPriority(subject);
  ensureDaily();
  const before = todayStats().minutes;
  // at は承認のときの目印にもなるので、ほかの記録と重ならないようにする
  const at = Math.max(Date.now(), ...S.sessions.slice(-5).map(s => s.at + 1));
  S.sessions.push({ subject, minutes, goal, goalMet, date: today(), at, stars, prio, review: 'pending', ...(course ? { course } : {}) });
  const target = targetFor(today());
  if (target && !S.daily.targetPaid && before < target && before + minutes >= target) {
    S.daily.targetPaid = true;   // 却下で時間が減ったあとに、もう一度もらえないように
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
  return { subject, minutes, goal, goalMet, course, xp, stars, prio, cexp, match, partner, xpBefore, charBefore, battle, events };
}
function starsFor(minutes, goalMet, subject) {
  const base = minutes + (goalMet ? 5 : 0);
  return isPriority(subject) ? Math.round(base * PRIORITY_STAR_RATE) : base;
}

// ---------- おうちの人の承認 ----------
// 記録として数える時間（却下は0、時間を直して承認したらその時間）
function sessionMin(s) { return s.review === 'ng' ? 0 : s.okMin ?? s.minutes; }
function pendingSessions() { return S.sessions.filter(s => s.review === 'pending'); }
// 承認した時間で⭐を計算する（優先教科かどうかは勉強したときのまま）
function reviewStars(s, min) {
  if (s.course) return s.stars;   // 講座の⭐は時間によらず決まった数
  const base = min + (s.goalMet && min >= s.goal ? 5 : 0);
  return s.prio ? Math.round(base * PRIORITY_STAR_RATE) : base;
}
// おうちの人の判断 { [記録のat]: { st: 'ok' | 'ng', min: 承認する分数 } } を、承認待ちの記録に当てはめて⭐を入れる
function applyReviews(decisions) {
  if (!decisions || !S.player) return 0;
  const news = [];
  for (const s of S.sessions) {
    const d = s.review === 'pending' && decisions[s.at];
    if (!d) continue;
    if (d.st === 'ok') {
      const min = Math.max(1, Math.min(s.minutes, Math.round(+d.min) || s.minutes));
      if (min !== s.minutes) s.okMin = min;
      s.gotStars = reviewStars(s, min);
      s.review = 'ok';
      S.player.stars += s.gotStars;
    } else if (d.st === 'ng') {
      s.review = 'ng';
    } else continue;
    news.push({ at: s.at, subject: s.subject, minutes: s.minutes, okMin: s.okMin, review: s.review, stars: s.gotStars || 0, course: s.course });
  }
  if (!news.length) return 0;
  S.reviewNews = [...(S.reviewNews || []), ...news].slice(-30);
  save();
  return news.length;
}
// 記録から、承認・却下が決まったものを取り出す（ほかのタブで承認されたときに使う）
function decisionsFrom(sessions) {
  const d = {};
  for (const s of sessions || []) if (s.review === 'ok' || s.review === 'ng') d[s.at] = { st: s.review, min: s.okMin ?? s.minutes };
  return d;
}

// ---------- 保護者の設定 ----------
function isWeekend(key) {
  const [y, m, d] = key.split('-').map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  return dow === 0 || dow === 6;
}
function targetFor(key) { return S.parent.target[isWeekend(key) ? 'weekend' : 'weekday'] || 0; }
function isPriority(subject) { return S.parent.priority.includes(subject); }
function courseStarsFor(id) { return S.parent.courseStars?.[id] ?? S.parent.courseDefault ?? COURSE_STARS; }
// 講座ごとの記録（承認済みの回数・承認待ちの回数）
function courseLog() {
  const log = {};
  for (const s of S.sessions) {
    if (!s.course) continue;
    const l = log[s.course] || (log[s.course] = { ok: 0, pending: 0, ng: 0, last: 0 });
    if (s.review === 'pending') l.pending++; else if (s.review === 'ng') l.ng++; else l.ok++;
    l.last = Math.max(l.last, s.at);
  }
  return log;
}
// 保護者ページから保存する。別のタブでゲームが開いていても上書きしないよう、最新のデータに parent だけ書き込む
function saveParent(parent) {
  S = load();
  S.parent = parent;
  save();
}

// ---------- ガチャ ----------
function rollRarity(forceMin) {
  if (S.gacha.pity >= GACHA.pityMax - 1) return 5;
  let x = Math.random() * 100, r = 5;
  while (r > 1 && x >= GACHA.rates[r]) { x -= GACHA.rates[r]; r--; }
  if (forceMin && r < forceMin) r = forceMin;
  return r;
}
function randomChar(r) {
  const pool = CHARACTERS.filter(c => c.r === r);
  return pool[Math.floor(Math.random() * pool.length)].id;
}

// 仲間を手に入れる。持っていなければ仲間に、持っていれば限界突破（最大まで突破していたら経験値）
function gainChar(id, events) {
  const r = CHAR_BY_ID[id].r;
  const o = S.chars[id];
  if (!o) {
    S.chars[id] = { level: 1, exp: 0, count: 1, lb: 0 };
    return { id, r, isNew: true };
  }
  o.count++;
  if ((o.lb || 0) < LIMIT_BREAK.max) {
    o.lb = (o.lb || 0) + 1;
    return { id, r, isNew: false, lb: o.lb, maxLv: charMaxLv(id) };
  }
  const bonus = 100 * r;
  addCharExp(id, bonus, events);
  return { id, r, isNew: false, bonus };
}

function pullGacha(kind) {
  const p = S.player;
  const n = kind === 'ten' ? 10 : 1;
  if (kind === 'ticket') { if (p.tickets < 1) return null; p.tickets--; }
  else if (kind === 'one') { if (p.stars < GACHA.cost1) return null; p.stars -= GACHA.cost1; }
  else if (kind === 'ten') { if (p.stars < GACHA.cost10) return null; p.stars -= GACHA.cost10; }

  const results = [], events = [];
  for (let k = 0; k < n; k++) {
    const needMin = n === 10 && k === 9 && !results.some(x => x.r >= GACHA.tenMin);
    const r = rollRarity(needMin ? GACHA.tenMin : 0);
    S.gacha.pity = r === 5 ? 0 : S.gacha.pity + 1;
    S.gacha.total++;
    results.push(gainChar(randomChar(r), events));
  }
  save();
  return { results, events };
}

// ---------- 契約書 ----------
function addContract(kind) { S.contracts[kind] = (S.contracts[kind] || 0) + 1; }
function contractCount() { return Object.values(S.contracts).reduce((a, n) => a + n, 0); }
// 契約書を使う。選択契約書なら pickId で仲間を選ぶ
function useContract(kind, pickId) {
  const def = CONTRACTS[kind];
  if (!def || !(S.contracts[kind] > 0)) return null;
  const id = def.pick ? pickId : randomChar(def.r);
  if (!CHAR_BY_ID[id] || CHAR_BY_ID[id].r !== def.r) return null;
  S.contracts[kind]--;
  if (!S.contracts[kind]) delete S.contracts[kind];
  const events = [];
  const results = [gainChar(id, events)];
  save();
  return { results, events };
}

// ---------- ミッション ----------
function ensureDaily() {
  if (S.daily.date !== today()) S.daily = { date: today(), claimed: [] };   // 保存は次の操作のときにまとめて
}
function todayStats() {
  const t = today();
  const ss = S.sessions.filter(s => s.date === t && s.review !== 'ng');
  return {
    minutes: ss.reduce((a, s) => a + sessionMin(s), 0),
    subjects: new Set(ss.map(s => s.subject)).size,
    goals: ss.filter(s => s.goalMet).length,
    sessions: ss.length,
    bySubject: SUBJECTS.map(sub => ({ sub, min: ss.filter(s => s.subject === sub.id).reduce((a, s) => a + sessionMin(s), 0) })),
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
