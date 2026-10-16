/**
 * 手势判断（纯函数，方便单独测试，也和相机解耦）。
 *
 * 用 MediaPipe 手部 21 个关键点里的 5 个指尖 + 相关指根：
 *   0 手腕  5/9/13/17 四指根部  4/8/12/16/20 五个指尖
 *
 * 阈值是拿**真实 MediaPipe 关键点数据**校准出来的（见下方注释里的实测值），
 * 所以正常张开手掌就能认出来，不会像旧版那样要求手张得特别夸张。
 */

export type HandPoint = { x: number; y: number; z?: number };
export type Gesture = 'open' | 'fist' | 'unclear';

const TIPS = [4, 8, 12, 16, 20];
const MCPS = [5, 9, 13, 17];

const dist = (a: HandPoint, b: HandPoint) => Math.hypot(a.x - b.x, a.y - b.y);

/** 手掌尺度：手腕到四个指根的平均距离（手离镜头远近会被这个值约掉）。 */
function palmScale(hand: HandPoint[]): number {
  const s = (dist(hand[0], hand[5]) + dist(hand[0], hand[9]) + dist(hand[0], hand[13]) + dist(hand[0], hand[17])) / 4;
  return s > 0 ? s : 0;
}

/** 五个指尖各自“离手腕的距离 ÷ 手掌尺度”。
 *  实测：张开的手 1.40 / 1.29 / 1.29 / 1.29 / 1.16，握拳 0.62 / 0.86 / 0.86 / 0.86 / 0.52。 */
function tipRatios(hand: HandPoint[]): number[] {
  const scale = palmScale(hand);
  if (scale <= 0) return [];
  return TIPS.map(tip => dist(hand[0], hand[tip]) / scale);
}

/** 张开的手：五个指尖都远离手腕，像“布”。 */
export function isOpenPalm(hand: HandPoint[]): boolean {
  if (hand.length < 21) return false;
  const r = tipRatios(hand);
  if (!r.length) return false;
  const away = r.filter(v => v > 1.12).length;
  const thumbAway = r[0] > 1.02;
  return away >= 4 || (away >= 3 && thumbAway);
}

/** 握拳：五个指尖都收回到手腕附近，像“石头”。 */
export function isFist(hand: HandPoint[]): boolean {
  if (hand.length < 21) return false;
  const r = tipRatios(hand);
  if (!r.length) return false;
  return r.filter(v => v < 1.02).length >= 4 && r.every(v => v < 1.2);
}

/** 综合判断：先看拳头，再看张开的手，都不是就返回“看不清”。 */
export function classifyHand(hand: HandPoint[]): Gesture {
  if (isFist(hand)) return 'fist';
  if (isOpenPalm(hand)) return 'open';
  return 'unclear';
}

/** 伸出手指的根数（只用于界面上给人看的提示）。 */
export function extendedFingers(hand: HandPoint[]): number {
  const r = tipRatios(hand);
  return r.filter(v => v > 1.12).length;
}
