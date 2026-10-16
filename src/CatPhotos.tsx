type Props = {
  /** 图片地址列表，放在 public/photos/ 下，用 /photos/xxx.jpg 引用 */
  photos: string[];
  /** 每张图下面显示的小名字（按顺序对应，会自动循环） */
  names?: string[];
  /** 每张图的落地位置（百分比）、倾斜角度、大小系数与飘入延迟 */
  spots?: Array<{ x: number; y: number; rot: number; delay: number; w: number }>;
};

/**
 * 默认的摊开位置：整屏铺开一圈，中间留出呼吸位，
 * 让每只猫都能看清，又不会和中间的文字糊在一起。
 */
const DEFAULT_SPOTS = [
  { x: 12, y: 24, rot: -7, delay: 0.00, w: 1.00 },
  { x: 29, y: 10, rot: 5, delay: 0.40, w: 0.86 },
  { x: 50, y: 21, rot: -3, delay: 0.80, w: 1.05 },
  { x: 71, y: 10, rot: 7, delay: 0.25, w: 0.88 },
  { x: 88, y: 26, rot: -8, delay: 0.65, w: 1.00 },
  { x: 17, y: 62, rot: 6, delay: 1.05, w: 0.92 },
  { x: 50, y: 68, rot: -5, delay: 1.30, w: 1.10 },
  { x: 84, y: 64, rot: 8, delay: 0.95, w: 0.94 },
  { x: 34, y: 86, rot: -4, delay: 1.55, w: 0.84 },
  { x: 68, y: 88, rot: 5, delay: 1.20, w: 0.90 },
  { x: 5, y: 45, rot: -9, delay: 1.70, w: 0.82 },
  { x: 95, y: 46, rot: 9, delay: 1.45, w: 0.82 }
];

/** 彩蛋里飘出来的小照片：整屏摊开，轻轻地来，然后一直陪在旁边（停留很久）。 */
export default function CatPhotos({ photos, names, spots = DEFAULT_SPOTS }: Props) {
  return (
    <div className="cat-photos" aria-hidden="true">
      {photos.map((src, i) => {
        const spot = spots[i % spots.length];
        const name = names && names.length ? names[i % names.length] : '';
        return (
          <figure
            key={src}
            className="cat-shot"
            style={{
              left: `${spot.x}%`,
              top: `${spot.y}%`,
              '--rot': `${spot.rot}deg`,
              '--w': spot.w,
              animationDelay: `${spot.delay}s`
            } as React.CSSProperties}
          >
            <img src={src} alt="" loading="eager" decoding="async" />
            {name && <figcaption>{name}</figcaption>}
          </figure>
        );
      })}
    </div>
  );
}
