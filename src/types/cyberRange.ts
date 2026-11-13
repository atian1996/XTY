export type ZoneId =
  | 'ai-access'
  | 'inference'
  | 'agent'
  | 'knowledge'
  | 'compute'
  | 'ops'
  | 'net';

export type SandboxVersion = '0.1' | '0.2' | '0.3' | '0.4' | '0.5';

export type V02IconType =
  | 'cloud'
  | 'signal'
  | 'chip'
  | 'brain'
  | 'database'
  | 'gpu'
  | 'wrench';

export type V02DioramaType =
  | 'cloud-racks'
  | 'signal-tower'
  | 'monolith-racks'
  | 'holo-brain'
  | 'db-drums'
  | 'gpu-cubes'
  | 'ops-monitors';

export type DeviceArchetype = 'rack' | 'blade' | 'core' | 'tower' | 'console';

export type ChallengeState = 'idle' | 'attacking' | 'solved';

export interface Challenge {
  id: string;
  zoneId: ZoneId;
  name: string;
  archetype: DeviceArchetype;
  points: number;
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Insane';
  description: string;
  state: ChallengeState;
  activeAttacker?: string;
  activeAttempts: number;
  totalAttempts: number;
  solvedBy?: string;
  solveCount: number;
  firstBlood: boolean;
  lastEventAt: number;
}

export interface ZoneConfig {
  id: ZoneId;
  name: string;
  shortName: string;
  color: number;
  colorHex: string;
  thetaDeg: number;
  theta: number; // radians from +Z toward +X
  position: [number, number, number];
  // v0.2 reference design overrides (symmetrical layout, color, icon, diorama)
  v02Position: [number, number, number];
  v02Theta: number;
  v02Color: number;
  v02ColorHex: string;
  v02Icon: V02IconType;
  v02Diorama: V02DioramaType;
  totalScore: number;
  score: number;
  threats: number;
  archetypes: DeviceArchetype[];
  description: string;
  challenges: Challenge[];
}

export interface Team {
  id: string;
  name: string;
  color: string;
  colorNum: number;
  score: number;
  solvedCount: number;
  firstBloods: number;
  orbitIndex: 0 | 1 | 2;
  angle: number;
}

export interface BattleEvent {
  id: string;
  timestamp: string;
  type: 'attempt' | 'failed' | 'solved' | 'firstBlood';
  teamName: string;
  teamColor: string;
  challengeId: string;
  challengeName: string;
  zoneId: ZoneId;
  zoneName: string;
  points?: number;
}

export type CameraMode = 'topology' | 'panorama';

export interface HoveredNodeInfo {
  challenge: Challenge;
  zoneName: string;
  zoneColor: string;
  screenX: number;
  screenY: number;
}

export interface SelectedNodeInfo {
  challenge: Challenge;
  zoneName: string;
  zoneColor: string;
  screenX: number;
  screenY: number;
}

export interface AttackFollowBannerInfo {
  teamName: string;
  teamColor: string;
  challengeId: string;
  challengeName: string;
  zoneName: string;
  isFirstBlood: boolean;
  points: number;
}

export const STATE_COLOR = {
  idle: 0x00d4ff,
  attacking: 0xff6b35,
  failed: 0xff3b5c,
  solved: 0x00ff88,
  firstBlood: 0xffd24a,
} as const;

export const STATE_COLOR_HEX = {
  idle: '#00d4ff',
  attacking: '#ff6b35',
  failed: '#ff3b5c',
  solved: '#00ff88',
  firstBlood: '#ffd24a',
} as const;

export const INITIAL_TEAMS: Team[] = [
  { id: 't1', name: '天枢安全战队', color: '#00d4ff', colorNum: 0x00d4ff, score: 2850, solvedCount: 5, firstBloods: 2, orbitIndex: 0, angle: 0.2 },
  { id: 't2', name: '网络护卫队', color: '#ff6b35', colorNum: 0xff6b35, score: 2400, solvedCount: 4, firstBloods: 1, orbitIndex: 0, angle: 1.1 },
  { id: 't3', name: '长城守夜人', color: '#00ff88', colorNum: 0x00ff88, score: 2150, solvedCount: 4, firstBloods: 1, orbitIndex: 0, angle: 2.0 },
  { id: 't4', name: '深蓝零日组', color: '#a855f7', colorNum: 0xa855f7, score: 1900, solvedCount: 3, firstBloods: 1, orbitIndex: 0, angle: 2.9 },
  { id: 't5', name: '量子矩阵实验室', color: '#f472b6', colorNum: 0xf472b6, score: 1650, solvedCount: 3, firstBloods: 0, orbitIndex: 0, angle: 3.8 },
  { id: 't6', name: '星渊红队', color: '#ffd24a', colorNum: 0xffd24a, score: 1400, solvedCount: 2, firstBloods: 1, orbitIndex: 0, angle: 4.7 },
  { id: 't7', name: '凌霄算力卫士', color: '#14e0c8', colorNum: 0x14e0c8, score: 1200, solvedCount: 2, firstBloods: 0, orbitIndex: 1, angle: 0.4 },
  { id: 't8', name: '暗影脉冲', color: '#2f8bff', colorNum: 0x2f8bff, score: 1050, solvedCount: 2, firstBloods: 0, orbitIndex: 1, angle: 1.2 },
  { id: 't9', name: '苍穹逆向联队', color: '#ff3b5c', colorNum: 0xff3b5c, score: 900, solvedCount: 1, firstBloods: 0, orbitIndex: 1, angle: 2.1 },
  { id: 't10', name: '玄武安全研究', color: '#38bdf8', colorNum: 0x38bdf8, score: 800, solvedCount: 1, firstBloods: 0, orbitIndex: 1, angle: 3.0 },
  { id: 't11', name: '极光破壁者', color: '#fb923c', colorNum: 0xfb923c, score: 750, solvedCount: 1, firstBloods: 0, orbitIndex: 1, angle: 3.9 },
  { id: 't12', name: '灵境猎手', color: '#4ade80', colorNum: 0x4ade80, score: 600, solvedCount: 1, firstBloods: 0, orbitIndex: 1, angle: 4.8 },
  { id: 't13', name: '白泽漏洞挖掘', color: '#c084fc', colorNum: 0xc084fc, score: 500, solvedCount: 1, firstBloods: 0, orbitIndex: 2, angle: 0.1 },
  { id: 't14', name: '昆仑密码学派', color: '#f43f5e', colorNum: 0xf43f5e, score: 450, solvedCount: 1, firstBloods: 0, orbitIndex: 2, angle: 0.9 },
  { id: 't15', name: '神州网安先锋', color: '#2dd4bf', colorNum: 0x2dd4bf, score: 400, solvedCount: 0, firstBloods: 0, orbitIndex: 2, angle: 1.7 },
  { id: 't16', name: '银河攻防枢纽', color: '#facc15', colorNum: 0xfacc15, score: 350, solvedCount: 0, firstBloods: 0, orbitIndex: 2, angle: 2.5 },
  { id: 't17', name: '泰山固件分析', color: '#60a5fa', colorNum: 0x60a5fa, score: 300, solvedCount: 0, firstBloods: 0, orbitIndex: 2, angle: 3.3 },
  { id: 't18', name: '北极星内核组', color: '#fb7185', colorNum: 0xfb7185, score: 250, solvedCount: 0, firstBloods: 0, orbitIndex: 2, angle: 4.1 },
  { id: 't19', name: '锋刃二进制', color: '#34d399', colorNum: 0x34d399, score: 200, solvedCount: 0, firstBloods: 0, orbitIndex: 2, angle: 4.9 },
  { id: 't20', name: '零界渗透小组', color: '#818cf8', colorNum: 0x818cf8, score: 150, solvedCount: 0, firstBloods: 0, orbitIndex: 2, angle: 5.6 },
];

const ZONE_R = 13;
function calcZonePos(deg: number): [number, number, number] {
  const rad = (deg * Math.PI) / 180;
  return [
    Number((ZONE_R * Math.sin(rad)).toFixed(2)),
    0,
    Number((ZONE_R * Math.cos(rad)).toFixed(2)),
  ];
}

export const INITIAL_ZONES: ZoneConfig[] = [
  {
    id: 'ai-access',
    name: 'AI 应用接入',
    shortName: '应用接入',
    color: 0x00d4ff,
    colorHex: '#00d4ff',
    thetaDeg: 30,
    theta: (30 * Math.PI) / 180,
    position: calcZonePos(30),
    v02Position: [-14.2, 0.35, -2.2],
    v02Theta: Math.atan2(-14.2, -2.2),
    v02Color: 0xffaa1d,
    v02ColorHex: '#ffaa1d',
    v02Icon: 'cloud',
    v02Diorama: 'cloud-racks',
    totalScore: 3000,
    score: 1100,
    threats: 1,
    archetypes: ['console', 'core'],
    description: '承载大模型 API 网关、多模态交互前端与提示词防火墙接入层',
    challenges: [
      {
        id: 'AI-01',
        zoneId: 'ai-access',
        name: '网关鉴权绕过',
        archetype: 'console',
        points: 500,
        difficulty: 'Easy',
        description: '分析 AI 接入网关 JWT 签名重放缺陷，获取高权限模型调用凭证。',
        state: 'solved',
        activeAttempts: 0,
        totalAttempts: 14,
        solvedBy: '天枢安全战队',
        solveCount: 4,
        firstBlood: true,
        lastEventAt: Date.now() - 180000,
      },
      {
        id: 'AI-02',
        zoneId: 'ai-access',
        name: '提示词注入绕过',
        archetype: 'core',
        points: 600,
        difficulty: 'Medium',
        description: '构造多语言混淆间接提示词注入 Payload，突破敏感指令审查沙箱。',
        state: 'attacking',
        activeAttacker: '网络护卫队',
        activeAttempts: 2,
        totalAttempts: 19,
        solveCount: 0,
        firstBlood: false,
        lastEventAt: Date.now() - 25000,
      },
      {
        id: 'AI-03',
        zoneId: 'ai-access',
        name: '流式响应侧信道',
        archetype: 'console',
        points: 600,
        difficulty: 'Medium',
        description: '利用 SSE 分块传输时序特征还原加密会话中的管理员系统提示词。',
        state: 'solved',
        activeAttempts: 0,
        totalAttempts: 11,
        solvedBy: '长城守夜人',
        solveCount: 2,
        firstBlood: false,
        lastEventAt: Date.now() - 95000,
      },
      {
        id: 'AI-04',
        zoneId: 'ai-access',
        name: '多模态图像隐写投毒',
        archetype: 'core',
        points: 650,
        difficulty: 'Hard',
        description: '在视觉输入张量中嵌入对抗微扰特征，触发视觉编码器越权分支。',
        state: 'idle',
        activeAttempts: 0,
        totalAttempts: 6,
        solveCount: 0,
        firstBlood: false,
        lastEventAt: 0,
      },
      {
        id: 'AI-05',
        zoneId: 'ai-access',
        name: 'OAuth 回调劫持链',
        archetype: 'console',
        points: 650,
        difficulty: 'Hard',
        description: '利用开放重定向与插件跨域通信漏洞窃取租户推理 API 密钥。',
        state: 'idle',
        activeAttempts: 0,
        totalAttempts: 4,
        solveCount: 0,
        firstBlood: false,
        lastEventAt: 0,
      },
    ],
  },
  {
    id: 'inference',
    name: '模型推理服务',
    shortName: '模型推理',
    color: 0xa855f7,
    colorHex: '#a855f7',
    thetaDeg: 80,
    theta: (80 * Math.PI) / 180,
    position: calcZonePos(80),
    v02Position: [9.6, 0.75, -11.2],
    v02Theta: Math.atan2(9.6, -11.2),
    v02Color: 0xa855f7,
    v02ColorHex: '#a855f7',
    v02Icon: 'brain',
    v02Diorama: 'holo-brain',
    totalScore: 3400,
    score: 600,
    threats: 1,
    archetypes: ['core'],
    description: '负责分布式张量并行推理引擎、权重加载器与 KV-Cache 内存池调度',
    challenges: [
      {
        id: 'INF-01',
        zoneId: 'inference',
        name: 'Safetensors 头部越界',
        archetype: 'core',
        points: 600,
        difficulty: 'Medium',
        description: '利用模型权重解析器 JSON 头部偏移量整数溢出读取进程敏感内存。',
        state: 'solved',
        activeAttempts: 0,
        totalAttempts: 16,
        solvedBy: '深蓝零日组',
        solveCount: 2,
        firstBlood: true,
        lastEventAt: Date.now() - 210000,
      },
      {
        id: 'INF-02',
        zoneId: 'inference',
        name: 'KV-Cache 跨租户残留',
        archetype: 'core',
        points: 700,
        difficulty: 'Hard',
        description: '通过分页注意力机制未清零物理块复现相邻会话的私密上下文。',
        state: 'attacking',
        activeAttacker: '天枢安全战队',
        activeAttempts: 1,
        totalAttempts: 12,
        solveCount: 0,
        firstBlood: false,
        lastEventAt: Date.now() - 15000,
      },
      {
        id: 'INF-03',
        zoneId: 'inference',
        name: 'LoRA 适配器后门提取',
        archetype: 'core',
        points: 650,
        difficulty: 'Medium',
        description: '逆向分析低秩微调矩阵奇异值分布，定位隐藏触发词与内置 Flag。',
        state: 'idle',
        activeAttempts: 0,
        totalAttempts: 8,
        solveCount: 0,
        firstBlood: false,
        lastEventAt: 0,
      },
      {
        id: 'INF-04',
        zoneId: 'inference',
        name: 'Triton 算子栈溢出',
        archetype: 'core',
        points: 750,
        difficulty: 'Insane',
        description: '利用自定义融合算子边界检查缺失覆写推理工作线程返回地址。',
        state: 'idle',
        activeAttempts: 0,
        totalAttempts: 3,
        solveCount: 0,
        firstBlood: false,
        lastEventAt: 0,
      },
      {
        id: 'INF-05',
        zoneId: 'inference',
        name: '模型量化梯度反演',
        archetype: 'core',
        points: 700,
        difficulty: 'Hard',
        description: '结合 INT4 对称量化舍入误差与对数概率输出重建训练敏感样本。',
        state: 'idle',
        activeAttempts: 0,
        totalAttempts: 5,
        solveCount: 0,
        firstBlood: false,
        lastEventAt: 0,
      },
    ],
  },
  {
    id: 'agent',
    name: '智能体编排调用',
    shortName: '智能体编排',
    color: 0xf472b6,
    colorHex: '#f472b6',
    thetaDeg: 130,
    theta: (130 * Math.PI) / 180,
    position: calcZonePos(130),
    v02Position: [0, 1.05, -14.2],
    v02Theta: Math.PI,
    v02Color: 0x00d4ff,
    v02ColorHex: '#00d4ff',
    v02Icon: 'chip',
    v02Diorama: 'monolith-racks',
    totalScore: 3200,
    score: 550,
    threats: 0,
    archetypes: ['console'],
    description: '承载多 Agent 协同工作流、Function Calling 工具沙箱与代码解释器',
    challenges: [
      {
        id: 'AGT-01',
        zoneId: 'agent',
        name: '工具调用 SSRF 穿透',
        archetype: 'console',
        points: 550,
        difficulty: 'Easy',
        description: '诱导网页检索插件请求算力集群内部元数据服务获取临时凭据。',
        state: 'solved',
        activeAttempts: 0,
        totalAttempts: 20,
        solvedBy: '星渊红队',
        solveCount: 3,
        firstBlood: true,
        lastEventAt: Date.now() - 320000,
      },
      {
        id: 'AGT-02',
        zoneId: 'agent',
        name: 'Python 沙箱逃逸',
        archetype: 'console',
        points: 650,
        difficulty: 'Medium',
        description: '绕过 AST 语法树白名单审计，通过内省对象链执行宿主机命令。',
        state: 'idle',
        activeAttempts: 0,
        totalAttempts: 9,
        solveCount: 0,
        firstBlood: false,
        lastEventAt: 0,
      },
      {
        id: 'AGT-03',
        zoneId: 'agent',
        name: 'MCP 协议反序列化',
        archetype: 'console',
        points: 650,
        difficulty: 'Hard',
        description: '伪造上下文传输协议扩展字段触发工具宿主节点远程代码执行。',
        state: 'idle',
        activeAttempts: 0,
        totalAttempts: 7,
        solveCount: 0,
        firstBlood: false,
        lastEventAt: 0,
      },
      {
        id: 'AGT-04',
        zoneId: 'agent',
        name: '多智能体信任链污染',
        archetype: 'console',
        points: 650,
        difficulty: 'Hard',
        description: '篡改低权限检索 Agent 返回摘要，劫持上游决策 Agent 审批流。',
        state: 'idle',
        activeAttempts: 0,
        totalAttempts: 5,
        solveCount: 0,
        firstBlood: false,
        lastEventAt: 0,
      },
      {
        id: 'AGT-05',
        zoneId: 'agent',
        name: '工作流 DAG 循环耗尽',
        archetype: 'console',
        points: 700,
        difficulty: 'Hard',
        description: '构造自指涉任务图触发异常处理竞争条件，导出编排引擎密钥。',
        state: 'idle',
        activeAttempts: 0,
        totalAttempts: 2,
        solveCount: 0,
        firstBlood: false,
        lastEventAt: 0,
      },
    ],
  },
  {
    id: 'knowledge',
    name: 'AI 知识库与数据存储',
    shortName: 'AI 知识库',
    color: 0x14e0c8,
    colorHex: '#14e0c8',
    thetaDeg: 180,
    theta: Math.PI,
    position: calcZonePos(180),
    v02Position: [14.2, 0.35, -2.2],
    v02Theta: Math.atan2(14.2, -2.2),
    v02Color: 0x10e8b2,
    v02ColorHex: '#10e8b2',
    v02Icon: 'database',
    v02Diorama: 'db-drums',
    totalScore: 3100,
    score: 1150,
    threats: 1,
    archetypes: ['rack'],
    description: '管理 RAG 向量数据库、高维索引切片、对象存储桶与语料清洗流水线',
    challenges: [
      {
        id: 'KDB-01',
        zoneId: 'knowledge',
        name: '向量近似检索越权',
        archetype: 'rack',
        points: 550,
        difficulty: 'Easy',
        description: '利用 HNSW 图索引过滤谓词后置缺陷，枚举高密级命名空间向量。',
        state: 'solved',
        activeAttempts: 0,
        totalAttempts: 15,
        solvedBy: '量子矩阵实验室',
        solveCount: 3,
        firstBlood: false,
        lastEventAt: Date.now() - 260000,
      },
      {
        id: 'KDB-02',
        zoneId: 'knowledge',
        name: 'Embedding 逆向还原',
        archetype: 'rack',
        points: 600,
        difficulty: 'Medium',
        description: '训练投射解码器从 1536 维浮点向量精确恢复原始机密语料 Flag。',
        state: 'solved',
        activeAttempts: 0,
        totalAttempts: 13,
        solvedBy: '天枢安全战队',
        solveCount: 2,
        firstBlood: true,
        lastEventAt: Date.now() - 140000,
      },
      {
        id: 'KDB-03',
        zoneId: 'knowledge',
        name: '知识图谱 Cypher 注入',
        archetype: 'rack',
        points: 650,
        difficulty: 'Medium',
        description: '通过实体关系抽取接口注入图查询语句，遍历全库隐藏管理节点。',
        state: 'attacking',
        activeAttacker: '长城守夜人',
        activeAttempts: 1,
        totalAttempts: 10,
        solveCount: 0,
        firstBlood: false,
        lastEventAt: Date.now() - 19000,
      },
      {
        id: 'KDB-04',
        zoneId: 'knowledge',
        name: '预签名对象桶遍历',
        archetype: 'rack',
        points: 650,
        difficulty: 'Hard',
        description: '破解自定义 HMAC 时间戳种子算法，伪造任意训练快照下载链接。',
        state: 'idle',
        activeAttempts: 0,
        totalAttempts: 6,
        solveCount: 0,
        firstBlood: false,
        lastEventAt: 0,
      },
      {
        id: 'KDB-05',
        zoneId: 'knowledge',
        name: '文档解析器 XXE 盲注',
        archetype: 'rack',
        points: 650,
        difficulty: 'Hard',
        description: '上传特制 DOCX 知识切片触发语料清洗服务外部实体带外数据回传。',
        state: 'idle',
        activeAttempts: 0,
        totalAttempts: 4,
        solveCount: 0,
        firstBlood: false,
        lastEventAt: 0,
      },
    ],
  },
  {
    id: 'compute',
    name: '算力调度',
    shortName: '算力调度',
    color: 0xffb020,
    colorHex: '#ffb020',
    thetaDeg: 230,
    theta: (230 * Math.PI) / 180,
    position: calcZonePos(230),
    v02Position: [10.8, 0.1, 7.6],
    v02Theta: Math.atan2(10.8, 7.6),
    v02Color: 0x00f59b,
    v02ColorHex: '#00f59b',
    v02Icon: 'gpu',
    v02Diorama: 'gpu-cubes',
    totalScore: 3500,
    score: 650,
    threats: 0,
    archetypes: ['blade'],
    description: '统筹 GPU 刀片阵列、Slurm/K8s 异构算力池、CUDA 容器虚拟化与显存隔离',
    challenges: [
      {
        id: 'CMP-01',
        zoneId: 'compute',
        name: 'NVIDIA 容器挂载逃逸',
        archetype: 'blade',
        points: 650,
        difficulty: 'Medium',
        description: '利用驱动运行时设备节点符号链接竞争，在算力宿主机植入探针。',
        state: 'solved',
        activeAttempts: 0,
        totalAttempts: 14,
        solvedBy: '网络护卫队',
        solveCount: 2,
        firstBlood: true,
        lastEventAt: Date.now() - 290000,
      },
      {
        id: 'CMP-02',
        zoneId: 'compute',
        name: 'MIG 显存切片越界',
        archetype: 'blade',
        points: 700,
        difficulty: 'Hard',
        description: '通过 DMA 异步拷贝描述符篡改突破多实例 GPU 物理地址边界。',
        state: 'idle',
        activeAttempts: 0,
        totalAttempts: 8,
        solveCount: 0,
        firstBlood: false,
        lastEventAt: 0,
      },
      {
        id: 'CMP-03',
        zoneId: 'compute',
        name: 'Slurm 作业脚本提权',
        archetype: 'blade',
        points: 700,
        difficulty: 'Hard',
        description: '利用超算调度器 Epilog 环境变量注入以 Root 权限执行回收脚本。',
        state: 'idle',
        activeAttempts: 0,
        totalAttempts: 5,
        solveCount: 0,
        firstBlood: false,
        lastEventAt: 0,
      },
      {
        id: 'CMP-04',
        zoneId: 'compute',
        name: 'RDMA 共享内存窃听',
        archetype: 'blade',
        points: 750,
        difficulty: 'Insane',
        description: '预测 RoCEv2 内存区域注册密钥 MKey，远程直接读取邻近节点张量。',
        state: 'idle',
        activeAttempts: 0,
        totalAttempts: 3,
        solveCount: 0,
        firstBlood: false,
        lastEventAt: 0,
      },
      {
        id: 'CMP-05',
        zoneId: 'compute',
        name: '算力配额旁路伪造',
        archetype: 'blade',
        points: 700,
        difficulty: 'Hard',
        description: '逆向调度中心 gRPC 计量签名算法，无限申请 A100 独占推理实例。',
        state: 'idle',
        activeAttempts: 0,
        totalAttempts: 4,
        solveCount: 0,
        firstBlood: false,
        lastEventAt: 0,
      },
    ],
  },
  {
    id: 'ops',
    name: '运维保障',
    shortName: '运维保障',
    color: 0x00ff88,
    colorHex: '#00ff88',
    thetaDeg: 280,
    theta: (280 * Math.PI) / 180,
    position: calcZonePos(280),
    v02Position: [-10.8, 0.1, 7.6],
    v02Theta: Math.atan2(-10.8, 7.6),
    v02Color: 0xff4d5e,
    v02ColorHex: '#ff4d5e',
    v02Icon: 'wrench',
    v02Diorama: 'ops-monitors',
    totalScore: 3100,
    score: 500,
    threats: 1,
    archetypes: ['rack', 'tower'],
    description: '覆盖带外管理 BMC/IPMI、堡垒机审计、镜像仓库签名与遥测监控中枢',
    challenges: [
      {
        id: 'OPS-01',
        zoneId: 'ops',
        name: 'IPMI 2.0 哈希离线破解',
        archetype: 'rack',
        points: 500,
        difficulty: 'Easy',
        description: '利用 RAKP 握手协议设计缺陷获取带外管理控制器管理员盐值哈希。',
        state: 'solved',
        activeAttempts: 0,
        totalAttempts: 18,
        solvedBy: '凌霄算力卫士',
        solveCount: 5,
        firstBlood: false,
        lastEventAt: Date.now() - 360000,
      },
      {
        id: 'OPS-02',
        zoneId: 'ops',
        name: 'Harbor 镜像层密钥残留',
        archetype: 'rack',
        points: 600,
        difficulty: 'Medium',
        description: '回溯私有算力基础镜像历史构建层，提取被覆盖的集群运维私钥。',
        state: 'attacking',
        activeAttacker: '深蓝零日组',
        activeAttempts: 1,
        totalAttempts: 9,
        solveCount: 0,
        firstBlood: false,
        lastEventAt: Date.now() - 12000,
      },
      {
        id: 'OPS-03',
        zoneId: 'ops',
        name: 'Prometheus 联邦注入',
        archetype: 'tower',
        points: 650,
        difficulty: 'Medium',
        description: '伪造监控指标采集端点，通过告警模板渲染漏洞执行远程指令。',
        state: 'idle',
        activeAttempts: 0,
        totalAttempts: 7,
        solveCount: 0,
        firstBlood: false,
        lastEventAt: 0,
      },
      {
        id: 'OPS-04',
        zoneId: 'ops',
        name: '堡垒机录像流劫持',
        archetype: 'rack',
        points: 650,
        difficulty: 'Hard',
        description: '利用 WebSocket 会话复用校验漏洞接入正在进行的特权运维终端。',
        state: 'idle',
        activeAttempts: 0,
        totalAttempts: 4,
        solveCount: 0,
        firstBlood: false,
        lastEventAt: 0,
      },
      {
        id: 'OPS-05',
        zoneId: 'ops',
        name: 'BMC 固件签名绕过',
        archetype: 'tower',
        points: 700,
        difficulty: 'Insane',
        description: '构造 RSA-PSS 边界填充畸形固件包，在校验阶段实现持久化植根。',
        state: 'idle',
        activeAttempts: 0,
        totalAttempts: 2,
        solveCount: 0,
        firstBlood: false,
        lastEventAt: 0,
      },
    ],
  },
  {
    id: 'net',
    name: '通信网络',
    shortName: '通信网络',
    color: 0x2f8bff,
    colorHex: '#2f8bff',
    thetaDeg: 330,
    theta: (330 * Math.PI) / 180,
    position: calcZonePos(330),
    v02Position: [-9.6, 0.75, -11.2],
    v02Theta: Math.atan2(-9.6, -11.2),
    v02Color: 0x00ff9d,
    v02ColorHex: '#00ff9d',
    v02Icon: 'signal',
    v02Diorama: 'signal-tower',
    totalScore: 3100,
    score: 550,
    threats: 0,
    archetypes: ['tower'],
    description: '承载 SDN 控制平面、InfiniBand 高速交换网、BGP 边界路由与零信任网关',
    challenges: [
      {
        id: 'NET-01',
        zoneId: 'net',
        name: 'SDN 流表优先级劫持',
        archetype: 'tower',
        points: 550,
        difficulty: 'Easy',
        description: '向 OpenFlow 控制器注入高优先级流表项，镜像核心总线敏感流量。',
        state: 'solved',
        activeAttempts: 0,
        totalAttempts: 17,
        solvedBy: '暗影脉冲',
        solveCount: 3,
        firstBlood: false,
        lastEventAt: Date.now() - 400000,
      },
      {
        id: 'NET-02',
        zoneId: 'net',
        name: 'VXLAN 隧道跨网段伪造',
        archetype: 'tower',
        points: 600,
        difficulty: 'Medium',
        description: '构造特定 VNI 封装报文穿透虚拟租户网络隔离，直达管理平面。',
        state: 'idle',
        activeAttempts: 0,
        totalAttempts: 8,
        solveCount: 0,
        firstBlood: false,
        lastEventAt: 0,
      },
      {
        id: 'NET-03',
        zoneId: 'net',
        name: 'eBPF 流量探针隐匿',
        archetype: 'tower',
        points: 650,
        difficulty: 'Hard',
        description: '分析内核 XDP 过滤器字节码逻辑，构造魔术序列激活隐藏回显通道。',
        state: 'idle',
        activeAttempts: 0,
        totalAttempts: 6,
        solveCount: 0,
        firstBlood: false,
        lastEventAt: 0,
      },
      {
        id: 'NET-04',
        zoneId: 'net',
        name: 'mTLS 网格证书欺骗',
        archetype: 'tower',
        points: 650,
        difficulty: 'Hard',
        description: '利用服务网格 Sidecar SAN 名称匹配通配符缺陷冒充核心控制服务。',
        state: 'idle',
        activeAttempts: 0,
        totalAttempts: 5,
        solveCount: 0,
        firstBlood: false,
        lastEventAt: 0,
      },
      {
        id: 'NET-05',
        zoneId: 'net',
        name: 'InfiniBand 子网管理接管',
        archetype: 'tower',
        points: 650,
        difficulty: 'Hard',
        description: '重放 SMP 子网管理数据包赢得主控竞选，重绘全网交换拓扑路由。',
        state: 'idle',
        activeAttempts: 0,
        totalAttempts: 3,
        solveCount: 0,
        firstBlood: false,
        lastEventAt: 0,
      },
    ],
  },
];

export const CROSS_ZONE_LINKS: [ZoneId, ZoneId][] = [
  ['ai-access', 'inference'],
  ['inference', 'compute'],
  ['agent', 'knowledge'],
  ['knowledge', 'ops'],
  ['ops', 'net'],
  ['net', 'ai-access'],
];
