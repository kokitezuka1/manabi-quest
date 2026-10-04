'use strict';
// ===== ゲームの マスターデータ =====

const SUBJECTS = [
  { id: 'sansu',  name: 'さんすう', icon: '🔢', color: '#ff7a45', el: 'fire' },
  { id: 'kokugo', name: 'こくご',   icon: '📖', color: '#ff5c8a', el: 'flower' },
  { id: 'rika',   name: 'りか',     icon: '🔬', color: '#9b5cff', el: 'mystery' },
  { id: 'shakai', name: 'しゃかい', icon: '🗾', color: '#2fae5a', el: 'earth' },
  { id: 'eigo',   name: 'えいご',   icon: '🔤', color: '#2f9bff', el: 'water' },
  { id: 'other',  name: 'そのほか', icon: '✏️', color: '#e6a800', el: 'light' },
];
const SUBJECT_BY_ID = Object.fromEntries(SUBJECTS.map(s => [s.id, s]));

const ELEMENTS = {
  fire:    { name: 'ほのお', icon: '🔥', color: '#ff7a45' },
  flower:  { name: 'はな',   icon: '🌸', color: '#ff5c8a' },
  mystery: { name: 'ふしぎ', icon: '🔮', color: '#9b5cff' },
  earth:   { name: 'だいち', icon: '🌳', color: '#2fae5a' },
  water:   { name: 'みず',   icon: '💧', color: '#2f9bff' },
  light:   { name: 'ひかり', icon: '✨', color: '#e6a800' },
};
const SUBJECT_BY_EL = Object.fromEntries(SUBJECTS.map(s => [s.el, s]));

const RARITY = {
  1: { stars: '★',     name: 'ノーマル',     base: 5,  color: '#8fa3b8' },
  2: { stars: '★★',    name: 'レア',         base: 9,  color: '#3d8bfd' },
  3: { stars: '★★★',   name: 'スーパーレア', base: 14, color: '#f5b100' },
};

const CHARACTERS = [
  { id: 'piyo',    el: 'fire',    r: 1, forms: ['🐣', '🐥', '🐓'], names: ['ピヨッコ', 'ピヨスケ', 'コケキング'] },
  { id: 'leo',     el: 'fire',    r: 2, forms: ['🐱', '🦁', '🐯'], names: ['ニャモ', 'レオン', 'タイガオー'] },
  { id: 'dragon',  el: 'fire',    r: 3, forms: ['🦎', '🐲', '🐉'], names: ['ヒトカゲン', 'ドラコ', 'バーンドラゴン'] },
  { id: 'tane',    el: 'flower',  r: 1, forms: ['🌱', '🌷', '🌻'], names: ['タネッコ', 'チューリン', 'ヒマワリオン'] },
  { id: 'chou',    el: 'flower',  r: 2, forms: ['🐛', '🐝', '🦋'], names: ['イモムー', 'ハニービー', 'フラワーバタフライ'] },
  { id: 'peacock', el: 'flower',  r: 3, forms: ['🐤', '🦜', '🦚'], names: ['ヒナドリ', 'オウムン', 'ピーコックロード'] },
  { id: 'ebi',     el: 'water',   r: 1, forms: ['🦐', '🦞', '🦀'], names: ['エビッチ', 'ロブスタン', 'カニキング'] },
  { id: 'shark',   el: 'water',   r: 2, forms: ['🐟', '🐠', '🦈'], names: ['サカナン', 'ネッタイオ', 'シャークJr.'] },
  { id: 'whale',   el: 'water',   r: 3, forms: ['🐬', '🐳', '🐋'], names: ['イルカッチ', 'クジララ', 'オーシャンホエール'] },
  { id: 'robo',    el: 'mystery', r: 1, forms: ['🔩', '⚙️', '🤖'], names: ['ネジッコ', 'ハグルマン', 'メカロボ'] },
  { id: 'alien',   el: 'mystery', r: 2, forms: ['👾', '👽', '🛸'], names: ['ピコピコ', 'グレイ', 'ユーフォーン'] },
  { id: 'unicorn', el: 'mystery', r: 3, forms: ['🐴', '🦄', '🦄'], names: ['ポニー', 'ユニコ', 'レインボーユニコーン'] },
  { id: 'hamu',    el: 'earth',   r: 1, forms: ['🐹', '🐿️', '🦫'], names: ['ハムりん', 'リスッピ', 'ビーバーン'] },
  { id: 'mammoth', el: 'earth',   r: 2, forms: ['🐗', '🐘', '🦣'], names: ['ウリボ', 'パオーン', 'マンモス'] },
  { id: 'dino',    el: 'earth',   r: 3, forms: ['🐢', '🦕', '🦖'], names: ['カメコ', 'ブラキオ', 'ティラノキング'] },
  { id: 'kuma',    el: 'light',   r: 1, forms: ['🧸', '🐻', '🐻‍❄️'], names: ['テディ', 'クマゴロウ', 'シロクマキング'] },
  { id: 'wan',     el: 'light',   r: 2, forms: ['🐶', '🐕', '🐺'], names: ['ワンコ', 'ワンダー', 'ルーガ'] },
  { id: 'star',    el: 'light',   r: 3, forms: ['⭐', '🌟', '🌞'], names: ['キラリ', 'スターリ', 'サンシャインゴッド'] },
];
const CHAR_BY_ID = Object.fromEntries(CHARACTERS.map(c => [c.id, c]));
const STARTERS = ['piyo', 'tane', 'ebi'];
const EVOLVE_LV = [10, 25];   // Lv10 で 2だんかいめ、Lv25 で 3だんかいめ
const CHAR_MAX_LV = 40;

// ステージ（3ステージで 1ワールド。3つめは ボス）
const WORLDS = [
  { name: 'はじまりのそうげん', icon: '🌿', bg: ['#d5f7a0', '#6cc96a'], enemies: [
    { e: '🐌', n: 'ノロノロン', weak: 'fire' },
    { e: '🐀', n: 'チュータ', weak: 'water' },
    { e: '🐗', n: 'イノシシキング', weak: 'flower', boss: true } ] },
  { name: 'まよいのもり', icon: '🌲', bg: ['#b7ecd4', '#2f9a62'], enemies: [
    { e: '🦇', n: 'コウモリン', weak: 'light' },
    { e: '🕷️', n: 'クモッチ', weak: 'fire' },
    { e: '🐺', n: 'ウルフロード', weak: 'earth', boss: true } ] },
  { name: 'さばくのいせき', icon: '🏜️', bg: ['#ffe8a8', '#f0a04b'], enemies: [
    { e: '🦂', n: 'サソリン', weak: 'water' },
    { e: '🐍', n: 'ニョロリ', weak: 'mystery' },
    { e: '🗿', n: 'ストーンゴーレム', weak: 'flower', boss: true } ] },
  { name: 'こおりのやま', icon: '🏔️', bg: ['#e2f6ff', '#82b9e8'], enemies: [
    { e: '⛄', n: 'ユキダルン', weak: 'fire' },
    { e: '🦭', n: 'アザラシー', weak: 'earth' },
    { e: '🐻‍❄️', n: 'ブリザードベア', weak: 'fire', boss: true } ] },
  { name: 'しんかいのそこ', icon: '🌊', bg: ['#8fe0f5', '#2468b8'], enemies: [
    { e: '🦑', n: 'イカスミン', weak: 'light' },
    { e: '🐙', n: 'タコハチ', weak: 'mystery' },
    { e: '🐡', n: 'ハリセンキング', weak: 'earth', boss: true } ] },
  { name: 'かざんのしま', icon: '🌋', bg: ['#ffc3a8', '#d2483a'], enemies: [
    { e: '🐊', n: 'マグマワニ', weak: 'water' },
    { e: '🦏', n: 'ガンセキサイ', weak: 'flower' },
    { e: '👹', n: 'カザンオニ', weak: 'water', boss: true } ] },
  { name: 'くものおしろ', icon: '☁️', bg: ['#ecd8ff', '#8ec5fc'], enemies: [
    { e: '🦅', n: 'イーグルス', weak: 'mystery' },
    { e: '🌪️', n: 'タツマキング', weak: 'earth' },
    { e: '👺', n: 'テングマスター', weak: 'light', boss: true } ] },
  { name: 'うちゅうステーション', icon: '🚀', bg: ['#6f86d6', '#22264b'], enemies: [
    { e: '☄️', n: 'メテオン', weak: 'earth' },
    { e: '🌑', n: 'ヤミムーン', weak: 'light' },
    { e: '🌀', n: 'ブラックホール', weak: 'mystery', boss: true } ] },
  { name: 'まおうのしろ', icon: '🏰', bg: ['#8e6bd8', '#2b1640'], enemies: [
    { e: '💀', n: 'ガイコツン', weak: 'light' },
    { e: '🧛', n: 'ドラキュラン', weak: 'fire' },
    { e: '😈', n: 'だいまおう', weak: 'light', boss: true } ] },
];

const TITLES = [
  [1, 'みならいぼうけんしゃ'], [3, 'がんばりルーキー'], [5, 'しゅうちゅうファイター'],
  [8, 'まなびのせんし'], [12, 'ちしきのきし'], [16, 'かしこいまほうつかい'],
  [20, 'べんきょうマスター'], [25, 'まなびのゆうしゃ'], [30, 'えいゆう'],
  [40, 'でんせつのはかせ'], [50, 'まなびのかみさま'],
];

// きょうの ミッション（まいにち リセット）
const MISSIONS = [
  { id: 'm10',  label: 'きょう 10ぷん べんきょうする',      reward: { stars: 10 },  cur: t => t.minutes,  max: 10 },
  { id: 'goal', label: 'もくひょうじかんを たっせいする',    reward: { stars: 10 },  cur: t => t.goals,    max: 1 },
  { id: 'two',  label: '2つの かもくを べんきょうする',      reward: { stars: 15 },  cur: t => t.subjects, max: 2 },
  { id: 'm30',  label: 'きょう 30ぷん べんきょうする',      reward: { tickets: 1 }, cur: t => t.minutes,  max: 30 },
];
const ALL_MISSION_BONUS = { stars: 20 };

const CHEERS = [
  'がんばれ〜！', 'いいちょうし！', 'しゅうちゅう しゅうちゅう！', 'そのちょうし！',
  'すごい すごい！', 'きみなら できる！', 'かっこいいよ！', 'ボスが ふるえてるぞ！',
  'ちからが みなぎってきた！', 'いっしょに がんばろう！',
];

const GOAL_OPTIONS = [5, 10, 15, 20, 30, 45, 60];
const MAX_SESSION_MIN = 120;
const GACHA = { cost1: 30, cost10: 270, pityMax: 30, rates: { 3: 7, 2: 28, 1: 65 } };
