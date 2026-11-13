import React, { useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw, Search } from 'lucide-react';
import { CyberPanel } from './CyberPanel';
import { BattleEvent, Team } from '../types/cyberRange';

interface RightDashboardProps {
  teams: Team[];
  totalChallenges: number;
  battleEvents: BattleEvent[];
  focusTeamName?: string;
  onSelectTeam?: (teamName: string) => void;
  onRefreshRanking?: () => void;
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
  onRefreshRanking,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [hoverPaused, setHoverPaused] = useState(false);
  const [scrollRowIndex, setScrollRowIndex] = useState(0);
  const [scoreDeltas, setScoreDeltas] = useState<Record<string, ScoreDeltaPopup>>(
    {}
  );
  const [isSpinning, setIsSpinning] = useState(false);

  const prevScoresRef = useRef<Record<string, number>>({});

  // 排序 TOP 10 战队
  const top10Teams = useMemo(() => {
    const sorted = [...teams].sort((a, b) => b.score - a.score);
    const indexed = sorted.slice(0, 10).map((t, idx) => ({
      ...t,
      rank: idx + 1,
    }));
    if (!searchQuery.trim()) return indexed;
    const q = searchQuery.trim().toLowerCase();
    return sorted
      .map((t, idx) => ({ ...t, rank: idx + 1 }))
      .filter((t) => t.name.toLowerCase().includes(q));
  }, [teams, searchQuery]);

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

  // 每 2 秒向上滚动一行（鼠标悬停或搜索时暂停）
  const visibleRows = 7;
  const canScroll = !searchQuery.trim() && top10Teams.length > visibleRows;

  useEffect(() => {
    if (!canScroll || hoverPaused) return;
    const timer = window.setInterval(() => {
      setScrollRowIndex((prev) => (prev + 1) % top10Teams.length);
    }, 2000);
    return () => clearInterval(timer);
  }, [canScroll, hoverPaused, top10Teams.length]);

  const orderedVisibleTeams = useMemo(() => {
    if (!canScroll) return top10Teams;
    const list: (Team & { rank: number })[] = [];
    for (let i = 0; i < top10Teams.length; i++) {
      list.push(top10Teams[(scrollRowIndex + i) % top10Teams.length]);
    }
    return list;
  }, [top10Teams, scrollRowIndex, canScroll]);

  // 保留最近 15 条事件，按时间正序从底部滑入（最新在最下方）
  const timelineEvents = useMemo(() => {
    return battleEvents.slice(0, 15).reverse();
  }, [battleEvents]);

  const eventListRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (eventListRef.current) {
      eventListRef.current.scrollTop = eventListRef.current.scrollHeight;
    }
  }, [timelineEvents.length, timelineEvents[timelineEvents.length - 1]?.id]);

  return (
    <aside className="pointer-events-auto w-[288px] xl:w-[316px] 2xl:w-[340px] shrink-0 h-full flex flex-col gap-3 min-h-0">
      {/* 右侧面板 1：TOP10 排行榜 (Leaderboard) ~55% */}
      <CyberPanel className="flex-[55] min-h-0" innerClassName="px-3.5 py-2.5">
        {/* 标题 + 搜索框 + 刷新按钮 */}
        <div className="flex items-center justify-between gap-1.5 mb-2 shrink-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="w-2 h-2 bg-[#00d4ff] rotate-45 inline-block shrink-0 shadow-[0_0_8px_#00d4ff]" />
            <h2 className="text-[13px] font-medium tracking-wide text-[#e5e7eb] truncate">
              实时积分排行榜{' '}
              <span className="text-[11px] font-normal text-[#9ca3af]">
                (TOP10)
              </span>
            </h2>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <div className="relative flex items-center">
              <Search className="w-3 h-3 text-[#9ca3af] absolute left-2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setScrollRowIndex(0);
                }}
                placeholder="搜队伍"
                aria-label="搜索参赛队伍"
                className="w-[70px] bg-[#0d1526]/90 border border-[#00d4ff]/25 rounded px-1.5 pl-6 py-0.5 text-[11px] text-[#e5e7eb] placeholder-[#9ca3af]/70 focus:outline-none focus:border-[#00d4ff]"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setIsSpinning(true);
                setScrollRowIndex(0);
                onRefreshRanking?.();
                window.setTimeout(() => setIsSpinning(false), 500);
              }}
              className="p-1 text-[#9ca3af] hover:text-[#00d4ff] transition-colors cursor-pointer"
              title="刷新排行榜置顶"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isSpinning ? 'animate-spin text-[#00d4ff]' : ''}`}
              />
            </button>
          </div>
        </div>

        {/* 表头：排名 | 队伍 | 进度 | 得分 */}
        <div className="grid grid-cols-[34px_1fr_52px_62px] items-center px-1.5 py-1.5 text-[11px] text-[#9ca3af] border-b border-[#00d4ff]/20 shrink-0">
          <span>排名</span>
          <span>队伍</span>
          <span className="text-center">进度</span>
          <span className="text-right">得分</span>
        </div>

        {/* 列表容器（固定高度超出隐藏，每2秒向上滚动一行，悬停暂停） */}
        <div
          className="flex-1 min-h-0 overflow-hidden mt-1 space-y-1"
          onMouseEnter={() => setHoverPaused(true)}
          onMouseLeave={() => setHoverPaused(false)}
        >
          {orderedVisibleTeams.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-[#9ca3af]">
              未找到匹配队伍
            </div>
          ) : (
            orderedVisibleTeams.map((team) => {
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

              return (
                <button
                  key={team.id}
                  type="button"
                  onClick={() => onSelectTeam?.(team.name)}
                  className={`w-full grid grid-cols-[34px_1fr_52px_62px] items-center px-1.5 py-2 rounded text-left transition-all duration-300 cursor-pointer ${
                    isFocus
                      ? 'bg-[#00d4ff]/14 border border-[#00d4ff]/35 shadow-[inset_0_0_12px_rgba(0,212,255,0.12)]'
                      : 'border border-transparent hover:bg-white/[0.04]'
                  }`}
                >
                  {/* 排名 */}
                  <span className={`font-tech-num text-sm ${rankColor}`}>
                    {String(team.rank).padStart(2, '0')}
                  </span>

                  {/* 队伍 (LOGO + 名称) */}
                  <div className="flex items-center gap-2 min-w-0 pr-1">
                    <span
                      className="w-5 h-5 clip-hex-avatar shrink-0 flex items-center justify-center text-[10px] font-bold text-white"
                      style={{
                        background: `linear-gradient(135deg, ${team.color}cc, rgba(10,14,23,0.9))`,
                        border: `1px solid ${team.color}`,
                      }}
                    >
                      {team.name.slice(0, 1)}
                    </span>
                    <span
                      className={`text-xs truncate ${
                        isTop1 || isTop2 || isTop3 || isFocus
                          ? 'font-bold text-[#e5e7eb]'
                          : 'font-normal text-[#e5e7eb]'
                      }`}
                    >
                      {team.name}
                    </span>
                  </div>

                  {/* 进度 (已解/总题) */}
                  <div className="text-center font-tech-num text-xs text-[#9ca3af]">
                    <span className="text-[#e5e7eb]">{team.solvedCount}</span>/
                    {totalChallenges}
                  </div>

                  {/* 得分 + 浮动 +XXX 飘字 */}
                  <div className="relative text-right font-tech-num text-xs">
                    {delta && (
                      <span
                        key={delta.id}
                        className="pointer-events-none absolute -top-1 right-0 text-[11px] font-bold text-[#00ff88] animate-score-delta whitespace-nowrap"
                      >
                        +{delta.delta}
                      </span>
                    )}
                    <span
                      className={`font-bold transition-colors duration-300 ${
                        delta
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

      {/* 右侧面板 2：解题动态流 (Real-time Event Log) ~45% */}
      <CyberPanel className="flex-[45] min-h-0" innerClassName="px-3.5 py-2.5">
        <div className="flex items-center justify-between mb-2 shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 bg-[#00d4ff] rotate-45 inline-block shadow-[0_0_8px_#00d4ff]" />
            <h2 className="text-[13px] font-medium tracking-wide text-[#e5e7eb]">
              实时动态{' '}
              <span className="text-[11px] font-normal text-[#9ca3af]">
                (Event Log)
              </span>
            </h2>
            {/* SSE 连接状态闪烁红点 */}
            <span
              className="w-2 h-2 rounded-full bg-red-500 animate-sse-dot inline-block"
              title="SSE 实时数据流在线"
            />
          </div>
          <span className="font-tech-num text-[11px] text-[#9ca3af]">
            最近 {timelineEvents.length} 条
          </span>
        </div>

        {/* 垂直时间轴列表：新消息从底部滑入（微弱绿光），旧消息向上挤压淡出 */}
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
            const isSuccess = ev.type === 'solved' || ev.type === 'firstBlood';
            const isAttemptOrFail = ev.type === 'failed' || ev.type === 'attempt';

            return (
              <div
                key={ev.id}
                className="flex items-stretch gap-2.5 px-1.5 py-1 rounded animate-event-enter"
              >
                {/* 左侧时间戳 */}
                <span className="font-tech-num text-[10px] text-[#9ca3af] shrink-0 pt-0.5 w-[48px]">
                  {ev.timestamp}
                </span>

                {/* 中间：垂直虚线（带青色微光） */}
                <div className="relative flex flex-col items-center shrink-0 w-3">
                  <span
                    className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                      isSuccess
                        ? 'bg-[#00ff88] shadow-[0_0_6px_#00ff88]'
                        : 'bg-[#ff6b35] shadow-[0_0_6px_#ff6b35]'
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
                  {isSuccess ? (
                    <p className="text-[#00ff88]">
                      <span className="font-medium">{ev.teamName}</span> 解出{' '}
                      <span className="text-[#e5e7eb]">【{ev.zoneName}】</span>{' '}
                      {ev.challengeName}
                      {ev.type === 'firstBlood' && (
                        <span className="ml-1 text-[#ffd24a] font-tech-num text-[10px]">
                          [一血]
                        </span>
                      )}
                    </p>
                  ) : isAttemptOrFail ? (
                    <p className="text-[#ff6b35]">
                      <span className="font-medium">{ev.teamName}</span>{' '}
                      {ev.type === 'failed' ? '尝试提交' : '正在破解'}{' '}
                      <span className="text-[#e5e7eb]">【{ev.zoneName}】</span>{' '}
                      {ev.type === 'failed'
                        ? `${ev.challengeName} 失败`
                        : ev.challengeName}
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </CyberPanel>
    </aside>
  );
};
