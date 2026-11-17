import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CyberPanel } from './CyberPanel';
import { BattleEvent, Team } from '../types/cyberRange';

interface RightDashboardProps {
  teams: Team[];
  totalChallenges: number;
  battleEvents: BattleEvent[];
  focusTeamName?: string;
  onSelectTeam?: (teamName: string) => void;
  onRefreshRanking?: () => void;
  wireframeMode?: boolean;
}

interface ScoreDeltaPopup {
  id: string;
  delta: number;
}

export const RightDashboard: React.FC<RightDashboardProps> = ({
  teams,
  totalChallenges,
  battleEvents,
  focusTeamName = '网络护卫队',
  onSelectTeam,
  wireframeMode = false,
}) => {
  const [scoreDeltas, setScoreDeltas] = useState<Record<string, ScoreDeltaPopup>>(
    {}
  );

  const prevScoresRef = useRef<Record<string, number>>({});

  // 排序 TOP 10 战队（固定显示前 10 名，不滚动）
  const top10Teams = useMemo(() => {
    const sorted = [...teams].sort((a, b) => b.score - a.score);
    return sorted.slice(0, 10).map((t, idx) => ({
      ...t,
      rank: idx + 1,
    }));
  }, [teams]);

  // 监听积分变化并触发绿色闪现 + 向上飘动的 +XXX 浮动字
  useEffect(() => {
    const prev = prevScoresRef.current;
    const nextPopups: Record<string, ScoreDeltaPopup> = {};
    let changed = false;

    teams.forEach((t) => {
      if (prev[t.id] !== undefined && t.score > prev[t.id]) {
        changed = true;
        nextPopups[t.id] = {
          id: `${t.id}-${Date.now()}`,
          delta: t.score - prev[t.id],
        };
      }
      prev[t.id] = t.score;
    });

    if (changed) {
      setScoreDeltas((curr) => ({ ...curr, ...nextPopups }));
      const clearTimer = window.setTimeout(() => {
        setScoreDeltas((curr) => {
          const copy = { ...curr };
          Object.keys(nextPopups).forEach((k) => {
            if (copy[k]?.id === nextPopups[k].id) {
              delete copy[k];
            }
          });
          return copy;
        });
      }, 1450);
      return () => clearTimeout(clearTimer);
    }
  }, [teams]);

  // 仅保留成功解题和一血事件（最近 15 条，按时间正序从底部滑入，最新在最下方）
  const timelineEvents = useMemo(() => {
    return battleEvents
      .filter((ev) => ev.type === 'solved' || ev.type === 'firstBlood')
      .slice(0, 15)
      .reverse();
  }, [battleEvents]);

  const eventListRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (eventListRef.current) {
      eventListRef.current.scrollTop = eventListRef.current.scrollHeight;
    }
  }, [timelineEvents.length, timelineEvents[timelineEvents.length - 1]?.id]);

  return (
    <aside className="pointer-events-auto w-[280px] xl:w-[308px] 2xl:w-[328px] shrink-0 h-full flex flex-col gap-2.5 min-h-0">
      {/* 右侧面板 1：TOP10 排行榜 (固定显示前 10 名，自适应填充上方剩余高度) */}
      <CyberPanel
        wireframeMode={wireframeMode}
        className="flex-1 min-h-0"
        innerClassName="px-3 py-2.5"
      >
        {/* 标题 */}
        <div className="flex items-center justify-between gap-1.5 mb-1.5 shrink-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className={`w-2 h-2 inline-block shrink-0 ${
                wireframeMode
                  ? 'border border-[#00d4ff] bg-transparent shadow-[0_0_6px_#00d4ff]'
                  : 'bg-[#00d4ff] rotate-45 shadow-[0_0_8px_#00d4ff]'
              }`}
            />
            <h2
              className={`text-[13px] font-medium tracking-wide truncate ${
                wireframeMode ? 'text-white' : 'text-[#e5e7eb]'
              }`}
            >
              队伍排名TOP10
            </h2>
          </div>
        </div>

        {/* 表头：排名 | 队伍 | 进度 | 得分 */}
        <div
          className={`grid grid-cols-[32px_1fr_48px_58px] items-center px-1.5 py-1 text-[11px] border-b shrink-0 ${
            wireframeMode
              ? 'text-[#00d4ff] border-[#00d4ff]/45 font-hud-mono'
              : 'text-[#9ca3af] border-[#00d4ff]/20'
          }`}
        >
          <span>排名</span>
          <span>队伍</span>
          <span className="text-center">进度</span>
          <span className="text-right">得分</span>
        </div>

        {/* 列表容器：始终完整固定展示前 10 名，自适应等距分布无滚动 */}
        <div
          className={`flex-1 min-h-0 flex flex-col justify-between ${
            wireframeMode ? 'mt-0.5' : 'mt-1'
          }`}
        >
          {top10Teams.length === 0 ? (
            <div className="py-8 flex items-center justify-center text-xs text-[#9ca3af]">
              未找到匹配队伍
            </div>
          ) : (
            top10Teams.map((team, idx) => {
              const isFocus = team.name === focusTeamName;
              const isTop1 = team.rank === 1;
              const isTop2 = team.rank === 2;
              const isTop3 = team.rank === 3;
              const delta = scoreDeltas[team.id];

              const rankColor = isTop1
                ? 'text-[#ffd24a] font-bold'
                : isTop2
                ? 'text-[#e2e8f0] font-bold'
                : isTop3
                ? 'text-[#d97706] font-bold'
                : 'text-[#9ca3af]';

              const wireframeRankClass = isTop1
                ? 'rank-hollow-gold text-[16px] font-bold'
                : isTop2
                ? 'rank-hollow-silver text-[16px] font-bold'
                : isTop3
                ? 'rank-hollow-bronze text-[16px] font-bold'
                : 'text-[#00d4ff] text-[12px]';

              return (
                <button
                  key={team.id}
                  type="button"
                  onClick={() => onSelectTeam?.(team.name)}
                  className={`w-full flex-1 max-h-[46px] grid grid-cols-[32px_1fr_48px_58px] items-center px-1.5 py-[3px] text-left transition-all duration-300 cursor-pointer ${
                    wireframeMode
                      ? `bg-transparent rounded-none ${
                          idx < top10Teams.length - 1
                            ? 'border-b border-dashed border-[#00d4ff]/35'
                            : ''
                        } ${
                          isFocus
                            ? 'shadow-[inset_2px_0_0_#00d4ff]'
                            : 'hover:bg-[#00d4ff]/[0.06]'
                        }`
                      : `rounded ${
                          isFocus
                            ? 'bg-[#00d4ff]/14 border border-[#00d4ff]/35 shadow-[inset_0_0_12px_rgba(0,212,255,0.12)]'
                            : 'border border-transparent hover:bg-white/[0.04]'
                        }`
                  }`}
                >
                  {/* 排名：0.1版前三名为金色/银色/铜色较大空心字体 */}
                  {wireframeMode ? (
                    <span
                      className={`font-hud-mono leading-none ${wireframeRankClass}`}
                    >
                      {isTop1 || isTop2 || isTop3
                        ? String(team.rank)
                        : String(team.rank).padStart(2, '0')}
                    </span>
                  ) : (
                    <span
                      className={`font-tech-num text-[13px] leading-none ${rankColor}`}
                    >
                      {String(team.rank).padStart(2, '0')}
                    </span>
                  )}

                  {/* 队伍 (LOGO + 名称) */}
                  <div className="flex items-center gap-2 min-w-0 pr-1">
                    <span
                      className="w-[18px] h-[18px] clip-hex-avatar shrink-0 flex items-center justify-center text-[10px] font-bold text-white"
                      style={{
                        background: wireframeMode
                          ? 'transparent'
                          : `linear-gradient(135deg, ${team.color}cc, rgba(10,14,23,0.9))`,
                        border: wireframeMode
                          ? '1px solid #00d4ff'
                          : `1px solid ${team.color}`,
                      }}
                    >
                      {team.name.slice(0, 1)}
                    </span>
                    <span
                      className={`text-xs leading-tight truncate ${
                        wireframeMode
                          ? 'text-white font-medium'
                          : isTop1 || isTop2 || isTop3 || isFocus
                          ? 'font-bold text-[#e5e7eb]'
                          : 'font-normal text-[#e5e7eb]'
                      }`}
                    >
                      {team.name}
                    </span>
                  </div>

                  {/* 进度 (已解/总题) */}
                  <div
                    className={`text-center text-[11px] ${
                      wireframeMode
                        ? 'font-hud-mono text-[#00d4ff]'
                        : 'font-tech-num text-[#9ca3af]'
                    }`}
                  >
                    <span className={wireframeMode ? 'text-white' : 'text-[#e5e7eb]'}>
                      {team.solvedCount}
                    </span>
                    /{totalChallenges}
                  </div>

                  {/* 得分 + 浮动 +XXX 飘字 */}
                  <div
                    className={`relative text-right text-xs ${
                      wireframeMode ? 'font-hud-mono' : 'font-tech-num'
                    }`}
                  >
                    {delta && (
                      <span
                        key={delta.id}
                        className={`pointer-events-none absolute -top-1 right-0 text-[11px] font-bold animate-score-delta whitespace-nowrap ${
                          wireframeMode ? 'text-[#00d4ff]' : 'text-[#00ff88]'
                        }`}
                      >
                        +{delta.delta}
                      </span>
                    )}
                    <span
                      className={`font-bold transition-colors duration-300 ${
                        wireframeMode
                          ? 'text-white'
                          : delta
                          ? 'text-[#00ff88] drop-shadow-[0_0_8px_rgba(0,255,136,0.85)]'
                          : 'text-[#00d4ff]'
                      }`}
                    >
                      {team.score.toLocaleString()}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </CyberPanel>

      {/* 右侧面板 2：解题动态流 (Real-time Event Log) 与左侧实时一血榜始终保持等高 */}
      <CyberPanel
        wireframeMode={wireframeMode}
        className="h-[35%] min-h-[214px] max-h-[330px] shrink-0"
        innerClassName="px-3 py-2"
      >
        <div className="flex items-center justify-between mb-2 shrink-0">
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 inline-block ${
                wireframeMode
                  ? 'border border-[#00d4ff] bg-transparent shadow-[0_0_6px_#00d4ff]'
                  : 'bg-[#00d4ff] rotate-45 shadow-[0_0_8px_#00d4ff]'
              }`}
            />
            <h2
              className={`text-[13px] font-medium tracking-wide ${
                wireframeMode ? 'text-white' : 'text-[#e5e7eb]'
              }`}
            >
              攻击动态
            </h2>
          </div>
        </div>

        {/* 垂直时间轴列表 */}
        <div
          ref={eventListRef}
          className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-1.5"
          style={{
            maskImage:
              'linear-gradient(to bottom, transparent 0%, black 14%, black 100%)',
            WebkitMaskImage:
              'linear-gradient(to bottom, transparent 0%, black 14%, black 100%)',
          }}
        >
          {timelineEvents.map((ev) => {
            const isFirstBlood = ev.type === 'firstBlood';
            const pointsValue = ev.points ?? 0;

            return (
              <div
                key={ev.id}
                className="flex items-stretch gap-2.5 px-1.5 py-1 rounded animate-event-enter"
              >
                {/* 左侧时间戳 */}
                <span
                  className={`text-[10px] shrink-0 pt-0.5 w-[48px] ${
                    wireframeMode
                      ? 'font-hud-mono text-[#00d4ff]/85'
                      : 'font-tech-num text-[#9ca3af]'
                  }`}
                >
                  {ev.timestamp}
                </span>

                {/* 中间：垂直虚线（带青色微光） */}
                <div className="relative flex flex-col items-center shrink-0 w-3">
                  <span
                    className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                      wireframeMode
                        ? isFirstBlood
                          ? 'bg-[#ffd24a] shadow-[0_0_6px_#ffd24a]'
                          : 'bg-[#00d4ff] shadow-[0_0_6px_#00d4ff]'
                        : isFirstBlood
                        ? 'bg-[#ffd24a] shadow-[0_0_6px_#ffd24a]'
                        : 'bg-[#00ff88] shadow-[0_0_6px_#00ff88]'
                    }`}
                  />
                  <span
                    className="w-[1px] flex-1 border-l border-dashed border-[#00d4ff]/45 mt-1"
                    style={{
                      boxShadow: '0 0 4px rgba(0, 212, 255, 0.25)',
                    }}
                  />
                </div>

                {/* 右侧内容文本 */}
                <div className="flex-1 min-w-0 text-xs leading-snug">
                  {isFirstBlood ? (
                    <p className={wireframeMode ? 'text-[#00d4ff]' : 'text-[#ffd24a]'}>
                      <span className="font-medium text-white">{ev.teamName}</span>{' '}
                      成功拿下{' '}
                      <span className="text-white">【{ev.zoneName}】</span>{' '}
                      {ev.challengeName}一血，获得{' '}
                      <span
                        className={`font-bold ${
                          wireframeMode
                            ? 'font-hud-mono text-[#ffd24a]'
                            : 'font-tech-num text-[#ffd24a]'
                        }`}
                      >
                        {pointsValue}
                      </span>{' '}
                      分！
                    </p>
                  ) : (
                    <p className={wireframeMode ? 'text-[#00d4ff]' : 'text-[#00ff88]'}>
                      <span className="font-medium text-white">{ev.teamName}</span>{' '}
                      解出了{' '}
                      <span className="text-white">【{ev.zoneName}】</span>{' '}
                      {ev.challengeName}，获得{' '}
                      <span
                        className={`font-bold ${
                          wireframeMode
                            ? 'font-hud-mono text-white'
                            : 'font-tech-num text-[#00ff88]'
                        }`}
                      >
                        {pointsValue}
                      </span>{' '}
                      分。
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CyberPanel>
    </aside>
  );
};
