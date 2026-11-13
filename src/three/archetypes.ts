import * as THREE from 'three';
import {
  Challenge,
  DeviceArchetype,
  SandboxVersion,
  STATE_COLOR,
  V02DioramaType,
  ZoneId,
} from '../types/cyberRange';
import {
  createChallengeHoloLabel,
  createConsoleScreenTexture,
  createGpuFanFaceTexture,
  createRackFrontTexture,
  createV03BrushedMetalTexture,
  createV03CarbonFiberTexture,
  createV03RackFrontTexture,
  createV03StorageBayTexture,
  createV04PolishedSilverTexture,
  createV04SilverStorageBayTexture,
  createV04WhiteRackFrontTexture,
} from './textures';

export type LabelDisplayMode = 'compact' | 'full' | 'hover';

export interface ChallengeNodeUserData {
  challenge: Challenge;
  challengeId: string;
  zoneId: Challenge['zoneId'];
  zoneColorHex: string;
  state: Challenge['state'];
  archetype: DeviceArchetype;
  version: SandboxVersion;
  v01Pos: THREE.Vector3;
  v01RotY: number;
  v02Pos: THREE.Vector3;
  v02RotY: number;
  baseRing: THREE.Mesh;
  hoverRing: THREE.Mesh;
  selectRing: THREE.Mesh;
  body: THREE.Mesh; // Simplified collision proxy for fast Raycasting
  detailGroup: THREE.Group; // v0.1 High-detail 16~24 part industrial 3D model
  v02DetailGroup: THREE.Group; // v0.2 Reference design specialized 3D hardware model
  v03DetailGroup: THREE.Group; // v0.3 Hyper-realistic dark titanium, carbon fiber & matte black kitbash hardware
  v04DetailGroup: THREE.Group; // v0.4 Futuristic tactical sandbox hardware (polished silver, frosted white ceramic, transparent acrylic glass)
  statusMat: THREE.MeshStandardMaterial; // Emissive trim material driven by state color
  beacon: THREE.Mesh;
  scanRing: THREE.Mesh;
  firstBloodCrown: THREE.Group;
  label: THREE.Sprite;
  fxAnchor: THREE.Object3D;
  pulsePhase: number;
  hovered: boolean;
  selected: boolean;
  labelMode: LabelDisplayMode;
  targetScale: number;
  currentColor: THREE.Color;
  targetColor: THREE.Color;
  colorLerpTimer: number;
  colorLerpDuration: number;
  failFlashTimer: number;
  labelFlipTimer: number;
  solveBurstTimer: number;
  compressTimer: number;
  stepDynamicTexture?: (dt: number, elapsed: number) => void;
  stepV02Dynamic?: (dt: number, elapsed: number) => void;
  setHover: (hover: boolean) => void;
  setSelected: (sel: boolean) => void;
  setLabelMode: (mode: LabelDisplayMode) => void;
  setVersion: (version: SandboxVersion) => void;
  flashFail: (attempts: number) => void;
  transitionState: (
    nextState: Challenge['state'],
    payload?: { team?: string; firstBlood?: boolean }
  ) => void;
}

const _dummyObj = new THREE.Object3D();
const _v03FailedFlashColor = new THREE.Color(STATE_COLOR.failed);

export interface V03StyleMaterialSet {
  matteBlackMat: THREE.Material;
  carbonFiberMat: THREE.Material;
  brushedTitaniumMat: THREE.Material;
  darkTitaniumMat: THREE.Material;
  metalEdgeRimMat: THREE.LineBasicMaterial;
  pureCyanGlowMat: THREE.MeshStandardMaterial;
  deepBlueGlowMat: THREE.MeshStandardMaterial;
  rackFrontMat: THREE.MeshStandardMaterial;
  bayFrontMat: THREE.MeshStandardMaterial;
  towerLatticeMat: THREE.MeshStandardMaterial;
  consoleScreenMat: THREE.MeshBasicMaterial;
}

export interface SharedNodePalette {
  maxAnisotropy: number;
  getBeveledBox: (w: number, h: number, d: number, bevel?: number) => THREE.BufferGeometry;
  getBox: (w: number, h: number, d: number) => THREE.BufferGeometry;
  getBoxEdges: (w: number, h: number, d: number) => THREE.BufferGeometry;
  proxyMat: THREE.MeshBasicMaterial;
  // Shared wrapper geometries/materials
  baseRingGeo: THREE.RingGeometry;
  hoverRingGeo: THREE.RingGeometry;
  hoverRingMat: THREE.MeshBasicMaterial;
  selectRingGeo: THREE.TorusGeometry;
  selectRingMat: THREE.MeshBasicMaterial;
  beaconGeo: THREE.CylinderGeometry;
  scanRingGeo: THREE.TorusGeometry;
  crownHexGeo: THREE.RingGeometry;
  crownHexMat: THREE.MeshBasicMaterial;
  outerGoldRingGeo: THREE.RingGeometry;
  outerGoldRingMat: THREE.MeshBasicMaterial;
  // v0.1 shared
  v01: {
    chassisDarkMat: THREE.MeshStandardMaterial;
    armorSlateMat: THREE.MeshStandardMaterial;
    brushedSilverMat: THREE.MeshStandardMaterial;
    copperHeatMat: THREE.MeshStandardMaterial;
    darkGlassMat: THREE.MeshStandardMaterial;
    finMat: THREE.MeshStandardMaterial;
    crystalCageMat: THREE.MeshStandardMaterial;
    rackFrontPool: { mat: THREE.MeshStandardMaterial; stepLights: () => void }[];
    zoneAccentByColor: Map<number, THREE.MeshStandardMaterial>;
    kbMatByColor: Map<number, THREE.MeshStandardMaterial>;
    consoleScreenByHex: Map<string, { mat: THREE.MeshBasicMaterial; tex: THREE.CanvasTexture }>;
  };
  // v0.2 shared
  v02: {
    darkArmorMat: THREE.MeshStandardMaterial;
    slateTrimMat: THREE.MeshStandardMaterial;
    cyanGlowMat: THREE.MeshStandardMaterial;
    towerWireMat: THREE.MeshBasicMaterial;
    lobeMat: THREE.MeshStandardMaterial;
    cortexWireMat: THREE.MeshBasicMaterial;
    holoCubeMat: THREE.MeshStandardMaterial;
    holoEdgeMat: THREE.LineBasicMaterial;
    fanFaceMat: THREE.MeshStandardMaterial;
    opsScreenMat: THREE.MeshBasicMaterial;
    opsScreenTex: THREE.CanvasTexture;
    rackFrontPool: THREE.MeshStandardMaterial[];
    zoneGlowByColor: Map<number, THREE.MeshStandardMaterial>;
  };
  // v0.3 & v0.4 shared
  v03: V03StyleMaterialSet;
  v04: V03StyleMaterialSet;
}

function buildBeveledBoxGeometryRaw(w: number, h: number, d: number, bevel = 0.04): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  const hw = w / 2 - bevel;
  const hh = h / 2 - bevel;
  shape.moveTo(-hw, -hh);
  shape.lineTo(hw, -hh);
  shape.lineTo(hw, hh);
  shape.lineTo(-hw, hh);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: d - bevel * 2,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: bevel,
    bevelThickness: bevel,
  });
  geo.center();
  return geo;
}

export function createSharedNodePalette(maxAnisotropy = 4): SharedNodePalette {
  const safeAniso = Math.min(4, Math.max(1, maxAnisotropy));
  const beveledBoxCache = new Map<string, THREE.BufferGeometry>();
  const boxCache = new Map<string, THREE.BufferGeometry>();
  const edgesCache = new Map<string, THREE.BufferGeometry>();

  const getBeveledBox = (w: number, h: number, d: number, bevel = 0.04) => {
    const key = `${w.toFixed(3)}_${h.toFixed(3)}_${d.toFixed(3)}_${bevel.toFixed(3)}`;
    let g = beveledBoxCache.get(key);
    if (!g) {
      g = buildBeveledBoxGeometryRaw(w, h, d, bevel);
      beveledBoxCache.set(key, g);
    }
    return g;
  };

  const getBox = (w: number, h: number, d: number) => {
    const key = `${w.toFixed(3)}_${h.toFixed(3)}_${d.toFixed(3)}`;
    let g = boxCache.get(key);
    if (!g) {
      g = new THREE.BoxGeometry(w, h, d);
      boxCache.set(key, g);
    }
    return g;
  };

  const getBoxEdges = (w: number, h: number, d: number) => {
    const key = `${w.toFixed(3)}_${h.toFixed(3)}_${d.toFixed(3)}`;
    let g = edgesCache.get(key);
    if (!g) {
      g = new THREE.EdgesGeometry(getBox(w, h, d));
      edgesCache.set(key, g);
    }
    return g;
  };

  // Pre-build 2 pooled rack textures for v0.1 & v0.2
  const rackTex0 = createRackFrontTexture(safeAniso);
  const rackTex1 = createRackFrontTexture(safeAniso);

  const v01RackPool = [rackTex0, rackTex1].map(({ texture, stepLights }) => ({
    mat: new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.24,
      metalness: 0.82,
      emissive: new THREE.Color(0x132742),
      emissiveMap: texture,
      emissiveIntensity: 0.36,
      envMapIntensity: 2.2,
    }),
    stepLights,
  }));

  const v02RackPool = [rackTex0, rackTex1].map(
    ({ texture }) =>
      new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.22,
        metalness: 0.84,
        emissive: new THREE.Color(0x0066a8),
        emissiveMap: texture,
        emissiveIntensity: 0.48,
        envMapIntensity: 2.25,
      })
  );

  const v02OpsTex = createConsoleScreenTexture('#00d4ff', safeAniso);
  const v02FanTex = createGpuFanFaceTexture(safeAniso);

  const v03BrushedTex = createV03BrushedMetalTexture(safeAniso);
  const v03CarbonTex = createV03CarbonFiberTexture(safeAniso);
  const v03RackTex = createV03RackFrontTexture(safeAniso);
  const v03BayTex = createV03StorageBayTexture(safeAniso);
  const v03ConsoleTex = createConsoleScreenTexture('#00a8d6', safeAniso);

  const v04SilverTex = createV04PolishedSilverTexture(safeAniso);
  const v04RackTex = createV04WhiteRackFrontTexture(safeAniso);
  const v04BayTex = createV04SilverStorageBayTexture(safeAniso);

  return {
    maxAnisotropy: safeAniso,
    getBeveledBox,
    getBox,
    getBoxEdges,
    proxyMat: new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
    }),
    baseRingGeo: new THREE.RingGeometry(0.88, 0.98, 48),
    hoverRingGeo: new THREE.RingGeometry(1.06, 1.15, 48),
    hoverRingMat: new THREE.MeshBasicMaterial({
      color: 0xe2e8f0,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
    selectRingGeo: new THREE.TorusGeometry(1.22, 0.03, 8, 48),
    selectRingMat: new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    }),
    beaconGeo: new THREE.CylinderGeometry(0.08, 0.02, 3.8, 12, 1, true),
    scanRingGeo: new THREE.TorusGeometry(0.98, 0.022, 8, 48),
    crownHexGeo: new THREE.RingGeometry(0.24, 0.35, 6),
    crownHexMat: new THREE.MeshBasicMaterial({
      color: STATE_COLOR.firstBlood,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
    }),
    outerGoldRingGeo: new THREE.RingGeometry(1.04, 1.1, 6),
    outerGoldRingMat: new THREE.MeshBasicMaterial({
      color: STATE_COLOR.firstBlood,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    }),
    v01: {
      chassisDarkMat: new THREE.MeshStandardMaterial({
        color: 0x42556e,
        metalness: 0.90,
        roughness: 0.19,
        envMapIntensity: 2.45,
      }),
      armorSlateMat: new THREE.MeshStandardMaterial({
        color: 0x5c728f,
        metalness: 0.88,
        roughness: 0.21,
        envMapIntensity: 2.4,
      }),
      brushedSilverMat: new THREE.MeshStandardMaterial({
        color: 0x8ea6c4,
        metalness: 0.95,
        roughness: 0.13,
        envMapIntensity: 2.7,
      }),
      copperHeatMat: new THREE.MeshStandardMaterial({
        color: 0xd97706,
        metalness: 0.88,
        roughness: 0.20,
        envMapIntensity: 2.2,
      }),
      darkGlassMat: new THREE.MeshStandardMaterial({
        color: 0x17253b,
        metalness: 0.28,
        roughness: 0.08,
        transparent: true,
        opacity: 0.72,
        envMapIntensity: 2.1,
      }),
      finMat: new THREE.MeshStandardMaterial({
        color: 0x9ab0ca,
        metalness: 0.94,
        roughness: 0.14,
        envMapIntensity: 2.65,
      }),
      crystalCageMat: new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        metalness: 0.92,
        roughness: 0.14,
        wireframe: true,
      }),
      rackFrontPool: v01RackPool,
      zoneAccentByColor: new Map(),
      kbMatByColor: new Map(),
      consoleScreenByHex: new Map(),
    },
    v02: {
      darkArmorMat: new THREE.MeshStandardMaterial({
        color: 0x3b4e68,
        metalness: 0.90,
        roughness: 0.18,
        envMapIntensity: 2.45,
      }),
      slateTrimMat: new THREE.MeshStandardMaterial({
        color: 0x6c84a3,
        metalness: 0.93,
        roughness: 0.15,
        envMapIntensity: 2.6,
      }),
      cyanGlowMat: new THREE.MeshStandardMaterial({
        color: 0x00d4ff,
        emissive: 0x00b4e6,
        emissiveIntensity: 0.68,
        metalness: 0.3,
        roughness: 0.2,
      }),
      towerWireMat: new THREE.MeshBasicMaterial({
        color: 0x00d4ff,
        wireframe: true,
        transparent: true,
        opacity: 0.88,
      }),
      lobeMat: new THREE.MeshStandardMaterial({
        color: 0x6366f1,
        emissive: 0x3b82f6,
        emissiveIntensity: 0.58,
        roughness: 0.2,
        metalness: 0.15,
        transparent: true,
        opacity: 0.88,
      }),
      cortexWireMat: new THREE.MeshBasicMaterial({
        color: 0x93c5fd,
        wireframe: true,
        transparent: true,
        opacity: 0.62,
      }),
      holoCubeMat: new THREE.MeshStandardMaterial({
        color: 0x00d4ff,
        emissive: 0x0099dd,
        emissiveIntensity: 0.42,
        transparent: true,
        opacity: 0.65,
        roughness: 0.15,
        metalness: 0.15,
      }),
      holoEdgeMat: new THREE.LineBasicMaterial({ color: 0x7dd3fc }),
      fanFaceMat: new THREE.MeshStandardMaterial({
        map: v02FanTex,
        emissive: new THREE.Color(0x00c8f0),
        emissiveMap: v02FanTex,
        emissiveIntensity: 0.62,
        roughness: 0.22,
        metalness: 0.72,
      }),
      opsScreenTex: v02OpsTex,
      opsScreenMat: new THREE.MeshBasicMaterial({ map: v02OpsTex }),
      rackFrontPool: v02RackPool,
      zoneGlowByColor: new Map(),
    },
    v03: {
      matteBlackMat: new THREE.MeshStandardMaterial({
        color: 0x465970,
        map: v03BrushedTex,
        bumpMap: v03BrushedTex,
        bumpScale: 0.014,
        metalness: 0.91,
        roughness: 0.18,
        envMapIntensity: 2.65,
      }),
      carbonFiberMat: new THREE.MeshStandardMaterial({
        color: 0x526782,
        map: v03CarbonTex,
        bumpMap: v03CarbonTex,
        bumpScale: 0.015,
        metalness: 0.88,
        roughness: 0.16,
        envMapIntensity: 2.55,
      }),
      brushedTitaniumMat: new THREE.MeshStandardMaterial({
        color: 0x94adc9,
        map: v03BrushedTex,
        bumpMap: v03BrushedTex,
        bumpScale: 0.01,
        metalness: 0.96,
        roughness: 0.11,
        envMapIntensity: 2.9,
      }),
      darkTitaniumMat: new THREE.MeshStandardMaterial({
        color: 0x627894,
        map: v03BrushedTex,
        bumpMap: v03BrushedTex,
        bumpScale: 0.011,
        metalness: 0.93,
        roughness: 0.16,
        envMapIntensity: 2.6,
      }),
      metalEdgeRimMat: new THREE.LineBasicMaterial({
        color: 0x9beeff,
        transparent: true,
        opacity: 0.9,
      }),
      pureCyanGlowMat: new THREE.MeshStandardMaterial({
        color: 0x00b4d8,
        emissive: 0x0096c7,
        emissiveIntensity: 0.72,
        roughness: 0.18,
      }),
      deepBlueGlowMat: new THREE.MeshStandardMaterial({
        color: 0x0ea5e9,
        emissive: 0x0284c7,
        emissiveIntensity: 0.58,
        roughness: 0.2,
      }),
      rackFrontMat: new THREE.MeshStandardMaterial({
        map: v03RackTex,
        bumpMap: v03RackTex,
        bumpScale: 0.01,
        roughness: 0.22,
        metalness: 0.86,
        emissive: new THREE.Color(0x071a2e),
        emissiveMap: v03RackTex,
        emissiveIntensity: 0.36,
        envMapIntensity: 2.2,
      }),
      bayFrontMat: new THREE.MeshStandardMaterial({
        map: v03BayTex,
        bumpMap: v03BayTex,
        bumpScale: 0.012,
        roughness: 0.22,
        metalness: 0.86,
        emissive: new THREE.Color(0x061b30),
        emissiveMap: v03BayTex,
        emissiveIntensity: 0.38,
        envMapIntensity: 2.2,
      }),
      towerLatticeMat: new THREE.MeshStandardMaterial({
        color: 0x647a96,
        metalness: 0.94,
        roughness: 0.15,
        wireframe: true,
      }),
      consoleScreenMat: new THREE.MeshBasicMaterial({
        map: v03ConsoleTex,
        color: 0x56b4d8,
      }),
    },
    v04: {
      matteBlackMat: new THREE.MeshStandardMaterial({
        color: 0xf4f7fb,
        roughness: 0.18,
        metalness: 0.22,
        envMapIntensity: 2.1,
      }),
      // Single-pass glossy transparent acrylic glass
      carbonFiberMat: new THREE.MeshStandardMaterial({
        color: 0xdbeafe,
        metalness: 0.16,
        roughness: 0.07,
        transparent: true,
        opacity: 0.44,
        depthWrite: false,
        envMapIntensity: 2.25,
      }),
      brushedTitaniumMat: new THREE.MeshStandardMaterial({
        color: 0xeef2f6,
        map: v04SilverTex,
        bumpMap: v04SilverTex,
        bumpScale: 0.006,
        metalness: 0.98,
        roughness: 0.08,
        envMapIntensity: 2.85,
      }),
      darkTitaniumMat: new THREE.MeshStandardMaterial({
        color: 0xd5e0ec,
        map: v04SilverTex,
        bumpMap: v04SilverTex,
        bumpScale: 0.008,
        metalness: 0.9,
        roughness: 0.15,
        envMapIntensity: 2.4,
      }),
      metalEdgeRimMat: new THREE.LineBasicMaterial({
        color: 0xbae6fd,
        transparent: true,
        opacity: 0.72,
      }),
      pureCyanGlowMat: new THREE.MeshStandardMaterial({
        color: 0x00e5ff,
        emissive: 0x00c8ff,
        emissiveIntensity: 0.95,
        roughness: 0.18,
      }),
      deepBlueGlowMat: new THREE.MeshStandardMaterial({
        color: 0x0ea5e9,
        emissive: 0x0284c7,
        emissiveIntensity: 0.85,
        roughness: 0.2,
      }),
      rackFrontMat: new THREE.MeshStandardMaterial({
        map: v04RackTex,
        bumpMap: v04RackTex,
        bumpScale: 0.01,
        roughness: 0.18,
        metalness: 0.52,
        emissive: new THREE.Color(0x0369a1),
        emissiveMap: v04RackTex,
        emissiveIntensity: 0.52,
        envMapIntensity: 2.25,
      }),
      bayFrontMat: new THREE.MeshStandardMaterial({
        map: v04BayTex,
        bumpMap: v04BayTex,
        bumpScale: 0.012,
        roughness: 0.16,
        metalness: 0.88,
        emissive: new THREE.Color(0x0284c7),
        emissiveMap: v04BayTex,
        emissiveIntensity: 0.72,
        envMapIntensity: 2.45,
      }),
      towerLatticeMat: new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        metalness: 0.94,
        roughness: 0.15,
        wireframe: true,
      }),
      consoleScreenMat: new THREE.MeshBasicMaterial({
        map: v03ConsoleTex,
        color: 0x7dd3fc,
      }),
    },
  };
}

let _defaultPalette: SharedNodePalette | null = null;
function getOrCreateDefaultPalette(maxAnisotropy: number): SharedNodePalette {
  if (!_defaultPalette) {
    _defaultPalette = createSharedNodePalette(maxAnisotropy);
  }
  return _defaultPalette;
}

/**
 * 构建五种高精度工业级算力设备原型（每种由 15~24 个精细三维部件组装而成）
 */
function buildArchetypeMeshes(
  archetype: DeviceArchetype,
  zoneColor: number,
  zoneColorHex: string,
  statusMat: THREE.MeshStandardMaterial,
  palette: SharedNodePalette
): {
  body: THREE.Mesh;
  detailGroup: THREE.Group;
  stepDynamicTexture?: (dt: number, elapsed: number) => void;
} {
  const detailGroup = new THREE.Group();
  const createBeveledBoxGeometry = palette.getBeveledBox;

  const {
    chassisDarkMat,
    armorSlateMat,
    brushedSilverMat,
    copperHeatMat,
    darkGlassMat,
  } = palette.v01;

  let zoneAccentMat = palette.v01.zoneAccentByColor.get(zoneColor);
  if (!zoneAccentMat) {
    zoneAccentMat = new THREE.MeshStandardMaterial({
      color: zoneColor,
      emissive: zoneColor,
      emissiveIntensity: 0.45,
      metalness: 0.5,
      roughness: 0.3,
    });
    palette.v01.zoneAccentByColor.set(zoneColor, zoneAccentMat);
  }

  const proxyMat = palette.proxyMat;

  if (archetype === 'rack') {
    // =========================================================================
    // 原型 A：高密数据中心服务器机柜 Rack（20+ 部件：倒角重型机架 + 8 层独立凸出刀片 + 顶部双涡轮排风扇 + 侧面散热百叶窗 + 背部 PDU 管道）
    // =========================================================================
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.32, 2.1, 1.08), proxyMat);
    body.position.y = 1.05;

    // 1. 底部四脚减震工业底座
    const basePlinth = new THREE.Mesh(
      createBeveledBoxGeometry(1.34, 0.14, 1.1, 0.03),
      armorSlateMat
    );
    basePlinth.position.y = 0.07;
    detailGroup.add(basePlinth);

    const footGeo = new THREE.BoxGeometry(0.22, 0.08, 0.22);
    [
      [-0.52, 0.04, -0.4],
      [0.52, 0.04, -0.4],
      [-0.52, 0.04, 0.4],
      [0.52, 0.04, 0.4],
    ].forEach(([fx, fy, fz]) => {
      const foot = new THREE.Mesh(footGeo, brushedSilverMat);
      foot.position.set(fx, fy, fz);
      detailGroup.add(foot);
    });

    // 2. 机柜主箱体（带正面高分辩率刀片贴图）
    const pooledRack =
      palette.v01.rackFrontPool[
        Math.floor(Math.random() * palette.v01.rackFrontPool.length)
      ];
    const frontFaceMat = pooledRack.mat;
    const stepLights = pooledRack.stepLights;
    const coreBox = new THREE.Mesh(new THREE.BoxGeometry(1.06, 1.78, 0.86), [
      chassisDarkMat,
      chassisDarkMat,
      chassisDarkMat,
      chassisDarkMat,
      frontFaceMat,
      chassisDarkMat,
    ]);
    coreBox.position.y = 1.03;
    detailGroup.add(coreBox);

    // 3. 四根重型倒角立柱导轨 + 侧翼装甲护板
    const pillarGeo = createBeveledBoxGeometry(0.12, 1.86, 0.12, 0.025);
    [
      [-0.56, 1.05, 0.44],
      [0.56, 1.05, 0.44],
      [-0.56, 1.05, -0.44],
      [0.56, 1.05, -0.44],
    ].forEach(([px, py, pz]) => {
      const p = new THREE.Mesh(pillarGeo, armorSlateMat);
      p.position.set(px, py, pz);
      detailGroup.add(p);
    });

    // 两侧竖向状态灯槽（随设备四态变色）
    const ledStripGeo = new THREE.BoxGeometry(0.03, 1.7, 0.03);
    const leftStrip = new THREE.Mesh(ledStripGeo, statusMat);
    leftStrip.position.set(-0.58, 1.05, 0.49);
    const rightStrip = new THREE.Mesh(ledStripGeo, statusMat);
    rightStrip.position.set(0.58, 1.05, 0.49);
    detailGroup.add(leftStrip, rightStrip);

    // 4. 正面 6 层物理立体服务器拉手与铝合金面板框
    const handleGeo = new THREE.BoxGeometry(0.92, 0.045, 0.06);
    const earGeo = new THREE.BoxGeometry(0.05, 0.14, 0.08);
    for (let i = 0; i < 6; i++) {
      const by = 0.3 + i * 0.28;
      const bar = new THREE.Mesh(handleGeo, brushedSilverMat);
      bar.position.set(0, by, 0.46);
      const earL = new THREE.Mesh(earGeo, copperHeatMat);
      earL.position.set(-0.44, by, 0.46);
      const earR = new THREE.Mesh(earGeo, copperHeatMat);
      earR.position.set(0.44, by, 0.46);
      detailGroup.add(bar, earL, earR);
    }

    // 5. 两侧散热百叶窗格栅 + 背部铜制热管
    const louverGeo = new THREE.BoxGeometry(0.05, 0.08, 0.68);
    for (let i = 0; i < 5; i++) {
      const ly = 0.42 + i * 0.3;
      const lvL = new THREE.Mesh(louverGeo, brushedSilverMat);
      lvL.position.set(-0.55, ly, 0);
      const lvR = new THREE.Mesh(louverGeo, brushedSilverMat);
      lvR.position.set(0.55, ly, 0);
      detailGroup.add(lvL, lvR);
    }

    // 6. 顶盖装甲 + 双散热涡轮风扇组件
    const roofCap = new THREE.Mesh(
      createBeveledBoxGeometry(1.26, 0.12, 1.0, 0.03),
      armorSlateMat
    );
    roofCap.position.y = 1.98;
    detailGroup.add(roofCap);

    const fanRotors: THREE.Group[] = [];
    [-0.3, 0.3].forEach((fx) => {
      const fanHousing = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.24, 0.08, 16),
        brushedSilverMat
      );
      fanHousing.position.set(fx, 2.06, 0);
      const rotor = new THREE.Group();
      rotor.position.set(fx, 2.08, 0);
      const bladeA = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.02, 0.06), zoneAccentMat);
      const bladeB = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.36), zoneAccentMat);
      rotor.add(bladeA, bladeB);
      fanRotors.push(rotor);
      detailGroup.add(fanHousing, rotor);
    });

    let accum = 0;
    return {
      body,
      detailGroup,
      stepDynamicTexture: (dt: number) => {
        fanRotors.forEach((r) => {
          r.rotation.y += dt * 6.5;
        });
        accum += dt;
        if (accum > 0.18) {
          accum = 0;
          stepLights();
        }
      },
    };
  }

  if (archetype === 'blade') {
    // =========================================================================
    // 原型 B：液冷异构 GPU 算力刀片集群 Blade（22+ 部件：重型底座 + 双排 16 片精密散热鳍片 + 4 颗 SXM GPU 核心模组 + 铜制液冷歧管 + 状态数显屏）
    // =========================================================================
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.85, 1.25, 1.35), proxyMat);
    body.position.y = 0.62;

    // 1. 底部导轨托盘与四角液压支座
    const lowerHull = new THREE.Mesh(
      createBeveledBoxGeometry(1.8, 0.22, 1.28, 0.04),
      chassisDarkMat
    );
    lowerHull.position.y = 0.14;
    detailGroup.add(lowerHull);

    // 2. 中层主算力刀片舱
    const midDeck = new THREE.Mesh(
      createBeveledBoxGeometry(1.64, 0.42, 1.12, 0.04),
      armorSlateMat
    );
    midDeck.position.y = 0.46;
    detailGroup.add(midDeck);

    // 3. 顶部双阵列 16 片精密金属散热鳍片 (InstancedMesh)
    const finGeo = palette.getBox(1.48, 0.22, 0.025);
    const finMat = palette.v01.finMat;
    const fins = new THREE.InstancedMesh(finGeo, finMat, 16);
    for (let i = 0; i < 16; i++) {
      const zOffset = -0.44 + (i / 15) * 0.88;
      _dummyObj.position.set(0, 0.76, zOffset);
      _dummyObj.rotation.set(0, 0, 0);
      _dummyObj.scale.set(1, 1, 1);
      _dummyObj.updateMatrix();
      fins.setMatrixAt(i, _dummyObj.matrix);
    }
    fins.instanceMatrix.needsUpdate = true;
    fins.computeBoundingSphere();
    detailGroup.add(fins);

    // 4. 顶部 4 颗凸出式 SXM 张量计算核 + 发光 NVLink 桥接器
    const gpuCores: THREE.Mesh[] = [];
    const gpuPositions = [
      [-0.42, 0.94, -0.22],
      [0.42, 0.94, -0.22],
      [-0.42, 0.94, 0.22],
      [0.42, 0.94, 0.22],
    ];
    gpuPositions.forEach(([gx, gy, gz]) => {
      const socket = new THREE.Mesh(
        createBeveledBoxGeometry(0.56, 0.14, 0.34, 0.02),
        brushedSilverMat
      );
      socket.position.set(gx, gy, gz);
      const die = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.2), statusMat);
      die.position.set(gx, gy + 0.06, gz);
      gpuCores.push(die);
      detailGroup.add(socket, die);
    });

    // 5. 两侧铜制液冷分配歧管与弯头
    const pipeGeo = new THREE.CylinderGeometry(0.055, 0.055, 1.56, 12);
    pipeGeo.rotateZ(Math.PI / 2);
    const pipeFront = new THREE.Mesh(pipeGeo, copperHeatMat);
    pipeFront.position.set(0, 0.52, 0.6);
    const pipeBack = new THREE.Mesh(pipeGeo, copperHeatMat);
    pipeBack.position.set(0, 0.52, -0.6);
    detailGroup.add(pipeFront, pipeBack);

    // 歧管卡箍
    const clampGeo = new THREE.CylinderGeometry(0.075, 0.075, 0.08, 12);
    clampGeo.rotateZ(Math.PI / 2);
    [-0.55, -0.18, 0.18, 0.55].forEach((cx) => {
      const c1 = new THREE.Mesh(clampGeo, brushedSilverMat);
      c1.position.set(cx, 0.52, 0.6);
      const c2 = new THREE.Mesh(clampGeo, brushedSilverMat);
      c2.position.set(cx, 0.52, -0.6);
      detailGroup.add(c1, c2);
    });

    // 6. 正面 3 块状态监控视窗与防撞把手
    for (let i = 0; i < 3; i++) {
      const wx = -0.5 + i * 0.5;
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.2, 0.06), brushedSilverMat);
      frame.position.set(wx, 0.32, 0.58);
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.14), zoneAccentMat);
      screen.position.set(wx, 0.32, 0.615);
      detailGroup.add(frame, screen);
    }

    return {
      body,
      detailGroup,
      stepDynamicTexture: (_dt: number, elapsed: number) => {
        gpuCores.forEach((die, idx) => {
          die.position.y = 1.0 + Math.sin(elapsed * 3.5 + idx * 1.2) * 0.015;
        });
      },
    };
  }

  if (archetype === 'core') {
    // =========================================================================
    // 原型 C：量子/大模型张量推理核心球 Core（18+ 部件：八角重型约束基座 + 4 组机械稳定爪 + 顶底磁约束线圈 + 三轴精密金属陀螺环 + 多面体晶体核心）
    // =========================================================================
    const body = new THREE.Mesh(new THREE.SphereGeometry(1.05, 16, 16), proxyMat);
    body.position.y = 1.15;

    // 1. 双层八角重型磁约束基座
    const baseOct = new THREE.Mesh(
      new THREE.CylinderGeometry(0.76, 0.92, 0.22, 8),
      chassisDarkMat
    );
    baseOct.position.y = 0.11;
    const midOct = new THREE.Mesh(
      new THREE.CylinderGeometry(0.54, 0.68, 0.18, 8),
      armorSlateMat
    );
    midOct.position.y = 0.28;
    const emitterPad = new THREE.Mesh(
      new THREE.CylinderGeometry(0.38, 0.42, 0.08, 16),
      statusMat
    );
    emitterPad.position.y = 0.39;
    detailGroup.add(baseOct, midOct, emitterPad);

    // 2. 四组斜向机械约束爪（环抱中央能量核）
    for (let i = 0; i < 4; i++) {
      const ang = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const clawGroup = new THREE.Group();
      clawGroup.rotation.y = ang;

      const lowerArm = new THREE.Mesh(
        createBeveledBoxGeometry(0.14, 0.72, 0.22, 0.02),
        armorSlateMat
      );
      lowerArm.position.set(0, 0.62, 0.72);
      lowerArm.rotation.x = 0.28;

      const upperJaw = new THREE.Mesh(
        createBeveledBoxGeometry(0.12, 0.56, 0.18, 0.02),
        brushedSilverMat
      );
      upperJaw.position.set(0, 1.18, 0.78);
      upperJaw.rotation.x = -0.22;

      const tipPad = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.18, 0.06), statusMat);
      tipPad.position.set(0, 1.38, 0.68);
      tipPad.rotation.x = -0.22;

      clawGroup.add(lowerArm, upperJaw, tipPad);
      detailGroup.add(clawGroup);
    }

    // 3. 中央多面体晶体核心 + 钢化玻璃球形防护罩
    const crystalInner = new THREE.Mesh(new THREE.OctahedronGeometry(0.36, 0), statusMat);
    crystalInner.position.y = 1.18;

    const crystalCage = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.5, 0),
      palette.v01.crystalCageMat
    );
    crystalCage.position.y = 1.18;

    const glassContain = new THREE.Mesh(new THREE.SphereGeometry(0.58, 24, 24), darkGlassMat);
    glassContain.position.y = 1.18;
    detailGroup.add(crystalInner, crystalCage, glassContain);

    // 4. 三轴精密金属陀螺环（带卡扣节点块）
    const gimbal1 = new THREE.Group();
    gimbal1.position.y = 1.18;
    const torus1 = new THREE.Mesh(
      new THREE.TorusGeometry(0.72, 0.032, 10, 48),
      brushedSilverMat
    );
    torus1.rotation.x = Math.PI / 6;
    gimbal1.add(torus1);

    const gimbal2 = new THREE.Group();
    gimbal2.position.y = 1.18;
    const torus2 = new THREE.Mesh(
      new THREE.TorusGeometry(0.84, 0.028, 10, 48),
      copperHeatMat
    );
    torus2.rotation.y = Math.PI / 3;
    gimbal2.add(torus2);

    detailGroup.add(gimbal1, gimbal2);

    // 5. 顶部悬浮磁极冠
    const topCap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.34, 0.22, 8),
      armorSlateMat
    );
    topCap.position.y = 1.98;
    detailGroup.add(topCap);

    return {
      body,
      detailGroup,
      stepDynamicTexture: (dt: number, elapsed: number) => {
        const s = 1.0 + Math.sin(elapsed * 2.8) * 0.08;
        crystalInner.scale.setScalar(s);
        crystalInner.rotation.y += dt * 1.2;
        crystalCage.rotation.x -= dt * 0.6;
        crystalCage.rotation.y += dt * 0.8;
        gimbal1.rotation.y += dt * 0.95;
        gimbal2.rotation.z -= dt * 1.15;
      },
    };
  }

  if (archetype === 'tower') {
    // =========================================================================
    // 原型 D：零信任通信与微波中继塔 Tower（20+ 部件：四脚重型桁架基座 + 阶梯式六棱主塔身 + 2 具抛物面微波雷达锅 + 3 层偶极子相控阵天线环 + 顶部信标球）
    // =========================================================================
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.75, 2.25, 12), proxyMat);
    body.position.y = 1.12;

    // 1. 四脚重型支撑桁架基座
    const baseHub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.46, 0.58, 0.24, 8),
      chassisDarkMat
    );
    baseHub.position.y = 0.12;
    detailGroup.add(baseHub);

    for (let i = 0; i < 4; i++) {
      const ang = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const leg = new THREE.Mesh(
        createBeveledBoxGeometry(0.14, 0.56, 0.38, 0.02),
        armorSlateMat
      );
      leg.position.set(Math.sin(ang) * 0.44, 0.24, Math.cos(ang) * 0.44);
      leg.rotation.y = ang;
      leg.rotation.x = 0.38;
      detailGroup.add(leg);
    }

    // 2. 三段阶梯式六棱金属主塔身
    const lowerMast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.4, 0.75, 6),
      armorSlateMat
    );
    lowerMast.position.y = 0.58;
    const midMast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.28, 0.75, 6),
      brushedSilverMat
    );
    midMast.position.y = 1.28;
    const upperMast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.2, 0.55, 6),
      chassisDarkMat
    );
    upperMast.position.y = 1.88;
    detailGroup.add(lowerMast, midMast, upperMast);

    // 3. 两具 LatheGeometry 抛物面微波通信天线锅
    const dishPoints: THREE.Vector2[] = [];
    for (let i = 0; i <= 8; i++) {
      const r = (i / 8) * 0.28;
      const y = r * r * 1.1;
      dishPoints.push(new THREE.Vector2(r, y));
    }
    const dishGeo = new THREE.LatheGeometry(dishPoints, 16);
    dishGeo.rotateX(Math.PI / 2);

    const dishL = new THREE.Mesh(dishGeo, brushedSilverMat);
    dishL.position.set(-0.34, 1.12, 0.18);
    dishL.rotation.y = -0.4;
    const feedL = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.18, 8), copperHeatMat);
    feedL.rotation.x = Math.PI / 2;
    feedL.position.set(0, 0, 0.1);
    dishL.add(feedL);

    const dishR = new THREE.Mesh(dishGeo, brushedSilverMat);
    dishR.position.set(0.34, 1.42, 0.18);
    dishR.rotation.y = 0.4;
    dishR.add(feedL.clone());
    detailGroup.add(dishL, dishR);

    // 4. 三层相控阵发射环 + 竖向偶极子振子杆
    const sigRings: THREE.Group[] = [];
    [0.72, 1.22, 1.72].forEach((h, idx) => {
      const rg = new THREE.Group();
      rg.position.y = h;
      const rRadius = 0.44 - idx * 0.06;
      const ringMesh = new THREE.Mesh(
        new THREE.TorusGeometry(rRadius, 0.024, 8, 24),
        statusMat
      );
      ringMesh.rotation.x = Math.PI / 2;
      rg.add(ringMesh);

      for (let k = 0; k < 6; k++) {
        const ka = (k / 6) * Math.PI * 2;
        const rod = new THREE.Mesh(
          new THREE.CylinderGeometry(0.015, 0.015, 0.2, 6),
          brushedSilverMat
        );
        rod.position.set(Math.cos(ka) * rRadius, 0, Math.sin(ka) * rRadius);
        rg.add(rod);
      }
      sigRings.push(rg);
      detailGroup.add(rg);
    });

    // 5. 顶部全向信标球与避雷针
    const topDome = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 1), statusMat);
    topDome.position.y = 2.24;
    const spire = new THREE.Mesh(
      new THREE.CylinderGeometry(0.01, 0.03, 0.35, 8),
      brushedSilverMat
    );
    spire.position.y = 2.45;
    detailGroup.add(topDome, spire);

    return {
      body,
      detailGroup,
      stepDynamicTexture: (dt: number, elapsed: number) => {
        topDome.rotation.y += dt * 1.8;
        sigRings.forEach((rg, idx) => {
          rg.rotation.y += dt * (idx % 2 === 0 ? 0.6 : -0.6);
          const s = 1.0 + Math.sin(elapsed * 3.0 - idx * 0.9) * 0.06;
          rg.scale.set(s, 1, s);
        });
      },
    };
  }

  // ===========================================================================
  // 原型 E：智能体编排三联指控终端 Console（18+ 部件：人体工学折角控台基座 + 主曲面宽屏 + 左右双侧副屏 + 机械支臂 + 发光键盘轨迹球操作台 + 底部小型主机箱）
  // ===========================================================================
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.65, 1.45, 1.15), proxyMat);
  body.position.y = 0.72;

  // 1. 底部防滑装甲地台与主机柜箱
  const deskPlinth = new THREE.Mesh(
    createBeveledBoxGeometry(1.52, 0.12, 1.02, 0.03),
    chassisDarkMat
  );
  deskPlinth.position.y = 0.06;

  const pedestalPillar = new THREE.Mesh(
    createBeveledBoxGeometry(0.96, 0.56, 0.64, 0.04),
    armorSlateMat
  );
  pedestalPillar.position.set(0, 0.38, -0.06);

  // 左右斜翼侧护板
  const wingGeo = createBeveledBoxGeometry(0.12, 0.68, 0.82, 0.025);
  const leftWing = new THREE.Mesh(wingGeo, brushedSilverMat);
  leftWing.position.set(-0.62, 0.42, 0.02);
  const rightWing = new THREE.Mesh(wingGeo, brushedSilverMat);
  rightWing.position.set(0.62, 0.42, 0.02);
  detailGroup.add(deskPlinth, pedestalPillar, leftWing, rightWing);

  // 2. 倾斜式键盘与轨迹球操控台面
  const deskTop = new THREE.Mesh(
    createBeveledBoxGeometry(1.42, 0.1, 0.78, 0.025),
    chassisDarkMat
  );
  deskTop.position.set(0, 0.72, 0.12);
  deskTop.rotation.x = 0.14;

  // 发光机械键盘区 + 右侧轨迹球
  let kbMat = palette.v01.kbMatByColor.get(zoneColor);
  if (!kbMat) {
    kbMat = new THREE.MeshStandardMaterial({
      color: zoneColor,
      emissive: zoneColor,
      emissiveIntensity: 0.5,
      roughness: 0.3,
    });
    palette.v01.kbMatByColor.set(zoneColor, kbMat);
  }
  const keyboard = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.03, 0.24), kbMat);
  keyboard.position.set(-0.14, 0.78, 0.22);
  keyboard.rotation.x = 0.14;

  const trackball = new THREE.Mesh(new THREE.SphereGeometry(0.065, 12, 12), statusMat);
  trackball.position.set(0.42, 0.79, 0.22);
  detailGroup.add(deskTop, keyboard, trackball);

  // 3. 后方双机械显示器悬臂支架
  const armGeo = new THREE.CylinderGeometry(0.045, 0.055, 0.55, 8);
  const armL = new THREE.Mesh(armGeo, brushedSilverMat);
  armL.position.set(-0.32, 0.96, -0.18);
  armL.rotation.x = -0.2;
  const armR = new THREE.Mesh(armGeo, brushedSilverMat);
  armR.position.set(0.32, 0.96, -0.18);
  armR.rotation.x = -0.2;
  detailGroup.add(armL, armR);

  // 4. 中央主控显示屏（带滚动代码与波形贴图）+ 左右双内倾战术副屏
  let screenEntry = palette.v01.consoleScreenByHex.get(zoneColorHex);
  if (!screenEntry) {
    const tex = createConsoleScreenTexture(zoneColorHex, palette.maxAnisotropy);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      side: THREE.DoubleSide,
    });
    screenEntry = { mat, tex };
    palette.v01.consoleScreenByHex.set(zoneColorHex, screenEntry);
  }
  const screenTex = screenEntry.tex;
  const screenMat = screenEntry.mat;

  // 中央主屏
  const centerBezel = new THREE.Mesh(
    createBeveledBoxGeometry(0.98, 0.56, 0.05, 0.015),
    armorSlateMat
  );
  centerBezel.position.set(0, 1.18, -0.04);
  centerBezel.rotation.x = -0.22;

  const centerScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.48), screenMat);
  centerScreen.position.set(0, 1.18, -0.01);
  centerScreen.rotation.x = -0.22;

  // 左侧副屏
  const sideBezelGeo = createBeveledBoxGeometry(0.46, 0.48, 0.04, 0.015);
  const leftBezel = new THREE.Mesh(sideBezelGeo, brushedSilverMat);
  leftBezel.position.set(-0.68, 1.16, 0.08);
  leftBezel.rotation.y = 0.42;
  leftBezel.rotation.x = -0.18;
  const leftScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.4), screenMat);
  leftScreen.position.set(-0.66, 1.16, 0.105);
  leftScreen.rotation.y = 0.42;
  leftScreen.rotation.x = -0.18;

  // 右侧副屏
  const rightBezel = new THREE.Mesh(sideBezelGeo, brushedSilverMat);
  rightBezel.position.set(0.68, 1.16, 0.08);
  rightBezel.rotation.y = -0.42;
  rightBezel.rotation.x = -0.18;
  const rightScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.4), screenMat);
  rightScreen.position.set(0.66, 1.16, 0.105);
  rightScreen.rotation.y = -0.42;
  rightScreen.rotation.x = -0.18;

  // 主屏顶部状态灯条
  const topStatusBar = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.035, 0.04), statusMat);
  topStatusBar.position.set(0, 1.46, -0.1);
  detailGroup.add(
    centerBezel,
    centerScreen,
    leftBezel,
    leftScreen,
    rightBezel,
    rightScreen,
    topStatusBar
  );

  return {
    body,
    detailGroup,
    stepDynamicTexture: (dt: number) => {
      screenTex.offset.y -= dt * 0.14;
    },
  };
}

/**
 * 构建 v0.2（设计图还原版）专属的七大分区地标级算力硬件模型
 */
function buildV02ChallengeMesh(
  dioramaType: V02DioramaType,
  slotIndex: number,
  v02Color: number,
  statusMat: THREE.MeshStandardMaterial,
  palette: SharedNodePalette
): {
  v02DetailGroup: THREE.Group;
  v02Pos: THREE.Vector3;
  v02RotY: number;
  stepV02Dynamic?: (dt: number, elapsed: number) => void;
} {
  const v02DetailGroup = new THREE.Group();
  const createBeveledBoxGeometry = palette.getBeveledBox;

  const { darkArmorMat, slateTrimMat, cyanGlowMat } = palette.v02;
  let zoneGlowMat = palette.v02.zoneGlowByColor.get(v02Color);
  if (!zoneGlowMat) {
    zoneGlowMat = new THREE.MeshStandardMaterial({
      color: v02Color,
      emissive: v02Color,
      emissiveIntensity: 0.85,
      metalness: 0.35,
      roughness: 0.2,
    });
    palette.v02.zoneGlowByColor.set(v02Color, zoneGlowMat);
  }

  // 通用辅助：构建高细节赛博机柜塔 (用于各平台周边的服务器阵列)
  const buildCyberServerTower = (w: number, h: number, d: number) => {
    const g = new THREE.Group();
    const frontMat =
      palette.v02.rackFrontPool[slotIndex % palette.v02.rackFrontPool.length];

    const plinth = new THREE.Mesh(
      createBeveledBoxGeometry(w + 0.12, 0.14, d + 0.12, 0.025),
      slateTrimMat
    );
    plinth.position.y = 0.07;
    g.add(plinth);

    const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [
      darkArmorMat,
      darkArmorMat,
      slateTrimMat,
      darkArmorMat,
      frontMat,
      frontMat,
    ]);
    box.position.y = h / 2 + 0.12;
    g.add(box);

    // 顶部霓虹边框与双侧竖向状态灯条
    const cap = new THREE.Mesh(
      createBeveledBoxGeometry(w + 0.08, 0.1, d + 0.08, 0.02),
      slateTrimMat
    );
    cap.position.y = h + 0.16;
    g.add(cap);

    const sideStripGeo = new THREE.BoxGeometry(0.035, h - 0.12, 0.035);
    const sL = new THREE.Mesh(sideStripGeo, statusMat);
    sL.position.set(-w / 2 - 0.01, h / 2 + 0.12, d / 2 + 0.01);
    const sR = new THREE.Mesh(sideStripGeo, zoneGlowMat);
    sR.position.set(w / 2 + 0.01, h / 2 + 0.12, d / 2 + 0.01);
    g.add(sL, sR);

    return g;
  };

  // 1) 运维保障 (Front-Left): 巨型三联曲面监控屏 + 两侧 4 台机柜
  if (dioramaType === 'ops-monitors') {
    const positions: [number, number, number][] = [
      [0, 0, 0.55],
      [-2.35, 0, -0.35],
      [-1.55, 0, -1.45],
      [1.55, 0, -1.45],
      [2.35, 0, -0.35],
    ];
    const [px, py, pz] = positions[slotIndex % 5];

    if (slotIndex === 0) {
      // 中央巨型三联曲面指控大屏
      const base = new THREE.Mesh(
        createBeveledBoxGeometry(2.6, 0.18, 1.2, 0.03),
        slateTrimMat
      );
      base.position.y = 0.09;
      v02DetailGroup.add(base);

      [-0.7, 0.7].forEach((sx) => {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.9, 0.35), darkArmorMat);
        leg.position.set(sx, 0.52, -0.1);
        v02DetailGroup.add(leg);
      });

      const screenTex = palette.v02.opsScreenTex;
      const screenMat = palette.v02.opsScreenMat;

      // 中屏 + 左右内倾副屏
      const configs = [
        { x: 0, z: 0.05, ry: 0, w: 1.45, h: 1.05 },
        { x: -1.38, z: 0.32, ry: 0.38, w: 1.25, h: 0.98 },
        { x: 1.38, z: 0.32, ry: -0.38, w: 1.25, h: 0.98 },
      ];
      configs.forEach((cfg) => {
        const bezel = new THREE.Mesh(
          createBeveledBoxGeometry(cfg.w + 0.1, cfg.h + 0.1, 0.08, 0.02),
          darkArmorMat
        );
        bezel.position.set(cfg.x, 1.42, cfg.z);
        bezel.rotation.y = cfg.ry;
        bezel.rotation.x = -0.12;

        const scr = new THREE.Mesh(new THREE.PlaneGeometry(cfg.w, cfg.h), screenMat);
        scr.position.set(0, 0, 0.048);
        bezel.add(scr);

        const topBar = new THREE.Mesh(
          new THREE.BoxGeometry(cfg.w * 0.7, 0.04, 0.04),
          statusMat
        );
        topBar.position.set(0, cfg.h / 2 + 0.06, 0.02);
        bezel.add(topBar);

        v02DetailGroup.add(bezel);
      });

      return {
        v02DetailGroup,
        v02Pos: new THREE.Vector3(px, py, pz),
        v02RotY: 0.25,
        stepV02Dynamic: (dt) => {
          screenTex.offset.y -= dt * 0.12;
        },
      };
    }

    v02DetailGroup.add(buildCyberServerTower(0.95, 1.95, 0.82));
    return {
      v02DetailGroup,
      v02Pos: new THREE.Vector3(px, py, pz),
      v02RotY: 0.2,
    };
  }

  // 2) AI 应用接入 (Mid-Left): 5 座高低错落的云端高密服务器塔群
  if (dioramaType === 'cloud-racks') {
    const layout: { pos: [number, number, number]; h: number }[] = [
      { pos: [0, 0, 0.1], h: 2.65 },
      { pos: [-1.45, 0, 0.65], h: 2.25 },
      { pos: [1.45, 0, 0.65], h: 2.15 },
      { pos: [-1.15, 0, -1.25], h: 2.45 },
      { pos: [1.15, 0, -1.25], h: 2.35 },
    ];
    const item = layout[slotIndex % 5];
    v02DetailGroup.add(buildCyberServerTower(1.05, item.h, 0.88));
    return {
      v02DetailGroup,
      v02Pos: new THREE.Vector3(...item.pos),
      v02RotY: 0.35,
    };
  }

  // 3) 通信网络 (Back-Left): 中央高耸发光桁架信号发射塔 + 四角服务器机柜
  if (dioramaType === 'signal-tower') {
    const positions: [number, number, number][] = [
      [0, 0, 0],
      [-2.05, 0, 1.15],
      [2.05, 0, 1.15],
      [-1.95, 0, -1.35],
      [1.95, 0, -1.35],
    ];
    const [px, py, pz] = positions[slotIndex % 5];

    if (slotIndex === 0) {
      // 中央发光青色四棱桁架电波塔
      const towerCone = new THREE.Mesh(
        new THREE.ConeGeometry(0.95, 3.2, 4, 6, true),
        palette.v02.towerWireMat
      );
      towerCone.position.y = 1.65;
      towerCone.rotation.y = Math.PI / 4;
      v02DetailGroup.add(towerCone);

      const coreRod = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.14, 3.3, 8),
        cyanGlowMat
      );
      coreRod.position.y = 1.7;
      v02DetailGroup.add(coreRod);

      const beaconBall = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 16, 16),
        statusMat
      );
      beaconBall.position.y = 3.38;
      v02DetailGroup.add(beaconBall);

      // 顶部两侧向外扩散的无线电波弧环
      const waveArcs: THREE.Mesh[] = [];
      [0.45, 0.78, 1.12].forEach((r) => {
        const arc = new THREE.Mesh(
          new THREE.TorusGeometry(r, 0.032, 8, 32, Math.PI * 0.55),
          zoneGlowMat
        );
        arc.position.y = 3.35;
        arc.rotation.z = Math.PI * 0.22;
        const arcL = arc.clone();
        arcL.rotation.z = Math.PI * 0.72;
        waveArcs.push(arc, arcL);
        v02DetailGroup.add(arc, arcL);
      });

      return {
        v02DetailGroup,
        v02Pos: new THREE.Vector3(px, py, pz),
        v02RotY: 0,
        stepV02Dynamic: (_dt, elapsed) => {
          waveArcs.forEach((a, i) => {
            const s = 0.92 + Math.sin(elapsed * 3.5 - i * 0.5) * 0.1;
            a.scale.setScalar(s);
          });
        },
      };
    }

    v02DetailGroup.add(buildCyberServerTower(0.95, 1.85, 0.82));
    return {
      v02DetailGroup,
      v02Pos: new THREE.Vector3(px, py, pz),
      v02RotY: 0,
    };
  }

  // 4) 智能体编排 (Back-Center): 5 座对称高耸矩阵式服务器方尖碑
  if (dioramaType === 'monolith-racks') {
    const layout: { pos: [number, number, number]; h: number }[] = [
      { pos: [0, 0, -0.2], h: 3.05 },
      { pos: [-1.45, 0, 0.2], h: 2.65 },
      { pos: [1.45, 0, 0.2], h: 2.65 },
      { pos: [-2.65, 0, 0.65], h: 2.15 },
      { pos: [2.65, 0, 0.65], h: 2.15 },
    ];
    const item = layout[slotIndex % 5];
    v02DetailGroup.add(buildCyberServerTower(1.02, item.h, 0.86));
    return {
      v02DetailGroup,
      v02Pos: new THREE.Vector3(...item.pos),
      v02RotY: 0,
    };
  }

  // 5) 模型推理服务 (Back-Right): 中央巨型 3D 发光全息大脑 + 4 座外围推理机柜
  if (dioramaType === 'holo-brain') {
    const positions: [number, number, number][] = [
      [0, 0, 0],
      [-2.1, 0, 1.15],
      [2.1, 0, 1.15],
      [-2.0, 0, -1.25],
      [2.0, 0, -1.25],
    ];
    const [px, py, pz] = positions[slotIndex % 5];

    if (slotIndex === 0) {
      // 全息投影底座
      const emitterBase = new THREE.Mesh(
        new THREE.CylinderGeometry(1.1, 1.35, 0.25, 24),
        slateTrimMat
      );
      emitterBase.position.y = 0.12;
      const emitterGlow = new THREE.Mesh(
        new THREE.CylinderGeometry(0.85, 0.85, 0.08, 24),
        cyanGlowMat
      );
      emitterGlow.position.y = 0.26;
      v02DetailGroup.add(emitterBase, emitterGlow);

      // 脑干能量光柱
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.32, 1.35, 16),
        cyanGlowMat
      );
      stem.position.y = 0.95;
      v02DetailGroup.add(stem);

      // 3D 左右脑半球与脑沟回晶格结构
      const brainGroup = new THREE.Group();
      brainGroup.position.y = 2.05;

      const lobeMat = palette.v02.lobeMat;
      const cortexWireMat = palette.v02.cortexWireMat;

      // 左右双脑半球
      [-0.36, 0.36].forEach((bx) => {
        const hemi = new THREE.Mesh(new THREE.IcosahedronGeometry(0.78, 2), lobeMat);
        hemi.scale.set(0.75, 0.92, 1.22);
        hemi.position.set(bx, 0, 0);

        const wire = new THREE.Mesh(new THREE.IcosahedronGeometry(0.81, 2), cortexWireMat);
        wire.scale.copy(hemi.scale);
        wire.position.copy(hemi.position);

        brainGroup.add(hemi, wire);
      });

      // 脑回发光环带
      const neuralRing = new THREE.Mesh(
        new THREE.TorusKnotGeometry(0.55, 0.045, 64, 8, 2, 3),
        statusMat
      );
      brainGroup.add(neuralRing);
      v02DetailGroup.add(brainGroup);

      return {
        v02DetailGroup,
        v02Pos: new THREE.Vector3(px, py, pz),
        v02RotY: -0.25,
        stepV02Dynamic: (dt, elapsed) => {
          brainGroup.position.y = 2.05 + Math.sin(elapsed * 2.2) * 0.08;
          brainGroup.rotation.y = Math.sin(elapsed * 0.6) * 0.25;
          neuralRing.rotation.z += dt * 0.8;
        },
      };
    }

    v02DetailGroup.add(buildCyberServerTower(0.92, 1.85, 0.8));
    return {
      v02DetailGroup,
      v02Pos: new THREE.Vector3(px, py, pz),
      v02RotY: -0.25,
    };
  }

  // 6) AI 知识库与数据存储 (Mid-Right): 圆柱形多层发光数据库存储桶 + 全息数据魔方
  if (dioramaType === 'db-drums') {
    const positions: [number, number, number][] = [
      [1.55, 0, 0.65],
      [-1.55, 0, -0.85],
      [1.45, 0, -1.25],
      [-1.15, 0, 0.95],
      [0.05, 0, 0.05],
    ];
    const [px, py, pz] = positions[slotIndex % 5];

    if (slotIndex <= 2) {
      // 多层发光圆柱形数据库桶 (Database Drum)
      const drumH = slotIndex === 0 ? 1.95 : 1.65;
      const cyl = new THREE.Mesh(
        new THREE.CylinderGeometry(0.78, 0.78, drumH, 28),
        darkArmorMat
      );
      cyl.position.y = drumH / 2 + 0.08;
      v02DetailGroup.add(cyl);

      // 4 道发光青绿存储光环
      for (let k = 0; k < 4; k++) {
        const band = new THREE.Mesh(
          new THREE.TorusGeometry(0.8, 0.038, 10, 32),
          k === 3 ? statusMat : cyanGlowMat
        );
        band.rotation.x = Math.PI / 2;
        band.position.y = 0.35 + k * (drumH / 4.2);
        v02DetailGroup.add(band);
      }

      const topCap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.72, 0.76, 0.08, 28),
        slateTrimMat
      );
      topCap.position.y = drumH + 0.1;
      v02DetailGroup.add(topCap);

      return {
        v02DetailGroup,
        v02Pos: new THREE.Vector3(px, py, pz),
        v02RotY: 0,
      };
    }

    // 槽位 3 & 4：全息发光透明立方体堆栈
    const cubeStack = new THREE.Group();
    [0.55, 1.55].forEach((cy, idx) => {
      const s = idx === 0 ? 0.95 : 0.82;
      const cMesh = new THREE.Mesh(
        palette.getBox(s, s, s),
        palette.v02.holoCubeMat
      );
      cMesh.position.y = cy;
      const cEdges = new THREE.LineSegments(
        palette.getBoxEdges(s + 0.02, s + 0.02, s + 0.02),
        palette.v02.holoEdgeMat
      );
      cMesh.add(cEdges);
      cubeStack.add(cMesh);
    });
    v02DetailGroup.add(cubeStack);

    return {
      v02DetailGroup,
      v02Pos: new THREE.Vector3(px, py, pz),
      v02RotY: 0.4,
      stepV02Dynamic: (dt) => {
        cubeStack.children[1].rotation.y += dt * 0.5;
      },
    };
  }

  // 7) 算力调度 (Front-Right): 4 座带双发光涡轮风扇的 GPU 算力魔方 + 1 座后方主控机柜
  const gpuPositions: [number, number, number][] = [
    [-0.95, 0, 0.85], // 左前 GPU 魔方（设计图中金色双激光命中点！）
    [1.05, 0, 0.85], // 右前 GPU 魔方
    [-0.95, 0, -0.95], // 左后 GPU 魔方
    [1.05, 0, -0.95], // 右后 GPU 魔方
    [-2.45, 0, -0.35], // 外侧立式机柜
  ];
  const [gpx, gpy, gpz] = gpuPositions[slotIndex % 5];

  if (slotIndex < 4) {
    const fanFaceMat = palette.v02.fanFaceMat;

    const cubeW = 1.38;
    const cubeH = 1.18;
    const cubeD = 1.38;
    const gpuBox = new THREE.Mesh(new THREE.BoxGeometry(cubeW, cubeH, cubeD), [
      fanFaceMat,
      fanFaceMat,
      slateTrimMat,
      darkArmorMat,
      fanFaceMat,
      fanFaceMat,
    ]);
    gpuBox.position.y = cubeH / 2 + 0.08;
    v02DetailGroup.add(gpuBox);

    const topGrill = new THREE.Mesh(
      createBeveledBoxGeometry(cubeW - 0.14, 0.1, cubeD - 0.14, 0.02),
      statusMat
    );
    topGrill.position.y = cubeH + 0.12;
    v02DetailGroup.add(topGrill);

    return {
      v02DetailGroup,
      v02Pos: new THREE.Vector3(gpx, gpy, gpz),
      v02RotY: -0.35,
    };
  }

  v02DetailGroup.add(buildCyberServerTower(0.95, 2.15, 0.85));
  return {
    v02DetailGroup,
    v02Pos: new THREE.Vector3(gpx, gpy, gpz),
    v02RotY: -0.25,
  };
}

/**
 * v0.2 专属：创建攻击区透明半球穹顶内的 3D 发光人形黑客/选手全息雕像
 */
export function createHumanoidHackerAvatar(colorHex: number): THREE.Group {
  const avatar = new THREE.Group();

  const glowMat = new THREE.MeshStandardMaterial({
    color: colorHex,
    emissive: colorHex,
    emissiveIntensity: 1.25,
    roughness: 0.2,
    metalness: 0.1,
    transparent: true,
    opacity: 0.92,
  });

  // 1. 脚下双层同心发光底座环
  const innerPad = new THREE.Mesh(
    new THREE.RingGeometry(0.18, 0.52, 32),
    new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  innerPad.rotation.x = -Math.PI / 2;
  innerPad.position.y = 0.02;

  const outerRing = new THREE.Mesh(
    new THREE.RingGeometry(0.62, 0.68, 32),
    new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  outerRing.rotation.x = -Math.PI / 2;
  outerRing.position.y = 0.025;
  avatar.add(innerPad, outerRing);

  // 2. 半身胸像躯干 (圆润肩部 + 倒锥腰部)
  const torso = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.22, 0.52, 20),
    glowMat
  );
  torso.scale.set(1.18, 1, 0.72);
  torso.position.y = 0.32;

  const shoulders = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.55),
    glowMat
  );
  shoulders.scale.set(1.18, 0.65, 0.72);
  shoulders.position.y = 0.54;

  // 3. 悬浮头部球体
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 20, 20), glowMat);
  head.position.y = 0.95;

  avatar.add(torso, shoulders, head);
  return avatar;
}

/**
 * 构建 v0.3（暗黑钛金极简物理版）专属的超写实数据中心硬件模型
 * 严格遵循规范：
/**
 * 构建 v0.3 专属（7 大差异化领域真实工业硬件模型）：
 * - 'ai-access' (AI应用接入): Edge gateway chassis and firewall racks (边缘网关底盘与硬件防火墙机柜)
 * - 'inference' (模型推理): High-density GPU server racks with heavy liquid cooling pipes (带重型液冷管道的高密 GPU 服务器机柜)
 * - 'agent'     (智能体编排): Curved multi-screen monitoring consoles and node servers (弧面多联屏监控台与节点服务器)
 * - 'knowledge' (知识库): Massive storage arrays with dense rows of disk bays (带密集磁盘托架的海量存储阵列)
 * - 'compute'   (算力调度): Heavy industrial compute servers with glowing heat sinks (带发光散热鳍片的重型工业算力服务器)
 * - 'ops'       (运维保障): Radar-like antenna towers and security log servers (雷达式天线塔与安全日志服务器)
 * - 'net'       (通信网络): Communication towers with fiber optic cables and signal rings (带光纤缆束与信号环的通信发射塔)
 */
function buildV03ChallengeMesh(
  zoneId: ZoneId,
  slotIndex: number,
  statusMat: THREE.MeshStandardMaterial,
  palette: SharedNodePalette,
  isV04 = false
): THREE.Group {
  const v03Group = new THREE.Group();
  const createBeveledBoxGeometry = palette.getBeveledBox;
  const matSet = isV04 ? palette.v04 : palette.v03;

  const {
    matteBlackMat,
    carbonFiberMat,
    brushedTitaniumMat,
    darkTitaniumMat,
    metalEdgeRimMat,
    pureCyanGlowMat,
    deepBlueGlowMat,
  } = matSet;

  // 辅助：在机柜两侧添加真实立体百叶散热风口与机加工面板接缝线 (Cooling Vents & Panel Seams)
  const addRackVents = (parent: THREE.Object3D, w: number, h: number, d: number) => {
    const louverGeo = palette.getBox(0.028, 0.034, d * 0.58);
    for (let v = 0; v < 6; v++) {
      const vy = 0.42 + v * ((h - 0.55) / 5);
      const lLeft = new THREE.Mesh(louverGeo, brushedTitaniumMat);
      lLeft.position.set(-w / 2 - 0.009, vy, 0);
      lLeft.rotation.z = 0.22;
      const lRight = new THREE.Mesh(louverGeo, brushedTitaniumMat);
      lRight.position.set(w / 2 + 0.009, vy, 0);
      lRight.rotation.z = -0.22;
      parent.add(lLeft, lRight);
    }

    // 侧面垂直装甲接缝压条 (Visible side panel seams)
    const seamGeo = palette.getBox(0.018, h - 0.16, 0.024);
    [-d * 0.28, d * 0.28].forEach((sz) => {
      const sL = new THREE.Mesh(seamGeo, darkTitaniumMat);
      sL.position.set(-w / 2 - 0.004, h / 2 + 0.1, sz);
      const sR = new THREE.Mesh(seamGeo, darkTitaniumMat);
      sR.position.set(w / 2 + 0.004, h / 2 + 0.1, sz);
      parent.add(sL, sR);
    });
  };

  // 辅助：构建高细节服务器机柜（v0.3 枪铁灰+炭灰拉丝+强边缘轮廓光+微小稀疏深青指示灯 / v0.4 磨砂白陶瓷+抛光纯银）
  const buildStandardDarkRack = (w = 1.12, h = 1.94, d = 0.92) => {
    const g = new THREE.Group();
    const frontMat = matSet.rackFrontMat;

    const plinth = new THREE.Mesh(
      createBeveledBoxGeometry(w + 0.18, 0.12, d + 0.18, 0.03),
      darkTitaniumMat
    );
    plinth.position.y = 0.06;
    g.add(plinth);

    const cabGeo = palette.getBox(w, h, d);
    const cab = new THREE.Mesh(cabGeo, [
      matteBlackMat,
      matteBlackMat,
      darkTitaniumMat,
      darkTitaniumMat,
      frontMat,
      carbonFiberMat,
    ]);
    cab.position.y = h / 2 + 0.1;
    cab.add(new THREE.LineSegments(new THREE.EdgesGeometry(cabGeo), metalEdgeRimMat));
    g.add(cab);

    // 两侧立体金属百叶散热风口与面板接缝 (Cooling Vents & Panel Seams)
    addRackVents(g, w, h, d);

    // 四角倒角枪铁银立柱护轨 + 边缘高光描边 (Strong rim lighting tracing the rack corners)
    const railGeo = createBeveledBoxGeometry(0.088, h + 0.05, 0.088, 0.022);
    [
      [-w / 2 - 0.02, h / 2 + 0.1, d / 2 + 0.02],
      [w / 2 + 0.02, h / 2 + 0.1, d / 2 + 0.02],
      [-w / 2 - 0.02, h / 2 + 0.1, -d / 2 - 0.02],
      [w / 2 + 0.02, h / 2 + 0.1, -d / 2 - 0.02],
    ].forEach(([rx, ry, rz]) => {
      const rail = new THREE.Mesh(railGeo, brushedTitaniumMat);
      rail.position.set(rx, ry, rz);
      g.add(rail);
    });

    if (isV04) {
      const blueStrip = new THREE.Mesh(
        new THREE.BoxGeometry(0.022, h - 0.14, 0.022),
        deepBlueGlowMat
      );
      blueStrip.position.set(-w / 2 + 0.04, h / 2 + 0.1, d / 2 + 0.022);
      const stateStrip = new THREE.Mesh(
        new THREE.BoxGeometry(0.022, h - 0.14, 0.022),
        statusMat
      );
      stateStrip.position.set(w / 2 - 0.04, h / 2 + 0.1, d / 2 + 0.022);
      g.add(blueStrip, stateStrip);
    } else {
      // v0.3: Only tiny, sparse deep-cyan indicator lights glow on the equipment (3 tiny micro-LED dots)
      const dotGeo = new THREE.BoxGeometry(0.032, 0.032, 0.024);
      [0.45, 1.05, 1.65].forEach((ly, lIdx) => {
        const dot = new THREE.Mesh(
          dotGeo,
          lIdx === 1 ? statusMat : pureCyanGlowMat
        );
        dot.position.set(w / 2 - 0.045, ly, d / 2 + 0.02);
        g.add(dot);
      });
    }

    // 顶部倒角装甲盖板与排风百叶格栅 (Beveled Roof with Exhaust Vent Grille & Rim Edge)
    const roofGeo = createBeveledBoxGeometry(w + 0.12, 0.09, d + 0.12, 0.025);
    const roof = new THREE.Mesh(roofGeo, brushedTitaniumMat);
    roof.position.y = h + 0.145;
    roof.add(
      new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(w + 0.12, 0.09, d + 0.12)),
        metalEdgeRimMat
      )
    );
    g.add(roof);

    for (let tv = -2; tv <= 2; tv++) {
      const topVent = new THREE.Mesh(
        new THREE.BoxGeometry(w * 0.65, 0.022, 0.055),
        darkTitaniumMat
      );
      topVent.position.set(0, h + 0.195, tv * 0.12);
      g.add(topVent);
    }
    return g;
  };

  // ============================================================================
  // 1) AI应用接入 ('ai-access'): Edge gateway chassis and firewall racks
  // ============================================================================
  if (zoneId === 'ai-access') {
    if (slotIndex === 1 || slotIndex === 3) {
      // 横置重型多刀片边缘网关底盘 (Edge Gateway Chassis with Beveled Edges, Vents & Panel Seams)
      const plinth = new THREE.Mesh(
        createBeveledBoxGeometry(1.68, 0.14, 1.16, 0.03),
        darkTitaniumMat
      );
      plinth.position.y = 0.07;
      v03Group.add(plinth);

      // 3 层堆叠式宽体倒角边缘网关刀片机箱
      for (let b = 0; b < 3; b++) {
        const by = 0.34 + b * 0.44;
        const chassisGeo = createBeveledBoxGeometry(1.52, 0.34, 1.02, 0.025);
        const chassis = new THREE.Mesh(
          chassisGeo,
          b === 1 ? carbonFiberMat : matteBlackMat
        );
        chassis.position.y = by;
        chassis.add(
          new THREE.LineSegments(
            new THREE.EdgesGeometry(new THREE.BoxGeometry(1.52, 0.34, 1.02)),
            metalEdgeRimMat
          )
        );
        v03Group.add(chassis);

        // 正面枪铁银拉丝护杠与百叶散热槽
        const bezel = new THREE.Mesh(
          createBeveledBoxGeometry(1.42, 0.22, 0.045, 0.012),
          brushedTitaniumMat
        );
        bezel.position.set(0, by, 0.51);
        v03Group.add(bezel);

        if (isV04) {
          const ledBar = new THREE.Mesh(
            new THREE.BoxGeometry(1.18, 0.024, 0.02),
            b === 1 ? statusMat : pureCyanGlowMat
          );
          ledBar.position.set(0, by + 0.06, 0.54);
          v03Group.add(ledBar);
        } else {
          // v0.3: Tiny sparse deep-cyan port indicator LEDs on gateway chassis
          [-0.48, 0.0, 0.48].forEach((lx, lIdx) => {
            const tinyLed = new THREE.Mesh(
              new THREE.BoxGeometry(0.04, 0.022, 0.02),
              b === 1 && lIdx === 1 ? statusMat : pureCyanGlowMat
            );
            tinyLed.position.set(lx, by + 0.05, 0.538);
            v03Group.add(tinyLed);
          });
        }
      }

      // 顶部边缘路由器倒角散热顶盖
      const topGuard = new THREE.Mesh(
        createBeveledBoxGeometry(1.44, 0.12, 0.92, 0.025),
        brushedTitaniumMat
      );
      topGuard.position.y = 1.54;
      topGuard.add(
        new THREE.LineSegments(
          new THREE.EdgesGeometry(new THREE.BoxGeometry(1.44, 0.12, 0.92)),
          metalEdgeRimMat
        )
      );
      v03Group.add(topGuard);
      return v03Group;
    }

    // 硬件防火墙安全机柜 (Firewall Rack with armored front inspection louvers)
    const fwRack = buildStandardDarkRack(1.14, 1.92, 0.94);
    for (let i = 0; i < 6; i++) {
      const bar = new THREE.Mesh(
        createBeveledBoxGeometry(0.96, 0.05, 0.06, 0.012),
        brushedTitaniumMat
      );
      bar.position.set(0, 0.36 + i * 0.28, 0.49);
      fwRack.add(bar);
    }
    v03Group.add(fwRack);
    return v03Group;
  }

  // ============================================================================
  // 2) 模型推理 ('inference'): High-density GPU server racks with thick liquid cooling pipes
  // ============================================================================
  if (zoneId === 'inference') {
    const gpuRack = buildStandardDarkRack(1.18, 2.02, 0.96);
    v03Group.add(gpuRack);

    // 顶部重型液冷分配歧管箱 (Top Liquid Cooling Header Manifold)
    const headerTank = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.16, 1.2, 24),
      brushedTitaniumMat
    );
    headerTank.rotation.z = Math.PI / 2;
    headerTank.position.set(0, 2.34, 0.16);
    v03Group.add(headerTank);

    // 两侧粗壮的液冷管道 (v0.3: Thick armored gunmetal/silver liquid cooling pipes with tiny sparse cyan sensor rings; v0.4: Transparent pipe with cyan liquid)
    [-0.66, 0.66].forEach((sideX, sIdx) => {
      const pipeCurveOuter = new THREE.CatmullRomCurve3([
        new THREE.Vector3(sideX * 0.78, 2.34, 0.16),
        new THREE.Vector3(sideX * 1.06, 2.15, 0.34),
        new THREE.Vector3(sideX * 1.1, 1.15, 0.38),
        new THREE.Vector3(sideX * 0.94, 0.18, 0.26),
      ]);
      const outerPipe = new THREE.Mesh(
        new THREE.TubeGeometry(pipeCurveOuter, 24, isV04 ? 0.056 : 0.068, 14, false),
        isV04 ? carbonFiberMat : brushedTitaniumMat
      );
      v03Group.add(outerPipe);

      if (isV04) {
        // v0.4 专属：透明亚克力液冷管内部包裹的高亮青色冷却液流柱 (Cyan liquid clearly visible inside transparent pipe)
        const innerCyanLiquid = new THREE.Mesh(
          new THREE.TubeGeometry(pipeCurveOuter, 24, 0.028, 10, false),
          pureCyanGlowMat
        );
        v03Group.add(innerCyanLiquid);
      }

      // 第二路并行回水粗管道 (Secondary thick return pipe)
      const coolantCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(sideX * 0.72, 2.28, -0.08),
        new THREE.Vector3(sideX * 1.02, 1.98, 0.08),
        new THREE.Vector3(sideX * 1.04, 0.95, 0.12),
        new THREE.Vector3(sideX * 0.88, 0.16, 0.04),
      ]);
      if (isV04) {
        const glassSleeve = new THREE.Mesh(
          new THREE.TubeGeometry(coolantCurve, 24, 0.046, 10, false),
          carbonFiberMat
        );
        v03Group.add(glassSleeve);
      }
      const coolantPipe = new THREE.Mesh(
        new THREE.TubeGeometry(coolantCurve, 24, isV04 ? 0.024 : 0.052, 10, false),
        isV04 ? (sIdx === 0 ? pureCyanGlowMat : statusMat) : darkTitaniumMat
      );
      v03Group.add(coolantPipe);

      // 4 道重型金属法兰管箍 + 微小深青流量指示环
      [0.45, 0.92, 1.4, 1.85].forEach((cy, cIdx) => {
        const collar = new THREE.Mesh(
          new THREE.CylinderGeometry(0.082, 0.082, 0.065, 14),
          isV04 ? brushedTitaniumMat : darkTitaniumMat
        );
        collar.position.set(sideX * 1.08, cy, 0.36);
        v03Group.add(collar);

        if (!isV04 && cIdx === 2) {
          const tinyFlowRing = new THREE.Mesh(
            new THREE.TorusGeometry(0.084, 0.012, 8, 16),
            sIdx === 0 ? pureCyanGlowMat : statusMat
          );
          tinyFlowRing.rotation.x = Math.PI / 2;
          tinyFlowRing.position.set(sideX * 1.08, cy, 0.36);
          v03Group.add(tinyFlowRing);
        }
      });
    });

    return v03Group;
  }

  // ============================================================================
  // 3) 智能体编排 ('agent'): Curved multi-screen monitoring consoles and node servers
  // ============================================================================
  if (zoneId === 'agent') {
    if (slotIndex === 1 || slotIndex === 3) {
      // 弧面多联屏监控工作台 (Curved Multi-Screen Monitoring Console)
      const deskBase = new THREE.Mesh(
        createBeveledBoxGeometry(1.76, 0.14, 1.06, 0.025),
        darkTitaniumMat
      );
      deskBase.position.y = 0.07;
      v03Group.add(deskBase);

      // 双立柱支撑架与斜置操作键盘台
      [-0.52, 0.52].forEach((lx) => {
        const leg = new THREE.Mesh(
          new THREE.BoxGeometry(0.16, 0.78, 0.28),
          matteBlackMat
        );
        leg.position.set(lx, 0.46, -0.08);
        v03Group.add(leg);
      });

      const keyDeck = new THREE.Mesh(
        createBeveledBoxGeometry(1.54, 0.08, 0.48, 0.015),
        brushedTitaniumMat
      );
      keyDeck.position.set(0, 0.84, 0.18);
      keyDeck.rotation.x = 0.18;
      keyDeck.add(
        new THREE.LineSegments(
          new THREE.EdgesGeometry(new THREE.BoxGeometry(1.54, 0.08, 0.48)),
          metalEdgeRimMat
        )
      );
      v03Group.add(keyDeck);

      // 3 块环抱式弧面深青全息监控屏 (Curved Multi-Screen Array)
      const screenMat = matSet.consoleScreenMat;

      const screens = [
        { x: 0, z: -0.12, ry: 0, w: 0.76, h: 0.56 },
        { x: -0.74, z: 0.06, ry: 0.42, w: 0.68, h: 0.52 },
        { x: 0.74, z: 0.06, ry: -0.42, w: 0.68, h: 0.52 },
      ];
      screens.forEach((sCfg, sIdx) => {
        const frameGeo = new THREE.BoxGeometry(sCfg.w + 0.06, sCfg.h + 0.06, 0.05);
        const frame = new THREE.Mesh(frameGeo, isV04 ? matteBlackMat : carbonFiberMat);
        frame.position.set(sCfg.x, 1.32, sCfg.z);
        frame.rotation.y = sCfg.ry;
        frame.rotation.x = -0.1;
        frame.add(new THREE.LineSegments(new THREE.EdgesGeometry(frameGeo), metalEdgeRimMat));

        const lcd = new THREE.Mesh(new THREE.PlaneGeometry(sCfg.w, sCfg.h), screenMat);
        lcd.position.z = 0.028;
        frame.add(lcd);

        // 顶部微小深青状态指示灯点
        const topDot = new THREE.Mesh(
          new THREE.BoxGeometry(isV04 ? sCfg.w * 0.7 : 0.08, 0.02, 0.02),
          sIdx === 0 ? statusMat : pureCyanGlowMat
        );
        topDot.position.set(0, sCfg.h / 2 + 0.032, 0.02);
        frame.add(topDot);

        v03Group.add(frame);
      });

      return v03Group;
    }

    // 智能体编排双子星节点服务器 (Node Servers with Beveled Edges, Vents & Rim Tracing)
    const nodeBase = new THREE.Mesh(
      createBeveledBoxGeometry(1.36, 0.12, 1.02, 0.025),
      darkTitaniumMat
    );
    nodeBase.position.y = 0.06;
    v03Group.add(nodeBase);

    [-0.32, 0.32].forEach((nx, nIdx) => {
      const towerGeo = createBeveledBoxGeometry(0.52, 1.78, 0.86, 0.025);
      const tower = new THREE.Mesh(towerGeo, nIdx === 0 ? matteBlackMat : carbonFiberMat);
      tower.position.set(nx, 1.0, 0);
      tower.add(
        new THREE.LineSegments(
          new THREE.EdgesGeometry(new THREE.BoxGeometry(0.52, 1.78, 0.86)),
          metalEdgeRimMat
        )
      );
      v03Group.add(tower);

      if (isV04) {
        const strip = new THREE.Mesh(
          new THREE.BoxGeometry(0.025, 1.56, 0.025),
          nIdx === 0 ? pureCyanGlowMat : statusMat
        );
        strip.position.set(nx, 1.0, 0.44);
        v03Group.add(strip);
      } else {
        // v0.3: Tiny sparse deep-cyan indicator LEDs + gunmetal vertical trim rail
        const trimRail = new THREE.Mesh(
          new THREE.BoxGeometry(0.035, 1.62, 0.022),
          brushedTitaniumMat
        );
        trimRail.position.set(nx, 1.0, 0.435);
        v03Group.add(trimRail);

        [0.52, 1.48].forEach((ly, lIdx) => {
          const ledDot = new THREE.Mesh(
            new THREE.BoxGeometry(0.032, 0.032, 0.028),
            nIdx === 1 && lIdx === 0 ? statusMat : pureCyanGlowMat
          );
          ledDot.position.set(nx, ly, 0.445);
          v03Group.add(ledDot);
        });
      }
    });
    return v03Group;
  }

  // ============================================================================
  // 4) 知识库 ('knowledge'): Massive storage arrays with dense rows of disk bays
  // ============================================================================
  if (zoneId === 'knowledge') {
    const bayFrontMat = matSet.bayFrontMat;

    // 宽体高密度海量存储阵列柜
    const plinth = new THREE.Mesh(
      createBeveledBoxGeometry(1.58, 0.14, 1.18, 0.03),
      darkTitaniumMat
    );
    plinth.position.y = 0.07;
    v03Group.add(plinth);

    const arrayGeo = new THREE.BoxGeometry(1.42, 1.88, 1.04);
    const sideMat = isV04 ? brushedTitaniumMat : matteBlackMat;
    const arrayBox = new THREE.Mesh(arrayGeo, [
      sideMat,
      sideMat,
      darkTitaniumMat,
      darkTitaniumMat,
      bayFrontMat,
      bayFrontMat,
    ]);
    arrayBox.position.y = 1.06;
    arrayBox.add(new THREE.LineSegments(new THREE.EdgesGeometry(arrayGeo), metalEdgeRimMat));
    v03Group.add(arrayBox);

    addRackVents(v03Group, 1.42, 1.88, 1.04);

    // 正面 3 道垂直枪铁银拉丝磁盘锁紧压条
    [-0.68, 0, 0.68].forEach((rx, idx) => {
      const bar = new THREE.Mesh(
        createBeveledBoxGeometry(0.06, 1.88, 0.065, 0.015),
        brushedTitaniumMat
      );
      bar.position.set(rx, 1.06, 0.53);
      v03Group.add(bar);

      if (isV04) {
        const led = new THREE.Mesh(
          new THREE.BoxGeometry(0.018, 1.72, 0.02),
          idx === 1 ? statusMat : pureCyanGlowMat
        );
        led.position.set(rx, 1.06, 0.568);
        v03Group.add(led);
      } else {
        // v0.3: Tiny sparse deep-cyan indicator points on disk locking rails
        [0.48, 1.62].forEach((ly, lIdx) => {
          const tinyDot = new THREE.Mesh(
            new THREE.BoxGeometry(0.028, 0.032, 0.02),
            idx === 1 && lIdx === 0 ? statusMat : pureCyanGlowMat
          );
          tinyDot.position.set(rx, ly, 0.568);
          v03Group.add(tinyDot);
        });
      }
    });

    // 顶部倒角 RAID 控制器模块舱 + 边缘逆光描边
    const raidHead = new THREE.Mesh(
      createBeveledBoxGeometry(1.48, 0.16, 1.08, 0.025),
      brushedTitaniumMat
    );
    raidHead.position.y = 2.08;
    raidHead.add(
      new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(1.48, 0.16, 1.08)),
        metalEdgeRimMat
      )
    );
    v03Group.add(raidHead);

    return v03Group;
  }

  // ============================================================================
  // 5) 算力调度 ('compute'): Heavy industrial compute servers with metallic heat sinks
  // ============================================================================
  if (zoneId === 'compute') {
    const baseChassis = new THREE.Mesh(
      createBeveledBoxGeometry(1.78, 0.28, 1.34, 0.03),
      darkTitaniumMat
    );
    baseChassis.position.y = 0.14;
    baseChassis.add(
      new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(1.78, 0.28, 1.34)),
        metalEdgeRimMat
      )
    );
    v03Group.add(baseChassis);

    const midBladeGeo = createBeveledBoxGeometry(1.66, 0.48, 1.2, 0.03);
    const midBlade = new THREE.Mesh(midBladeGeo, carbonFiberMat);
    midBlade.position.y = 0.52;
    midBlade.add(
      new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(1.66, 0.48, 1.2)),
        metalEdgeRimMat
      )
    );
    v03Group.add(midBlade);

    // 22 片重型工业拉丝金属散热鳍片阵列 (Heavy Industrial Metallic Heat Sinks)
    const finGeo = new THREE.BoxGeometry(1.54, 0.46, 0.026);
    const finInst = new THREE.InstancedMesh(finGeo, brushedTitaniumMat, 22);
    for (let i = 0; i < 22; i++) {
      const zOff = -0.5 + (i / 21) * 1.0;
      _dummyObj.position.set(0, 0.99, zOff);
      _dummyObj.rotation.set(0, 0, 0);
      _dummyObj.scale.set(1, 1, 1);
      _dummyObj.updateMatrix();
      finInst.setMatrixAt(i, _dummyObj.matrix);
    }
    finInst.instanceMatrix.needsUpdate = true;
    finInst.computeBoundingSphere();
    v03Group.add(finInst);

    if (isV04) {
      // v0.4: Glowing cyan thermal channels between polished silver heat sinks
      for (let g = 0; g < 6; g++) {
        const gz = -0.42 + (g / 5) * 0.84;
        const glowFin = new THREE.Mesh(
          new THREE.BoxGeometry(1.46, 0.36, 0.018),
          g === 2 || g === 3 ? statusMat : pureCyanGlowMat
        );
        glowFin.position.set(0, 0.98, gz);
        v03Group.add(glowFin);
      }
    } else {
      // v0.3: Metallic heatpipe bridges + only tiny, sparse deep-cyan indicator LEDs on chassis front
      [-0.36, 0.36].forEach((hx) => {
        const heatpipe = new THREE.Mesh(
          new THREE.CylinderGeometry(0.032, 0.032, 1.14, 12),
          darkTitaniumMat
        );
        heatpipe.rotation.x = Math.PI / 2;
        heatpipe.position.set(hx, 1.16, 0);
        v03Group.add(heatpipe);
      });

      [-0.58, 0, 0.58].forEach((lx, lIdx) => {
        const microLed = new THREE.Mesh(
          new THREE.BoxGeometry(0.042, 0.024, 0.02),
          lIdx === 1 ? statusMat : pureCyanGlowMat
        );
        microLed.position.set(lx, 0.52, 0.605);
        v03Group.add(microLed);
      });
    }

    // 顶部横贯式金属压条 (Metallic Heat Sink Retention Clamps)
    [-0.54, 0.54].forEach((cx, cIdx) => {
      const clamp = new THREE.Mesh(
        createBeveledBoxGeometry(0.15, 0.09, 1.12, 0.015),
        brushedTitaniumMat
      );
      clamp.position.set(cx, 1.24, 0);
      clamp.add(
        new THREE.LineSegments(
          new THREE.EdgesGeometry(new THREE.BoxGeometry(0.15, 0.09, 1.12)),
          metalEdgeRimMat
        )
      );
      v03Group.add(clamp);

      if (isV04) {
        const strip = new THREE.Mesh(
          new THREE.BoxGeometry(0.03, 0.03, 1.06),
          cIdx === 0 ? pureCyanGlowMat : statusMat
        );
        strip.position.set(cx, 1.29, 0);
        v03Group.add(strip);
      } else {
        const tinyDot = new THREE.Mesh(
          new THREE.BoxGeometry(0.032, 0.025, 0.045),
          cIdx === 0 ? pureCyanGlowMat : statusMat
        );
        tinyDot.position.set(cx, 1.29, 0.48);
        v03Group.add(tinyDot);
      }
    });

    return v03Group;
  }

  // ============================================================================
  // 6) 运维保障 ('ops'): Radar-like antenna towers and security log servers
  // ============================================================================
  if (zoneId === 'ops') {
    if (slotIndex === 0 || slotIndex === 2) {
      // 雷达式态势感知天线塔 (Radar-Like Antenna Tower)
      const basePad = new THREE.Mesh(
        new THREE.CylinderGeometry(0.82, 0.95, 0.22, 8),
        darkTitaniumMat
      );
      basePad.position.y = 0.11;
      v03Group.add(basePad);

      // 雷达塔身 (v0.3 枪铁灰/炭灰棱柱塔座 + 边缘逆光描边; v0.4 磨砂白陶瓷雷达塔)
      const mastGeo = new THREE.CylinderGeometry(0.22, 0.48, 1.45, 6);
      const mast = new THREE.Mesh(mastGeo, isV04 ? matteBlackMat : carbonFiberMat);
      mast.position.y = 0.92;
      mast.add(new THREE.LineSegments(new THREE.EdgesGeometry(mastGeo), metalEdgeRimMat));
      v03Group.add(mast);

      // 顶部仰角抛物面雷达罩 (Parabolic Radar Dish Assembly)
      const dishPivot = new THREE.Group();
      dishPivot.position.set(0, 1.78, 0);
      dishPivot.rotation.x = -0.38;
      dishPivot.rotation.y = slotIndex === 0 ? 0.35 : -0.45;

      const dishMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.72, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.42),
        isV04 ? matteBlackMat : brushedTitaniumMat
      );
      dishMesh.rotation.x = Math.PI;
      dishPivot.add(dishMesh);

      const dishRim = new THREE.Mesh(
        new THREE.TorusGeometry(0.65, isV04 ? 0.025 : 0.018, 10, 36),
        isV04 ? pureCyanGlowMat : brushedTitaniumMat
      );
      dishRim.rotation.x = Math.PI / 2;
      dishRim.position.y = 0.3;
      dishPivot.add(dishRim);

      const feedHorn = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.07, 0.55, 12),
        brushedTitaniumMat
      );
      feedHorn.position.y = 0.32;
      const hornTip = new THREE.Mesh(
        new THREE.SphereGeometry(isV04 ? 0.07 : 0.048, 12, 12),
        statusMat
      );
      hornTip.position.y = 0.62;
      dishPivot.add(feedHorn, hornTip);

      v03Group.add(dishPivot);
      return v03Group;
    }

    // 安全审计日志服务器 (Security Log Server Rack)
    const logRack = buildStandardDarkRack(1.12, 1.9, 0.92);
    v03Group.add(logRack);
    return v03Group;
  }

  // ============================================================================
  // 7) 通信网络 ('net'): Communication towers with fiber optic cables and signal rings
  // ============================================================================
  if (slotIndex === 0 || slotIndex === 2) {
    // 带光纤缆束的通信发射塔 (Communication Tower with Fiber Optic Cables)
    const plinth = new THREE.Mesh(
      new THREE.CylinderGeometry(0.86, 0.98, 0.2, 6),
      darkTitaniumMat
    );
    plinth.position.y = 0.1;
    v03Group.add(plinth);

    const towerLattice = new THREE.Mesh(
      new THREE.ConeGeometry(0.62, 2.25, 4, 4, true),
      matSet.towerLatticeMat
    );
    towerLattice.position.y = 1.32;
    towerLattice.rotation.y = Math.PI / 4;
    v03Group.add(towerLattice);

    const coreSpire = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.14, 2.38, 12),
      brushedTitaniumMat
    );
    coreSpire.position.y = 1.38;
    v03Group.add(coreSpire);

    // 3 层天线环 (v0.4 发光蓝环 / v0.3 枪铁银金属相控阵环 + 顶部单点深青信标)
    [1.62, 1.98, 2.32].forEach((ry, rIdx) => {
      const rRadius = 0.56 - rIdx * 0.12;
      const sigRing = new THREE.Mesh(
        new THREE.TorusGeometry(rRadius, isV04 ? 0.022 : 0.016, 8, 36),
        isV04
          ? rIdx === 1
            ? statusMat
            : pureCyanGlowMat
          : rIdx === 2
          ? pureCyanGlowMat
          : brushedTitaniumMat
      );
      sigRing.rotation.x = Math.PI / 2;
      sigRing.position.y = ry;
      v03Group.add(sigRing);
    });

    // 4 束从通信塔中段垂落接入底座光交箱的光纤缆束 (Fiber Optic Cables)
    for (let f = 0; f < 4; f++) {
      const fa = (f / 4) * Math.PI * 2 + Math.PI / 4;
      const fiberCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(Math.cos(fa) * 0.22, 1.55, Math.sin(fa) * 0.22),
        new THREE.Vector3(Math.cos(fa) * 0.58, 0.95, Math.sin(fa) * 0.58),
        new THREE.Vector3(Math.cos(fa) * 0.68, 0.22, Math.sin(fa) * 0.68),
      ]);
      const fiberTube = new THREE.Mesh(
        new THREE.TubeGeometry(fiberCurve, 20, isV04 ? 0.022 : 0.016, 6, false),
        f % 2 === 0 ? pureCyanGlowMat : deepBlueGlowMat
      );
      v03Group.add(fiberTube);
    }

    return v03Group;
  }

  // 核心光纤交换机机架 + 外部弯曲光纤跳线束 (Network Switch Stack with Fiber Optic Patch Cables)
  const frameBase = new THREE.Mesh(
    createBeveledBoxGeometry(1.56, 0.12, 1.06, 0.025),
    darkTitaniumMat
  );
  frameBase.position.y = 0.06;
  v03Group.add(frameBase);

  const postGeo = createBeveledBoxGeometry(0.11, 1.76, 0.16, 0.02);
  const postL = new THREE.Mesh(postGeo, brushedTitaniumMat);
  postL.position.set(-0.68, 0.94, 0);
  const postR = new THREE.Mesh(postGeo, brushedTitaniumMat);
  postR.position.set(0.68, 0.94, 0);
  v03Group.add(postL, postR);

  const swEdgeGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.26, 0.22, 0.86));
  for (let s = 0; s < 5; s++) {
    const sy = 0.26 + s * 0.31;
    const swChassis = new THREE.Mesh(
      createBeveledBoxGeometry(1.26, 0.22, 0.86, 0.02),
      s % 2 === 0 ? matteBlackMat : carbonFiberMat
    );
    swChassis.position.set(0, sy, 0);
    swChassis.add(new THREE.LineSegments(swEdgeGeo, metalEdgeRimMat));

    const faceplate = new THREE.Mesh(
      new THREE.BoxGeometry(1.18, 0.14, 0.03),
      brushedTitaniumMat
    );
    faceplate.position.set(0, sy, 0.43);

    const uplinkLed = new THREE.Mesh(
      new THREE.BoxGeometry(0.055, 0.024, 0.02),
      s === 2 ? statusMat : pureCyanGlowMat
    );
    uplinkLed.position.set(0.46, sy, 0.45);

    v03Group.add(swChassis, faceplate, uplinkLed);

    if (isV04) {
      const portStrip = new THREE.Mesh(
        new THREE.BoxGeometry(0.82, 0.018, 0.02),
        s === 2 ? statusMat : deepBlueGlowMat
      );
      portStrip.position.set(-0.1, sy + 0.04, 0.45);
      v03Group.add(portStrip);
    }
  }

  // 右侧跨层垂挂光纤跳线弧束
  [-0.45, 0.45].forEach((fx, fIdx) => {
    const patchCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(fx, 1.5, 0.46),
      new THREE.Vector3(fx * 1.15, 0.9, 0.62),
      new THREE.Vector3(fx, 0.28, 0.46),
    ]);
    const patchCable = new THREE.Mesh(
      new THREE.TubeGeometry(patchCurve, 18, 0.015, 6, false),
      fIdx === 0 ? pureCyanGlowMat : deepBlueGlowMat
    );
    v03Group.add(patchCable);
  });

  return v03Group;
}

/**
 * 创建每台设备的通用包装层（支持 v0.1 经典工业版 / v0.2 全息星际版 / v0.3 暗黑钛金版 一键无损切换）
 */
export function createChallengeNode(
  challenge: Challenge,
  zoneColor: number,
  zoneColorHex: string,
  maxAnisotropy = 4,
  v02Opts?: {
    dioramaType: V02DioramaType;
    slotIndex: number;
    v02Color: number;
    v01Pos: THREE.Vector3;
    v01RotY: number;
    initialVersion: SandboxVersion;
    palette?: SharedNodePalette;
  }
): THREE.Group {
  const palette = v02Opts?.palette ?? getOrCreateDefaultPalette(maxAnisotropy);
  const group = new THREE.Group();

  const initStateColorHex =
    challenge.state === 'solved' && challenge.firstBlood
      ? STATE_COLOR.firstBlood
      : STATE_COLOR[challenge.state];

  // 状态驱动的自发光装饰材质（嵌在设备实体零件上，清晰表达四态而不产生光污染）
  const statusMat = new THREE.MeshStandardMaterial({
    color: initStateColorHex,
    emissive: initStateColorHex,
    emissiveIntensity: challenge.state === 'idle' ? 0.55 : 1.1,
    metalness: 0.4,
    roughness: 0.25,
  });

  // ① 底座战术双光环（克制透明度，不泛白）
  const ringMat = new THREE.MeshBasicMaterial({
    color: initStateColorHex,
    transparent: true,
    opacity: challenge.state === 'idle' ? 0.42 : 0.72,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const baseRing = new THREE.Mesh(palette.baseRingGeo, ringMat);
  baseRing.rotation.x = -Math.PI / 2;
  baseRing.position.y = 0.025;
  group.add(baseRing);

  // 悬停外扩光环
  const hoverRing = new THREE.Mesh(
    palette.hoverRingGeo,
    palette.hoverRingMat.clone()
  );
  hoverRing.rotation.x = -Math.PI / 2;
  hoverRing.position.y = 0.03;
  group.add(hoverRing);

  // 点击选中旋转高亮光环
  const selectRing = new THREE.Mesh(
    palette.selectRingGeo,
    palette.selectRingMat.clone()
  );
  selectRing.rotation.x = Math.PI / 2;
  selectRing.position.y = 0.05;
  group.add(selectRing);

  // ② v0.1 精细多部件设备机体 + v0.2 设计图还原机体 + v0.3 暗黑钛金极简硬件机体
  const { body, detailGroup, stepDynamicTexture } = buildArchetypeMeshes(
    challenge.archetype,
    zoneColor,
    zoneColorHex,
    statusMat,
    palette
  );
  body.userData.challengeGroup = group;
  group.add(body);
  group.add(detailGroup);

  const v02Built = buildV02ChallengeMesh(
    v02Opts?.dioramaType ?? 'cloud-racks',
    v02Opts?.slotIndex ?? 0,
    v02Opts?.v02Color ?? zoneColor,
    statusMat,
    palette
  );
  group.add(v02Built.v02DetailGroup);

  const v03DetailGroup = buildV03ChallengeMesh(
    challenge.zoneId,
    v02Opts?.slotIndex ?? 0,
    statusMat,
    palette,
    false
  );
  group.add(v03DetailGroup);

  const v04DetailGroup = buildV03ChallengeMesh(
    challenge.zoneId,
    v02Opts?.slotIndex ?? 0,
    statusMat,
    palette,
    true
  );
  group.add(v04DetailGroup);

  // ③ 顶部细束战术状态光针（v0.3 / v0.4 下完全隐藏以杜绝光污染）
  const beacon = new THREE.Mesh(
    palette.beaconGeo,
    new THREE.MeshBasicMaterial({
      color: initStateColorHex,
      transparent: true,
      opacity:
        challenge.state === 'attacking'
          ? 0.28
          : challenge.state === 'solved'
          ? 0.16
          : 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );
  beacon.position.y = 2.8;
  group.add(beacon);

  // ④ 攻防水平扫描环（attacking 状态下上下往复）
  const scanRing = new THREE.Mesh(
    palette.scanRingGeo,
    new THREE.MeshBasicMaterial({
      color: STATE_COLOR.attacking,
      transparent: true,
      opacity: challenge.state === 'attacking' ? 0.78 : 0,
      depthWrite: false,
    })
  );
  scanRing.rotation.x = Math.PI / 2;
  scanRing.position.y = 0.6;
  group.add(scanRing);

  // ⑤ 首解 First Blood 金色六边形皇冠与底座外圈金环（v0.3 / v0.4 下隐藏，改用纯青蓝底座地面投影）
  const firstBloodCrown = new THREE.Group();
  const crownHex = new THREE.Mesh(palette.crownHexGeo, palette.crownHexMat);
  crownHex.position.y = 2.35;
  const outerGoldRing = new THREE.Mesh(palette.outerGoldRingGeo, palette.outerGoldRingMat);
  outerGoldRing.rotation.x = -Math.PI / 2;
  outerGoldRing.position.y = 0.035;
  firstBloodCrown.add(crownHex, outerGoldRing);
  firstBloodCrown.visible = challenge.state === 'solved' && challenge.firstBlood;
  group.add(firstBloodCrown);

  // ⑥ 题目全息铭牌（v0.3 / v0.4 下呈现极简半透明暗底青框中文小标签）
  const label = createChallengeHoloLabel(challenge, zoneColorHex, palette.maxAnisotropy);
  label.position.y = 2.45;
  group.add(label);

  // ⑦ 特效锚点
  const fxAnchor = new THREE.Object3D();
  fxAnchor.position.y = 1.1;
  group.add(fxAnchor);

  const initVer = v02Opts?.initialVersion ?? '0.4';
  const v01Pos = v02Opts?.v01Pos ?? new THREE.Vector3();
  const v01RotY = v02Opts?.v01RotY ?? 0;

  const userData: ChallengeNodeUserData = {
    challenge,
    challengeId: challenge.id,
    zoneId: challenge.zoneId,
    zoneColorHex,
    state: challenge.state,
    archetype: challenge.archetype,
    version: initVer,
    v01Pos,
    v01RotY,
    v02Pos: v02Built.v02Pos,
    v02RotY: v02Built.v02RotY,
    baseRing,
    hoverRing,
    selectRing,
    body,
    detailGroup,
    v02DetailGroup: v02Built.v02DetailGroup,
    v03DetailGroup,
    v04DetailGroup,
    statusMat,
    beacon,
    scanRing,
    firstBloodCrown,
    label,
    fxAnchor,
    pulsePhase: Math.random() * Math.PI * 2,
    hovered: false,
    selected: false,
    labelMode: 'compact',
    targetScale: 1.0,
    currentColor: new THREE.Color(initStateColorHex),
    targetColor: new THREE.Color(initStateColorHex),
    colorLerpTimer: 0,
    colorLerpDuration: 0.4,
    failFlashTimer: 0,
    labelFlipTimer: 0,
    solveBurstTimer: 0,
    compressTimer: 0,
    stepDynamicTexture,
    stepV02Dynamic: v02Built.stepV02Dynamic,
    setHover(hover: boolean) {
      userData.hovered = hover;
      userData.targetScale = hover ? 1.08 : 1.0;
      (hoverRing.material as THREE.MeshBasicMaterial).opacity = hover ? 0.75 : 0;
      label.userData.redraw(userData.state, {
        team: challenge.solvedBy || challenge.activeAttacker,
        firstBlood: challenge.firstBlood,
        hovered: hover,
      });
    },
    setSelected(sel: boolean) {
      userData.selected = sel;
      (selectRing.material as THREE.MeshBasicMaterial).opacity = sel ? 0.9 : 0;
    },
    setLabelMode(mode: LabelDisplayMode) {
      userData.labelMode = mode;
    },
    setVersion(ver: SandboxVersion) {
      userData.version = ver;
      const isV02 = ver === '0.2';
      const isV03Style = ver === '0.3' || ver === '0.5';
      const isV04 = ver === '0.4';
      const isV03OrV04OrV05 = isV03Style || isV04;
      detailGroup.visible = ver === '0.1';
      v02Built.v02DetailGroup.visible = isV02;
      v03DetailGroup.visible = isV03Style;
      v04DetailGroup.visible = isV04;
      beacon.visible = !isV03OrV04OrV05;
      firstBloodCrown.visible =
        !isV03OrV04OrV05 && userData.state === 'solved' && Boolean(challenge.firstBlood);
      group.position.copy(isV02 ? userData.v02Pos : userData.v01Pos);
      group.rotation.y = isV02 ? userData.v02RotY : userData.v01RotY;
      label.userData.redraw(userData.state, {
        team: challenge.solvedBy || challenge.activeAttacker,
        firstBlood: challenge.firstBlood,
        hovered: userData.hovered,
        isV03: isV03OrV04OrV05,
        isV03Abstract: isV03Style,
      });
    },
    flashFail(attempts: number) {
      userData.failFlashTimer = 1.25;
      userData.compressTimer = 0.25;
      label.userData.redraw('failed', { attempts, hovered: userData.hovered });
    },
    transitionState(
      nextState: Challenge['state'],
      payload: { team?: string; firstBlood?: boolean } = {}
    ) {
      if (userData.state === 'solved' && nextState !== 'solved') return;
      userData.state = nextState;
      challenge.state = nextState;

      if (nextState === 'attacking' && payload.team) {
        challenge.activeAttacker = payload.team;
      }
      if (nextState === 'solved') {
        if (payload.team) challenge.solvedBy = payload.team;
        if (payload.firstBlood !== undefined) challenge.firstBlood = payload.firstBlood;
        userData.solveBurstTimer = 0.85;
        firstBloodCrown.visible =
          userData.version !== '0.3' &&
          userData.version !== '0.4' &&
          userData.version !== '0.5' &&
          Boolean(challenge.firstBlood);
      }

      const nextHex =
        nextState === 'solved' && challenge.firstBlood
          ? STATE_COLOR.firstBlood
          : STATE_COLOR[nextState];

      userData.targetColor.setHex(nextHex);
      userData.colorLerpTimer = 0.4;
      userData.labelFlipTimer = 0.35;

      label.userData.redraw(nextState, {
        team: payload.team || challenge.solvedBy || challenge.activeAttacker,
        firstBlood: challenge.firstBlood,
        hovered: userData.hovered,
      });
    },
  };

  group.userData = userData;
  userData.setVersion(initVer);
  return group;
}

const _v03CoolCyan = new THREE.Color(0x00d4ff);
const _v03DeepBlue = new THREE.Color(0x0284c7);
const _v03WarmRed = new THREE.Color(0xff2e1f);

/**
 * 每帧更新单台设备节点的状态动画、材质发光与铭牌显隐模式
 */
export function updateChallengeNode(node: THREE.Group, dt: number, elapsed: number) {
  const ud = node.userData as ChallengeNodeUserData;
  const isV03 = ud.version === '0.3' || ud.version === '0.5';
  const isV03OrV04 = isV03 || ud.version === '0.4';

  if (ud.version === '0.2') {
    ud.stepV02Dynamic?.(dt, elapsed);
  } else if (ud.version === '0.1') {
    ud.stepDynamicTexture?.(dt, elapsed);
  }

  // 悬停缩放阻尼 + 受击回弹
  let scaleMod = ud.targetScale;
  if (ud.compressTimer > 0) {
    ud.compressTimer = Math.max(0, ud.compressTimer - dt);
    const p = ud.compressTimer / 0.25;
    scaleMod *= 1.0 - Math.sin(p * Math.PI) * 0.06;
  }
  if (ud.solveBurstTimer > 0) {
    ud.solveBurstTimer = Math.max(0, ud.solveBurstTimer - dt);
    const p = 1.0 - ud.solveBurstTimer / 0.85;
    if (p < 0.4) {
      scaleMod *= 1.0 + Math.sin((p / 0.4) * Math.PI) * 0.14;
    }
  }
  const activeDetail =
    ud.version === '0.2'
      ? ud.v02DetailGroup
      : ud.version === '0.3' || ud.version === '0.5'
      ? ud.v03DetailGroup
      : ud.version === '0.4'
      ? ud.v04DetailGroup
      : ud.detailGroup;
  const currScale = THREE.MathUtils.damp(activeDetail.scale.x, scaleMod, 14, dt);
  activeDetail.scale.setScalar(currScale);

  // 0.4s 颜色平滑过渡
  if (ud.colorLerpTimer > 0) {
    ud.colorLerpTimer = Math.max(0, ud.colorLerpTimer - dt);
    const alpha = 1.0 - ud.colorLerpTimer / ud.colorLerpDuration;
    ud.currentColor.lerp(ud.targetColor, Math.min(1, alpha * 0.35));
  }

  let displayColor = ud.currentColor;
  if (ud.failFlashTimer > 0) {
    ud.failFlashTimer = Math.max(0, ud.failFlashTimer - dt);
    const t = 1.25 - ud.failFlashTimer;
    const isRedFlash = (t >= 0 && t < 0.16) || (t >= 0.26 && t < 0.44);
    if (isRedFlash) {
      displayColor = _v03FailedFlashColor;
    }
    if (ud.failFlashTimer === 0) {
      ud.label.userData.redraw(ud.state, {
        team: ud.challenge.solvedBy || ud.challenge.activeAttacker,
        firstBlood: ud.challenge.firstBlood,
        attempts: ud.challenge.totalAttempts,
        hovered: ud.hovered,
      });
    }
  }

  // v0.3 / v0.4 严格色彩纪律：全场设备指示灯采用冷色青/蓝 (Cool Cyan/Blue)，仅在被红色攻击激光锁定或阻断时呈现鲜明红光对比
  if (isV03OrV04) {
    if (ud.state === 'attacking' || ud.failFlashTimer > 0) {
      displayColor = _v03WarmRed;
    } else if (ud.state === 'solved') {
      displayColor = _v03CoolCyan;
    } else {
      displayColor = _v03DeepBlue;
    }
  }

  const ringMat = ud.baseRing.material as THREE.MeshBasicMaterial;
  const beaconMat = ud.beacon.material as THREE.MeshBasicMaterial;
  const scanMat = ud.scanRing.material as THREE.MeshBasicMaterial;

  ud.statusMat.color.copy(displayColor);
  ud.statusMat.emissive.copy(displayColor);
  ringMat.color.copy(displayColor);
  beaconMat.color.copy(displayColor);
  scanMat.color.setHex(isV03OrV04 ? 0xff2e1f : STATE_COLOR.attacking);

  const pulse = Math.sin(elapsed * 4.5 + ud.pulsePhase) * 0.5 + 0.5;
  if (ud.state === 'idle') {
    ud.baseRing.rotation.z += dt * 0.35;
    ringMat.opacity = ud.hovered
      ? 0.75
      : isV03OrV04
      ? 0.22
      : ud.version === '0.2'
      ? 0.25
      : 0.42;
    ud.statusMat.emissiveIntensity = ud.hovered ? 0.85 : isV03OrV04 ? 0.45 : 0.45;
    beaconMat.opacity = THREE.MathUtils.damp(beaconMat.opacity, 0, 8, dt);
    scanMat.opacity = THREE.MathUtils.damp(scanMat.opacity, 0, 10, dt);
  } else if (ud.state === 'attacking') {
    ud.baseRing.rotation.z += dt * 1.8;
    ringMat.opacity = isV03OrV04 ? 0.58 + pulse * 0.25 : 0.65 + pulse * 0.25;
    ud.statusMat.emissiveIntensity = isV03OrV04 ? 0.9 + pulse * 0.45 : 0.75 + pulse * 0.65;
    beaconMat.opacity = isV03OrV04 ? 0 : 0.18 + pulse * 0.14;
    scanMat.opacity = isV03OrV04 ? 0.55 : 0.78;
    const scanPhase = (elapsed % 1.8) / 1.8;
    ud.scanRing.position.y = Math.sin(scanPhase * Math.PI) * 1.85 + 0.1;
  } else if (ud.state === 'solved') {
    ud.baseRing.rotation.z += dt * 0.65;
    ringMat.opacity = isV03OrV04 ? 0.45 : ud.version === '0.2' ? 0.48 : 0.72;
    ud.statusMat.emissiveIntensity = isV03OrV04 ? 0.68 : 0.85;
    beaconMat.opacity = isV03OrV04 ? 0 : ud.version === '0.2' ? 0.08 : 0.16;
    scanMat.opacity = THREE.MathUtils.damp(scanMat.opacity, 0, 10, dt);

    if (ud.firstBloodCrown.visible) {
      ud.firstBloodCrown.children[0].rotation.z += dt * 1.2;
      ud.firstBloodCrown.children[1].rotation.z -= dt * 0.8;
    }
  }

  if (ud.selected) {
    ud.selectRing.rotation.z += dt * 2.2;
  }

  // v0.3 & v0.4 默认在每台服务器上方悬浮轻量级清晰中文短标签 + 发光状态点，尺寸精巧不遮挡下方 3D 硬件模型
  const shouldShowLabel =
    ud.labelMode === 'full' ||
    (ud.labelMode === 'compact' &&
      (isV03OrV04
        ? true
        : ud.version === '0.2'
        ? ud.hovered || ud.selected || ud.failFlashTimer > 0
        : ud.hovered || ud.selected || ud.state !== 'idle' || ud.failFlashTimer > 0)) ||
    (ud.labelMode === 'hover' && (ud.hovered || ud.selected));

  ud.label.visible = shouldShowLabel;
  if (shouldShowLabel) {
    const baseLabelW = isV03
      ? ud.hovered || ud.selected
        ? 1.12
        : 0.88
      : isV03OrV04
      ? ud.hovered || ud.selected
        ? 1.38
        : 1.12
      : ud.hovered || ud.selected
      ? 1.72
      : 1.38;
    const baseLabelH = isV03
      ? ud.hovered || ud.selected
        ? 0.38
        : 0.30
      : isV03OrV04
      ? ud.hovered || ud.selected
        ? 0.45
        : 0.36
      : ud.hovered || ud.selected
      ? 0.58
      : 0.46;
    let flipY = 1.0;
    if (ud.labelFlipTimer > 0) {
      ud.labelFlipTimer = Math.max(0, ud.labelFlipTimer - dt);
      const p = 1.0 - ud.labelFlipTimer / 0.35;
      flipY = Math.max(0.08, Math.sin(p * Math.PI * 0.5) * 1.06);
    }
    ud.label.scale.set(
      THREE.MathUtils.damp(ud.label.scale.x, baseLabelW, 14, dt),
      THREE.MathUtils.damp(ud.label.scale.y, baseLabelH * flipY, 18, dt),
      1
    );
  }
}

