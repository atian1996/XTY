import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Cloud,
  Cpu,
  Database,
  Network,
  Radar,
  Server,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { CyberPanel } from './CyberPanel';
import { ZoneConfig, ZoneId } from '../types/cyberRange';

export interface FirstBloodCardItem {
  id: string;
  teamName: string;
  teamColor: string;
  zoneName: string;
  challengeName: string;
  timestamp: string;
  rankIndex: number;
}

export interface DirectionProgressItem {
  zoneId: ZoneId;
  name: string;
  solved: number;
  total: number;
}

interface LeftDashboardProps {
  solveProgressPct: number;
  totalSubmissions: number;
  accuracyPct: number;
  directions: DirectionProgressItem[];
  firstBloods: FirstBloodCardItem[];
  activeZoneFocus: ZoneId | 'attack' | 'all';
  onFocusZone: (zoneId: ZoneId) => void;
  zones: ZoneConfig[];
}

function useAnimatedNumber(target: number, durationMs = 950) {
  const [display, setDisplay] = useState(0);
  const [flashing, setFlashing] = useState(false);
  const currentRef = useRef(0);
  const initializedRef = useRef(false);

  useEffect(() => {
    const startVal = currentRef.current;
    const startTime = performance.now();
    let rafId = 0;

    if (initializedRef.current && Math.abs(target - startVal) > 0.01) {
      setFlashing(true);
      const t = window.setTimeout(() => setFlashing(false), 620);
      const step = (now: number) => {
        const progress = Math.min(1, (now - startTime) / 480);
        const eased = 1 - Math.pow(1 - progress, 3);
        const val = startVal + (target - startVal) * eased;
        currentRef.current = val;
        setDisplay(val);
        if (progress < 1) {
          rafId = requestAnimationFrame(step);
        }
      };
      rafId = requestAnimationFrame(step);
      return () => {
        cancelAnimationFrame(rafId);
        window.clearTimeout(t);
      };
    }

    initializedRef.current = true;
    const step = (now: number) => {
      const progress = Math.min(1, (now - startTime) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      const val = target * eased;
      currentRef.current = val;
      setDisplay(val);
      if (progress < 1) {
        rafId = requestAnimationFrame(step);
      }
    };
    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [target, durationMs]);

  return { display, flashing };
}

const ZONE_ICONS: Record<ZoneId, React.ReactNode> = {
  'ai-access': <Cloud className="w-3.5 h-3.5" />,
  inference: <Cpu className="w-3.5 h-3.5" />,
  agent: <Sparkles className="w-3.5 h-3.5" />,
  knowledge: <Database className="w-3.5 h-3.5" />,
  compute: <Server className="w-3.5 h-3.5" />,
  ops: <Radar className="w-3.5 h-3.5" />,
  net: <Network className="w-3.5 h-3.5" />,
};

export const LeftDashboard: React.FC<LeftDashboardProps> = ({
  solveProgressPct,
  totalSubmissions,
  accuracyPct,
  directions,
  firstBloods,
  activeZoneFocus,
  onFocusZone,
}) => {
  const { display: animSolvePct, flashing: flashSolve } =
    useAnimatedNumber(solveProgressPct);
  const { display: animSubs, flashing: flashSubs } =
    useAnimatedNumber(totalSubmissions);
  const { display: animAcc, flashing: flashAcc } =
    useAnimatedNumber(accuracyPct);

  const [activeFbIndex, setActiveFbIndex] = useState(0);
  const [carouselPaused, setCarouselPaused] = useState(false);

  // 当新增一血事件时自动聚焦第一张
  const prevFirstIdRef = useRef<string | undefined>(firstBloods[0]?.id);
  useEffect(() => {
    if (firstBloods[0]?.id && firstBloods[0].id !== prevFirstIdRef.current) {
      prevFirstIdRef.current = firstBloods[0].id;
      setActiveFbIndex(0);
    }
  }, [firstBloods]);

  // 每 5 秒向左平滑切换一张一血卡片
  useEffect(() => {
    if (carouselPaused || firstBloods.length <= 1) return;
    const timer = window.setInterval(() => {
      setActiveFbIndex((prev) => (prev + 1) % firstBloods.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [carouselPaused, firstBloods.length]);

  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const clampedPct = Math.max(0, Math.min(100, animSolvePct));
  const strokeDashoffset = circumference * (1 - clampedPct / 100);

  return (
    <aside className="pointer-events-auto w-[288px] xl:w-[316px] 2xl:w-[340px] shrink-0 h-full flex flex-col gap-3 min-h-0">
      {/* 左侧面板 1：全局态势概览 (Global Overview) ~22% */}
      <CyberPanel className="flex-[22] min-h-[150px]" innerClassName="px-3.5 py-2.5 justify-between">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="w-2 h-2 bg-[#00d4ff] rotate-45 inline-block shrink-0 shadow-[0_0_8px_#00d4ff]" />
            <h2 className="text-[13px] font-medium tracking-wide text-[#e5e7eb] truncate">
              全局态势概览{' '}
              <span className="text-[11px] font-normal text-[#9ca3af]">
                (Global Overview)
              </span>
            </h2>
          </div>
          <ShieldCheck className="w-3.5 h-3.5 text-[#00d4ff]/70 shrink-0" />
        </div>

        {/* 横向三列并排 */}
        <div className="grid grid-cols-3 gap-1.5 items-center my-auto pt-1">
          {/* 第 1 列：环状进度圈 + 总解题进度 */}
          <div className="flex flex-col items-center justify-center">
            <div className="relative w-[72px] h-[72px] flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 84 84">
                <defs>
                  <linearGradient
                    id="globalProgressGrad"
                    x1="0%"
                    y1="0%"
                    x2="100%"
                    y2="100%"
                  >
                    <stop offset="0%" stopColor="#00d4ff" />
                    <stop offset="100%" stopColor="#2563eb" />
                  </linearGradient>
                </defs>
                <circle
                  cx="42"
                  cy="42"
                  r={radius}
                  fill="none"
                  stroke="rgba(148, 163, 184, 0.16)"
                  strokeWidth="6"
                />
                <circle
                  cx="42"
                  cy="42"
                  r={radius}
                  fill="none"
                  stroke="url(#globalProgressGrad)"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  style={{
                    filter: 'drop-shadow(0 0 6px rgba(0, 212, 255, 0.55))',
                    transition: 'stroke-dashoffset 0.3s ease-out',
                  }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span
                  className={`font-tech-num text-lg font-bold leading-none transition-colors duration-300 ${
                    flashSolve ? 'text-white' : 'text-[#00d4ff]'
                  }`}
                >
                  {animSolvePct.toFixed(1)}%
                </span>
              </div>
            </div>
            <span className="mt-1 text-xs text-[#9ca3af] whitespace-nowrap">
              总解题进度
            </span>
          </div>

          {/* 第 2 列：总提交次数 + 微弱趋势波浪线 */}
          <div className="flex flex-col items-center justify-center border-x border-[#00d4ff]/10 px-1">
            <span
              className={`font-tech-num text-xl xl:text-[23px] font-bold leading-tight transition-colors duration-300 ${
                flashSubs ? 'text-white' : 'text-[#00d4ff]'
              }`}
              style={{
                textShadow: flashSubs
                  ? '0 0 12px rgba(255,255,255,0.85)'
                  : '0 0 10px rgba(0,212,255,0.28)',
              }}
            >
              {Math.round(animSubs).toLocaleString()}
            </span>
            <svg
              className="w-20 h-4 mt-1 opacity-55"
              viewBox="0 0 80 16"
              fill="none"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="sparkWave" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#00d4ff" stopOpacity="0.15" />
                  <stop offset="65%" stopColor="#00d4ff" stopOpacity="0.85" />
                  <stop offset="100%" stopColor="#00ff88" stopOpacity="0.95" />
                </linearGradient>
              </defs>
              <path
                d="M2 12 C 12 12, 16 6, 24 8 C 32 10, 36 4, 44 6 C 52 8, 56 3, 64 5 C 70 6, 74 2, 78 3"
                stroke="url(#sparkWave)"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <span className="mt-1 text-xs text-[#9ca3af] whitespace-nowrap">
              总提交次数
            </span>
          </div>

          {/* 第 3 列：总正确率 + 绿色向上小箭头 */}
          <div className="flex flex-col items-center justify-center pl-1">
            <div className="flex items-center gap-1">
              <span
                className={`font-tech-num text-xl xl:text-[23px] font-bold leading-tight transition-colors duration-300 ${
                  flashAcc ? 'text-white' : 'text-[#00d4ff]'
                }`}
                style={{
                  textShadow: flashAcc
                    ? '0 0 12px rgba(255,255,255,0.85)'
                    : '0 0 10px rgba(0,212,255,0.28)',
                }}
              >
                {animAcc.toFixed(1)}%
              </span>
              <ArrowUp className="w-3.5 h-3.5 text-[#00ff88] stroke-[2.5]" />
            </div>
            <span className="mt-1.5 text-[10px] font-tech-num text-[#00ff88]/85 whitespace-nowrap">
              +1.8% 实时均值
            </span>
            <span className="mt-1 text-xs text-[#9ca3af] whitespace-nowrap">
              总正确率
            </span>
          </div>
        </div>
      </CyberPanel>

      {/* 左侧面板 2：各方向题目解题进度 (Direction Progress) ~33% */}
      <CyberPanel className="flex-[33] min-h-0" innerClassName="px-3.5 py-2.5">
        <div className="flex items-center justify-between mb-1.5 shrink-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="w-2 h-2 bg-[#00d4ff] inline-block shrink-0 shadow-[0_0_8px_#00d4ff]" />
            <h2 className="text-[13px] font-medium tracking-wide text-[#e5e7eb] truncate">
              各方向题目解题进度{' '}
              <span className="text-[11px] font-normal text-[#9ca3af]">
                (Direction)
              </span>
            </h2>
          </div>
          <span className="text-[11px] font-tech-num text-[#9ca3af] shrink-0">
            7 大方向
          </span>
        </div>

        <div className="flex-1 min-h-0 flex flex-col justify-between gap-1">
          {directions.map((dir) => {
            const pct = Math.min(100, Math.round((dir.solved / dir.total) * 100));
            const isComplete = dir.solved >= dir.total;
            const isFocused = activeZoneFocus === dir.zoneId;

            return (
              <button
                key={dir.zoneId}
                type="button"
                onClick={() => onFocusZone(dir.zoneId)}
                className={`w-full flex items-center gap-2 px-1 py-1 rounded transition-colors cursor-pointer text-left ${
                  isFocused
                    ? 'bg-[#00d4ff]/12'
                    : 'hover:bg-white/[0.04]'
                }`}
                title={`点击聚焦 3D 视角至 ${dir.name}`}
              >
                {/* 图标 + 名称 */}
                <div
                  className={`flex items-center gap-1.5 w-[88px] shrink-0 text-[11px] whitespace-nowrap ${
                    isComplete ? 'text-[#00ff88] font-medium' : 'text-[#e5e7eb]'
                  }`}
                >
                  <span
                    className={
                      isComplete ? 'text-[#00ff88]' : 'text-[#00d4ff]'
                    }
                  >
                    {ZONE_ICONS[dir.zoneId]}
                  </span>
                  <span className="truncate">{dir.name}</span>
                </div>

                {/* 进度条：未满部分显示网格点阵，前景青色渐变 */}
                <div className="flex-1 h-2.5 rounded-sm overflow-hidden progress-grid-dots relative border border-slate-700/50">
                  <div
                    className={`h-full rounded-sm transition-all duration-500 ease-out ${
                      isComplete ? 'animate-bar-complete' : ''
                    }`}
                    style={{
                      width: `${pct}%`,
                      background: isComplete
                        ? 'linear-gradient(90deg, #059669 0%, #00ff88 100%)'
                        : 'linear-gradient(90deg, #0284c7 0%, #00d4ff 100%)',
                      boxShadow: isComplete
                        ? '0 0 10px rgba(0, 255, 136, 0.55)'
                        : '0 0 8px rgba(0, 212, 255, 0.35)',
                    }}
                  />
                </div>

                {/* 右侧数值 [ 35 / 50 ] */}
                <div
                  className={`w-[48px] shrink-0 text-right font-tech-num text-[11px] ${
                    isComplete ? 'text-[#00ff88] font-bold' : 'text-[#9ca3af]'
                  }`}
                >
                  <span className={isComplete ? 'text-[#00ff88]' : 'text-[#e5e7eb]'}>
                    {dir.solved}
                  </span>{' '}
                  / {dir.total}
                </div>
              </button>
            );
          })}
        </div>
      </CyberPanel>

      {/* 左侧面板 3：实时一血榜 (First Blood) Cover Flow 3D 卡片轮播 ~45% */}
      <CyberPanel
        className="flex-[45] min-h-[205px]"
        innerClassName="px-3.5 py-2.5 justify-between"
      >
        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 bg-[#ffd24a] rotate-45 inline-block shadow-[0_0_8px_#ffd24a]" />
            <h2 className="text-[13px] font-medium tracking-wide text-[#e5e7eb]">
              实时一血榜{' '}
              <span className="text-[11px] font-normal text-[#9ca3af]">
                (First Blood)
              </span>
            </h2>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() =>
                setActiveFbIndex(
                  (prev) => (prev - 1 + firstBloods.length) % firstBloods.length
                )
              }
              className="p-1 text-[#9ca3af] hover:text-[#ffd24a] transition-colors cursor-pointer"
              aria-label="上一张一血卡片"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="font-tech-num text-[11px] text-[#9ca3af] px-1">
              {activeFbIndex + 1}/{firstBloods.length}
            </span>
            <button
              type="button"
              onClick={() =>
                setActiveFbIndex((prev) => (prev + 1) % firstBloods.length)
              }
              className="p-1 text-[#9ca3af] hover:text-[#ffd24a] transition-colors cursor-pointer"
              aria-label="下一张一血卡片"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Cover Flow 卡片舞台（前后景深缩放，无 3D 斜面穿模） */}
        <div
          className="relative flex-1 min-h-0 flex items-center justify-center overflow-hidden my-1"
          onMouseEnter={() => setCarouselPaused(true)}
          onMouseLeave={() => setCarouselPaused(false)}
        >
          {firstBloods.map((fb, idx) => {
            const total = firstBloods.length;
            let offset = idx - activeFbIndex;
            if (offset > total / 2) offset -= total;
            if (offset < -total / 2) offset += total;

            const isVisible = Math.abs(offset) <= 1;
            const translateX = offset * 96;
            const scale = offset === 0 ? 1 : 0.78;
            const opacity = offset === 0 ? 1 : isVisible ? 0.58 : 0;
            const zIndex = offset === 0 ? 30 : isVisible ? 10 : 0;

            return (
              <div
                key={fb.id}
                onClick={() => setActiveFbIndex(idx)}
                className="absolute left-1/2 top-1/2 w-[212px] xl:w-[234px] h-[162px] transition-[transform,opacity] duration-500 ease-out cursor-pointer"
                style={{
                  transform: `translate(calc(-50% + ${translateX}px), -50%) scale(${scale})`,
                  opacity,
                  zIndex,
                  pointerEvents: isVisible ? 'auto' : 'none',
                }}
              >
                <CyberPanel
                  variant="gold"
                  className="w-full h-full shadow-[0_10px_28px_rgba(0,0,0,0.55)]"
                  innerClassName="p-3.5 justify-between"
                >
                  {/* 顶部：六边形发光头像 + 一血荣誉标签 */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="relative w-11 h-11 flex items-center justify-center shrink-0">
                      {/* 六边形金色发光外框 */}
                      <svg
                        className="absolute inset-0 w-full h-full"
                        viewBox="0 0 44 44"
                        fill="none"
                        aria-hidden="true"
                      >
                        <polygon
                          points="22,2 40,12 40,32 22,42 4,32 4,12"
                          stroke="#ffd24a"
                          strokeWidth="1.6"
                          fill="rgba(255,210,74,0.12)"
                        />
                      </svg>
                      <div
                        className="w-8 h-8 clip-hex-avatar flex items-center justify-center font-bold text-sm text-white"
                        style={{
                          background: `linear-gradient(135deg, ${fb.teamColor}cc, rgba(10,14,23,0.9))`,
                        }}
                      >
                        {fb.teamName.slice(0, 1)}
                      </div>
                    </div>

                    <span className="font-tech-num text-[11px] tracking-wider text-[#ffd24a] font-semibold">
                      FIRST BLOOD
                    </span>
                  </div>

                  {/* 中间：亮白大字队伍名称 + 斩获题目 */}
                  <div className="my-auto py-1">
                    <div className="text-lg font-bold text-white tracking-wide truncate">
                      {fb.teamName}
                    </div>
                    <div className="mt-1 text-xs text-[#e5e7eb] leading-snug">
                      斩获{' '}
                      <span className="text-[#00d4ff] font-medium">
                        [{fb.zoneName}]
                      </span>{' '}
                      -{' '}
                      <span className="text-[#00ff88] font-medium">
                        [{fb.challengeName}]
                      </span>{' '}
                      一血
                    </div>
                  </div>

                  {/* 右下角：时间点 + 排名 */}
                  <div className="flex items-center justify-between pt-1 border-t border-[#ffd24a]/15">
                    <span className="text-[11px] text-[#9ca3af]">首破时刻</span>
                    <div className="flex items-center gap-2 font-tech-num text-xs">
                      <span className="text-[#e5e7eb]">{fb.timestamp}</span>
                      <span className="text-[#ffd24a] font-bold">
                        #{fb.rankIndex}
                      </span>
                    </div>
                  </div>
                </CyberPanel>
              </div>
            );
          })}
        </div>

        {/* 底部切换指示条 */}
        <div className="flex items-center justify-center gap-1.5 pt-1 shrink-0">
          {firstBloods.map((fb, idx) => (
            <button
              key={fb.id}
              type="button"
              onClick={() => setActiveFbIndex(idx)}
              className={`h-1 rounded-full transition-all cursor-pointer ${
                idx === activeFbIndex
                  ? 'w-5 bg-[#ffd24a] shadow-[0_0_6px_#ffd24a]'
                  : 'w-2 bg-slate-600/70 hover:bg-slate-400'
              }`}
              aria-label={`切换到第 ${idx + 1} 张一血卡片`}
            />
          ))}
        </div>
      </CyberPanel>
    </aside>
  );
};
