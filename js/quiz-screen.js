'use strict';
// ===== きみ専用ドリル（画面） =====
// 出す問題は Quiz.plan() が、その子の記録（苦手・復習の時期・最近の講座・おうちの人の重点）から選ぶ。

function quizSubjects() {
  const ids = [...new Set(Object.values(Quiz.TAGS).map(t => t.subj))];
  return SUBJECTS.filter(s => ids.includes(s.id));
}

function quizReasonText(reasons) {
  return (reasons || []).slice(0, 2).join('・');
}

function quizHomeCardHtml() {
  const f = Quiz.focus(S).slice(0, 2);
  const z = S.quiz || Quiz.blankQuiz();
  const first = !z.log.length;
  return `<button class="card quiz-card" id="quiz-go"><h3>🧩 きみ専用ドリル</h3>
    <p class="small">${first ? 'ちょっとずつ答えて、きみに合った問題を出せるようになるよ' : `今日のねらい：<b>${f.map(x => esc(x.name)).join('・')}</b>`}</p>
    <p class="small muted">たった数問。まちがえたところが、次の問題になるよ ▶</p></button>`;
}

SCREENS.quiz = (el, params) => {
  let subject = params.subject || null;
  const stateRef = {};

  const intro = () => {
    const f = Quiz.focus(S, subject);
    const n = Quiz.setSize(S);
    el.innerHTML = `<div class="quiz-wrap">
      <button class="quiz-back" id="qz-back">‹ もどる</button>
      <h2 class="page-title">🧩 きみ専用ドリル</h2>
      <div class="card"><h3>きょうのねらい</h3>
        ${f.map(x => `<div class="quiz-focus"><b>${esc(x.name)}</b><span class="muted small">${esc(quizReasonText(x.reasons))}</span></div>`).join('')}
        <p class="small muted">きみの答えかたを見て、${n}問をえらんだよ。</p></div>
      <div class="card"><h3>教科</h3><div class="quiz-chips">
        <button class="quiz-chip ${!subject ? 'on' : ''}" data-s="">おまかせ</button>
        ${quizSubjects().map(s => `<button class="quiz-chip ${subject === s.id ? 'on' : ''}" data-s="${s.id}">${s.icon} ${s.name}</button>`).join('')}
      </div></div>
      <button class="btn big gold" id="qz-start">はじめる（${n}問）</button></div>`;
    $('#qz-back').onclick = () => { Sound.tap(); go('home'); };
    $$('.quiz-chip', el).forEach(b => b.onclick = () => { Sound.tap(); subject = b.dataset.s || null; intro(); });
    $('#qz-start').onclick = () => { Sound.tap(); start(); };
  };

  const start = () => {
    stateRef.qs = Quiz.plan(S, { subject });
    stateRef.i = 0;
    stateRef.results = [];
    if (!stateRef.qs.length) { go('home'); return; }
    ask();
  };

  const ask = () => {
    const { qs, i } = stateRef, q = qs[i];
    const t0 = Date.now();
    el.innerHTML = `<div class="quiz-wrap">
      <div class="quiz-prog"><i style="width:${pct(i, qs.length)}"></i></div>
      <p class="muted small quiz-no">${i + 1} / ${qs.length} ・ ${esc(Quiz.TAGS[q.tag].name)}</p>
      <div class="card quiz-q">${esc(q.q)}</div>
      <div class="quiz-choices">${q.choices.map((c, k) => `<button class="quiz-choice" data-k="${k}">${esc(c)}</button>`).join('')}</div>
      <div id="qz-fb"></div></div>`;
    let done = false;
    $$('.quiz-choice', el).forEach(b => b.onclick = () => {
      if (done) return;
      done = true;
      const k = +b.dataset.k, ok = k === q.a;
      const ms = Math.min(120000, Date.now() - t0);
      Quiz.record(S, q, ok, ms);
      saveQuiet();
      stateRef.results.push({ id: q.id, tag: q.tag, ok, ms });
      $$('.quiz-choice', el).forEach(x => { x.disabled = true; if (+x.dataset.k === q.a) x.classList.add('right'); });
      if (!ok) b.classList.add('wrong');
      ok ? Sound.coin() : Sound.tap();
      const last = i + 1 >= qs.length;
      $('#qz-fb').innerHTML = `<div class="card quiz-fb ${ok ? 'ok' : 'ng'}">
        <b>${ok ? 'せいかい！' : 'おしい！'}</b>${q.x ? `<p class="small">${esc(q.x)}</p>` : ''}
        <button class="btn ${ok ? 'gold' : ''} wide" id="qz-next">${last ? 'けっかを見る' : 'つぎへ'}</button></div>`;
      $('#qz-next').onclick = () => { Sound.tap(); stateRef.i++; last ? finish() : ask(); };
    });
  };

  const finish = async () => {
    const { results } = stateRef;
    const rw = Quiz.rewardFor(S, results);
    const events = [];
    if (rw.xp) {
      addXp(rw.xp, events);
      if (S.partner && S.chars[S.partner]) addCharExp(S.partner, rw.xp, events);
    }
    save();
    const wrongTags = [...new Set(results.filter(r => !r.ok).map(r => Quiz.TAGS[r.tag].name))];
    el.innerHTML = `<div class="quiz-wrap">
      <h2 class="page-title">けっか</h2>
      <div class="card quiz-result"><div class="quiz-score"><b>${rw.okN}</b> / ${results.length}</div>
        <p>${rw.okN === results.length ? 'ぜんぶ正解！すばらしい！' : rw.okN >= results.length / 2 ? 'いい調子！' : 'まちがえたところが、のびしろだよ'}</p>
        ${rw.xp ? `<p class="rw-big">経験値 +${rw.xp}</p>` : rw.paid ? '' : `<p class="small muted">今日のごほうびはもういっぱい。でも記録は育っているよ！</p>`}
        ${wrongTags.length ? `<p class="small">次はここを多めに出すね：<b>${wrongTags.map(esc).join('・')}</b></p>` : ''}</div>
      <button class="btn big gold" id="qz-again">もう1セット</button>
      <button class="btn wide" id="qz-home">ホームへ</button></div>`;
    $('#qz-again').onclick = () => { Sound.tap(); go('quiz', { subject }); };
    $('#qz-home').onclick = () => { Sound.tap(); go('home'); };
    if (events.length) await runEvents(events);
  };

  intro();
};
