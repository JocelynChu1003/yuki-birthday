import { useEffect, useRef } from 'react';

type Star = {
  x: number; y: number;
  r: number;             // 基础半径
  base: number;          // 基础亮度
  amp: number;           // 闪烁幅度
  period: number;        // 闪烁周期（毫秒）
  phase: number;         // 起始相位（各自不同，才不会整齐划一）
  cross: boolean;        // 是否是带十字星芒的亮星
  warm: number;          // 0 偏冷白，1 偏暖黄
};

/** 固定种子，保证每次打开星空是同一片天，不会乱跳。 */
function makeRandom(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * 真实感星空：
 * - 亮度按幂律分布（很多暗星 + 少量亮星），接近真实夜空；
 * - 大小、亮度、闪烁周期、相位全部独立随机，永远不会“一排排整齐闪”；
 * - 一条淡淡的银河带，让天空有层次；
 * - 只有亮星有十字星芒和轻微呼吸，暗星基本不动。
 */
export default function Starfield({ className }: { className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const ctx = el.getContext('2d');
    if (!ctx) return;

    let w = 0, h = 0, dpr = 1;
    let stars: Star[] = [];
    let id = 0;

    const build = () => {
      const rnd = makeRandom(20021016);
      const count = Math.round(Math.min(520, Math.max(150, (w * h) / 4200)));
      stars = [];
      // 银河带：一条斜向的密集区
      const bandAngle = -0.42;
      for (let i = 0; i < count; i++) {
        const inBand = rnd() < 0.34;
        let x: number, y: number;
        if (inBand) {
          const t = rnd();
          const along = t * (w + h) - h * .5;
          const off = (rnd() + rnd() + rnd() - 1.5) * h * .17;   // 三次均匀分布叠加 ≈ 自然聚拢
          x = along * Math.cos(bandAngle) - off * Math.sin(bandAngle);
          y = along * Math.sin(bandAngle) + off * Math.cos(bandAngle) + h * .52;
        } else {
          x = rnd() * w;
          y = rnd() * h;
        }
        if (x < -10 || x > w + 10 || y < -10 || y > h + 10) continue;

        // 幂律：大多数很暗，极少数很亮
        const mag = Math.pow(rnd(), 2.6);
        stars.push({
          x, y,
          r: .35 + mag * 1.7,
          base: .18 + mag * .82,
          amp: .08 + rnd() * .3,
          period: 2200 + rnd() * 6800,
          phase: rnd() * Math.PI * 2,
          cross: mag > .78,
          warm: rnd()
        });
      }
    };

    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = el.clientWidth || window.innerWidth;
      h = el.clientHeight || window.innerHeight;
      el.width = Math.floor(w * dpr);
      el.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
    };

    const color = (warm: number, a: number) => {
      const r = Math.round(248 + warm * 7);
      const g = Math.round(240 - warm * 12);
      const b = Math.round(226 - warm * 46);
      return `rgba(${r},${g},${b},${a})`;
    };

    const draw = (now: number) => {
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        const tw = 1 + Math.sin(now / s.period * Math.PI * 2 + s.phase) * s.amp;
        const a = Math.max(0, Math.min(1, s.base * tw));
        ctx.beginPath();
        ctx.fillStyle = color(s.warm, a);
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();

        if (s.r > .75) {                     // 稍微柔化一下边缘，别像像素点
          ctx.beginPath();
          ctx.fillStyle = color(s.warm, a * .16);
          ctx.arc(s.x, s.y, s.r * 2.6, 0, Math.PI * 2);
          ctx.fill();
        }
        if (s.cross) {                       // 亮星的十字星芒
          const len = s.r * 6.5 * tw;
          ctx.globalAlpha = a * .5;
          ctx.strokeStyle = color(s.warm, 1);
          ctx.lineWidth = .7;
          ctx.beginPath();
          ctx.moveTo(s.x - len, s.y); ctx.lineTo(s.x + len, s.y);
          ctx.moveTo(s.x, s.y - len); ctx.lineTo(s.x, s.y + len);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }
      id = requestAnimationFrame(draw);
    };

    resize();
    id = requestAnimationFrame(draw);
    window.addEventListener('resize', resize);
    return () => { cancelAnimationFrame(id); window.removeEventListener('resize', resize); };
  }, []);

  return <canvas ref={canvas} className={className} aria-hidden="true" />;
}
