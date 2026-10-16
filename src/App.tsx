import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cardSurprises, cards, catLine, catNames, catPhotos, letter, secretWord, version } from './content';
import CatPhotos from './CatPhotos';
import Fireworks from './Fireworks';
import Starfield from './Starfield';
import TextRain from './TextRain';

type Scene = 'opening' | 'archive' | 'cake' | 'wish' | 'heart' | 'letter' | 'ending';

const chapter: Record<Scene, string> = { opening: '00 / 04', archive: '01 / 04', cake: '02 / 04', wish: '02 / 04', heart: '03 / 04', letter: '04 / 04', ending: '∞ / 04' };

/** 蜡烛长度：12 张卡片按 2 / 4 / 3 / 3 分四层叠成一块蛋糕。 */
const cakeLayers = [['42%', '64%'], ['27%', '64%'], ['20%', '52%'], ['47%', '52%'], ['68%', '52%'], ['16%', '40%'], ['39%', '40%'], ['62%', '40%'], ['28%', '28%'], ['43%', '28%'], ['58%', '28%'], ['43%', '16%']];
/** 散落时的落点：铺满整块舞台，互不重叠。 */
const scatterSpots = [
  ['2%', '6%'], ['26%', '1%'], ['50%', '5%'], ['74%', '2%'],
  ['13%', '33%'], ['38%', '28%'], ['63%', '31%'], ['86%', '35%'],
  ['4%', '60%'], ['24%', '70%'], ['48%', '66%'], ['72%', '72%']
];

/** 把暗号里的全角符号也认成半角，避免中文输入法打不出来。 */
function normalize(v: string) {
  return v.trim().replace(/[\uFF01-\uFF5E]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)).replace(/\s+/g, '').toLowerCase();
}

export default function App() {
  const [scene, setScene] = useState<Scene>('opening');
  const [openingLine, setOpeningLine] = useState(0);
  const [introStarted, setIntroStarted] = useState(false);
  /** 0 = 完全聚合成蛋糕，1 = 完全散开 */
  const [spread, setSpread] = useState(1);
  const launched = useRef(false);
  const [mic, setMic] = useState(false);
  const [micBusy, setMicBusy] = useState(false);
  const [micPop, setMicPop] = useState(false);
  const [lit, setLit] = useState(true);
  const [heartStep, setHeartStep] = useState(0);
  const [muted, setMuted] = useState(true);
  const [note, setNote] = useState('');
  const [letterOpen, setLetterOpen] = useState(false);
  const [letterTurn, setLetterTurn] = useState({ x: -6, y: 10 });
  // 结尾
  const [endingStep, setEndingStep] = useState<'fireworks' | 'ask' | 'boom' | 'final'>('fireworks');
  const [secret, setSecret] = useState('');
  const [secretMsg, setSecretMsg] = useState('');
  /** 点开的卡片序号（null 表示没有打开任何惊喜） */
  const [openCard, setOpenCard] = useState<number | null>(null);

  const stageRef = useRef<HTMLDivElement>(null);
  const streams = useRef<MediaStream[]>([]);
  const stopTrack = useRef<(() => void) | null>(null);
  const letterPointer = useRef<{ x: number; y: number } | null>(null);
  const letterDrag = useRef(0);
  const audio = useRef<HTMLAudioElement | null>(null);
  const baseVolume = useRef(.42);

  const line = openingLine === 0
    ? '正在载入一段只属于你的宇宙……'
    : 'Yuki Chu，欢迎回到属于你的星系。';

  const paragraphs = useMemo(() => letter.split('\n').map(p => p.trim()).filter(Boolean), []);

  /* ── 开场打字机 ── */
  useEffect(() => {
    if (openingLine !== 0) return;
    const id = window.setTimeout(() => setOpeningLine(1), 4100);
    return () => clearTimeout(id);
  }, [openingLine]);

  /* ── 离开时清理相机与音乐 ── */
  useEffect(() => () => {
    stopTrack.current?.();
    streams.current.forEach(s => s.getTracks().forEach(t => t.stop()));
    audio.current?.pause();
  }, []);

  /* ── 键盘：只在需要时绑定一次 ── */
  const blown = useRef(false);
  const blowOut = useCallback(() => {
    if (blown.current) return;
    blown.current = true;
    setLit(false);
    setNote('愿你想要的一切，都在奔向你的路上。');
    window.setTimeout(() => setScene('heart'), 3400);
  }, []);

  const launchFilm = useCallback(() => {
    if (launched.current) return;
    launched.current = true;
    setIntroStarted(true);
    startAmbient();
    window.setTimeout(() => setScene('archive'), 2000);
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (scene === 'cake') {
        if (e.key.toLowerCase() === 'g') setSpread(0);
        if (e.key.toLowerCase() === 's') setSpread(1);
      }
      if (scene === 'wish' && e.code === 'Space') { e.preventDefault(); blowOut(); }
      if (scene === 'heart' && (e.key === 'Enter' || e.key.startsWith('Arrow'))) setHeartStep(v => Math.min(6, v + 1));
      if (scene === 'opening' && e.key !== 'Tab') launchFilm();
    };
    addEventListener('keydown', handleKey);
    return () => removeEventListener('keydown', handleKey);
  }, [scene, blowOut, launchFilm]);

  useEffect(() => { if (heartStep === 6) window.setTimeout(() => setScene('letter'), 1800); }, [heartStep]);

  /* ── 结尾节奏：烟花先放一会儿，再出现暗号框 ── */
  useEffect(() => {
    if (scene !== 'ending') return;
    setEndingStep('fireworks');
    setSecret(''); setSecretMsg('');
    const id = window.setTimeout(() => setEndingStep('ask'), 9000);
    return () => clearTimeout(id);
  }, [scene]);

  /* ── 麦克风吹蜡烛 ── */
  const [gUMFailedMic, setGUMFailedMic] = useState(false);
  const micPopTimer = useRef<number | null>(null);
  const showMicPop = useCallback(() => {
    setGUMFailedMic(true);
    setMicPop(true);
    if (micPopTimer.current) window.clearTimeout(micPopTimer.current);
    micPopTimer.current = window.setTimeout(() => setMicPop(false), 28000);
  }, []);
  const closeMicPop = useCallback(() => {
    if (micPopTimer.current) window.clearTimeout(micPopTimer.current);
    setMicPop(false);
  }, []);

  /* ── 麦克风吹蜡烛 ── */
  async function enableMic() {
    if (mic) { setNote('麦克风已经在听了，对着它轻轻、持续地吹一口气。'); return; }
    if (micBusy) return;
    setMicBusy(true);

    if (!navigator.mediaDevices?.getUserMedia) {
      setNote('这个浏览器不支持麦克风调用。可以点“轻触吹灭”或按空格键。');
      setMicBusy(false);
      return;
    }

    // 和摄像头一样：Safari 的权限查询不可靠，所以无论查到什么都照样去请求，绝不自己拦掉弹窗
    let state = 'unknown';
    try {
      const status = await navigator.permissions?.query({ name: 'microphone' as PermissionName });
      state = status?.state || 'unknown';
    } catch { state = 'unknown'; }

    if (state === 'denied') {
      setNote('浏览器说麦克风是“拒绝”状态，我会再试一次；如果屏幕上没有弹窗，请看下方弹出的解决办法。');
      showMicPop();
    } else if (state === 'granted') {
      setNote('浏览器已授权，正在打开麦克风……');
    } else {
      setNote('已向浏览器申请麦克风权限，请看屏幕上方的询问窗口（有时会被地址栏挡住）……');
    }

    let stream: MediaStream | null = null;
    try {
      stream = await Promise.race([
        navigator.mediaDevices.getUserMedia({ audio: true, video: false }),
        new Promise<never>((_, reject) => window.setTimeout(() => reject(Object.assign(new Error('timeout'), { name: 'TimeoutError' })), 15000))
      ]);
    } catch (err) {
      const kind = err instanceof Error ? err.name : 'Error';
      if (kind === 'NotAllowedError' || kind === 'SecurityError') {
        setNote('麦克风权限没有拿到。解决办法已经写在上方的小窗口里，照着点两下就好。');
        showMicPop();
      } else if (kind === 'NotFoundError') {
        setNote('没有找到麦克风。可以直接点“轻触吹灭”或按空格键，效果一样。');
      } else if (kind === 'NotReadableError') {
        setNote('麦克风被别的软件占用了（比如录音、视频会议）。关掉它们再点一次。');
      } else {
        setNote(`打不开麦克风（${kind}）。可以直接点“轻触吹灭”或按空格键。`);
      }
      setMicBusy(false);
      return;
    }

    try {
      streams.current.push(stream); setMic(true);
      setGUMFailedMic(false);                 // 成功后就恢复按钮文案
      setNote('正在校准 2 秒，请先保持安静……（校准完就可以吹了）');
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;                 // 频率点更细，才好分辨“吹气”的沙沙声
      analyser.smoothingTimeConstant = .2;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const wave = new Uint8Array(analyser.fftSize);
      const freq = new Uint8Array(analyser.frequencyBinCount);
      const start = performance.now();
      let sustained = 0, floorRms = 0, floorHi = 0, samples = 0, alive = true;

      const listen = () => {
        if (!alive) return;
        analyser.getByteTimeDomainData(wave);
        analyser.getByteFrequencyData(freq);

        let sum = 0;
        for (let i = 0; i < wave.length; i++) { const d = wave[i] - 128; sum += d * d; }
        const rms = Math.sqrt(sum / wave.length);            // 整体响度（0–128）

        // 吹气的关键特征：高频“沙沙”声占比明显变高（说话的低频元音占比低）
        let total = 0, high = 0;
        for (let i = 0; i < freq.length; i++) { total += freq[i]; if (i > freq.length * .22) high += freq[i]; }
        const hi = total > 0 ? high / total : 0;

        if (performance.now() - start < 2000) { floorRms += rms; floorHi += hi; samples += 1; }

        const n = Math.max(samples, 1);
        const rmsGate = Math.max(4, (floorRms / n) * 1.18);   // 比环境底噪稍大就算“有声音”
        const hiGate = Math.max(.045, (floorHi / n) * 1.5);   // 高频占比门槛，压得住说话声
        const blowing = rms > rmsGate && hi > hiGate;

        if (performance.now() - start > 2000) {
          if (blowing) sustained += 1; else sustained = Math.max(0, sustained - 1);
        }
        // 连续约 0.15 秒的吹气就吹灭，比之前灵敏很多
        if (sustained > 4) { alive = false; void ctx.close(); blowOut(); return; }
        requestAnimationFrame(listen);
      };
      requestAnimationFrame(listen);
      stopTrack.current = () => { alive = false; void ctx.close(); };
      window.setTimeout(() => setNote('校准完成。对着麦克风轻轻、持续地吹一口气就行。'), 2100);
    } catch (err) {
      // 麦克风已经拿到了，只是浏览器不让建音频分析器
      const kind = err instanceof Error ? err.name : 'Error';
      setNote(`音频分析没能启动（${kind}）。可以直接点“轻触吹灭”或按空格键。`);
    }
    setMicBusy(false);
  }

  /* ── 背景音乐 ── */
  function startAmbient() {
    try {
      if (!audio.current) {
        audio.current = new Audio('audio/yuki-rainy-night.mp3');
        audio.current.loop = true;
        audio.current.volume = baseVolume.current;
      }
      void audio.current.play().then(() => setMuted(false)).catch(() => setNote('请再点一次页面，音乐才会响起。'));
    } catch {
      setNote('这个环境暂时放不出背景音乐，其他内容不受影响。');
    }
  }
  function toggleSound() {
    try {
      if (!audio.current) { startAmbient(); return; }
      if (muted) { void audio.current.play().then(() => setMuted(false)).catch(() => setMuted(true)); }
      else { audio.current.pause(); setMuted(true); }
    } catch { /* 播不出来也不影响继续往下看 */ }
  }
  /** 烟花爆开时，音乐轻轻退一下，像真的在现场。 */
  function duck() {
    try {
      const a = audio.current;
      if (!a || muted) return;
      a.volume = baseVolume.current * .42;
      window.setTimeout(() => { if (audio.current) audio.current.volume = baseVolume.current; }, 1200);
    } catch { /* 忽略 */ }
  }

  /* ── 暗号 ── */
  function submitSecret(e: React.FormEvent) {
    e.preventDefault();
    if (normalize(secret) === normalize(secretWord)) {
      setEndingStep('boom');
      duck();
      window.setTimeout(() => setEndingStep('final'), 12000);
    } else {
      setSecretMsg(secret.trim() ? '不对哦，再想想。' : '先写点什么吧。');
    }
  }

  /* ── 视差与信封转动 ── */
  function parallax(e: React.PointerEvent) {
    const x = e.clientX / innerWidth - .5, y = e.clientY / innerHeight - .5;
    document.documentElement.style.setProperty('--px', `${x * 8}px`);
    document.documentElement.style.setProperty('--py', `${y * 8}px`);
  }
  function turnLetter(e: React.PointerEvent<HTMLDivElement>) {
    if (!letterPointer.current) return;
    const dx = e.clientX - letterPointer.current.x, dy = e.clientY - letterPointer.current.y;
    letterDrag.current += Math.abs(dx) + Math.abs(dy);
    setLetterTurn(v => ({ x: Math.max(-14, Math.min(14, v.x - dy * .14)), y: Math.max(-20, Math.min(20, v.y + dx * .14)) }));
    letterPointer.current = { x: e.clientX, y: e.clientY };
  }
  /** 轻触就打开：只有明显拖动（超过 14px）时才当成"在转动信封"。 */
  function tapEnvelope() {
    if (letterDrag.current < 14) setLetterOpen(true);
  }

  const restarted = () => {
    launched.current = false;
    blown.current = false;
    setScene('opening'); setOpeningLine(0); setIntroStarted(false);
    setLit(true); setMic(false);
    setHeartStep(0); setSpread(1); setLetterOpen(false); setLetterTurn({ x: -6, y: 10 });
  };

  const fireworksOn = scene === 'ending' && (endingStep === 'fireworks' || endingStep === 'boom');
  /** 结尾先安静地放一会儿，暗号触发后稍微热闹一点；彩蛋页面刻意压住，让小猫看得清 */
  const fireworksPower = endingStep === 'boom' ? .48 : .55;

  return <main className={`film scene-${scene}`} onPointerMove={parallax}>
    <Starfield className="starfield" /><div className="vignette" /><div className="grain" />
    {scene !== 'opening' && <>
      <header><span>YU-KI / ARCHIVE 10.16</span><span>A PRIVATE BIRTHDAY FILM</span></header>
      <div className="chapter">{chapter[scene]}<b>{version}</b></div>
      <button className="sound" onClick={toggleSound} aria-label="环境音开关">{muted ? 'SOUND / OFF' : 'SOUND / ON'}</button>
    </>}

    {scene === 'opening' && <section className={`opening ${introStarted ? 'is-starting' : ''}`} onClick={launchFilm}>
      <p className="typed">{line}<b /></p>
      {openingLine === 1 && <small>2002.10.16 — 有一颗星，从这一天开始发光。</small>}
      <button className="enter">{introStarted ? 'THE FILM BEGINS…' : 'ENTER'} <em>↵</em></button>
    </section>}

    {scene === 'archive' && <section className="archive">
      <p className="eyebrow">A SMALL FILM, FOR A VERY BRIGHT SOUL</p>
      <h1 className="title"><span>Yuki</span> <i>Chu</i></h1>
      <p className="intro">今晚，进入一段不必急着结束的星光。</p>
      <button className="quiet-button" onClick={() => { setScene('cake'); setSpread(1); setNote('张开手，让卡片散落；再合拢手，它们会拼成一块蛋糕。'); }}>打开记忆卡片 <span>→</span></button>
    </section>}

    {scene === 'cake' && <section className="memory">
      <div className="memory-copy">
        <p className="eyebrow">MEMORY / ARRANGEMENT</p>
        <h2>让回忆，<br />慢慢靠近。</h2>
        <p>张开手，让回忆散落；<br />慢慢合拢，它们会为你拼成一块蛋糕。</p>
        <p className="card-prompt">每一张卡片里都藏着一句悄悄话 —— <b>点一下卡片</b>，就能看见。</p>
        <input
          aria-label="卡片散开程度"
          className="spread-slider"
          type="range" min="0" max="1" step=".01" value={spread}
          onPointerDown={() => stageRef.current?.classList.add('dragging')}
          onPointerUp={() => window.setTimeout(() => stageRef.current?.classList.remove('dragging'), 120)}
          onPointerCancel={() => stageRef.current?.classList.remove('dragging')}
          onChange={e => setSpread(+e.target.value)}
        />
        <small className="slider-hint">拖动滑条，或直接点画面上的空白处 —— 卡片会在“散开”和“拼成蛋糕”之间切换</small>
      </div>
      <div
        className="card-stage"
        ref={stageRef}
        onClick={e => {
          // 点卡片本身是看惊喜，点空白处才是散开 / 聚合
          if ((e.target as HTMLElement).closest('.card')) return;
          setSpread(spread > .5 ? 0 : 1);
        }}
      >
        {cards.map(([title, sub], i) => {
          const gathered = cakeLayers[i % cakeLayers.length];
          const scattered = scatterSpots[i % scatterSpots.length];
          const lerp = (a: string, b: string) => `calc(${a} * ${1 - spread} + ${b} * ${spread})`;
          return <button
            type="button"
            className={`card ${spread < .5 ? 'is-cake' : ''}`}
            key={title}
            onClick={() => { setOpenCard(i); setNote(''); }}
            aria-label={`打开卡片：${title}`}
            style={{
              left: lerp(gathered[0], scattered[0]),
              top: lerp(gathered[1], scattered[1]),
              '--tilt': `${(i - (cards.length - 1) / 2) * 2.4 * spread}deg`,
              '--i': i
            } as React.CSSProperties}>
            <div className={`art art-${i % 4}`} />
            <strong>{title}</strong>
            <small>{sub}</small>
          </button>;
        })}
        <div className={`cake-shape ${spread < .12 ? 'show' : ''}`} aria-hidden="true">
          <div className="pie-tier t1" /><div className="pie-tier t2" />
          <span>10 · 16</span>
          <div className="candle" /><div className="flame" />
        </div>
      </div>
      {/* 主流程按钮 + 状态/提示全部收在同一条栏里，永远不会叠在一起 */}
      <div className="cake-actions">
        <div className="cake-main">
          <span className="cake-state">
            {spread < .05 ? '蛋糕已拼好，蜡烛亮着' : spread < .5 ? '正在拼合…' : '卡片散着'}
          </span>
          <div className="cake-buttons">
            <button className="text-button" onClick={() => setSpread(spread > .5 ? 0 : 1)}>
              {spread > .5 ? '拼成蛋糕' : '重新散开'}
            </button>
            <button className="quiet-button" onClick={() => { setSpread(0); setNote('蜡烛点亮了，许个愿吧。'); window.setTimeout(() => setScene('wish'), 900); }}>
              {spread > .05 ? '先拼成蛋糕，再点亮蜡烛' : '点亮蜡烛'} <span>→</span>
            </button>
          </div>
        </div>
        {note && <p className="cake-note">{note}</p>}
      </div>

      {/* 点开卡片后的惊喜 */}
      {openCard !== null && (() => {
        const [supTitle, supText] = cardSurprises[openCard % cardSurprises.length];
        const [cardTitle] = cards[openCard];
        return <div className="surprise-veil" onClick={() => setOpenCard(null)}>
          <div
            className="surprise"
            role="dialog"
            aria-modal="true"
            aria-label={`第 ${openCard + 1} 张卡片的惊喜`}
            onClick={e => e.stopPropagation()}
          >
            <button className="surprise-close" onClick={() => setOpenCard(null)} aria-label="关上">×</button>
            <p className="eyebrow">CARD {String(openCard + 1).padStart(2, '0')} / {cards.length}</p>
            <strong className="surprise-card">{cardTitle}</strong>
            <span className="surprise-mark">✦</span>
            <h3>{supTitle}</h3>
            <p className="surprise-text">{supText}</p>
            <div className="surprise-foot">
              <small>轻触别处关上</small>
              <button className="quiet-button" onClick={() => setOpenCard((openCard + 1) % cards.length)}>下一张 <span>→</span></button>
            </div>
          </div>
        </div>;
      })()}
    </section>}

    {scene === 'wish' && <section className="wish">
      <div className="single-cake">
        <div className={`flame ${lit ? '' : 'out'}`} /><div className="smoke" />
        <div className="candle" /><div className="cake-tier t1" /><div className="cake-tier t2" /><span>10 · 16</span>
      </div>
      <p className="eyebrow">MAKE A WISH</p>
      <h2>{lit ? '许一个愿吧。然后，轻轻吹一口气。' : '愿你想要的一切，都在奔向你的路上。'}</h2>
      {lit && <div className="wish-actions">
        <button
          className="quiet-button"
          onClick={() => {
            if (micBusy) return;
            if (!mic && gUMFailedMic) showMicPop();
            else void enableMic();
          }}
          disabled={micBusy}
        >
          {mic ? '正在聆听 · 对着麦克风吹气' : micBusy ? '正在请求麦克风权限…' : gUMFailedMic ? '麦克风打不开？点这里看办法' : '开启麦克风吹灭'}
        </button>
        <button className="text-button" onClick={blowOut}>轻触吹灭 <kbd>Space</kbd></button>
      </div>}
      {lit && <small className="wish-hint">
        {mic ? '麦克风已经在听了：轻轻、持续地吹一口气就行（大约 0.15 秒）' : '麦克风是可选：不开启也能直接点“轻触吹灭”，或按空格键'}
      </small>}

      {/* 麦克风权限出问题时，单独的“解决办法”小窗口 */}
      {micPop && <div className="permission-veil" onClick={closeMicPop}>
        <div className="permission-pop" role="dialog" aria-modal="true" aria-label="打开麦克风的办法" onClick={e => e.stopPropagation()}>
          <button className="surprise-close" onClick={closeMicPop} aria-label="关上">×</button>
          <p className="eyebrow">HOW TO ALLOW THE MICROPHONE</p>
          <h3>只差一步：让浏览器可以用麦克风</h3>
          <ol>
            <li>看<b>屏幕最上方</b>，或者地址栏左边的 <b>“aA” / 麦克风图标</b>，有没有在问“是否允许使用麦克风”的小气泡 —— 点<b>允许</b>。</li>
            <li>如果没看到气泡：打开 <b>系统设置 → 隐私与安全性 → 麦克风</b>，把 <b>Safari</b>（或你正在用的浏览器）打开，然后<b>刷新页面</b>。</li>
            <li>Safari 里还能单独设置：<b>Safari → 设置 → 网站 → 麦克风</b>，把 <b>localhost</b> 改成<b>允许</b>或<b>询问</b>。</li>
          </ol>
          <p className="permission-foot">不看也没关系：麦克风只是可选玩法，直接点“轻触吹灭”或按空格键，效果完全一样。</p>
          <div className="permission-actions">
            <button className="quiet-button" onClick={() => { closeMicPop(); void enableMic(); }}>再试一次 <span>→</span></button>
          </div>
        </div>
      </div>}
    </section>}

    {scene === 'heart' && <section className="heart-scene">
      <p className="eyebrow">CONSTELLATION / {heartStep}/6</p>
      <h2>把散落的光，<br />连成一颗心。</h2>
      <p>依序点击星点，或按方向键 / Enter。</p>
      <div className={`constellation step-${heartStep}`} onClick={() => setHeartStep(v => Math.min(6, v + 1))}>
        {[0, 1, 2, 3, 4, 5].map(n => <button key={n} className={`node n${n} ${n < heartStep ? 'active' : ''}`} aria-label={`星点 ${n + 1}`} onClick={e => { e.stopPropagation(); if (n === heartStep) setHeartStep(n + 1); }} />)}
        <svg viewBox="0 0 400 340" aria-hidden="true">
          <path className={heartStep === 6 ? 'complete' : ''} d="M85 75 C125 15 195 70 200 115 C205 70 275 15 315 75 C365 155 200 285 200 285 C200 285 35 155 85 75" />
        </svg>
      </div>
      {heartStep === 6 && <p className="heart-finish">有些爱不必说得很大声，它一直都在。</p>}
    </section>}

    {scene === 'letter' && <section className={`letter ${letterOpen ? 'opened' : ''}`}>
      <p className="eyebrow">THE LAST FRAME</p>
      {!letterOpen ? <div
        className="envelope-wrap"
        onPointerDown={e => { letterPointer.current = { x: e.clientX, y: e.clientY }; letterDrag.current = 0; e.currentTarget.setPointerCapture(e.pointerId); }}
        onPointerMove={turnLetter}
        onPointerUp={() => { letterPointer.current = null; }}
        onClick={tapEnvelope}
        role="button"
        tabIndex={0}
        aria-label="轻触打开信封"
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setLetterOpen(true); } }}
      >
        <div className="envelope" style={{ '--rx': `${letterTurn.x}deg`, '--ry': `${letterTurn.y}deg` } as React.CSSProperties}>
          <div className="envelope-back" />
          <div className="envelope-liner" />
          <div className="envelope-fold fold-left" />
          <div className="envelope-fold fold-right" />
          <div className="envelope-bottom" />
          <div className="envelope-flap" />
          <div className="seal">Y</div>
        </div>
        <p className="open-hint">轻触信封，就能打开这封信</p>
      </div> : <article className="letter-sheet">
        <div className="letter-text">{paragraphs.map((p, i) => <p key={i} style={{ animationDelay: `${i * .16}s` }}>{p}</p>)}</div>
        <footer>
          <strong>Happy Birthday, Yuki Chu</strong>
          <span>2002.10.16</span>
          <i>Love, always.</i>
        </footer>
      </article>}
      {letterOpen && <button className="quiet-button" onClick={() => setScene('ending')}>把这一刻收进宇宙 <span>→</span></button>}
    </section>}

    {scene === 'ending' && <section className="ending">
      <Fireworks active={fireworksOn} intensity={fireworksPower} className="fireworks-canvas" />
      <div className="ending-copy">
        {endingStep !== 'final' && <>
          <div className="y-stars">Y</div>
          <p>你永远是被爱着的。</p>
          <small className="tap-hint">轻触夜空，再放一束烟花</small>
        </>}
        {endingStep === 'final' && <h2 className="final-line">Yuki nb666</h2>}
        {endingStep === 'final' && <p className="final-sub">宇宙盖章：你最棒。</p>}

        {endingStep === 'ask' && <form className="secret-panel" onSubmit={submitSecret}>
          <p className="eyebrow">ONE LAST THING / 还有一个暗号</p>
          <p className="secret-lead">有些话，要说出正确的暗号才会出现。</p>
          <div className="secret-row">
            <input
              value={secret}
              onChange={e => { setSecret(e.target.value); setSecretMsg(''); }}
              placeholder="在这里写下暗号"
              aria-label="暗号"
              autoComplete="off"
              spellCheck={false}
            />
            <button className="quiet-button">确认 <span>→</span></button>
          </div>
          {/* 平时什么都不显示，只有输错时才给一句反馈 */}
          <small className="secret-msg">{secretMsg}</small>
        </form>}

        {endingStep === 'boom' && <>
          <CatPhotos photos={catPhotos} names={catNames} />
          <TextRain text="Yuki nb666" cols={13} rows={14} />
          <p className="boom-line">暗号正确 · {catLine}</p>
        </>}

        {(endingStep === 'final') && <button className="text-button replay" onClick={restarted}>重新观看</button>}
      </div>
    </section>}

    {note && scene !== 'opening' && scene !== 'cake' && <div className="note" role="status">{note}</div>}
  </main>;
}
