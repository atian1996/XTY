import * as THREE from 'three';
import { Challenge, ChallengeSolver, STATE_COLOR_HEX, ZoneConfig } from '../types/cyberRange';

function drawCutCornerRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  cut: number
) {
  ctx.beginPath();
  ctx.moveTo(x + cut, y);
  ctx.lineTo(x + w - cut, y);
  ctx.lineTo(x + w, y + cut);
  ctx.lineTo(x + w, y + h - cut);
  ctx.lineTo(x + w - cut, y + h);
  ctx.lineTo(x + cut, y + h);
  ctx.lineTo(x, y + h - cut);
  ctx.lineTo(x, y + cut);
  ctx.closePath();
}

/**
 * 零 CPU 阻塞的柔润湿感光晕描边（替代缓慢的 Canvas2D shadowBlur 高斯卷积，兼顾柔润霓虹微光与极致帧率）
 */
function strokeMoistNeon(
  ctx: CanvasRenderingContext2D,
  coreColor: string,
  glowRgbaOuter: string,
  glowRgbaMid: string,
  coreWidth = 2.2
) {
  ctx.save();
  ctx.shadowBlur = 0;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = coreWidth * 3.8;
  ctx.strokeStyle = glowRgbaOuter;
  ctx.stroke();
  ctx.lineWidth = coreWidth * 2.1;
  ctx.strokeStyle = glowRgbaMid;
  ctx.stroke();
  ctx.lineWidth = coreWidth;
  ctx.strokeStyle = coreColor;
  ctx.stroke();
  ctx.restore();
}

const _rackFrontTexPool: {
  texture: THREE.CanvasTexture;
  stepLights: () => void;
}[] = [];

/**
 * 1) 机柜 Rack 内部服务器刀片面板贴图 (512×512，高细节工业服务器前脸，池化复用)
 */
export function createRackFrontTexture(maxAnisotropy = 4): {
  texture: THREE.CanvasTexture;
  stepLights: () => void;
} {
  if (_rackFrontTexPool.length >= 2) {
    return _rackFrontTexPool[Math.floor(Math.random() * _rackFrontTexPool.length)];
  }
  const safeAniso = Math.min(4, Math.max(1, maxAnisotropy));
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const palette = ['#00d4ff', '#00ff88', '#ffb020', '#38bdf8'];
  const leds: { c1: string; c2: string; load: number }[] = Array.from({ length: 12 }, () => ({
    c1: palette[Math.floor(Math.random() * palette.length)],
    c2: palette[Math.floor(Math.random() * palette.length)],
    load: 0.35 + Math.random() * 0.55,
  }));

  const draw = () => {
    ctx.fillStyle = '#141e30';
    ctx.fillRect(0, 0, 512, 512);

    // 两侧带孔机架立柱
    ctx.fillStyle = '#24344d';
    ctx.fillRect(0, 0, 30, 512);
    ctx.fillRect(482, 0, 30, 512);
    ctx.fillStyle = '#0d1522';
    for (let y = 8; y < 512; y += 16) {
      ctx.fillRect(10, y, 8, 8);
      ctx.fillRect(494, y, 8, 8);
    }

    const bayH = 512 / 12;
    for (let i = 0; i < 12; i++) {
      const y = i * bayH;
      // 刀片拉丝金属面板
      ctx.fillStyle = i % 2 === 0 ? '#1b283d' : '#162234';
      ctx.fillRect(32, y + 2, 448, bayH - 4);

      // 金属高光上沿
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
      ctx.lineWidth = 1;
      ctx.strokeRect(33, y + 3, 446, bayH - 6);

      // 左侧双状态灯（无眩光阴影，保持锐利）
      const led = leds[i];
      ctx.fillStyle = led.c1;
      ctx.fillRect(46, y + bayH * 0.35, 9, 9);
      ctx.fillStyle = led.c2;
      ctx.fillRect(62, y + bayH * 0.35, 9, 9);

      // 4 组热插拔硬盘托架纹理
      for (let d = 0; d < 4; d++) {
        const dx = 86 + d * 72;
        ctx.fillStyle = '#0f1726';
        ctx.fillRect(dx, y + 7, 64, bayH - 14);
        ctx.fillStyle = '#334155';
        ctx.fillRect(dx + 4, y + 10, 42, bayH - 20);
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(dx + 52, y + 12, 5, 5);
      }

      // 右侧数字负载条
      ctx.fillStyle = '#0c1320';
      ctx.fillRect(386, y + 11, 82, bayH - 22);
      ctx.fillStyle = led.c1;
      ctx.fillRect(388, y + 13, Math.floor(78 * led.load), bayH - 26);
    }
  };

  draw();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = safeAniso;

  let lastStepMs = 0;
  const stepLights = () => {
    const now = performance.now();
    if (now - lastStepMs < 240) return;
    lastStepMs = now;
    let changed = false;
    for (let i = 0; i < 12; i++) {
      if (Math.random() < 0.16) {
        leds[i].c1 = palette[Math.floor(Math.random() * palette.length)];
        leds[i].load = Math.max(0.2, Math.min(0.95, leds[i].load + (Math.random() - 0.5) * 0.2));
        changed = true;
      }
      if (Math.random() < 0.16) {
        leds[i].c2 = palette[Math.floor(Math.random() * palette.length)];
        changed = true;
      }
    }
    if (changed) {
      draw();
      texture.needsUpdate = true;
    }
  };

  const entry = { texture, stepLights };
  _rackFrontTexPool.push(entry);
  return entry;
}

const _consoleScreenTexCache = new Map<string, THREE.CanvasTexture>();

/**
 * 2) 控制台 Console 倾斜屏幕贴图 (512×256，按主题色缓存复用)
 */
export function createConsoleScreenTexture(accentHex = '#00d4ff', maxAnisotropy = 4): THREE.CanvasTexture {
  const cached = _consoleScreenTexCache.get(accentHex);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#0c1626';
  ctx.fillRect(0, 0, 512, 256);

  ctx.strokeStyle = 'rgba(56, 189, 248, 0.15)';
  ctx.lineWidth = 1;
  for (let y = 0; y < 256; y += 16) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }

  const lines = [
    'GET /v1/chat/completions HTTP/2.0 [200]',
    'guardrail.inspect(tensor_payload) -> PASS',
    'kv_cache.page_table[0x7F2A] = LOCKED',
    'agent_router.dispatch(tool="sql_exec")',
    'verify_signature(ed25519_key, nonce)',
    'stream_chunk_delta: 42.8 tok/s',
    'seccomp_bpf_filter(SYSCALL_EXECVE)',
    'hnsw_index.search(top_k=16, ef=128)',
  ];

  ctx.font = '600 14px "JetBrains Mono", monospace';
  lines.forEach((line, i) => {
    ctx.fillStyle = i % 2 === 0 ? accentHex : '#93c5fd';
    ctx.fillText(line, 16, 26 + i * 28);
  });

  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = 345; x < 495; x += 4) {
    const y = 128 + Math.sin(x * 0.08) * 38 * Math.cos(x * 0.03);
    if (x === 345) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = Math.min(4, Math.max(1, maxAnisotropy));
  _consoleScreenTexCache.set(accentHex, texture);
  return texture;
}

/**
 * 3) 分区全息遥测牌 Sprite (1024×400，尺寸紧凑锐利 3.5 × 1.36，高对比不刺眼)
 */
export function createZoneTelemetrySprite(zone: ZoneConfig, maxAnisotropy = 4) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 400;
  const ctx = canvas.getContext('2d')!;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  });

  const sprite = new THREE.Sprite(material);
  sprite.scale.set(3.5, 1.36, 1);
  sprite.position.set(0, 4.75, 0);

  const redraw = (
    score: number,
    totalScore: number,
    solvedCount: number,
    totalChallenges: number,
    threats: number,
    flashWhite = false
  ) => {
    ctx.clearRect(0, 0, 1024, 400);

    const pad = 20;
    const w = 1024 - pad * 2;
    const h = 400 - pad * 2;
    drawCutCornerRect(ctx, pad, pad, w, h, 22);

    ctx.fillStyle = 'rgba(10, 18, 34, 0.90)';
    ctx.fill();

    strokeMoistNeon(
      ctx,
      flashWhite ? '#e2e8f0' : '#00d4ff',
      flashWhite ? 'rgba(226, 232, 240, 0.18)' : 'rgba(0, 212, 255, 0.16)',
      flashWhite ? 'rgba(226, 232, 240, 0.38)' : 'rgba(0, 212, 255, 0.36)',
      flashWhite ? 4.0 : 2.5
    );

    // 标题行
    ctx.fillStyle = zone.colorHex;
    ctx.font = '700 40px "Plus Jakarta Sans", "Microsoft YaHei", sans-serif';
    ctx.fillText(`◤ ${zone.name}`, 56, 92);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 24px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`SOLVED ${solvedCount}/${totalChallenges} · THREAT ${threats}`, 1024 - 56, 88);
    ctx.textAlign = 'left';

    // 分隔线
    ctx.fillStyle = 'rgba(148, 163, 184, 0.25)';
    ctx.fillRect(56, 114, 912, 2);
    ctx.fillStyle = zone.colorHex;
    ctx.fillRect(56, 114, 240, 3);

    // SCORE 行
    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 28px "JetBrains Mono", monospace';
    ctx.fillText('SCORE', 56, 188);

    ctx.fillStyle = '#34d399';
    ctx.font = '700 44px "JetBrains Mono", monospace';
    ctx.fillText(score.toLocaleString(), 190, 192);

    ctx.fillStyle = '#64748b';
    ctx.font = '500 30px "JetBrains Mono", monospace';
    ctx.fillText(`/ ${totalScore.toLocaleString()}`, 370, 190);

    // 威胁指示块
    ctx.fillStyle = threats > 0 ? '#fb923c' : '#38bdf8';
    ctx.font = '700 28px "Plus Jakarta Sans", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(threats > 0 ? `● ${threats} 路攻击活跃` : '○ 链路态势平稳', 1024 - 56, 188);
    ctx.textAlign = 'left';

    // 进度条
    const pct = Math.min(100, Math.round((solvedCount / Math.max(1, totalChallenges)) * 100));
    const barX = 56;
    const barY = 248;
    const barW = 780;
    const barH = 30;

    ctx.fillStyle = '#090f1a';
    ctx.fillRect(barX, barY, barW, barH);

    const blocks = 20;
    const activeBlocks = Math.round((pct / 100) * blocks);
    const blockW = (barW - (blocks - 1) * 5) / blocks;
    for (let i = 0; i < blocks; i++) {
      ctx.fillStyle = i < activeBlocks ? zone.colorHex : 'rgba(51, 65, 85, 0.45)';
      ctx.fillRect(barX + i * (blockW + 5), barY + 4, blockW, barH - 8);
    }

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '700 32px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${pct}%`, 1024 - 56, barY + 26);
    ctx.textAlign = 'left';

    texture.needsUpdate = true;
  };

  const solvedInit = zone.challenges.filter((c) => c.state === 'solved').length;
  const threatsInit = zone.challenges.filter((c) => c.state === 'attacking').length;
  redraw(zone.score, zone.totalScore, solvedInit, zone.challenges.length, threatsInit, false);

  sprite.userData = { redraw };
  return sprite;
}

/**
 * 4) 攻击区顶部全息遥测牌 (尺寸克制 3.6 × 1.25)
 */
export function createAttackTelemetrySprite(maxAnisotropy = 4) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 350;
  const ctx = canvas.getContext('2d')!;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;

  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
    })
  );
  sprite.scale.set(3.6, 1.25, 1);
  sprite.position.set(0, 3.8, 0);

  const redraw = (activeBeams: number, totalTeams: number, totalLaunches: number) => {
    ctx.clearRect(0, 0, 1024, 350);
    drawCutCornerRect(ctx, 20, 20, 984, 310, 22);
    ctx.fillStyle = 'rgba(20, 16, 28, 0.92)';
    ctx.fill();

    ctx.lineWidth = 3;
    ctx.strokeStyle = '#f43f5e';
    ctx.stroke();

    ctx.fillStyle = '#fb7185';
    ctx.font = '700 38px "Plus Jakarta Sans", "Microsoft YaHei", sans-serif';
    ctx.fillText('★ ATTACK COMMAND · 实时攻击源指挥舱', 56, 88);

    ctx.fillStyle = 'rgba(244, 63, 94, 0.35)';
    ctx.fillRect(56, 110, 912, 2);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 28px "JetBrains Mono", monospace';
    ctx.fillText(`ACTIVE BEAMS: ${activeBeams}`, 56, 182);
    ctx.fillText(`TEAMS ONLINE: ${totalTeams}`, 440, 182);

    ctx.fillStyle = '#38bdf8';
    ctx.font = '700 30px "JetBrains Mono", monospace';
    ctx.fillText(`TOTAL PAYLOADS DISPATCHED: ${totalLaunches.toLocaleString()} PKTS`, 56, 256);

    texture.needsUpdate = true;
  };

  redraw(4, 20, 148);
  sprite.userData = { redraw };
  return sprite;
}

const V03_SHORT_CHALLENGE_NAMES: Record<string, string> = {
  'AI-01': 'API鉴权',
  'AI-02': '提示注入',
  'AI-03': '流式信道',
  'AI-04': '图像隐写',
  'AI-05': '回调劫持',
  'INF-01': '权重越界',
  'INF-02': '缓存残留',
  'INF-03': '模型后门',
  'INF-04': '算子溢出',
  'INF-05': '梯度反演',
  'AGT-01': '工具穿透',
  'AGT-02': '沙箱逃逸',
  'AGT-03': '协议注入',
  'AGT-04': '信任劫持',
  'AGT-05': '流程耗尽',
  'KDB-01': '向量越权',
  'KDB-02': '嵌入还原',
  'KDB-03': '图谱注入',
  'KDB-04': '对象遍历',
  'KDB-05': '文档盲注',
  'CMP-01': '容器逃逸',
  'CMP-02': '显存越界',
  'CMP-03': '作业提权',
  'CMP-04': '内存窃听',
  'CMP-05': '配额伪造',
  'OPS-01': '带外破解',
  'OPS-02': '镜像密钥',
  'OPS-03': '联邦注入',
  'OPS-04': '录像劫持',
  'OPS-05': '固件绕过',
  'NET-01': '流表劫持',
  'NET-02': 'VPN渗透',
  'NET-03': '探针隐匿',
  'NET-04': '证书欺骗',
  'NET-05': '节点接管',
};

/**
 * 5) 设备题目名称 + 前三解出队伍 合并全息面板 Sprite (768×430，字体加大、紧凑高对比)
 */
export function createChallengeHoloLabel(
  challenge: Challenge,
  zoneColorHex: string,
  maxAnisotropy = 4
) {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 430;
  const ctx = canvas.getContext('2d')!;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = maxAnisotropy;

  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
    })
  );
  sprite.scale.set(1.68, 0.94, 1);

  let v03Mode = false;
  let v03AbstractMode = true;
  let tronWireframeMode = false;

  const fitText = (text: string, maxW: number): string => {
    if (ctx.measureText(text).width <= maxW) return text;
    let cut = text;
    while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxW) {
      cut = cut.slice(0, -1);
    }
    return `${cut}…`;
  };

  const drawHexAvatar = (
    cx: number,
    cy: number,
    r: number,
    teamColor: string,
    initialChar: string,
    filled: boolean,
    isTron: boolean
  ) => {
    ctx.save();
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 - Math.PI / 2;
      const hx = cx + Math.cos(a) * r;
      const hy = cy + Math.sin(a) * r;
      if (k === 0) ctx.moveTo(hx, hy);
      else ctx.lineTo(hx, hy);
    }
    ctx.closePath();

    if (filled) {
      if (isTron) {
        ctx.fillStyle = 'rgba(0, 212, 255, 0.12)';
        ctx.fill();
        ctx.lineWidth = 2.6;
        ctx.strokeStyle = teamColor;
        ctx.stroke();
      } else {
        const grad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
        grad.addColorStop(0, `${teamColor}cc`);
        grad.addColorStop(1, 'rgba(10, 14, 23, 0.92)');
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.lineWidth = 2.6;
        ctx.strokeStyle = teamColor;
        ctx.stroke();
      }

      ctx.fillStyle = isTron ? '#e0f7ff' : '#ffffff';
      ctx.font = '800 30px "Plus Jakarta Sans", "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(initialChar, cx, cy + 1.5);
    } else {
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = isTron ? 'rgba(0, 184, 230, 0.30)' : 'rgba(148, 163, 184, 0.32)';
      ctx.stroke();
    }
    ctx.restore();
  };

  const redraw = (
    state: Challenge['state'] | 'failed',
    extra: {
      team?: string;
      firstBlood?: boolean;
      attempts?: number;
      hovered?: boolean;
      isV03?: boolean;
      isV03Abstract?: boolean;
      isTronWireframe?: boolean;
      topSolvers?: ChallengeSolver[];
    } = {}
  ) => {
    if (extra.isV03 !== undefined) {
      v03Mode = extra.isV03;
    }
    if (extra.isV03Abstract !== undefined) {
      v03AbstractMode = extra.isV03Abstract;
    }
    if (extra.isTronWireframe !== undefined) {
      tronWireframeMode = extra.isTronWireframe;
    }
    ctx.clearRect(0, 0, 768, 430);

    if (v03Mode && v03AbstractMode) {
      const isTron = tronWireframeMode;
      const hovered = Boolean(extra.hovered);
      const isAttackingOrFailed = state === 'attacking' || state === 'failed';
      const isSolved = state === 'solved' || challenge.solveCount >= 1;

      const borderCol = isAttackingOrFailed
        ? '#ff3b18'
        : hovered
        ? '#00f0ff'
        : isSolved
        ? isTron
          ? '#00d4ff'
          : '#10ff88'
        : isTron
        ? '#00b8e6'
        : '#0ea5e9';

      const dotCoreCol = isAttackingOrFailed
        ? '#ff3b18'
        : isSolved
        ? isTron
          ? '#00f0ff'
          : '#22ff88'
        : '#38bdf8';

      const dotHaloCol = isAttackingOrFailed
        ? 'rgba(255, 59, 24, 0.65)'
        : isSolved
        ? isTron
          ? 'rgba(0, 240, 255, 0.62)'
          : 'rgba(16, 255, 136, 0.65)'
        : 'rgba(56, 189, 248, 0.52)';

      const padX = 16;
      const padY = 14;
      const boxW = 768 - padX * 2;
      const boxH = 430 - padY * 2;

      if (isTron) {
        ctx.save();
        ctx.fillStyle = hovered ? 'rgba(2, 8, 20, 0.65)' : 'rgba(2, 6, 16, 0.46)';
        ctx.fillRect(padX, padY, boxW, boxH);

        ctx.strokeStyle = isAttackingOrFailed
          ? 'rgba(255, 59, 24, 0.65)'
          : hovered
          ? 'rgba(0, 212, 255, 0.72)'
          : 'rgba(0, 184, 230, 0.44)';
        ctx.lineWidth = 1.6;
        ctx.strokeRect(padX, padY, boxW, boxH);

        const cLen = 24;
        ctx.strokeStyle = borderCol;
        ctx.lineWidth = 3.0;
        ctx.beginPath();
        ctx.moveTo(padX, padY + cLen);
        ctx.lineTo(padX, padY);
        ctx.lineTo(padX + cLen, padY);
        ctx.moveTo(padX + boxW - cLen, padY);
        ctx.lineTo(padX + boxW, padY);
        ctx.lineTo(padX + boxW, padY + cLen);
        ctx.moveTo(padX, padY + boxH - cLen);
        ctx.lineTo(padX, padY + boxH);
        ctx.lineTo(padX + cLen, padY + boxH);
        ctx.moveTo(padX + boxW - cLen, padY + boxH);
        ctx.lineTo(padX + boxW, padY + boxH);
        ctx.lineTo(padX + boxW, padY + boxH - cLen);
        ctx.stroke();
        ctx.restore();
      } else {
        drawCutCornerRect(ctx, padX, padY, boxW, boxH, 20);
        ctx.fillStyle = hovered ? 'rgba(6, 16, 34, 0.95)' : 'rgba(4, 11, 24, 0.90)';
        ctx.fill();

        strokeMoistNeon(
          ctx,
          borderCol,
          isAttackingOrFailed
            ? 'rgba(255, 59, 24, 0.18)'
            : isSolved
            ? 'rgba(16, 255, 136, 0.18)'
            : 'rgba(0, 216, 255, 0.18)',
          isAttackingOrFailed
            ? 'rgba(255, 59, 24, 0.38)'
            : isSolved
            ? 'rgba(16, 255, 136, 0.40)'
            : 'rgba(0, 216, 255, 0.38)',
          hovered ? 3.2 : 2.3
        );

        ctx.fillStyle = borderCol;
        ctx.fillRect(padX + 34, padY - 2, 82, 4);
        ctx.fillRect(padX + boxW - 116, padY + boxH - 2, 82, 4);
      }

      // 头部区：状态指示点 + 大号题目名称
      const headerMidY = padY + 60;
      const dotX = padX + 52;
      const haloGrad = ctx.createRadialGradient(dotX, headerMidY, 4, dotX, headerMidY, 32);
      haloGrad.addColorStop(0, dotHaloCol);
      haloGrad.addColorStop(
        0.55,
        isAttackingOrFailed
          ? 'rgba(255, 59, 24, 0.18)'
          : isSolved && !isTron
          ? 'rgba(16, 255, 136, 0.20)'
          : 'rgba(0, 212, 255, 0.18)'
      );
      haloGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = haloGrad;
      ctx.beginPath();
      ctx.arc(dotX, headerMidY, 32, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = dotCoreCol;
      ctx.beginPath();
      ctx.arc(dotX, headerMidY, 14, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = isAttackingOrFailed ? '#ffd6cc' : '#ecfeff';
      ctx.beginPath();
      ctx.arc(dotX - 3, headerMidY - 3, 4.5, 0, Math.PI * 2);
      ctx.fill();

      const shortName =
        V03_SHORT_CHALLENGE_NAMES[challenge.id] ||
        (challenge.name.length > 7 ? challenge.name.slice(0, 7) : challenge.name);
      ctx.save();
      ctx.shadowBlur = 0;
      ctx.fillStyle = isAttackingOrFailed
        ? '#ffd4cc'
        : hovered
        ? '#ffffff'
        : isSolved && !isTron
        ? '#d1fae5'
        : '#ebfbff';
      ctx.font =
        '800 72px "Chakra Petch", "Plus Jakarta Sans", "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillText(fitText(shortName, boxW - 124), padX + 98, headerMidY + 3);
      ctx.restore();

      // 标题与前三名列表之间的横向分割线
      const headerBottomY = padY + 116;
      ctx.save();
      ctx.strokeStyle = isTron
        ? 'rgba(0, 184, 230, 0.42)'
        : isSolved
        ? 'rgba(16, 255, 136, 0.34)'
        : 'rgba(0, 212, 255, 0.32)';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(padX + 24, headerBottomY);
      ctx.lineTo(padX + boxW - 24, headerBottomY);
      ctx.stroke();
      ctx.restore();

      // 主体区：前三名攻破队伍列表（序号 + 队伍头像 + 队伍名称，整体字体加大）
      const solvers = extra.topSolvers ?? challenge.topSolvers ?? [];
      const listTop = headerBottomY + 6;
      const listH = padY + boxH - listTop - 8;
      const rowH = listH / 3;
      const rankColorsSolid = ['#ffd24a', '#e2e8f0', '#fb923c'];
      const rankColorsTron = ['#d4af37', '#cbd5e1', '#d97706'];

      for (let i = 0; i < 3; i++) {
        const cy = listTop + rowH * (i + 0.5);
        const solver = solvers[i];

        if (i > 0) {
          const divY = listTop + rowH * i;
          ctx.save();
          if (isTron) {
            ctx.setLineDash([6, 5]);
            ctx.strokeStyle = 'rgba(0, 184, 230, 0.28)';
          } else {
            ctx.strokeStyle = 'rgba(0, 212, 255, 0.16)';
          }
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(padX + 26, divY);
          ctx.lineTo(padX + boxW - 26, divY);
          ctx.stroke();
          ctx.restore();
        }

        // 1. 序号
        ctx.save();
        ctx.font = '800 46px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = solver
          ? isTron
            ? rankColorsTron[i]
            : rankColorsSolid[i]
          : isTron
          ? 'rgba(0, 184, 230, 0.36)'
          : 'rgba(148, 163, 184, 0.42)';
        ctx.fillText(String(i + 1), padX + 50, cy + 2);
        ctx.restore();

        // 2. 队伍头像 (六边形徽章)
        drawHexAvatar(
          padX + 120,
          cy,
          29,
          solver?.teamColor || '#00b8e6',
          solver ? solver.teamName.slice(0, 1) : '',
          Boolean(solver),
          isTron
        );

        // 3. 队伍名称
        ctx.save();
        ctx.shadowBlur = 0;
        ctx.font =
          '700 46px "Plus Jakarta Sans", "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        if (solver) {
          ctx.fillStyle = isTron ? '#b8f0ff' : '#f8fafc';
          ctx.fillText(fitText(solver.teamName, boxW - 196), padX + 170, cy + 2);
        } else {
          ctx.fillStyle = isTron
            ? 'rgba(0, 184, 230, 0.36)'
            : 'rgba(148, 163, 184, 0.45)';
          ctx.fillText('—', padX + 170, cy + 2);
        }
        ctx.restore();
      }

      texture.needsUpdate = true;
      return;
    }

    if (v03Mode) {
      // v0.4 专属：极简深色全息悬浮小标签（半透明暗色背景 + 细青色切角边框 + 中文简称 + 底部纯青蓝/红状态条）
      const isAttackingOrFailed = state === 'attacking' || state === 'failed';
      const borderCol = isAttackingOrFailed
        ? '#ff3b1f'
        : extra.hovered
        ? '#00d4ff'
        : '#00a8d6';

      drawCutCornerRect(ctx, 20, 24, 728, 212, 18);
      ctx.fillStyle = extra.hovered
        ? 'rgba(6, 15, 30, 0.92)'
        : 'rgba(4, 10, 20, 0.86)';
      ctx.fill();

      strokeMoistNeon(
        ctx,
        borderCol,
        isAttackingOrFailed ? 'rgba(255, 59, 31, 0.18)' : 'rgba(0, 212, 255, 0.18)',
        isAttackingOrFailed ? 'rgba(255, 59, 31, 0.38)' : 'rgba(0, 212, 255, 0.38)',
        extra.hovered ? 3.0 : 2.1
      );

      // 顶部四角微刻度装饰
      ctx.fillStyle = borderCol;
      ctx.fillRect(38, 22, 54, 4);
      ctx.fillRect(676, 232, 54, 4);

      // 右上角细编号
      ctx.fillStyle = '#0ea5e9';
      ctx.font = '600 26px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillText(challenge.id, 716, 76);
      ctx.textAlign = 'left';

      // 中文赛题简称（锐利零眩光，不模糊）
      const shortTitle =
        challenge.name.length > 9 ? challenge.name.slice(0, 9) : challenge.name;
      ctx.save();
      ctx.shadowBlur = 0;
      ctx.fillStyle = isAttackingOrFailed ? '#ff6b52' : '#9eeeff';
      ctx.font = '700 44px "Plus Jakarta Sans", "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.fillText(shortTitle, 44, 118);
      ctx.restore();

      // 底部水平状态进度条
      const barX = 44;
      const barY = 166;
      const barW = 672;
      const barH = 22;

      ctx.fillStyle = 'rgba(8, 22, 42, 0.95)';
      ctx.fillRect(barX, barY, barW, barH);
      ctx.strokeStyle = 'rgba(14, 165, 233, 0.32)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(barX, barY, barW, barH);

      const fillRatio =
        state === 'solved'
          ? 1.0
          : state === 'attacking'
          ? 0.68
          : state === 'failed'
          ? 0.85
          : 0.32;
      const barFillCol = isAttackingOrFailed
        ? '#ff3b1f'
        : state === 'solved'
        ? '#00d4ff'
        : '#0284c7';

      ctx.fillStyle = barFillCol;
      ctx.fillRect(barX + 3, barY + 3, Math.round((barW - 6) * fillRatio), barH - 6);

      texture.needsUpdate = true;
      return;
    }

    const isFirstBlood = state === 'solved' && (extra.firstBlood ?? challenge.firstBlood);
    const borderHex =
      state === 'failed'
        ? STATE_COLOR_HEX.failed
        : isFirstBlood
        ? STATE_COLOR_HEX.firstBlood
        : STATE_COLOR_HEX[state];

    drawCutCornerRect(ctx, 12, 12, 744, 236, 18);
    ctx.fillStyle = extra.hovered ? 'rgba(12, 22, 40, 0.95)' : 'rgba(8, 15, 28, 0.88)';
    ctx.fill();

    strokeMoistNeon(
      ctx,
      borderHex,
      'rgba(0, 212, 255, 0.16)',
      'rgba(0, 212, 255, 0.34)',
      extra.hovered ? 3.6 : 2.4
    );

    // 左侧分区色条
    ctx.fillStyle = zoneColorHex;
    ctx.fillRect(26, 36, 10, 188);

    // 编号 + 分值
    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 38px "JetBrains Mono", monospace';
    ctx.fillText(challenge.id, 52, 82);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 26px "JetBrains Mono", monospace';
    ctx.fillText(`${challenge.points}PT`, 210, 80);

    // 右上状态角标
    const badgeText =
      state === 'failed'
        ? 'DENIED'
        : isFirstBlood
        ? '★ FIRST BLOOD'
        : state === 'solved'
        ? '✓ SOLVED'
        : state === 'attacking'
        ? '● 解题中'
        : '未解';

    ctx.font = '700 26px "Plus Jakarta Sans", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillStyle = borderHex;
    ctx.fillText(badgeText, 728, 80);
    ctx.textAlign = 'left';

    // 题目名称
    const title =
      challenge.name.length > 12 ? challenge.name.slice(0, 11) + '…' : challenge.name;
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '700 42px "Plus Jakarta Sans", "Microsoft YaHei", sans-serif';
    ctx.fillText(title, 52, 162);

    // 底部辅助小字
    ctx.font = '500 24px "Plus Jakarta Sans", "Microsoft YaHei", sans-serif';
    if (state === 'solved' && (extra.team || challenge.solvedBy)) {
      ctx.fillStyle = isFirstBlood ? '#fcd34d' : '#34d399';
      ctx.fillText(`攻破: ${extra.team || challenge.solvedBy}`, 52, 218);
    } else if (state === 'attacking' && (extra.team || challenge.activeAttacker)) {
      ctx.fillStyle = '#fb923c';
      ctx.fillText(`攻击源: ${extra.team || challenge.activeAttacker}`, 52, 218);
    } else {
      ctx.fillStyle = '#64748b';
      ctx.fillText(`${challenge.archetype.toUpperCase()} · ${challenge.difficulty}`, 52, 218);
    }

    texture.needsUpdate = true;
  };

  redraw(challenge.state, {
    team: challenge.solvedBy || challenge.activeAttacker,
    firstBlood: challenge.firstBlood,
  });

  sprite.userData = { redraw };
  return sprite;
}

/**
 * 6) 尝试解题时展开的 3D 全息面板贴图
 */
export function createSolvingCardMesh(challenge: Challenge, teamName: string): THREE.Mesh {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 280;
  const ctx = canvas.getContext('2d')!;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const draw = (progressPct: number) => {
    ctx.clearRect(0, 0, 512, 280);
    drawCutCornerRect(ctx, 10, 10, 492, 260, 16);
    ctx.fillStyle = 'rgba(13, 21, 36, 0.92)';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#fb923c';
    ctx.stroke();

    ctx.fillStyle = '#fb923c';
    ctx.font = '700 24px "Plus Jakarta Sans", "Microsoft YaHei", sans-serif';
    ctx.fillText('● 正在渗透破解 // EXPLOIT RUNNING', 32, 56);

    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 30px "Plus Jakarta Sans", "Microsoft YaHei", sans-serif';
    ctx.fillText(`${challenge.id} ${challenge.name}`, 32, 110);

    const barW = 350;
    ctx.fillStyle = '#090f1a';
    ctx.fillRect(32, 142, barW, 24);
    ctx.fillStyle = '#fb923c';
    ctx.fillRect(32, 142, Math.round((barW * progressPct) / 100), 24);

    ctx.fillStyle = '#fcd34d';
    ctx.font = '700 26px "JetBrains Mono", monospace';
    ctx.fillText(`${progressPct}%`, 398, 163);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '600 24px "Plus Jakarta Sans", "Microsoft YaHei", sans-serif';
    ctx.fillText(`攻击战队: ${teamName}`, 32, 222);

    texture.needsUpdate = true;
  };

  draw(62);

  const geo = new THREE.PlaneGeometry(1.45, 0.8);
  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0.92,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData = { draw };
  return mesh;
}

/**
 * 7) 上浮文字 Sprite（ACCESS DENIED / +500 / FIRST BLOOD）
 */
export function createFloatTextSprite(text: string, colorHex: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, 512, 128);
  ctx.font = '800 46px "JetBrains Mono", "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = colorHex;
  ctx.fillText(text, 256, 64);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const mat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  });

  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(2.3, 0.58, 1);
  return sprite;
}

/**
 * 8) v0.2 专属：绘制设计图中的 7 大分区矢量科技图标
 */
function drawV02VectorIcon(
  ctx: CanvasRenderingContext2D,
  icon: ZoneConfig['v02Icon'],
  cx: number,
  cy: number,
  colorHex: string,
  glareFree = false
) {
  ctx.save();
  ctx.strokeStyle = colorHex;
  ctx.fillStyle = colorHex;
  ctx.lineWidth = glareFree ? 5.2 : 7;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowBlur = 0;

  if (icon === 'cloud') {
    // 云端上传图标 (Cloud + Up Arrow)
    ctx.beginPath();
    ctx.arc(cx - 32, cy + 10, 26, Math.PI * 0.5, Math.PI * 1.45);
    ctx.arc(cx - 4, cy - 16, 32, Math.PI * 1.08, Math.PI * 1.92);
    ctx.arc(cx + 32, cy + 8, 24, Math.PI * 1.5, Math.PI * 0.5);
    ctx.lineTo(cx - 32, cy + 36);
    ctx.closePath();
    ctx.stroke();

    // 内部上箭头
    ctx.beginPath();
    ctx.moveTo(cx, cy + 26);
    ctx.lineTo(cx, cy - 12);
    ctx.moveTo(cx - 16, cy + 4);
    ctx.lineTo(cx, cy - 14);
    ctx.lineTo(cx + 16, cy + 4);
    ctx.stroke();
  } else if (icon === 'signal') {
    // 无线电波通信图标 ((( o )))
    ctx.beginPath();
    ctx.arc(cx, cy, 8, 0, Math.PI * 2);
    ctx.fill();

    // 底部小塔座
    ctx.beginPath();
    ctx.moveTo(cx - 14, cy + 38);
    ctx.lineTo(cx, cy + 8);
    ctx.lineTo(cx + 14, cy + 38);
    ctx.stroke();

    [22, 38, 54].forEach((r) => {
      ctx.beginPath();
      ctx.arc(cx, cy, r, -Math.PI * 0.35, Math.PI * 0.35);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, r, Math.PI * 0.65, Math.PI * 1.35);
      ctx.stroke();
    });
  } else if (icon === 'chip' || icon === 'gpu') {
    // 芯片/GPU 算力核心图标
    const s = 34;
    ctx.strokeRect(cx - s, cy - s, s * 2, s * 2);
    ctx.fillRect(cx - 17, cy - 17, 34, 34);

    const pins = icon === 'chip' ? [-20, -7, 7, 20] : [-16, 0, 16];
    pins.forEach((p) => {
      // 上下引脚
      ctx.beginPath();
      ctx.moveTo(cx + p, cy - s);
      ctx.lineTo(cx + p, cy - s - 16);
      ctx.moveTo(cx + p, cy + s);
      ctx.lineTo(cx + p, cy + s + 16);
      // 左右引脚
      ctx.moveTo(cx - s, cy + p);
      ctx.lineTo(cx - s - 16, cy + p);
      ctx.moveTo(cx + s, cy + p);
      ctx.lineTo(cx + s + 16, cy + p);
      ctx.stroke();
    });
  } else if (icon === 'brain') {
    // 神经网络脑体轮廓图标
    ctx.beginPath();
    ctx.arc(cx - 16, cy - 18, 22, Math.PI * 0.7, Math.PI * 1.9);
    ctx.arc(cx + 18, cy - 16, 22, Math.PI * 1.1, Math.PI * 0.2);
    ctx.arc(cx + 22, cy + 12, 20, -Math.PI * 0.2, Math.PI * 0.75);
    ctx.arc(cx - 18, cy + 12, 20, Math.PI * 0.25, Math.PI * 1.2);
    ctx.closePath();
    ctx.stroke();

    // 脑沟回神经脉冲纹
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 34);
    ctx.lineTo(cx, cy + 28);
    ctx.moveTo(cx - 24, cy - 8);
    ctx.quadraticCurveTo(cx - 8, cy - 16, cx, cy - 4);
    ctx.moveTo(cx + 24, cy - 4);
    ctx.quadraticCurveTo(cx + 8, cy + 8, cx, cy - 2);
    ctx.moveTo(cx - 18, cy + 12);
    ctx.quadraticCurveTo(cx - 6, cy + 4, cx, cy + 14);
    ctx.stroke();
  } else if (icon === 'database') {
    // 三层圆柱数据库图标
    const rx = 38;
    const ry = 11;
    [-24, 0, 24].forEach((oy, idx) => {
      ctx.beginPath();
      ctx.ellipse(cx, cy + oy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      if (idx < 2) {
        ctx.beginPath();
        ctx.moveTo(cx - rx, cy + oy);
        ctx.lineTo(cx - rx, cy + oy + 24);
        ctx.moveTo(cx + rx, cy + oy);
        ctx.lineTo(cx + rx, cy + oy + 24);
        ctx.stroke();
      }
    });
  } else if (icon === 'wrench') {
    // 交叉扳手与螺丝刀运维图标
    ctx.beginPath();
    ctx.moveTo(cx - 30, cy - 30);
    ctx.lineTo(cx + 30, cy + 30);
    ctx.moveTo(cx + 30, cy - 30);
    ctx.lineTo(cx - 30, cy + 30);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx - 32, cy - 32, 13, 0.2, Math.PI * 1.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + 32, cy + 32, 13, Math.PI * 1.2, Math.PI * 0.5);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * 9) v0.2 专属：还原设计图的切角全息横幅标牌（左侧大图标 + 右侧双胶囊进度条 + 清晰分区名称与分值）
 */
export function createV02ZonePlaqueSprite(zone: ZoneConfig, maxAnisotropy = 4) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 360;
  const ctx = canvas.getContext('2d')!;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  });

  const sprite = new THREE.Sprite(material);
  sprite.scale.set(4.5, 1.58, 1);
  sprite.position.set(0, 5.15, 0);

  const redraw = (
    score: number,
    totalScore: number,
    solvedCount: number,
    totalChallenges: number,
    threats: number,
    flashWhite = false
  ) => {
    ctx.clearRect(0, 0, 1024, 360);
    const cHex = zone.v02ColorHex;

    // 1. 外层切角科技框 (还原设计图顶部凹槽与切角)
    const padX = 28;
    const padY = 26;
    const w = 1024 - padX * 2;
    const h = 360 - padY * 2;

    ctx.save();
    drawCutCornerRect(ctx, padX, padY, w, h, 34);
    const grad = ctx.createLinearGradient(0, padY, 0, padY + h);
    grad.addColorStop(0, 'rgba(10, 20, 42, 0.86)');
    grad.addColorStop(1, 'rgba(6, 12, 26, 0.92)');
    ctx.fillStyle = grad;
    ctx.fill();

    // 柔润霓虹外发光边框 (Soft moist cyan glow)
    ctx.restore();
    drawCutCornerRect(ctx, padX, padY, w, h, 34);
    strokeMoistNeon(
      ctx,
      flashWhite ? '#ffffff' : cHex,
      'rgba(0, 212, 255, 0.16)',
      'rgba(0, 212, 255, 0.36)',
      flashWhite ? 5.0 : 3.6
    );

    // 内层细线装饰框
    drawCutCornerRect(ctx, padX + 12, padY + 12, w - 24, h - 24, 26);
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = `${cHex}66`;
    ctx.stroke();

    // 顶部与底部高亮装饰护角条
    ctx.fillStyle = cHex;
    ctx.fillRect(padX + 70, padY - 3, 180, 7);
    ctx.fillRect(padX + w - 250, padY + h - 4, 180, 7);

    // 2. 左侧发光矢量大图标
    drawV02VectorIcon(ctx, zone.v02Icon, 168, 182, cHex, true);

    // 3. 右上分区名与实时比分状态
    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 34px "Plus Jakarta Sans", "Microsoft YaHei", sans-serif';
    ctx.fillText(zone.name, 298, 108);

    ctx.fillStyle = cHex;
    ctx.font = '700 26px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(
      `${score}/${totalScore} PT · ${solvedCount}/${totalChallenges}`,
      948,
      106
    );
    ctx.textAlign = 'left';

    // 4. 右侧双层圆角胶囊进度条 (完全对应设计图中的两条发光进度条)
    const solveRatio = Math.max(0.32, Math.min(0.95, solvedCount / Math.max(1, totalChallenges) + 0.25));
    const scoreRatio = Math.max(0.22, Math.min(0.88, score / Math.max(1, totalScore) + 0.15));

    // 第一条主进度条 (上层长胶囊)
    const barX = 298;
    const bar1Y = 148;
    const bar1MaxW = 620;
    const bar1W = Math.round(bar1MaxW * solveRatio);
    const barH = 30;

    ctx.fillStyle = 'rgba(15, 28, 52, 0.9)';
    ctx.beginPath();
    ctx.roundRect(barX, bar1Y, bar1MaxW, barH, 15);
    ctx.fill();

    ctx.save();
    ctx.fillStyle = cHex;
    ctx.beginPath();
    ctx.roundRect(barX, bar1Y, bar1W, barH, 15);
    ctx.fill();
    ctx.restore();

    // 第二条副进度条 (下层短胶囊)
    const bar2Y = 204;
    const bar2MaxW = 480;
    const bar2W = Math.round(bar2MaxW * scoreRatio);

    ctx.fillStyle = 'rgba(15, 28, 52, 0.9)';
    ctx.beginPath();
    ctx.roundRect(barX, bar2Y, bar2MaxW, barH, 15);
    ctx.fill();

    ctx.save();
    ctx.fillStyle = threats > 0 ? '#ff9f43' : cHex;
    ctx.beginPath();
    ctx.roundRect(barX, bar2Y, bar2W, barH, 15);
    ctx.fill();
    ctx.restore();

    texture.needsUpdate = true;
  };

  const solvedInit = zone.challenges.filter((c) => c.state === 'solved').length;
  const threatsInit = zone.challenges.filter((c) => c.state === 'attacking').length;
  redraw(zone.score, zone.totalScore, solvedInit, zone.challenges.length, threatsInit, false);

  sprite.userData = { redraw };
  return sprite;
}

let _cachedGpuFanFaceTex: THREE.CanvasTexture | null = null;

/**
 * 10) v0.2 专属：算力区双风扇 GPU 立方体侧面发光涡轮风扇贴图 (256×256，全局缓存复用)
 */
export function createGpuFanFaceTexture(maxAnisotropy = 4): THREE.CanvasTexture {
  if (_cachedGpuFanFaceTex) return _cachedGpuFanFaceTex;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#0c1629';
  ctx.fillRect(0, 0, 256, 256);

  // 装甲外框
  ctx.strokeStyle = '#1e3a5f';
  ctx.lineWidth = 8;
  ctx.strokeRect(8, 8, 240, 240);

  // 两个并排发光青色涡轮风扇环
  [72, 184].forEach((cx) => {
    const cy = 132;
    ctx.save();
    ctx.strokeStyle = '#00d4ff';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(cx, cy, 42, 0, Math.PI * 2);
    ctx.stroke();

    // 扇叶
    ctx.lineWidth = 3;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * 36, cy + Math.sin(a) * 36);
      ctx.stroke();
    }

    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(cx, cy, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  // 顶部状态指示条
  ctx.fillStyle = '#00f59b';
  ctx.fillRect(24, 24, 96, 10);
  ctx.fillStyle = '#00d4ff';
  ctx.fillRect(136, 24, 96, 10);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(4, Math.max(1, maxAnisotropy));
  _cachedGpuFanFaceTex = tex;
  return tex;
}

let _cachedV04PolishedSilverTex: THREE.CanvasTexture | null = null;
let _cachedV04WhiteRackFrontTex: THREE.CanvasTexture | null = null;
let _cachedV04SilverStorageBayTex: THREE.CanvasTexture | null = null;

/**
 * 15) v0.4 专属：抛光银金属与磨砂白陶瓷微纹理贴图 (512×512, Polished Silver & Frosted White Ceramic)
 */
export function createV04PolishedSilverTexture(maxAnisotropy = 4): THREE.CanvasTexture {
  if (_cachedV04PolishedSilverTex) return _cachedV04PolishedSilverTex;

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 512, 512);
  grad.addColorStop(0, '#e2e8f0');
  grad.addColorStop(0.5, '#f8fafc');
  grad.addColorStop(1, '#cbd5e1');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // 极细腻镜面银拉丝与陶瓷微孔接缝
  for (let y = 0; y < 512; y += 2) {
    ctx.fillStyle = y % 4 === 0 ? 'rgba(255, 255, 255, 0.25)' : 'rgba(148, 163, 184, 0.14)';
    ctx.fillRect(0, y, 512, 1);
  }

  ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(14, 14, 484, 484);

  // 精密银白百叶散热格栅 (Clean futuristic silver vents)
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 4; c++) {
      const vx = 54 + c * 106;
      const vy = 64 + r * 14;
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(vx, vy, 82, 5);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(vx, vy + 5, 82, 1.5);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  _cachedV04PolishedSilverTex = tex;
  return tex;
}

/**
 * 16) v0.4 专属：磨砂白陶瓷与抛光银高密度服务器前脸贴图 (512×512, Frosted White Ceramic & Polished Silver Server Rack)
 * 严禁黑盒子 (Do NOT use black boxes)，采用磨砂白陶瓷刀片面板 + 抛光银导轨 + 清透青蓝光纤灯带
 */
export function createV04WhiteRackFrontTexture(maxAnisotropy = 4): THREE.CanvasTexture {
  if (_cachedV04WhiteRackFrontTex) return _cachedV04WhiteRackFrontTex;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // 抛光银白底框 (Polished silver-white chassis frame)
  ctx.fillStyle = '#dbe4f0';
  ctx.fillRect(0, 0, 512, 512);

  // 两侧高光银金属立柱导轨
  const railGrad = ctx.createLinearGradient(0, 0, 32, 0);
  railGrad.addColorStop(0, '#cbd5e1');
  railGrad.addColorStop(0.5, '#f8fafc');
  railGrad.addColorStop(1, '#94a3b8');
  ctx.fillStyle = railGrad;
  ctx.fillRect(0, 0, 30, 512);
  ctx.fillRect(482, 0, 30, 512);

  // 右侧贯穿式冰蓝亚克力导光槽
  ctx.fillStyle = '#bae6fd';
  ctx.fillRect(458, 14, 12, 484);
  ctx.fillStyle = '#00d4ff';
  for (let y = 20; y < 484; y += 24) {
    ctx.fillRect(460, y, 8, 16);
  }

  // 12 层磨砂白陶瓷 (Frosted White Ceramic) 与抛光银刀片服务器面板
  const bayH = 512 / 12;
  for (let i = 0; i < 12; i++) {
    const y = i * bayH;
    ctx.fillStyle = i % 2 === 0 ? '#f1f5f9' : '#e2e8f0';
    ctx.fillRect(32, y + 3, 422, bayH - 6);

    // 银白高光倒角边
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(33, y + 4, 420, bayH - 8);

    // 左侧精密银色进风百叶槽
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(66, y + 8, 112, bayH - 16);
    ctx.fillStyle = '#64748b';
    for (let vx = 72; vx < 172; vx += 12) {
      ctx.fillRect(vx, y + 11, 7, bayH - 22);
    }

    // 右侧 4 组抛光银热插拔托架与冰青/深蓝状态灯
    for (let d = 0; d < 4; d++) {
      const dx = 190 + d * 64;
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(dx, y + 7, 56, bayH - 14);
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(dx + 4, y + 10, 38, bayH - 20);

      ctx.fillStyle = (i + d) % 2 === 0 ? '#00d4ff' : '#0284c7';
      ctx.fillRect(dx + 45, y + 11, 6, bayH - 22);
    }

    // 左侧青色电源呼吸灯
    ctx.fillStyle = '#00d4ff';
    ctx.fillRect(44, y + bayH * 0.38, 8, 8);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(4, Math.max(1, maxAnisotropy));
  _cachedV04WhiteRackFrontTex = tex;
  return tex;
}

/**
 * 17) v0.4 专属：知识库抛光银海量存储阵列 + 发光蓝青磁盘托架贴图 (512×512, Massive Silver Storage Arrays with Glowing Blue Disk Bays)
 */
export function createV04SilverStorageBayTexture(maxAnisotropy = 4): THREE.CanvasTexture {
  if (_cachedV04SilverStorageBayTex) return _cachedV04SilverStorageBayTex;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // 抛光银白柜体底色 (Polished silver enclosure)
  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(0, 0, 512, 512);

  const rows = 10;
  const cols = 8;
  const padX = 18;
  const padY = 16;
  const cellW = (512 - padX * 2) / cols;
  const cellH = (512 - padY * 2) / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = padX + c * cellW;
      const y = padY + r * cellH;

      // 磨砂银白硬盘托架外框
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(x + 2, y + 2, cellW - 4, cellH - 4);

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(x + 2.5, y + 2.5, cellW - 5, cellH - 5);

      // 发光蓝/青亚克力导光磁阵窗 (Glowing blue disk bays)
      const isCyan = (r * 5 + c * 7) % 3 === 0;
      ctx.fillStyle = isCyan ? '#00d4ff' : '#0284c7';
      ctx.fillRect(x + 6, y + 7, cellW - 18, cellH - 14);

      // 抛光银金属锁扣条
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(x + 8, y + 9, cellW - 24, 5);

      // 右侧高亮状态灯点
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(x + cellW - 9, y + 8, 4, cellH - 16);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(4, Math.max(1, maxAnisotropy));
  _cachedV04SilverStorageBayTex = tex;
  return tex;
}


let _cachedV03BrushedMetalTex: THREE.CanvasTexture | null = null;
let _cachedV03CarbonFiberTex: THREE.CanvasTexture | null = null;
let _cachedV03RackFrontTex: THREE.CanvasTexture | null = null;
let _cachedV03StorageBayTex: THREE.CanvasTexture | null = null;

/**
 * 10b) v0.3 专属：枪铁灰与炭灰拉丝金属纹理 + 真实百叶散热孔与机加工面板接缝贴图 (512×512)
 * "The devices are made of gunmetal grey and charcoal grey brushed metal, NOT pure black.
 *  They feature crisp specular highlights, visible metal textures, cooling vents, and panel seams."
 */
export function createV03BrushedMetalTexture(maxAnisotropy = 4): THREE.CanvasTexture {
  if (_cachedV03BrushedMetalTex) return _cachedV03BrushedMetalTex;

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // 高明度中性拉丝细节基底（配合 PBR color: 0x6a7a8c 使用，保留清晰拉丝质感而不压黑底色）
  const grad = ctx.createLinearGradient(0, 0, 512, 512);
  grad.addColorStop(0, '#e0e4e8');
  grad.addColorStop(0.5, '#f6f8fa');
  grad.addColorStop(1, '#cfd4da');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // 高密度水平金属拉丝纹理 (Visible brushed metal striations)
  for (let y = 0; y < 512; y += 2) {
    const alpha = 0.05 + ((y * 19) % 13) * 0.007;
    ctx.fillStyle = y % 4 === 0 ? `rgba(255, 255, 255, ${alpha})` : `rgba(40, 48, 56, ${alpha})`;
    ctx.fillRect(0, 0 + y, 512, 1);
  }

  // 模块化装甲面板接缝 (Crisp Panel Seams with recessed groove + bright specular bevel lip)
  const drawPanelSeamRect = (x: number, y: number, w: number, h: number) => {
    ctx.strokeStyle = 'rgba(35, 42, 50, 0.65)';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
  };

  drawPanelSeamRect(12, 12, 488, 488);
  drawPanelSeamRect(28, 28, 456, 214);
  drawPanelSeamRect(28, 268, 456, 214);

  // 竖向中缝接缝线
  ctx.fillStyle = 'rgba(35, 42, 50, 0.60)';
  ctx.fillRect(254, 28, 3, 454);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.fillRect(257, 28, 1.5, 454);

  // 上下两组真实工业百叶散热孔阵列 (Realistic Louvered Cooling Vents)
  const drawVentBank = (startX: number, startY: number, cols: number, rows: number) => {
    const slotW = 68;
    const slotH = 7;
    const gapX = 16;
    const gapY = 12;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const vx = startX + c * (slotW + gapX);
        const vy = startY + r * gapY;
        ctx.fillStyle = '#4a525c';
        ctx.fillRect(vx, vy, slotW, slotH);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(vx, vy + slotH - 1.8, slotW, 1.8);
      }
    }
  };

  drawVentBank(48, 56, 5, 11);
  drawVentBank(48, 296, 5, 11);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  _cachedV03BrushedMetalTex = tex;
  return tex;
}

/**
 * 10c) v0.3 专属：高明度精密编织细节纹理 (256×256)
 */
export function createV03CarbonFiberTexture(maxAnisotropy = 4): THREE.CanvasTexture {
  if (_cachedV03CarbonFiberTex) return _cachedV03CarbonFiberTex;

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#c4c9cf';
  ctx.fillRect(0, 0, 256, 256);

  const step = 8;
  for (let y = 0; y < 256; y += step) {
    for (let x = 0; x < 256; x += step) {
      const diag = ((x + y) / step) % 4;
      if (diag === 0 || diag === 1) {
        ctx.fillStyle = diag === 0 ? '#e4e8ec' : '#d6dbe0';
      } else {
        ctx.fillStyle = diag === 2 ? '#b2b8bf' : '#c6cbd1';
      }
      ctx.fillRect(x, y, step - 1, step - 1);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.20)';
      ctx.fillRect(x + 1, y + 1, step - 3, 2);
    }
  }

  ctx.strokeStyle = 'rgba(40, 46, 54, 0.60)';
  ctx.lineWidth = 2;
  ctx.strokeRect(4, 4, 248, 248);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(6, 6, 244, 244);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  tex.anisotropy = maxAnisotropy;
  _cachedV03CarbonFiberTex = tex;
  return tex;
}

/**
 * 11) v0.3 专属：枪铁灰与炭灰拉丝机柜前脸贴图 (512×512)
 * "The devices are made of gunmetal grey and charcoal grey brushed metal, NOT pure black.
 *  They feature crisp specular highlights, visible metal textures, cooling vents, and panel seams.
 *  Only tiny, sparse deep-cyan indicator lights glow on the equipment."
 */
export function createV03RackFrontTexture(maxAnisotropy = 4): THREE.CanvasTexture {
  if (_cachedV03RackFrontTex) return _cachedV03RackFrontTex;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // 高明度机柜前脸细节贴图（与 color: 0x6a7a8c 乘法叠加后精确还原冷灰蓝金属质感）
  ctx.fillStyle = '#b4bac0';
  ctx.fillRect(0, 0, 512, 512);

  // 两侧高光拉丝机架立柱
  const railGrad = ctx.createLinearGradient(0, 0, 32, 0);
  railGrad.addColorStop(0, '#dfe4ea');
  railGrad.addColorStop(0.5, '#f6f8fa');
  railGrad.addColorStop(1, '#c4cad0');
  ctx.fillStyle = railGrad;
  ctx.fillRect(0, 0, 30, 512);
  ctx.fillRect(482, 0, 30, 512);

  // 精密方孔导轨与倒角亮边
  for (let y = 10; y < 512; y += 16) {
    ctx.fillStyle = '#4a525c';
    ctx.fillRect(10, y, 8, 8);
    ctx.fillRect(494, y, 8, 8);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(10, y + 7, 8, 1.5);
    ctx.fillRect(494, y + 7, 8, 1.5);
  }

  // 右侧机加工垂直面板接缝槽
  ctx.fillStyle = '#586068';
  ctx.fillRect(462, 10, 12, 492);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.lineWidth = 1;
  ctx.strokeRect(462.5, 10.5, 11, 491);

  // 12 层 2U/3U 超写实拉丝刀片服务器面板
  const bayH = 512 / 12;
  for (let i = 0; i < 12; i++) {
    const y = i * bayH;
    ctx.fillStyle = i % 2 === 0 ? '#e4e8ec' : '#ced4da';
    ctx.fillRect(32, y + 3, 426, bayH - 6);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
    for (let ly = y + 6; ly < y + bayH - 5; ly += 3) {
      ctx.fillRect(34, ly, 422, 1);
    }

    ctx.strokeStyle = '#485058';
    ctx.lineWidth = 2;
    ctx.strokeRect(31.5, y + 2.5, 427, bayH - 5);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.lineWidth = 1.4;
    ctx.strokeRect(33, y + 4, 424, bayH - 8);

    // 左侧真实六角蜂窝/百叶进风散热孔区
    ctx.fillStyle = '#505860';
    ctx.fillRect(62, y + 8, 124, bayH - 16);
    ctx.fillStyle = '#dde2e8';
    for (let vx = 68; vx < 180; vx += 12) {
      for (let vy = y + 11; vy < y + bayH - 11; vy += 6) {
        ctx.fillRect(vx, vy, 8, 3);
      }
    }

    // 右侧 4 组拉丝热插拔托架
    for (let d = 0; d < 4; d++) {
      const dx = 196 + d * 62;
      ctx.fillStyle = '#687078';
      ctx.fillRect(dx, y + 7, 54, bayH - 14);
      ctx.fillStyle = '#dce0e6';
      ctx.fillRect(dx + 4, y + 10, 36, bayH - 20);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(dx + 4, y + 10, 36, 2);

      if ((i * 5 + d * 3) % 11 === 0) {
        ctx.fillStyle = '#00c4f0';
        ctx.fillRect(dx + 45, y + 14, 3.5, 3.5);
      } else if ((i * 7 + d) % 13 === 0) {
        ctx.fillStyle = '#0284c7';
        ctx.fillRect(dx + 45, y + 14, 3, 3);
      }
    }

    if (i % 3 === 0) {
      ctx.fillStyle = '#00c4f0';
      ctx.fillRect(44, y + bayH * 0.44, 4, 4);
    } else {
      ctx.fillStyle = '#545c64';
      ctx.fillRect(44, y + bayH * 0.44, 4, 4);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(4, Math.max(1, maxAnisotropy));
  _cachedV03RackFrontTex = tex;
  return tex;
}

/**
 * 12) v0.3 专属：六边形平台顶面极细深青色轮廓与微距几何刻度 (Extremely Thin, Dark Cyan Glowing Outlines)
 */
export function createV03FloorProjectionMesh(maxAnisotropy = 4): {
  mesh: THREE.Mesh;
  redraw: (solvedCount: number, totalChallenges: number, hasAttack: boolean) => void;
} {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;

  const redraw = (solvedCount: number, totalChallenges: number, hasAttack: boolean) => {
    ctx.clearRect(0, 0, 1024, 1024);
    const cx = 512;
    const cy = 512;

    ctx.save();

    // 1. 极细六边形柔润青光内轮廓线 (Soft moist cyan outline)
    const hexR = 476;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      const hx = cx + Math.cos(a) * hexR;
      const hy = cy + Math.sin(a) * hexR;
      if (i === 0) ctx.moveTo(hx, hy);
      else ctx.lineTo(hx, hy);
    }
    ctx.closePath();
    strokeMoistNeon(
      ctx,
      'rgba(0, 216, 255, 0.68)',
      'rgba(0, 212, 255, 0.10)',
      'rgba(0, 212, 255, 0.24)',
      2.2
    );

    // 次级内圈极细六边形装甲接缝线 (Secondary recessed alloy seam)
    const innerHexR = 448;
    ctx.strokeStyle = 'rgba(14, 138, 184, 0.24)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      const hx = cx + Math.cos(a) * innerHexR;
      const hy = cy + Math.sin(a) * innerHexR;
      if (i === 0) ctx.moveTo(hx, hy);
      else ctx.lineTo(hx, hy);
    }
    ctx.closePath();
    ctx.stroke();

    // 2. 5 段极细深青色态势光弧 (Ultra-thin dark cyan status arcs)
    const total = Math.max(1, totalChallenges);
    const segAngle = (Math.PI * 2) / total;
    const gap = 0.1;
    for (let i = 0; i < total; i++) {
      const startA = -Math.PI / 2 + i * segAngle + gap;
      const endA = -Math.PI / 2 + (i + 1) * segAngle - gap;
      const isSolved = i < solvedCount;
      ctx.strokeStyle = isSolved
        ? 'rgba(0, 184, 230, 0.48)'
        : 'rgba(14, 116, 144, 0.16)';
      ctx.lineWidth = isSolved ? 3.5 : 2.0;
      ctx.beginPath();
      ctx.arc(cx, cy, 396, startA, endA);
      ctx.stroke();
    }

    // 3. 内部五边形极细光纤走线槽
    ctx.strokeStyle = hasAttack
      ? 'rgba(239, 68, 68, 0.28)'
      : 'rgba(0, 150, 199, 0.20)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * 92, cy + Math.sin(a) * 92);
      ctx.lineTo(cx + Math.cos(a) * 310, cy + Math.sin(a) * 310);
      ctx.stroke();
    }

    // 4. 中心极细暗青圆环
    ctx.strokeStyle = 'rgba(0, 168, 214, 0.28)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(cx, cy, 92, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
    texture.needsUpdate = true;
  };

  redraw(2, 5, false);

  const geo = new THREE.PlaneGeometry(8.6, 8.6);
  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.022;

  return { mesh, redraw };
}

/**
 * 13) v0.3 & v0.4 专属：7 大六边形平台上方悬浮的极简全息分区面板
 * - v0.3: 简洁半透明暗底切角面板 + 矢量科技图标 + 极其清晰的简体中文精简分区名 (AI接入/推理服务/智能体/知识库/算力调度/运维保障/通信网络)
 * - v0.4: 保持原有未来沙盘中文看板与解谜进度条
 */
const V03_ZONE_CHINESE_TITLES: Record<string, string> = {
  'ai-access': 'AI接入',
  inference: '推理服务',
  agent: '智能体',
  knowledge: '知识库',
  compute: '算力调度',
  ops: '运维保障',
  net: '通信网络',
};

const V04_ZONE_CHINESE_TITLES: Record<string, string> = {
  'ai-access': 'AI应用接入',
  inference: '模型推理',
  agent: '智能体编排',
  knowledge: '知识库',
  compute: '算力调度',
  ops: '运维保障',
  net: '通信网络',
};

export function createV03ZoneLabelSprite(zone: ZoneConfig, maxAnisotropy = 4): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 1040;
  canvas.height = 280;
  const ctx = canvas.getContext('2d')!;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = maxAnisotropy;

  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
    })
  );
  // 仅显示分区图标与名称（面板与字体同步加大，悬浮于各区设备上方）
  sprite.scale.set(3.40, 0.92, 1);
  sprite.position.set(0, 4.68, 0);

  const v03ZhTitle = V03_ZONE_CHINESE_TITLES[zone.id] || zone.shortName;
  const v04ZhTitle = V04_ZONE_CHINESE_TITLES[zone.id] || zone.shortName;

  let isV03ZonePanel = true;
  let isTronWireframePanel = false;

  const redraw = (
    score: number,
    totalScore: number,
    solvedCount: number,
    totalChallenges: number,
    threats = 0,
    v03ModeFlag?: boolean,
    tronWireframeFlag?: boolean
  ) => {
    void score;
    void totalScore;
    void solvedCount;
    void totalChallenges;
    void threats;

    if (v03ModeFlag !== undefined) {
      isV03ZonePanel = v03ModeFlag;
    }
    if (tronWireframeFlag !== undefined) {
      isTronWireframePanel = tronWireframeFlag;
    }
    ctx.clearRect(0, 0, 1040, 280);

    const padX = 24;
    const padY = 18;
    const w = 1040 - padX * 2;
    const h = 280 - padY * 2;
    const centerY = padY + h / 2;

    if (isTronWireframePanel) {
      // 0.1版（赛博线框风）：全透明 L 型折线框 + 左侧六边形线框图标 + 分区名称
      ctx.save();
      ctx.strokeStyle = 'rgba(0, 168, 214, 0.44)';
      ctx.lineWidth = 1.6;
      ctx.strokeRect(padX, padY, w, h);

      const cLen = 34;
      ctx.strokeStyle = '#00b8e6';
      ctx.lineWidth = 3.6;
      ctx.beginPath();
      ctx.moveTo(padX, padY + cLen);
      ctx.lineTo(padX, padY);
      ctx.lineTo(padX + cLen, padY);
      ctx.moveTo(padX + w - cLen, padY);
      ctx.lineTo(padX + w, padY);
      ctx.lineTo(padX + w, padY + cLen);
      ctx.moveTo(padX, padY + h - cLen);
      ctx.lineTo(padX, padY + h);
      ctx.lineTo(padX + cLen, padY + h);
      ctx.moveTo(padX + w - cLen, padY + h);
      ctx.lineTo(padX + w, padY + h);
      ctx.lineTo(padX + w, padY + h - cLen);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(0, 184, 230, 0.5)';
      ctx.lineWidth = 1.6;
      for (let i = 0; i <= 18; i++) {
        const tx = padX + 96 + i * 46;
        const th = i % 4 === 0 ? 11 : 5;
        ctx.beginPath();
        ctx.moveTo(tx, padY);
        ctx.lineTo(tx, padY + th);
        ctx.moveTo(tx, padY + h);
        ctx.lineTo(tx, padY + h - th);
        ctx.stroke();
      }

      const iconCx = 148;
      const iconCy = centerY;
      ctx.strokeStyle = '#00a8d6';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
        const hx = iconCx + Math.cos(a) * 72;
        const hy = iconCy + Math.sin(a) * 72;
        if (i === 0) ctx.moveTo(hx, hy);
        else ctx.lineTo(hx, hy);
      }
      ctx.closePath();
      ctx.stroke();

      ctx.save();
      ctx.translate(iconCx, iconCy);
      ctx.scale(0.95, 0.95);
      drawV02VectorIcon(ctx, zone.v02Icon, 0, 0, '#00b8e6', true);
      ctx.restore();

      ctx.fillStyle = 'rgba(0, 184, 230, 0.48)';
      ctx.fillRect(256, padY + 32, 2.5, h - 64);

      const titleText = v03ZhTitle;
      let fontPx = 122;
      ctx.font = `700 ${fontPx}px "Share Tech Mono", "Chakra Petch", "PingFang SC", "Microsoft YaHei", sans-serif`;
      while (fontPx > 92 && ctx.measureText(titleText).width > 690) {
        fontPx -= 4;
        ctx.font = `700 ${fontPx}px "Share Tech Mono", "Chakra Petch", "PingFang SC", "Microsoft YaHei", sans-serif`;
      }
      ctx.fillStyle = '#aeeaff';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(titleText, 296, centerY + 3);
      ctx.restore();

      texture.needsUpdate = true;
      return;
    }

    // 0.2版：暗底切角科技边框 + 左侧六边形科技图标 + 居中大号分区名称
    drawCutCornerRect(ctx, padX, padY, w, h, 28);
    ctx.fillStyle = 'rgba(4, 11, 24, 0.88)';
    ctx.fill();

    strokeMoistNeon(
      ctx,
      '#00d8ff',
      'rgba(0, 216, 255, 0.18)',
      'rgba(0, 216, 255, 0.38)',
      2.6
    );

    drawCutCornerRect(ctx, padX + 10, padY + 10, w - 20, h - 20, 20);
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = 'rgba(0, 212, 255, 0.28)';
    ctx.stroke();

    ctx.fillStyle = '#00e5ff';
    ctx.fillRect(padX + 48, padY - 2, 120, 5);
    ctx.fillRect(padX + w - 168, padY + h - 3, 120, 5);

    const iconCx = 148;
    const iconCy = centerY;
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 212, 255, 0.45)';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      const hx = iconCx + Math.cos(a) * 74;
      const hy = iconCy + Math.sin(a) * 74;
      if (i === 0) ctx.moveTo(hx, hy);
      else ctx.lineTo(hx, hy);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(0, 180, 216, 0.12)';
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.translate(iconCx, iconCy);
    ctx.scale(0.98, 0.98);
    drawV02VectorIcon(ctx, zone.v02Icon, 0, 0, '#00e5ff', true);
    ctx.restore();

    ctx.fillStyle = 'rgba(0, 200, 240, 0.38)';
    ctx.fillRect(256, padY + 32, 2.5, h - 64);

    ctx.save();
    ctx.shadowBlur = 0;
    const titleText = isV03ZonePanel ? v03ZhTitle : v04ZhTitle;
    let fontPx = 124;
    ctx.font = `800 ${fontPx}px "Chakra Petch", "Plus Jakarta Sans", "PingFang SC", "Microsoft YaHei", sans-serif`;
    while (fontPx > 92 && ctx.measureText(titleText).width > 690) {
      fontPx -= 4;
      ctx.font = `800 ${fontPx}px "Chakra Petch", "Plus Jakarta Sans", "PingFang SC", "Microsoft YaHei", sans-serif`;
    }
    ctx.fillStyle = '#ebfbff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(titleText, 296, centerY + 3);
    ctx.restore();

    texture.needsUpdate = true;
  };

  const solvedInit = zone.challenges.filter((c) => c.state === 'solved').length;
  const threatsInit = zone.challenges.filter((c) => c.state === 'attacking').length;
  redraw(zone.score, zone.totalScore, solvedInit, zone.challenges.length, threatsInit, true, false);

  sprite.userData = { redraw };
  return sprite;
}

/**
 * 13.5) 每台赛题设备上方/旁侧展示的前 3 个攻破该赛题的队伍面板 Sprite (600×300)
 * 仅展示：序号 + 队伍头像 + 队伍名称，无多余字段
 */
export function createChallengeTopSolversSprite(
  challenge: Challenge,
  maxAnisotropy = 4
): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 300;
  const ctx = canvas.getContext('2d')!;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = maxAnisotropy;

  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
    })
  );
  sprite.scale.set(1.32, 0.66, 1);

  const fitTeamName = (name: string, maxW: number): string => {
    if (ctx.measureText(name).width <= maxW) return name;
    let cut = name;
    while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxW) {
      cut = cut.slice(0, -1);
    }
    return `${cut}…`;
  };

  const drawHexAvatar = (
    cx: number,
    cy: number,
    r: number,
    teamColor: string,
    initialChar: string,
    filled: boolean,
    isTronWireframe: boolean
  ) => {
    ctx.save();
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      // Pointy-top hexagon matching .clip-hex-avatar
      const a = (k / 6) * Math.PI * 2 - Math.PI / 2;
      const hx = cx + Math.cos(a) * r;
      const hy = cy + Math.sin(a) * r;
      if (k === 0) ctx.moveTo(hx, hy);
      else ctx.lineTo(hx, hy);
    }
    ctx.closePath();

    if (filled) {
      if (isTronWireframe) {
        ctx.fillStyle = 'rgba(0, 212, 255, 0.10)';
        ctx.fill();
        ctx.lineWidth = 2.4;
        ctx.strokeStyle = teamColor;
        ctx.stroke();
      } else {
        const grad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
        grad.addColorStop(0, `${teamColor}cc`);
        grad.addColorStop(1, 'rgba(10, 14, 23, 0.92)');
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.lineWidth = 2.4;
        ctx.strokeStyle = teamColor;
        ctx.stroke();
      }

      ctx.fillStyle = isTronWireframe ? '#e0f7ff' : '#ffffff';
      ctx.font = '700 25px "Plus Jakarta Sans", "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(initialChar, cx, cy + 1.5);
    } else {
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = isTronWireframe
        ? 'rgba(0, 184, 230, 0.28)'
        : 'rgba(148, 163, 184, 0.30)';
      ctx.stroke();
    }
    ctx.restore();
  };

  const redraw = (
    solvers: ChallengeSolver[] = [],
    opts: {
      hovered?: boolean;
      isTronWireframe?: boolean;
    } = {}
  ) => {
    const isTron = Boolean(opts.isTronWireframe);
    const hovered = Boolean(opts.hovered);

    ctx.clearRect(0, 0, 600, 300);

    const padX = 16;
    const padY = 14;
    const w = 600 - padX * 2;
    const h = 300 - padY * 2;

    if (isTron) {
      ctx.save();
      ctx.fillStyle = hovered ? 'rgba(2, 8, 20, 0.62)' : 'rgba(2, 6, 16, 0.42)';
      ctx.fillRect(padX, padY, w, h);

      ctx.strokeStyle = hovered ? 'rgba(0, 212, 255, 0.65)' : 'rgba(0, 184, 230, 0.38)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(padX, padY, w, h);

      const cLen = 20;
      ctx.strokeStyle = hovered ? '#00f0ff' : '#00b8e6';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(padX, padY + cLen);
      ctx.lineTo(padX, padY);
      ctx.lineTo(padX + cLen, padY);
      ctx.moveTo(padX + w - cLen, padY);
      ctx.lineTo(padX + w, padY);
      ctx.lineTo(padX + w, padY + cLen);
      ctx.moveTo(padX, padY + h - cLen);
      ctx.lineTo(padX, padY + h);
      ctx.lineTo(padX + cLen, padY + h);
      ctx.moveTo(padX + w - cLen, padY + h);
      ctx.lineTo(padX + w, padY + h);
      ctx.lineTo(padX + w, padY + h - cLen);
      ctx.stroke();
      ctx.restore();
    } else {
      drawCutCornerRect(ctx, padX, padY, w, h, 16);
      ctx.fillStyle = hovered ? 'rgba(7, 16, 34, 0.94)' : 'rgba(5, 12, 26, 0.88)';
      ctx.fill();

      strokeMoistNeon(
        ctx,
        hovered ? '#00f0ff' : '#00b8e6',
        'rgba(0, 212, 255, 0.14)',
        'rgba(0, 212, 255, 0.30)',
        hovered ? 2.8 : 2.0
      );

      ctx.fillStyle = hovered ? '#00f0ff' : '#00d4ff';
      ctx.fillRect(padX + 28, padY - 1.5, 56, 3);
      ctx.fillRect(padX + w - 84, padY + h - 1.5, 56, 3);
    }

    const rowTop = padY + 12;
    const rowH = (h - 24) / 3;
    const rankColorsSolid = ['#ffd24a', '#e2e8f0', '#fb923c'];
    const rankColorsTron = ['#d4af37', '#cbd5e1', '#d97706'];

    for (let i = 0; i < 3; i++) {
      const cy = rowTop + rowH * (i + 0.5);
      const solver = solvers[i];

      if (i > 0) {
        const divY = rowTop + rowH * i;
        ctx.save();
        if (isTron) {
          ctx.setLineDash([6, 5]);
          ctx.strokeStyle = 'rgba(0, 184, 230, 0.28)';
        } else {
          ctx.strokeStyle = 'rgba(0, 212, 255, 0.16)';
        }
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(padX + 20, divY);
        ctx.lineTo(padX + w - 20, divY);
        ctx.stroke();
        ctx.restore();
      }

      // 1. 序号
      ctx.save();
      ctx.font = '800 34px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = solver
        ? (isTron ? rankColorsTron[i] : rankColorsSolid[i])
        : isTron
        ? 'rgba(0, 184, 230, 0.34)'
        : 'rgba(148, 163, 184, 0.38)';
      ctx.fillText(String(i + 1), padX + 42, cy + 1);
      ctx.restore();

      // 2. 队伍头像 (六边形徽章)
      drawHexAvatar(
        padX + 104,
        cy,
        24,
        solver?.teamColor || '#00b8e6',
        solver ? solver.teamName.slice(0, 1) : '',
        Boolean(solver),
        isTron
      );

      // 3. 队伍名称
      ctx.save();
      ctx.shadowBlur = 0;
      ctx.font =
        '700 33px "Plus Jakarta Sans", "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      if (solver) {
        ctx.fillStyle = isTron ? '#9ce2f2' : '#f1f5f9';
        ctx.fillText(fitTeamName(solver.teamName, w - 170), padX + 148, cy + 1.5);
      } else {
        ctx.fillStyle = isTron
          ? 'rgba(0, 184, 230, 0.34)'
          : 'rgba(148, 163, 184, 0.42)';
        ctx.fillText('—', padX + 148, cy + 1.5);
      }
      ctx.restore();
    }

    texture.needsUpdate = true;
  };

  redraw(challenge.topSolvers || [], { hovered: false, isTronWireframe: false });
  sprite.userData = { redraw };
  return sprite;
}

/**
 * 14) v0.3 专属：知识库海量存储阵列的高密度磁盘托架贴图 (Dense Rows of Disk Bays, 512×512)
 * 采用枪铁灰与炭灰拉丝金属托架、面板接缝、微孔散热栅格与极微小稀疏的深青色指示灯（非纯黑）
 */
export function createV03StorageBayTexture(maxAnisotropy = 4): THREE.CanvasTexture {
  if (_cachedV03StorageBayTex) return _cachedV03StorageBayTex;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // 高明度存储阵列细节贴图（与 color: 0x6a7a8c 乘法叠加后还原高反光冷灰蓝金属质感）
  ctx.fillStyle = '#b4bac0';
  ctx.fillRect(0, 0, 512, 512);

  // 10 行 × 8 列 = 80 块高密热插拔磁盘阵列托架
  const rows = 10;
  const cols = 8;
  const padX = 18;
  const padY = 16;
  const cellW = (512 - padX * 2) / cols;
  const cellH = (512 - padY * 2) / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = padX + c * cellW;
      const y = padY + r * cellH;

      ctx.fillStyle = '#d4d8de';
      ctx.fillRect(x + 2, y + 2, cellW - 4, cellH - 4);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(x + 2.5, y + 2.5, cellW - 5, cellH - 5);

      ctx.fillStyle = '#eceff2';
      ctx.fillRect(x + 6, y + 6, cellW - 18, cellH - 12);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + 6, y + 6, cellW - 18, 2);

      ctx.fillStyle = '#4c545c';
      ctx.fillRect(x + 9, y + 12, cellW - 24, 4);
      ctx.fillRect(x + 9, y + 19, cellW - 24, 4);

      const seed = (r * 7 + c * 13) % 14;
      if (seed === 0 || seed === 5) {
        ctx.fillStyle = '#00c4f0';
        ctx.fillRect(x + cellW - 10, y + 10, 3.5, 6);
      } else if (seed === 2 || seed === 9) {
        ctx.fillStyle = '#0284c7';
        ctx.fillRect(x + cellW - 10, y + 10, 3, 5);
      } else {
        ctx.fillStyle = '#505860';
        ctx.fillRect(x + cellW - 10, y + 10, 3, 5);
      }
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(4, Math.max(1, maxAnisotropy));
  _cachedV03StorageBayTex = tex;
  return tex;
}

let _cachedContactShadowTex: THREE.CanvasTexture | null = null;
/**
 * 15) 机柜底部真实接触阴影贴图 (Soft radial black contact shadow decal)
 */
export function createContactShadowTexture(): THREE.CanvasTexture {
  if (_cachedContactShadowTex) return _cachedContactShadowTex;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(128, 128, 12, 128, 128, 126);
  grad.addColorStop(0.0, 'rgba(0, 0, 0, 0.92)');
  grad.addColorStop(0.45, 'rgba(0, 0, 0, 0.68)');
  grad.addColorStop(0.76, 'rgba(0, 0, 0, 0.24)');
  grad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  _cachedContactShadowTex = tex;
  return tex;
}




