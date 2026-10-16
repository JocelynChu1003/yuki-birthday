import { useEffect, useRef } from 'react';

type Props = {
  /** 是否持续放烟花 */
  active: boolean;
  /** 0–1，越大越密集越壮观 */
  intensity: number;
  className?: string;
};

type Particle = {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  life: number; lifeMax: number;
  size: number; hue: string;
  flicker: number;
  drag: number;
};

const GOLD = ['#fff3cf', '#ffe6a8', '#f6cf7e', '#e9b45c', '#d99a4a', '#fffaf0'];
const PARTY = ['#ffd9e6', '#ffc2d1', '#ffe9a8', '#fff3cf', '#b8f0ff', '#c9b6ff', '#ffd08a'];

let seed = 1;
function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
function pick<T>(arr: T[]) { return arr[Math.floor(rnd() * arr.length)]; }

/**
 * 真实感的 Canvas 烟花：火箭升空带尾迹 → 爆开成球状星火 → 重力下坠 → 余光渐暗。
 * 不用 DOM，满屏也不会卡。
 */
export default function Fireworks({ active, intensity, className }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const activeRef = useRef(active && intensity > 0);
  const mixRef = useRef(0);
  const spawnRef = useRef(0);

  activeRef.current = active && intensity > 0;
  // 彩蛋页面刻意压低：烟花只做背景，不抢小猫和文字的戏
  mixRef.current = Math.min(.35, Math.max(0, (intensity - 0.4) / 0.7));
  spawnRef.current = 1 + mixRef.current * 6;

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const ctx = el.getContext('2d');
    if (!ctx) return;

    let w = 0, h = 0, dpr = 1;
    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = el.clientWidth || window.innerWidth;
      h = el.clientHeight || window.innerHeight;
      el.width = Math.floor(w * dpr);
      el.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const particles: Particle[] = [];
    const rockets: Particle[] = [];
    let nextLaunch = 0;
    let nextBig = 900;
    let id = 0;
    let last = performance.now();

    const burst = (x: number, y: number, power: number, colors: string[]) => {
      const count = Math.round(70 + power * 130 + mixRef.current * 90);
      // 上限保护：粒子太多会让低配电脑掉帧，超过就丢掉最早的火星
      const room = Math.max(0, 4200 - particles.length);
      const n = Math.min(count, room);
      // 三分之一的球面用来制造“厚度”，看起来像立体的球，不是平的圆
      for (let i = 0; i < n; i++) {
        const theta = rnd() * Math.PI * 2;
        const phi = Math.acos(1 - 2 * rnd());
        const speed = (0.55 + rnd() * 0.85) * power * (0.9 + mixRef.current * 0.5);
        particles.push({
          x, y, z: 0,
          vx: Math.cos(theta) * Math.sin(phi) * speed,
          vy: Math.sin(theta) * Math.sin(phi) * speed,
          vz: Math.cos(phi) * speed,
          life: 1,
          lifeMax: 1.1 + rnd() * 0.9 + power * 0.35,
          size: 1.1 + rnd() * 1.9 + mixRef.current * 0.6,
          hue: pick(colors),
          flicker: 0.35 + rnd() * 0.65,
          drag: 0.965 + rnd() * 0.02
        });
      }
    };

    const launch = () => {
      const fromBottom = rnd() > 0.25;
      const x = w * (0.1 + rnd() * 0.8);
      const y = fromBottom ? h + 8 : h * (0.1 + rnd() * 0.5);
      const colors = mixRef.current > 0.4 && rnd() > 0.45 ? PARTY : GOLD;
      const power = (5.2 + rnd() * 3.4) * (1 + mixRef.current * 0.55);
      rockets.push({
        x, y, z: 0,
        vx: (rnd() - 0.5) * 0.7,
        vy: -(9.5 + rnd() * 4.5 + mixRef.current * 2.5),
        vz: 0,
        life: 1,
        lifeMax: 1.25 + rnd() * 0.55,
        size: 2.1,
        hue: pick(colors),
        flicker: 1,
        drag: 0.985
      });
      // 每支火箭带上自己的颜色任务，爆开时同色更真实
      (rockets[rockets.length - 1] as Particle & { palette?: string[] }).palette = colors;
      (rockets[rockets.length - 1] as Particle & { power?: number }).power = power;
    };

    const step = (now: number) => {
      const raw = (now - last) / 16.667;
      last = now;
      const dt = Math.min(2.4, Math.max(0.35, raw));

      // 尾迹：半透明覆盖，形成自然余晖
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = `rgba(0,0,0,${0.14 + mixRef.current * 0.06})`;
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';

      if (activeRef.current) {
        nextLaunch -= dt * 16.667;
        if (nextLaunch <= 0) { launch(); nextLaunch = (520 - mixRef.current * 430) * (0.55 + rnd() * 0.9); }
        nextBig -= dt * 16.667;
        if (nextBig <= 0) { // 偶尔来一发大的
          const bx = w * (0.25 + rnd() * 0.5);
          burst(bx, h * (0.18 + rnd() * 0.28), 10.5 + rnd() * 3, mixRef.current > 0.4 ? PARTY : GOLD);
          nextBig = 2600 + rnd() * 2600;
        }
      }

      // 火箭
      for (let i = rockets.length - 1; i >= 0; i--) {
        const p = rockets[i];
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.vy += 0.16 * dt;           // 重力
        p.vx *= p.drag; p.vy *= p.drag;
        p.life -= dt / (p.lifeMax * 60);
        // 拖尾
        ctx.beginPath();
        ctx.fillStyle = p.hue;
        ctx.globalAlpha = Math.max(0, p.life) * 0.9;
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = Math.max(0, p.life) * 0.25;
        ctx.beginPath();
        ctx.arc(p.x - p.vx * 2.2, p.y - p.vy * 2.2, p.size * 1.9, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        if (p.life <= 0 || p.vy >= 0) {
          const extra = (p as Particle & { palette?: string[]; power?: number });
          burst(p.x, p.y, extra.power ?? 8, extra.palette ?? GOLD);
          rockets.splice(i, 1);
        }
      }

      // 星火
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        p.vy += 0.115 * dt;                 // 重力下坠
        p.vx *= Math.pow(p.drag, dt); p.vy *= Math.pow(p.drag, dt); p.vz *= Math.pow(p.drag, dt);
        p.life -= dt / (p.lifeMax * 60);
        if (p.life <= 0) { particles.splice(i, 1); continue; }

        const depth = 1 + p.z / 340;                 // 近大远小，制造立体感
        const fade = p.life * p.life;                // 先亮后暗
        const flick = 0.72 + Math.abs(Math.sin(now / (42 * p.flicker))) * 0.28;
        const r = Math.max(0.35, p.size * depth) * (0.7 + fade * 0.9);
        ctx.globalAlpha = Math.max(0, Math.min(1, fade * flick));
        ctx.beginPath();
        ctx.fillStyle = p.hue;
        ctx.arc(p.x + p.z * 0.06, p.y, r, 0, Math.PI * 2);
        ctx.fill();
        if (r > 1.5) {                               // 亮核外面套一层柔光
          ctx.globalAlpha *= 0.32;
          ctx.beginPath();
          ctx.arc(p.x + p.z * 0.06, p.y, r * 2.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';

      id = requestAnimationFrame(step);
    };

    id = requestAnimationFrame(step);
    window.addEventListener('resize', resize);
    return () => { cancelAnimationFrame(id); window.removeEventListener('resize', resize); };
  }, [active, intensity]);

  return <canvas ref={canvas} className={className} aria-hidden="true" />;
}
