import React from 'react';
import {
  ChevronDown,
  ChevronUp,
  Compass,
  Crosshair,
  Eye,
  Flame,
  Layers,
  Pause,
  Play,
  ShieldAlert,
  Sparkles,
  Tag,
  Trophy,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import { LabelDisplayMode } from '../three/archetypes';
import {
  CameraMode,
  SandboxVersion,
  Team,
  ZoneConfig,
  ZoneId,
} from '../types/cyberRange';

interface DirectorConsoleProps {
  sandboxVersion: SandboxVersion;
  onSwitchVersion: (ver: SandboxVersion) => void;
  dockCollapsed: boolean;
  onToggleCollapse: () => void;
  activeZoneFocus: ZoneId | 'attack' | 'all';
  onFocusZone: (zoneId: ZoneId | 'attack' | 'all') => void;
  zones: ZoneConfig[];
  teams: Team[];
  labelMode: LabelDisplayMode;
  onCycleLabelMode: () => void;
  cameraMode: CameraMode;
  onSwitchCameraMode: (mode: CameraMode) => void;
  autoSimRunning: boolean;
  onToggleAutoSim: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  directorTeam: string;
  onChangeDirectorTeam: (name: string) => void;
  directorZoneId: ZoneId;
  onChangeDirectorZone: (zoneId: ZoneId) => void;
  directorChallengeId: string;
  onChangeDirectorChallenge: (challengeId: string) => void;
  onManualAttempt: (challengeId: string, teamName: string) => void;
  onManualFailed: (challengeId: string, teamName: string) => void;
  onManualSolved: (
    challengeId: string,
    teamName: string,
    forceFirstBlood?: boolean
  ) => void;
  onTriggerCyberStorm: () => void;
}

const VERSION_OPTIONS: { value: SandboxVersion; label: string }[] = [
  { value: '0.1', label: 'v0.1 经典工业版' },
  { value: '0.2', label: 'v0.2 全息星际版' },
  { value: '0.3', label: 'v0.3 暗黑钛金版' },
  { value: '0.4', label: 'v0.4 未来沙盘版' },
  { value: '0.5', label: 'v0.5 中央突击版' },
];

export const DirectorConsole: React.FC<DirectorConsoleProps> = ({
  sandboxVersion,
  onSwitchVersion,
  dockCollapsed,
  onToggleCollapse,
  activeZoneFocus,
  onFocusZone,
  zones,
  teams,
  labelMode,
  onCycleLabelMode,
  cameraMode,
  onSwitchCameraMode,
  autoSimRunning,
  onToggleAutoSim,
  soundEnabled,
  onToggleSound,
  directorTeam,
  onChangeDirectorTeam,
  directorZoneId,
  onChangeDirectorZone,
  directorChallengeId,
  onChangeDirectorChallenge,
  onManualAttempt,
  onManualFailed,
  onManualSolved,
  onTriggerCyberStorm,
}) => {
  const currentDirectorZone =
    zones.find((z) => z.id === directorZoneId) || zones[0];

  return (
    <div
      className="pointer-events-auto relative z-20 w-full max-w-[920px] transition-transform duration-200 ease-out"
      style={{
        transform: dockCollapsed ? 'translateY(calc(100% - 28px))' : 'translateY(0)',
      }}
    >
      {/* 折叠/展开把手 */}
      <div className="flex justify-center">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex items-center gap-1.5 px-4 py-1 text-xs font-medium text-[#e5e7eb] border border-b-0 border-[#00d4ff]/35 rounded-t-md hover:text-[#00d4ff] transition-colors cursor-pointer"
          style={{
            backgroundColor: 'rgba(10, 14, 23, 0.85)',
            backdropFilter: 'blur(8px)',
          }}
        >
          {dockCollapsed ? (
            <>
              <ChevronUp className="w-3.5 h-3.5 text-[#00d4ff]" />
              <span>展开沙盘导演台 (H)</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5 text-[#00d4ff]" />
              <span>收起沙盘导演台 (H)</span>
            </>
          )}
        </button>
      </div>

      {/* 控制台主体：八边形切角毛玻璃 */}
      <div
        className="p-[1px] clip-octa-12"
        style={{
          background:
            'linear-gradient(135deg, rgba(0,212,255,0.6) 0%, rgba(0,212,255,0.18) 50%, rgba(0,212,255,0.5) 100%)',
        }}
      >
        <div
          className="clip-octa-12 px-3.5 py-2.5 space-y-2"
          style={{
            backgroundColor: 'rgba(10, 14, 23, 0.82)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
        >
          {/* 第一行：分区巡航 + 视角/版本下拉框/铭牌/推演 */}
          <div className="flex flex-wrap items-center justify-between gap-1.5 pb-2 border-b border-[#00d4ff]/15">
            <div className="flex flex-wrap items-center gap-1 py-0.5">
              <span className="text-[11px] xl:text-xs text-[#9ca3af] flex items-center gap-1 mr-0.5 shrink-0">
                <Compass className="w-3.5 h-3.5 text-[#00d4ff]" />
                巡航:
              </span>
              <button
                type="button"
                onClick={() => onFocusZone('all')}
                className={`px-1.5 xl:px-2 py-0.5 xl:py-1 text-[11px] xl:text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeZoneFocus === 'all'
                    ? 'bg-[#00d4ff] text-[#050811] font-semibold'
                    : 'bg-[#142034]/85 text-[#e5e7eb] hover:text-[#00d4ff]'
                }`}
              >
                全网
              </button>
              {zones.map((z) => (
                <button
                  key={z.id}
                  type="button"
                  onClick={() => {
                    onFocusZone(z.id);
                    onChangeDirectorZone(z.id);
                    if (z.challenges[0]) {
                      onChangeDirectorChallenge(z.challenges[0].id);
                    }
                  }}
                  className={`px-1.5 xl:px-2 py-0.5 xl:py-1 text-[11px] xl:text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    activeZoneFocus === z.id
                      ? 'bg-[#00d4ff] text-[#050811] font-semibold'
                      : 'bg-[#142034]/85 text-[#9ca3af] hover:text-[#e5e7eb]'
                  }`}
                >
                  {z.shortName}
                </button>
              ))}
              <button
                type="button"
                onClick={() => onFocusZone('attack')}
                className={`px-1.5 xl:px-2 py-0.5 xl:py-1 text-[11px] xl:text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeZoneFocus === 'attack'
                    ? 'bg-[#ff6b35] text-white font-semibold'
                    : 'bg-[#ff6b35]/15 text-[#ff6b35] border border-[#ff6b35]/35 hover:bg-[#ff6b35]/25'
                }`}
              >
                攻击区
              </button>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {/* 版本切换下拉框 */}
              <label className="flex items-center gap-1.5 px-2 py-1 text-xs bg-[#0d1829] border border-[#00d4ff]/45 rounded text-[#00d4ff]">
                <Layers className="w-3.5 h-3.5 shrink-0" />
                <span className="text-[#9ca3af] whitespace-nowrap">版本:</span>
                <select
                  value={sandboxVersion}
                  onChange={(e) => onSwitchVersion(e.target.value as SandboxVersion)}
                  aria-label="选择 3D 沙盘版本"
                  className="bg-transparent text-xs font-semibold text-[#00d4ff] focus:outline-none cursor-pointer pr-1"
                >
                  {VERSION_OPTIONS.map((opt) => (
                    <option
                      key={opt.value}
                      value={opt.value}
                      className="bg-[#0a0e17] text-[#e5e7eb]"
                    >
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                onClick={onCycleLabelMode}
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium bg-[#142034]/85 text-[#e5e7eb] border border-slate-700/80 rounded hover:border-[#00d4ff]/50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                title="切换设备全息铭牌显示密度"
              >
                <Tag className="w-3.5 h-3.5 text-[#00d4ff]" />
                {labelMode === 'compact'
                  ? '铭牌:精简'
                  : labelMode === 'full'
                  ? '铭牌:全部'
                  : '铭牌:悬停'}
              </button>

              <button
                type="button"
                onClick={() =>
                  onSwitchCameraMode(
                    cameraMode === 'topology' ? 'panorama' : 'topology'
                  )
                }
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium bg-[#142034]/85 text-[#00d4ff] border border-[#00d4ff]/30 rounded hover:bg-[#192944] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                {cameraMode === 'topology' ? '动态拓扑' : '全景俯视'}
              </button>

              <button
                type="button"
                onClick={onToggleAutoSim}
                className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  autoSimRunning
                    ? 'bg-[#00ff88]/15 text-[#00ff88] border-[#00ff88]/40'
                    : 'bg-slate-800/80 text-[#9ca3af] border-slate-700'
                }`}
              >
                {autoSimRunning ? (
                  <>
                    <Pause className="w-3.5 h-3.5" />
                    自动推演
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    已暂停
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onToggleSound}
                className="p-1.5 text-[#9ca3af] bg-[#142034]/85 border border-slate-700/80 rounded hover:text-[#00d4ff] transition-colors cursor-pointer"
                title={soundEnabled ? '关闭攻防音效' : '开启攻防音效'}
              >
                {soundEnabled ? (
                  <Volume2 className="w-3.5 h-3.5 text-[#00d4ff]" />
                ) : (
                  <VolumeX className="w-3.5 h-3.5 text-slate-500" />
                )}
              </button>
            </div>
          </div>

          {/* 第二行：导演台攻防交互演练 */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium text-[#e5e7eb] flex items-center gap-1 whitespace-nowrap">
                <Zap className="w-3.5 h-3.5 text-[#00d4ff]" />
                导演台:
              </span>

              <select
                value={directorTeam}
                onChange={(e) => onChangeDirectorTeam(e.target.value)}
                aria-label="选择攻击战队"
                className="bg-[#09101d] border border-slate-700/90 rounded px-2 py-1 text-xs text-[#e5e7eb] focus:outline-none focus:border-[#00d4ff]"
              >
                {teams.slice(0, 12).map((t) => (
                  <option key={t.id} value={t.name}>
                    {t.name}
                  </option>
                ))}
              </select>

              <select
                value={directorZoneId}
                onChange={(e) => {
                  const zid = e.target.value as ZoneId;
                  onChangeDirectorZone(zid);
                  const z = zones.find((item) => item.id === zid);
                  if (z && z.challenges.length > 0) {
                    onChangeDirectorChallenge(z.challenges[0].id);
                  }
                }}
                aria-label="选择目标方向"
                className="bg-[#09101d] border border-slate-700/90 rounded px-2 py-1 text-xs text-[#e5e7eb] focus:outline-none focus:border-[#00d4ff]"
              >
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.shortName}
                  </option>
                ))}
              </select>

              <select
                value={directorChallengeId}
                onChange={(e) => onChangeDirectorChallenge(e.target.value)}
                aria-label="选择目标题目"
                className="bg-[#09101d] border border-slate-700/90 rounded px-2 py-1 text-xs text-[#00d4ff] font-tech-num focus:outline-none focus:border-[#00d4ff] max-w-[165px]"
              >
                {currentDirectorZone.challenges.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.id} · {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => onManualAttempt(directorChallengeId, directorTeam)}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-[#ff6b35]/15 text-[#ff6b35] border border-[#ff6b35]/45 rounded hover:bg-[#ff6b35]/25 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Crosshair className="w-3.5 h-3.5" />
                尝试解题
              </button>

              <button
                type="button"
                onClick={() => onManualFailed(directorChallengeId, directorTeam)}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-rose-500/15 text-rose-300 border border-rose-500/45 rounded hover:bg-rose-500/25 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                提交失败
              </button>

              <button
                type="button"
                onClick={() =>
                  onManualSolved(directorChallengeId, directorTeam, false)
                }
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-[#00ff88]/15 text-[#00ff88] border border-[#00ff88]/45 rounded hover:bg-[#00ff88]/25 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Trophy className="w-3.5 h-3.5" />
                夺旗成功
              </button>

              <button
                type="button"
                onClick={() =>
                  onManualSolved(directorChallengeId, directorTeam, true)
                }
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-amber-400/15 text-amber-300 border border-amber-400/45 rounded hover:bg-amber-400/25 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Flame className="w-3.5 h-3.5" />
                首解一血
              </button>

              <button
                type="button"
                onClick={onTriggerCyberStorm}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-[#00d4ff]/20 text-[#00d4ff] border border-[#00d4ff]/50 rounded hover:bg-[#00d4ff]/30 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                齐射演练
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
