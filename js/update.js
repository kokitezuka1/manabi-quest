'use strict';
// ===== 新しい版が出たら「再起動」をうながす =====
// 公開のたびに version.json の v と、index.html の APP_VER を同じ新しい値に上げる

const Updater = (() => {
  let asked = false;
  async function check() {
    if (asked || typeof APP_VER === 'undefined' || !S.player) return;
    try {
      const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' });
      if (!r.ok) return;
      const { v } = await r.json();
      if (!v || v === APP_VER) return;
      ask();
    } catch (e) { /* オフラインなど。次の機会に */ }
  }
  async function ask() {
    if (asked || S.active || $('.modal-back') || $('.g-overlay') || document.body.classList.contains('fullmode')) return;
    asked = true;
    Sound.chime && Sound.chime();
    const v = await modal(`<div class="m-emo gold">🆕</div><h2>アップデートがあるよ！</h2>
      <p>新しいバージョンが出たよ。<br>再起動すると、新しいイベントや機能が使えるようになるよ。</p>
      <button class="btn big gold wide" data-v="go">再起動する</button>
      <button class="btn wide" data-v="later">あとで</button>`, { cls: 'shine' });
    if (v === 'go') { saveQuiet(); if (S.cloud && typeof syncNow === 'function') { try { await syncNow(); } catch (e) {} } location.reload(); }
    else setTimeout(() => { asked = false; }, 10 * 60 * 1000);
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
  setInterval(check, 5 * 60 * 1000);
  setTimeout(check, 3000);
  return { check };
})();
