'use strict';
// ===== こうかおん と えんしゅつ =====

const Sound = (() => {
  let ctx = null;
  function ac() {
    if (!S.settings.sound) return null;
    if (!ctx) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      ctx = new C();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function tone(freq, dur, { type = 'sine', vol = 0.12, delay = 0, slide = 0 } = {}) {
    const c = ac(); if (!c) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, { vol = 0.15, delay = 0 } = {}) {
    const c = ac(); if (!c) return;
    const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const s = c.createBufferSource(), g = c.createGain();
    s.buffer = buf; g.gain.value = vol;
    s.connect(g).connect(c.destination);
    s.start(c.currentTime + delay);
  }
  const arp = (notes, step, opt) => notes.forEach((f, i) => tone(f, opt.dur || 0.2, { ...opt, delay: (opt.delay || 0) + i * step }));
  return {
    unlock() { ac(); },
    tap() { tone(700, 0.05, { type: 'triangle', vol: 0.07 }); },
    coin() { tone(988, 0.07, { type: 'square', vol: 0.05 }); tone(1319, 0.22, { type: 'square', vol: 0.05, delay: 0.07 }); },
    tick() { tone(1200, 0.03, { type: 'square', vol: 0.03 }); },
    hit() { noise(0.12, { vol: 0.18 }); tone(220, 0.15, { type: 'square', vol: 0.08, slide: -150 }); },
    crit() { noise(0.2, { vol: 0.25 }); tone(440, 0.25, { type: 'sawtooth', vol: 0.08, slide: -350 }); },
    levelup() { arp([523, 659, 784, 1047], 0.09, { type: 'triangle', vol: 0.12 }); tone(1319, 0.6, { type: 'triangle', vol: 0.12, delay: 0.38 }); },
    win() { arp([392, 523, 659, 784, 659, 784, 1047], 0.11, { type: 'square', vol: 0.06, dur: 0.18 }); },
    chime() { arp([880, 1109, 1319, 1760], 0.12, { type: 'sine', vol: 0.15, dur: 0.5 }); },
    evolve() { for (let i = 0; i < 12; i++) tone(300 + i * 80, 0.1, { type: 'triangle', vol: 0.07, delay: i * 0.08 }); arp([1047, 1319, 1568, 2093], 0.1, { type: 'triangle', vol: 0.12, delay: 1.0, dur: 0.4 }); },
    drum() { for (let i = 0; i < 14; i++) noise(0.05, { vol: 0.06 + i * 0.008, delay: i * (0.11 - i * 0.004) }); },
    reveal(r) {
      if (r === 3) { arp([523, 659, 784, 1047, 1319, 1568, 2093], 0.07, { type: 'triangle', vol: 0.13, dur: 0.35 }); noise(0.4, { vol: 0.1 }); }
      else if (r === 2) arp([659, 880, 1175], 0.08, { type: 'triangle', vol: 0.12, dur: 0.3 });
      else arp([784, 988], 0.08, { type: 'triangle', vol: 0.1, dur: 0.25 });
    },
  };
})();

const FX = (() => {
  const cv = document.getElementById('fx');
  const g = cv.getContext('2d');
  let parts = [], running = false;
  const COLORS = ['#ff5c8a', '#ffb300', '#6c5ce7', '#2f9bff', '#2fae5a', '#ff7a45', '#ffe14d'];
  function resize() { cv.width = innerWidth * devicePixelRatio; cv.height = innerHeight * devicePixelRatio; }
  addEventListener('resize', resize); resize();
  function loop() {
    g.clearRect(0, 0, cv.width, cv.height);
    const k = devicePixelRatio;
    parts = parts.filter(p => p.life > 0);
    for (const p of parts) {
      p.vy += p.grav; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life--;
      g.save();
      g.globalAlpha = Math.min(1, p.life / 30);
      g.translate(p.x * k, p.y * k); g.rotate(p.rot);
      g.fillStyle = p.color;
      if (p.shape === 'star') { g.font = `${p.size * k * 2}px sans-serif`; g.fillText('⭐', 0, 0); }
      else g.fillRect(-p.size * k / 2, -p.size * k / 4, p.size * k, p.size * k / 2);
      g.restore();
    }
    if (parts.length) requestAnimationFrame(loop); else { running = false; g.clearRect(0, 0, cv.width, cv.height); }
  }
  function kick() { if (!running) { running = true; requestAnimationFrame(loop); } }
  return {
    confetti(n = 120) {
      for (let i = 0; i < n; i++) parts.push({
        x: Math.random() * innerWidth, y: -20 - Math.random() * 200, vx: (Math.random() - 0.5) * 3, vy: 2 + Math.random() * 3,
        grav: 0.05, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, size: 8 + Math.random() * 6,
        color: COLORS[i % COLORS.length], life: 200 + Math.random() * 60,
      });
      kick();
    },
    burst(x, y, n = 40, stars = false) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, s = 3 + Math.random() * 6;
        parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 2, grav: 0.15, rot: 0, vr: (Math.random() - 0.5) * 0.4,
          size: stars ? 8 : 7 + Math.random() * 5, color: COLORS[i % COLORS.length], life: 60 + Math.random() * 30, shape: stars ? 'star' : 'rect' });
      }
      kick();
    },
    burstAt(el, n, stars) {
      const r = el.getBoundingClientRect();
      this.burst(r.left + r.width / 2, r.top + r.height / 2, n, stars);
    },
  };
})();

const sleep = ms => new Promise(r => setTimeout(r, ms));

function countUp(el, from, to, dur = 800) {
  return new Promise(res => {
    const t0 = performance.now();
    function step(t) {
      const k = Math.min(1, (t - t0) / dur);
      el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(step); else res();
    }
    requestAnimationFrame(step);
  });
}

function floatText(target, text, cls = '') {
  const r = target.getBoundingClientRect();
  const d = document.createElement('div');
  d.className = 'float-text ' + cls;
  d.textContent = text;
  d.style.left = (r.left + r.width / 2 + (Math.random() - 0.5) * r.width * 0.6) + 'px';
  d.style.top = (r.top + r.height * 0.3) + 'px';
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 1100);
}
