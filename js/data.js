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

// ランク（D〜S）。base + level×perLv が強さ、maxLv はレベルの上限（限界突破で上がる）
const RARITY = {
  1: { label: 'D', name: 'Dランク', base: 4,  perLv: 1,   maxLv: 20, color: '#9aa3b8' },
  2: { label: 'C', name: 'Cランク', base: 6,  perLv: 1.5, maxLv: 25, color: '#4fd18b' },
  3: { label: 'B', name: 'Bランク', base: 9,  perLv: 2,   maxLv: 30, color: '#4aa8ff' },
  4: { label: 'A', name: 'Aランク', base: 12, perLv: 2.5, maxLv: 35, color: '#c07bff' },
  5: { label: 'S', name: 'Sランク', base: 16, perLv: 3,   maxLv: 40, color: '#ffc83d' },
};
const RANKS = [5, 4, 3, 2, 1];   // 表示順（S→D）
// 限界突破：同じ仲間が出るたびに +1（最大5回）。1回ごとにレベル上限 +4、強さ +10%
const LIMIT_BREAK = { max: 5, lvPer: 4, powerPer: 0.1 };

// forms は js/icons.js のアイコン名。r はランク（1=D 〜 5=S）
const CHARACTERS = [
  // ---- Dランク ----
  { id: 'chick',   el: 'fire',    r: 1, forms: ['chicken', 'rooster', 'egyptian-bird'], names: ['ピヨフレア', 'バーンルースター', 'ホルスバード'] },
  { id: 'ape',     el: 'fire',    r: 1, forms: ['monkey', 'mandrill-head', 'ifrit'], names: ['ヒザル', 'フレイムマンドリル', 'イフリート'] },
  { id: 'shroom',  el: 'flower',  r: 1, forms: ['mushroom', 'mushrooms-cluster', 'super-mushroom'], names: ['キノコン', 'キノコロニー', 'キングマッシュ'] },
  { id: 'worm',    el: 'flower',  r: 1, forms: ['caterpillar', 'butterfly', 'fairy'], names: ['リーフワーム', 'バタフライ', 'フェアリー'] },
  { id: 'duck',    el: 'water',   r: 1, forms: ['plastic-duck', 'duck', 'swan'], names: ['アヒルン', 'アクアダック', 'スノースワン'] },
  { id: 'crab',    el: 'water',   r: 1, forms: ['shrimp', 'sad-crab', 'crab'], names: ['エビッコ', 'バブルクラブ', 'キングクラブ'] },
  { id: 'drone',   el: 'mystery', r: 1, forms: ['delivery-drone', 'robot-grab', 'mechanical-arm'], names: ['ミニドローン', 'アームボット', 'メカアーム'] },
  { id: 'bug',     el: 'mystery', r: 1, forms: ['spotted-bug', 'long-antennae-bug', 'walking-scout'], names: ['ビリムシ', 'エレキバグ', 'スカウトボット'] },
  { id: 'mole',    el: 'earth',   r: 1, forms: ['mole', 'badger', 'bear-head'], names: ['モグラン', 'アナグマ', 'グリズリー'] },
  { id: 'sheep',   el: 'earth',   r: 1, forms: ['sheep', 'goat', 'buffalo-head'], names: ['メェメェ', 'ロックゴート', 'バッファロー'] },
  { id: 'monk',    el: 'light',   r: 1, forms: ['monk-face', 'wizard-face', 'hooded-figure'], names: ['アコライト', 'ウィザード', 'ミスティック'] },
  { id: 'viking',  el: 'light',   r: 1, forms: ['viking-helmet', 'viking-head', 'barbarian'], names: ['ヴァイキング', 'シーウォリアー', 'バーバリアン'] },
  // ---- Cランク ----
  { id: 'flare',   el: 'fire',    r: 2, forms: ['fox-head', 'wolf-head', 'wolf-howl'], names: ['フレアフォックス', 'ブレイズウルフ', 'インフェルノウルフ'] },
  { id: 'hound',   el: 'fire',    r: 2, forms: ['basset-hound-head', 'hound', 'hyena-head'], names: ['ヒノワンコ', 'ファイアハウンド', 'ヘルハイエナ'] },
  { id: 'vine',    el: 'flower',  r: 2, forms: ['carnivorous-plant', 'tree-face', 'ent-mouth'], names: ['ヴァインファング', 'トレント', 'エルダー・トレント'] },
  { id: 'frog',    el: 'flower',  r: 2, forms: ['frog', 'toad-teeth', 'frog-prince'], names: ['ケロッパ', 'ガマグチ', 'カエルの王子'] },
  { id: 'fin',     el: 'water',   r: 2, forms: ['shark-fin', 'shark-jaws', 'sperm-whale'], names: ['シャークフィン', 'メガロドン', 'リヴァイアサン'] },
  { id: 'squid',   el: 'water',   r: 2, forms: ['jellyfish', 'squid', 'squid-head'], names: ['プカプカ', 'イカスミン', 'ダイオウイカ'] },
  { id: 'bot',     el: 'mystery', r: 2, forms: ['spider-bot', 'vintage-robot', 'robot-golem'], names: ['スパイダーボット', 'ギアソルジャー', 'アイアンゴーレム'] },
  { id: 'turret',  el: 'mystery', r: 2, forms: ['sentry-gun', 'tesla-turret', 'walking-turret'], names: ['セントリー', 'テスラタレット', 'メカウォーカー'] },
  { id: 'bull',    el: 'earth',   r: 2, forms: ['boar', 'bull', 'minotaur'], names: ['ワイルドボア', 'バイソン', 'ミノタウロス'] },
  { id: 'raptor',  el: 'earth',   r: 2, forms: ['dinosaur-egg', 'velociraptor', 'ninja-velociraptor'], names: ['ダイノエッグ', 'ラプトル', 'シノビラプトル'] },
  { id: 'knight',  el: 'light',   r: 2, forms: ['centurion-helmet', 'black-knight-helm', 'mounted-knight'], names: ['ソルジャー', 'ナイト', 'パラディン'] },
  { id: 'spartan', el: 'light',   r: 2, forms: ['spartan-helmet', 'crested-helmet', 'spartan'], names: ['ホプリテス', 'クレストナイト', 'スパルタン'] },
  // ---- Bランク ----
  { id: 'warlord', el: 'fire',    r: 3, forms: ['horned-helm', 'brutal-helm', 'warlord-helmet'], names: ['ファイアソルジャー', 'ブレイズナイト', 'ウォーロード'] },
  { id: 'gecko',   el: 'fire',    r: 3, forms: ['gecko', 'chameleon-glyph', 'horned-reptile'], names: ['ヒトカゲッコー', 'フレアカメレオン', 'ホーンドドレイク'] },
  { id: 'mantis',  el: 'flower',  r: 3, forms: ['ladybug', 'flying-beetle', 'praying-mantis'], names: ['テントウ', 'グリーンビートル', 'キングマンティス'] },
  { id: 'toucan',  el: 'flower',  r: 3, forms: ['kiwi-bird', 'toucan', 'parrot-head'], names: ['キウイ', 'トゥーカン', 'ジャングルパロット'] },
  { id: 'turtle',  el: 'water',   r: 3, forms: ['turtle', 'sea-turtle', 'tortoise'], names: ['カメット', 'シータートル', 'タートルキング'] },
  { id: 'heron',   el: 'water',   r: 3, forms: ['seagull', 'heron', 'shoebill-stork'], names: ['カモメン', 'アオサギ', 'ハシビロコウ'] },
  { id: 'astro',   el: 'mystery', r: 3, forms: ['astronaut-helmet', 'samus-helmet', 'starfighter'], names: ['アストロノーツ', 'パワードスーツ', 'スターファイター'] },
  { id: 'tesla',   el: 'mystery', r: 3, forms: ['electric', 'thunderball', 'tesla-coil'], names: ['ボルト', 'サンダーボール', 'テスラコイル'] },
  { id: 'dwarf',   el: 'earth',   r: 3, forms: ['dwarf-face', 'dwarf-helmet', 'dwarf-king'], names: ['ドワーフ', 'ドワーフ戦士', 'ドワーフキング'] },
  { id: 'sauro',   el: 'earth',   r: 3, forms: ['parasaurolophus', 'stegosaurus-scales', 'sauropod-head'], names: ['パラサウルス', 'ステゴサウルス', 'ブラキオサウルス'] },
  { id: 'holy',    el: 'light',   r: 3, forms: ['visored-helm', 'light-helm', 'heavy-helm'], names: ['スクワイア', 'ホーリーナイト', 'ガーディアン'] },
  { id: 'king',    el: 'light',   r: 3, forms: ['king', 'old-king', 'throne-king'], names: ['プリンス', 'キング', 'エンペラー'] },
  // ---- Aランク ----
  { id: 'fang',    el: 'fire',    r: 4, forms: ['saber-toothed-cat-head', 'tiger-head', 'lion'], names: ['サーベルファング', 'バーンタイガー', 'レグルス'] },
  { id: 'wyrm',    el: 'fire',    r: 4, forms: ['dragon-orb', 'dragon-spiral', 'drakkar-dragon'], names: ['ドラゴンオーブ', 'スパイラルドラゴン', 'リュウオウ'] },
  { id: 'stag',    el: 'flower',  r: 4, forms: ['deer-head', 'stag-head', 'centaur'], names: ['フォレストディア', 'グランドスタッグ', 'ケンタウロス'] },
  { id: 'elf',     el: 'flower',  r: 4, forms: ['woman-elf-face', 'archer', 'elf-helmet'], names: ['エルフ', 'フォレストアーチャー', 'エルフロード'] },
  { id: 'abyss',   el: 'water',   r: 4, forms: ['fish-monster', 'angler-fish', 'sea-serpent'], names: ['ディープフィッシュ', 'アビスアングラー', 'シーサーペント'] },
  { id: 'dolphin', el: 'water',   r: 4, forms: ['dolphin', 'whale-tail', 'big-wave'], names: ['ドルフィン', 'ブルーホエール', 'タイダルウェイブ'] },
  { id: 'cyborg',  el: 'mystery', r: 4, forms: ['android-mask', 'cyborg-face', 'battle-mech'], names: ['アンドロイド', 'サイボーグ', 'バトルメック'] },
  { id: 'magnet',  el: 'mystery', r: 4, forms: ['robot-helmet', 'magnet-man', 'mecha-mask'], names: ['ロボヘルム', 'マグネットマン', 'ギガメカ'] },
  { id: 'golem',   el: 'earth',   r: 4, forms: ['golem-head', 'rock-golem', 'metal-golem-head'], names: ['ゴーレム', 'ロックゴーレム', 'ミスリルゴーレム'] },
  { id: 'scarab',  el: 'earth',   r: 4, forms: ['scarab-beetle', 'gold-scarab', 'pschent-double-crown'], names: ['スカラベ', 'ゴールドスカラベ', 'ファラオ'] },
  { id: 'shinobi', el: 'light',   r: 4, forms: ['ninja-head', 'ninja-armor', 'ninja-heroic-stance'], names: ['シノビ', 'カゲムシャ', '影の大将'] },
  { id: 'angel',   el: 'light',   r: 4, forms: ['spiked-halo', 'angel-outfit', 'angel-wings'], names: ['ホーリーチャイルド', 'エンジェル', 'アークエンジェル'] },
  // ---- Sランク ----
  { id: 'drake',   el: 'fire',    r: 5, forms: ['wyvern', 'dragon-head', 'spiked-dragon-head'], names: ['ワイバーン', 'ドラグーン', 'イグニス・ドラゴン'] },
  { id: 'phoenix', el: 'fire',    r: 5, forms: ['hummingbird', 'fire-dash', 'eagle-emblem'], names: ['ヒバナドリ', 'ブレイズウィング', 'フェニックス'] },
  { id: 'griffin', el: 'flower',  r: 5, forms: ['owl', 'eagle-head', 'griffin-symbol'], names: ['ミネルヴァ', 'ストームイーグル', 'グリフォン'] },
  { id: 'yggdra',  el: 'flower',  r: 5, forms: ['sprout', 'oak', 'holy-oak'], names: ['メバエ', 'グレートオーク', 'ユグドラシル'] },
  { id: 'hydra',   el: 'water',   r: 5, forms: ['seahorse', 'sea-dragon', 'hydra'], names: ['シーホース', 'シードラゴン', 'ヒュドラ'] },
  { id: 'triton',  el: 'water',   r: 5, forms: ['mermaid', 'triton-head', 'trident'], names: ['マーメイド', 'トリトン', 'ポセイドン'] },
  { id: 'mech',    el: 'mystery', r: 5, forms: ['mecha-head', 'megabot', 'missile-mech'], names: ['メカヘッド', 'メガボット', 'オメガ・メック'] },
  { id: 'raiju',   el: 'mystery', r: 5, forms: ['mouse', 'seated-mouse', 'spark-spirit'], names: ['ビリネズミ', 'エレキマウス', 'ライジュウ'] },
  { id: 'rex',     el: 'earth',   r: 5, forms: ['triceratops-head', 'mammoth', 'dinosaur-rex'], names: ['トリケラトプス', 'マンモス', 'キング・レックス'] },
  { id: 'behemoth', el: 'earth',  r: 5, forms: ['rhinoceros-horn', 'elephant', 'elephant-head'], names: ['ライノ', 'エレファント', 'ベヒーモス'] },
  { id: 'pegasus', el: 'light',   r: 5, forms: ['horse-head', 'unicorn', 'pegasus'], names: ['ホワイトホース', 'ユニコーン', 'セイント・ペガサス'] },
  { id: 'sol',     el: 'light',   r: 5, forms: ['sun', 'heraldic-sun', 'sun-priest'], names: ['サンライト', 'ソル', 'アポロン'] },
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

// ===== 世界一周の冒険 =====
// 地域ごとに6つの街を回る（6教科を1回ずつ）。最後の街はボス。
// アメリカは6地域・36都市（ハワイ・アラスカを含む31州とワシントンD.C.）を西から東へ回る。
// subject: その街で弱点になる教科 / why: その理由 / e: 守護モンスターのアイコン
// lab: 地図上の街名ラベルの位置 [dx, dy, text-anchor]
// short: 地域タブに出す短い名前
// last: 大陸の最後の地域（ボスを倒すとS選択契約書）
const REGIONS = [
  { id: 'usa_pac', name: 'アメリカ太平洋岸', short: '太平洋岸', flag: '🇺🇸', bg: ['#1c3a6e', '#0a1430'] },
  { id: 'usa_mtn', name: 'アメリカ山岳部',   short: '山岳部',   flag: '🇺🇸', bg: ['#5a3a1c', '#1a0e06'] },
  { id: 'usa_mw',  name: 'アメリカ中西部',   short: '中西部',   flag: '🇺🇸', bg: ['#3a5a1c', '#0e1a06'] },
  { id: 'usa_s',   name: 'アメリカ南部',     short: '南部',     flag: '🇺🇸', bg: ['#6a3a1a', '#1e0e06'] },
  { id: 'usa_se',  name: 'アメリカ南東部',   short: '南東部',   flag: '🇺🇸', bg: ['#1a5a5a', '#061a1a'] },
  { id: 'usa_ne',  name: 'アメリカ北東部',   short: '北東部',   flag: '🇺🇸', bg: ['#2a2f6a', '#0a0c26'], last: true },
  { id: 'europe', name: 'ヨーロッパ', flag: '🇪🇺', bg: ['#2a2f6a', '#0e1030'], bbox: [-11, 35, 30, 58], main: [], last: true },
  { id: 'mideast', name: '中東',      flag: '🕌', bg: ['#6a4a1a', '#1e1206'], bbox: [24, 20, 60, 47], main: [], last: true },
  { id: 'asia',   name: 'アジア',     flag: '🌏', bg: ['#6a1a2a', '#1a0610'], bbox: [68, -2, 145, 47], main: [392], last: true },
];
const REGION_BY_ID = Object.fromEntries(REGIONS.map(r => [r.id, r]));

const CITIES = [
  // ---- アメリカ太平洋岸 ----
  { id: 'honolulu', region: 'usa_pac', name: 'ホノルル', country: 'アメリカ・ハワイ州', lat: 21.31, lon: -157.86, lab: [6, 4, 'start'],
    subject: 'eigo', why: '英語とハワイ語の2つが公用語の州', e: 'manta-ray', n: 'マンタ・キング',
    facts: ['ハワイ州は、英語とハワイ語の2つを公用語にしているアメリカで唯一の州。「アロハ」はハワイ語で、あいさつや愛の気持ちを表す言葉だ。',
            'ハワイは昔、王様がおさめる独立した王国だった。ホノルルのイオラニ宮殿は、アメリカでただ一つの「王様が住んだ宮殿」だ。'] },
  { id: 'la', region: 'usa_pac', name: 'ロサンゼルス', country: 'アメリカ・カリフォルニア州', lat: 34.05, lon: -118.24, lab: [6, 4, 'start'],
    subject: 'other', why: '映画や音楽など、芸術とエンタメの街', e: 'rattlesnake', n: 'デザート・ラトラー',
    facts: ['ハリウッドは世界の映画づくりの中心地。丘の上の「HOLLYWOOD」の看板は1923年に作られ、はじめは「HOLLYWOODLAND」だった。',
            'アメリカで2番目に人口が多い都市。一年中雨が少なく晴れの日が多いため、屋外での映画撮影に向いていた。'] },
  { id: 'sf', region: 'usa_pac', name: 'サンフランシスコ', country: 'アメリカ・カリフォルニア州', lat: 37.77, lon: -122.42, lab: [6, 4, 'start'],
    subject: 'sansu', why: 'コンピューターの会社が集まるシリコンバレーの玄関口', e: 'robot-antennas', n: '暴走AIロボ',
    facts: ['南に広がる「シリコンバレー」には、コンピューターやインターネットの会社が集まる。コンピューターは、すべての計算を「0」と「1」の2つの数字だけで行っている。',
            '赤いつり橋ゴールデンゲートブリッジは1937年に完成した。全長は約2.7km。霧の中でも目立つように、朱色にぬられている。'] },
  { id: 'portland', region: 'usa_pac', name: 'ポートランド', country: 'アメリカ・オレゴン州', lat: 45.52, lon: -122.68, lab: [6, 4, 'start'],
    subject: 'kokugo', why: '世界最大級の本屋さんがある本の街', e: 'worm-mouth', n: '本食いワーム',
    facts: ['「パウエルズ・ブックス」は、新しい本と古本を合わせて100万冊以上をあつかう世界最大級の本屋さん。とても広いので、店内の案内地図が配られている。',
            'ポートランドという名前は、コイン投げの勝負で決まった。もし負けていたら、この街の名前は「ボストン」になっていた。'] },
  { id: 'seattle', region: 'usa_pac', name: 'シアトル', country: 'アメリカ・ワシントン州', lat: 47.61, lon: -122.33, lab: [6, 4, 'start'],
    subject: 'shakai', why: '太平洋をはさんで日本と結ばれた港町', e: 'octopus', n: 'ミズダコの主',
    facts: ['シアトルという名前は、この土地に住んでいた先住民のリーダー「シアトル首長」にちなんでつけられた。首都のワシントンD.C.とは別の、ワシントン州にある。',
            '太平洋に面した港町で、日本とのつながりが深い。1957年に兵庫県の神戸市と姉妹都市になった。'] },
  { id: 'alaska', region: 'usa_pac', name: 'アラスカ', country: 'アメリカ・アラスカ州フェアバンクス', lat: 64.84, lon: -147.72, lab: [6, 4, 'start'], boss: true,
    subject: 'rika', why: '夜空にオーロラが輝く北の大地', e: 'polar-bear', n: '極北のホッキョクグマ',
    facts: ['オーロラは、太陽から飛んできた小さなつぶが地球の空気にぶつかって光る現象。フェアバンクスはオーロラがよく見える場所として有名だ。',
            'アラスカはアメリカで一番広い州で、1867年にロシアから約720万ドルで買い取られた。北アメリカで一番高い山デナリ（約6190m）もある。'] },
  // ---- アメリカ山岳部 ----
  { id: 'yellowstone', region: 'usa_mtn', name: 'イエローストーン', country: 'アメリカ・ワイオミング州', lat: 44.43, lon: -110.59, lab: [6, 4, 'start'],
    subject: 'shakai', why: '1872年にできた世界初の国立公園', e: 'bison', n: '大地のバイソン',
    facts: ['1872年、イエローストーンは世界で初めての国立公園になった。自然を守るための「国立公園」という考え方は、ここから世界に広がった。',
            '地下にマグマがあり、熱いお湯がふき出す「間欠泉」がたくさんある。「オールド・フェイスフル」は、だいたい1〜2時間おきにふき上がる。'] },
  { id: 'denver', region: 'usa_mtn', name: 'デンバー', country: 'アメリカ・コロラド州', lat: 39.74, lon: -104.99, lab: [6, 4, 'start'],
    subject: 'sansu', why: '標高がちょうど1マイルの「マイル・ハイ・シティ」', e: 'ram', n: 'ロッキーのビッグホーン',
    facts: ['デンバーは標高がちょうど1マイル（約1609m）の場所にあり、「マイル・ハイ・シティ」と呼ばれる。州議会議事堂の階段には「ここが海抜1マイル」という印がある。',
            'アメリカでは長さに「マイル」や「フィート」を使う。1マイルは5280フィートで約1.6km。マラソン（約42.195km）はおよそ26.2マイルだ。'] },
  { id: 'santafe', region: 'usa_mtn', name: 'サンタフェ', country: 'アメリカ・ニューメキシコ州', lat: 35.69, lon: -105.94, lab: [6, 4, 'start'],
    subject: 'eigo', why: '英語とスペイン語がまじり合う街', e: 'cactus', n: 'サボテン魔人',
    facts: ['ニューメキシコ州は、スペイン語を話す人がとても多い州。「キャニオン（canyon＝峡谷）」や「ロデオ（rodeo）」など、スペイン語から英語になった言葉も多い。',
            'サンタフェは1610年ごろにスペイン人がつくった街で、アメリカで一番古い州都といわれる。「サンタフェ」はスペイン語で「聖なる信仰」という意味だ。'] },
  { id: 'monument', region: 'usa_mtn', name: 'モニュメント・バレー', country: 'アメリカ・ユタ州／アリゾナ州', lat: 36.98, lon: -110.10, lab: [6, 4, 'start'],
    subject: 'kokugo', why: 'ナバホ族の言葉が「破られない暗号」になった土地', e: 'lizardman', n: '岩山のリザードマン',
    facts: ['ナバホ族の土地にある、赤い岩山が立ち並ぶ谷。たくさんの西部劇映画の舞台になった。',
            '第二次世界大戦のとき、ナバホ族の言葉を使った暗号は、相手に一度も解読されなかった。暗号を伝えた人たちは「コード・トーカー」と呼ばれる。'] },
  { id: 'lasvegas', region: 'usa_mtn', name: 'ラスベガス', country: 'アメリカ・ネバダ州', lat: 36.17, lon: -115.14, lab: [-7, 4, 'end'],
    subject: 'other', why: '世界中のショーやエンタメが集まる街', e: 'card-joker', n: 'ネオンのジョーカー',
    facts: ['砂漠の中にあるのに、夜でも明るいネオンとショーで有名なエンタメの街。サーカスやミュージカルなど、毎晩たくさんのショーが開かれている。',
            '近くのフーバーダムは1936年に完成した巨大なダム。川をせき止めてできたミード湖が、街の水や電気を支えている。'] },
  { id: 'grandcanyon', region: 'usa_mtn', name: 'グランドキャニオン', country: 'アメリカ・アリゾナ州', lat: 36.06, lon: -112.14, lab: [0, 17, 'middle'], boss: true,
    subject: 'rika', why: '約18億年分の地球の歴史が見える大峡谷', e: 'condor-emblem', n: '峡谷のコンドル王',
    facts: ['コロラド川が長い時間をかけて大地をけずってできた峡谷。深さは最大で約1.8km、長さは約446kmもある。',
            '崖のしま模様は、積み重なった「地層」。一番下の岩はおよそ18億年前のもので、地球の歴史を本のように読むことができる。'] },
  // ---- アメリカ中西部 ----
  { id: 'rushmore', region: 'usa_mw', name: 'ラシュモア山', country: 'アメリカ・サウスダコタ州', lat: 43.88, lon: -103.46, lab: [6, 4, 'start'],
    subject: 'shakai', why: '4人の大統領の顔が彫られた山', e: 'stone-bust', n: '岩山の石像巨人',
    facts: ['岩山に、ワシントン、ジェファーソン、セオドア・ルーズベルト、リンカーンの4人の大統領の顔が彫られている。顔の大きさは1人約18mもある。',
            '1927年から1941年まで、14年かけて約400人の作業員がつくった。ダイナマイトで岩をくだきながら彫り進めた。'] },
  { id: 'walnutgrove', region: 'usa_mw', name: 'ウォルナットグローブ', country: 'アメリカ・ミネソタ州', lat: 44.22, lon: -95.47, lab: [6, 4, 'start'],
    subject: 'kokugo', why: '名作『大草原の小さな家』の舞台', e: 'scarecrow', n: '大草原のかかし',
    facts: ['作家ローラ・インガルス・ワイルダーが子どものころに暮らした町。家族との開拓生活を書いた物語は『大草原の小さな家』シリーズとして世界中で読まれている。',
            'ローラが本を書き始めたのは60歳をすぎてから。子どものころの思い出をもとに、8冊の物語を書いた。'] },
  { id: 'chicago', region: 'usa_mw', name: 'シカゴ', country: 'アメリカ・イリノイ州', lat: 41.88, lon: -87.63, lab: [6, 4, 'start'],
    subject: 'other', why: '超高層ビルが生まれた建築とアートの街', e: 'ghost', n: '摩天楼のゴースト',
    facts: ['1885年、世界で初めての「超高層ビル」といわれるホーム・インシュアランス・ビルがシカゴに建った。鉄の骨組みを使うことで、高いビルが建てられるようになった。',
            '「風の街（ウィンディ・シティ）」と呼ばれる。シカゴ美術館には、モネやゴッホなど世界的な名画がたくさん展示されている。'] },
  { id: 'detroit', region: 'usa_mw', name: 'デトロイト', country: 'アメリカ・ミシガン州', lat: 42.33, lon: -83.05, lab: [6, 4, 'start'],
    subject: 'rika', why: '自動車づくりが発展した「モーター・シティ」', e: 'mono-wheel-robot', n: '暴走モーターマシン',
    facts: ['自動車会社がたくさん集まり、「モーター・シティ」と呼ばれる。ガソリンを燃やしてピストンを動かす「エンジン」のしくみが、車を走らせている。',
            '1913年ごろ、ヘンリー・フォードはベルトコンベアで車を流しながら組み立てる方法を取り入れ、1台をつくる時間を大きく短くした。'] },
  { id: 'stlouis', region: 'usa_mw', name: 'セントルイス', country: 'アメリカ・ミズーリ州', lat: 38.63, lon: -90.20, lab: [6, 4, 'start'],
    subject: 'sansu', why: '高さと幅が同じ巨大アーチがある街', e: 'giant', n: 'アーチの巨人',
    facts: ['ゲートウェイ・アーチは高さ192m、足もとの幅も192mで、高さと幅がまったく同じ。1965年に完成した世界一高いアーチだ。',
            'アーチの形は「カテナリー曲線」がもと。ひもの両はしを持ってたらしたときにできる形で、数学の式で表すことができる。'] },
  { id: 'kansas', region: 'usa_mw', name: 'カンザス', country: 'アメリカ・カンザス州', lat: 38.5, lon: -98.0, lab: [6, 4, 'start'], boss: true,
    subject: 'eigo', why: '英語の名作『オズの魔法使い』のドロシーのふるさと', e: 'witch-flight', n: '竜巻の大魔女',
    facts: ['1900年に出版された英語の物語『オズの魔法使い』で、主人公ドロシーはカンザスの農場から竜巻で魔法の国へ飛ばされる。「There is no place like home.（おうちほどいい所はない）」というセリフが有名だ。',
            'カンザス州には、アメリカ本土48州のちょうど真ん中とされる地点がある。竜巻が多く発生する「トルネード・アレー（竜巻街道）」の一部でもある。'] },
  // ---- アメリカ南部 ----
  { id: 'tahlequah', region: 'usa_s', name: 'タレクア', country: 'アメリカ・オクラホマ州', lat: 35.91, lon: -94.97, lab: [6, 4, 'start'],
    subject: 'kokugo', why: '自分たちの文字を作ったチェロキー族の首都', e: 'evil-bat', n: 'オザークの大コウモリ',
    facts: ['チェロキー族の首都。1821年、チェロキー族のセコイアは、自分たちの言葉を書き表すための文字を完成させた。86の文字で言葉の音を表す。',
            'セコイアの文字はとても覚えやすく、数年のうちに多くのチェロキー族が読み書きできるようになった。今も町の道路標識には英語とチェロキー文字が並んでいる。'] },
  { id: 'dallas', region: 'usa_s', name: 'ダラス', country: 'アメリカ・テキサス州', lat: 32.78, lon: -96.80, lab: [6, 4, 'start'],
    subject: 'sansu', why: '電卓やICチップが生まれた街', e: 'bull-horns', n: 'ロングホーン',
    facts: ['1958年、この街の会社で働いていたジャック・キルビーが「IC（集積回路）」を発明した。今のコンピューターやゲーム機にも使われている小さな部品だ。',
            '1967年には、同じ会社で手のひらサイズの電卓の試作品がつくられた。それまでの電子計算機は、机の上に置く大きな機械だった。'] },
  { id: 'sanantonio', region: 'usa_s', name: 'サンアントニオ', country: 'アメリカ・テキサス州', lat: 29.42, lon: -98.49, lab: [0, 17, 'middle'],
    subject: 'shakai', why: 'テキサス独立をかけた「アラモの戦い」の地', e: 'armadillo', n: 'アルマジロ騎士',
    facts: ['1836年、テキサスがメキシコから独立しようとした戦いの中で、アラモ砦の戦いが起きた。「アラモを忘れるな」は有名な合言葉になった。',
            'テキサスはその後、約10年間「テキサス共和国」という1つの国だった。1845年にアメリカの28番目の州になった。'] },
  { id: 'houston', region: 'usa_s', name: 'ヒューストン', country: 'アメリカ・テキサス州', lat: 29.76, lon: -95.37, lab: [6, 4, 'start'],
    subject: 'rika', why: 'NASAの宇宙センターがある宇宙開発の街', e: 'alien-bug', n: '宇宙怪虫ゼノバグ',
    facts: ['NASAのジョンソン宇宙センターがあり、宇宙飛行士の訓練や、宇宙船の飛行を地上から見守る管制が行われている。',
            '1969年、月に着陸したアポロ11号からは「ヒューストン、こちら静かの基地。イーグルは着陸した」という有名な通信が届いた。'] },
  { id: 'tuscumbia', region: 'usa_s', name: 'タスカンビア', country: 'アメリカ・アラバマ州', lat: 34.73, lon: -87.70, lab: [6, 4, 'start'],
    subject: 'eigo', why: 'ヘレン・ケラーが初めて英語の言葉を知った町', e: 'water-drop', n: 'ウォーター・スライム',
    facts: ['目と耳が不自由だったヘレン・ケラーが生まれた町。6歳のとき、サリバン先生が手のひらに指で「w-a-t-e-r」とつづり、流れる水が「water」だと初めてわかった。',
            'ヘレンはその後、英語だけでなくフランス語やドイツ語も学んで大学を卒業した。日本にも3回訪れ、障がいのある人のための活動を世界中で行った。'] },
  { id: 'neworleans', region: 'usa_s', name: 'ニューオーリンズ', country: 'アメリカ・ルイジアナ州', lat: 29.95, lon: -90.07, lab: [6, 4, 'start'], boss: true,
    subject: 'other', why: 'ジャズが生まれた音楽の街', e: 'croc-jaws', n: 'バイユーのワニ大王',
    facts: ['20世紀のはじめごろ、アフリカ系アメリカ人の音楽をもとに「ジャズ」が生まれた街。トランペット奏者のルイ・アームストロングもここで育った。',
            'ミシシッピ川が海に注ぐ近くにあり、まわりには「バイユー」と呼ばれる沼地が広がる。ルイジアナ州はアリゲーター（ワニ）がとても多い州だ。'] },
  // ---- アメリカ南東部 ----
  { id: 'nashville', region: 'usa_se', name: 'ナッシュビル', country: 'アメリカ・テネシー州', lat: 36.16, lon: -86.78, lab: [6, 4, 'start'],
    subject: 'other', why: 'カントリー音楽の都「ミュージック・シティ」', e: 'guitar', n: '暴れギター',
    facts: ['カントリー音楽の中心地で「ミュージック・シティ」と呼ばれる。1925年に始まったラジオの音楽番組「グランド・オール・オプリ」は、今も続いている。',
            '街には、古代ギリシャのパルテノン神殿を実物大で再現した建物があり、中は美術館になっている。'] },
  { id: 'atlanta', region: 'usa_se', name: 'アトランタ', country: 'アメリカ・ジョージア州', lat: 33.75, lon: -84.39, lab: [6, 4, 'start'],
    subject: 'kokugo', why: '名作『風と共に去りぬ』が書かれた街', e: 'whirlwind', n: '南部の風の亡霊',
    facts: ['マーガレット・ミッチェルはこの街で小説『風と共に去りぬ』を書いた。1936年に出版されると大ベストセラーになり、ピュリッツァー賞を受賞した。',
            '「I have a dream（私には夢がある）」の演説で知られるキング牧師が生まれた街でもある。生まれた家は今も大切に保存されている。'] },
  { id: 'kennedy', region: 'usa_se', name: 'ケネディ宇宙センター', country: 'アメリカ・フロリダ州', lat: 28.57, lon: -80.65, lab: [6, 4, 'start'],
    subject: 'rika', why: '月へ向かうロケットが飛び立った宇宙基地', e: 'alien-stare', n: '宇宙からの侵略者',
    facts: ['1969年、人類を初めて月へ運んだアポロ11号は、ここから巨大なサターンVロケットで打ち上げられた。',
            '赤道に近いほど地球の自転のスピードが速く、その勢いを利用するとロケットを打ち上げやすい。だから宇宙基地は国の南の方につくられることが多い。'] },
  { id: 'charleston', region: 'usa_se', name: 'チャールストン', country: 'アメリカ・サウスカロライナ州', lat: 32.78, lon: -79.93, lab: [6, 4, 'start'],
    subject: 'shakai', why: '南北戦争が始まった港町', e: 'cannon', n: 'サムター要塞の大砲',
    facts: ['1861年、チャールストンの港にあるサムター要塞への砲撃から、アメリカが北と南に分かれて戦う「南北戦争」が始まった。',
            '南北戦争は1865年に北部の勝利で終わった。リンカーン大統領のもとで、奴隷制度をなくすことが決められた。'] },
  { id: 'kittyhawk', region: 'usa_se', name: 'キティホーク', country: 'アメリカ・ノースカロライナ州', lat: 36.06, lon: -75.70, lab: [6, 4, 'start'],
    subject: 'sansu', why: 'ライト兄弟が計算と実験で空を飛んだ地', e: 'pterodactylus', n: '大空のプテラノドン',
    facts: ['1903年12月17日、ライト兄弟はキティホーク近くの砂丘で、エンジン付きの飛行機で初めて空を飛んだ。最初の飛行は12秒間で、約36m進んだ。',
            '兄弟は手作りの「風洞（風を送る箱）」で200種類以上のつばさの形を試し、集めたデータを計算してつばさを作った。'] },
  { id: 'jamestown', region: 'usa_se', name: 'ジェームズタウン', country: 'アメリカ・バージニア州', lat: 37.21, lon: -76.78, lab: [-7, 2, 'end'], boss: true,
    subject: 'eigo', why: '英語を話す人々が初めて住みついた場所', e: 'pirate-captain', n: '黒ひげの海賊船長',
    facts: ['1607年、イギリスから来た人々が、北アメリカで初めての長く続く英語の植民地をここにつくった。アメリカで英語が話されるようになった始まりの場所だ。',
            '18世紀、バージニアやノースカロライナの海では海賊「黒ひげ」が暴れ回った。1718年、バージニアから送られた船によって黒ひげは倒された。'] },
  // ---- アメリカ北東部 ----
  { id: 'dc', region: 'usa_ne', name: 'ワシントンD.C.', country: 'アメリカの首都', lat: 38.91, lon: -77.04, lab: [6, 4, 'start'],
    subject: 'kokugo', why: '世界最大級の図書館がある本の都', e: 'evil-book', n: '禁書の魔導書',
    facts: ['アメリカ議会図書館は世界最大級の図書館で、本や地図、楽譜など1億7000万点以上の資料がある。',
            'アメリカの首都で、大統領が住むホワイトハウスもこの街にある。どの州にも属さない特別な地区だ。'] },
  { id: 'phila', region: 'usa_ne', name: 'フィラデルフィア', country: 'アメリカ・ペンシルベニア州', lat: 39.95, lon: -75.17, lab: [6, 4, 'start'],
    subject: 'shakai', why: 'アメリカ独立の舞台になった歴史の街', e: 'floating-ghost', n: '独立戦争の亡霊',
    facts: ['1776年7月4日、この街の独立記念館で「独立宣言」が採択された。今も7月4日はアメリカの独立記念日だ。',
            '1787年にはアメリカ合衆国憲法もここで作られた。ひびの入った「自由の鐘」は独立の象徴として大切に保存されている。'] },
  { id: 'niagara', region: 'usa_ne', name: 'ナイアガラの滝', country: 'アメリカ・ニューヨーク州／カナダ', lat: 43.08, lon: -79.07, lab: [6, 4, 'start'],
    subject: 'rika', why: '水の力で電気をつくる巨大な滝', e: 'kraken-tentacle', n: '滝つぼのクラーケン',
    facts: ['アメリカとカナダの国境にある大きな滝。多いときには1秒間に約2800トンもの水が流れ落ちる。',
            '19世紀の終わり、滝の水の力を使った大きな水力発電所がつくられた。発明家テスラが考えた「交流」のしくみで、電気が遠くの街まで送られるようになった。'] },
  { id: 'hartford', region: 'usa_ne', name: 'ハートフォード', country: 'アメリカ・コネチカット州', lat: 41.76, lon: -72.67, lab: [6, 4, 'start'],
    subject: 'eigo', why: 'アメリカ英語の辞書と名作が生まれた街', e: 'quill-ink', n: '魔法の羽ペン',
    facts: ['辞書をつくったノア・ウェブスターはこの街の近くで生まれた。彼の辞書によって、colour を color と書くなど、アメリカ英語のつづりが広まった。',
            '作家マーク・トウェインは、この街の家で『トム・ソーヤーの冒険』などの名作を書いた。その家は今、博物館になっている。'] },
  { id: 'boston', region: 'usa_ne', name: 'ボストン', country: 'アメリカ・マサチューセッツ州', lat: 42.36, lon: -71.06, lab: [6, 4, 'start'],
    subject: 'sansu', why: 'MITがある、数学と科学の学問の街', e: 'tracked-robot', n: '工科大ロボ・ガーディアン',
    facts: ['ボストンの川向かいのケンブリッジ市には、数学や科学で世界トップクラスのマサチューセッツ工科大学（MIT）がある。',
            '同じケンブリッジ市には、1636年創立でアメリカ最古の大学、ハーバード大学もある。世界中から学生が集まる学問の街だ。'] },
  { id: 'nyc', region: 'usa_ne', name: 'ニューヨーク', country: 'アメリカ・ニューヨーク州', lat: 40.71, lon: -74.01, lab: [6, 4, 'start'], boss: true,
    subject: 'other', why: 'ミュージカルと美術館が集まる芸術の都', e: 'gorilla', n: '摩天楼の巨猿',
    facts: ['自由の女神は1886年、アメリカ独立100周年を記念してフランスから贈られた。右手のたいまつまでの高さは約46m。',
            'ブロードウェイには40ほどの大きな劇場が集まり、毎晩ミュージカルが上演されている。世界最大級のメトロポリタン美術館もある。'] },
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
// 旧バージョン（アメリカ6都市・全24都市）の都市の並び。保存データの引き継ぎに使う
const OLD_CITY_ORDER = ['la', 'houston', 'dc', 'phila', 'boston', 'nyc', 'london', 'paris', 'mainz', 'pisa', 'rome', 'athens',
  'istanbul', 'cairo', 'petra', 'deadsea', 'baghdad', 'dubai', 'delhi', 'singapore', 'beijing', 'seoul', 'tanegashima', 'kyoto'];

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
  { id: 'm30',  label: '今日30分勉強する', reward: { stars: 15 },  cur: t => t.minutes,  max: 30 },
];
const ALL_MISSION_BONUS = { stars: 20 };

const CHEERS = [
  'その調子！', 'いいペースだ！', '集中、集中！', 'すごい集中力！',
  '君ならできる！', 'かっこいいぞ！', 'ボスが震えているぞ！', '力がみなぎってきた！',
  '一緒にがんばろう！', '一歩ずつ確実に！', '今の積み重ねが力になる！',
];

const GOAL_OPTIONS = [5, 10, 15, 20, 30, 45, 60];
const MAX_SESSION_MIN = 120;
// rates：ランクごとの確率（%）。10連の最後の1回は tenMin ランク以上が確定。pityMax 回引くまでに必ずSが出る
const GACHA = { cost1: 100, cost10: 1000, pityMax: 50, tenMin: 4, rates: { 5: 3, 4: 10, 3: 22, 2: 30, 1: 35 } };
// 契約書：ランク契約書はそのランクの中からランダム、選択契約書は好きな1体を選べる
const CONTRACTS = {
  a:    { name: 'A契約書',     r: 4, pick: false, desc: 'Aランクの仲間がランダムで1体' },
  s:    { name: 'S契約書',     r: 5, pick: false, desc: 'Sランクの仲間がランダムで1体' },
  ssel: { name: 'S選択契約書', r: 5, pick: true,  desc: 'Sランクの仲間から好きな1体を選べる' },
};
const CONTRACT_ORDER = ['ssel', 's', 'a'];
const STREAK_CONTRACTS = { 30: 's', 100: 'ssel' };   // 連続日数のごほうび

// 保護者ページの設定
const PRIORITY_STAR_RATE = 1.5;          // 優先教科を勉強すると⭐が1.5倍
const TARGET_BONUS = { stars: 20 };      // 1日の目標時間を達成したときのボーナス
const TARGET_OPTIONS = [0, 15, 20, 30, 45, 60, 75, 90, 105, 120, 150, 180];
