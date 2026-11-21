'use strict';
// ===== きみ専用ドリル：その子の特徴に合わせて問題を出す =====
// 問題は「タグ（単元）」ごとにまとめてある。答えるたびにタグごとの正答率・速さ・難しさを覚え、
// 次の出題を「苦手」「復習の時期」「最近の講座」「おうちの人の優先教科」に合わせて決める。
// 画面（app.js / parent.js）には依存しない。S（セーブデータ）を引数で受け取る。

const Quiz = (() => {
  const rng = { f: Math.random };   // テストでは差し替える
  const rand = () => rng.f();
  const ri = (a, b) => a + Math.floor(rand() * (b - a + 1));
  const pick = arr => arr[Math.floor(rand() * arr.length)];
  const shuffle = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const gcd = (a, b) => b ? gcd(b, a % b) : a;
  const lcm = (a, b) => a / gcd(a, b) * b;
  const fact = n => n <= 1 ? 1 : n * fact(n - 1);
  const dkey = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const todayKey = () => dkey(new Date());
  const addDays = (key, n) => { const [y, m, d] = key.split('-').map(Number); return dkey(new Date(y, m - 1, d + n)); };
  const num = x => String(Math.round(x * 1e6) / 1e6);

  const LOG_MAX = 400, ITEM_MAX = 300;
  const DAILY_REWARD_SETS = 3;     // ごほうび（経験値）が入るのは1日3セットまで
  const XP_PER_OK = 8;
  const INTERVALS = [0, 1, 3, 7, 14];   // 正解が続いたタグを、次に出すまでの日数（0 = すぐ）

  // ---------- 問題を作る ----------
  // choices を作る：正解 + 間違いやすい数。正解の位置は毎回変える
  function mc(correct, wrongs, fmt = num) {
    const set = [correct];
    for (const w of wrongs) if (w > 0 && !set.includes(w) && set.length < 4) set.push(w);
    let k = 1;
    while (set.length < 4) { const w = correct + k * Math.max(1, Math.round(Math.abs(correct) * 0.1) || 1); if (w > 0 && !set.includes(w)) set.push(w); k = k > 0 ? -k : -k + 1; }
    const order = shuffle(set);
    return { choices: order.map(fmt), a: order.indexOf(correct) };
  }
  function mcText(correct, wrongs) {
    const order = shuffle([correct, ...wrongs.slice(0, 3)]);
    return { choices: order, a: order.indexOf(correct) };
  }

  // 算数は数を変えて何度でも作れる。d = 難しさ（1〜3）
  const GEN = {
    's-keisan': d => {
      if (d === 1) {
        const a = ri(2, 9) / 10, b = ri(2, 9) / 10, ans = Math.round(a * b * 100) / 100;
        return { q: `${a} × ${b} ＝ ？`, ...mc(ans, [ans * 10, ans / 10, Math.round((a + b) * 100) / 100]), x: `${Math.round(a * 10)} × ${Math.round(b * 10)} ＝ ${Math.round(a * b * 100)}。小数点の位置は2つ分で ${ans}` };
      }
      if (d === 2) {
        const p = pick([2, 3, 4, 5, 6]), q = pick([2, 3, 4, 5, 6, 7].filter(v => v !== p)), L = lcm(p, q);
        const n = L / p + L / q, g = gcd(n, L), ans = n / g + '/' + L / g;
        const wrong = [`${1 + 1}/${p + q}`, `${n / g + 1}/${L / g}`, `${n / g}/${L / g + 1}`];
        return { q: `1/${p} ＋ 1/${q} ＝ ？（約分したかたちで）`, ...mcText(ans, wrong.filter(w => w !== ans)), x: `通分して ${L / p}/${L} ＋ ${L / q}/${L} ＝ ${n}/${L}。約分して ${ans}` };
      }
      const b = pick([0.05, 0.15, 0.25, 0.12]), k = ri(2, 9);
      const A = Math.round(b * k * 10 * 100) / 100;
      return { q: `${A} ÷ ${b} ＝ ？`, ...mc(Math.round(A / b), [Math.round(A / b) * 10, Math.round(A / b) / 10 || 1, Math.round(A * b)]), x: `わる数を整数にするために、両方を100倍して ${Math.round(A * 100)} ÷ ${Math.round(b * 100)} ＝ ${Math.round(A / b)}` };
    },
    's-yakubai': d => {
      if (d === 1) {
        const g = pick([2, 3, 4, 5, 6]), x = g * ri(2, 4), y = g * pick([5, 6, 7].filter(v => v * g !== x));
        const G = gcd(x, y);
        return { q: `${x} と ${y} の最大公約数は？`, ...mc(G, [G * 2, Math.max(1, G - 1), lcm(x, y)]), x: `${x}の約数と${y}の約数のうち、共通で最も大きい数は ${G}` };
      }
      if (d === 2) {
        const x = pick([4, 6, 8, 9, 10, 12]), y = pick([6, 8, 9, 10, 15].filter(v => v !== x));
        const L = lcm(x, y);
        return { q: `${x} と ${y} の最小公倍数は？`, ...mc(L, [x * y === L ? L * 2 : x * y, L * 2, gcd(x, y)]), x: `${x}の倍数と${y}の倍数で、共通する最も小さい数は ${L}` };
      }
      const g = pick([3, 4, 6]), x = g * pick([4, 5]), y = g * pick([7, 8, 9]);
      const G = gcd(x, y);
      return { q: `たて ${x}cm、よこ ${y}cm の長方形に、同じ大きさの正方形をすき間なくしきつめます。いちばん大きい正方形の1辺は何cm？`, ...mc(G, [G * 2, Math.max(1, G - 1), x - y > 0 ? x - y : y - x]), x: `${x}と${y}の最大公約数 ＝ ${G}（cm）` };
    },
    's-wariai': d => {
      if (d === 1) {
        const n = pick([200, 300, 400, 500, 800, 1200]), p = pick([10, 20, 25, 30, 40, 60]), ans = n * p / 100;
        return { q: `${n}の ${p}％は？`, ...mc(ans, [n * p / 10, n / p, n - ans]), x: `${n} × ${p / 100} ＝ ${ans}` };
      }
      if (d === 2) {
        const b = pick([20, 40, 50, 60, 80, 120, 200]), p = pick([15, 25, 35, 45, 60, 75, 120].filter(v => b * v % 100 === 0)), a = b * p / 100;
        return { q: `${a} は ${b} の何％？`, ...mc(p, [Math.round(b / a * 100), p + 10, 100 - p]), x: `${a} ÷ ${b} ＝ ${a / b} → ${p}％` };
      }
      const n = pick([2000, 3000, 4000, 5000]), p = pick([10, 20, 30, 40]), ans = n * (100 - p) / 100;
      return { q: `定価 ${n}円の品物を ${p / 10}割引きで売ります。売る値段は？`, ...mc(ans, [n * p / 100, n * (100 + p) / 100, n - p]), x: `${p / 10}割引き ＝ ${100 - p}％の値段なので ${n} × ${(100 - p) / 100} ＝ ${ans}（円）` };
    },
    's-menseki': d => {
      if (d === 1) {
        const b = ri(4, 14), h = ri(3, 12) * 2, ans = b * h / 2;
        return { q: `底辺 ${b}cm、高さ ${h}cm の三角形の面積は？（cm²）`, ...mc(ans, [b * h, b + h, ans / 2]), x: `${b} × ${h} ÷ 2 ＝ ${ans}` };
      }
      if (d === 2) {
        const u = ri(3, 8), l = u + ri(2, 6), h = ri(2, 8) * 2, ans = (u + l) * h / 2;
        return { q: `上底 ${u}cm、下底 ${l}cm、高さ ${h}cm の台形の面積は？（cm²）`, ...mc(ans, [(u + l) * h, u * l * h / 2 | 0, ans + h]), x: `(${u} ＋ ${l}) × ${h} ÷ 2 ＝ ${ans}` };
      }
      const b = ri(4, 12), h = ri(3, 9);
      const S = b * h * (b * h % 2 === 0 ? 1 : 2) / 2;
      const hh = 2 * S / b;
      return { q: `底辺 ${b}cm、面積 ${S}cm² の三角形の高さは？（cm）`, ...mc(hh, [S / b, hh * 2, S * b]), x: `面積 × 2 ÷ 底辺 ＝ ${S} × 2 ÷ ${b} ＝ ${num(hh)}` };
    },
    's-hayasa': d => {
      if (d === 1) {
        const v = pick([60, 70, 80, 90, 120]), t = pick([10, 15, 20, 25, 30]), ans = v * t;
        return { q: `分速 ${v}m で ${t}分歩くと、何m進む？`, ...mc(ans, [v + t, ans / 10, ans * 2]), x: `道のり ＝ 速さ × 時間 ＝ ${v} × ${t} ＝ ${ans}（m）` };
      }
      if (d === 2) {
        const v = pick([60, 80, 100, 120]), t = pick([8, 10, 15, 20, 25]), dist = v * t;
        return { q: `${dist}m の道のりを、分速 ${v}m で進むと何分かかる？`, ...mc(t, [dist * v > 0 ? Math.round(dist / 10) : t + 1, t * 2, v - t > 0 ? v - t : t + 5]), x: `時間 ＝ 道のり ÷ 速さ ＝ ${dist} ÷ ${v} ＝ ${t}（分）` };
      }
      const v = pick([48, 60, 72, 84]), t = pick([15, 20, 25, 35, 40]), ans = v * t / 60;
      return { q: `時速 ${v}km の自動車が ${t}分間に進む道のりは？（km）`, ...mc(ans, [v * t, v * t / 600, v / t]), x: `${t}分 ＝ ${t}/60 時間。${v} × ${t}/60 ＝ ${num(ans)}（km）` };
    },
    's-bawari': d => {
      if (d === 1) {
        const n = pick([3, 4]), ans = fact(n);
        return { q: `${n}人が1列にならぶ、ならび方は何通り？`, ...mc(ans, [n * 2, ans + n, n * n]), x: `${Array.from({ length: n }, (_, i) => n - i).join(' × ')} ＝ ${ans}（通り）` };
      }
      if (d === 2) {
        const n = pick([5, 6]), ans = n * (n - 1);
        return { q: `${n}人の中から、会長と副会長を1人ずつ選ぶ選び方は何通り？`, ...mc(ans, [n * (n - 1) / 2, n + n - 1, n * n]), x: `会長は${n}通り、副会長は残り${n - 1}通り。${n} × ${n - 1} ＝ ${ans}（通り）` };
      }
      const n = pick([5, 6, 7]), ans = n * (n - 1) / 2;
      return { q: `${n}人の中から、そうじ当番を2人選ぶ選び方は何通り？（順番は関係なし）`, ...mc(ans, [n * (n - 1), n + (n - 1), ans + n]), x: `ならべると ${n} × ${n - 1}、順番は関係ないので2でわって ${ans}（通り）` };
    },
  };

  // タグの情報。kw = 講座の内容にこの語があれば、最近その単元を学んだとみなす
  const TAGS = {
    's-keisan':  { name: '小数・分数の計算', subj: 'sansu', kw: ['計算'] },
    's-yakubai': { name: '倍数と約数',       subj: 'sansu', kw: ['倍数', '約数', '素因数'] },
    's-wariai':  { name: '割合',             subj: 'sansu', kw: ['割合', '売買損益', '濃さ'] },
    's-menseki': { name: '面積',             subj: 'sansu', kw: ['面積', '平面図形'] },
    's-hayasa':  { name: '速さ',             subj: 'sansu', kw: ['速さ', '旅人算', '流水算', '通過算'] },
    's-bawari':  { name: '場合の数',         subj: 'sansu', kw: ['場合の数'] },
    'k-yomi':    { name: '漢字の読み',       subj: 'kokugo' },
    'k-jukugo':  { name: '四字熟語',         subj: 'kokugo' },
    'k-taigi':   { name: '対義語',           subj: 'kokugo' },
    'k-kanyo':   { name: '慣用句',           subj: 'kokugo' },
    'r-seibutsu': { name: '生き物・植物',    subj: 'rika' },
    'r-butsuri': { name: '力・電気',         subj: 'rika' },
    'r-chigaku': { name: '天気・川・星',     subj: 'rika' },
    'r-kagaku':  { name: 'ものの溶け方',     subj: 'rika' },
    'sh-chiri':  { name: '日本の地理',       subj: 'shakai' },
    'sh-rekishi': { name: '歴史',            subj: 'shakai' },
    'sh-komin':  { name: '政治・憲法',       subj: 'shakai' },
    'e-tango':   { name: '英単語',           subj: 'eigo' },
  };

  // 暗記系の問題（[タグ, 難しさ, 問題, 正解, [まちがい3つ], 解説]）
  const BANK_ROWS = [
    ['k-yomi', 1, '「貯金」の読みは？', 'ちょきん', ['ちょうきん', 'ためきん', 'ちょきんん'], ''],
    ['k-yomi', 1, '「周囲」の読みは？', 'しゅうい', ['しゅうかこ', 'まわりい', 'しゅうち'], ''],
    ['k-yomi', 1, '「辞典」の読みは？', 'じてん', ['ことてん', 'じでん', 'しでん'], ''],
    ['k-yomi', 1, '「勇気」の読みは？', 'ゆうき', ['ようき', 'ゆうぎ', 'いさき'], ''],
    ['k-yomi', 2, '「規則」の読みは？', 'きそく', ['きぞく', 'きせい', 'ぎそく'], ''],
    ['k-yomi', 2, '「提案」の読みは？', 'ていあん', ['てあん', 'ていえん', 'だいあん'], ''],
    ['k-yomi', 2, '「設備」の読みは？', 'せつび', ['せっぴ', 'せつべ', 'せいび'], ''],
    ['k-yomi', 3, '「興味」の読みは？', 'きょうみ', ['こうみ', 'きょみ', 'きょうび'], ''],
    ['k-jukugo', 1, '十人（　）色　に入る漢字は？', '十', ['百', '千', '万'], '十人十色＝人によって考えや好みがちがうこと'],
    ['k-jukugo', 1, '異口（　）音　に入る漢字は？', '同', ['動', '道', '堂'], '異口同音＝みんなが同じことを言うこと'],
    ['k-jukugo', 2, '以心（　）心　に入る漢字は？', '伝', ['電', '天', '典'], '以心伝心＝言わなくても気持ちが通じること'],
    ['k-jukugo', 2, '自画（　）賛　に入る漢字は？', '自', ['児', '事', '字'], '自画自賛＝自分で自分をほめること'],
    ['k-jukugo', 3, '針小（　）大　に入る漢字は？', '棒', ['暴', '報', '防'], '針小棒大＝小さなことを大げさに言うこと'],
    ['k-jukugo', 3, '一日（　）秋　に入る漢字は？', '千', ['先', '線', '選'], '一日千秋＝とても待ち遠しいこと'],
    ['k-taigi', 1, '「増加」の反対の意味の言葉は？', '減少', ['低下', '縮小', '削除'], ''],
    ['k-taigi', 1, '「成功」の反対の意味の言葉は？', '失敗', ['失礼', '失望', '失業'], ''],
    ['k-taigi', 2, '「原因」の反対の意味の言葉は？', '結果', ['結論', '理由', '成果'], ''],
    ['k-taigi', 2, '「勝利」の反対の意味の言葉は？', '敗北', ['勝負', '降参', '休戦'], ''],
    ['k-taigi', 3, '「分解」の反対の意味の言葉は？', '合成', ['分離', '分割', '解決'], ''],
    ['k-kanyo', 1, '「顔が広い」の意味は？', '知り合いが多い', ['顔が大きい', 'はずかしがらない', '自まんする'], ''],
    ['k-kanyo', 2, '「耳が痛い」の意味は？', '欠点を言われてつらい', ['耳がよく聞こえない', '大きな音がする', 'うわさを聞いた'], ''],
    ['k-kanyo', 2, '「鼻が高い」の意味は？', '得意になる', ['においに敏感', 'かぜをひく', 'はずかしい'], ''],
    ['k-kanyo', 3, '「根も葉もない」の意味は？', '何の根拠もない', ['とても小さい', '元気がない', 'すっかり枯れた'], ''],
    ['k-kanyo', 3, '「手をやく」の意味は？', 'もてあます', ['手伝う', 'けがをする', '料理をする'], ''],
    ['r-seibutsu', 1, '植物が日光を受けて、でんぷんなどの養分をつくるはたらきは？', '光合成', ['呼吸', '蒸散', '発芽'], ''],
    ['r-seibutsu', 1, '種子が発芽するのに必要ない条件は？', '光', ['水', '空気', '適当な温度'], 'インゲンマメなどの発芽に光は必要ない'],
    ['r-seibutsu', 2, 'メダカのおすの特徴は？', 'しりびれが平行四辺形に近い', ['しりびれが三角形に近い', 'せびれに切れこみがない', 'はらがふくらんでいる'], 'おすはせびれに切れこみ、しりびれが平行四辺形。めすはしりびれが三角形に近い'],
    ['r-butsuri', 1, 'ふりこが1往復する時間（周期）を変えるものは？', 'ふりこの長さ', ['おもりの重さ', 'ふれはば', '糸の色'], 'おもりの重さやふれはばを変えても周期は変わらない'],
    ['r-butsuri', 2, '電磁石を強くする方法は？', 'コイルのまき数を増やす', ['鉄しんを細くする', '電池を1個にへらす', 'エナメル線を短くする'], ''],
    ['r-chigaku', 1, '夏の大三角をつくる星でないものは？', 'シリウス', ['ベガ', 'デネブ', 'アルタイル'], 'シリウスは冬の大三角の星'],
    ['r-chigaku', 2, '曲がって流れる川の、外側の岸のようすは？', '流れが速く、岸がけずられる', ['流れがおそく、土がたまる', '流れが速く、土がたまる', '流れがおそく、岸がけずられる'], ''],
    ['r-kagaku', 2, '水の温度を上げると、とける量が大きく増えるのは？', 'ミョウバン', ['食塩', 'どちらも変わらない', 'どちらも減る'], '食塩は水の温度を変えてもとける量がほとんど変わらない'],
    ['sh-chiri', 1, '日本でいちばん面積が大きい都道府県は？', '北海道', ['岩手県', '長野県', '福島県'], ''],
    ['sh-chiri', 1, '日本でいちばん大きい湖は？', '琵琶湖', ['霞ケ浦', '浜名湖', 'サロマ湖'], ''],
    ['sh-chiri', 2, '愛媛県の県庁所在地は？', '松山市', ['高松市', '松江市', '松本市'], ''],
    ['sh-chiri', 2, '日本でいちばん長い川は？', '信濃川', ['利根川', '石狩川', '北上川'], ''],
    ['sh-chiri', 3, '米の収穫量が全国で最も多い県（近年）は？', '新潟県', ['秋田県', '北海道', '山形県'], ''],
    ['sh-rekishi', 1, '江戸幕府を開いた人物は？', '徳川家康', ['織田信長', '豊臣秀吉', '足利尊氏'], ''],
    ['sh-rekishi', 1, '鎌倉幕府を開いた人物は？', '源頼朝', ['源義経', '平清盛', '北条時宗'], ''],
    ['sh-rekishi', 2, '十七条の憲法を定めた人物は？', '聖徳太子', ['中大兄皇子', '天智天皇', '蘇我馬子'], ''],
    ['sh-rekishi', 2, '天下統一をほぼ完成させた戦国武将は？', '豊臣秀吉', ['織田信長', '武田信玄', '明智光秀'], ''],
    ['sh-komin', 1, '国会のおもな仕事は？', '法律をつくる', ['裁判をする', '法律を実行する', '外国と戦争する'], ''],
    ['sh-komin', 2, '日本国憲法の三つの原則でないものは？', '天皇主権', ['国民主権', '平和主義', '基本的人権の尊重'], '主権は国民にある（国民主権）'],
    ['sh-komin', 2, '国会の二つの議院は？', '衆議院と参議院', ['貴族院と衆議院', '参議院と元老院', '元老院と貴族院'], ''],
    ['e-tango', 1, '「図書館」を英語でいうと？', 'library', ['kitchen', 'hospital', 'station'], ''],
    ['e-tango', 1, 'Tuesday は何曜日？', '火曜日', ['月曜日', '水曜日', '木曜日'], ''],
    ['e-tango', 2, '「3月」を英語でいうと？', 'March', ['May', 'June', 'August'], ''],
    ['e-tango', 2, '「台所」を英語でいうと？', 'kitchen', ['library', 'bedroom', 'garden'], ''],
    ['e-tango', 3, '「医者」を英語でいうと？', 'doctor', ['teacher', 'dentist', 'farmer'], ''],
  ];
  const BANK = BANK_ROWS.map(([tag, d, q, ans, wrongs, x], i) => ({ id: tag + '#' + i, tag, d, q, ans, wrongs, x }));
  const BANK_BY_ID = Object.fromEntries(BANK.map(b => [b.id, b]));

  function fromBank(b) {
    const m = mcText(b.ans, b.wrongs);
    return { id: b.id, tag: b.tag, d: b.d, q: b.q, ...m, x: b.x || '' };
  }
  function makeGen(tag, d) {
    const g = GEN[tag](d);
    return { id: tag + '~' + d + '~' + Math.floor(rand() * 1e9), tag, d, ...g };
  }

  // ---------- その子の記録 ----------
  function blankQuiz() { return { v: 1, tags: {}, items: {}, log: [], daily: { date: '', sets: 0 } }; }
  function qs(S) { if (!S.quiz) S.quiz = blankQuiz(); return S.quiz; }

  // 答えを1つ記録する。タグの難しさ・次に出す時期もここで決める
  function record(S, q, ok, ms, at = Date.now()) {
    const z = qs(S), day = dkey(new Date(at));
    const t = z.tags[q.tag] || (z.tags[q.tag] = { n: 0, ok: 0, ms: 0, lv: 1, box: 0, recent: '', last: day, due: day });
    ms = Math.max(1000, Math.min(120000, ms | 0));
    t.n++; if (ok) t.ok++;
    t.ms = t.ms ? Math.round(t.ms * 0.7 + ms * 0.3) : ms;
    t.recent = (t.recent + (ok ? '1' : '0')).slice(-6);
    t.last = day;
    t.box = ok ? Math.min(INTERVALS.length - 1, t.box + 1) : 0;
    t.due = addDays(day, INTERVALS[t.box]);
    let lvChange = 0;
    if (t.recent.slice(-4) === '1111' && t.lv < 3) { t.lv++; t.recent = ''; lvChange = 1; }
    else if (t.recent.slice(-3).split('').filter(c => c === '0').length >= 2 && t.lv > 1) { t.lv--; t.recent = ''; lvChange = -1; }
    if (!q.id.includes('~')) {   // 暗記系：同じ問題を間違えたら、近いうちにもう一度
      z.items[q.id] = { ok, day, due: ok ? addDays(day, 7) : addDays(day, 1) };
      const ks = Object.keys(z.items);
      if (ks.length > ITEM_MAX) ks.sort((a, b) => z.items[a].day.localeCompare(z.items[b].day)).slice(0, ks.length - ITEM_MAX).forEach(k => delete z.items[k]);
    }
    z.log.push({ t: at, id: q.id, tag: q.tag, d: q.d, ok: ok ? 1 : 0, ms });
    if (z.log.length > LOG_MAX) z.log.splice(0, z.log.length - LOG_MAX);
    return { lvChange, lv: t.lv };
  }

  // 2つの端末の記録を合わせる（答えた数が多いほうのタグ記録を残し、ログは両方残す）
  function merge(a, b) {
    const out = blankQuiz();
    const A = a || blankQuiz(), B = b || blankQuiz();
    for (const k of new Set([...Object.keys(A.tags), ...Object.keys(B.tags)])) {
      const x = A.tags[k], y = B.tags[k];
      out.tags[k] = !x ? y : !y ? x : (y.n > x.n ? y : x);
    }
    for (const k of new Set([...Object.keys(A.items), ...Object.keys(B.items)])) {
      const x = A.items[k], y = B.items[k];
      out.items[k] = !x ? y : !y ? x : (y.day >= x.day ? y : x);
    }
    const seen = new Set(), logs = [];
    for (const e of [...A.log, ...B.log]) { const key = e.t + '|' + e.id; if (!seen.has(key)) { seen.add(key); logs.push(e); } }
    out.log = logs.sort((x, y) => x.t - y.t).slice(-LOG_MAX);
    out.daily = (A.daily.date >= B.daily.date ? A : B).daily;
    return out;
  }

  // ---------- 特徴を読み取る ----------
  const smooth = (ok, n) => (ok + 2) / (n + 3);   // 少ない回数に引っぱられすぎないよう、「3問中2問正解」を足して見る
  const period = h => h < 11 ? '朝' : h < 17 ? '昼〜夕方' : '夜';

  function profile(S) {
    const z = qs(S);
    const tags = Object.entries(z.tags).map(([tag, t]) => {
      const info = TAGS[tag] || { name: tag, subj: 'other' };
      const acc = t.n ? t.ok / t.n : 0, sm = smooth(t.ok, t.n);
      let status = 'まだ少ない';
      if (t.n >= 4) status = sm >= 0.8 ? '得意' : sm < 0.55 ? '苦手' : 'ふつう';
      return { tag, name: info.name, subj: info.subj, n: t.n, acc, sm, lv: t.lv, sec: Math.round(t.ms / 100) / 10, status };
    });
    const log = z.log;
    const total = log.length, okN = log.reduce((a, e) => a + e.ok, 0);
    const recent = log.slice(-20), prev = log.slice(-40, -20);
    const rAcc = recent.length ? recent.reduce((a, e) => a + e.ok, 0) / recent.length : 0;
    const pAcc = prev.length ? prev.reduce((a, e) => a + e.ok, 0) / prev.length : null;
    const byPeriod = {};
    for (const e of log) { const p = period(new Date(e.t).getHours()); const o = byPeriod[p] || (byPeriod[p] = { n: 0, ok: 0 }); o.n++; o.ok += e.ok; }
    const periods = Object.entries(byPeriod).filter(([, o]) => o.n >= 8).map(([p, o]) => ({ p, acc: o.ok / o.n, n: o.n })).sort((a, b) => b.acc - a.acc);
    const avgSec = total ? Math.round(log.slice(-40).reduce((a, e) => a + e.ms, 0) / Math.min(40, total) / 100) / 10 : 0;
    const weak = tags.filter(t => t.status === '苦手').sort((a, b) => a.sm - b.sm);
    const strong = tags.filter(t => t.status === '得意').sort((a, b) => b.sm - a.sm);
    const slow = tags.filter(t => t.n >= 4 && t.sec > Math.max(25, avgSec * 1.5)).sort((a, b) => b.sec - a.sec);
    return { total, acc: total ? okN / total : 0, recentAcc: rAcc, trend: pAcc == null ? null : rAcc - pAcc, avgSec, tags, weak, strong, slow,
      bestPeriod: periods.length >= 2 && periods[0].acc - periods[periods.length - 1].acc >= 0.15 ? periods[0] : null,
      setSize: setSize(S) };
  }

  // 1セットの問題数：正答率が高くて速ければ多め、苦戦しているか時間がかかっているなら少なめ
  function setSize(S) {
    const log = qs(S).log.slice(-20);
    if (log.length < 8) return 5;
    const acc = log.reduce((a, e) => a + e.ok, 0) / log.length, sec = log.reduce((a, e) => a + e.ms, 0) / log.length / 1000;
    let n = 5;
    if (acc >= 0.85 && sec < 20) n = 8;
    else if (acc >= 0.8 && sec < 30) n = 6;
    if (acc < 0.5 || sec > 45) n = 4;
    return n;
  }

  // おうちの人向けのひとこと
  function advice(S) {
    const p = profile(S), out = [];
    if (p.total < 10) return ['まだデータが少ないので、ドリルを10問ほど解くと特徴が見えてきます。'];
    if (p.weak.length) out.push(`「${p.weak.slice(0, 3).map(t => t.name).join('」「')}」が苦手です（正答率${Math.round(p.weak[0].acc * 100)}%〜）。次のドリルから重点的に出します。`);
    if (p.strong.length) out.push(`「${p.strong.slice(0, 3).map(t => t.name).join('」「')}」は得意です。出題を少なめにして、むずかしい問題に進めています。`);
    if (p.slow.length) out.push(`「${p.slow[0].name}」は、答えるまでに時間がかかっています（1問${Math.round(p.slow[0].sec)}秒）。考え方をいっしょに確認すると効果的です。`);
    if (p.bestPeriod) out.push(`${p.bestPeriod.p}に解いたときの正答率がいちばん高いです（${Math.round(p.bestPeriod.acc * 100)}%）。`);
    if (p.trend != null && p.trend >= 0.15) out.push('最近の正答率が上がっています。ほめてあげてください。');
    if (p.trend != null && p.trend <= -0.2) out.push('最近の正答率が下がっています。疲れや新しい単元で苦戦していないか、声をかけてみてください。');
    return out.length ? out : ['バランスよく解けています。'];
  }

  // ---------- 出題を決める ----------
  // 講座チェックを最近した単元か（直近14日）
  function recentUnits(S, day) {
    const since = addDays(day, -14), out = [];
    for (const s of S.sessions || []) {
      if (s.course && s.date >= since && s.review !== 'ng' && typeof COURSE_BY_ID !== 'undefined' && COURSE_BY_ID[s.course]) out.push(COURSE_BY_ID[s.course].desc);
    }
    return out;
  }

  // タグごとの「出したい度」。理由もいっしょに返す（画面に出す）
  function weights(S, subject, day = todayKey()) {
    const z = qs(S), units = recentUnits(S, day), prio = (S.parent && S.parent.priority) || [];
    const res = [];
    for (const [tag, info] of Object.entries(TAGS)) {
      if (subject && info.subj !== subject) continue;
      const t = z.tags[tag];
      const reasons = [];
      let w = 0.15;
      if (!t) { w += 0.25; reasons.push('はじめて'); }
      else {
        const weak = 1 - smooth(t.ok, t.n);
        w += 1.4 * weak;
        if (t.n >= 4 && smooth(t.ok, t.n) < 0.55) reasons.push('苦手');
        if (t.due <= day && t.box < 3) { w += 0.5; reasons.push('復習のじき'); }
        if (t.n < 4) { w += 0.2; }
        if (t.n >= 10 && smooth(t.ok, t.n) >= 0.9 && t.lv === 3) w *= 0.6;
      }
      if (info.kw && units.some(u => info.kw.some(k => u.includes(k)))) { w *= 1.6; reasons.push('最近の講座'); }
      if (prio.includes(info.subj)) { w *= 1.5; reasons.push('優先教科'); }
      res.push({ tag, w: w * w, reasons });   // 2乗で、苦手なタグにはっきり偏らせる
    }
    return res;
  }

  function candidateFor(S, tag, avoid, day) {
    const z = qs(S), t = z.tags[tag], lv = t ? t.lv : 1;
    if (GEN[tag]) return makeGen(tag, lv);
    const pool = BANK.filter(b => b.tag === tag && !avoid.has(b.id));
    if (!pool.length) return null;
    // 間違えて復習のじきが来た問題を先に。次に、まだ解いていない問題を、今の難しさに近い順で。最近正解した問題は後回し
    const score = b => {
      const it = z.items[b.id];
      let s = Math.abs(b.d - lv) * 2 + rand() * 0.9;
      if (it && !it.ok && it.due <= day) s -= 4;
      else if (it && it.ok && it.due > day) s += 6;
      else if (!it) s -= 1;
      return s;
    };
    return fromBank(pool.slice().sort((a, b) => score(a) - score(b))[0]);
  }

  // きょうの1セット。最初と最後は得意なタグから出して、自信をつけて終わる
  function plan(S, { subject = null, n = null, day = todayKey() } = {}) {
    const z = qs(S);
    n = n || setSize(S);
    const ws = weights(S, subject, day);
    const used = {}, avoid = new Set(), out = [];
    const strongTags = Object.entries(z.tags).filter(([tag, t]) => t.n >= 4 && smooth(t.ok, t.n) >= 0.75 && (!subject || (TAGS[tag] || {}).subj === subject)).map(([tag]) => tag);
    const take = tag => {
      const q = candidateFor(S, tag, avoid, day);
      if (!q) return false;
      avoid.add(q.id); used[tag] = (used[tag] || 0) + 1;
      out.push(q); return true;
    };
    const rw = Object.fromEntries(ws.map(w => [w.tag, w.reasons]));
    // 最初の1問は得意なものでウォームアップ（得意なタグがまだなければ、いちばん出したくないタグ）
    const warm = strongTags.length ? pick(strongTags) : ws.slice().sort((a, b) => a.w - b.w)[0].tag;
    take(warm);
    while (out.length < n - (n >= 6 && strongTags.length ? 1 : 0)) {
      const live = ws.filter(w => (used[w.tag] || 0) < (ws.length <= 2 ? 99 : 2));
      if (!live.length) break;
      let r = rand() * live.reduce((a, w) => a + w.w * ((used[w.tag] || 0) ? 0.4 : 1), 0), chosen = live[live.length - 1];
      for (const w of live) { r -= w.w * ((used[w.tag] || 0) ? 0.4 : 1); if (r <= 0) { chosen = w; break; } }
      if (!take(chosen.tag)) { ws.splice(ws.indexOf(ws.find(w => w.tag === chosen.tag)), 1); if (!ws.length) break; }
    }
    if (n >= 6 && strongTags.length && out.length < n) take(pick(strongTags));
    return out.map(q => ({ ...q, why: rw[q.tag] || [] }));
  }

  // 今日の重点（ドリルを始める前に見せる）
  function focus(S, subject = null) {
    const day = todayKey();
    const ws = weights(S, subject, day).sort((a, b) => b.w - a.w).slice(0, 3);
    return ws.map(w => ({ tag: w.tag, name: TAGS[w.tag].name, subj: TAGS[w.tag].subj, reasons: w.reasons }));
  }

  // ごほうび：正解数に応じた経験値。ごほうびの入るのは1日3セットまで
  function rewardFor(S, results) {
    const z = qs(S), day = todayKey();
    if (z.daily.date !== day) z.daily = { date: day, sets: 0 };
    const okN = results.filter(r => r.ok).length;
    const paid = z.daily.sets < DAILY_REWARD_SETS;
    const xp = paid ? okN * XP_PER_OK + (okN === results.length && results.length >= 4 ? 10 : 0) : 0;
    z.daily.sets++;
    return { okN, xp, paid, left: Math.max(0, DAILY_REWARD_SETS - z.daily.sets) };
  }

  return { rng, TAGS, GEN, BANK, BANK_BY_ID, blankQuiz, record, merge, profile, advice, plan, focus, setSize, weights, rewardFor, DAILY_REWARD_SETS };
})();
