'use strict';
// ===== 期間限定イベント「日本列島ぐるり暗記ウィーク」（画面） =====

function swGateText(m, ms) {
  if (ms.claimed) return '受け取りずみ';
  if (!ms.reached) return `あと${m.n - SW.masteredCount()}枚`;
  if (!ms.gateOk) return `ふだんのクエストをあと${ms.lack}分`;
  return '受け取れる！';
}

function swRewardText(m) {
  const t = [];
  if (m.stars) t.push(`⭐${m.stars}`);
  if (m.tickets) t.push(`🎫${m.tickets}`);
  (m.contracts || []).forEach(k => t.push(`📜${CONTRACTS[k] ? CONTRACTS[k].name : k}`));
  if (m.char) t.push(`限定の仲間「${CHAR_BY_ID[m.char].names[0]}」`);
  return t.join(' ＋ ');
}

function swHomeCardHtml() {
  if (!SW.active()) return '';
  const n = SW.masteredCount(), claim = SW.claimableCount();
  return `<button class="card sw-card" id="sw-go"><span class="sw-tag">⚡ 期間限定 あと${SW.daysLeft()}日</span>
    <h3>🗾 日本列島ぐるり暗記ウィーク</h3>
    <div class="sw-bar"><i style="width:${pct(n, SW.N)}"></i><b style="left:${pct(SW.HALF, SW.N)}"></b></div>
    <p class="small">覚えたカード <b>${n}</b> / ${SW.N}（半分は${SW.HALF}枚）${claim ? ` ・ <b class="sw-hot">受け取れる報酬が${claim}つ！</b>` : ''}</p></button>`;
}

function swNavBadge() {
  if (SW.claimableCount()) return SW.claimableCount();
  const t = today();
  return Object.values(S.sw.cards).some(c => c.last === t) ? 0 : '!';
}

// 派手な開始の演出。いま冒険している街にあわせて物語に入る
async function showSwIntro() {
  if (showingNews || $('.modal-back') || $('.g-overlay') || !S.player) return;
  showingNews = true;
  S.sw.intro = true; save();
  const st = currentStage();
  const where = `${st.region.flag || ''} ${st.region.name}の${st.city.name}`;
  const ov = document.createElement('div');
  ov.className = 'g-overlay sw-intro';
  ov.innerHTML = `<div class="sw-flash"></div><div class="sw-rays"></div>
    <div class="sw-stage" id="sw-stage"></div>`;
  document.body.appendChild(ov);
  const stage = ov.querySelector('#sw-stage');
  const show = html => { stage.innerHTML = html; };
  const wait = async ms => { await sleep(ms); };

  Sound.drum && Sound.drum();
  FX.confetti(80);
  show(`<p class="sw-line big">${esc(where)}を進んでいると…</p>`);
  await wait(1600);
  Sound.chime && Sound.chime();
  show(`<p class="sw-line">ゴゴゴゴゴ…！<br>空がぱっくり裂けた！</p><div class="sw-crack"></div>`);
  document.body.classList.add('sw-shake');
  await wait(1700);
  document.body.classList.remove('sw-shake');
  Sound.chime && Sound.chime();
  show(`<p class="sw-line">${esc(st.enemy.n)}の足もとに、<br>光のかけらが <b class="sw-gold">${SW.N}こ</b> 散らばった！</p>
    <div class="sw-frags">${Array.from({ length: 24 }, (_, i) => `<i style="--x:${(i * 37) % 100}%;--d:${(i % 8) * .15}s">🗾</i>`).join('')}</div>`);
  FX.burst(innerWidth / 2, innerHeight / 2, 60, true);
  await wait(2000);
  Sound.drum && Sound.drum();
  FX.confetti(160);
  const c = CHAR_BY_ID.nihon;
  stage.innerHTML = `<div class="sw-title-wrap">
      <div class="sw-ev-tag">⚡ 期間限定イベント ⚡</div>
      <h1 class="sw-title">日本列島<br>ぐるり暗記ウィーク</h1>
      <div class="sw-gaia">${icon(c.forms[1])}</div>
      <p class="sw-line small">列島の主ガイア「社会の力が足りぬ…<br>きみの力で、日本の記憶を取りもどしてくれ！」</p>
      <p class="sw-goal">${SW.START.slice(5).replace('-', '/')}〜${SW.END.slice(5).replace('-', '/')}の7日間<br>目標：<b>${SW.HALF}まい（半分）</b>を覚えよう</p>
      <p class="sw-note small">※ふだんのクエストも進めると、報酬がもらえるよ</p>
      <div class="sw-btns"><button class="btn big gold" id="sw-in">旅立つ！</button><button class="btn" id="sw-later">あとで</button></div></div>`;
  Sound.win && Sound.win();
  const choice = await new Promise(res => {
    ov.querySelector('#sw-in').onclick = () => res('go');
    ov.querySelector('#sw-later').onclick = () => res('later');
  });
  ov.remove();
  document.body.classList.remove('sw-shake');
  showingNews = false;
  if (choice === 'go') { Sound.tap(); go('event'); } else render();
}

SCREENS.event = (el) => {
  if (!SW.active()) { go('home'); return; }
  const n = SW.masteredCount(), qm = SW.questMin(), em = SW.eventMin();
  const nextNeed = SW.MILESTONES.find(m => !S.sw.claimed.includes(m.id));
  const gateMax = SW.MILESTONES[SW.MILESTONES.length - 1].need;
  el.innerHTML = `<div class="sw-wrap">
    <div class="sw-hero"><span class="sw-tag">⚡ 期間限定 あと${SW.daysLeft()}日（〜${SW.END.slice(5).replace('-', '/')}）</span>
      <h2>🗾 日本列島ぐるり暗記ウィーク</h2>
      <div class="sw-bar big"><i style="width:${pct(n, SW.N)}"></i>${SW.MILESTONES.map(m => `<b class="${m.half ? 'half' : ''}" style="left:${pct(m.n, SW.N)}"></b>`).join('')}</div>
      <p>覚えたカード <b class="sw-num">${n}</b> / ${SW.N}　<small>（半分＝${SW.HALF}枚）</small></p></div>
    <div class="card"><h3>🔓 ふだんのクエストも進めよう</h3>
      <div class="sw-bar gate"><i style="width:${pct(Math.min(qm, gateMax), gateMax)}"></i></div>
      <p class="small">今週のふだんのクエスト：<b>${qm}分</b>　${nextNeed ? `（次の報酬は${nextNeed.need}分で受け取れる）` : ''}<br>
      イベントで覚えた枚数に加えて、<b>ふだんのクエストの勉強時間</b>もたまらないと、報酬は受け取れないよ。</p></div>
    <button class="btn big gold wide" id="sw-start">カードにちょうせん！（${SW.ROUND}枚）</button>
    <p class="small muted sw-note">カードの時間は<b>社会の勉強時間</b>に数えるよ（今週${em}分）。でも、ボスは進まないから、ふだんのクエストも忘れずに！</p>
    <div class="card"><h3>🎁 報酬</h3>${SW.MILESTONES.map(m => {
      const ms = SW.milestoneState(m);
      return `<div class="sw-ms ${ms.claimed ? 'done' : ''} ${m.half ? 'half' : ''}">
        <div class="sw-ms-main"><b>${m.n}枚${m.half ? ' ★半分！' : m.n === SW.N ? ' 全部！' : ''}</b><span>${esc(swRewardText(m))}</span>
          <small class="muted">ふだんのクエスト${m.need}分</small></div>
        ${ms.claimable ? `<button class="btn mini gold" data-claim="${m.id}">受け取る</button>` : `<small class="sw-gate">${swGateText(m, ms)}</small>`}</div>`;
    }).join('')}</div>
    <div class="card"><h3>🗺️ ステージ（14のしな）</h3><div class="sw-decks">${SW_DECKS.map((d, i) => {
      const s = SW.deckStat(i);
      return `<div class="sw-deck ${s.done === s.total ? 'clear' : ''}"><span>${esc(d)}</span><b>${s.done}/${s.total}</b><i style="width:${pct(s.done, s.total)}"></i></div>`;
    }).join('')}</div></div>
    <button class="btn wide" id="sw-home">‹ ホームへ</button></div>`;
  $('#sw-start').onclick = () => { Sound.tap(); go('evcards'); };
  $('#sw-home').onclick = () => { Sound.tap(); go('home'); };
  $$('[data-claim]', el).forEach(b => b.onclick = async () => {
    const r = SW.claim(b.dataset.claim);
    if (!r) return;
    Sound.levelup(); FX.confetti(r.m.half ? 220 : 120);
    let extra = '';
    if (r.got) {
      const id = r.got.id;
      extra = `<div class="sw-got">${avatar(id, { size: 96 })}<p><b>${esc(charName(id))}</b> が仲間になった！</p></div>`;
    }
    await modal(`<div class="m-emo gold">${icon('laurel-crown')}</div><h2>${r.m.half ? '半分の記憶をとりもどした！' : '報酬ゲット！'}</h2>
      <div class="rw-big">${esc(swRewardText(r.m))}</div>${extra}<button class="btn gold wide" data-v="ok">やったー！</button>`, { cls: 'shine' });
    render();
  });
};

SCREENS.evcards = (el) => {
  if (!SW.active()) { go('home'); return; }
  const queue = SW.plan(SW.ROUND), total = queue.length;
  const newly = [];
  const wrongOnce = new Set();
  let done = 0, t0 = Date.now();
  const startBal = SW.masteredCount();
  const firstOk = new Set();

  const leave = async () => {
    const r = SW.flushTime();
    if (r && r.events.length) { showingNews = true; await runEvents(r.events); showingNews = false; }
    go('event');
  };

  const next = () => {
    if (!queue.length) return finish();
    const id = queue[0], [deck, q, a] = SW_CARDS[id];
    t0 = Date.now();
    el.innerHTML = `<div class="sw-wrap cards">
      <button class="quiz-back" id="sw-quit">‹ やめる</button>
      <div class="quiz-prog"><i style="width:${pct(done, total)}"></i></div>
      <p class="muted small quiz-no">${done + 1} / ${total} ・ ${esc(SW_DECKS[deck])}</p>
      <div class="sw-card-face" id="sw-face"><div class="sw-q">${esc(q)}</div><div class="sw-a" hidden>${esc(a)}</div><p class="small muted sw-tap">タップして答えを見る</p></div>
      <div class="sw-btns2" hidden><button class="btn big" id="sw-ng">まだ…✗</button><button class="btn big gold" id="sw-ok">覚えてた ✓</button></div></div>`;
    $('#sw-quit').onclick = () => { Sound.tap(); SW.addSeconds((Date.now() - t0) / 1000); leave(); };
    const face = $('#sw-face');
    face.onclick = () => {
      if (!face.querySelector('.sw-a').hidden) return;
      Sound.tap();
      face.classList.add('flip');
      face.querySelector('.sw-a').hidden = false;
      face.querySelector('.sw-tap').hidden = true;
      $('.sw-btns2', el).hidden = false;
    };
    const grade = ok => {
      SW.addSeconds((Date.now() - t0) / 1000);
      const was = SW.isMastered(id);
      SW.answer(id, ok);
      queue.shift();
      if (ok) { Sound.coin(); done++; if (!was) firstOk.add(id); if (!was && SW.isMastered(id)) newly.push(id); }
      else {
        Sound.tap();
        if (!wrongOnce.has(id)) { wrongOnce.add(id); queue.push(id); }   // まちがえたら、最後にもう1回
        else done++;
      }
      next();
    };
    $('#sw-ok').onclick = () => grade(true);
    $('#sw-ng').onclick = () => grade(false);
  };

  const finish = async () => {
    const r = SW.flushTime();
    const n = SW.masteredCount();
    const gain = n - startBal;
    Sound.win && Sound.win(); FX.confetti(80);
    el.innerHTML = `<div class="sw-wrap cards"><h2 class="page-title">おつかれさま！</h2>
      <div class="card sw-result"><p>${gain ? `新しく <b class="sw-num">${gain}</b> 枚 覚えた！` : ''}今日 <b class="sw-num">${firstOk.size}</b> 枚「覚えてた」！</p>
        <p class="small">あした もう一度「覚えてた」と答えると、そのカードは「覚えた」になるよ</p>
        <p class="small">いま ${n} / ${SW.N} 枚（半分まであと${Math.max(0, SW.HALF - n)}枚）</p>
        ${newly.length ? `<ul class="sw-new">${newly.map(i => `<li>${esc(SW_CARDS[i][2])}</li>`).join('')}</ul>` : ''}
        <p class="small muted">「別の日」にもう一度「覚えてた」と答えると、本当に覚えたことになるよ。</p>
        ${r ? `<p class="small">⏱ ${r.minutes}分を社会の勉強時間に記録したよ（ボスはふだんのクエストで！）</p>` : '<p class="small muted">1分たまると社会の勉強時間に記録されるよ</p>'}</div>
      <button class="btn big gold wide" id="sw-again">もう1ラウンド</button>
      <button class="btn wide" id="sw-back">イベントへもどる</button></div>`;
    $('#sw-again').onclick = () => { Sound.tap(); go('evcards'); };
    $('#sw-back').onclick = () => { Sound.tap(); go('event'); };
    if (r && r.events.length) { showingNews = true; await runEvents(r.events); showingNews = false; }
  };

  next();
};
