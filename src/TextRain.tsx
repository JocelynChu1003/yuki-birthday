import { useMemo } from 'react';

type Props = {
  text: string;
  /** 横向切成几列、纵向切成几行；每个格子里随机放一条，铺满整屏又不会挤成一团 */
  cols?: number;
  rows?: number;
  className?: string;
};

type Item = {
  x: number; y: number; size: number; rot: number;
  delay: number; dur: number; drift: number; opacity: number; bright: number;
};

/**
 * 满屏滚落的文字：
 * - 用“格子 + 格内随机”的方式铺满整个屏幕，不会出现一团一团的堆积；
 * - 字号用幂律分布（很多正常大小 + 少量特别大），疏密有致；
 * - 每一条的延迟、时长、漂移都独立随机，看起来是自然落下而不是整齐同步。
 */
export default function TextRain({ text, cols = 13, rows = 14, className }: Props) {
  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    const total = cols * rows;
    for (let i = 0; i < total; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      // 少量“大件”负责气势，多数正常大小保证密度
      const big = Math.random() > 0.9;
      const size = big ? 40 + Math.random() * 34 : 17 + Math.random() * 20;
      out.push({
        x: ((col + 0.5) / cols) * 100 + (Math.random() - 0.5) * (90 / cols),
        y: ((row + 0.5) / rows) * 100 + (Math.random() - 0.5) * (80 / rows),
        size,
        rot: (Math.random() - 0.5) * 20,
        delay: (row / rows) * 1.3 + Math.random() * 1.5,
        dur: 4.4 + Math.random() * 3.6,
        drift: (Math.random() - 0.5) * 10,
        opacity: big ? 0.8 + Math.random() * 0.2 : 0.3 + Math.random() * 0.45,
        bright: Math.random()
      });
    }
    return out;
  }, [text, cols, rows]);

  return (
    <div className={`text-rain ${className || ''}`} aria-hidden="true">
      {items.map((it, i) => (
        <span
          key={i}
          className={it.bright > 0.8 ? 'rain-glow' : undefined}
          style={{
            left: `${it.x}%`,
            top: `${it.y}%`,
            fontSize: `${it.size}px`,
            '--rot': `${it.rot}deg`,
            '--drift': `${it.drift}vw`,
            animationDelay: `${it.delay}s`,
            animationDuration: `${it.dur}s`,
            '--alpha': it.opacity
          } as React.CSSProperties}
        >
          {text}
        </span>
      ))}
    </div>
  );
}
