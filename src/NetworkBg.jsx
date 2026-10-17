import { useEffect, useRef } from 'react';

function startNetwork(sidebar, canvas) {
  const ctx = canvas.getContext('2d');
  const DENSITY = 3200;     // lower = more dots
  const LINK_DIST = 120;     // higher = more connecting lines
  const SPEED = 0.22;       // drift speed
  const COLORS = ['0,200,235', '0,200,235', '0,200,235', '120,170,255', '212,240,74'];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let w = 0, h = 0, dots = [], mouse = null, rafId = 0;

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    w = sidebar.clientWidth;
    h = sidebar.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.max(18, Math.round((w * h) / DENSITY));
    dots = Array.from({ length: count }, function () {
      const z = 0.3 + Math.random() * 0.7;          // depth: 0.3 far, 1 near
      const a = Math.random() * Math.PI * 2;
      return {
        x: Math.random() * w,
        y: Math.random() * h,
        vx: Math.cos(a) * SPEED * z,
        vy: Math.sin(a) * SPEED * z,
        z: z,
        r: 1 + z * 1.6,
        c: COLORS[(Math.random() * COLORS.length) | 0]
      };
    });
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);

    // lines
    for (let i = 0; i < dots.length; i++) {
      const a = dots[i];
      for (let j = i + 1; j < dots.length; j++) {
        const b = dots[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < LINK_DIST) {
          const alpha = (1 - d / LINK_DIST) * 0.5 * Math.min(a.z, b.z);
          ctx.strokeStyle = 'rgba(' + a.c + ',' + alpha + ')';
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
      if (mouse) {
        const dx = a.x - mouse.x, dy = a.y - mouse.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < LINK_DIST * 1.4) {
          ctx.strokeStyle = 'rgba(212,240,74,' + (1 - d / (LINK_DIST * 1.4)) * 0.6 + ')';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.stroke();
        }
      }
    }

    // dots (far ones are dimmer with a soft glow, near ones are crisp)
    dots.forEach(function (p) {
      if (p.z < 0.55) {
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
        g.addColorStop(0, 'rgba(' + p.c + ',0.35)');
        g.addColorStop(1, 'rgba(' + p.c + ',0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 4, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(' + p.c + ',' + (0.5 + p.z * 0.5) + ')';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  function move() {
    dots.forEach(function (p) {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < -10) p.x = w + 10;
      if (p.x > w + 10) p.x = -10;
      if (p.y < -10) p.y = h + 10;
      if (p.y > h + 10) p.y = -10;
    });
  }

  function loop() {
    rafId = requestAnimationFrame(loop);
    move();
    draw();
  }

  function onMove(e) {
    const r = sidebar.getBoundingClientRect();
    mouse = { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function onLeave() { mouse = null; }

  resize();
  if (reduceMotion) draw(); else rafId = requestAnimationFrame(loop);

  const ro = new ResizeObserver(function () { resize(); if (reduceMotion) draw(); });
  ro.observe(sidebar);
  sidebar.addEventListener('mousemove', onMove);
  sidebar.addEventListener('mouseleave', onLeave);

  return function stop() {
    cancelAnimationFrame(rafId);
    ro.disconnect();
    sidebar.removeEventListener('mousemove', onMove);
    sidebar.removeEventListener('mouseleave', onLeave);
  };
}

export default function NetworkBg() {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    const sidebar = canvas.parentElement;
    if (getComputedStyle(sidebar).position === 'static') sidebar.style.position = 'relative';
    return startNetwork(sidebar, canvas);
  }, []);
  return <canvas ref={ref} className="cc-sb__net" aria-hidden="true" />;
}
