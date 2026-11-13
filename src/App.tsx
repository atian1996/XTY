/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Crosshair,
  ShieldAlert,
  Trophy,
  X,
} from 'lucide-react';
import {
  AttackFollowBannerInfo,
  BattleEvent,
  CameraMode,
  HoveredNodeInfo,
  INITIAL_TEAMS,
  INITIAL_ZONES,
  SandboxVersion,
  SelectedNodeInfo,
  STATE_COLOR_HEX,
  Team,
  ZoneConfig,
  ZoneId,
} from './types/cyberRange';
import { LabelDisplayMode } from './three/archetypes';
import { CyberRangeScene } from './three/CyberRangeScene';
import { soundFX } from './utils/soundFX';
import { HeaderBar } from './components/HeaderBar';
import {
  DirectionProgressItem,
  FirstBloodCardItem,
  LeftDashboard,
} from './components/LeftDashboard';
import { RightDashboard } from './components/RightDashboard';
import { DirectorConsole } from './components/DirectorConsole';
import { SceneControls } from './components/SceneControls';

const INITIAL_DIRECTION_COUNTS: Record<ZoneId, number> = {
  'ai-access': 35,
  inference: 22,
  agent: 16,
  knowledge: 18,
  compute: 10,
  ops: 8,
  net: 6,
};

const DIRECTION_TOTAL_PER_ZONE = 50;

const INITIAL_FIRST_BLOODS: FirstBloodCardItem[] = [
  {
    id: 'fb-init-1',
    teamName: '天枢安全战队',
    teamColor: '#00d4ff',
    zoneName: 'AI 应用接入',
    challengeName: '网关鉴权绕过',
    timestamp: '10:24:15',
    rankIndex: 1,
  },
  {
    id: 'fb-init-2',
    teamName: '深蓝零日组',
    teamColor: '#a855f7',
    zoneName: '模型推理服务',
    challengeName: 'Safetensors 头部越界',
    timestamp: '10:25:04',
    rankIndex: 2,
  },
  {
    id: 'fb-init-3',
    teamName: '星渊红队',
    teamColor: '#ffd24a',
    zoneName: '智能体编排',
    challengeName: '工具调用 SSRF 穿透',
    timestamp: '10:26:42',
    rankIndex: 3,
  },
  {
    id: 'fb-init-4',
    teamName: '天枢安全战队',
    teamColor: '#00d4ff',
    zoneName: 'AI 知识库',
    challengeName: 'Embedding 逆向还原',
    timestamp: '10:28:19',
    rankIndex: 4,
  },
  {
    id: 'fb-init-5',
    teamName: '网络护卫队',
    teamColor: '#ff6b35',
    zoneName: '算力调度',
    challengeName: 'NVIDIA 容器挂载逃逸',
    timestamp: '10:29:51',
    rankIndex: 5,
  },
];

const INITIAL_EVENTS: BattleEvent[] = [
  {
    id: 'ev-init-6',
    timestamp: '10:30:12',
    type: 'solved',
    teamName: '网络护卫队',
    teamColor: '#00ff88',
    challengeId: 'AI-01',
    challengeName: '网关鉴权绕过',
    zoneId: 'ai-access',
    zoneName: 'AI接入',
    points: 500,
  },
  {
    id: 'ev-init-5',
    timestamp: '10:29:47',
    type: 'failed',
    teamName: '苍穹逆向联队',
    teamColor: '#ff6b35',
    challengeId: 'KDB-03',
    challengeName: '知识图谱 Cypher 注入',
    zoneId: 'knowledge',
    zoneName: '知识库',
  },
  {
    id: 'ev-init-4',
    timestamp: '10:28:31',
    type: 'solved',
    teamName: '长城守夜人',
    teamColor: '#00ff88',
    challengeId: 'AI-03',
    challengeName: '流式响应侧信道',
    zoneId: 'ai-access',
    zoneName: 'AI接入',
    points: 600,
  },
  {
    id: 'ev-init-3',
    timestamp: '10:27:19',
    type: 'attempt',
    teamName: '网络护卫队',
    teamColor: '#ff6b35',
    challengeId: 'AI-02',
    challengeName: '提示词注入绕过',
    zoneId: 'ai-access',
    zoneName: 'AI接入',
  },
  {
    id: 'ev-init-2',
    timestamp: '10:25:04',
    type: 'firstBlood',
    teamName: '深蓝零日组',
    teamColor: '#a855f7',
    challengeId: 'INF-01',
    challengeName: 'Safetensors 头部越界',
    zoneId: 'inference',
    zoneName: '推理服务',
    points: 600,
  },
  {
    id: 'ev-init-1',
    timestamp: '10:24:15',
    type: 'firstBlood',
    teamName: '天枢安全战队',
    teamColor: '#00d4ff',
    challengeId: 'AI-01',
    challengeName: '网关鉴权绕过',
    zoneId: 'ai-access',
    zoneName: 'AI接入',
    points: 500,
  },
];

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const sceneInstanceRef = useRef<CyberRangeScene | null>(null);

  const zonesRef = useRef<ZoneConfig[]>(structuredClone(INITIAL_ZONES));
  const teamsRef = useRef<Team[]>(structuredClone(INITIAL_TEAMS));

  const [uiTick, setUiTick] = useState(0);
  const [sandboxVersion, setSandboxVersion] = useState<SandboxVersion>('0.5');
  const [cameraMode, setCameraMode] = useState<CameraMode>('topology');
  const [labelMode, setLabelMode] = useState<LabelDisplayMode>('compact');
  const [activeZoneFocus, setActiveZoneFocus] = useState<
    ZoneId | 'attack' | 'all'
  >('all');
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [autoSimRunning, setAutoSimRunning] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoRotateEnabled, setAutoRotateEnabled] = useState(false);
  const [panelsHidden, setPanelsHidden] = useState(false);
  const [attackFollowEnabled, setAttackFollowEnabled] = useState(false);
  const [attackFollowBanner, setAttackFollowBanner] =
    useState<AttackFollowBannerInfo | null>(null);
  const [webglError, setWebglError] = useState<string | null>(null);

  const [directorTeam, setDirectorTeam] = useState<string>(
    INITIAL_TEAMS[0].name
  );
  const [directorZoneId, setDirectorZoneId] = useState<ZoneId>('ai-access');
  const [directorChallengeId, setDirectorChallengeId] = useState<string>('AI-02');

  const [hoveredInfo, setHoveredInfo] = useState<HoveredNodeInfo | null>(null);
  const [selectedInfo, setSelectedInfo] = useState<SelectedNodeInfo | null>(
    null
  );
  const [flagInput, setFlagInput] = useState('flag{gr3at_w4ll_cup_2026_pwn}');

  // 左侧面板实时统计状态
  const [totalSubmissions, setTotalSubmissions] = useState<number>(1245);
  const [validSolvesCount, setValidSolvesCount] = useState<number>(852);
  const [directionCounts, setDirectionCounts] = useState<
    Record<ZoneId, number>
  >(INITIAL_DIRECTION_COUNTS);
  const [firstBloodCards, setFirstBloodCards] =
    useState<FirstBloodCardItem[]>(INITIAL_FIRST_BLOODS);

  // 右侧事件流（保留最新 15 条，battleEvents[0] 为最新）
  const [battleEvents, setBattleEvents] =
    useState<BattleEvent[]>(INITIAL_EVENTS);

  const formatNow = () => {
    const d = new Date();
    return d.toTimeString().slice(0, 8);
  };

  const recordMetricDelta = useCallback(
    (type: BattleEvent['type'], zoneId: ZoneId) => {
      setTotalSubmissions((prev) => prev + 1);
      if (type === 'solved' || type === 'firstBlood') {
        setValidSolvesCount((prev) => prev + 1);
        setDirectionCounts((prev) => ({
          ...prev,
          [zoneId]: Math.min(DIRECTION_TOTAL_PER_ZONE, (prev[zoneId] || 0) + 1),
        }));
      }
    },
    []
  );

  const pushBattleEvent = useCallback(
    (
      type: BattleEvent['type'],
      challengeId: string,
      teamName: string,
      points?: number
    ) => {
      const zone = zonesRef.current.find((z) =>
        z.challenges.some((c) => c.id === challengeId)
      );
      const ch = zone?.challenges.find((c) => c.id === challengeId);
      const team =
        teamsRef.current.find((t) => t.name === teamName) || teamsRef.current[0];
      if (!zone || !ch) return;

      const ts = formatNow();
      const ev: BattleEvent = {
        id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: ts,
        type,
        teamName,
        teamColor: team.color,
        challengeId: ch.id,
        challengeName: ch.name,
        zoneId: zone.id,
        zoneName: zone.shortName,
        points,
      };
      setBattleEvents((prev) => [ev, ...prev.slice(0, 14)]);
      recordMetricDelta(type, zone.id);

      if (type === 'firstBlood') {
        setFirstBloodCards((prev) => [
          {
            id: `fb-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
            teamName,
            teamColor: team.color,
            zoneName: zone.shortName,
            challengeName: ch.name,
            timestamp: ts,
            rankIndex: prev.length + 1,
          },
          ...prev.slice(0, 9),
        ]);
      }
    },
    [recordMetricDelta]
  );

  const handleSwitchVersion = useCallback((ver: SandboxVersion) => {
    setSandboxVersion(ver);
    setActiveZoneFocus('all');
    sceneInstanceRef.current?.setVersion(ver, false);
  }, []);

  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    let scene: CyberRangeScene | null = null;
    try {
      setWebglError(null);
      scene = new CyberRangeScene(
        container,
        zonesRef.current,
        teamsRef.current,
        {
          onHoverChange: (info) => setHoveredInfo(info),
          onSelectChange: (info) => setSelectedInfo(info),
          onStatsSync: () => setUiTick((t) => t + 1),
          onAttackFollowBanner: (info) => setAttackFollowBanner(info),
        }
      );
      sceneInstanceRef.current = scene;
    } catch (err) {
      console.error('CyberRangeScene initialization failed:', err);
      setWebglError(
        err instanceof Error
          ? err.message
          : '3D WebGL 渲染上下文初始化失败，请确认浏览器已启用 WebGL 硬件加速。'
      );
    }

    return () => {
      if (scene) {
        scene.dispose();
      }
      sceneInstanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLSelectElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (e.key.toLowerCase() === 'h') {
        setDockCollapsed((prev) => !prev);
      } else if (e.key.toLowerCase() === 'v') {
        setSandboxVersion((prev) => {
          const next: SandboxVersion =
            prev === '0.1'
              ? '0.2'
              : prev === '0.2'
              ? '0.3'
              : prev === '0.3'
              ? '0.4'
              : prev === '0.4'
              ? '0.5'
              : '0.1';
          setActiveZoneFocus('all');
          sceneInstanceRef.current?.setVersion(next, false);
          return next;
        });
      } else if (e.key === 'Escape') {
        sceneInstanceRef.current?.selectChallengeById(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!autoSimRunning) return;

    const timer = window.setInterval(() => {
      const scene = sceneInstanceRef.current;
      if (!scene || document.hidden) return;

      const allChallenges = zonesRef.current.flatMap((z) => z.challenges);
      const randomTeam =
        teamsRef.current[
          Math.floor(Math.random() * Math.min(12, teamsRef.current.length))
        ];

      const attackingList = allChallenges.filter((c) => c.state === 'attacking');
      const idleList = allChallenges.filter((c) => c.state === 'idle');

      const roll = Math.random();
      if (attackingList.length > 0 && roll < 0.42) {
        const target =
          attackingList[Math.floor(Math.random() * attackingList.length)];
        const attacker = target.activeAttacker || randomTeam.name;
        if (Math.random() < 0.62) {
          scene.triggerFailed(target.id, attacker, false);
          pushBattleEvent('failed', target.id, attacker);
        } else {
          const isFB = target.solveCount === 0;
          scene.triggerSolved(target.id, attacker, isFB);
          const teamObj = teamsRef.current.find((t) => t.name === attacker);
          if (teamObj) {
            teamObj.score += target.points;
            teamObj.solvedCount += 1;
            if (isFB) teamObj.firstBloods += 1;
          }
          pushBattleEvent(
            isFB ? 'firstBlood' : 'solved',
            target.id,
            attacker,
            target.points
          );
        }
      } else if (idleList.length > 0) {
        const target = idleList[Math.floor(Math.random() * idleList.length)];
        scene.triggerAttempt(target.id, randomTeam.name);
        pushBattleEvent('attempt', target.id, randomTeam.name);
      } else {
        const anyTarget =
          allChallenges[Math.floor(Math.random() * allChallenges.length)];
        scene.triggerAttempt(anyTarget.id, randomTeam.name);
        pushBattleEvent('attempt', anyTarget.id, randomTeam.name);
      }

      setUiTick((t) => t + 1);
    }, 3400);

    return () => clearInterval(timer);
  }, [autoSimRunning, pushBattleEvent]);

  const dashboardMetrics = useMemo(() => {
    void uiTick;
    const totalChallenges = zonesRef.current.reduce(
      (acc, z) => acc + z.challenges.length,
      0
    );

    const directions: DirectionProgressItem[] = zonesRef.current.map((z) => ({
      zoneId: z.id,
      name: z.shortName,
      solved: directionCounts[z.id] ?? 0,
      total: DIRECTION_TOTAL_PER_ZONE,
    }));

    const solvedTotal = directions.reduce((acc, d) => acc + d.solved, 0);
    const maxSlots = directions.reduce((acc, d) => acc + d.total, 0);
    const solveProgressPct = maxSlots > 0 ? (solvedTotal / maxSlots) * 100 : 0;
    const accuracyPct =
      totalSubmissions > 0 ? (validSolvesCount / totalSubmissions) * 100 : 0;

    return {
      totalChallenges,
      directions,
      solveProgressPct,
      accuracyPct,
    };
  }, [uiTick, directionCounts, totalSubmissions, validSolvesCount]);

  const handleManualAttempt = (
    challengeId: string,
    teamName = directorTeam
  ) => {
    sceneInstanceRef.current?.triggerAttempt(challengeId, teamName);
    pushBattleEvent('attempt', challengeId, teamName);
    setUiTick((t) => t + 1);
  };

  const handleManualFailed = (
    challengeId: string,
    teamName = directorTeam
  ) => {
    sceneInstanceRef.current?.triggerFailed(challengeId, teamName, true);
    pushBattleEvent('failed', challengeId, teamName);
    setUiTick((t) => t + 1);
  };

  const handleManualSolved = (
    challengeId: string,
    teamName = directorTeam,
    forceFirstBlood?: boolean
  ) => {
    const found = sceneInstanceRef.current?.findChallengeAndZone(challengeId);
    const isFB =
      forceFirstBlood !== undefined
        ? forceFirstBlood
        : found
        ? found.challenge.solveCount === 0
        : false;
    const pts = found?.challenge.points || 500;

    sceneInstanceRef.current?.triggerSolved(challengeId, teamName, isFB);
    const teamObj = teamsRef.current.find((t) => t.name === teamName);
    if (teamObj) {
      teamObj.score += pts;
      teamObj.solvedCount += 1;
      if (isFB) teamObj.firstBloods += 1;
    }
    pushBattleEvent(isFB ? 'firstBlood' : 'solved', challengeId, teamName, pts);
    setUiTick((t) => t + 1);
  };

  const handleTriggerCyberStorm = () => {
    const scene = sceneInstanceRef.current;
    if (!scene) return;
    const sampleZones = zonesRef.current.slice(0, 4);
    sampleZones.forEach((z, idx) => {
      const target =
        z.challenges.find((c) => c.state !== 'solved') || z.challenges[0];
      const team = teamsRef.current[idx % teamsRef.current.length];
      setTimeout(() => {
        scene.triggerAttempt(target.id, team.name);
        pushBattleEvent('attempt', target.id, team.name);
        setUiTick((t) => t + 1);
      }, idx * 240);
    });
  };

  const handleSwitchCameraMode = (mode: CameraMode) => {
    setCameraMode(mode);
    setActiveZoneFocus('all');
    sceneInstanceRef.current?.setCameraMode(mode);
  };

  const handleCycleLabelMode = () => {
    const next: LabelDisplayMode =
      labelMode === 'compact'
        ? 'full'
        : labelMode === 'full'
        ? 'hover'
        : 'compact';
    setLabelMode(next);
    sceneInstanceRef.current?.setLabelDisplayMode(next);
  };

  const handleFocusZone = (zoneId: ZoneId | 'attack' | 'all') => {
    setActiveZoneFocus(zoneId);
    if (zoneId === 'all') {
      sceneInstanceRef.current?.setCameraMode(cameraMode);
    } else {
      sceneInstanceRef.current?.focusZone(zoneId);
    }
  };

  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundFX.enabled = next;
  };

  const handleResetView = useCallback(() => {
    setActiveZoneFocus('all');
    sceneInstanceRef.current?.resetView();
  }, []);

  const handleToggleAutoRotate = useCallback(() => {
    const next = !autoRotateEnabled;
    setAutoRotateEnabled(next);
    sceneInstanceRef.current?.setAutoRotateEnabled(next);
  }, [autoRotateEnabled]);

  const handleTogglePanelsHidden = useCallback(() => {
    const next = !panelsHidden;
    setPanelsHidden(next);
    sceneInstanceRef.current?.setPanelsVisible(!next);
  }, [panelsHidden]);

  const handleToggleAttackFollow = useCallback(() => {
    const next = !attackFollowEnabled;
    setAttackFollowEnabled(next);
    sceneInstanceRef.current?.setAttackFollowEnabled(next);
  }, [attackFollowEnabled]);

  const clampedPopoverPos = useMemo(() => {
    if (!selectedInfo) return { left: 0, top: 0 };
    const w = typeof window !== 'undefined' ? window.innerWidth : 1440;
    const h = typeof window !== 'undefined' ? window.innerHeight : 900;
    const minLeft = panelsHidden ? 24 : 400;
    const maxLeft = panelsHidden ? w - 364 : w - 760;
    const left = Math.min(Math.max(minLeft, selectedInfo.screenX + 20), Math.max(minLeft, maxLeft));
    const top = Math.min(Math.max(84, selectedInfo.screenY - 100), h - 420);
    return { left, top };
  }, [selectedInfo, panelsHidden]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#0a0e17] flex flex-col select-none">
      {/* 底层 3D WebGL 沙盘（全屏铺底，左右面板毛玻璃可透出 3D 微光） */}
      <div
        ref={canvasMountRef}
        className="fixed inset-0 w-full h-full z-0"
        aria-label="长城杯 CTF 3D 攻防态势沙盘三维视图"
      />

      {webglError && (
        <div className="fixed inset-0 z-30 flex items-center justify-center pointer-events-none px-6">
          <div className="pointer-events-auto max-w-md w-full clip-octa-12 bg-[#0a0e17]/95 border border-rose-500/60 p-5 shadow-2xl text-slate-200">
            <div className="flex items-center gap-2 text-rose-400 font-bold text-sm mb-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>三维沙盘 WebGL 渲染初始化失败</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">{webglError}</p>
          </div>
        </div>
      )}

      {/* 顶部 Header 栏 (72px，居中渐变，两侧透明) */}
      <HeaderBar onResetCamera={handleResetView} />

      {/* 左侧三卡片面板（支持平滑左滑隐藏 .slide-out-left） */}
      <div
        className={`fixed top-[76px] bottom-3 left-3 z-10 w-[288px] xl:w-[316px] 2xl:w-[340px] pointer-events-none panel-rail ${
          panelsHidden ? 'slide-out-left' : ''
        }`}
      >
        <LeftDashboard
          solveProgressPct={dashboardMetrics.solveProgressPct}
          totalSubmissions={totalSubmissions}
          accuracyPct={dashboardMetrics.accuracyPct}
          directions={dashboardMetrics.directions}
          firstBloods={firstBloodCards}
          activeZoneFocus={activeZoneFocus}
          onFocusZone={(zid) => handleFocusZone(zid)}
          zones={zonesRef.current}
        />
      </div>

      {/* 右侧双卡片面板（支持平滑右滑隐藏 .slide-out-right） */}
      <div
        className={`fixed top-[76px] bottom-3 right-3 z-10 w-[288px] xl:w-[316px] 2xl:w-[340px] pointer-events-none panel-rail ${
          panelsHidden ? 'slide-out-right' : ''
        }`}
      >
        <RightDashboard
          teams={teamsRef.current}
          totalChallenges={dashboardMetrics.totalChallenges}
          battleEvents={battleEvents}
          focusTeamName="网络护卫队"
          onSelectTeam={(tName) => setDirectorTeam(tName)}
          onRefreshRanking={() => setUiTick((t) => t + 1)}
        />
      </div>

      {/* 中间 3D 交互留白区 + 右上角控制按钮 + 攻击跟踪浮标 + 底部沙盘导演台 */}
      <section
        className={`fixed top-[76px] bottom-3 z-10 pointer-events-none flex flex-col justify-end items-center transition-[left,right] duration-[400ms] ease-in-out ${
          panelsHidden
            ? 'left-4 right-4'
            : 'left-[312px] xl:left-[340px] 2xl:left-[364px] right-[312px] xl:right-[340px] 2xl:right-[364px]'
        }`}
      >
        {/* 3D 场景右上角悬浮控制按钮 */}
        <div className="absolute top-1 right-0 z-20">
          <SceneControls
            onResetView={handleResetView}
            autoRotate={autoRotateEnabled}
            onToggleAutoRotate={handleToggleAutoRotate}
            panelsHidden={panelsHidden}
            onTogglePanelsHidden={handleTogglePanelsHidden}
            attackFollow={attackFollowEnabled}
            onToggleAttackFollow={handleToggleAttackFollow}
          />
        </div>

        {/* 攻击跟踪运镜第三阶段：顶部居中轻量目标横幅 */}
        {attackFollowBanner && (
          <div
            data-testid="attack-follow-banner"
            className="absolute top-2 left-[calc(50%-1.25rem)] -translate-x-1/2 z-20 pointer-events-none max-w-[calc(100%-5.25rem)] clip-octa-12 px-4 py-2 border bg-[#0a0e17]/92 shadow-[0_0_24px_rgba(0,212,255,0.28)] flex flex-col gap-1"
            style={{
              backdropFilter: 'blur(8px)',
              borderColor: attackFollowBanner.isFirstBlood
                ? 'rgba(255, 210, 74, 0.78)'
                : 'rgba(0, 255, 136, 0.7)',
            }}
          >
            <div className="flex items-center justify-between gap-2.5 whitespace-nowrap">
              <span
                className={`shrink-0 px-2 py-0.5 text-[10px] font-tech-num font-bold tracking-wider rounded ${
                  attackFollowBanner.isFirstBlood
                    ? 'bg-[#ffd24a]/20 text-[#ffd24a] border border-[#ffd24a]/50'
                    : 'bg-[#00ff88]/18 text-[#00ff88] border border-[#00ff88]/50'
                }`}
              >
                {attackFollowBanner.isFirstBlood ? 'FIRST BLOOD · 首解追踪' : 'SOLVED · 攻破追踪'}
              </span>
              <span className="truncate text-xs font-semibold text-white">
                {attackFollowBanner.teamName}
              </span>
              <span className="shrink-0 font-tech-num text-xs font-bold text-[#00ff88]">
                +{attackFollowBanner.points}
              </span>
            </div>
            <div className="text-[11px] text-[#00d4ff] font-medium truncate text-center">
              [{attackFollowBanner.zoneName}] {attackFollowBanner.challengeId} ·{' '}
              {attackFollowBanner.challengeName}
            </div>
          </div>
        )}

        <DirectorConsole
          sandboxVersion={sandboxVersion}
          onSwitchVersion={handleSwitchVersion}
          dockCollapsed={dockCollapsed}
          onToggleCollapse={() => setDockCollapsed((prev) => !prev)}
          activeZoneFocus={activeZoneFocus}
          onFocusZone={handleFocusZone}
          zones={zonesRef.current}
          teams={teamsRef.current}
          labelMode={labelMode}
          onCycleLabelMode={handleCycleLabelMode}
          cameraMode={cameraMode}
          onSwitchCameraMode={handleSwitchCameraMode}
          autoSimRunning={autoSimRunning}
          onToggleAutoSim={() => setAutoSimRunning((prev) => !prev)}
          soundEnabled={soundEnabled}
          onToggleSound={handleToggleSound}
          directorTeam={directorTeam}
          onChangeDirectorTeam={setDirectorTeam}
          directorZoneId={directorZoneId}
          onChangeDirectorZone={setDirectorZoneId}
          directorChallengeId={directorChallengeId}
          onChangeDirectorChallenge={(cid) => {
            setDirectorChallengeId(cid);
            sceneInstanceRef.current?.selectChallengeById(cid);
          }}
          onManualAttempt={handleManualAttempt}
          onManualFailed={handleManualFailed}
          onManualSolved={handleManualSolved}
          onTriggerCyberStorm={handleTriggerCyberStorm}
        />
      </section>

      {/* 3D 场景悬停节点轻量提示（仅在鼠标悬停 3D 设备时出现） */}
      {hoveredInfo && !selectedInfo && (
        <div
          className="pointer-events-none fixed z-30 w-60 clip-octa-8 bg-[#0a0e17]/90 border border-[#00d4ff]/55 p-2.5 shadow-2xl"
          style={{
            backdropFilter: 'blur(8px)',
            left: Math.min(hoveredInfo.screenX + 16, window.innerWidth - 260),
            top: Math.max(80, hoveredInfo.screenY - 84),
          }}
        >
          <div className="flex items-center justify-between text-[11px] font-tech-num text-[#9ca3af] mb-1">
            <span style={{ color: hoveredInfo.zoneColor }}>
              {hoveredInfo.zoneName}
            </span>
            <span>{hoveredInfo.challenge.points} PT</span>
            <span
              style={{
                color:
                  hoveredInfo.challenge.state === 'solved' &&
                  hoveredInfo.challenge.firstBlood
                    ? STATE_COLOR_HEX.firstBlood
                    : STATE_COLOR_HEX[hoveredInfo.challenge.state],
              }}
            >
              {hoveredInfo.challenge.state === 'solved'
                ? hoveredInfo.challenge.firstBlood
                  ? 'FIRST BLOOD'
                  : 'SOLVED'
                : hoveredInfo.challenge.state === 'attacking'
                ? 'ATTACKING'
                : 'IDLE'}
            </span>
          </div>
          <div className="text-xs font-semibold text-[#e5e7eb]">
            {hoveredInfo.challenge.id} · {hoveredInfo.challenge.name}
          </div>
          <div className="mt-1 text-[11px] text-[#9ca3af] line-clamp-2">
            {hoveredInfo.challenge.description}
          </div>
        </div>
      )}

      {/* 点击 3D 设备节点时的单机攻防交互浮窗 */}
      {selectedInfo && (
        <div
          className="fixed z-30 w-[340px] clip-octa-12 bg-[#0a0e17]/92 border border-[#00d4ff]/65 p-4 shadow-2xl text-[#e5e7eb]"
          style={{
            backdropFilter: 'blur(8px)',
            left: clampedPopoverPos.left,
            top: clampedPopoverPos.top,
          }}
        >
          <div className="flex items-start justify-between gap-2 pb-2 border-b border-[#00d4ff]/20">
            <div>
              <div className="flex items-center gap-2 text-[11px] font-tech-num text-[#9ca3af]">
                <span style={{ color: selectedInfo.zoneColor }}>
                  {selectedInfo.zoneName}
                </span>
                <span>·</span>
                <span>{selectedInfo.challenge.difficulty}</span>
              </div>
              <h3 className="mt-0.5 text-sm font-bold text-white">
                {selectedInfo.challenge.id} · {selectedInfo.challenge.name}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => sceneInstanceRef.current?.selectChallengeById(null)}
              className="p-1 text-[#9ca3af] hover:text-white cursor-pointer"
              title="关闭 (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="mt-2 text-xs text-[#9ca3af] leading-relaxed">
            {selectedInfo.challenge.description}
          </p>

          <div className="mt-2.5 flex items-center gap-1.5">
            <input
              type="text"
              value={flagInput}
              onChange={(e) => setFlagInput(e.target.value)}
              placeholder="输入 Flag..."
              className="flex-1 bg-[#09101d] border border-slate-700 rounded px-2 py-1 text-xs font-tech-num text-[#e5e7eb] focus:outline-none focus:border-[#00d4ff]"
            />
            <button
              type="button"
              onClick={() => {
                if (flagInput.trim().toLowerCase().startsWith('flag{')) {
                  handleManualSolved(selectedInfo.challenge.id, directorTeam);
                } else {
                  handleManualFailed(selectedInfo.challenge.id, directorTeam);
                }
              }}
              className="px-2.5 py-1 text-xs font-semibold bg-[#00d4ff] text-[#050811] rounded hover:bg-cyan-300 transition-colors cursor-pointer"
            >
              提交
            </button>
          </div>

          <div className="mt-2.5 grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() =>
                handleManualAttempt(selectedInfo.challenge.id, directorTeam)
              }
              className="flex items-center justify-center gap-1 py-1 text-xs font-medium bg-[#ff6b35]/15 text-[#ff6b35] border border-[#ff6b35]/45 rounded hover:bg-[#ff6b35]/25 cursor-pointer"
            >
              <Crosshair className="w-3 h-3" />
              尝试
            </button>
            <button
              type="button"
              onClick={() =>
                handleManualFailed(selectedInfo.challenge.id, directorTeam)
              }
              className="flex items-center justify-center gap-1 py-1 text-xs font-medium bg-rose-500/15 text-rose-300 border border-rose-500/45 rounded hover:bg-rose-500/25 cursor-pointer"
            >
              <ShieldAlert className="w-3 h-3" />
              失败
            </button>
            <button
              type="button"
              onClick={() =>
                handleManualSolved(selectedInfo.challenge.id, directorTeam)
              }
              className="flex items-center justify-center gap-1 py-1 text-xs font-medium bg-[#00ff88]/15 text-[#00ff88] border border-[#00ff88]/45 rounded hover:bg-[#00ff88]/25 cursor-pointer"
            >
              <Trophy className="w-3 h-3" />
              攻破
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
