'use client';

import { useEffect, useRef, useState } from 'react';

interface Point {
  baseX: number;
  baseY: number;
  x: number;
  y: number;
}

export default function ElasticGridBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDark, setIsDark] = useState<boolean>(true);

  useEffect(() => {
    // Dynamic Theme Detection
    const checkTheme = () => {
      const isDarkMode =
        document.documentElement.classList.contains('dark') ||
        document.body.classList.contains('dark') ||
        (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
      setIsDark(isDarkMode);
    };

    checkTheme();

    const observer = new MutationObserver(() => {
      checkTheme();
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = window.innerWidth;
    let height = window.innerHeight;

    // Grid Parameters: Clean spacing, subtle wave ripple radius
    const GRID_SPACING = 46;
    const MOUSE_RADIUS = 140;
    const MAX_WAVE_DISPLACEMENT = 7; // Max 7px displacement (gentle wave, zero jerking)

    // Mouse Tracking
    const mouse = {
      x: -1000,
      y: -1000,
      targetX: -1000,
      targetY: -1000,
      active: false,
    };

    let cols = Math.ceil(width / GRID_SPACING) + 1;
    let rows = Math.ceil(height / GRID_SPACING) + 1;
    let grid: Point[][] = [];

    const initGrid = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.scale(dpr, dpr);

      cols = Math.ceil(width / GRID_SPACING) + 1;
      rows = Math.ceil(height / GRID_SPACING) + 1;
      grid = [];

      for (let i = 0; i < cols; i++) {
        grid[i] = [];
        for (let j = 0; j < rows; j++) {
          const baseX = i * GRID_SPACING;
          const baseY = j * GRID_SPACING;
          grid[i][j] = {
            baseX,
            baseY,
            x: baseX,
            y: baseY,
          };
        }
      }
    };

    initGrid();

    const handleResize = () => {
      initGrid();
    };

    window.addEventListener('resize', handleResize);

    const handleMouseMove = (e: MouseEvent) => {
      mouse.targetX = e.clientX;
      mouse.targetY = e.clientY;
      mouse.active = true;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        mouse.targetX = e.touches[0].clientX;
        mouse.targetY = e.touches[0].clientY;
        mouse.active = true;
      }
    };

    const handleMouseLeave = () => {
      mouse.active = false;
      mouse.targetX = -1000;
      mouse.targetY = -1000;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('mouseleave', handleMouseLeave);
    window.addEventListener('touchend', handleMouseLeave);

    // Render Loop (60 FPS)
    const render = () => {
      // Smooth lerp mouse coordinates
      mouse.x += (mouse.targetX - mouse.x) * 0.1;
      mouse.y += (mouse.targetY - mouse.y) * 0.1;

      ctx.clearRect(0, 0, width, height);

      // Calculate Smooth Wave Displacement (Jitter-free position LERP)
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const pt = grid[i][j];

          let targetX = pt.baseX;
          let targetY = pt.baseY;

          if (mouse.active) {
            const dx = mouse.x - pt.baseX;
            const dy = mouse.y - pt.baseY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < MOUSE_RADIUS && dist > 0) {
              // Smooth sine wave ripple curve across interaction radius
              const wave = Math.sin((dist / MOUSE_RADIUS) * Math.PI) * MAX_WAVE_DISPLACEMENT;
              const angle = Math.atan2(dy, dx);

              targetX += Math.cos(angle) * wave;
              targetY += Math.sin(angle) * wave;
            }
          }

          // Smooth lerp toward static wave target (Zero velocity jitter when stationary)
          pt.x += (targetX - pt.x) * 0.12;
          pt.y += (targetY - pt.y) * 0.12;
        }
      }

      // Soft Opacity Color Palette
      const baseLineColor = isDark
        ? 'rgba(99, 102, 241, 0.08)' // Soft subtle indigo tint in dark mode
        : 'rgba(79, 70, 229, 0.09)'; // Soft subtle indigo tint in light mode

      const accentWarpColor = isDark
        ? 'rgba(168, 85, 247, 0.25)' // Soft purple accent tint
        : 'rgba(99, 102, 241, 0.25)';

      ctx.lineWidth = 1.0;

      // Draw Horizontal Grid Lines
      for (let j = 0; j < rows; j++) {
        ctx.beginPath();
        ctx.strokeStyle = baseLineColor;
        for (let i = 0; i < cols; i++) {
          const pt = grid[i][j];
          if (i === 0) {
            ctx.moveTo(pt.x, pt.y);
          } else {
            ctx.lineTo(pt.x, pt.y);
          }
        }
        ctx.stroke();
      }

      // Draw Vertical Grid Lines
      for (let i = 0; i < cols; i++) {
        ctx.beginPath();
        ctx.strokeStyle = baseLineColor;
        for (let j = 0; j < rows; j++) {
          const pt = grid[i][j];
          if (j === 0) {
            ctx.moveTo(pt.x, pt.y);
          } else {
            ctx.lineTo(pt.x, pt.y);
          }
        }
        ctx.stroke();
      }

      // Draw Soft Wave Segment Highlights
      if (mouse.active) {
        for (let i = 0; i < cols; i++) {
          for (let j = 0; j < rows; j++) {
            const pt = grid[i][j];
            const dx = pt.x - pt.baseX;
            const dy = pt.y - pt.baseY;
            const displacement = Math.sqrt(dx * dx + dy * dy);

            if (displacement > 0.6) {
              if (i < cols - 1) {
                const rightPt = grid[i + 1][j];
                ctx.beginPath();
                ctx.moveTo(pt.x, pt.y);
                ctx.lineTo(rightPt.x, rightPt.y);
                ctx.strokeStyle = accentWarpColor;
                ctx.lineWidth = 1.1;
                ctx.stroke();
              }

              if (j < rows - 1) {
                const bottomPt = grid[i][j + 1];
                ctx.beginPath();
                ctx.moveTo(pt.x, pt.y);
                ctx.lineTo(bottomPt.x, bottomPt.y);
                ctx.strokeStyle = accentWarpColor;
                ctx.lineWidth = 1.1;
                ctx.stroke();
              }
            }
          }
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('touchend', handleMouseLeave);
    };
  }, [isDark]);

  return (
    <div
      className="fixed inset-0 z-0 pointer-events-none overflow-hidden select-none"
      style={{
        WebkitMaskImage:
          'linear-gradient(65deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.45) 45%, rgba(0,0,0,0.1) 75%, rgba(0,0,0,0) 95%)',
        maskImage:
          'linear-gradient(65deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.45) 45%, rgba(0,0,0,0.1) 75%, rgba(0,0,0,0) 95%)',
      }}
    >
      <canvas ref={canvasRef} className="block w-full h-full" />
    </div>
  );
}
