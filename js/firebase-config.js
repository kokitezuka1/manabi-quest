'use strict';
// ===== 保護者と子どもの連携（Firebase）の設定 =====
// Firebase コンソール（https://console.firebase.google.com/）でプロジェクトを作り、
// 「プロジェクトの設定 → マイアプリ → ウェブアプリ」に表示される firebaseConfig をここに貼る。
// null のままなら連携機能はオフ（今までどおり同じ端末の中だけで動く）。
// ※ この値は公開されても問題ない（データは firestore.rules で守る）。
const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyCAU-DD_zqZ-HNTbWUaGaG_3ubWR5WVbr0',
  authDomain: 'heros-study.firebaseapp.com',
  projectId: 'heros-study',
  storageBucket: 'heros-study.firebasestorage.app',
  messagingSenderId: '434800375560',
  appId: '1:434800375560:web:c46e055afdf2be3cb45ebd',
};
