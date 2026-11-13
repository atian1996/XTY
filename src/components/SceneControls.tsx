import React from 'react';
import { Crosshair, Maximize2, Minimize2, Radar, RotateCw } from 'lucide-react';

interface SceneControlsProps {
  onResetView: () => void;
  autoRotate: boolean;
  onToggleAutoRotate: () => void;
  panelsHidden: boolean;
  onTogglePanelsHidden: () => void;
  attackFollow: boolean;
  onToggleAttackFollow: () => void;
}

interface ControlBtnProps {
  id: string;
  label: string;
  subLabel?: string;
  active?: boolean;
  isToggle?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

const GlassControlButton: React.FC<ControlBtnProps> = ({
  id,
  label,
  subLabel,
  active = false,
  isToggle = false,
  onClick,
  children,
}) => {
  const isLit = !isToggle || active;

  return (
    <div className="relative group flex items-center justify-end">
      {/* 左侧悬浮中文 Tooltip */}
      <div
        role="tooltip"
        className="pointer-events-none absolute right-full mr-2.5 top-1/2 -translate-y-1/2 opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 z-30"
      >
        <div
          className="px-2.5 py-1 rounded border border-[#00d4ff]/55 bg-[#0a0e17]/92 text-[11px] leading-tight text-[#e5e7eb] whitespace-nowrap shadow-[0_0_12px_rgba(0,212,255,0.22)] flex items-center gap-1.5"
          style={{ backdropFilter: 'blur(8px)' }}
        >
          <span className="font-medium tracking-wide">{label}</span>
          {subLabel && (
            <span
              className={`font-tech-num text-[10px] ${
                isToggle
                  ? active
                    ? 'text-[#00d4ff]'
                    : 'text-[#9ca3af]'
                  : 'text-[#00d4ff]'
              }`}
            >
              · {subLabel}
            </span>
          )}
        </div>
      </div>

      {/* 玻璃拟物化图标按钮 */}
      <button
        type="button"
        data-control-id={id}
        aria-label={label}
        aria-pressed={isToggle ? active : undefined}
        onClick={onClick}
        className={`relative w-10 h-10 rounded-lg flex items-center justify-center cursor-pointer transition-all duration-200 hover:scale-105 active:scale-95 focus:outline-none ${
          isToggle
            ? active
              ? 'opacity-100 border border-[#00d4ff] text-[#00d4ff]'
              : 'opacity-50 hover:opacity-85 border border-[#00d4ff]/60 text-white hover:border-[#00d4ff]'
            : 'opacity-90 hover:opacity-100 border border-[#00d4ff]/80 text-white hover:text-[#00d4ff] hover:border-[#00d4ff]'
        }`}
        style={{
          backgroundColor: 'rgba(10, 14, 23, 0.7)',
          backdropFilter: 'blur(8px)',
          boxShadow:
            isToggle && active
              ? '0 0 10px #00d4ff, inset 0 0 8px rgba(0, 212, 255, 0.2)'
              : isLit
              ? '0 2px 10px rgba(0, 0, 0, 0.45)'
              : 'none',
        }}
      >
        {children}

        {/* 状态指示小角标（开启状态高亮青点） */}
        {isToggle && (
          <span
            className={`absolute top-1 right-1 w-1.5 h-1.5 rounded-full transition-colors ${
              active
                ? 'bg-[#00d4ff] shadow-[0_0_6px_#00d4ff]'
                : 'bg-slate-500/60'
            }`}
          />
        )}
      </button>
    </div>
  );
};

/**
 * 3D 场景右上角 4 个悬浮玻璃拟物化控制按钮
 * 回中 / 自动旋转 / 面板隐藏 / 攻击跟踪
 */
export const SceneControls: React.FC<SceneControlsProps> = ({
  onResetView,
  autoRotate,
  onToggleAutoRotate,
  panelsHidden,
  onTogglePanelsHidden,
  attackFollow,
  onToggleAttackFollow,
}) => {
  return (
    <div
      className="pointer-events-auto flex flex-col gap-2.5 z-20"
      aria-label="3D 场景视角与交互控制栏"
    >
      <GlassControlButton
        id="reset-view"
        label="回中视角"
        subLabel="复位"
        onClick={onResetView}
      >
        <Crosshair className="w-[18px] h-[18px]" strokeWidth={1.85} />
      </GlassControlButton>

      <GlassControlButton
        id="auto-rotate"
        label="自动旋转"
        subLabel={autoRotate ? '已开启' : '已关闭'}
        isToggle
        active={autoRotate}
        onClick={onToggleAutoRotate}
      >
        <RotateCw
          className={`w-[18px] h-[18px] ${
            autoRotate ? 'animate-[spin_9s_linear_infinite]' : ''
          }`}
          strokeWidth={1.85}
        />
      </GlassControlButton>

      <GlassControlButton
        id="hide-panels"
        label="面板隐藏"
        subLabel={panelsHidden ? '已隐藏' : '显示中'}
        isToggle
        active={panelsHidden}
        onClick={onTogglePanelsHidden}
      >
        {panelsHidden ? (
          <Minimize2 className="w-[18px] h-[18px]" strokeWidth={1.85} />
        ) : (
          <Maximize2 className="w-[18px] h-[18px]" strokeWidth={1.85} />
        )}
      </GlassControlButton>

      <GlassControlButton
        id="attack-follow"
        label="攻击跟踪"
        subLabel={attackFollow ? '已开启' : '已关闭'}
        isToggle
        active={attackFollow}
        onClick={onToggleAttackFollow}
      >
        <Radar className="w-[18px] h-[18px]" strokeWidth={1.85} />
      </GlassControlButton>
    </div>
  );
};
