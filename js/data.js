'use strict';
// ===== ゲームのマスターデータ =====

const SUBJECTS = [
  { id: 'sansu',  name: '算数',   icon: '🔢', color: '#ff6b3d', el: 'fire' },
  { id: 'kokugo', name: '国語',   icon: '📖', color: '#3ddc84', el: 'flower' },
  { id: 'rika',   name: '理科',   icon: '🔬', color: '#b26bff', el: 'mystery' },
  { id: 'shakai', name: '社会',   icon: '🗾', color: '#e0a243', el: 'earth' },
  { id: 'eigo',   name: '英語',   icon: '🔤', color: '#3db4ff', el: 'water' },
  { id: 'other',  name: 'その他', icon: '✏️', color: '#ffd84d', el: 'light' },
];
const SUBJECT_BY_ID = Object.fromEntries(SUBJECTS.map(s => [s.id, s]));

// 属性（id は保存データとの互換のため変えない）
const ELEMENTS = {
  fire:    { name: '炎',   icon: '🔥', color: '#ff6b3d' },
  flower:  { name: '森',   icon: '🌿', color: '#3ddc84' },
  mystery: { name: '雷',   icon: '⚡', color: '#b26bff' },
  earth:   { name: '大地', icon: '⛰️', color: '#e0a243' },
  water:   { name: '水',   icon: '💧', color: '#3db4ff' },
  light:   { name: '光',   icon: '✨', color: '#ffd84d' },
};
const SUBJECT_BY_EL = Object.fromEntries(SUBJECTS.map(s => [s.el, s]));

const RARITY = {
  1: { stars: '★',   name: 'コモン',     base: 5,  color: '#9aa7c2' },
  2: { stars: '★★',  name: 'レア',       base: 9,  color: '#5aa9ff' },
  3: { stars: '★★★', name: 'レジェンド', base: 14, color: '#ffc83d' },
};

// forms は js/icons.js のアイコン名
const CHARACTERS = [
  { id: 'flare',   el: 'fire',    r: 1, forms: ['fox-head', 'wolf-head', 'wolf-howl'], names: ['フレアフォックス', 'ブレイズウルフ', 'インフェルノウルフ'] },
  { id: 'fang',    el: 'fire',    r: 2, forms: ['saber-toothed-cat-head', 'tiger-head', 'lion'], names: ['サーベルファング', 'バーンタイガー', 'レグルス'] },
  { id: 'drake',   el: 'fire',    r: 3, forms: ['wyvern', 'dragon-head', 'spiked-dragon-head'], names: ['ワイバーン', 'ドラグーン', 'イグニス・ドラゴン'] },
  { id: 'vine',    el: 'flower',  r: 1, forms: ['carnivorous-plant', 'tree-face', 'ent-mouth'], names: ['ヴァインファング', 'トレント', 'エルダー・トレント'] },
  { id: 'stag',    el: 'flower',  r: 2, forms: ['deer-head', 'stag-head', 'centaur'], names: ['フォレストディア', 'グランドスタッグ', 'ケンタウロス'] },
  { id: 'griffin', el: 'flower',  r: 3, forms: ['owl', 'eagle-head', 'griffin-symbol'], names: ['ミネルヴァ', 'ストームイーグル', 'グリフォン'] },
  { id: 'fin',     el: 'water',   r: 1, forms: ['shark-fin', 'shark-jaws', 'sperm-whale'], names: ['シャークフィン', 'メガロドン', 'リヴァイアサン'] },
  { id: 'abyss',   el: 'water',   r: 2, forms: ['fish-monster', 'angler-fish', 'sea-serpent'], names: ['ディープフィッシュ', 'アビスアングラー', 'シーサーペント'] },
  { id: 'hydra',   el: 'water',   r: 3, forms: ['seahorse', 'sea-dragon', 'hydra'], names: ['シーホース', 'シードラゴン', 'ヒュドラ'] },
  { id: 'bot',     el: 'mystery', r: 1, forms: ['spider-bot', 'vintage-robot', 'robot-golem'], names: ['スパイダーボット', 'ギアソルジャー', 'アイアンゴーレム'] },
  { id: 'cyborg',  el: 'mystery', r: 2, forms: ['android-mask', 'cyborg-face', 'battle-mech'], names: ['アンドロイド', 'サイボーグ', 'バトルメック'] },
  { id: 'mech',    el: 'mystery', r: 3, forms: ['mecha-head', 'megabot', 'missile-mech'], names: ['メカヘッド', 'メガボット', 'オメガ・メック'] },
  { id: 'bull',    el: 'earth',   r: 1, forms: ['boar', 'bull', 'minotaur'], names: ['ワイルドボア', 'バイソン', 'ミノタウロス'] },
  { id: 'golem',   el: 'earth',   r: 2, forms: ['golem-head', 'rock-golem', 'metal-golem-head'], names: ['ゴーレム', 'ロックゴーレム', 'ミスリルゴーレム'] },
  { id: 'rex',     el: 'earth',   r: 3, forms: ['triceratops-head', 'mammoth', 'dinosaur-rex'], names: ['トリケラトプス', 'マンモス', 'キング・レックス'] },
  { id: 'knight',  el: 'light',   r: 1, forms: ['centurion-helmet', 'black-knight-helm', 'mounted-knight'], names: ['ソルジャー', 'ナイト', 'パラディン'] },
  { id: 'shinobi', el: 'light',   r: 2, forms: ['ninja-head', 'ninja-armor', 'ninja-heroic-stance'], names: ['シノビ', 'カゲムシャ', '影の大将'] },
  { id: 'pegasus', el: 'light',   r: 3, forms: ['horse-head', 'unicorn', 'pegasus'], names: ['ホワイトホース', 'ユニコーン', 'セイント・ペガサス'] },
];
const CHAR_BY_ID = Object.fromEntries(CHARACTERS.map(c => [c.id, c]));
// 旧バージョン（絵文字キャラ）の保存データを引き継ぐための対応表
const OLD_CHAR_IDS = {
  piyo: 'flare', leo: 'fang', dragon: 'drake', tane: 'vine', chou: 'stag', peacock: 'griffin',
  ebi: 'fin', shark: 'abyss', whale: 'hydra', robo: 'bot', alien: 'cyborg', unicorn: 'mech',
  hamu: 'bull', mammoth: 'golem', dino: 'rex', kuma: 'knight', wan: 'shinobi', star: 'pegasus',
};
const STARTERS = ['flare', 'vine', 'fin'];
const EVOLVE_LV = [10, 25];   // Lv10で第2形態、Lv25で第3形態
const CHAR_MAX_LV = 40;

// ===== 世界一周の冒険 =====
// 地域ごとに6つの街を回る（6教科を1回ずつ）。最後の街はボス。
// subject: その街で弱点になる教科 / why: その理由 / e: 守護モンスターのアイコン
// lab: 地図上の街名ラベルの位置 [dx, dy, text-anchor]
const REGIONS = [
  { id: 'usa',    name: 'アメリカ',   flag: '🇺🇸', bg: ['#1c3a6e', '#0a1430'], bbox: [-125, 24, -66, 50], main: [840] },
  { id: 'europe', name: 'ヨーロッパ', flag: '🇪🇺', bg: ['#2a2f6a', '#0e1030'], bbox: [-11, 35, 30, 58], main: [] },
  { id: 'mideast', name: '中東',      flag: '🕌', bg: ['#6a4a1a', '#1e1206'], bbox: [24, 20, 60, 47], main: [] },
  { id: 'asia',   name: 'アジア',     flag: '🌏', bg: ['#6a1a2a', '#1a0610'], bbox: [68, -2, 145, 47], main: [392] },
];
const REGION_BY_ID = Object.fromEntries(REGIONS.map(r => [r.id, r]));

const CITIES = [
  // ---- アメリカ ----
  { id: 'la', region: 'usa', name: 'ロサンゼルス', country: 'アメリカ・カリフォルニア州', lat: 34.05, lon: -118.24, lab: [6, 4, 'start'],
    subject: 'other', why: '映画や音楽など、芸術とエンタメの街', e: 'rattlesnake', n: 'デザート・ラトラー',
    facts: ['ハリウッドは世界の映画づくりの中心地。丘の上の「HOLLYWOOD」の看板は1923年に作られ、はじめは「HOLLYWOODLAND」だった。',
            'アメリカで2番目に人口が多い都市。一年中雨が少なく晴れの日が多いため、屋外での映画撮影に向いていた。'] },
  { id: 'houston', region: 'usa', name: 'ヒューストン', country: 'アメリカ・テキサス州', lat: 29.76, lon: -95.37, lab: [0, 16, 'middle'],
    subject: 'rika', why: 'NASAの宇宙センターがある宇宙開発の街', e: 'alien-bug', n: '宇宙怪虫ゼノバグ',
    facts: ['NASAのジョンソン宇宙センターがあり、宇宙飛行士の訓練や、宇宙船の飛行を地上から見守る管制が行われている。',
            '1969年、月に着陸したアポロ11号からは「ヒューストン、こちら静かの基地。イーグルは着陸した」という有名な通信が届いた。'] },
  { id: 'dc', region: 'usa', name: 'ワシントンD.C.', country: 'アメリカの首都', lat: 38.91, lon: -77.04, lab: [-4, 17, 'end'],
    subject: 'kokugo', why: '世界最大級の図書館がある本の都', e: 'evil-book', n: '禁書の魔導書',
    facts: ['アメリカ議会図書館は世界最大級の図書館で、本や地図、楽譜など1億7000万点以上の資料がある。',
            'アメリカの首都で、大統領が住むホワイトハウスもこの街にある。どの州にも属さない特別な地区だ。'] },
  { id: 'phila', region: 'usa', name: 'フィラデルフィア', country: 'アメリカ・ペンシルベニア州', lat: 39.95, lon: -75.17, lab: [-6, -2, 'end'],
    subject: 'shakai', why: 'アメリカ独立の舞台になった歴史の街', e: 'floating-ghost', n: '独立戦争の亡霊',
    facts: ['1776年7月4日、この街の独立記念館で「独立宣言」が採択された。今も7月4日はアメリカの独立記念日だ。',
            '1787年にはアメリカ合衆国憲法もここで作られた。ひびの入った「自由の鐘」は独立の象徴として大切に保存されている。'] },
  { id: 'boston', region: 'usa', name: 'マサチューセッツ', country: 'アメリカ・ボストン／ケンブリッジ', lat: 42.36, lon: -71.06, lab: [-2, -8, 'end'],
    subject: 'sansu', why: 'MITがある、数学と科学の学問の街', e: 'tracked-robot', n: '工科大ロボ・ガーディアン',
    facts: ['ボストンの川向かいのケンブリッジ市には、数学や科学で世界トップクラスのマサチューセッツ工科大学（MIT）がある。',
            '同じケンブリッジ市には、1636年創立でアメリカ最古の大学、ハーバード大学もある。世界中から学生が集まる学問の街だ。'] },
  { id: 'nyc', region: 'usa', name: 'ニューヨーク', country: 'アメリカ・ニューヨーク州', lat: 40.71, lon: -74.01, lab: [0, 18, 'middle'], boss: true,
    subject: 'eigo', why: '世界中から人と言葉が集まる国際都市', e: 'gorilla', n: '摩天楼の巨猿',
    facts: ['自由の女神は1886年、アメリカ独立100周年を記念してフランスから贈られた。右手のたいまつまでの高さは約46m。',
            '国際連合（国連）の本部がある。800以上の言語が話されているといわれる、世界で最も多くの言葉が集まる都市の一つだ。'] },
  // ---- ヨーロッパ ----
  { id: 'london', region: 'europe', name: 'ロンドン', country: 'イギリス', lat: 51.51, lon: -0.13, lab: [-6, -4, 'end'],
    subject: 'eigo', why: '英語が生まれた国、イギリスの首都', e: 'raven', n: 'ロンドン塔のレイヴン',
    facts: ['英語はもともとイギリスで生まれた言葉。今では世界で最も多くの人が学んでいる言語になった。',
            'ロンドン塔では、カラスがいなくなると国が滅びるという言い伝えがあり、今も数羽のカラスが大切に飼われている。'] },
  { id: 'paris', region: 'europe', name: 'パリ', country: 'フランス', lat: 48.86, lon: 2.35, lab: [-6, 10, 'end'],
    subject: 'other', why: '美術館と芸術の都', e: 'gargoyle', n: 'ノートルダムのガーゴイル',
    facts: ['ルーヴル美術館は世界で最も多くの人が訪れる美術館の一つで、レオナルド・ダ・ヴィンチの「モナ・リザ」が展示されている。',
            'エッフェル塔は1889年の万国博覧会のために建てられた。高さは約330mで、完成当時は世界一高い建造物だった。'] },
  { id: 'mainz', region: 'europe', name: 'マインツ', country: 'ドイツ', lat: 50.0, lon: 8.27, lab: [6, -4, 'start'],
    subject: 'kokugo', why: '活版印刷が生まれ、本が世界に広がった街', e: 'imp', n: 'インクの小悪魔',
    facts: ['1450年ごろ、この街のグーテンベルクが活版印刷を実用化した。それまで手で書き写していた本を、たくさん作れるようになった。',
            '印刷された「グーテンベルク聖書」は、現存するものが世界に約50冊しかなく、とても貴重な本になっている。'] },
  { id: 'pisa', region: 'europe', name: 'ピサ', country: 'イタリア', lat: 43.72, lon: 10.40, lab: [-6, 4, 'end'],
    subject: 'rika', why: '科学者ガリレオ・ガリレイが生まれた街', e: 'harpy', n: '斜塔のハーピー',
    facts: ['「近代科学の父」と呼ばれるガリレオ・ガリレイは、1564年にピサで生まれた。振り子や落下の研究で知られる。',
            'ピサの斜塔は、地盤がやわらかかったため建設中から傾き始めた。現在も約4度傾いたまま立っている。'] },
  { id: 'rome', region: 'europe', name: 'ローマ', country: 'イタリア', lat: 41.90, lon: 12.50, lab: [4, 12, 'start'],
    subject: 'shakai', why: '古代ローマ帝国の中心だった歴史の都', e: 'direwolf', n: 'カピトリーノの狼',
    facts: ['円形闘技場コロッセオは西暦80年に完成した。約5万人が入れたといわれ、約2000年たった今も残っている。',
            'ローマ建国の伝説では、オオカミに育てられた双子の兄弟がこの街をつくったとされている。'] },
  { id: 'athens', region: 'europe', name: 'アテネ', country: 'ギリシャ', lat: 37.98, lon: 23.73, lab: [0, 17, 'middle'], boss: true,
    subject: 'sansu', why: '数学が大きく発展した古代ギリシャの中心', e: 'medusa-head', n: 'メデューサ',
    facts: ['古代ギリシャでは数学が大きく発展した。「三平方の定理」で有名なピタゴラスも古代ギリシャの数学者だ。',
            '1896年、近代オリンピックの第1回大会がアテネで開かれた。民主主義が生まれた場所としても知られる。'] },
  // ---- 中東 ----
  { id: 'istanbul', region: 'mideast', name: 'イスタンブール', country: 'トルコ', lat: 41.01, lon: 28.98, lab: [6, -2, 'start'],
    subject: 'shakai', why: 'ヨーロッパとアジアの歴史が交わる街', e: 'cyclops', n: '海峡のサイクロプス',
    facts: ['ボスポラス海峡をはさんで、街がヨーロッパ側とアジア側の2つの大陸にまたがっている。',
            '昔はコンスタンティノープルと呼ばれ、1453年からはオスマン帝国の都として長く栄えた。'] },
  { id: 'cairo', region: 'mideast', name: 'カイロ', country: 'エジプト', lat: 30.04, lon: 31.24, lab: [-6, 4, 'end'],
    subject: 'kokugo', why: '古代の文字ヒエログリフが残る街', e: 'egyptian-sphinx', n: 'なぞかけスフィンクス',
    facts: ['近くのギザには約4500年前に造られたピラミッドがある。最も大きいものは、もとの高さが約146mあった。',
            '古代エジプトの文字ヒエログリフは、1799年に見つかった「ロゼッタ・ストーン」のおかげで読めるようになった。'] },
  { id: 'petra', region: 'mideast', name: 'ペトラ', country: 'ヨルダン', lat: 30.33, lon: 35.44, lab: [6, 10, 'start'],
    subject: 'other', why: '岩山を彫って造られた芸術的な遺跡', e: 'scorpion', n: '砂岩のスコーピオン',
    facts: ['ペトラは、赤い砂岩の岩山を直接彫って造られた古代都市。2000年以上前にナバテア人がつくった。',
            '岩に彫られた神殿「エル・ハズネ」は高さ約40m。世界遺産に登録されている。'] },
  { id: 'deadsea', region: 'mideast', name: '死海', country: 'ヨルダン／イスラエル', lat: 31.5, lon: 35.5, lab: [6, -2, 'start'],
    subject: 'rika', why: '塩分がとても濃く、体が浮く不思議な湖', e: 'ice-golem', n: 'ソルトゴーレム',
    facts: ['湖面は海面より約430mも低く、陸地で最も低い場所にある。',
            '塩分の濃さは普通の海の約10倍。水の密度が大きいため、人が何もしなくてもぷかぷかと浮かぶ。'] },
  { id: 'baghdad', region: 'mideast', name: 'バグダッド', country: 'イラク', lat: 33.31, lon: 44.36, lab: [0, 16, 'middle'],
    subject: 'sansu', why: '「アルゴリズム」の語源になった数学者の街', e: 'djinn', n: '知恵の館のジン',
    facts: ['9世紀、この街の「知恵の館」には世界中の学問が集まった。数学者フワーリズミーの名前が「アルゴリズム」の語源だ。',
            '数学の「代数（アルジェブラ）」という言葉も、フワーリズミーの本の題名にあるアラビア語から来ている。'] },
  { id: 'dubai', region: 'mideast', name: 'ドバイ', country: 'アラブ首長国連邦', lat: 25.20, lon: 55.27, lab: [-6, 12, 'end'], boss: true,
    subject: 'eigo', why: '外国から来た人が多く、英語が共通語の街', e: 'sand-snake', n: 'デザート・バジリスク',
    facts: ['住んでいる人の約9割が外国から来た人で、アラビア語のほかに英語が共通語として広く使われている。',
            '2010年に完成したブルジュ・ハリファは高さ828mで、世界一高い建物だ。'] },
  // ---- アジア ----
  { id: 'delhi', region: 'asia', name: 'デリー', country: 'インド', lat: 28.61, lon: 77.21, lab: [6, -4, 'start'],
    subject: 'sansu', why: '「ゼロ」を数として扱う考えを生んだインド', e: 'cobra', n: 'キングコブラ',
    facts: ['「0（ゼロ）」を数として計算に使う考え方は、古代インドで発展した。7世紀の数学者ブラーマグプタがそのルールを書き残した。',
            'インドは2023年に人口が世界一になった。首都ニューデリーは、デリーの一部につくられた街だ。'] },
  { id: 'singapore', region: 'asia', name: 'シンガポール', country: 'シンガポール', lat: 1.35, lon: 103.82, lab: [6, 4, 'start'],
    subject: 'eigo', why: '英語を含む4つの公用語がある国', e: 'tiger', n: 'マレー・タイガー',
    facts: ['公用語は英語・中国語・マレー語・タミル語の4つ。学校の授業は主に英語で行われる。',
            '東京23区と同じくらいの広さの小さな国だが、アジアの貿易や金融の中心として発展している。'] },
  { id: 'beijing', region: 'asia', name: '北京', country: '中国', lat: 39.90, lon: 116.40, lab: [-6, -4, 'end'],
    subject: 'shakai', why: '万里の長城と紫禁城がある歴史の都', e: 'double-dragon', n: '長城の双竜',
    facts: ['万里の長城は、北からの侵入を防ぐために長い年月をかけて築かれた。全部合わせると長さは2万km以上になる。',
            '紫禁城（故宮）は明と清の皇帝が住んだ宮殿で、約500年にわたって中国政治の中心だった。'] },
  { id: 'seoul', region: 'asia', name: 'ソウル', country: '韓国', lat: 37.57, lon: 126.98, lab: [-6, 12, 'end'],
    subject: 'kokugo', why: '文字「ハングル」が生まれた国', e: 'fox', n: '九尾の狐',
    facts: ['ハングルは1446年、朝鮮王朝の世宗大王が、だれでも読み書きできるようにと公布した文字だ。',
            '韓国では10月9日が「ハングルの日」として祝日になっている。'] },
  { id: 'tanegashima', region: 'asia', name: '種子島', country: '日本・鹿児島県', lat: 30.6, lon: 130.98, lab: [-6, 12, 'end'],
    subject: 'rika', why: 'ロケットが打ち上げられる宇宙の島', e: 'ufo', n: '謎の飛行物体',
    facts: ['JAXAの種子島宇宙センターから、人工衛星を載せたH3ロケットなどが打ち上げられている。',
            '1543年、ポルトガル人を乗せた船が流れ着き、日本に初めて鉄砲が伝わった島でもある。'] },
  { id: 'kyoto', region: 'asia', name: '京都', country: '日本', lat: 35.01, lon: 135.77, lab: [6, -4, 'start'], boss: true,
    subject: 'other', why: '伝統文化と芸術が今も息づく古都', e: 'oni', n: '羅生門の鬼',
    facts: ['794年に平安京として都になり、1000年以上にわたって日本の都だった。',
            '清水寺や金閣（鹿苑寺）など17の寺社や城が「古都京都の文化財」として世界遺産に登録されている。'] },
];
const CITY_BY_ID = Object.fromEntries(CITIES.map(c => [c.id, c]));

const TITLES = [
  [1, '見習い冒険者'], [3, '努力のルーキー'], [5, '集中ファイター'],
  [8, '学びの戦士'], [12, '知識の騎士'], [16, '賢者の魔術師'],
  [20, '勉強マスター'], [25, '学びの勇者'], [30, '英雄'],
  [40, '伝説の博士'], [50, '知の神'],
];

// 今日のミッション（毎日リセット）
const MISSIONS = [
  { id: 'm10',  label: '今日10分勉強する', reward: { stars: 10 },  cur: t => t.minutes,  max: 10 },
  { id: 'goal', label: '目標時間を達成する', reward: { stars: 10 },  cur: t => t.goals,    max: 1 },
  { id: 'two',  label: '2教科を勉強する', reward: { stars: 15 },  cur: t => t.subjects, max: 2 },
  { id: 'm30',  label: '今日30分勉強する', reward: { tickets: 1 }, cur: t => t.minutes,  max: 30 },
];
const ALL_MISSION_BONUS = { stars: 20 };

const CHEERS = [
  'その調子！', 'いいペースだ！', '集中、集中！', 'すごい集中力！',
  '君ならできる！', 'かっこいいぞ！', 'ボスが震えているぞ！', '力がみなぎってきた！',
  '一緒にがんばろう！', '一歩ずつ確実に！', '今の積み重ねが力になる！',
];

const GOAL_OPTIONS = [5, 10, 15, 20, 30, 45, 60];
const MAX_SESSION_MIN = 120;
const GACHA = { cost1: 30, cost10: 270, pityMax: 30, rates: { 3: 7, 2: 28, 1: 65 } };
