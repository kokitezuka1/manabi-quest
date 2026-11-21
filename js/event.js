'use strict';
// ===== 期間限定イベント「日本列島ぐるり暗記ウィーク」（社会のフラッシュカード） =====
// ・カードの勉強時間は社会の勉強時間に数える。ただし、ふだんのクエスト（ボス）は進まない
// ・カードは「別の日に2回おぼえていた」ら「覚えた」。1週間で約半分(78枚)が覚えられる設計
// ・報酬は、ふだんのクエストも進めないと受け取れない（イベントだけに偏らないように）

const SW = (() => {
  const ID = 'shakai-week';
  const START = '2026-11-21', END = '2026-11-27';
  const N = SW_CARDS.length;
  const NEED_DAYS = 2;             // 別々の日に2回「覚えてた」と答えたら「覚えた」
  const ROUND = 10;                // 1回のカード数
  const IDLE_CAP_SEC = 40;         // 1枚あたり、勉強時間に数える上限（放置対策）
  const HALF = Math.ceil(N / 2);

  // 報酬：n=覚えた枚数、need=ふだんのクエストで勉強した時間（分）
  const MILESTONES = [
    { id: 'm1', n: Math.round(N * 0.1), need: 10, stars: 50 },
    { id: 'm2', n: Math.round(N * 0.2), need: 25, stars: 100 },
    { id: 'm3', n: Math.round(N * 0.33), need: 45, stars: 100, tickets: 1 },
    { id: 'half', n: HALF, need: 70, half: true, char: 'nihon', contracts: ['a'] },
    { id: 'm5', n: Math.round(N * 0.7), need: 110, stars: 300, contracts: ['s'] },
    { id: 'all', n: N, need: 150, tickets: 3, contracts: ['ssel'] },
  ];

  const blank = () => ({ intro: false, cards: {}, sec: 0, min: 0, claimed: [] });
  const st = () => S.sw || (S.sw = blank());
  const dbg = () => /[?&]sw=1/.test(location.search);
  const inRange = d => d >= START && d <= END;
  const active = () => dbg() || inRange(today());
  const daysLeft = () => {
    const [y, m, d] = END.split('-').map(Number);
    const e = new Date(y, m - 1, d + 1), n = new Date();
    return Math.max(0, Math.ceil((e - n) / 86400000));
  };
  const card = id => st().cards[id] || { b: 0, last: '', ok: 0, ng: 0 };
  const isMastered = id => card(id).b >= NEED_DAYS;
  const masteredCount = () => SW_CARDS.reduce((a, _, i) => a + (isMastered(i) ? 1 : 0), 0);
  const deckStat = d => {
    let total = 0, done = 0;
    SW_CARDS.forEach((c, i) => { if (c[0] === d) { total++; if (isMastered(i)) done++; } });
    return { total, done };
  };

  // 今週、ふだんのクエストで勉強した時間（イベントの時間はふくめない）
  const questMin = () => S.sessions.filter(s => !s.event && s.review !== 'ng' && inRange(s.date) || (dbg() && !s.event && s.review !== 'ng'))
    .reduce((a, s) => a + sessionMin(s), 0);
  const eventMin = () => S.sessions.filter(s => s.event === ID && s.review !== 'ng').reduce((a, s) => a + sessionMin(s), 0);

  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // 出すカードを選ぶ：別の日の復習(2回目)を優先 → まちがえたカード → 新しいカード → 覚えたカードの見直し
  function plan(n = ROUND) {
    const t = today(), ids = SW_CARDS.map((_, i) => i);
    const due = shuffle(ids.filter(i => card(i).b >= 1 && card(i).b < NEED_DAYS && card(i).last !== t));
    const missed = shuffle(ids.filter(i => card(i).b === 0 && card(i).ng > 0 && card(i).ok === 0 || card(i).b === 0 && card(i).ng > 0));
    const fresh = ids.filter(i => !card(i).ok && !card(i).ng);
    const waiting = ids.filter(i => card(i).b >= 1 && card(i).b < NEED_DAYS && card(i).last === t);   // 今日もう答えた
    const mastered = shuffle(ids.filter(i => isMastered(i)));
    const out = [];
    const add = (list, max) => { for (const i of list) { if (out.length >= n || max <= 0) break; if (!out.includes(i)) { out.push(i); max--; } } };
    add(due, 6); add(missed, 3); add(fresh, n); add(due, n); add(missed, n); add(waiting, n); add(mastered, n);
    return shuffle(out.slice(0, n));
  }

  // 答えを記録する。ok=覚えてた。別の日に「覚えてた」を重ねると覚えた(b)が進む
  function answer(id, ok) {
    const c = st().cards[id] = { ...card(id) };
    const t = today();
    if (ok) {
      c.ok++;
      if (c.last !== t) { c.b = Math.min(NEED_DAYS + 1, c.b + 1); c.last = t; }
    } else {
      c.ng++;
      c.b = Math.max(0, c.b - 1);
      c.last = '';
    }
    saveQuiet();
  }

  // かかった秒数をためて、1分ぶんたまるたびに「社会の勉強」として記録する
  function addSeconds(sec) { st().sec += Math.max(0, Math.min(sec, IDLE_CAP_SEC)); }
  function flushTime() {
    const z = st();
    const minutes = Math.floor(z.sec / 60);
    if (minutes < 1) { saveQuiet(); return null; }
    z.sec -= minutes * 60;
    return recordEventSession(minutes);
  }
  function recordEventSession(minutes) {
    const events = [];
    const p = S.player;
    touchStreak(events);
    const stars = starsFor(minutes, false, 'shakai');
    ensureDaily();
    const before = todayStats().minutes;
    const at = Math.max(Date.now(), ...S.sessions.slice(-5).map(s => s.at + 1));
    S.sessions.push({ subject: 'shakai', minutes, goal: minutes, goalMet: false, date: today(), at, stars, prio: isPriority('shakai'), review: 'pending', event: ID });
    const target = targetFor(today());
    if (target && !S.daily.targetPaid && before < target && before + minutes >= target) {
      S.daily.targetPaid = true;
      p.stars += TARGET_BONUS.stars;
      events.push({ type: 'target', target, stars: TARGET_BONUS.stars });
    }
    addXp(Math.round(minutes * 10), events);   // 勉強した経験値は入る。ボスへのダメージ・仲間の育成は、ふだんのクエストだけ
    st().min += minutes;
    save();
    return { minutes, stars, events };
  }

  // 報酬
  function milestoneState(m) {
    const done = masteredCount() >= m.n, qm = questMin();
    const claimed = st().claimed.includes(m.id);
    return { claimed, reached: done, gateOk: qm >= m.need, claimable: !claimed && done && qm >= m.need, lack: Math.max(0, m.need - qm) };
  }
  function claim(id) {
    const m = MILESTONES.find(x => x.id === id);
    if (!m || !milestoneState(m).claimable) return null;
    const events = [];
    st().claimed.push(id);
    S.player.stars += m.stars || 0;
    S.player.tickets += m.tickets || 0;
    (m.contracts || []).forEach(addContract);
    const got = m.char ? gainChar(m.char, events) : null;
    save();
    return { m, got, events };
  }
  const claimableCount = () => MILESTONES.filter(m => milestoneState(m).claimable).length;

  return { ID, START, END, N, HALF, ROUND, NEED_DAYS, MILESTONES, blank, active, daysLeft, card, isMastered, masteredCount, deckStat,
    questMin, eventMin, plan, answer, addSeconds, flushTime, milestoneState, claim, claimableCount };
})();
