// Cursor spotlight via CSS variables
(function cursorSpotlight() {
  const root = document.documentElement;
  let active = true;
  window.addEventListener('pointermove', (e) => {
    if (!active) return;
    const x = (e.clientX / window.innerWidth) * 100 + '%';
    const y = (e.clientY / window.innerHeight) * 100 + '%';
    root.style.setProperty('--mx', x);
    root.style.setProperty('--my', y);
  });
  const toggle = document.getElementById('cursorToggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      active = !active;
      toggle.setAttribute('aria-pressed', String(active));
      if (!active) {
        root.style.removeProperty('--mx');
        root.style.removeProperty('--my');
      }
    });
  }
})();

// Magnetic buttons
document.querySelectorAll('.magnetic').forEach((el) => {
  const strength = 18;
  const reset = () => el.style.transform = 'translate3d(0,0,0)';
  el.addEventListener('pointermove', (e) => {
    const rect = el.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);
    el.style.transform = `translate3d(${dx/strength}px, ${dy/strength}px, 0)`;
  });
  el.addEventListener('pointerleave', reset);
});

// Tilt cards
document.querySelectorAll('[data-tilt]').forEach((card) => {
  const max = 8; // deg
  const handle = (e) => {
    const r = card.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    const rx = (y * -max).toFixed(2);
    const ry = (x * max).toFixed(2);
    card.style.transform = `perspective(700px) rotateX(${rx}deg) rotateY(${ry}deg)`;
  };
  const reset = () => card.style.transform = 'perspective(700px) rotateX(0) rotateY(0)';
  card.addEventListener('pointermove', handle);
  card.addEventListener('pointerleave', reset);
});

// Constellation background (unique network animation)
(function constellation() {
  const c = document.getElementById('constellation');
  const ctx = c.getContext('2d');
  let width = c.width = window.innerWidth;
  let height = c.height = window.innerHeight;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let zen = prefersReducedMotion; // si el usuario prefiere menos movimiento, arrancamos zen
  const nodes = [];
  const cores = navigator.hardwareConcurrency || 4;
  const baseCount = 120;
  let count = Math.round(baseCount * Math.min(1, cores / 8) * (window.devicePixelRatio > 1 ? 0.85 : 1));
  if (width < 600) count = Math.max(60, Math.round(count * 0.6));
  const maxDist = 110; // un poco menor para menos líneas
  
  function rnd(a, b) { return Math.random() * (b - a) + a; }
  function init() {
    nodes.length = 0;
    for (let i = 0; i < count; i++) {
      nodes.push({
        x: rnd(0, width),
        y: rnd(0, height),
        vx: rnd(-0.4, 0.4),
        vy: rnd(-0.4, 0.4),
        r: rnd(0.6, 1.8)
      });
    }
  }

  let mx = width/2, my = height/3;
  window.addEventListener('pointermove', (e) => { mx = e.clientX; my = e.clientY; });
  window.addEventListener('resize', () => { width = c.width = window.innerWidth; height = c.height = window.innerHeight; init(); precomputeGradient(); });
  document.addEventListener('visibilitychange', () => { paused = document.hidden; });

  init();
  
  // Precompute gradient once (recalculated on resize)
  let backgroundGradient;
  function precomputeGradient() {
    const g = ctx.createLinearGradient(0, 0, width, height);
    g.addColorStop(0, 'rgba(86,214,255,0.04)');
    g.addColorStop(1, 'rgba(182,133,255,0.04)');
    backgroundGradient = g;
  }
  precomputeGradient();

  let paused = false;
  let flip = false; // actualiza posiciones en frames alternos para reducir coste
  function step() {
    if (paused) { requestAnimationFrame(step); return; }
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = backgroundGradient;
    ctx.fillRect(0, 0, width, height);

    // Spatial hashing grid para reducir comparaciones O(n^2)
    const cell = maxDist;
    const cols = Math.ceil(width / cell);
    const rows = Math.ceil(height / cell);
    const grid = Array.from({ length: cols * rows }, () => []);

    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      if (!zen && flip) { n.x += n.vx; n.y += n.vy; }
      if (n.x < 0 || n.x > width) n.vx *= -1;
      if (n.y < 0 || n.y > height) n.vy *= -1;
      const cx = Math.max(0, Math.min(cols - 1, Math.floor(n.x / cell)));
      const cy = Math.max(0, Math.min(rows - 1, Math.floor(n.y / cell)));
      const idx = cy * cols + cx;
      if (grid[idx]) grid[idx].push(i);
      else grid[idx] = [i];
    }

    // dibuja nodos
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI*2);
      ctx.fill();
    }

    // conecta vecinos cercanos en celdas adyacentes
    ctx.lineWidth = 1;
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const cx = Math.max(0, Math.min(cols - 1, Math.floor(n.x / cell)));
      const cy = Math.max(0, Math.min(rows - 1, Math.floor(n.y / cell)));
      for (let ox = -1; ox <= 1; ox++) {
        for (let oy = -1; oy <= 1; oy++) {
          const nx = cx + ox, ny = cy + oy;
          if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
          const bucket = grid[ny * cols + nx];
          if (!bucket || bucket.length === 0) continue;
          for (let k = 0; k < bucket.length; k++) {
            const j = bucket[k];
            if (j <= i) continue; // evita duplicar líneas
            const m = nodes[j];
            const dx = n.x - m.x, dy = n.y - m.y;
            const d = Math.hypot(dx, dy);
            if (d < maxDist) {
              const alpha = (1 - d/maxDist) * 0.6;
              ctx.strokeStyle = `rgba(86,214,255,${alpha})`;
              ctx.beginPath();
              ctx.moveTo(n.x, n.y);
              ctx.lineTo(m.x, m.y);
              ctx.stroke();
            }
          }
        }
      }
    }

    // atracción sutil hacia el cursor
    if (!zen && flip) {
      for (let i = 0; i < 4; i++) {
        const n = nodes[(Math.floor(Math.random()*nodes.length))];
        n.x += (mx - n.x) * 0.008;
        n.y += (my - n.y) * 0.008;
      }
    }

    flip = !flip;
    requestAnimationFrame(step);
  }
  step();

  // Zen toggle
  const zenToggle = document.getElementById('zenToggle');
  if (zenToggle) {
    zenToggle.addEventListener('click', () => {
      zen = !zen;
      zenToggle.setAttribute('aria-pressed', String(zen));
      const aurora = document.querySelector('.aurora');
      if (aurora) aurora.style.opacity = zen ? 0.25 : 0.45;
    });
  }
})();

// Text scramble effect on headline accent
(function scramble() {
  const el = document.getElementById('scramble');
  if (!el) return;
  const chars = '!<>-_\/[]{}—=+*^?#________';
  const phrases = ['experiencia dinámica', 'detalles únicos', 'interacciones suaves', 'elegancia azul'];
  let counter = 0;
  function setText(newText) {
    const oldText = el.textContent;
    const length = Math.max(oldText.length, newText.length);
    const promise = new Promise(resolve => {
      const queue = [];
      for (let i = 0; i < length; i++) {
        const from = oldText[i] || '';
        const to = newText[i] || '';
        const start = Math.floor(Math.random() * 12);
        const end = start + Math.floor(Math.random() * 12);
        queue.push({ from, to, start, end, char: '' });
      }
      let frame = 0;
      function update() {
        let output = '';
        let complete = 0;
        for (let i = 0; i < queue.length; i++) {
          const q = queue[i];
          if (frame >= q.end) { complete++; output += q.to; }
          else if (frame >= q.start) { q.char = chars[Math.floor(Math.random()*chars.length)]; output += `<span class="ghost">${q.char}</span>`; }
          else { output += q.from; }
        }
        el.innerHTML = output;
        if (complete === queue.length) resolve();
        else requestAnimationFrame(update), frame++;
      }
      update();
    });
    return promise;
  }
  async function next() {
    await setText(phrases[counter % phrases.length]);
    counter++;
    setTimeout(next, 1600);
  }
  next();
})();