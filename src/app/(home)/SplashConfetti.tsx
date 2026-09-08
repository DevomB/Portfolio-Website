"use client";

import { useEffect, useRef } from "react";

// One canvas, one rAF loop, a fixed particle budget, and it tears itself down
// when the last particle leaves the screen — confetti with none of the DOM cost.
// Colors are the brand palette: royal purple, joker green, card-face white.
const COLORS = ["#7c00ff", "#a35cff", "#09ff00", "#5cff55", "#f2eefa"];

type Particle = {
  x: number; y: number;      // px (CSS space)
  vx: number; vy: number;    // px/s
  w: number; h: number;
  rot: number; vr: number;   // rad, rad/s
  phase: number; freq: number; amp: number; // flutter
  born: number;              // s, spawn offset from start
  life: number;              // s
  color: string;
};

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pickColor = () => COLORS[Math.floor(Math.random() * COLORS.length)]!;

/** two cannons at the bottom corners, firing up and inward */
function spawnBurst(count: number, W: number, H: number): Particle[] {
  return Array.from({ length: count }, (_, i) => {
    const left = i % 2 === 0;
    const angle = ((left ? -75 : -105) + rand(-14, 14)) * (Math.PI / 180);
    const speed = rand(0.85, 1.55) * H;
    return {
      x: left ? W * 0.06 : W * 0.94, y: H * 0.98,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      w: rand(5, 9), h: rand(8, 14), rot: rand(0, Math.PI * 2), vr: rand(-9, 9),
      phase: rand(0, Math.PI * 2), freq: rand(3, 7), amp: rand(8, 26),
      born: rand(0, 0.18), life: rand(2.0, 3.0), color: pickColor(),
    };
  });
}

/** top drizzle for the monsters */
function spawnRain(count: number, W: number, H: number): Particle[] {
  return Array.from({ length: count }, () => ({
    x: rand(0, W), y: rand(-H * 0.12, -10),
    vx: rand(-30, 30), vy: rand(60, 160),
    w: rand(5, 9), h: rand(8, 14), rot: rand(0, Math.PI * 2), vr: rand(-7, 7),
    phase: rand(0, Math.PI * 2), freq: rand(2, 5), amp: rand(14, 34),
    born: rand(0.1, 1.1), life: rand(2.6, 3.6), color: pickColor(),
  }));
}

/** the burst, plus the drizzle for big hands */
function spawnAll(count: number, rain: boolean, W: number, H: number): Particle[] {
  const burstCount = rain ? Math.floor(count * 0.7) : count;
  return [...spawnBurst(burstCount, W, H), ...(rain ? spawnRain(count - burstCount, W, H) : [])];
}

/** what one frame applies to every particle */
type Frame = { dt: number; slow: number; gravity: number };

/** advance one particle by dt seconds under gravity, drag, and flutter */
function stepParticle(p: Particle, age: number, f: Frame) {
  p.vx *= f.slow;
  p.vy = p.vy * f.slow + f.gravity * f.dt;
  p.x += p.vx * f.dt + Math.sin(p.phase + age * p.freq) * p.amp * f.dt;
  p.y += p.vy * f.dt;
  p.rot += p.vr * f.dt;
}

/** draw one particle; cos gives the tumble a 3D read for free */
function drawParticle(ctx: CanvasRenderingContext2D, p: Particle, age: number, dpr: number) {
  const fade = age > p.life * 0.72 ? 1 - (age - p.life * 0.72) / (p.life * 0.28) : 1;
  ctx.globalAlpha = Math.max(0, fade);
  ctx.fillStyle = p.color;
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot);
  const tumble = Math.cos(age * p.freq);
  ctx.fillRect(-p.w / 2, (-p.h / 2) * tumble, p.w, p.h * Math.abs(tumble) + 1);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

type Stage = { ctx: CanvasRenderingContext2D; W: number; H: number; dpr: number };

/** size the canvas for the device; null when there is no 2D context */
function stageFor(canvas: HTMLCanvasElement): Stage | null {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const W = canvas.clientWidth;
  const H = canvas.clientHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.scale(dpr, dpr);
  return { ctx, W, H, dpr };
}

/** run the animation loop until the last particle leaves (or five seconds); returns the stop */
function animate(stage: Stage, particles: Particle[]): () => void {
  const { ctx, W, H, dpr } = stage;
  const gravity = 1.35 * H;   // px/s² — scaled so arcs read the same at any size
  const drag = 0.9;           // per second
  let raf = 0;
  let stopped = false;
  let last = performance.now();
  const t0 = last;

  const frame = (now: number) => {
    if (stopped) return;
    const dt = Math.min((now - last) / 1000, 1 / 30);
    last = now;
    const elapsed = (now - t0) / 1000;

    ctx.clearRect(0, 0, W, H);
    const f: Frame = { dt, slow: Math.pow(drag, dt), gravity }; // slow is loop-invariant per frame
    let alive = 0;
    for (const p of particles) {
      const age = elapsed - p.born;
      if (age < 0) { alive++; continue; }
      if (age > p.life || p.y > H + 24) continue;
      alive++;
      stepParticle(p, age, f);
      drawParticle(ctx, p, age, dpr);
    }
    ctx.globalAlpha = 1;

    if (alive > 0 && elapsed < 5) raf = requestAnimationFrame(frame);
    else ctx.clearRect(0, 0, W, H);
  };
  // first tick now, so the burst starts on the frame the timer fires
  frame(performance.now());

  return () => {
    stopped = true;
    cancelAnimationFrame(raf);
  };
}

/** After `delayMs`: size the canvas, spawn the particles, animate. Returns the teardown. */
function runConfetti(canvas: HTMLCanvasElement, count: number, rain: boolean, delayMs: number): () => void {
  let cancel: (() => void) | null = null;
  let stopped = false;
  const timer = setTimeout(() => {
    if (stopped) return;
    const stage = stageFor(canvas);
    if (!stage) return;
    cancel = animate(stage, spawnAll(count, rain, stage.W, stage.H));
  }, delayMs);

  return () => {
    stopped = true;
    clearTimeout(timer);
    cancel?.();
  };
}

export default function SplashConfetti({
  delayMs,
  count,
  rain = false,
}: {
  delayMs: number;
  count: number;
  /** big hands also get a drizzle from the top edge */
  rain?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    return runConfetti(canvas, count, rain, delayMs);
  }, [delayMs, count, rain]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{ zIndex: 30, width: "100%", height: "100%" }}
    />
  );
}
