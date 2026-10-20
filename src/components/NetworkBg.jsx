import { useEffect, useRef } from 'react';

export default function NetworkBg({ fullScreen = false }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const parent = fullScreen ? null : canvas.parentElement;

    const DENSITY = fullScreen ? 3600 : 2000; // lower = more nodes
    const LINK_DIST = fullScreen ? 140 : 120; // max distance between connected nodes
    const SPEED = 0.32; // drift speed
    const COLORS = [
      '0, 200, 235',
      '0, 200, 235',
      '79, 214, 248',
      '120, 170, 255',
      '212, 240, 74',
    ];
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let w = 0;
    let h = 0;
    let dots = [];
    let mouse = null;
    let rafId = 0;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = fullScreen ? window.innerWidth : (parent?.clientWidth || window.innerWidth);
      h = fullScreen ? window.innerHeight : (parent?.clientHeight || 600);

      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.max(35, Math.round((w * h) / DENSITY));
      dots = Array.from({ length: count }, () => {
        const z = 0.3 + Math.random() * 0.7; // 3D depth layer
        const angle = Math.random() * Math.PI * 2;
        return {
          x: Math.random() * w,
          y: Math.random() * h,
          vx: Math.cos(angle) * SPEED * z,
          vy: Math.sin(angle) * SPEED * z,
          z,
          r: 1.3 + z * 1.8,
          c: COLORS[(Math.random() * COLORS.length) | 0],
        };
      });
    }

    function draw() {
      ctx.clearRect(0, 0, w, h);

      // Draw neural connections between nodes
      for (let i = 0; i < dots.length; i++) {
        const a = dots[i];
        for (let j = i + 1; j < dots.length; j++) {
          const b = dots[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < LINK_DIST) {
            const alpha = (1 - dist / LINK_DIST) * 0.5 * Math.min(a.z, b.z);
            ctx.strokeStyle = `rgba(${a.c}, ${alpha})`;
            ctx.lineWidth = 0.85;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }

        // Draw glowing connections to mouse cursor
        if (mouse) {
          const dx = a.x - mouse.x;
          const dy = a.y - mouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < LINK_DIST * 1.5) {
            const alpha = (1 - dist / (LINK_DIST * 1.5)) * 0.75;
            ctx.strokeStyle = `rgba(212, 240, 74, ${alpha})`;
            ctx.lineWidth = 1.25;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.stroke();
          }
        }
      }

      // Draw nodes with radial cyber glow
      for (const p of dots) {
        if (p.z < 0.55) {
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
          g.addColorStop(0, `rgba(${p.c}, 0.5)`);
          g.addColorStop(1, `rgba(${p.c}, 0)`);
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * 4, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = `rgba(${p.c}, ${0.6 + p.z * 0.4})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    function move() {
      for (const p of dots) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -15) p.x = w + 15;
        if (p.x > w + 15) p.x = -15;
        if (p.y < -15) p.y = h + 15;
        if (p.y > h + 15) p.y = -15;
      }
    }

    function loop() {
      rafId = requestAnimationFrame(loop);
      move();
      draw();
    }

    function onMove(e) {
      if (fullScreen) {
        mouse = { x: e.clientX, y: e.clientY };
      } else if (parent) {
        const rect = parent.getBoundingClientRect();
        mouse = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      }
    }

    function onLeave() {
      mouse = null;
    }

    resize();
    if (reduceMotion) {
      draw();
    } else {
      rafId = requestAnimationFrame(loop);
    }

    let ro = null;
    if (fullScreen) {
      window.addEventListener('resize', resize);
      window.addEventListener('mousemove', onMove, { passive: true });
      document.addEventListener('mouseleave', onLeave);
    } else if (parent) {
      ro = new ResizeObserver(() => {
        resize();
        if (reduceMotion) draw();
      });
      ro.observe(parent);
      parent.addEventListener('mousemove', onMove, { passive: true });
      parent.addEventListener('mouseleave', onLeave);
    }

    return () => {
      cancelAnimationFrame(rafId);
      if (fullScreen) {
        window.removeEventListener('resize', resize);
        window.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseleave', onLeave);
      } else {
        ro?.disconnect();
        parent?.removeEventListener('mousemove', onMove);
        parent?.removeEventListener('mouseleave', onLeave);
      }
    };
  }, [fullScreen]);

  return (
    <canvas
      ref={canvasRef}
      className={fullScreen ? 'cc-bgnet-canvas' : 'cc-hero-net'}
      aria-hidden="true"
      style={
        fullScreen
          ? {
              position: 'fixed',
              inset: 0,
              width: '100vw',
              height: '100vh',
              zIndex: 0,
              pointerEvents: 'none',
              opacity: 0.85,
            }
          : {
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              zIndex: 0,
              pointerEvents: 'none',
            }
      }
    />
  );
}
