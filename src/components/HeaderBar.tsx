import React, { useEffect, useState } from 'react';

interface HeaderBarProps {
  onResetCamera?: () => void;
}

/**
 * 顶部 Header 栏 (高度 72px)
 * 居中深色渐变，两侧完全透明；中央 28px 青绿渐变加粗主标题；右上角电子表闪烁冒号倒计时
 */
export const HeaderBar: React.FC<HeaderBarProps> = ({ onResetCamera }) => {
  // 02:45:32 = 2*3600 + 45*60 + 32 = 9932 seconds
  const [remainingSeconds, setRemainingSeconds] = useState<number>(9932);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setRemainingSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const hours = String(Math.floor(remainingSeconds / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((remainingSeconds % 3600) / 60)).padStart(2, '0');
  const seconds = String(remainingSeconds % 60).padStart(2, '0');

  return (
    <header
      className="relative z-20 h-[72px] w-full shrink-0 flex items-center justify-center px-6 pointer-events-none"
      style={{
        background:
          'linear-gradient(90deg, rgba(10,14,23,0) 0%, rgba(10,14,23,0.42) 18%, rgba(10,14,23,0.88) 50%, rgba(10,14,23,0.42) 82%, rgba(10,14,23,0) 100%)',
      }}
    >
      {/* 居中微光底边装饰线 */}
      <div
        className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 w-[min(920px,78vw)] h-[1px]"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, rgba(0,212,255,0.25) 20%, rgba(0,212,255,0.85) 50%, rgba(0,255,136,0.25) 80%, transparent 100%)',
        }}
      />
      <div
        className="pointer-events-none absolute bottom-[1px] left-1/2 -translate-x-1/2 w-36 h-[2px]"
        style={{
          background: 'linear-gradient(90deg, transparent, #00d4ff, #00ff88, transparent)',
          boxShadow: '0 0 10px rgba(0, 212, 255, 0.7)',
        }}
      />

      {/* 中央标题 */}
      <button
        type="button"
        onClick={onResetCamera}
        className="pointer-events-auto cursor-pointer focus:outline-none group"
        title="点击重置全景拓扑视角"
      >
        <h1
          className="text-[20px] lg:text-[24px] xl:text-[26px] 2xl:text-[28px] font-bold tracking-[0.06em] whitespace-nowrap bg-gradient-to-r from-[#00d4ff] via-[#34f5d2] to-[#00ff88] bg-clip-text text-transparent transition-opacity group-hover:opacity-90"
          style={{
            filter: 'drop-shadow(0 0 12px rgba(0, 212, 255, 0.35))',
          }}
        >
          2026年（第十五届）信息通信网络安全管理员职业技能竞赛
        </h1>
      </button>

      {/* 右上角倒计时 */}
      <div className="pointer-events-auto absolute right-5 top-1/2 -translate-y-1/2 flex items-center gap-2.5">
        <span className="text-xs xl:text-sm font-normal tracking-wider text-[#9ca3af] whitespace-nowrap">
          比赛倒计时:
        </span>
        <div
          className="flex items-center px-2.5 py-1 clip-octa-8 border border-[#ff6b35]/35 bg-[#0a0e17]/75"
          style={{ backdropFilter: 'blur(6px)' }}
          aria-live="off"
        >
          <span
            className="font-tech-num text-lg xl:text-xl font-bold tracking-[0.08em] bg-gradient-to-b from-[#ff9e7d] via-[#ff5252] to-[#dc2626] bg-clip-text text-transparent"
            style={{ filter: 'drop-shadow(0 0 8px rgba(255, 82, 82, 0.45))' }}
          >
            {hours}
          </span>
          <span className="font-tech-num text-lg xl:text-xl font-bold text-[#ff5252] mx-0.5 animate-colon-blink">
            :
          </span>
          <span
            className="font-tech-num text-lg xl:text-xl font-bold tracking-[0.08em] bg-gradient-to-b from-[#ff9e7d] via-[#ff5252] to-[#dc2626] bg-clip-text text-transparent"
            style={{ filter: 'drop-shadow(0 0 8px rgba(255, 82, 82, 0.45))' }}
          >
            {minutes}
          </span>
          <span className="font-tech-num text-lg xl:text-xl font-bold text-[#ff5252] mx-0.5 animate-colon-blink">
            :
          </span>
          <span
            className="font-tech-num text-lg xl:text-xl font-bold tracking-[0.08em] bg-gradient-to-b from-[#ff9e7d] via-[#ff5252] to-[#dc2626] bg-clip-text text-transparent"
            style={{ filter: 'drop-shadow(0 0 8px rgba(255, 82, 82, 0.45))' }}
          >
            {seconds}
          </span>
        </div>
      </div>
    </header>
  );
};
