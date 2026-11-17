import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import {
  AttackFollowBannerInfo,
  CameraMode,
  Challenge,
  CROSS_ZONE_LINKS,
  HoveredNodeInfo,
  SandboxVersion,
  SelectedNodeInfo,
  STATE_COLOR,
  STATE_COLOR_HEX,
  Team,
  ZoneConfig,
  ZoneId,
} from '../types/cyberRange';
import { soundFX } from '../utils/soundFX';
import {
  buildTronWireframeFromGroup,
  ChallengeNodeUserData,
  createChallengeNode,
  createHumanoidHackerAvatar,
  createSharedNodePalette,
  LabelDisplayMode,
  SharedNodePalette,
  updateChallengeNode,
} from './archetypes';
import {
  accessPipeFragmentShader,
  accessPipeVertexShader,
  attackBeamFragmentShader,
  attackBeamHaloFragmentShader,
  attackBeamHaloVertexShader,
  attackBeamVertexShader,
  busRingFragmentShader,
  busRingVertexShader,
  DarkMirrorReflectorShader,
  groundDiscFragmentShader,
  groundDiscVertexShader,
  hexShieldFragmentShader,
  hexShieldVertexShader,
  risingVortexFragmentShader,
  risingVortexVertexShader,
  skyDomeFragmentShader,
  skyDomeVertexShader,
  VignetteChromaticShader,
  zonePlatformFragmentShader,
  zonePlatformVertexShader,
} from './shaders';
import {
  createAttackTelemetrySprite,
  createFloatTextSprite,
  createSolvingCardMesh,
  createV02ZonePlaqueSprite,
  createV03BrushedMetalTexture,
  createV03CarbonFiberTexture,
  createV03FloorProjectionMesh,
  createV03ZoneLabelSprite,
  createV04PolishedSilverTexture,
  createZoneTelemetrySprite,
} from './textures';

interface ZoneRuntime {
  config: ZoneConfig;
  root: THREE.Group;
  platformGroup: THREE.Group;
  v01DecorGroup: THREE.Group;
  v02ArmorGroup: THREE.Group;
  v03CenterHardwareGroup: THREE.Group;
  v04CenterHardwareGroup: THREE.Group;
  v01TronPlatformWireGroup: THREE.Group;
  v01TronPrimaryMat: THREE.LineBasicMaterial;
  v01TronSeamMat: THREE.LineBasicMaterial;
  solidPlatformMeshes: THREE.Mesh[];
  v03FloorProjMesh: THREE.Mesh;
  v03FloorProjRedraw: (
    solvedCount: number,
    totalChallenges: number,
    hasAttack: boolean
  ) => void;
  topShaderMat: THREE.ShaderMaterial;
  underBeamMat: THREE.MeshBasicMaterial;
  underHullMesh: THREE.Mesh;
  edgeNeonMat: THREE.LineBasicMaterial;
  edgeHighlightTimer: number;
  telemetrySprite: THREE.Sprite;
  v02PlaqueSprite: THREE.Sprite;
  v03LabelSprite: THREE.Sprite;
  telemetryBounceTimer: number;
  displayedScore: number;
  targetScore: number;
  innerEdgePoint: THREE.Vector3;
  nodes: Map<string, THREE.Group>;
  updateCustomDecor?: (dt: number, elapsed: number) => void;
}

interface PlayerOrbRuntime {
  team: Team;
  mesh: THREE.Mesh;
  haloMesh: THREE.Mesh;
  orbitRadius: number;
  orbitSpeed: number;
  angle: number;
  state: 'orbit' | 'toMuzzle' | 'charging' | 'returning';
  timer: number;
  startPos: THREE.Vector3;
  celebrateTimer: number;
  onChargedCallback?: () => void;
}

interface ActiveBeamRuntime {
  id: string;
  challengeId: string;
  zoneId: ZoneId;
  teamName: string;
  curve: THREE.Curve<THREE.Vector3>;
  tubeMesh: THREE.Mesh;
  beamMat: THREE.ShaderMaterial;
  haloMesh?: THREE.Mesh;
  haloMat?: THREE.ShaderMaterial;
  probeMesh: THREE.Mesh;
  trailLine: THREE.Line;
  trailPositions: Float32Array;
  solvingCard?: THREE.Mesh;
  progress: number;
  duration: number;
  arrived: boolean;
  retiring: boolean;
  retireTimer: number;
  targetColor: THREE.Color;
  targetScaleXZ: number;
  onArriveCallback?: () => void;
}

interface ShockwaveRuntime {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  delay: number;
  elapsed: number;
  duration: number;
  maxScale: number;
}

interface ParticleBurstRuntime {
  points: THREE.Points;
  velocities: Float32Array;
  gravity: number;
  damping: number;
  elapsed: number;
  duration: number;
}

interface DataReturnRuntime {
  points: THREE.Points;
  curve: THREE.Curve<THREE.Vector3>;
  offsets: Float32Array;
  elapsed: number;
  duration: number;
}

interface ShieldDomeRuntime {
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  wireMesh: THREE.LineSegments;
  wireMat: THREE.LineBasicMaterial;
  elapsed: number;
  duration: number;
}

interface RisingVortexRuntime {
  group: THREE.Group;
  outerCyl: THREE.Mesh;
  innerCyl: THREE.Mesh;
  outerMat: THREE.ShaderMaterial;
  innerMat: THREE.ShaderMaterial;
  baseRing: THREE.Mesh;
  baseRingMat: THREE.MeshBasicMaterial;
  spiralMeshes: THREE.Mesh[];
  spiralMat: THREE.MeshBasicMaterial;
  particles: THREE.Points;
  particleSpeeds: Float32Array;
  elapsed: number;
  duration: number;
}

interface FloatTextRuntime {
  sprite: THREE.Sprite;
  elapsed: number;
  duration: number;
  startY: number;
}

interface GroundRippleRuntime {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  active: boolean;
  elapsed: number;
  duration: number;
}

interface CircularBusPulseRuntime {
  meshCW: THREE.Mesh;
  meshCCW: THREE.Mesh;
  startTheta: number;
  elapsed: number;
  duration: number;
}

interface PipeParticleStreamRuntime {
  curve: THREE.Curve<THREE.Vector3>;
  points: THREE.Points;
  offsets: Float32Array;
  speed: number;
  dir: number;
}

const _tmpVecA = new THREE.Vector3();
const _tmpVecB = new THREE.Vector3();
const _tmpVecC = new THREE.Vector3();
const _projVec = new THREE.Vector3();
const _cityDummy = new THREE.Object3D();

export class CyberRangeScene {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private composer?: EffectComposer;
  private bloomPass?: UnrealBloomPass;
  private vignettePass?: ShaderPass;
  private fxaaPass?: ShaderPass;
  private isSoftwareGl: boolean;
  private currentVersion: SandboxVersion = '0.5';
  private teamsData: Team[];
  private nodePalette!: SharedNodePalette;
  private resizeObserver?: ResizeObserver;
  private envRT?: THREE.WebGLRenderTarget;
  private cubeEnvRT?: THREE.WebGLCubeRenderTarget;
  private contextLost = false;
  private slowFrameStreak = 0;
  private useSoftwarePacing = false;
  private loopTick?: () => void;

  private worldGroup = new THREE.Group();
  private groundGroup = new THREE.Group();
  private coreGroup = new THREE.Group();
  private v01CoreGroup = new THREE.Group();
  private v02CoreGroup = new THREE.Group();
  private v03CoreGroup = new THREE.Group();
  private v04CoreGroup = new THREE.Group();
  private v05CenterAttackGroup = new THREE.Group();
  private v01PipesGroup = new THREE.Group();
  private v02EnvGroup = new THREE.Group();
  private v03PipesGroup = new THREE.Group();
  private attackGroup = new THREE.Group();
  private v012AttackBaseGroup = new THREE.Group();
  private v01AttackTurretGroup = new THREE.Group();
  private v02AttackDomeGroup = new THREE.Group();
  private v03AttackConsoleGroup = new THREE.Group();
  private fxGroup = new THREE.Group();

  private sharedUniforms = {
    uTime: { value: 0 },
    uDarkMode: { value: 1.0 },
    uFuturisticMode: { value: 0.0 },
    uWireframeMode: { value: 0.0 },
  };

  private ambientLight!: THREE.AmbientLight;
  private hemiLight!: THREE.HemisphereLight;
  private keyLight!: THREE.DirectionalLight;
  private rimLight!: THREE.DirectionalLight;
  private backRightRimLight!: THREE.DirectionalLight;
  private fillLight!: THREE.DirectionalLight;
  private zonePointLights: THREE.PointLight[] = [];
  private consoleRedLight!: THREE.PointLight;

  private hullDarkMat!: THREE.MeshStandardMaterial;
  private rimSilverMat!: THREE.MeshStandardMaterial;
  private backingMat!: THREE.MeshBasicMaterial;
  private outerRimMat!: THREE.MeshStandardMaterial;
  private busRingMesh!: THREE.Mesh;
  private mirrorReflector?: Reflector;

  private starField!: THREE.Points;
  private hubCoreGroup = new THREE.Group();
  private hubRingA!: THREE.Group;
  private hubRingB!: THREE.Group;
  private busRingMat!: THREE.ShaderMaterial;
  private busNodes: THREE.Mesh[] = [];

  // v0.2 Central Giant Icosahedron & Orbital Rings
  private v02GiantIcoGroup = new THREE.Group();
  private v02OrbitRings: THREE.Mesh[] = [];
  private v02CubeNodes: THREE.Group[] = [];
  private v02AvatarNodes: THREE.Group[] = [];
  private v02SignatureBeams: THREE.ShaderMaterial[] = [];
  private v02ImpactSpark?: THREE.Mesh;

  // v0.3 Sleek Dark Metallic Core & Foreground Red-Core Console
  private v03CoreTurbineGroup = new THREE.Group();
  private v03CoreGimbalA = new THREE.Group();
  private v03CoreGimbalB = new THREE.Group();
  private v03OrangeRedCore!: THREE.Group;
  private v03ConsoleRing!: THREE.Mesh;

  // v0.4 Translucent Glass Core with Glowing Inner Rings
  private v04CoreInnerRings: THREE.Mesh[] = [];
  private v04CoreOuterGimbal = new THREE.Group();

  // v0.5 Central Octagonal Dark Chrome Attack Command Console & High-Energy Plasma Orb
  private v05OrangeRedCore!: THREE.Group;
  private v05PlasmaHaloSprite?: THREE.Sprite;
  private v05PlasmaOuterShell?: THREE.Mesh;
  private v05ConsoleGimbalA = new THREE.Group();
  private v05ConsoleGimbalB = new THREE.Group();
  private blueCubeEnvTex?: THREE.CubeTexture;
  private pipeParticleSpriteTex?: THREE.CanvasTexture;
  private pipeParticleStreams: PipeParticleStreamRuntime[] = [];

  // 0.1版 (赛博线框风 / Tron Wireframe) 专属核心、雷达地面、直连细青线与 0.8s 溶解过渡状态
  private v01TronGroundGroup = new THREE.Group();
  private v01TronRadarSweepLine?: THREE.LineSegments;
  private v01TronAttackCoreGroup = new THREE.Group();
  private v01TronRedTorusRings: THREE.Object3D[] = [];
  private v01TronLinksGroup = new THREE.Group();
  private v01TronPrimaryLineMat!: THREE.LineBasicMaterial;
  private v01TronSeamLineMat!: THREE.LineBasicMaterial;
  private v01TronRedCoreMat!: THREE.LineBasicMaterial;
  private v01TronRedOrbCoreMat!: THREE.MeshBasicMaterial;
  private v01TronRedOrbAuraMat!: THREE.MeshBasicMaterial;
  private v01TronRedOrbSpriteMat!: THREE.SpriteMaterial;
  private v01TronGroundPrimaryMat!: THREE.LineBasicMaterial;
  private v01TronGroundSeamMat!: THREE.LineBasicMaterial;
  private skyDomeMesh?: THREE.Mesh;
  private groundDiscMesh?: THREE.Mesh;
  private outerRimMesh?: THREE.Mesh;
  private wireframeMix = 0;
  private targetWireframeMix = 0;

  private zones = new Map<ZoneId, ZoneRuntime>();
  private allChallengeNodes: THREE.Group[] = [];
  private pickTargets: THREE.Object3D[] = [];
  private crossLinks = new Map<string, { mat: THREE.MeshBasicMaterial; timer: number }>();

  // Attack Zone
  private muzzleCore!: THREE.Mesh;
  private muzzleRing!: THREE.Mesh;
  private muzzleChargeTimer = 0;
  private attackTelemetrySprite!: THREE.Sprite;
  private playerOrbs: PlayerOrbRuntime[] = [];
  private totalPayloadsDispatched = 148;

  // FX Pools & Active Lists
  private activeBeams: ActiveBeamRuntime[] = [];
  private shockwaves: ShockwaveRuntime[] = [];
  private particleBursts: ParticleBurstRuntime[] = [];
  private dataReturns: DataReturnRuntime[] = [];
  private shieldDomes: ShieldDomeRuntime[] = [];
  private risingVortexes: RisingVortexRuntime[] = [];
  private floatTexts: FloatTextRuntime[] = [];
  private groundRipples: GroundRippleRuntime[] = [];
  private busPulses: CircularBusPulseRuntime[] = [];

  // Interaction & Camera
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2(-999, -999);
  private hoveredNode: THREE.Group | null = null;
  private selectedNode: THREE.Group | null = null;
  private focusedZoneId: ZoneId | null = null;
  private currentCameraMode: CameraMode = 'topology';
  private autoRotateEnabled = false;
  private autoRotateResumeTimer: number | null = null;
  private attackFollowEnabled = false;
  private panelsVisible = true;

  private attackFollowAnim: {
    elapsed: number;
    originCamPos: THREE.Vector3;
    originTarget: THREE.Vector3;
    startCamPos: THREE.Vector3;
    startTarget: THREE.Vector3;
    curve: THREE.CatmullRomCurve3;
    vantageStartPos: THREE.Vector3;
    devicePos: THREE.Vector3;
    orbitRadius: number;
    orbitBaseAngle: number;
    orbitHeight: number;
    bannerShown: boolean;
    meta: AttackFollowBannerInfo;
  } | null = null;

  private cameraTransition: {
    active: boolean;
    elapsed: number;
    duration: number;
    startPos: THREE.Vector3;
    endPos: THREE.Vector3;
    startTarget: THREE.Vector3;
    endTarget: THREE.Vector3;
    endAutoRotate: boolean;
  } | null = null;

  private shakeTimer = 0;
  private shakeIntensity = 0;

  private targetPullTimer = 0;
  private targetPullOrigin = new THREE.Vector3(0, 0, 2);
  private targetPullGoal = new THREE.Vector3(0, 0, 2);

  private lastFrameTimeMs = performance.now();
  private elapsed = 0;
  private frameId = 0;
  private disposed = false;
  private maxAnisotropy = 4;

  private onHoverChange?: (info: HoveredNodeInfo | null) => void;
  private onSelectChange?: (info: SelectedNodeInfo | null) => void;
  private onStatsSync?: () => void;
  private onAttackFollowBanner?: (info: AttackFollowBannerInfo | null) => void;

  constructor(
    container: HTMLElement,
    zonesData: ZoneConfig[],
    teamsData: Team[],
    callbacks: {
      onHoverChange?: (info: HoveredNodeInfo | null) => void;
      onSelectChange?: (info: SelectedNodeInfo | null) => void;
      onStatsSync?: () => void;
      onAttackFollowBanner?: (info: AttackFollowBannerInfo | null) => void;
    }
  ) {
    this.container = container;
    this.teamsData = teamsData;
    this.onHoverChange = callbacks.onHoverChange;
    this.onSelectChange = callbacks.onSelectChange;
    this.onStatsSync = callbacks.onStatsSync;
    this.onAttackFollowBanner = callbacks.onAttackFollowBanner;

    this.isSoftwareGl = (() => {
      try {
        const probeCanvas = document.createElement('canvas');
        const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();
    this.useSoftwarePacing = this.isSoftwareGl;

    const width = Math.max(1, container.clientWidth || window.innerWidth);
    const height = Math.max(1, container.clientHeight || window.innerHeight);

    // 1) Scene & Camera (Ultra-deep 0x020408 background & subtle FogExp2(0.005) to keep far racks crisp)
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x020408);
    this.scene.fog = new THREE.FogExp2(0x020408, 0.005);

    this.camera = new THREE.PerspectiveCamera(24, width / height, 0.1, 450);

    // 2) Renderer (8K sharp focus antialiasing)
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.setPixelRatio(
      this.isSoftwareGl
        ? Math.min(1, 1280 / Math.max(1, width))
        : Math.min(window.devicePixelRatio, 2)
    );
    this.renderer.setSize(width, height);
    this.maxAnisotropy = Math.min(4, Math.max(1, this.renderer.capabilities.getMaxAnisotropy()));

    container.appendChild(this.renderer.domElement);

    // 3) Procedural Neutral-Cool Studio CubeCamera EnvMap (keeps metallic reflections crisp without blue wash)
    try {
      const cubeRenderTarget = new THREE.WebGLCubeRenderTarget(128);
      const cubeCamera = new THREE.CubeCamera(0.1, 1000, cubeRenderTarget);
      const envScene = new THREE.Scene();
      envScene.background = new THREE.Color(0x141b26);
      cubeCamera.update(this.renderer, envScene);
      this.cubeEnvRT = cubeRenderTarget;
      this.scene.environment = cubeRenderTarget.texture;
    } catch (err) {
      console.warn('CubeCamera EnvMap fallback:', err);
      this.blueCubeEnvTex = this.createBlueStudioCubeTexture();
      this.scene.environment = this.blueCubeEnvTex;
    }

    // 4) OrbitControls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = !this.isSoftwareGl;
    this.controls.dampingFactor = 0.055;
    this.controls.autoRotate = false;
    this.controls.autoRotateSpeed = 1.6;
    this.controls.minPolarAngle = Math.PI * 0.08;
    this.controls.maxPolarAngle = Math.PI * 0.47;
    this.controls.minDistance = 10;
    this.controls.maxDistance = 120;
    const initPose = this.getDefaultOverviewPose('topology');
    this.camera.position.copy(initPose.endPos);
    this.controls.target.copy(initPose.endTarget);

    this.controls.addEventListener('start', () => {
      if (this.autoRotateResumeTimer !== null) {
        clearTimeout(this.autoRotateResumeTimer);
        this.autoRotateResumeTimer = null;
      }
      this.controls.autoRotate = false;
      if (this.cameraTransition && !this.attackFollowAnim) {
        this.cameraTransition = null;
        this.controls.enabled = true;
      }
    });

    this.controls.addEventListener('end', () => {
      if (this.autoRotateResumeTimer !== null) {
        clearTimeout(this.autoRotateResumeTimer);
        this.autoRotateResumeTimer = null;
      }
      if (this.autoRotateEnabled && !this.cameraTransition && !this.attackFollowAnim) {
        this.autoRotateResumeTimer = window.setTimeout(() => {
          this.autoRotateResumeTimer = null;
          if (
            !this.disposed &&
            this.autoRotateEnabled &&
            !this.cameraTransition &&
            !this.attackFollowAnim
          ) {
            this.controls.autoRotate = true;
          }
        }, 3000);
      }
    });

    // 5) 后处理链：收紧 UnrealBloomPass(strength: 0.6, radius: 0.2, threshold: 0.85) + OutputPass + FXAA
    if (!this.isSoftwareGl) {
      try {
        const pr = this.renderer.getPixelRatio();
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.camera));

        const isMobile = width < 900;
        this.bloomPass = new UnrealBloomPass(
          new THREE.Vector2(width, height),
          0.6,
          0.2,
          0.85
        );
        this.composer.addPass(this.bloomPass);

        if (!isMobile) {
          this.vignettePass = new ShaderPass(VignetteChromaticShader);
          this.vignettePass.uniforms.uMacroDof.value = 0.0;
          this.composer.addPass(this.vignettePass);
        }

        // OutputPass applies ACESFilmicToneMapping + Linear->sRGB conversion so PBR racks are never dark linear values
        this.composer.addPass(new OutputPass());

        this.fxaaPass = new ShaderPass(FXAAShader);
        this.fxaaPass.material.uniforms['resolution'].value.set(
          1 / (width * pr),
          1 / (height * pr)
        );
        this.composer.addPass(this.fxaaPass);
      } catch (err) {
        console.warn('EffectComposer disabled, falling back to direct render:', err);
        this.composer = undefined;
        this.bloomPass = undefined;
        this.vignettePass = undefined;
        this.fxaaPass = undefined;
      }
    }

    // 6) Build Scene Hierarchy & Shared Material/Geometry Palette (Retaining ONLY v0.3 & v0.5)
    this.nodePalette = createSharedNodePalette(this.maxAnisotropy);
    this.scene.add(this.worldGroup);
    this.coreGroup.add(
      this.v03CoreGroup,
      this.v05CenterAttackGroup,
      this.v01TronAttackCoreGroup
    );
    this.worldGroup.add(
      this.groundGroup,
      this.coreGroup,
      this.v03PipesGroup,
      this.v01TronLinksGroup,
      this.attackGroup,
      this.fxGroup
    );

    this.setupLights(zonesData);
    this.buildGroundAndAtmosphere();
    this.buildV03SleekCoreAndCyanPipelines(zonesData);
    this.buildZones(zonesData);
    this.buildCrossZoneLinks();
    this.buildV05CenterAttackConsole();
    this.buildV01TronCenterAttackAndLinks(zonesData);

    // 初始化默认版本为 0.2版 ('0.5' 中央突击版 · 八角暗黑镀铬攻击指挥台 + 高能橙红等离子光束核心 + 半透明全息罩)
    this.setVersion('0.5', true);
    this.seedInitialActiveBeams(zonesData);

    this.bindEvents();
    this.startLoop();
  }

  /**
   * 生成极暗蓝色金属环境 CubeTexture（scene.environment 指向深蓝环境贴图，确保 metalness: 0.6 金属漆表面正确反光而无白斑刺眼）
   */
  private createBlueStudioCubeTexture(): THREE.CubeTexture {
    const faces = [0, 1, 2, 3, 4, 5].map((idx) => {
      const c = document.createElement('canvas');
      c.width = 128;
      c.height = 128;
      const ctx = c.getContext('2d')!;
      if (idx === 2) {
        // +Y 天顶：深邃暗蓝柔光天幕
        const grad = ctx.createRadialGradient(64, 64, 10, 64, 64, 92);
        grad.addColorStop(0, '#184b7a');
        grad.addColorStop(0.5, '#0c2748');
        grad.addColorStop(1, '#061120');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 128, 128);
      } else if (idx === 3) {
        // -Y 地面：#0a0e17 深蓝黑基底
        ctx.fillStyle = '#0a0e17';
        ctx.fillRect(0, 0, 128, 128);
      } else {
        // 四周水平面：暗蓝金属棚拍渐变 + 柔和青蓝地平线反射带
        const grad = ctx.createLinearGradient(0, 0, 0, 128);
        grad.addColorStop(0, '#071426');
        grad.addColorStop(0.28, '#0f345e');
        grad.addColorStop(0.44, '#1b649c');
        grad.addColorStop(0.56, '#0d2644');
        grad.addColorStop(1, '#0a0e17');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 128, 128);
      }
      return c;
    });
    const cubeTex = new THREE.CubeTexture(faces);
    cubeTex.colorSpace = THREE.SRGBColorSpace;
    cubeTex.needsUpdate = true;
    return cubeTex;
  }

  private createRadialGlowTexture(stops: [number, string][]): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createRadialGradient(128, 128, 2, 128, 128, 128);
    stops.forEach(([offset, col]) => grad.addColorStop(offset, col));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /**
   * 全局氛围光系统：冷白 HemisphereLight(0xccddff, 0x050810, 1.0) + 左上纯白主光(0xffffff, 1.5) 塑造清晰明暗对比
   */
  private setupLights(zonesData: ZoneConfig[]) {
    this.ambientLight = new THREE.AmbientLight(0x94a3b8, 0.35);
    this.scene.add(this.ambientLight);

    this.hemiLight = new THREE.HemisphereLight(0xccddff, 0x050810, 1.0);
    this.scene.add(this.hemiLight);

    // 左上方纯白平行光（强度 1.5）：制造清晰明暗分界线，呈现冷峻金属质感
    this.keyLight = new THREE.DirectionalLight(0xffffff, 1.5);
    this.keyLight.position.set(-22, 34, 24);
    this.scene.add(this.keyLight);

    // 左后方冷白金属棱边轮廓光
    this.rimLight = new THREE.DirectionalLight(0xdbeafe, 0.45);
    this.rimLight.position.set(-26, 28, -28);
    this.scene.add(this.rimLight);

    // 右后方极克制冷灰轮廓补光
    this.backRightRimLight = new THREE.DirectionalLight(0x94a3b8, 0.35);
    this.backRightRimLight.position.set(26, 26, -24);
    this.scene.add(this.backRightRimLight);

    // 右前方极弱中性灰补光，保留背光面纹理但不削弱明暗对比
    this.fillLight = new THREE.DirectionalLight(0x94a3b8, 0.2);
    this.fillLight.position.set(18, 20, 22);
    this.scene.add(this.fillLight);

    void zonesData;

    // 中央八角攻击台高能橙红等离子光球局部红橙辉光
    this.consoleRedLight = new THREE.PointLight(0xff5500, 1.35, 11.0, 2);
    this.consoleRedLight.position.set(0, 1.55, 0);
    this.scene.add(this.consoleRedLight);
  }

  /**
   * 地面、建筑级穹顶天幕、外围装饰结构环与地面涟漪池
   */
  private buildGroundAndAtmosphere() {
    const skyDome = new THREE.Mesh(
      new THREE.SphereGeometry(180, 32, 24),
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: this.sharedUniforms.uTime,
          uDarkMode: this.sharedUniforms.uDarkMode,
          uFuturisticMode: this.sharedUniforms.uFuturisticMode,
        },
        vertexShader: skyDomeVertexShader,
        fragmentShader: skyDomeFragmentShader,
        side: THREE.BackSide,
        depthWrite: false,
      })
    );
    this.skyDomeMesh = skyDome;
    this.groundGroup.add(skyDome);

    this.backingMat = new THREE.MeshBasicMaterial({
      color: 0x030916,
    });
    const backing = new THREE.Mesh(
      new THREE.CylinderGeometry(33, 30, 0.4, 64),
      this.backingMat
    );
    backing.position.y = -0.85;
    this.groundGroup.add(backing);

    this.outerRimMat = new THREE.MeshStandardMaterial({
      color: 0x445566,
      metalness: 0.7,
      roughness: 0.4,
    });
    const outerRim = new THREE.Mesh(
      new THREE.TorusGeometry(28.5, 0.12, 8, 96),
      this.outerRimMat
    );
    outerRim.rotation.x = Math.PI / 2;
    outerRim.position.y = -0.58;
    this.outerRimMesh = outerRim;
    this.groundGroup.add(outerRim);

    // v0.3 Highly polished dark mirror glass floor that softly reflects the 3D models above
    if (!this.isSoftwareGl) {
      try {
        this.mirrorReflector = new Reflector(new THREE.CircleGeometry(31.85, 72), {
          clipBias: 0.003,
          textureWidth: 512,
          textureHeight: 512,
          color: 0x7dd3fc,
          shader: DarkMirrorReflectorShader,
          multisample: 0,
        });
        this.mirrorReflector.rotation.x = -Math.PI / 2;
        this.mirrorReflector.position.y = -0.612;
        this.groundGroup.add(this.mirrorReflector);
      } catch (err) {
        console.warn('Mirror reflector fallback:', err);
        this.mirrorReflector = undefined;
      }
    }

    const groundMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: this.sharedUniforms.uTime,
        uDarkMode: this.sharedUniforms.uDarkMode,
        uFuturisticMode: this.sharedUniforms.uFuturisticMode,
        uWireframeMode: this.sharedUniforms.uWireframeMode,
      },
      vertexShader: groundDiscVertexShader,
      fragmentShader: groundDiscFragmentShader,
      transparent: true,
      depthWrite: false,
      side: THREE.FrontSide,
    });
    const groundDisc = new THREE.Mesh(new THREE.CircleGeometry(32, 96), groundMat);
    groundDisc.rotation.x = -Math.PI / 2;
    groundDisc.position.y = -0.595;
    groundDisc.renderOrder = 1;
    this.groundDiscMesh = groundDisc;
    this.groundGroup.add(groundDisc);

    // 0.1版 (Tron 赛博线框风) 专属地面辅助刻度线：采用暗蓝色 0x001e38 极淡线条，不抢戏、不发光
    this.v01TronGroundPrimaryMat = new THREE.LineBasicMaterial({
      color: 0x001e38,
      transparent: true,
      opacity: 0,
    });
    this.v01TronGroundSeamMat = new THREE.LineBasicMaterial({
      color: 0x001e38,
      transparent: true,
      opacity: 0,
    });

    const groundY = -0.57;
    const crossPts: THREE.Vector3[] = [
      new THREE.Vector3(-32, groundY, 0),
      new THREE.Vector3(32, groundY, 0),
      new THREE.Vector3(0, groundY, -32),
      new THREE.Vector3(0, groundY, 32),
    ];
    // 十字轴上的精密雷达刻度短线
    for (let d = -28; d <= 28; d += 2) {
      if (Math.abs(d) < 3) continue;
      const tickHalf = d % 4 === 0 ? 0.35 : 0.16;
      crossPts.push(
        new THREE.Vector3(d, groundY, -tickHalf),
        new THREE.Vector3(d, groundY, tickHalf),
        new THREE.Vector3(-tickHalf, groundY, d),
        new THREE.Vector3(tickHalf, groundY, d)
      );
    }
    this.v01TronGroundGroup.add(
      new THREE.LineSegments(
        new THREE.BufferGeometry().setFromPoints(crossPts),
        this.v01TronGroundPrimaryMat
      )
    );

    // 45° 斜向极细战术辅助十字线与雷达同心圆环
    const seamGroundPts: THREE.Vector3[] = [
      new THREE.Vector3(-22, groundY, -22),
      new THREE.Vector3(22, groundY, 22),
      new THREE.Vector3(-22, groundY, 22),
      new THREE.Vector3(22, groundY, -22),
    ];
    const radarRadii = [4.6, 9.2, 14.2, 19.0, 23.8, 28.5];
    radarRadii.forEach((r, rIdx) => {
      const segs = 128;
      const circlePts: THREE.Vector3[] = [];
      for (let s = 0; s < segs; s++) {
        const a0 = (s / segs) * Math.PI * 2;
        const a1 = ((s + 1) / segs) * Math.PI * 2;
        // 偶数组为实线圆，奇数组为精密虚线扫描圆
        if (rIdx % 2 === 0 || s % 2 === 0) {
          circlePts.push(
            new THREE.Vector3(Math.cos(a0) * r, groundY, Math.sin(a0) * r),
            new THREE.Vector3(Math.cos(a1) * r, groundY, Math.sin(a1) * r)
          );
        }
      }
      this.v01TronGroundGroup.add(
        new THREE.LineSegments(
          new THREE.BufferGeometry().setFromPoints(circlePts),
          rIdx === 2 || rIdx === 5
            ? this.v01TronGroundPrimaryMat
            : this.v01TronGroundSeamMat
        )
      );
    });

    // 外圈 360° 雷达方位角刻度尺
    for (let deg = 0; deg < 360; deg += 5) {
      const rad = (deg * Math.PI) / 180;
      const rIn = deg % 15 === 0 ? 27.65 : 28.05;
      const rOut = 28.5;
      seamGroundPts.push(
        new THREE.Vector3(Math.cos(rad) * rIn, groundY, Math.sin(rad) * rIn),
        new THREE.Vector3(Math.cos(rad) * rOut, groundY, Math.sin(rad) * rOut)
      );
    }
    this.v01TronGroundGroup.add(
      new THREE.LineSegments(
        new THREE.BufferGeometry().setFromPoints(seamGroundPts),
        this.v01TronGroundSeamMat
      )
    );

    // 旋转雷达扫描指针线
    const sweepPts = [
      new THREE.Vector3(0, groundY + 0.01, 0),
      new THREE.Vector3(0, groundY + 0.01, 28.4),
    ];
    this.v01TronRadarSweepLine = new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints(sweepPts),
      this.v01TronGroundPrimaryMat
    );
    this.v01TronGroundGroup.add(this.v01TronRadarSweepLine);
    this.v01TronGroundGroup.visible = false;
    this.groundGroup.add(this.v01TronGroundGroup);

    const rippleGeo = new THREE.RingGeometry(0.85, 1.0, 48);
    for (let i = 0; i < 12; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0x00d4ff,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(rippleGeo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = -0.55;
      mesh.visible = false;
      this.groundGroup.add(mesh);
      this.groundRipples.push({
        mesh,
        mat,
        active: false,
        elapsed: 0,
        duration: 1.6,
      });
    }

    const starCount = 550;
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);
    const c1 = new THREE.Color(0x38bdf8);
    const c2 = new THREE.Color(0xcbd5e1);
    const tmpColor = new THREE.Color();

    for (let i = 0; i < starCount; i++) {
      const r = 75 + Math.random() * 55;
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = Math.abs(r * Math.cos(phi)) * 0.65 + 4;
      starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

      tmpColor.copy(c1).lerp(c2, Math.random());
      starColors[i * 3] = tmpColor.r;
      starColors[i * 3 + 1] = tmpColor.g;
      starColors[i * 3 + 2] = tmpColor.b;
    }

    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
    const starMat = new THREE.PointsMaterial({
      size: 1.9,
      sizeAttenuation: false,
      vertexColors: true,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    });
    this.starField = new THREE.Points(starGeo, starMat);
    this.groundGroup.add(this.starField);
  }

  /**
   * v0.2 专属环境：远景赛博都市摩天楼天际线 + 地平线弧光 + 外环机械轨道 + 放射状直连光桥
   */
  private buildV02HorizonAndBridges(zonesData: ZoneConfig[]) {
    const horizonRing = new THREE.Mesh(
      new THREE.TorusGeometry(62, 0.22, 8, 128),
      new THREE.MeshBasicMaterial({
        color: 0x00a8ff,
        transparent: true,
        opacity: 0.65,
      })
    );
    horizonRing.rotation.x = Math.PI / 2;
    horizonRing.position.y = 2.6;
    this.v02EnvGroup.add(horizonRing);

    const horizonGlow = new THREE.Mesh(
      new THREE.RingGeometry(56, 64, 96),
      new THREE.MeshBasicMaterial({
        color: 0x0284c7,
        transparent: true,
        opacity: 0.16,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    horizonGlow.rotation.x = -Math.PI / 2;
    horizonGlow.position.y = 1.2;
    this.v02EnvGroup.add(horizonGlow);

    const bldgCount = 110;
    const bldgGeo = new THREE.BoxGeometry(1, 1, 1);
    const bldgMat = new THREE.MeshStandardMaterial({
      color: 0x091529,
      emissive: 0x0a274d,
      emissiveIntensity: 0.35,
      metalness: 0.85,
      roughness: 0.3,
    });
    const cityInst = new THREE.InstancedMesh(bldgGeo, bldgMat, bldgCount);
    for (let i = 0; i < bldgCount; i++) {
      const ang = (i / bldgCount) * Math.PI * 2;
      const dist = 42 + (i % 5) * 3.8;
      const w = 1.2 + (i % 4) * 0.65;
      const d = 1.2 + ((i + 2) % 4) * 0.65;
      const isFrontCenter = Math.abs(Math.sin(ang)) < 0.38 && Math.cos(ang) > 0;
      const h = isFrontCenter ? 0.8 : 2.2 + ((i * 7) % 11) * 0.85;

      _cityDummy.position.set(
        Math.sin(ang) * dist,
        h / 2 - 0.8,
        Math.cos(ang) * dist
      );
      _cityDummy.rotation.set(0, ang, 0);
      _cityDummy.scale.set(w, h, d);
      _cityDummy.updateMatrix();
      cityInst.setMatrixAt(i, _cityDummy.matrix);
    }
    cityInst.instanceMatrix.needsUpdate = true;
    cityInst.computeBoundingSphere();
    this.v02EnvGroup.add(cityInst);

    const outerTrackMat = new THREE.MeshStandardMaterial({
      color: 0x162642,
      metalness: 0.85,
      roughness: 0.25,
    });
    const outerTrack = new THREE.Mesh(
      new THREE.TorusGeometry(14.35, 0.32, 8, 128),
      outerTrackMat
    );
    outerTrack.rotation.x = Math.PI / 2;
    outerTrack.position.y = -0.05;
    this.v02EnvGroup.add(outerTrack);

    const outerTrackNeon = new THREE.Mesh(
      new THREE.TorusGeometry(14.35, 0.08, 8, 128),
      new THREE.MeshBasicMaterial({
        color: 0x00d4ff,
        transparent: true,
        opacity: 0.78,
      })
    );
    outerTrackNeon.rotation.x = Math.PI / 2;
    outerTrackNeon.position.y = 0.22;
    this.v02EnvGroup.add(outerTrackNeon);

    const grandFloorRing = new THREE.Mesh(
      new THREE.RingGeometry(21.2, 21.55, 128),
      new THREE.MeshBasicMaterial({
        color: 0x00a8ff,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    grandFloorRing.rotation.x = -Math.PI / 2;
    grandFloorRing.position.y = -0.52;
    this.v02EnvGroup.add(grandFloorRing);

    const bridgeRailMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.88,
    });
    const bridgeDeckMat = new THREE.MeshStandardMaterial({
      color: 0x102342,
      emissive: 0x0077cc,
      emissiveIntensity: 0.45,
      metalness: 0.8,
      roughness: 0.25,
    });

    zonesData.forEach((z) => {
      const targetVec = new THREE.Vector3(z.v02Position[0], 0.05, z.v02Position[2]);
      const dir = targetVec.clone().setY(0).normalize();
      const startR = 6.2;
      const endR = targetVec.length() - 4.35;
      const bridgeLen = Math.max(1.5, endR - startR);
      const midR = (startR + endR) * 0.5;

      const bridgeGroup = new THREE.Group();
      bridgeGroup.position.set(dir.x * midR, 0.12, dir.z * midR);
      bridgeGroup.rotation.y = Math.atan2(dir.x, dir.z);

      const deck = new THREE.Mesh(
        new THREE.BoxGeometry(0.95, 0.14, bridgeLen),
        bridgeDeckMat
      );
      const railL = new THREE.Mesh(
        new THREE.BoxGeometry(0.09, 0.18, bridgeLen),
        bridgeRailMat
      );
      railL.position.x = -0.44;
      const railR = new THREE.Mesh(
        new THREE.BoxGeometry(0.09, 0.18, bridgeLen),
        bridgeRailMat
      );
      railR.position.x = 0.44;
      const centerBeam = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.16, bridgeLen),
        new THREE.MeshBasicMaterial({ color: z.v02Color })
      );

      bridgeGroup.add(deck, railL, railR, centerBeam);
      this.v02EnvGroup.add(bridgeGroup);
    });
  }

  /**
   * 四、coreGroup (v0.1)：高精度多层中央量子交换枢纽 + 环形数据总线 + 8 座立体网关桥塔
   */
  private buildCoreBusHub(zonesData: ZoneConfig[]) {
    const darkMetal = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.82,
      roughness: 0.28,
    });
    const silverMetal = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      metalness: 0.88,
      roughness: 0.22,
    });
    const cyanEmissive = new THREE.MeshStandardMaterial({
      color: 0x00d4ff,
      emissive: 0x00d4ff,
      emissiveIntensity: 0.65,
      metalness: 0.4,
      roughness: 0.2,
    });

    const baseStep1 = new THREE.Mesh(
      new THREE.CylinderGeometry(2.6, 3.0, 0.24, 6),
      darkMetal
    );
    baseStep1.position.y = -0.45;
    const baseStep2 = new THREE.Mesh(
      new THREE.CylinderGeometry(1.85, 2.2, 0.28, 6),
      silverMetal
    );
    baseStep2.position.y = -0.2;
    const baseEmitter = new THREE.Mesh(
      new THREE.CylinderGeometry(1.1, 1.35, 0.14, 12),
      cyanEmissive
    );
    baseEmitter.position.y = 0.02;
    this.v01CoreGroup.add(baseStep1, baseStep2, baseEmitter);

    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.24, 2.6, 0.38), darkMetal);
      pylon.position.set(Math.sin(a) * 2.35, 0.85, Math.cos(a) * 2.35);
      pylon.rotation.y = a;
      pylon.rotation.x = -0.22;
      this.v01CoreGroup.add(pylon);
    }

    this.hubCoreGroup.position.set(0, 1.55, 0);

    const innerSphere = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.62, 1),
      cyanEmissive
    );
    const icoCage = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.95, 1),
      new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        metalness: 0.9,
        roughness: 0.15,
        wireframe: true,
      })
    );

    this.hubRingA = new THREE.Group();
    const ringAMesh = new THREE.Mesh(
      new THREE.TorusGeometry(1.65, 0.06, 12, 64),
      silverMetal
    );
    this.hubRingA.add(ringAMesh);
    for (let i = 0; i < 4; i++) {
      const ca = (i / 4) * Math.PI * 2;
      const clasp = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), cyanEmissive);
      clasp.position.set(Math.cos(ca) * 1.65, Math.sin(ca) * 1.65, 0);
      this.hubRingA.add(clasp);
    }

    this.hubRingB = new THREE.Group();
    this.hubRingB.rotation.x = Math.PI / 3;
    const ringBMesh = new THREE.Mesh(
      new THREE.TorusGeometry(2.05, 0.045, 12, 64),
      darkMetal
    );
    this.hubRingB.add(ringBMesh);

    this.hubCoreGroup.add(innerSphere, icoCage, this.hubRingA, this.hubRingB);
    this.v01CoreGroup.add(this.hubCoreGroup);

    const busTrack = new THREE.Mesh(
      new THREE.TorusGeometry(8.6, 0.22, 8, 128),
      darkMetal
    );
    busTrack.rotation.x = Math.PI / 2;
    busTrack.position.y = 0.12;
    this.v01CoreGroup.add(busTrack);

    this.busRingMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: this.sharedUniforms.uTime,
        uColor: { value: new THREE.Color(0x00d4ff) },
        uSpeed: { value: 0.5 },
        uHighlight: { value: 0.0 },
      },
      vertexShader: busRingVertexShader,
      fragmentShader: busRingFragmentShader,
      transparent: true,
      depthWrite: false,
    });
    this.busRingMesh = new THREE.Mesh(
      new THREE.TorusGeometry(8.6, 0.095, 12, 128),
      this.busRingMat
    );
    this.busRingMesh.rotation.x = Math.PI / 2;
    this.busRingMesh.position.y = 0.22;
    this.coreGroup.add(this.busRingMesh);

    const portAngles = [0, ...zonesData.map((z) => z.theta)];
    const portGeo = new THREE.OctahedronGeometry(0.26, 0);
    portAngles.forEach((theta, idx) => {
      const color = idx === 0 ? 0xff3b5c : zonesData[idx - 1].color;
      const px = Math.sin(theta) * 8.6;
      const pz = Math.cos(theta) * 8.6;

      const stationGroup = new THREE.Group();
      stationGroup.position.set(px, 0.2, pz);
      stationGroup.rotation.y = theta;

      const dockBase = new THREE.Mesh(
        new THREE.CylinderGeometry(0.52, 0.62, 0.24, 6),
        silverMetal
      );
      const archL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.65, 0.18), darkMetal);
      archL.position.set(-0.34, 0.35, 0);
      const archR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.65, 0.18), darkMetal);
      archR.position.set(0.34, 0.35, 0);
      stationGroup.add(dockBase, archL, archR);
      this.v01CoreGroup.add(stationGroup);

      const gem = new THREE.Mesh(
        portGeo,
        new THREE.MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: 0.7,
          metalness: 0.3,
          roughness: 0.2,
        })
      );
      gem.position.set(px, 0.68, pz);
      this.busNodes.push(gem);
      this.v01CoreGroup.add(gem);
    });
  }

  /**
   * 四 (v0.2 专属)：还原设计图中央巨型多面体蓝晶核 + 多层圆形反应堆底座 + 底部半透明能量半球 + 8 颗发光等轴立方体节点
   */
  private buildV02CentralCrystalHub(zonesData: ZoneConfig[]) {
    const reactorDarkMat = new THREE.MeshStandardMaterial({
      color: 0x10203a,
      metalness: 0.85,
      roughness: 0.25,
    });
    const reactorSlateMat = new THREE.MeshStandardMaterial({
      color: 0x1d3557,
      metalness: 0.82,
      roughness: 0.22,
    });
    const cyanNeonMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.92,
    });

    const outerReactorDeck = new THREE.Mesh(
      new THREE.CylinderGeometry(6.45, 5.9, 0.48, 48),
      reactorDarkMat
    );
    outerReactorDeck.position.y = -0.18;

    const midReactorDeck = new THREE.Mesh(
      new THREE.CylinderGeometry(4.85, 5.1, 0.36, 48),
      reactorSlateMat
    );
    midReactorDeck.position.y = 0.14;

    const innerReactorPedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(2.35, 2.75, 0.68, 32),
      reactorDarkMat
    );
    innerReactorPedestal.position.y = 0.52;

    this.v02CoreGroup.add(outerReactorDeck, midReactorDeck, innerReactorPedestal);

    [6.35, 4.9, 3.65, 2.42].forEach((r, idx) => {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(r, idx === 0 ? 0.075 : 0.045, 10, 96),
        cyanNeonMat
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.1 + idx * 0.18;
      this.v02CoreGroup.add(ring);
    });

    const underDomeGeo = new THREE.SphereGeometry(
      5.45,
      36,
      20,
      0,
      Math.PI * 2,
      Math.PI * 0.5,
      Math.PI * 0.5
    );
    const underDomeMat = new THREE.MeshPhysicalMaterial({
      color: 0x00b4ff,
      emissive: 0x0077ff,
      emissiveIntensity: 0.65,
      transparent: true,
      opacity: 0.36,
      roughness: 0.15,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const underDome = new THREE.Mesh(underDomeGeo, underDomeMat);
    underDome.position.y = -0.35;
    this.v02CoreGroup.add(underDome);

    const underCoreLight = new THREE.Mesh(
      new THREE.SphereGeometry(0.95, 16, 16),
      new THREE.MeshBasicMaterial({
        color: 0x7dd3fc,
        transparent: true,
        opacity: 0.75,
      })
    );
    underCoreLight.position.y = -1.2;
    this.v02CoreGroup.add(underCoreLight);

    this.v02GiantIcoGroup.position.set(0, 2.65, 0);

    const crystalGeo = new THREE.IcosahedronGeometry(1.95, 0);
    const crystalMat = new THREE.MeshPhysicalMaterial({
      color: 0x00b4ff,
      emissive: 0x0066cc,
      emissiveIntensity: 0.62,
      metalness: 0.15,
      roughness: 0.12,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      flatShading: true,
    });
    const crystalMesh = new THREE.Mesh(crystalGeo, crystalMat);

    const crystalEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(crystalGeo),
      new THREE.LineBasicMaterial({
        color: 0xe0f2fe,
        transparent: true,
        opacity: 0.96,
      })
    );
    crystalMesh.add(crystalEdges);

    const innerStar = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.95, 0),
      new THREE.MeshBasicMaterial({
        color: 0x7dd3fc,
        transparent: true,
        opacity: 0.85,
      })
    );
    crystalMesh.add(innerStar);
    this.v02GiantIcoGroup.add(crystalMesh);

    const ringConfigs = [
      { r: 2.95, tube: 0.055, rx: Math.PI * 0.42, ry: 0.22, col: 0x00f0ff },
      { r: 3.45, tube: 0.04, rx: Math.PI * 0.54, ry: -0.28, col: 0x38bdf8 },
      { r: 4.05, tube: 0.032, rx: Math.PI * 0.48, ry: 0.12, col: 0x7dd3fc },
    ];
    ringConfigs.forEach((rc) => {
      const orbitRing = new THREE.Mesh(
        new THREE.TorusGeometry(rc.r, rc.tube, 12, 96),
        new THREE.MeshBasicMaterial({
          color: rc.col,
          transparent: true,
          opacity: 0.88,
        })
      );
      orbitRing.rotation.set(rc.rx, rc.ry, 0);
      this.v02OrbitRings.push(orbitRing);
      this.v02GiantIcoGroup.add(orbitRing);
    });

    this.v02CoreGroup.add(this.v02GiantIcoGroup);

    const cubeAngles = [0, ...zonesData.map((z) => z.v02Theta)];
    const cubeGeo = new THREE.BoxGeometry(0.68, 0.68, 0.68);
    const cubeEdgesGeo = new THREE.EdgesGeometry(cubeGeo);
    const cubeMat = new THREE.MeshPhysicalMaterial({
      color: 0x00d4ff,
      emissive: 0x0099ff,
      emissiveIntensity: 0.78,
      transparent: true,
      opacity: 0.85,
      roughness: 0.15,
    });

    cubeAngles.forEach((theta) => {
      const r = 6.05;
      const cx = Math.sin(theta) * r;
      const cz = Math.cos(theta) * r;

      const nodeHolder = new THREE.Group();
      nodeHolder.position.set(cx, 0.68, cz);

      const cubeMesh = new THREE.Mesh(cubeGeo, cubeMat);
      cubeMesh.rotation.set(Math.PI / 6, Math.PI / 4, 0);
      const edgeLines = new THREE.LineSegments(
        cubeEdgesGeo,
        new THREE.LineBasicMaterial({ color: 0xe0f2fe })
      );
      cubeMesh.add(edgeLines);
      nodeHolder.add(cubeMesh);

      const pad = new THREE.Mesh(
        new THREE.CylinderGeometry(0.55, 0.65, 0.16, 6),
        reactorSlateMat
      );
      pad.position.y = -0.45;
      nodeHolder.add(pad);

      this.v02CubeNodes.push(nodeHolder);
      this.v02CoreGroup.add(nodeHolder);
    });
  }

  /**
   * 四 (v0.3 专属)：正中心流线型暗金属未来核心 + 圆形拉丝钛金属底座 + 优雅发光青色数据管道网络
   * Strictly unified cool palette (brushed titanium, carbon fiber, matte black metal, sparse cyan/blue LEDs)
   */
  private buildV03SleekCoreAndCyanPipelines(zonesData: ZoneConfig[]) {
    const brushedTitanium = this.nodePalette.v03.brushedTitaniumMat;
    const carbonFiber = this.nodePalette.v03.carbonFiberMat;
    const matteBlackMetal = this.nodePalette.v03.matteBlackMat;
    const cyanStripMat = new THREE.MeshBasicMaterial({
      color: 0x00d4ff,
      transparent: true,
      opacity: 0.92,
    });
    const blueStripMat = new THREE.MeshBasicMaterial({
      color: 0x0ea5e9,
      transparent: true,
      opacity: 0.85,
    });

    // 1) 正中心精密圆形阶梯底座 (Sleek Circular Base)
    const outerBaseDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(4.45, 4.75, 0.28, 64),
      matteBlackMetal
    );
    outerBaseDisc.position.y = -0.42;

    const midTitaniumPlinth = new THREE.Mesh(
      new THREE.CylinderGeometry(3.35, 3.6, 0.32, 64),
      brushedTitanium
    );
    midTitaniumPlinth.position.y = -0.14;

    const innerCarbonCollar = new THREE.Mesh(
      new THREE.CylinderGeometry(2.15, 2.38, 0.36, 48),
      carbonFiber
    );
    innerCarbonCollar.position.y = 0.18;

    this.v03CoreGroup.add(outerBaseDisc, midTitaniumPlinth, innerCarbonCollar);

    // 圆形底座上的地面投射式微光刻度槽 (Floor-Projected Cyan Rings on Circular Base)
    [4.32, 3.25, 2.08].forEach((r, idx) => {
      const groove = new THREE.Mesh(
        new THREE.RingGeometry(r - 0.025, r + 0.025, 96),
        idx === 1 ? cyanStripMat : blueStripMat
      );
      groove.rotation.x = -Math.PI / 2;
      groove.position.y = -0.26 + idx * 0.22;
      this.v03CoreGroup.add(groove);
    });

    // 12 组环绕圆形底座的拉丝钛金属散热鳍片支脚
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const strut = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.34, 1.15),
        brushedTitanium
      );
      strut.position.set(Math.sin(a) * 3.1, 0.04, Math.cos(a) * 3.1);
      strut.rotation.y = a;
      this.v03CoreGroup.add(strut);
    }

    // 2) v0.3 专属：环绕中央八角等离子核心的外圈暗黑钛金属重装冷却环廊（不遮挡正中心的高能橙红等离子光束与全息约束罩）
    this.v03CoreTurbineGroup.position.set(0, 0.15, 0);

    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const rib = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 1.15, 0.28),
        brushedTitanium
      );
      rib.position.set(Math.sin(a) * 2.52, 0.58, Math.cos(a) * 2.52);
      rib.rotation.y = a;
      rib.rotation.x = -0.18;

      const dataStrip = new THREE.Mesh(
        new THREE.BoxGeometry(0.024, 0.92, 0.03),
        i % 2 === 0 ? cyanStripMat : blueStripMat
      );
      dataStrip.position.set(0, 0, 0.145);
      rib.add(dataStrip);
      this.v03CoreTurbineGroup.add(rib);
    }

    // 外部精密水平暗金属稳定环 (Horizontal Sleek Dark Metal Ring around Console Base)
    this.v03CoreGimbalA.position.set(0, 0.82, 0);
    const gimbalMeshA = new THREE.Mesh(
      new THREE.TorusGeometry(2.68, 0.042, 12, 72),
      brushedTitanium
    );
    gimbalMeshA.rotation.x = Math.PI / 2;
    const gimbalCyanA = new THREE.Mesh(
      new THREE.TorusGeometry(2.61, 0.014, 8, 72),
      cyanStripMat
    );
    gimbalCyanA.rotation.x = Math.PI / 2;
    this.v03CoreGimbalA.add(gimbalMeshA, gimbalCyanA);

    this.v03CoreGimbalB.position.set(0, 1.18, 0);
    const gimbalMeshB = new THREE.Mesh(
      new THREE.TorusGeometry(2.38, 0.032, 12, 72),
      matteBlackMetal
    );
    gimbalMeshB.rotation.x = Math.PI / 2;
    this.v03CoreGimbalB.add(gimbalMeshB);

    this.v03CoreGroup.add(
      this.v03CoreTurbineGroup,
      this.v03CoreGimbalA,
      this.v03CoreGimbalB
    );

    // 3) 优雅流光青色数据管道网络 + 流动光粒子流 (Animated ShaderMaterial + Flowing Particle Streams)
    this.pipeParticleSpriteTex = this.createRadialGlowTexture([
      [0, 'rgba(230, 252, 255, 1.0)'],
      [0.32, 'rgba(0, 212, 255, 0.88)'],
      [0.7, 'rgba(0, 180, 255, 0.24)'],
      [1, 'rgba(0, 0, 0, 0)'],
    ]);

    zonesData.forEach((z, idx) => {
      const targetPos = new THREE.Vector3(z.position[0], 0.0, z.position[2]);
      const dir = targetPos.clone().setY(0).normalize();
      const startPt = dir.clone().multiplyScalar(4.15).setY(-0.08);
      const endPt = targetPos.clone().addScaledVector(dir, -4.45).setY(0.04);
      const midPt = startPt.clone().lerp(endPt, 0.5);
      midPt.y = 0.22;

      // 中央暗黑金属护套管 + 两侧流光青色光纤管道 + 流动光粒子
      const ortho = new THREE.Vector3(-dir.z, 0, dir.x);
      [-0.16, 0.16].forEach((offset, pIdx) => {
        const pStart = startPt.clone().addScaledVector(ortho, offset);
        const pMid = midPt.clone().addScaledVector(ortho, offset);
        const pEnd = endPt.clone().addScaledVector(ortho, offset);
        const curve = new THREE.QuadraticBezierCurve3(pStart, pMid, pEnd);
        const tubeGeo = new THREE.TubeGeometry(curve, 44, 0.028, 8, false);
        const pipeMat = new THREE.ShaderMaterial({
          uniforms: {
            uTime: this.sharedUniforms.uTime,
            uColor: { value: new THREE.Color(pIdx === 0 ? 0x00d4ff : 0x0ea5e9) },
            uDir: { value: pIdx === 0 ? 1.0 : -1.0 },
          },
          vertexShader: accessPipeVertexShader,
          fragmentShader: accessPipeFragmentShader,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        this.v03PipesGroup.add(new THREE.Mesh(tubeGeo, pipeMat));

        // 每条管道配套 18 颗沿着曲线流动的青色光粒子，令链路呈现持续流光生命感
        const pCount = 18;
        const positions = new Float32Array(pCount * 3);
        const offsets = new Float32Array(pCount);
        for (let k = 0; k < pCount; k++) {
          offsets[k] = k / pCount + (pIdx * 0.04);
          const pt = curve.getPointAt(offsets[k] % 1);
          positions[k * 3] = pt.x;
          positions[k * 3 + 1] = pt.y + 0.03;
          positions[k * 3 + 2] = pt.z;
        }
        const pGeo = new THREE.BufferGeometry();
        pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const pMat = new THREE.PointsMaterial({
          map: this.pipeParticleSpriteTex,
          color: pIdx === 0 ? 0xa5f3fc : 0x38bdf8,
          size: 0.34,
          transparent: true,
          opacity: 0.96,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const points = new THREE.Points(pGeo, pMat);
        this.v03PipesGroup.add(points);
        this.pipeParticleStreams.push({
          curve,
          points,
          offsets,
          speed: pIdx === 0 ? 0.36 : 0.28,
          dir: pIdx === 0 ? 1 : -1,
        });
      });

      // 管道底部的暗黑钛金属线槽导轨
      const trayLen = startPt.distanceTo(endPt);
      const trayPos = startPt.clone().lerp(endPt, 0.5);
      const tray = new THREE.Mesh(
        new THREE.BoxGeometry(0.46, 0.05, trayLen),
        matteBlackMetal
      );
      tray.position.set(trayPos.x, -0.08, trayPos.z);
      tray.rotation.y = Math.atan2(dir.x, dir.z);
      this.v03PipesGroup.add(tray);

      // 衔接相邻六边形平台的发丝级发光青蓝激光环线
      const nextZ = zonesData[(idx + 1) % zonesData.length];
      const nextPos = new THREE.Vector3(nextZ.position[0], -0.1, nextZ.position[2]);
      const curPos = new THREE.Vector3(z.position[0], -0.1, z.position[2]);
      const linkDir = nextPos.clone().sub(curPos).normalize();
      const lStart = curPos.clone().addScaledVector(linkDir, 4.55);
      const lEnd = nextPos.clone().addScaledVector(linkDir, -4.55);
      const lMid = lStart.clone().lerp(lEnd, 0.5);
      lMid.multiplyScalar(1.04);
      lMid.y = -0.05;

      const ringCurve = new THREE.QuadraticBezierCurve3(lStart, lMid, lEnd);
      const ringGeo = new THREE.TubeGeometry(ringCurve, 32, 0.022, 6, false);
      const ringMat = new THREE.ShaderMaterial({
        uniforms: {
          uTime: this.sharedUniforms.uTime,
          uColor: { value: new THREE.Color(0x00d4ff) },
          uDir: { value: 1.0 },
        },
        vertexShader: accessPipeVertexShader,
        fragmentShader: accessPipeFragmentShader,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      this.v03PipesGroup.add(new THREE.Mesh(ringGeo, ringMat));
    });
  }

  /**
   * 四 (v0.4 专属)：正中心半透明光学玻璃核心 + 内部多层悬浮发光能量环 + 抛光纯银与磨砂白陶瓷基座
   * "In the center, a translucent glass core with glowing inner rings."
   */
  private buildV04TranslucentGlassCore() {
    const silverTex = createV04PolishedSilverTexture(this.maxAnisotropy);

    const polishedSilverMat = new THREE.MeshStandardMaterial({
      color: 0xeef2f6,
      map: silverTex,
      bumpMap: silverTex,
      bumpScale: 0.006,
      metalness: 0.98,
      roughness: 0.08,
      envMapIntensity: 2.85,
    });
    const frostedWhiteCeramicMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.18,
      metalness: 0.2,
      envMapIntensity: 2.1,
    });
    const translucentGlassMat = new THREE.MeshStandardMaterial({
      color: 0xdbeafe,
      emissive: 0x0284c7,
      emissiveIntensity: 0.22,
      metalness: 0.16,
      roughness: 0.06,
      transparent: true,
      opacity: 0.36,
      depthWrite: false,
      envMapIntensity: 2.45,
      side: THREE.DoubleSide,
    });
    const cyanInnerRingMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.96,
    });
    const blueInnerRingMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.9,
    });

    // 1) 磨砂白陶瓷与抛光纯银双层圆形阶梯基座
    const outerCeramicDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(4.45, 4.75, 0.28, 64),
      frostedWhiteCeramicMat
    );
    outerCeramicDisc.position.y = -0.42;

    const midSilverPlinth = new THREE.Mesh(
      new THREE.CylinderGeometry(3.35, 3.6, 0.32, 64),
      polishedSilverMat
    );
    midSilverPlinth.position.y = -0.14;

    const innerGlassCollar = new THREE.Mesh(
      new THREE.CylinderGeometry(2.18, 2.42, 0.36, 48),
      translucentGlassMat
    );
    innerGlassCollar.position.y = 0.18;

    this.v04CoreGroup.add(outerCeramicDisc, midSilverPlinth, innerGlassCollar);

    // 基座表面 3 道发光冰青同心导光环
    [4.32, 3.25, 2.08].forEach((r, idx) => {
      const groove = new THREE.Mesh(
        new THREE.RingGeometry(r - 0.028, r + 0.028, 96),
        idx === 1 ? cyanInnerRingMat : blueInnerRingMat
      );
      groove.rotation.x = -Math.PI / 2;
      groove.position.y = -0.26 + idx * 0.22;
      this.v04CoreGroup.add(groove);
    });

    // 12 组环绕基座的抛光纯银辐射支撑翼片
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const strut = new THREE.Mesh(
        new THREE.BoxGeometry(0.15, 0.32, 1.15),
        polishedSilverMat
      );
      strut.position.set(Math.sin(a) * 3.1, 0.04, Math.cos(a) * 3.1);
      strut.rotation.y = a;
      this.v04CoreGroup.add(strut);
    }

    // 2) 中央高透光学玻璃核心主塔 (Translucent Glass Core)
    const glassTowerGroup = new THREE.Group();
    glassTowerGroup.position.set(0, 0.35, 0);

    const outerGlassCylinder = new THREE.Mesh(
      new THREE.CylinderGeometry(1.42, 1.52, 2.68, 48, 1, false),
      translucentGlassMat
    );
    outerGlassCylinder.position.y = 1.68;

    const innerGlassChamber = new THREE.Mesh(
      new THREE.CylinderGeometry(0.95, 0.95, 2.45, 36, 1, true),
      translucentGlassMat
    );
    innerGlassChamber.position.y = 1.68;

    const topSilverCrown = new THREE.Mesh(
      new THREE.CylinderGeometry(1.08, 1.46, 0.22, 48),
      polishedSilverMat
    );
    topSilverCrown.position.y = 3.12;

    const topCeramicCap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.62, 0.92, 0.2, 36),
      frostedWhiteCeramicMat
    );
    topCeramicCap.position.y = 3.32;

    glassTowerGroup.add(
      outerGlassCylinder,
      innerGlassChamber,
      topSilverCrown,
      topCeramicCap
    );

    // 3) 玻璃核心内部清晰可见的 6 层发光能量内环与中轴光柱 (Glowing Inner Rings inside Translucent Glass Core)
    const centralLightSpine = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.22, 2.55, 24),
      cyanInnerRingMat
    );
    centralLightSpine.position.y = 1.65;
    glassTowerGroup.add(centralLightSpine);

    [0.75, 1.12, 1.48, 1.84, 2.2, 2.56].forEach((ry, idx) => {
      const rRadius = 0.68 + Math.sin((idx / 5) * Math.PI) * 0.38;
      const innerRing = new THREE.Mesh(
        new THREE.TorusGeometry(rRadius, idx % 2 === 0 ? 0.042 : 0.028, 14, 64),
        idx % 2 === 0 ? cyanInnerRingMat : blueInnerRingMat
      );
      innerRing.position.y = ry;
      innerRing.rotation.x = Math.PI / 2 + (idx % 2 === 0 ? 0.14 : -0.14);
      this.v04CoreInnerRings.push(innerRing);
      glassTowerGroup.add(innerRing);
    });

    // 6 根环绕透明玻璃舱壁的抛光纯银精密立柱与冰蓝导光条
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const silverRib = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 2.62, 0.18),
        polishedSilverMat
      );
      silverRib.position.set(Math.sin(a) * 1.48, 1.68, Math.cos(a) * 1.48);
      silverRib.rotation.y = a;

      const ledLine = new THREE.Mesh(
        new THREE.BoxGeometry(0.024, 2.32, 0.03),
        i % 2 === 0 ? cyanInnerRingMat : blueInnerRingMat
      );
      ledLine.position.set(0, 0, 0.095);
      silverRib.add(ledLine);
      glassTowerGroup.add(silverRib);
    }

    // 外部抛光纯银与冰青光环组合而成的悬浮陀螺稳定环
    this.v04CoreOuterGimbal.position.set(0, 1.85, 0);
    const outerSilverGimbal = new THREE.Mesh(
      new THREE.TorusGeometry(2.02, 0.046, 14, 80),
      polishedSilverMat
    );
    outerSilverGimbal.rotation.x = Math.PI * 0.46;
    const outerCyanHalo = new THREE.Mesh(
      new THREE.TorusGeometry(1.94, 0.018, 10, 80),
      cyanInnerRingMat
    );
    outerCyanHalo.rotation.x = Math.PI * 0.46;
    this.v04CoreOuterGimbal.add(outerSilverGimbal, outerCyanHalo);

    this.v04CoreGroup.add(glassTowerGroup, this.v04CoreOuterGimbal);
  }

  /**
   * 五、zoneGroup[7]：多层级重装六边形浮空平台 + 支持 v0.1 / v0.2 / v0.3 / v0.4 四版本外观切换
   */
  private buildZones(zonesData: ZoneConfig[]) {
    this.hullDarkMat = new THREE.MeshStandardMaterial({
      color: 0x445566,
      metalness: 0.7,
      roughness: 0.4,
    });
    this.rimSilverMat = new THREE.MeshStandardMaterial({
      color: 0x667788,
      metalness: 0.7,
      roughness: 0.4,
    });

    zonesData.forEach((zCfg, zIdx) => {
      const root = new THREE.Group();
      root.position.set(zCfg.position[0], zCfg.position[1], zCfg.position[2]);

      const platformGroup = new THREE.Group();
      root.add(platformGroup);

      const baseHeight = 0.56;
      const baseYOffset = 0;

      // 1) 上层外圈重型装甲边框 + 主六棱甲板 + 下层倒锥形推进底壳 + 6 组顶点防撞墩
      const solidPlatformMeshes: THREE.Mesh[] = [];

      const outerCollar = new THREE.Mesh(
        new THREE.CylinderGeometry(4.85, 4.95, 0.24, 6),
        this.rimSilverMat
      );
      outerCollar.position.y = -0.12 + baseYOffset;

      const hexGeo = new THREE.CylinderGeometry(4.62, 4.62, baseHeight, 6);
      const hexMesh = new THREE.Mesh(hexGeo, this.hullDarkMat);
      hexMesh.position.y = -baseHeight / 2 + baseYOffset;

      const underHull = new THREE.Mesh(
        new THREE.CylinderGeometry(4.15, 2.35, 0.72, 6),
        this.hullDarkMat
      );
      underHull.position.y = -baseHeight - 0.35 + baseYOffset;

      platformGroup.add(outerCollar, hexMesh, underHull);
      solidPlatformMeshes.push(outerCollar, hexMesh, underHull);

      for (let k = 0; k < 6; k++) {
        const ka = (k / 6) * Math.PI * 2 + Math.PI / 6;
        const bumper = new THREE.Mesh(
          new THREE.BoxGeometry(0.52, 0.38, 0.36),
          this.rimSilverMat
        );
        bumper.position.set(
          Math.sin(ka) * 4.74,
          -0.08 + baseYOffset,
          Math.cos(ka) * 4.74
        );
        bumper.rotation.y = ka;
        platformGroup.add(bumper);
        solidPlatformMeshes.push(bumper);
      }

      const v02ArmorGroup = new THREE.Group();

      // 2) 顶面工程甲板 Shader 平面 (支持 v0.3 暗黑碳纤维与 v0.4 磨砂玻璃平台甲板)
      const topShaderMat = new THREE.ShaderMaterial({
        uniforms: {
          uTime: this.sharedUniforms.uTime,
          uColor: { value: new THREE.Color(0x00d4ff) },
          uPhase: { value: zIdx * 0.85 },
          uDarkMode: this.sharedUniforms.uDarkMode,
          uFuturisticMode: this.sharedUniforms.uFuturisticMode,
        },
        vertexShader: zonePlatformVertexShader,
        fragmentShader: zonePlatformFragmentShader,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const topCap = new THREE.Mesh(
        new THREE.CylinderGeometry(4.45, 4.45, 0.01, 6),
        topShaderMat
      );
      topCap.position.y = 0.015 + baseYOffset;
      platformGroup.add(topCap);
      solidPlatformMeshes.push(topCap);

      // 3) 边缘描边线
      const edgeNeonMat = new THREE.LineBasicMaterial({
        color: 0x0284c7,
        transparent: true,
        opacity: 0.45,
      });
      const edgeNeon = new THREE.LineSegments(new THREE.EdgesGeometry(hexGeo), edgeNeonMat);
      edgeNeon.position.copy(hexMesh.position);
      platformGroup.add(edgeNeon);

      // 4) 向下悬浮推进光锥
      const underBeamMat = new THREE.MeshBasicMaterial({
        color: 0x0284c7,
        transparent: true,
        opacity: 0.02,
        side: THREE.BackSide,
        depthWrite: false,
      });
      const underBeam = new THREE.Mesh(
        new THREE.CylinderGeometry(3.8, 0.9, 2.4, 6, 1, true),
        underBeamMat
      );
      underBeam.position.y = -1.6;
      platformGroup.add(underBeam);
      solidPlatformMeshes.push(underBeam);

      // 5) v0.3 / v0.5 专属：7 大分区差异化核心工业设备总成 + 地面微光刻度环 + 全息中文标牌
      const v01DecorGroup = new THREE.Group();
      const v04CenterHardwareGroup = new THREE.Group();
      const updateCustomDecor = undefined;

      const v03CenterHardwareGroup = this.buildV03PlatformCenterHardware(
        zCfg,
        baseYOffset,
        false
      );
      platformGroup.add(v03CenterHardwareGroup);

      // 6) 0.1版 (Tron 赛博线框风) 专属：六边形边缘轮廓线 (纯青色 0x00d4ff + opacity: 0.9 + AdditiveBlending 发光霓虹质感)
      const v01TronPrimaryMat = new THREE.LineBasicMaterial({
        color: 0x00d4ff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const v01TronSeamMat = new THREE.LineBasicMaterial({
        color: 0x00d4ff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const v01TronPlatformWireGroup = new THREE.Group();

      const hexTopY = 0.02 + baseYOffset;
      const hexBotY = -baseHeight + baseYOffset;
      const hexR = 4.78;
      const innerHexR = 4.22;
      const primaryHexPts: THREE.Vector3[] = [];
      const seamHexPts: THREE.Vector3[] = [];

      for (let k = 0; k < 6; k++) {
        const a0 = (k / 6) * Math.PI * 2;
        const a1 = ((k + 1) / 6) * Math.PI * 2;
        const x0 = Math.sin(a0) * hexR;
        const z0 = Math.cos(a0) * hexR;
        const x1 = Math.sin(a1) * hexR;
        const z1 = Math.cos(a1) * hexR;

        // 顶部六边形轮廓边 + 底部六边形轮廓边 + 连接底部与顶部的垂直细线表现平台厚度
        primaryHexPts.push(
          new THREE.Vector3(x0, hexTopY, z0),
          new THREE.Vector3(x1, hexTopY, z1),
          new THREE.Vector3(x0, hexBotY, z0),
          new THREE.Vector3(x1, hexBotY, z1),
          new THREE.Vector3(x0, hexBotY, z0),
          new THREE.Vector3(x0, hexTopY, z0)
        );

        // 内圈甲板接缝六边形 + 放射对角支撑线 (0x88eeff, opacity: 0.4)
        const ix0 = Math.sin(a0) * innerHexR;
        const iz0 = Math.cos(a0) * innerHexR;
        const ix1 = Math.sin(a1) * innerHexR;
        const iz1 = Math.cos(a1) * innerHexR;
        seamHexPts.push(
          new THREE.Vector3(ix0, hexTopY, iz0),
          new THREE.Vector3(ix1, hexTopY, iz1),
          new THREE.Vector3(ix0, hexTopY, iz0),
          new THREE.Vector3(x0, hexTopY, z0)
        );
      }

      v01TronPlatformWireGroup.add(
        new THREE.LineSegments(
          new THREE.BufferGeometry().setFromPoints(primaryHexPts),
          v01TronPrimaryMat
        ),
        new THREE.LineSegments(
          new THREE.BufferGeometry().setFromPoints(seamHexPts),
          v01TronSeamMat
        )
      );

      // 将平台中央核心硬件总成也提取为纯发光线框
      const centerHwWire = buildTronWireframeFromGroup(
        v03CenterHardwareGroup,
        v01TronPrimaryMat,
        v01TronSeamMat
      );
      v01TronPlatformWireGroup.add(centerHwWire);
      v01TronPlatformWireGroup.visible = false;
      platformGroup.add(v01TronPlatformWireGroup);

      const { mesh: v03FloorProjMesh, redraw: v03FloorProjRedraw } =
        createV03FloorProjectionMesh(this.maxAnisotropy);
      platformGroup.add(v03FloorProjMesh);

      const telemetrySprite = new THREE.Sprite();
      const v02PlaqueSprite = new THREE.Sprite();
      const v03LabelSprite = createV03ZoneLabelSprite(zCfg, this.maxAnisotropy);
      platformGroup.add(v03LabelSprite);

      const dirToCenter = new THREE.Vector3(-zCfg.position[0], 0, -zCfg.position[2]).normalize();
      const innerEdgeWorld = new THREE.Vector3(
        zCfg.position[0] + dirToCenter.x * 4.35,
        0.15,
        zCfg.position[2] + dirToCenter.z * 4.35
      );

      // 8) 5 台高精度算力设备（支持 0.1 赛博线框版 / 0.2 暗黑金属版 七大分区专属差异化硬件设备集群）
      const nodesMap = new Map<string, THREE.Group>();
      const N = zCfg.challenges.length;
      const R = 2.85;
      zCfg.challenges.forEach((ch, idx) => {
        const ang = -Math.PI / 2 + (idx / N) * Math.PI * 2;
        const v01Pos = new THREE.Vector3(Math.cos(ang) * R, baseYOffset, Math.sin(ang) * R);
        const v01RotY = -ang + Math.PI / 2;

        const node = createChallengeNode(
          ch,
          zCfg.color,
          zCfg.colorHex,
          this.maxAnisotropy,
          {
            dioramaType: zCfg.v02Diorama,
            slotIndex: idx,
            v02Color: zCfg.v02Color,
            v01Pos,
            v01RotY,
            initialVersion: this.currentVersion,
            palette: this.nodePalette,
          }
        );

        const labelHeights = [2.62, 2.74, 2.86, 2.74, 2.62];
        const nodeUd = node.userData as ChallengeNodeUserData;
        nodeUd.label.position.y = labelHeights[idx % 5];
        nodeUd.onAttemptExpired = () => {
          const zr = this.zones.get(zCfg.id);
          if (zr) this.refreshZoneTelemetry(zr);
          this.onStatsSync?.();
        };

        platformGroup.add(node);
        nodesMap.set(ch.id, node);
        this.allChallengeNodes.push(node);
        this.pickTargets.push((node.userData as ChallengeNodeUserData).body);
      });

      this.worldGroup.add(root);
      this.zones.set(zCfg.id, {
        config: zCfg,
        root,
        platformGroup,
        v01DecorGroup,
        v02ArmorGroup,
        v03CenterHardwareGroup,
        v04CenterHardwareGroup,
        v01TronPlatformWireGroup,
        v01TronPrimaryMat,
        v01TronSeamMat,
        solidPlatformMeshes,
        v03FloorProjMesh,
        v03FloorProjRedraw,
        topShaderMat,
        underBeamMat,
        underHullMesh: underHull,
        edgeNeonMat,
        edgeHighlightTimer: 0,
        telemetrySprite,
        v02PlaqueSprite,
        v03LabelSprite,
        telemetryBounceTimer: 0,
        displayedScore: zCfg.score,
        targetScore: zCfg.score,
        innerEdgePoint: innerEdgeWorld,
        nodes: nodesMap,
        updateCustomDecor,
      });
    });
  }

  /**
   * 5.3 (v0.3 / v0.4 专属)：7 大平台中央专属硬件总成
   * - v0.3: Gunmetal Gray, Dark Silver Metallic, Carbon Fiber
   * - v0.4: Polished Silver Metal, Frosted White Ceramic, Transparent Acrylic Glass
   */
  private buildV03PlatformCenterHardware(
    zCfg: ZoneConfig,
    baseYOffset: number,
    isV04 = false
  ): THREE.Group {
    const group = new THREE.Group();
    group.position.y = baseYOffset;

    const matSet = isV04 ? this.nodePalette.v04 : this.nodePalette.v03;
    const matteBlack = matSet.matteBlackMat;
    const brushedTitanium = matSet.brushedTitaniumMat;
    const carbonMat = matSet.carbonFiberMat;
    const edgeRimMat = matSet.metalEdgeRimMat;
    const cyanLed = matSet.pureCyanGlowMat;
    const blueStrip = matSet.deepBlueGlowMat;

    // 底部防震承重台 + 强边缘逆光勾勒线
    const plinthGeo = new THREE.BoxGeometry(1.56, 0.12, 1.24);
    const plinth = new THREE.Mesh(plinthGeo, carbonMat);
    plinth.position.y = 0.06;
    plinth.add(new THREE.LineSegments(new THREE.EdgesGeometry(plinthGeo), edgeRimMat));
    group.add(plinth);

    switch (zCfg.id) {
      case 'ai-access': {
        // 1. AI应用接入: 中央重型多刀片边缘网关核心路由器与硬件防火墙总成
        [-0.36, 0.36].forEach((xOff) => {
          const chassisGeo = new THREE.BoxGeometry(0.62, 1.48, 0.88);
          const chassis = new THREE.Mesh(chassisGeo, matteBlack);
          chassis.position.set(xOff, 0.86, 0);
          chassis.add(
            new THREE.LineSegments(new THREE.EdgesGeometry(chassisGeo), edgeRimMat)
          );
          group.add(chassis);

          for (let u = 0; u < 4; u++) {
            const bladeGeo = new THREE.BoxGeometry(0.56, 0.24, 0.84);
            const blade = new THREE.Mesh(bladeGeo, brushedTitanium);
            blade.position.set(xOff, 0.38 + u * 0.32, 0.03);
            blade.add(
              new THREE.LineSegments(new THREE.EdgesGeometry(bladeGeo), edgeRimMat)
            );
            group.add(blade);

            // v0.3: 仅保留极微小稀疏的深青色状态指示灯点 (Tiny sparse deep-cyan LEDs)
            if (isV04 || u % 2 === 0) {
              const led = new THREE.Mesh(
                new THREE.BoxGeometry(isV04 ? 0.42 : 0.035, 0.018, 0.02),
                u % 2 === 0 ? cyanLed : blueStrip
              );
              led.position.set(
                isV04 ? xOff : xOff - 0.2,
                0.38 + u * 0.32,
                0.46
              );
              group.add(led);
            }
          }
        });
        const topBridgeGeo = new THREE.BoxGeometry(1.48, 0.08, 0.42);
        const topBridge = new THREE.Mesh(topBridgeGeo, brushedTitanium);
        topBridge.position.set(0, 1.66, 0);
        topBridge.add(
          new THREE.LineSegments(new THREE.EdgesGeometry(topBridgeGeo), edgeRimMat)
        );
        group.add(topBridge);
        break;
      }

      case 'inference': {
        // 2. 模型推理: 中央大型 CDU 液冷分配中心 + 粗壮外露导液管总成 (Thick Liquid Cooling Pipes)
        const cduGeo = new THREE.BoxGeometry(0.92, 1.68, 0.86);
        const cduTower = new THREE.Mesh(cduGeo, matteBlack);
        cduTower.position.set(0, 0.96, 0);
        cduTower.add(
          new THREE.LineSegments(new THREE.EdgesGeometry(cduGeo), edgeRimMat)
        );
        group.add(cduTower);

        [-0.52, 0.52].forEach((xOff) => {
          const tank = new THREE.Mesh(
            new THREE.CylinderGeometry(0.15, 0.15, 1.54, 20),
            brushedTitanium
          );
          tank.position.set(xOff, 0.89, 0.16);
          group.add(tank);

          if (isV04) {
            const sightGlass = new THREE.Mesh(
              new THREE.CylinderGeometry(0.154, 0.154, 0.95, 20, 1, true),
              cyanLed
            );
            sightGlass.position.set(xOff, 0.89, 0.16);
            group.add(sightGlass);
          } else {
            // v0.3: 稀疏深青液位小视窗点
            const tinySight = new THREE.Mesh(
              new THREE.BoxGeometry(0.028, 0.08, 0.02),
              cyanLed
            );
            tinySight.position.set(xOff, 1.15, 0.31);
            group.add(tinySight);
          }

          // 加粗重型液冷弧形主管 (Thick Liquid Cooling Pipes, radius = 0.068)
          const pipeCurve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(xOff, 1.66, 0.16),
            new THREE.Vector3(xOff * 0.65, 1.96, 0.05),
            new THREE.Vector3(xOff * 0.25, 1.78, -0.18),
          ]);
          const pipeMesh = new THREE.Mesh(
            new THREE.TubeGeometry(pipeCurve, 20, 0.068, 12, false),
            brushedTitanium
          );
          group.add(pipeMesh);
        });
        break;
      }

      case 'agent': {
        // 3. 智能体编排: 中央环形四联弧面监控指挥总台
        const pedestalGeo = new THREE.CylinderGeometry(0.32, 0.46, 0.88, 8);
        const pedestal = new THREE.Mesh(pedestalGeo, carbonMat);
        pedestal.position.y = 0.56;
        pedestal.add(
          new THREE.LineSegments(new THREE.EdgesGeometry(pedestalGeo), edgeRimMat)
        );
        group.add(pedestal);

        const darkScreenMat = new THREE.MeshStandardMaterial({
          color: 0x0b192c,
          emissive: 0x004c6d,
          emissiveIntensity: 0.42,
          roughness: 0.15,
          metalness: 0.3,
        });

        for (let i = 0; i < 4; i++) {
          const ang = (i / 4) * Math.PI * 2 + Math.PI / 4;
          const monGroup = new THREE.Group();
          monGroup.position.set(Math.cos(ang) * 0.48, 1.16, Math.sin(ang) * 0.48);
          monGroup.rotation.y = -ang + Math.PI / 2;

          const frameGeo = new THREE.BoxGeometry(0.68, 0.38, 0.04);
          const frame = new THREE.Mesh(frameGeo, brushedTitanium);
          frame.add(
            new THREE.LineSegments(new THREE.EdgesGeometry(frameGeo), edgeRimMat)
          );
          const screen = new THREE.Mesh(
            new THREE.PlaneGeometry(0.62, 0.32),
            isV04 ? (i % 2 === 0 ? cyanLed : blueStrip) : darkScreenMat
          );
          screen.position.z = 0.025;
          monGroup.add(frame, screen);
          group.add(monGroup);
        }
        break;
      }

      case 'knowledge': {
        // 4. 知识库: 中央双子巨型高密磁盘存储阵列核心柜 (Massive Storage Arrays with Dense Disk Bays)
        [-0.38, 0.38].forEach((xOff) => {
          const vaultGeo = new THREE.BoxGeometry(0.64, 1.62, 0.96);
          const vault = new THREE.Mesh(vaultGeo, matteBlack);
          vault.position.set(xOff, 0.93, 0);
          vault.add(
            new THREE.LineSegments(new THREE.EdgesGeometry(vaultGeo), edgeRimMat)
          );
          group.add(vault);

          for (let r = 0; r < 8; r++) {
            const bayRow = new THREE.Mesh(
              new THREE.BoxGeometry(0.56, 0.12, 0.03),
              brushedTitanium
            );
            bayRow.position.set(xOff, 0.32 + r * 0.17, 0.48);
            group.add(bayRow);

            // v0.3: 仅稀疏点亮极小深青色硬盘指示灯点
            if (isV04 || r % 3 === 0) {
              const bayLed = new THREE.Mesh(
                new THREE.BoxGeometry(isV04 ? 0.48 : 0.032, 0.016, 0.015),
                r % 3 === 0 ? cyanLed : blueStrip
              );
              bayLed.position.set(
                isV04 ? xOff : xOff - 0.21 + (r % 2) * 0.18,
                0.32 + r * 0.17,
                0.5
              );
              group.add(bayLed);
            }
          }
        });
        break;
      }

      case 'compute': {
        // 5. 算力调度: 中央重型工业算力服务器 + 金属散热鳍片塔 (Heavy Industrial Compute Servers with Metallic Heat Sinks)
        const coreBlockGeo = new THREE.BoxGeometry(1.18, 1.56, 0.92);
        const coreBlock = new THREE.Mesh(coreBlockGeo, matteBlack);
        coreBlock.position.set(0, 0.9, 0);
        coreBlock.add(
          new THREE.LineSegments(new THREE.EdgesGeometry(coreBlockGeo), edgeRimMat)
        );
        group.add(coreBlock);

        for (let f = 0; f < 11; f++) {
          const finGeo = new THREE.BoxGeometry(1.26, 0.052, 0.98);
          const fin = new THREE.Mesh(finGeo, brushedTitanium);
          fin.position.set(0, 0.28 + f * 0.13, 0);
          if (f === 0 || f === 5 || f === 10) {
            fin.add(
              new THREE.LineSegments(new THREE.EdgesGeometry(finGeo), edgeRimMat)
            );
          }
          group.add(fin);

          // v0.3 下散热鳍片保持纯粹高反光金属质感，仅在正面边角点缀 2 颗极小深青指示灯
          if (isV04 && f % 3 === 0) {
            const glowCore = new THREE.Mesh(
              new THREE.BoxGeometry(1.2, 0.02, 0.94),
              f % 6 === 0 ? cyanLed : blueStrip
            );
            glowCore.position.set(0, 0.34 + f * 0.13, 0);
            group.add(glowCore);
          } else if (!isV04 && (f === 3 || f === 8)) {
            const tinyLed = new THREE.Mesh(
              new THREE.BoxGeometry(0.032, 0.016, 0.02),
              cyanLed
            );
            tinyLed.position.set(-0.48, 0.28 + f * 0.13, 0.5);
            group.add(tinyLed);
          }
        }
        break;
      }

      case 'ops': {
        // 6. 运维保障: 中央主雷达阵列塔 + 双侧安全日志审计服务器
        [-0.48, 0.48].forEach((xOff) => {
          const logGeo = new THREE.BoxGeometry(0.42, 1.24, 0.76);
          const logSrv = new THREE.Mesh(logGeo, matteBlack);
          logSrv.position.set(xOff, 0.74, 0);
          logSrv.add(
            new THREE.LineSegments(new THREE.EdgesGeometry(logGeo), edgeRimMat)
          );
          const tinyLed = new THREE.Mesh(
            new THREE.BoxGeometry(0.028, 0.016, 0.02),
            cyanLed
          );
          tinyLed.position.set(xOff - 0.12, 1.18, 0.39);
          group.add(logSrv, tinyLed);
        });

        const mast = new THREE.Mesh(
          new THREE.CylinderGeometry(0.08, 0.14, 1.65, 8),
          brushedTitanium
        );
        mast.position.set(0, 0.95, 0);
        group.add(mast);

        const dishGroup = new THREE.Group();
        dishGroup.position.set(0, 1.82, 0);
        dishGroup.rotation.x = -0.35;
        const dish = new THREE.Mesh(
          new THREE.ConeGeometry(0.58, 0.26, 24, 1, true),
          brushedTitanium
        );
        dish.rotation.x = Math.PI / 2;
        const dishRing = new THREE.Mesh(
          new THREE.TorusGeometry(0.58, isV04 ? 0.022 : 0.012, 8, 28),
          cyanLed
        );
        dishRing.position.z = 0.13;
        dishGroup.add(dish, dishRing);
        group.add(dishGroup);
        break;
      }

      case 'net':
      default: {
        // 7. 通信网络: 中央主干光纤通信高塔 + 纤细深青信号环
        const spireGeo = new THREE.CylinderGeometry(0.12, 0.36, 1.95, 6);
        const latticeSpire = new THREE.Mesh(spireGeo, brushedTitanium);
        latticeSpire.position.set(0, 1.09, 0);
        latticeSpire.add(
          new THREE.LineSegments(new THREE.EdgesGeometry(spireGeo), edgeRimMat)
        );
        group.add(latticeSpire);

        [1.15, 1.52, 1.88].forEach((ry, rIdx) => {
          const sigRing = new THREE.Mesh(
            new THREE.TorusGeometry(
              0.52 - rIdx * 0.1,
              isV04 ? 0.02 : 0.011,
              8,
              32
            ),
            rIdx % 2 === 0 ? cyanLed : blueStrip
          );
          sigRing.rotation.x = Math.PI / 2;
          sigRing.position.set(0, ry, 0);
          group.add(sigRing);
        });
        break;
      }
    }

    return group;
  }

  /**
   * 5.4 七大分区中央微缩主题地标（v0.1 精致机械结构）
   */
  private buildZoneUniqueDecoration(
    zCfg: ZoneConfig,
    parentGroup: THREE.Group,
    baseYOffset: number
  ): (dt: number, elapsed: number) => void {
    const decorGroup = new THREE.Group();
    decorGroup.position.y = baseYOffset;
    parentGroup.add(decorGroup);

    const metalMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.8,
      roughness: 0.25,
    });
    const accentMat = new THREE.MeshStandardMaterial({
      color: zCfg.color,
      emissive: zCfg.color,
      emissiveIntensity: 0.55,
      metalness: 0.4,
      roughness: 0.25,
    });

    const centerPedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.65, 0.82, 0.18, 6),
      metalMat
    );
    centerPedestal.position.y = 0.09;
    decorGroup.add(centerPedestal);

    if (zCfg.id === 'ai-access') {
      const towerGroup = new THREE.Group();
      towerGroup.position.y = 0.85;
      const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.38, 0), accentMat);
      const cage = new THREE.Mesh(
        new THREE.CylinderGeometry(0.48, 0.48, 1.2, 6, 1, true),
        new THREE.MeshBasicMaterial({ color: zCfg.color, wireframe: true })
      );
      towerGroup.add(core, cage);
      decorGroup.add(towerGroup);
      return (dt) => {
        towerGroup.rotation.y += dt * 0.9;
      };
    }

    if (zCfg.id === 'inference') {
      const cloudGroup = new THREE.Group();
      cloudGroup.position.y = 1.05;
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i < 24; i++) {
        pts.push(
          new THREE.Vector3(
            (Math.random() - 0.5) * 1.2,
            (Math.random() - 0.5) * 0.9,
            (Math.random() - 0.5) * 1.2
          )
        );
      }
      const ptsMesh = new THREE.Points(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.PointsMaterial({ color: zCfg.color, size: 0.11 })
      );
      const linePts: THREE.Vector3[] = [];
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          if (pts[i].distanceTo(pts[j]) < 0.72) {
            linePts.push(pts[i], pts[j]);
          }
        }
      }
      const linesMesh = new THREE.LineSegments(
        new THREE.BufferGeometry().setFromPoints(linePts),
        new THREE.LineBasicMaterial({ color: zCfg.color, transparent: true, opacity: 0.45 })
      );
      cloudGroup.add(ptsMesh, linesMesh);
      decorGroup.add(cloudGroup);
      return (dt) => {
        cloudGroup.rotation.y += dt * 0.45;
      };
    }

    if (zCfg.id === 'agent') {
      const orbitNodes: THREE.Mesh[] = [];
      const sphereGeo = new THREE.SphereGeometry(0.09, 8, 8);
      for (let i = 0; i < 8; i++) {
        const m = new THREE.Mesh(sphereGeo, accentMat);
        orbitNodes.push(m);
        decorGroup.add(m);
      }
      const hub = new THREE.Mesh(new THREE.TorusKnotGeometry(0.28, 0.06, 48, 8), accentMat);
      hub.position.y = 0.85;
      decorGroup.add(hub);
      return (dt, elapsed) => {
        hub.rotation.y += dt * 0.8;
        orbitNodes.forEach((m, idx) => {
          const a = elapsed * 0.85 + (idx / 8) * Math.PI * 2;
          m.position.set(Math.cos(a) * 4.2, 0.22, Math.sin(a) * 4.2);
        });
      };
    }

    if (zCfg.id === 'knowledge') {
      const platters: THREE.Mesh[] = [];
      for (let i = 0; i < 4; i++) {
        const disk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.48 - i * 0.04, 0.48 - i * 0.04, 0.06, 16),
          i % 2 === 0 ? accentMat : metalMat
        );
        disk.position.y = 0.35 + i * 0.22;
        platters.push(disk);
        decorGroup.add(disk);
      }
      return (dt, elapsed) => {
        platters.forEach((d, idx) => {
          d.rotation.y += dt * (idx % 2 === 0 ? 1.2 : -1.2);
          d.position.y = 0.35 + idx * 0.22 + Math.sin(elapsed * 2.5 + idx) * 0.03;
        });
      };
    }

    if (zCfg.id === 'compute') {
      const cubes: THREE.Mesh[] = [];
      const cubeGeo = new THREE.BoxGeometry(0.34, 0.34, 0.34);
      for (let i = 0; i < 3; i++) {
        const c = new THREE.Mesh(cubeGeo, accentMat);
        const a = (i / 3) * Math.PI * 2;
        c.position.set(Math.cos(a) * 0.55, 0.95, Math.sin(a) * 0.55);
        cubes.push(c);
        decorGroup.add(c);
      }
      return (dt, elapsed) => {
        cubes.forEach((c, idx) => {
          c.rotation.x += dt * 0.9;
          c.rotation.y += dt * 1.1;
          c.position.y = 0.95 + Math.sin(elapsed * 2.2 + idx * 2.0) * 0.16;
        });
      };
    }

    if (zCfg.id === 'ops') {
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.32, 0.7, 8), metalMat);
      mast.position.y = 0.45;
      const dishGroup = new THREE.Group();
      dishGroup.position.y = 0.92;
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.14, 0.16), accentMat);
      dishGroup.add(bar);
      decorGroup.add(mast, dishGroup);
      return (dt) => {
        dishGroup.rotation.y += dt * 2.0;
      };
    }

    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.75, 6), metalMat);
      post.position.set(Math.cos(a) * 4.35, 0.38, Math.sin(a) * 4.35);
      decorGroup.add(post);
    }
    const pulseRings: THREE.Mesh[] = [];
    for (let i = 0; i < 3; i++) {
      const pr = new THREE.Mesh(
        new THREE.RingGeometry(0.28, 0.35, 32),
        new THREE.MeshBasicMaterial({
          color: zCfg.color,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.55,
        })
      );
      pr.rotation.x = -Math.PI / 2;
      pr.position.y = 0.65 + i * 0.28;
      pulseRings.push(pr);
      decorGroup.add(pr);
    }
    return (_dt, elapsed) => {
      pulseRings.forEach((pr, idx) => {
        const s = 1.0 + ((elapsed * 1.1 + idx * 0.33) % 1.0) * 1.1;
        pr.scale.setScalar(s);
        (pr.material as THREE.MeshBasicMaterial).opacity =
          0.55 * (1.0 - ((elapsed * 1.1 + idx * 0.33) % 1.0));
      });
    };
  }

  private buildCrossZoneLinks() {
    CROSS_ZONE_LINKS.forEach(([idA, idB]) => {
      const zA = this.zones.get(idA);
      const zB = this.zones.get(idB);
      if (!zA || !zB) return;

      const pA = new THREE.Vector3(...zA.config.position);
      const pB = new THREE.Vector3(...zB.config.position);
      const mid = pA.clone().lerp(pB, 0.5);
      mid.y += 1.6;

      const curve = new THREE.QuadraticBezierCurve3(pA, mid, pB);
      const geo = new THREE.TubeGeometry(curve, 32, 0.03, 6, false);
      const mat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.14,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      this.v01PipesGroup.add(mesh);

      this.crossLinks.set(`${idA}-${idB}`, { mat, timer: 0 });
    });
  }

  /**
   * 七、attackGroup：高精度多层八角指挥母舰平台 (v0.1/v0.2) + v0.3 前景极简暗金属单点红核攻击台
   */
  private buildAttackZone(teamsData: Team[]) {
    this.attackGroup.position.set(0, 0.9, 19.6);
    this.attackGroup.add(
      this.v012AttackBaseGroup,
      this.v01AttackTurretGroup,
      this.v02AttackDomeGroup,
      this.v03AttackConsoleGroup
    );

    const hullMat = new THREE.MeshStandardMaterial({
      color: 0x161a2c,
      metalness: 0.85,
      roughness: 0.28,
    });
    const armorMat = new THREE.MeshStandardMaterial({
      color: 0x262f45,
      metalness: 0.78,
      roughness: 0.32,
    });
    const redAccentMat = new THREE.MeshStandardMaterial({
      color: 0xff2a4b,
      emissive: 0xff2a4b,
      emissiveIntensity: 0.85,
      metalness: 0.4,
      roughness: 0.25,
    });

    // 1) 双层重装八边形/六边形指挥舱舰体 + 底部鲜红推进光锥 (归入 v012AttackBaseGroup，v0.3 隐藏以切换为小巧流线型暗金属台)
    const platGeo = new THREE.CylinderGeometry(5.35, 4.5, 0.58, 8);
    const platMesh = new THREE.Mesh(platGeo, hullMat);
    const platEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(platGeo),
      new THREE.LineBasicMaterial({ color: 0xff2a4b, transparent: true, opacity: 0.9 })
    );
    platMesh.add(platEdges);
    this.v012AttackBaseGroup.add(platMesh);

    const underRedCone = new THREE.Mesh(
      new THREE.CylinderGeometry(4.2, 1.4, 2.8, 8, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xff2a4b,
        transparent: true,
        opacity: 0.14,
        side: THREE.BackSide,
        depthWrite: false,
      })
    );
    underRedCone.position.y = -1.65;
    this.v012AttackBaseGroup.add(underRedCone);

    const innerDeck = new THREE.Mesh(
      new THREE.CylinderGeometry(4.65, 4.65, 0.14, 8),
      armorMat
    );
    innerDeck.position.y = 0.28;
    this.v012AttackBaseGroup.add(innerDeck);

    // 8 座外围防爆护盾装甲块 + 侧面鲜红霓虹灯条
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const bastion = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.46, 0.38), armorMat);
      bastion.position.set(Math.sin(a) * 4.92, 0.36, Math.cos(a) * 4.92);
      bastion.rotation.y = a;

      const neonStrip = new THREE.Mesh(
        new THREE.BoxGeometry(0.88, 0.08, 0.06),
        new THREE.MeshBasicMaterial({ color: 0xff2a4b })
      );
      neonStrip.position.set(0, 0, 0.2);
      bastion.add(neonStrip);
      this.v012AttackBaseGroup.add(bastion);
    }

    // 2) v0.1 中央多管脉冲发射炮塔 Muzzle Turret
    const muzzleGroup = new THREE.Group();
    muzzleGroup.position.set(0, 0.85, -0.8);

    const turretBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.75, 0.95, 0.32, 8),
      armorMat
    );
    turretBase.position.y = -0.35;

    for (let i = 0; i < 4; i++) {
      const ba = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const barrel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.07, 0.85, 8),
        hullMat
      );
      barrel.position.set(Math.cos(ba) * 0.38, 0.05, Math.sin(ba) * 0.38 - 0.2);
      barrel.rotation.x = -Math.PI / 3.2;
      muzzleGroup.add(barrel);
    }

    this.muzzleRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.56, 0.055, 12, 48),
      redAccentMat
    );
    this.muzzleRing.rotation.x = Math.PI / 3;

    this.muzzleCore = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.28, 1),
      new THREE.MeshStandardMaterial({
        color: 0xff6b35,
        emissive: 0xff6b35,
        emissiveIntensity: 0.9,
      })
    );
    muzzleGroup.add(turretBase, this.muzzleRing, this.muzzleCore);
    this.v01AttackTurretGroup.add(muzzleGroup);

    // 3) 3 条同心选手光点轨道
    const orbitRadii = [2.2, 3.2, 4.2];
    const orbitSpeeds = [0.18, -0.13, 0.09];
    orbitRadii.forEach((r) => {
      const orbitRing = new THREE.Mesh(
        new THREE.RingGeometry(r - 0.025, r + 0.025, 64),
        new THREE.MeshBasicMaterial({
          color: 0xf43f5e,
          transparent: true,
          opacity: 0.32,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      orbitRing.rotation.x = -Math.PI / 2;
      orbitRing.position.y = 0.35;
      this.v01AttackTurretGroup.add(orbitRing);
    });

    // 4) v0.1 选手战队胶囊舱节点 (20 支战队)
    const orbGeo = new THREE.OctahedronGeometry(0.16, 1);
    const haloGeo = new THREE.RingGeometry(0.22, 0.34, 24);
    teamsData.slice(0, 20).forEach((team) => {
      const mat = new THREE.MeshStandardMaterial({
        color: team.colorNum,
        emissive: team.colorNum,
        emissiveIntensity: 0.65,
        metalness: 0.3,
        roughness: 0.2,
      });
      const mesh = new THREE.Mesh(orbGeo, mat);
      const r = orbitRadii[team.orbitIndex];
      mesh.position.set(Math.cos(team.angle) * r, 0.46, Math.sin(team.angle) * r);

      const haloMesh = new THREE.Mesh(
        haloGeo,
        new THREE.MeshBasicMaterial({
          color: 0xffd24a,
          transparent: true,
          opacity: 0,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      haloMesh.rotation.x = -Math.PI / 2;
      mesh.add(haloMesh);

      this.v01AttackTurretGroup.add(mesh);
      this.playerOrbs.push({
        team,
        mesh,
        haloMesh,
        orbitRadius: r,
        orbitSpeed: orbitSpeeds[team.orbitIndex],
        angle: team.angle,
        state: 'orbit',
        timer: 0,
        startPos: mesh.position.clone(),
        celebrateTimer: 0,
      });
    });

    // 5) v0.1 攻击区顶部全息遥测牌
    this.attackTelemetrySprite = createAttackTelemetrySprite(this.maxAnisotropy);
    this.v01AttackTurretGroup.add(this.attackTelemetrySprite);
  }

  /**
   * 七 (v0.2 专属)：还原设计图正前方的半透明粉红能量玻璃穹顶 + 3 道同心金色光环 + 6 尊 3D 发光人形战队雕像 + 双道金色弧形能量激光束
   */
  private buildV02AttackDomeAndSignatureBeams() {
    [1.25, 2.25, 3.35].forEach((r, idx) => {
      const goldRing = new THREE.Mesh(
        new THREE.RingGeometry(r - 0.045, r + 0.045, 64),
        new THREE.MeshBasicMaterial({
          color: idx === 0 ? 0xffaa00 : 0xff7722,
          transparent: true,
          opacity: 0.88,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      goldRing.rotation.x = -Math.PI / 2;
      goldRing.position.y = 0.36;
      this.v02AttackDomeGroup.add(goldRing);
    });

    const avatarConfigs: { pos: [number, number, number]; color: number }[] = [
      { pos: [0, 0.36, 2.25], color: 0xff3b5c },
      { pos: [-2.35, 0.36, 0.95], color: 0xffaa1d },
      { pos: [2.35, 0.36, 0.95], color: 0xff9f1c },
      { pos: [-1.45, 0.36, -1.25], color: 0xffaa1d },
      { pos: [1.35, 0.36, -1.35], color: 0xff3b5c },
      { pos: [-0.15, 0.36, -2.55], color: 0xff3b5c },
    ];

    avatarConfigs.forEach((cfg) => {
      const avatar = createHumanoidHackerAvatar(cfg.color);
      avatar.position.set(...cfg.pos);
      this.v02AvatarNodes.push(avatar);
      this.v02AttackDomeGroup.add(avatar);
    });

    const domeGeo = new THREE.SphereGeometry(
      3.92,
      36,
      20,
      0,
      Math.PI * 2,
      0,
      Math.PI * 0.5
    );
    const domeMat = new THREE.MeshPhysicalMaterial({
      color: 0xff4d79,
      emissive: 0x991b36,
      emissiveIntensity: 0.35,
      metalness: 0.05,
      roughness: 0.12,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
      transparent: true,
      opacity: 0.30,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const domeMesh = new THREE.Mesh(domeGeo, domeMat);
    domeMesh.position.y = 0.34;

    const domeWire = new THREE.Mesh(
      new THREE.SphereGeometry(3.94, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5),
      new THREE.MeshBasicMaterial({
        color: 0xff99bb,
        wireframe: true,
        transparent: true,
        opacity: 0.12,
        depthWrite: false,
      })
    );
    domeMesh.add(domeWire);

    const domeRim = new THREE.Mesh(
      new THREE.TorusGeometry(3.92, 0.055, 12, 64),
      new THREE.MeshBasicMaterial({
        color: 0xff5c8a,
        transparent: true,
        opacity: 0.85,
      })
    );
    domeRim.rotation.x = Math.PI / 2;
    domeRim.position.y = 0.36;

    this.v02AttackDomeGroup.add(domeMesh, domeRim);

    const beamPairs = [
      {
        start: new THREE.Vector3(3.1, 1.35, 17.8),
        mid: new THREE.Vector3(6.8, 3.85, 13.2),
        end: new THREE.Vector3(9.85, 1.15, 8.45),
        color: 0xff9f1c,
      },
      {
        start: new THREE.Vector3(3.75, 1.25, 18.2),
        mid: new THREE.Vector3(7.45, 3.45, 13.6),
        end: new THREE.Vector3(9.95, 1.05, 8.55),
        color: 0xffcc44,
      },
    ];

    beamPairs.forEach((bp) => {
      const curve = new THREE.QuadraticBezierCurve3(bp.start, bp.mid, bp.end);
      const tubeGeo = new THREE.TubeGeometry(curve, 64, 0.065, 8, false);
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uTime: this.sharedUniforms.uTime,
          uProgress: { value: 1.0 },
          uIntensity: { value: 1.25 },
          uOpacity: { value: 0.92 },
          uColor: { value: new THREE.Color(bp.color) },
        },
        vertexShader: attackBeamVertexShader,
        fragmentShader: attackBeamFragmentShader,
        transparent: true,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(tubeGeo, mat);
      this.v02SignatureBeams.push(mat);
      this.v02EnvGroup.add(mesh);
    });

    const sparkGroup = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.28, 1),
      new THREE.MeshBasicMaterial({
        color: 0xfffbeb,
        transparent: true,
        opacity: 0.95,
      })
    );
    sparkGroup.position.set(9.88, 1.12, 8.48);
    this.v02ImpactSpark = sparkGroup;
    this.v02EnvGroup.add(sparkGroup);
  }

  /**
   * 七 (v0.3 / v0.4 专属)：近景流线型暗黑铬金属攻击控制台 + 穿透级高强度炽烈橙红发光核心
   * "Foreground Attack Zone: A dark chrome console with a piercing, high-intensity orange-red glowing core.
   *  Thin, sharp red laser beams shoot from it towards specific servers.
   *  The red is the ONLY warm color, providing striking contrast against the cool grey and blue."
   */
  private buildV03SleekAttackConsole() {
    // 相对于 attackGroup (0, 0.9, 19.6) 定位在 (0, -0.45, -0.8) => 世界坐标 (0, 0.45, 18.8)
    this.v03AttackConsoleGroup.position.set(0, -0.45, -0.8);

    const darkChromeMat = new THREE.MeshStandardMaterial({
      color: 0x445566,
      metalness: 0.7,
      roughness: 0.4,
      envMapIntensity: 1.45,
    });
    const brushedGunmetal = new THREE.MeshStandardMaterial({
      color: 0x667788,
      metalness: 0.7,
      roughness: 0.4,
      envMapIntensity: 1.55,
    });
    const charcoalAlloy = new THREE.MeshStandardMaterial({
      color: 0x4e5d6c,
      metalness: 0.7,
      roughness: 0.4,
      envMapIntensity: 1.4,
    });

    // 1) 流线型斜切六边形暗黑镀铬控制台底座 (Dark Chrome Console Base, R = 2.05)
    const lowerBaseGeo = new THREE.CylinderGeometry(2.05, 2.32, 0.28, 6);
    const lowerBase = new THREE.Mesh(lowerBaseGeo, darkChromeMat);
    lowerBase.position.y = -0.22;
    lowerBase.add(
      new THREE.LineSegments(
        new THREE.EdgesGeometry(lowerBaseGeo),
        new THREE.LineBasicMaterial({
          color: 0x8be9fd,
          transparent: true,
          opacity: 0.68,
        })
      )
    );

    const midAlloyDeckGeo = new THREE.CylinderGeometry(1.58, 1.88, 0.24, 6);
    const midCarbonDeck = new THREE.Mesh(midAlloyDeckGeo, charcoalAlloy);
    midCarbonDeck.position.y = 0.02;
    midCarbonDeck.add(
      new THREE.LineSegments(
        new THREE.EdgesGeometry(midAlloyDeckGeo),
        new THREE.LineBasicMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: 0.48,
        })
      )
    );

    const upperChromeShroud = new THREE.Mesh(
      new THREE.CylinderGeometry(0.96, 1.36, 0.26, 24),
      darkChromeMat
    );
    upperChromeShroud.position.y = 0.26;

    this.v03AttackConsoleGroup.add(lowerBase, midCarbonDeck, upperChromeShroud);

    // 6 组暗黑镀铬导流翼片 (Dark Chrome Struts converging toward the core)
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      const finGeo = new THREE.BoxGeometry(0.14, 0.26, 0.72);
      const fin = new THREE.Mesh(finGeo, brushedGunmetal);
      fin.position.set(Math.sin(a) * 1.38, 0.2, Math.cos(a) * 1.38);
      fin.rotation.y = a;
      fin.rotation.x = 0.22;
      fin.add(
        new THREE.LineSegments(
          new THREE.EdgesGeometry(finGeo),
          new THREE.LineBasicMaterial({
            color: 0x8be9fd,
            transparent: true,
            opacity: 0.65,
          })
        )
      );
      this.v03AttackConsoleGroup.add(fin);
    }

    // 2) 高强度橙红高能等离子束核心 + 半透明全息约束罩 (Concentrated Plasma Energy Beam + Translucent Holographic Shell)
    const coreCradle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.56, 0.68, 0.18, 32, 1, true),
      darkChromeMat
    );
    coreCradle.position.y = 0.48;
    this.v03AttackConsoleGroup.add(coreCradle);

    this.v03OrangeRedCore = new THREE.Group();
    this.v03OrangeRedCore.position.set(0, 0.48, 0);

    const v03EmitterBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.34, 0.12, 24),
      darkChromeMat
    );
    v03EmitterBase.position.y = 0.04;

    const v03OrbCore = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 24, 24),
      new THREE.MeshBasicMaterial({ color: 0xff5500 })
    );
    v03OrbCore.position.y = 0.56;

    const v03OrbAura = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 24, 20),
      new THREE.MeshBasicMaterial({
        color: 0xff6e1a,
        transparent: true,
        opacity: 0.36,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    v03OrbAura.position.y = 0.56;

    this.v03OrangeRedCore.add(v03EmitterBase, v03OrbCore, v03OrbAura);
    this.v03AttackConsoleGroup.add(this.v03OrangeRedCore);

    // 环绕橙红核心的暗黑镀铬聚焦光圈环
    this.v03ConsoleRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.52, 0.028, 12, 48),
      darkChromeMat
    );
    this.v03ConsoleRing.rotation.x = Math.PI * 0.42;
    this.v03ConsoleRing.position.set(0, 0.56, 0);
    this.v03AttackConsoleGroup.add(this.v03ConsoleRing);

    // 控制台甲板表面极细的橙红光圈线
    const redFloorRing = new THREE.Mesh(
      new THREE.RingGeometry(0.76, 0.8, 64),
      new THREE.MeshBasicMaterial({
        color: 0xff2a14,
        transparent: true,
        opacity: 0.88,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    redFloorRing.rotation.x = -Math.PI / 2;
    redFloorRing.position.y = 0.4;
    this.v03AttackConsoleGroup.add(redFloorRing);
  }

  /**
   * 七-B (v0.5 专属)：位于绝对中心 (0, 0, 0) 的八角形暗黑镀铬攻击指挥台，取代中央枢纽
   * - 八边形多层暗黑镀铬底座（外缘无缝衔接 7 条青色数据管道）
   * - 8 组环向控制台与发丝级青色轮廓描边
   * - 中心嵌入式穿透级高强度橙红发光核心，向外周 7 座六边形平台发射纤细锐利的红色激光束
   */
  private buildV05CenterAttackConsole() {
    this.v05CenterAttackGroup.position.set(0, 0, 0);

    const brushedTex = createV03BrushedMetalTexture(this.maxAnisotropy);
    const carbonTex = createV03CarbonFiberTexture(this.maxAnisotropy);

    const darkChromeMat = new THREE.MeshStandardMaterial({
      color: 0x445566,
      metalness: 0.7,
      roughness: 0.4,
      envMapIntensity: 1.45,
    });
    const gunmetalBrushed = new THREE.MeshStandardMaterial({
      color: 0xc8d2dc,
      map: brushedTex,
      bumpMap: brushedTex,
      bumpScale: 0.011,
      metalness: 0.7,
      roughness: 0.4,
      envMapIntensity: 1.45,
    });
    const slateSilverMat = new THREE.MeshStandardMaterial({
      color: 0xe0e6ec,
      map: brushedTex,
      bumpMap: brushedTex,
      bumpScale: 0.009,
      metalness: 0.7,
      roughness: 0.4,
      envMapIntensity: 1.55,
    });
    const charcoalCarbon = new THREE.MeshStandardMaterial({
      color: 0xbac4ce,
      map: carbonTex,
      bumpMap: carbonTex,
      bumpScale: 0.014,
      metalness: 0.7,
      roughness: 0.4,
      envMapIntensity: 1.35,
    });
    const cyanMicroScreenMat = new THREE.MeshBasicMaterial({
      color: 0x0ea5e9,
      transparent: true,
      opacity: 0.86,
    });

    const octAngleOffset = Math.PI / 8;

    // 1) 一层八边形宽幅重装底座 (R = 4.18~4.48, 与 7 条径向发光青色数据管道无缝对接)
    const tier1Geo = new THREE.CylinderGeometry(4.18, 4.48, 0.28, 8);
    const tier1 = new THREE.Mesh(tier1Geo, charcoalCarbon);
    tier1.position.y = -0.4;
    tier1.rotation.y = octAngleOffset;
    tier1.add(
      new THREE.LineSegments(
        new THREE.EdgesGeometry(tier1Geo),
        new THREE.LineBasicMaterial({
          color: 0x00c8f0,
          transparent: true,
          opacity: 0.62,
        })
      )
    );

    // 2) 二层高抛光暗黑镀铬八角指挥主甲板
    const tier2Geo = new THREE.CylinderGeometry(3.05, 3.42, 0.34, 8);
    const tier2 = new THREE.Mesh(tier2Geo, darkChromeMat);
    tier2.position.y = -0.09;
    tier2.rotation.y = octAngleOffset;
    tier2.add(
      new THREE.LineSegments(
        new THREE.EdgesGeometry(tier2Geo),
        new THREE.LineBasicMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: 0.72,
        })
      )
    );

    // 3) 三层八边形控制台仪表中环
    const tier3Geo = new THREE.CylinderGeometry(2.02, 2.38, 0.36, 8);
    const tier3 = new THREE.Mesh(tier3Geo, gunmetalBrushed);
    tier3.position.y = 0.24;
    tier3.rotation.y = octAngleOffset;
    tier3.add(
      new THREE.LineSegments(
        new THREE.EdgesGeometry(tier3Geo),
        new THREE.LineBasicMaterial({
          color: 0x7dd3fc,
          transparent: true,
          opacity: 0.58,
        })
      )
    );

    this.v05CenterAttackGroup.add(tier1, tier2, tier3);

    // 4) 8 组环绕八边形外缘的斜角暗黑镀铬散热鳍翼 + 战术操作台微屏
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const finGeo = new THREE.BoxGeometry(0.18, 0.3, 1.05);
      const fin = new THREE.Mesh(finGeo, slateSilverMat);
      fin.position.set(Math.sin(a) * 3.15, 0.08, Math.cos(a) * 3.15);
      fin.rotation.y = a;
      fin.rotation.x = 0.14;
      fin.add(
        new THREE.LineSegments(
          new THREE.EdgesGeometry(finGeo),
          new THREE.LineBasicMaterial({
            color: 0x38bdf8,
            transparent: true,
            opacity: 0.5,
          })
        )
      );

      // 朝外的极简指挥控制台斜面板 + 细青色微光数据条
      const deskGroup = new THREE.Group();
      deskGroup.position.set(Math.sin(a) * 2.15, 0.48, Math.cos(a) * 2.15);
      deskGroup.rotation.y = a;

      const deskBody = new THREE.Mesh(
        new THREE.BoxGeometry(0.66, 0.24, 0.38),
        darkChromeMat
      );
      deskBody.rotation.x = -0.35;
      const microBar = new THREE.Mesh(
        new THREE.BoxGeometry(0.52, 0.032, 0.02),
        cyanMicroScreenMat
      );
      microBar.position.set(0, 0.08, 0.19);
      microBar.rotation.x = -0.35;
      deskGroup.add(deskBody, microBar);

      this.v05CenterAttackGroup.add(fin, deskGroup);
    }

    // 5) 八边形橙红发射井环道与 8 根汇聚暗黑镀铬导流爪
    const redOuterOctRing = new THREE.Mesh(
      new THREE.RingGeometry(1.32, 1.38, 8),
      new THREE.MeshBasicMaterial({
        color: 0xff2a14,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    redOuterOctRing.rotation.x = -Math.PI / 2;
    redOuterOctRing.rotation.z = octAngleOffset;
    redOuterOctRing.position.y = 0.43;

    const redInnerRing = new THREE.Mesh(
      new THREE.RingGeometry(0.84, 0.89, 8),
      new THREE.MeshBasicMaterial({
        color: 0xff3b18,
        transparent: true,
        opacity: 0.94,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    redInnerRing.rotation.x = -Math.PI / 2;
    redInnerRing.rotation.z = octAngleOffset;
    redInnerRing.position.y = 0.44;
    this.v05CenterAttackGroup.add(redOuterOctRing, redInnerRing);

    const cradleRing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.92, 1.18, 0.24, 8, 1, true),
      darkChromeMat
    );
    cradleRing.rotation.y = octAngleOffset;
    cradleRing.position.y = 0.56;
    this.v05CenterAttackGroup.add(cradleRing);

    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + octAngleOffset;
      const pylonGeo = new THREE.BoxGeometry(0.11, 0.72, 0.16);
      const pylon = new THREE.Mesh(pylonGeo, darkChromeMat);
      pylon.position.set(Math.sin(a) * 0.95, 0.88, Math.cos(a) * 0.95);
      pylon.rotation.y = a;
      pylon.rotation.x = -0.32;
      pylon.add(
        new THREE.LineSegments(
          new THREE.EdgesGeometry(pylonGeo),
          new THREE.LineBasicMaterial({
            color: 0xff3b18,
            transparent: true,
            opacity: 0.55,
          })
        )
      );
      this.v05CenterAttackGroup.add(pylon);
    }

    // 6) 中央绝对核心：高能等离子光球（MeshBasicMaterial(0xff5500) + AdditiveBlending 多层透明光晕外壳 + 径向渐变 Sprite 光晕）
    this.v05OrangeRedCore = new THREE.Group();
    this.v05OrangeRedCore.position.set(0, 0.52, 0);

    const emitterNozzle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.58, 0.22, 8),
      darkChromeMat
    );
    emitterNozzle.rotation.y = octAngleOffset;
    emitterNozzle.position.y = 0.06;

    const emitterLens = new THREE.Mesh(
      new THREE.RingGeometry(0.12, 0.36, 8),
      new THREE.MeshBasicMaterial({
        color: 0xff5500,
        transparent: true,
        opacity: 0.94,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    emitterLens.rotation.x = -Math.PI / 2;
    emitterLens.rotation.z = octAngleOffset;
    emitterLens.position.y = 0.18;

    const orbCenterY = 0.96; // world y = 0.52 + 0.96 = 1.48

    // 内核高能光球：非实心 AdditiveBlending + MeshBasicMaterial({ color: 0xff5500 })，避免遮挡内部 Sprite 发光中心
    const plasmaOrbCore = new THREE.Mesh(
      new THREE.SphereGeometry(0.36, 32, 32),
      new THREE.MeshBasicMaterial({
        color: 0xff5500,
        transparent: true,
        opacity: 0.88,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    plasmaOrbCore.position.y = orbCenterY;

    // 中层 AdditiveBlending 透明等离子气辉外壳
    const plasmaInnerAura = new THREE.Mesh(
      new THREE.SphereGeometry(0.56, 32, 24),
      new THREE.MeshBasicMaterial({
        color: 0xff7a24,
        transparent: true,
        opacity: 0.36,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    plasmaInnerAura.position.y = orbCenterY;

    // 外层 AdditiveBlending 大气光晕外壳
    const plasmaOuterShell = new THREE.Mesh(
      new THREE.SphereGeometry(0.80, 32, 24),
      new THREE.MeshBasicMaterial({
        color: 0xff4400,
        transparent: true,
        opacity: 0.16,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    plasmaOuterShell.position.y = orbCenterY;
    this.v05PlasmaOuterShell = plasmaOuterShell;

    // 径向渐变发光贴图 Sprite（内层白金等离子核心 + 外层大范围橙红光晕，完全消除“咸蛋黄”实心感）
    const plasmaHotCoreTex = this.createRadialGlowTexture([
      [0.0, 'rgba(255, 255, 240, 1.0)'],
      [0.22, 'rgba(255, 210, 130, 0.98)'],
      [0.48, 'rgba(255, 95, 20, 0.62)'],
      [0.82, 'rgba(255, 50, 0, 0.14)'],
      [1.0, 'rgba(255, 30, 0, 0.0)'],
    ]);
    const plasmaHotCoreSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: plasmaHotCoreTex,
        color: 0xffffff,
        transparent: true,
        opacity: 0.98,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    plasmaHotCoreSprite.position.y = orbCenterY;
    plasmaHotCoreSprite.scale.set(2.05, 2.05, 1);

    const plasmaGlowTex = this.createRadialGlowTexture([
      [0.0, 'rgba(255, 220, 150, 0.95)'],
      [0.20, 'rgba(255, 105, 25, 0.85)'],
      [0.45, 'rgba(255, 65, 0, 0.45)'],
      [0.75, 'rgba(255, 30, 0, 0.14)'],
      [1.0, 'rgba(255, 20, 0, 0.0)'],
    ]);
    const plasmaHaloSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: plasmaGlowTex,
        color: 0xffffff,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    plasmaHaloSprite.position.y = orbCenterY;
    plasmaHaloSprite.scale.set(4.8, 4.8, 1);
    this.v05PlasmaHaloSprite = plasmaHaloSprite;

    // 底部接驳光柱（连接发射井口与悬浮高能光球）
    const nozzleColumn = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.24, 0.72, 16, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xff5500,
        transparent: true,
        opacity: 0.36,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    nozzleColumn.position.y = 0.52;

    this.v05OrangeRedCore.add(
      emitterNozzle,
      emitterLens,
      nozzleColumn,
      plasmaOrbCore,
      plasmaInnerAura,
      plasmaOuterShell,
      plasmaHotCoreSprite,
      plasmaHaloSprite
    );
    this.v05CenterAttackGroup.add(this.v05OrangeRedCore);

    // 环绕高能等离子光球的双层八角磁约束陀螺环（外扩尺寸不遮挡发光核）
    this.v05ConsoleGimbalA.position.set(0, 1.48, 0);
    const gimbalOctMesh = new THREE.Mesh(
      new THREE.TorusGeometry(1.04, 0.026, 10, 8),
      darkChromeMat
    );
    gimbalOctMesh.rotation.x = Math.PI * 0.42;
    const gimbalOctRedEdge = new THREE.Mesh(
      new THREE.TorusGeometry(1.00, 0.012, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xff5500 })
    );
    gimbalOctRedEdge.rotation.x = Math.PI * 0.42;
    this.v05ConsoleGimbalA.add(gimbalOctMesh, gimbalOctRedEdge);

    this.v05ConsoleGimbalB.position.set(0, 1.48, 0);
    const gimbalOuterMesh = new THREE.Mesh(
      new THREE.TorusGeometry(1.24, 0.022, 10, 8),
      slateSilverMat
    );
    gimbalOuterMesh.rotation.x = -Math.PI * 0.36;
    const gimbalTopCyanEdge = new THREE.Mesh(
      new THREE.TorusGeometry(1.20, 0.011, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0x00d4ff })
    );
    gimbalTopCyanEdge.rotation.x = -Math.PI * 0.36;
    this.v05ConsoleGimbalB.add(gimbalOuterMesh, gimbalTopCyanEdge);

    this.v05CenterAttackGroup.add(this.v05ConsoleGimbalA, this.v05ConsoleGimbalB);
  }

  /**
   * 七-C (0.1版 赛博线框风 / Tron 专属)：
   * - 中心红球：体积缩小 30% (半径 0.30)，纯正亮红色 0xff1100，外围不套大透明发光壳，收敛过曝
   * - 线框颜色与亮度：0x00d4ff, opacity: 0.9, blending: THREE.AdditiveBlending
   */
  private buildV01TronCenterAttackAndLinks(zonesData: ZoneConfig[]) {
    this.v01TronPrimaryLineMat = new THREE.LineBasicMaterial({
      color: 0x00d4ff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.v01TronSeamLineMat = new THREE.LineBasicMaterial({
      color: 0x00d4ff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    // 高亮刺眼纯红线框环材质（突破 threshold 0.9 产生鲜明红光，且不受雾效衰减）
    this.v01TronRedCoreMat = new THREE.LineBasicMaterial({
      color: new THREE.Color(1.85, 0.1, 0.02),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    });

    this.v01TronAttackCoreGroup.position.set(0, 0, 0);

    // 1) 中央八边形纯线框基座（纯青色 0x00d4ff + AdditiveBlending）
    const octPtsPrimary: THREE.Vector3[] = [];
    const octPtsSeam: THREE.Vector3[] = [];
    const octOffset = Math.PI / 8;
    const outerR = 4.25;
    const midR = 3.12;
    const innerR = 1.95;
    const topY = 0.28;
    const botY = -0.45;

    for (let i = 0; i < 8; i++) {
      const a0 = (i / 8) * Math.PI * 2 + octOffset;
      const a1 = ((i + 1) / 8) * Math.PI * 2 + octOffset;

      const ox0 = Math.sin(a0) * outerR;
      const oz0 = Math.cos(a0) * outerR;
      const ox1 = Math.sin(a1) * outerR;
      const oz1 = Math.cos(a1) * outerR;

      const mx0 = Math.sin(a0) * midR;
      const mz0 = Math.cos(a0) * midR;
      const mx1 = Math.sin(a1) * midR;
      const mz1 = Math.cos(a1) * midR;

      const ix0 = Math.sin(a0) * innerR;
      const iz0 = Math.cos(a0) * innerR;
      const ix1 = Math.sin(a1) * innerR;
      const iz1 = Math.cos(a1) * innerR;

      // 外八角上下轮廓 + 垂直厚度线
      octPtsPrimary.push(
        new THREE.Vector3(ox0, 0.02, oz0),
        new THREE.Vector3(ox1, 0.02, oz1),
        new THREE.Vector3(ox0, botY, oz0),
        new THREE.Vector3(ox1, botY, oz1),
        new THREE.Vector3(ox0, botY, oz0),
        new THREE.Vector3(ox0, 0.02, oz0),
        new THREE.Vector3(ix0, topY, iz0),
        new THREE.Vector3(ix1, topY, iz1)
      );

      // 中环接缝与放射肋线
      octPtsSeam.push(
        new THREE.Vector3(mx0, 0.14, mz0),
        new THREE.Vector3(mx1, 0.14, mz1),
        new THREE.Vector3(ox0, 0.02, oz0),
        new THREE.Vector3(ix0, topY, iz0)
      );
    }

    this.v01TronAttackCoreGroup.add(
      new THREE.LineSegments(
        new THREE.BufferGeometry().setFromPoints(octPtsPrimary),
        this.v01TronPrimaryLineMat
      ),
      new THREE.LineSegments(
        new THREE.BufferGeometry().setFromPoints(octPtsSeam),
        this.v01TronSeamLineMat
      )
    );

    // 2) 中心红球分层（保焦点）：全场唯一绝对刺眼的视觉焦点，保留精巧红球光晕，周围青蓝线框退居其次
    const coreHub = new THREE.Group();
    coreHub.position.set(0, 1.48, 0);
    this.v01TronAttackCoreGroup.add(coreHub);

    this.v01TronRedOrbCoreMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(2.4, 0.12, 0.02),
      transparent: true,
      opacity: 0,
      fog: false,
    });
    const solidRedSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.30, 32, 32),
      this.v01TronRedOrbCoreMat
    );
    coreHub.add(solidRedSphere);

    // 紧凑高能红光内壳（半径 0.36，高于 threshold 0.9 形成刺眼红核光晕）
    this.v01TronRedOrbAuraMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(1.9, 0.08, 0.02),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    });
    const solidRedAura = new THREE.Mesh(
      new THREE.SphereGeometry(0.36, 24, 20),
      this.v01TronRedOrbAuraMat
    );
    coreHub.add(solidRedAura);

    const redCoreGlowTex = this.createRadialGlowTexture([
      [0.0, 'rgba(255, 180, 140, 0.95)'],
      [0.28, 'rgba(255, 35, 5, 0.78)'],
      [0.62, 'rgba(255, 17, 0, 0.28)'],
      [1.0, 'rgba(0, 0, 0, 0.0)'],
    ]);
    this.v01TronRedOrbSpriteMat = new THREE.SpriteMaterial({
      map: redCoreGlowTex,
      color: new THREE.Color(1.85, 0.1, 0.02),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    });
    const redCoreGlowSprite = new THREE.Sprite(this.v01TronRedOrbSpriteMat);
    redCoreGlowSprite.scale.set(1.75, 1.75, 1);
    coreHub.add(redCoreGlowSprite);

    // 环绕红球的紧凑旋转红色线框环（随红球同步缩小 30%）
    const torusSpecs = [
      { radius: 0.44, tube: 0.022, radialSegs: 6, tubularSegs: 24, rx: -0.65, ry: 0.45, rz: 0.0 },
      { radius: 0.58, tube: 0.024, radialSegs: 8, tubularSegs: 28, rx: 1.12, ry: -0.3, rz: 0.55 },
      { radius: 0.72, tube: 0.024, radialSegs: 8, tubularSegs: 32, rx: -0.42, ry: 0.85, rz: -0.38 },
      { radius: 0.86, tube: 0.022, radialSegs: 6, tubularSegs: 36, rx: Math.PI * 0.44, ry: 0.15, rz: 0.18 },
    ];

    this.v01TronRedTorusRings = [];
    torusSpecs.forEach((spec) => {
      const torusGeo = new THREE.TorusGeometry(
        spec.radius,
        spec.tube,
        spec.radialSegs,
        spec.tubularSegs
      );
      const wireGeo = new THREE.WireframeGeometry(torusGeo);
      const ringLines = new THREE.LineSegments(wireGeo, this.v01TronRedCoreMat);
      ringLines.rotation.set(spec.rx, spec.ry, spec.rz);
      coreHub.add(ringLines);
      this.v01TronRedTorusRings.push(ringLines);
    });

    this.v01TronAttackCoreGroup.visible = false;

    // 3) 平台与中心直连细实线（亮青色 0x00d4ff + AdditiveBlending，直接连接 7 座六边形平台与中央核心）
    const directLinkPts: THREE.Vector3[] = [];
    const perimeterLinkPts: THREE.Vector3[] = [];

    zonesData.forEach((z, idx) => {
      const targetPos = new THREE.Vector3(z.position[0], 0.0, z.position[2]);
      const dir = targetPos.clone().setY(0).normalize();
      const startPt = dir.clone().multiplyScalar(4.25).setY(0.02);
      const endPt = targetPos.clone().addScaledVector(dir, -4.78).setY(0.02);

      // 主直连细实线 (0x00d4ff)
      directLinkPts.push(startPt, endPt);

      // 双侧极细平行辅助基准线 (0x00d4ff)
      const ortho = new THREE.Vector3(-dir.z, 0, dir.x);
      [-0.12, 0.12].forEach((offset) => {
        perimeterLinkPts.push(
          startPt.clone().addScaledVector(ortho, offset),
          endPt.clone().addScaledVector(ortho, offset)
        );
      });

      // 相邻平台之间的外环拓扑细实线
      const nextZ = zonesData[(idx + 1) % zonesData.length];
      const nextPos = new THREE.Vector3(nextZ.position[0], 0.02, nextZ.position[2]);
      const curPos = new THREE.Vector3(z.position[0], 0.02, z.position[2]);
      const linkDir = nextPos.clone().sub(curPos).normalize();
      const lStart = curPos.clone().addScaledVector(linkDir, 4.78);
      const lEnd = nextPos.clone().addScaledVector(linkDir, -4.78);
      perimeterLinkPts.push(lStart, lEnd);
    });

    this.v01TronLinksGroup.add(
      new THREE.LineSegments(
        new THREE.BufferGeometry().setFromPoints(directLinkPts),
        this.v01TronPrimaryLineMat
      ),
      new THREE.LineSegments(
        new THREE.BufferGeometry().setFromPoints(perimeterLinkPts),
        this.v01TronSeamLineMat
      )
    );
    this.v01TronLinksGroup.visible = false;
  }

  /**
   * 根据 wireframeMix (0 = 0.2版 暗黑写实金属, 1 = 0.1版 赛博线框风) 平滑更新材质透明度、灯光、阴影与后处理
   * 过渡时长约 0.8s，不销毁重建模型，切换至 0.1版 后彻底关闭物理光与阴影渲染 (shadowMap.enabled = false)
   */
  private applyWireframeTransitionMix(mix: number) {
    const m = Math.max(0, Math.min(1, mix));
    this.wireframeMix = m;
    const solidAlpha = 1.0 - m;
    const isFullWireframe = m >= 0.995;

    this.sharedUniforms.uWireframeMode.value = m;

    // 1) 背景色 (0x020408 -> 0x020610) 与强化深蓝色雾效 FogExp2(0x020610, 0.035)，让远处线框隐入黑暗拉开空间层次
    const bgCol = new THREE.Color(0x020408).lerp(new THREE.Color(0x020610), m);
    this.scene.background = bgCol;
    const fogDensity = THREE.MathUtils.lerp(0.005, 0.035, m);
    this.scene.fog = new THREE.FogExp2(bgCol.getHex(), fogDensity);
    this.scene.environmentIntensity = 1.25 * solidAlpha;

    // 2) 性能红利：一旦切入 0.1版 关闭阴影渲染与物理光照
    this.renderer.shadowMap.enabled = m < 0.5;
    this.ambientLight.intensity = 0.35 * solidAlpha;
    this.hemiLight.intensity = 1.0 * solidAlpha;
    this.keyLight.intensity = 1.5 * solidAlpha;
    this.rimLight.intensity = 0.45 * solidAlpha;
    this.backRightRimLight.intensity = 0.35 * solidAlpha;
    this.fillLight.intensity = 0.2 * solidAlpha;
    this.consoleRedLight.intensity = 1.35 * solidAlpha;
    this.consoleRedLight.visible = solidAlpha > 0.01;

    for (let i = 0; i < this.zonePointLights.length; i++) {
      this.zonePointLights[i].intensity = 0.26 * solidAlpha;
    }

    // 3) 收敛 UnrealBloomPass 泛光强度：0.1版 strength = 0.7 (0.6~0.8), radius = 0.15, threshold = 0.9（不让普通线框发猛光，仅中心红球强烈发光）
    if (this.bloomPass) {
      this.bloomPass.strength = THREE.MathUtils.lerp(0.6, 0.7, m);
      this.bloomPass.radius = THREE.MathUtils.lerp(0.2, 0.15, m);
      this.bloomPass.threshold = THREE.MathUtils.lerp(0.85, 0.9, m);
    }

    // 4) 地面六边形网格亮度调暗 50% 改为暗蓝色（由 groundDiscMesh 的 uWireframeMode 控制）
    this.backingMat.color.copy(bgCol);
    if (this.mirrorReflector) {
      this.mirrorReflector.visible = !this.useSoftwarePacing && m < 0.25;
    }
    if (this.skyDomeMesh) {
      this.skyDomeMesh.visible = !isFullWireframe;
    }
    if (this.groundDiscMesh) {
      this.groundDiscMesh.visible = true;
    }
    if (this.outerRimMesh) {
      this.outerRimMesh.visible = !isFullWireframe;
    }

    this.v01TronGroundGroup.visible = m > 0.005;
    this.v01TronGroundPrimaryMat.opacity = 0.16 * m;
    this.v01TronGroundSeamMat.opacity = 0.09 * m;

    // 5) 中央攻击区与连接线切换：青蓝线框 opacity 降至 0.4 退居其次，中心红球保持绝对刺眼焦点
    this.v03CoreGroup.visible = false;
    this.v05CenterAttackGroup.visible = !isFullWireframe;
    this.v03PipesGroup.visible = !isFullWireframe;

    this.v01TronAttackCoreGroup.visible = m > 0.005;
    this.v01TronLinksGroup.visible = m > 0.005;
    this.v01TronPrimaryLineMat.opacity = 0.4 * m;
    this.v01TronSeamLineMat.opacity = 0.2 * m;
    this.v01TronRedCoreMat.opacity = 0.92 * m;
    this.v01TronRedOrbCoreMat.opacity = 1.0 * m;
    this.v01TronRedOrbAuraMat.opacity = 0.48 * m;
    this.v01TronRedOrbSpriteMat.opacity = 0.72 * m;

    // 6) 七大六边形底座平台与 35 台算力机柜模型溶解过渡（线框 0x00d4ff, opacity: 0.4 + AdditiveBlending）
    this.hullDarkMat.transparent = m > 0.005;
    this.hullDarkMat.opacity = solidAlpha;
    this.rimSilverMat.transparent = m > 0.005;
    this.rimSilverMat.opacity = solidAlpha;

    this.zones.forEach((zone) => {
      for (let i = 0; i < zone.solidPlatformMeshes.length; i++) {
        zone.solidPlatformMeshes[i].visible = !isFullWireframe;
      }
      zone.v03CenterHardwareGroup.visible = !isFullWireframe;
      zone.v03FloorProjMesh.visible = !isFullWireframe;

      zone.v01TronPlatformWireGroup.visible = m > 0.005;
      zone.v01TronPrimaryMat.opacity = 0.4 * m;
      zone.v01TronSeamMat.opacity = 0.2 * m;

      zone.nodes.forEach((node) => {
        (node.userData as ChallengeNodeUserData).setWireframeMix(m);
      });
    });
  }

  /**
   * 切换沙盘版本（0.1版 赛博线框风 vs 0.2版 暗黑金属中央突击版）：
   * - '0.3' (UI显示为 0.1版): 赛博线框风 / Tron 风格（0x00d4ff + opacity 0.9 + AdditiveBlending 霓虹灯管线框 + Bloom(1.0, 0.3, 0.6) + 0xff1100 精巧红核 + 0x003355 暗青六边形地面网格 + FogExp2(0x020610, 0.015)）
   * - '0.5' (UI显示为 0.2版): 暗黑写实金属中央突击版（冷蓝雾效 + 八角暗黑镀铬中央攻击指挥台 + 高能等离子光球 + 纤细锐利红激光）
   */
  public setVersion(version: SandboxVersion, immediateCamera = false) {
    this.currentVersion = version;
    const isV01Tron = version === '0.3';
    const isV05 = version === '0.5';

    this.sharedUniforms.uDarkMode.value = 1.0;
    this.sharedUniforms.uFuturisticMode.value = 0.0;

    this.renderer.toneMappingExposure = 1.0;
    this.camera.fov = 24;
    this.camera.updateProjectionMatrix();

    if (this.vignettePass) {
      this.vignettePass.uniforms.uMacroDof.value = 0.0;
    }

    // 预设 0.2版 物理光照基准色彩与位置（强度由 applyWireframeTransitionMix 控制）
    this.ambientLight.color.setHex(0x94a3b8);
    this.hemiLight.color.setHex(0xccddff);
    this.hemiLight.groundColor.setHex(0x050810);
    this.keyLight.color.setHex(0xffffff);
    this.keyLight.position.set(-22, 34, 24);
    this.rimLight.color.setHex(0xdbeafe);
    this.backRightRimLight.color.setHex(0x94a3b8);
    this.backRightRimLight.visible = true;
    this.fillLight.color.setHex(0x94a3b8);
    this.fillLight.position.set(18, 20, 22);

    this.consoleRedLight.position.set(0, 1.55, 0);
    this.consoleRedLight.distance = 11.0;

    // Desaturated dark grey-silver metallic platforms (0x445566 / 0x667788, metalness 0.7, roughness 0.4)
    this.hullDarkMat.color.setHex(0x445566);
    this.hullDarkMat.metalness = 0.7;
    this.hullDarkMat.roughness = 0.4;
    this.hullDarkMat.envMapIntensity = 1.45;
    this.hullDarkMat.needsUpdate = true;

    this.rimSilverMat.color.setHex(0x667788);
    this.rimSilverMat.metalness = 0.7;
    this.rimSilverMat.roughness = 0.4;
    this.rimSilverMat.envMapIntensity = 1.55;
    this.outerRimMat.color.setHex(0x445566);
    this.outerRimMat.metalness = 0.7;
    this.outerRimMat.roughness = 0.4;
    this.starField.visible = false;

    for (let i = this.floatTexts.length - 1; i >= 0; i--) {
      const ft = this.floatTexts[i];
      this.fxGroup.remove(ft.sprite);
      const mat = ft.sprite.material as THREE.SpriteMaterial;
      mat.map?.dispose();
      mat.dispose();
    }
    this.floatTexts = [];

    // 七大六边形平台外观、全息中文标牌、地面投影同步更新
    let zIdx = 0;
    this.zones.forEach((zone) => {
      const zCfg = zone.config;
      const pos = zCfg.position;
      zone.root.position.set(pos[0], pos[1], pos[2]);

      const pl = this.zonePointLights[zIdx++];
      if (pl) {
        pl.position.set(pos[0], 3.2 + pos[1], pos[2]);
        pl.color.setHex(0x38bdf8);
      }

      const dirToCenter = new THREE.Vector3(-pos[0], 0, -pos[2]).normalize();
      zone.innerEdgePoint.set(
        pos[0] + dirToCenter.x * 4.35,
        0.15 + pos[1],
        pos[2] + dirToCenter.z * 4.35
      );

      zone.v03LabelSprite.visible = true;

      zone.edgeNeonMat.color.setHex(0x00d4ff);
      zone.edgeNeonMat.opacity = isV01Tron ? 0.85 : 0.62;
      zone.topShaderMat.uniforms.uColor.value.setHex(0x00c8f0);
      zone.underBeamMat.color.setHex(0x0284c7);
      zone.underBeamMat.opacity = 0.0;

      zone.nodes.forEach((node) => {
        (node.userData as ChallengeNodeUserData).setVersion(version);
      });

      this.refreshZoneTelemetry(zone, false);
    });

    // 目标线框混合因子：0.1版 ('0.3') -> 1.0，0.2版 ('0.5') -> 0.0
    this.targetWireframeMix = isV01Tron ? 1.0 : 0.0;
    if (immediateCamera) {
      this.applyWireframeTransitionMix(this.targetWireframeMix);
    }

    // 4) 0.1版保留赛博激光线，0.2版不常态化显示任何固定红色攻击线路
    for (let i = this.activeBeams.length - 1; i >= 0; i--) {
      this.disposeBeam(this.activeBeams[i]);
    }
    this.activeBeams = [];

    if (!isV05) {
      const defaultTargets = ['AI-02', 'INF-02', 'OPS-02'];
      defaultTargets.forEach((cid) => {
        const found = this.findChallengeAndZone(cid);
        if (found) {
          if (found.challenge.state === 'idle') {
            found.challenge.state = 'attacking';
            found.challenge.activeAttacker = '网络护卫队';
            (found.node.userData as ChallengeNodeUserData).transitionState('attacking', {
              team: '网络护卫队',
            });
          }
          const curve = this.buildAttackPath(found.node, found.zone);
          this.spawnBeamInternal({
            challenge: found.challenge,
            zone: found.zone,
            node: found.node,
            teamName: '网络护卫队',
            curve,
            instantArrive: true,
          });
        }
      });
    }

    const pose = this.getDefaultOverviewPose(this.currentCameraMode);
    if (immediateCamera) {
      this.camera.position.copy(pose.endPos);
      this.controls.target.copy(pose.endTarget);
      this.controls.update();
    } else {
      this.startCameraTransition(pose.endPos, pose.endTarget, this.autoRotateEnabled, 1.2);
    }

    if (!immediateCamera && !this.disposed && !this.contextLost && this.loopTick) {
      cancelAnimationFrame(this.frameId);
      clearTimeout(this.frameId);
      this.frameId = requestAnimationFrame(this.loopTick);
    }
  }

  public getVersion(): SandboxVersion {
    return this.currentVersion;
  }

  private seedInitialActiveBeams(_zonesData: ZoneConfig[]) {
    // 0.2版默认不常态化显示攻击红线，所有攻击红线均由真实/模拟事件触发并在到达设备 1s 后消失
    this.refreshAttackTelemetry();
  }

  private buildAttackPath(targetDevice: THREE.Group, _zone: ZoneRuntime): THREE.Curve<THREE.Vector3> {
    const worldTarget = new THREE.Vector3();
    targetDevice.getWorldPosition(worldTarget);
    worldTarget.y += 1.35;

    // 0.1版：中心向外发射的激光线保持细直（极低弧度），0.2版保持优雅微弧轨迹
    const centerRedCoreOrigin = new THREE.Vector3(0, 1.48, 0);
    const mid = centerRedCoreOrigin.clone().lerp(worldTarget, 0.5);
    mid.y += this.currentVersion === '0.3' ? 0.35 : 1.62;
    return new THREE.QuadraticBezierCurve3(centerRedCoreOrigin, mid, worldTarget);
  }

  private spawnBeamInternal(opts: {
    challenge: Challenge;
    zone: ZoneRuntime;
    node: THREE.Group;
    teamName: string;
    curve: THREE.Curve<THREE.Vector3>;
    instantArrive?: boolean;
    colorHex?: number;
    radiusScale?: number;
    intensity?: number;
    duration?: number;
    withGoldenHalo?: boolean;
    onArrive?: () => void;
  }) {
    const existingIdx = this.activeBeams.findIndex((b) => b.challengeId === opts.challenge.id);
    if (existingIdx !== -1) {
      this.disposeBeam(this.activeBeams[existingIdx]);
      this.activeBeams.splice(existingIdx, 1);
    }

    const isV01Tron = this.currentVersion === '0.3';
    const baseRadius = isV01Tron ? 0.013 : 0.018;
    const beamRadius = baseRadius * (opts.radiusScale ?? 1.0);
    const beamColorHex = opts.colorHex ?? (isV01Tron ? 0xff1100 : 0xff2614);
    const beamIntensity = opts.intensity ?? (isV01Tron ? 1.65 : 1.38);

    const tubeGeo = new THREE.TubeGeometry(opts.curve, 96, beamRadius, 8, false);
    const beamMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: this.sharedUniforms.uTime,
        uProgress: { value: opts.instantArrive ? 1.0 : 0.0 },
        uIntensity: { value: beamIntensity },
        uOpacity: { value: opts.instantArrive ? 0.94 : 0.98 },
        uColor: { value: new THREE.Color(beamColorHex) },
      },
      vertexShader: attackBeamVertexShader,
      fragmentShader: attackBeamFragmentShader,
      transparent: true,
      depthWrite: false,
    });
    const tubeMesh = new THREE.Mesh(tubeGeo, beamMat);
    this.fxGroup.add(tubeMesh);

    let haloMesh: THREE.Mesh | undefined;
    let haloMat: THREE.ShaderMaterial | undefined;
    if (opts.withGoldenHalo) {
      const haloGeo = new THREE.TubeGeometry(opts.curve, 96, beamRadius * 3.1, 10, false);
      haloMat = new THREE.ShaderMaterial({
        uniforms: {
          uTime: this.sharedUniforms.uTime,
          uProgress: { value: opts.instantArrive ? 1.0 : 0.0 },
          uIntensity: { value: 1.9 },
          uOpacity: { value: 0.92 },
          uColor: { value: new THREE.Color(0xffb800) },
        },
        vertexShader: attackBeamHaloVertexShader,
        fragmentShader: attackBeamHaloFragmentShader,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      haloMesh = new THREE.Mesh(haloGeo, haloMat);
      this.fxGroup.add(haloMesh);
    }

    const probeMesh = new THREE.Mesh(
      new THREE.SphereGeometry(opts.withGoldenHalo ? 0.16 : 0.09, 12, 12),
      new THREE.MeshBasicMaterial({ color: opts.withGoldenHalo ? 0xffe066 : beamColorHex })
    );
    const startPt = opts.curve.getPointAt(opts.instantArrive ? 1 : 0);
    probeMesh.position.copy(startPt);
    probeMesh.visible = !opts.instantArrive;
    this.fxGroup.add(probeMesh);

    const trailPositions = new Float32Array(8 * 3);
    for (let i = 0; i < 8; i++) {
      trailPositions[i * 3] = startPt.x;
      trailPositions[i * 3 + 1] = startPt.y;
      trailPositions[i * 3 + 2] = startPt.z;
    }
    const trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
    const trailLine = new THREE.Line(
      trailGeo,
      new THREE.LineBasicMaterial({
        color: beamColorHex,
        transparent: true,
        opacity: opts.withGoldenHalo ? 0.95 : 0.78,
      })
    );
    trailLine.visible = !opts.instantArrive;
    this.fxGroup.add(trailLine);

    const runtime: ActiveBeamRuntime = {
      id: `${opts.challenge.id}-${Date.now()}`,
      challengeId: opts.challenge.id,
      zoneId: opts.zone.config.id,
      teamName: opts.teamName,
      curve: opts.curve,
      tubeMesh,
      beamMat,
      haloMesh,
      haloMat,
      probeMesh,
      trailLine,
      trailPositions,
      progress: opts.instantArrive ? 1.0 : 0.0,
      duration: opts.duration ?? 0.72,
      arrived: Boolean(opts.instantArrive),
      retiring: false,
      retireTimer: 0,
      targetColor: new THREE.Color(beamColorHex),
      targetScaleXZ: opts.withGoldenHalo ? 1.45 : 1.0,
      onArriveCallback: opts.onArrive,
    };

    this.activeBeams.push(runtime);
    return runtime;
  }

  private disposeBeam(beam: ActiveBeamRuntime) {
    this.fxGroup.remove(beam.tubeMesh, beam.probeMesh, beam.trailLine);
    beam.tubeMesh.geometry.dispose();
    beam.beamMat.dispose();
    if (beam.haloMesh && beam.haloMat) {
      this.fxGroup.remove(beam.haloMesh);
      beam.haloMesh.geometry.dispose();
      beam.haloMat.dispose();
    }
    beam.probeMesh.geometry.dispose();
    (beam.probeMesh.material as THREE.Material).dispose();
    beam.trailLine.geometry.dispose();
    (beam.trailLine.material as THREE.Material).dispose();
    if (beam.solvingCard) {
      this.fxGroup.remove(beam.solvingCard);
      beam.solvingCard.geometry.dispose();
      const mat = beam.solvingCard.material as THREE.MeshBasicMaterial;
      mat.map?.dispose();
      mat.dispose();
    }
  }

  public triggerAttempt(challengeId: string, teamName: string) {
    const found = this.findChallengeAndZone(challengeId);
    if (!found) return;
    const { challenge, zone, node } = found;
    const ud = node.userData as ChallengeNodeUserData;

    soundFX.playAttempt();
    this.totalPayloadsDispatched += 1;
    challenge.totalAttempts += 1;
    challenge.activeAttempts += 1;
    challenge.activeAttacker = teamName;
    challenge.lastEventAt = Date.now();

    this.highlightCrossLinksForZone(zone.config.id);

    this.muzzleChargeTimer = 0.35;
    const curve = this.buildAttackPath(node, zone);

    const beam = this.spawnBeamInternal({
      challenge,
      zone,
      node,
      teamName,
      curve,
      duration: 0.7,
    });
    beam.onArriveCallback = () => {
      this.spawnShockwave(node, 0xff2a1f, 2.2, 0.65, 0);
      // 尝试解题动效持续 10s 后自动消失（除非新队伍触发尝试解题事件重置定时器）
      ud.startAttemptEffect(teamName, 10.0);
      // 红色攻击线路到达设备后持续 1s 后消失
      beam.retiring = true;
      beam.retireTimer = 1.0;
      this.refreshZoneTelemetry(zone);
      this.refreshAttackTelemetry();
      this.onStatsSync?.();
    };
    this.refreshAttackTelemetry();
  }

  public triggerFailed(challengeId: string, teamName: string, userInitiated = false) {
    const found = this.findChallengeAndZone(challengeId);
    if (!found) return;
    const { challenge, zone, node } = found;
    const ud = node.userData as ChallengeNodeUserData;

    challenge.totalAttempts += 1;
    challenge.activeAttempts = Math.max(0, challenge.activeAttempts - 1);
    challenge.lastEventAt = Date.now();

    const activeZonePos = zone.config.position;

    const executeImpactFail = (beam?: ActiveBeamRuntime) => {
      soundFX.playFailed();
      // 3D 球形护盾，持续 3s 后消失
      this.spawnHexShieldDome(node);
      this.spawnParticleBurst(node, 'failed');
      this.spawnShockwave(node, 0x0284c7, 3.2, 0.72, 0);

      ud.flashFail(challenge.totalAttempts);
      if (ud.state === 'attacking' && challenge.activeAttempts === 0) {
        ud.transitionState('idle');
      }

      this.spawnGroundRipple(activeZonePos[0], activeZonePos[2], 0x0284c7);

      if (userInitiated || this.focusedZoneId === zone.config.id) {
        this.shakeIntensity = 0.12;
        this.shakeTimer = 0.2;
      }

      if (beam) {
        // 红色攻击线路射向设备后持续 1s 后消失
        beam.retiring = true;
        beam.retireTimer = 1.0;
      }

      this.refreshZoneTelemetry(zone);
      this.refreshAttackTelemetry();
      this.onStatsSync?.();
    };

    const existingBeam = this.activeBeams.find((b) => b.challengeId === challengeId);
    const failBeamColor = 0xff2a1f;
    if (existingBeam) {
      existingBeam.targetColor.setHex(failBeamColor);
      existingBeam.beamMat.uniforms.uIntensity.value = 1.35;
      if (existingBeam.arrived) {
        executeImpactFail(existingBeam);
      } else {
        existingBeam.duration = 0.22;
        existingBeam.onArriveCallback = () => executeImpactFail(existingBeam);
      }
    } else {
      const curve = this.buildAttackPath(node, zone);
      const b = this.spawnBeamInternal({
        challenge,
        zone,
        node,
        teamName,
        curve,
        duration: 0.36,
      });
      b.targetColor.setHex(failBeamColor);
      b.onArriveCallback = () => executeImpactFail(b);
    }
  }

  public triggerSolved(
    challengeId: string,
    teamName: string,
    forceFirstBlood?: boolean
  ) {
    const found = this.findChallengeAndZone(challengeId);
    if (!found) return;
    const { challenge, zone, node } = found;
    const ud = node.userData as ChallengeNodeUserData;

    const isFirstBlood =
      forceFirstBlood !== undefined ? forceFirstBlood : challenge.solveCount === 0;

    challenge.solveCount += 1;
    challenge.activeAttempts = 0;
    challenge.solvedBy = teamName;
    if (isFirstBlood) challenge.firstBlood = true;
    challenge.lastEventAt = Date.now();

    if (!challenge.topSolvers) {
      challenge.topSolvers = [];
    }
    if (
      challenge.topSolvers.length < 3 &&
      !challenge.topSolvers.some((s) => s.teamName === teamName)
    ) {
      const matchedTeam = this.teamsData.find((t) => t.name === teamName);
      challenge.topSolvers.push({
        teamId: matchedTeam?.id || `team-${teamName}`,
        teamName,
        teamColor: matchedTeam?.color || '#00d4ff',
      });
    }

    if (this.attackFollowEnabled) {
      this.startAttackFollow(challenge, zone, node, teamName, isFirstBlood);
    }

    const activeZonePos = zone.config.position;

    const executeImpactSolve = (beam: ActiveBeamRuntime) => {
      soundFX.playSolved(isFirstBlood);
      // 夺旗成功：设备底部向上射出并旋转的青绿色光效(3s)；一血事件：向上射出并旋转的金黄色光效(3s)
      this.spawnRisingVortex(node, isFirstBlood ? 'firstBlood' : 'solved');
      this.spawnParticleBurst(node, 'solved');
      if (isFirstBlood) {
        this.spawnShockwave(node, 0xffd24a, 4.2, 1.0, 0.0);
        this.spawnShockwave(node, 0xffaa00, 3.6, 0.95, 0.1);
      } else {
        this.spawnShockwave(node, 0x00ffaa, 3.8, 0.9, 0.0);
        this.spawnShockwave(node, 0x00d4ff, 3.4, 0.9, 0.08);
      }

      ud.transitionState('solved', { team: teamName, firstBlood: isFirstBlood });
      this.spawnDataReturn(beam.curve);

      zone.config.score = Math.min(zone.config.totalScore, zone.config.score + challenge.points);
      zone.targetScore = zone.config.score;
      zone.telemetryBounceTimer = 0.65;
      zone.edgeHighlightTimer = 1.5;
      this.spawnGroundRipple(
        activeZonePos[0],
        activeZonePos[2],
        isFirstBlood ? 0xffd24a : 0x00ff88
      );

      this.targetPullOrigin.copy(this.controls.target);
      this.targetPullGoal
        .copy(this.controls.target)
        .lerp(new THREE.Vector3(...activeZonePos), 0.15);
      this.targetPullTimer = 2.2;

      // 攻击光束射向设备后持续 1s 后消失
      beam.retiring = true;
      beam.retireTimer = 1.0;

      this.refreshZoneTelemetry(zone, true);
      this.refreshAttackTelemetry();
      this.onStatsSync?.();
    };

    const existingBeam = this.activeBeams.find((b) => b.challengeId === challengeId);
    if (isFirstBlood) {
      // 一血事件：更明显的金色线条（加粗金核 + 金色外包体积光晕）射向对应设备
      const curve = this.buildAttackPath(node, zone);
      const b = this.spawnBeamInternal({
        challenge,
        zone,
        node,
        teamName,
        curve,
        colorHex: 0xffd24a,
        radiusScale: 2.2,
        intensity: 2.2,
        duration: 0.52,
        withGoldenHalo: true,
      });
      b.onArriveCallback = () => executeImpactSolve(b);
    } else if (existingBeam && !existingBeam.retiring) {
      existingBeam.targetColor.setHex(0xff2614);
      existingBeam.targetScaleXZ = 1.15;
      existingBeam.beamMat.uniforms.uIntensity.value = 1.45;
      if (existingBeam.arrived) {
        executeImpactSolve(existingBeam);
      } else {
        existingBeam.duration = 0.24;
        existingBeam.onArriveCallback = () => executeImpactSolve(existingBeam);
      }
    } else {
      const curve = this.buildAttackPath(node, zone);
      const b = this.spawnBeamInternal({
        challenge,
        zone,
        node,
        teamName,
        curve,
        colorHex: 0xff2614,
        intensity: 1.45,
        duration: 0.44,
      });
      b.onArriveCallback = () => executeImpactSolve(b);
    }
  }

  public setLabelDisplayMode(mode: LabelDisplayMode) {
    this.allChallengeNodes.forEach((node) => {
      (node.userData as ChallengeNodeUserData).setLabelMode(mode);
    });
  }

  private spawnHexShieldDome(node: THREE.Group) {
    const wp = new THREE.Vector3();
    node.getWorldPosition(wp);
    wp.y += 1.05;

    // 3D 球形能量护盾（带表面六边形力场与立体线框经纬壳，持续 3s 后消失）
    const geo = new THREE.SphereGeometry(1.52, 36, 24);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: this.sharedUniforms.uTime,
        uOpacity: { value: 0.92 },
        uColor: { value: new THREE.Color(0x00d4ff) },
      },
      vertexShader: hexShieldVertexShader,
      fragmentShader: hexShieldFragmentShader,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(wp);
    mesh.scale.setScalar(0.32);

    const wireGeo = new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1.545, 2));
    const wireMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const wireMesh = new THREE.LineSegments(wireGeo, wireMat);
    mesh.add(wireMesh);

    this.fxGroup.add(mesh);

    this.shieldDomes.push({
      mesh,
      mat,
      wireMesh,
      wireMat,
      elapsed: 0,
      duration: 3.0,
    });
  }

  private spawnRisingVortex(node: THREE.Group, mode: 'solved' | 'firstBlood') {
    const wp = new THREE.Vector3();
    node.getWorldPosition(wp);
    wp.y += 0.03;

    const isFB = mode === 'firstBlood';
    const primaryHex = isFB ? 0xffd24a : 0x00ffaa;
    const secondaryHex = isFB ? 0xffa800 : 0x22ffd8;
    const colH = isFB ? 4.0 : 3.5;

    const group = new THREE.Group();
    group.position.copy(wp);
    group.scale.set(1, 0.1, 1);

    // 1) 外层旋转升腾能量光柱
    const outerGeo = new THREE.CylinderGeometry(1.16, 0.76, colH, 36, 1, true);
    const outerMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: this.sharedUniforms.uTime,
        uOpacity: { value: 0.0 },
        uIntensity: { value: isFB ? 1.55 : 1.32 },
        uColorPrimary: { value: new THREE.Color(primaryHex) },
        uColorSecondary: { value: new THREE.Color(secondaryHex) },
      },
      vertexShader: risingVortexVertexShader,
      fragmentShader: risingVortexFragmentShader,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const outerCyl = new THREE.Mesh(outerGeo, outerMat);
    outerCyl.position.y = colH * 0.5;
    group.add(outerCyl);

    // 2) 内层高速反向旋转核心光束柱
    const innerGeo = new THREE.CylinderGeometry(0.62, 0.46, colH * 1.08, 28, 1, true);
    const innerMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: this.sharedUniforms.uTime,
        uOpacity: { value: 0.0 },
        uIntensity: { value: isFB ? 1.75 : 1.48 },
        uColorPrimary: { value: new THREE.Color(secondaryHex) },
        uColorSecondary: { value: new THREE.Color(0xffffff) },
      },
      vertexShader: risingVortexVertexShader,
      fragmentShader: risingVortexFragmentShader,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const innerCyl = new THREE.Mesh(innerGeo, innerMat);
    innerCyl.position.y = colH * 0.54;
    group.add(innerCyl);

    // 3) 设备底部发光发射环
    const baseRingGeo = new THREE.RingGeometry(0.68, 1.15, 36);
    const baseRingMat = new THREE.MeshBasicMaterial({
      color: primaryHex,
      transparent: true,
      opacity: 0.92,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const baseRing = new THREE.Mesh(baseRingGeo, baseRingMat);
    baseRing.rotation.x = -Math.PI / 2;
    baseRing.position.y = 0.03;
    group.add(baseRing);

    // 4) 3 条从设备底部向上螺旋射出的实体光带
    const spiralMat = new THREE.MeshBasicMaterial({
      color: primaryHex,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const spiralMeshes: THREE.Mesh[] = [];
    for (let s = 0; s < 3; s++) {
      const startAngle = (s / 3) * Math.PI * 2;
      const pts: THREE.Vector3[] = [];
      for (let k = 0; k <= 24; k++) {
        const t = k / 24;
        const a = startAngle + t * Math.PI * 2.5;
        const r = THREE.MathUtils.lerp(0.76, 1.12, t);
        pts.push(new THREE.Vector3(Math.cos(a) * r, t * colH, Math.sin(a) * r));
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      const sGeo = new THREE.TubeGeometry(curve, 32, isFB ? 0.036 : 0.028, 6, false);
      const sMesh = new THREE.Mesh(sGeo, spiralMat);
      group.add(sMesh);
      spiralMeshes.push(sMesh);
    }

    // 5) 底部向上喷射旋转的光点粒子
    const pCount = 28;
    const pPos = new Float32Array(pCount * 3);
    const particleSpeeds = new Float32Array(pCount);
    for (let i = 0; i < pCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 0.52 + Math.random() * 0.56;
      pPos[i * 3] = Math.cos(a) * r;
      pPos[i * 3 + 1] = Math.random() * colH * 0.6;
      pPos[i * 3 + 2] = Math.sin(a) * r;
      particleSpeeds[i] = 1.6 + Math.random() * 1.8;
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    const pMat = new THREE.PointsMaterial({
      color: secondaryHex,
      size: isFB ? 0.16 : 0.13,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const particles = new THREE.Points(pGeo, pMat);
    group.add(particles);

    this.fxGroup.add(group);
    this.risingVortexes.push({
      group,
      outerCyl,
      innerCyl,
      outerMat,
      innerMat,
      baseRing,
      baseRingMat,
      spiralMeshes,
      spiralMat,
      particles,
      particleSpeeds,
      elapsed: 0,
      duration: 3.0,
    });
  }

  private spawnParticleBurst(node: THREE.Group, mode: 'failed' | 'solved') {
    const wp = new THREE.Vector3();
    node.getWorldPosition(wp);
    wp.y += 1.2;

    const isV03 = this.currentVersion === '0.3' || this.currentVersion === '0.5';
    const count = isV03 ? 24 : mode === 'solved' ? 60 : 40;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);

    const colA = new THREE.Color(
      isV03
        ? mode === 'solved'
          ? 0x00d4ff
          : 0xff2a1f
        : mode === 'solved'
        ? STATE_COLOR.solved
        : STATE_COLOR.failed
    );
    const colB = new THREE.Color(
      isV03
        ? mode === 'solved'
          ? 0x0284c7
          : 0x00d4ff
        : mode === 'solved'
        ? STATE_COLOR.firstBlood
        : 0xff8a65
    );
    const tmpCol = new THREE.Color();

    for (let i = 0; i < count; i++) {
      positions[i * 3] = wp.x;
      positions[i * 3 + 1] = wp.y;
      positions[i * 3 + 2] = wp.z;

      if (mode === 'solved') {
        const angle = Math.random() * Math.PI * 2;
        const horiz = 1.2 + Math.random() * 2.8;
        velocities[i * 3] = Math.cos(angle) * horiz;
        velocities[i * 3 + 1] = 4.0 + Math.random() * 4.5;
        velocities[i * 3 + 2] = Math.sin(angle) * horiz;
      } else {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        const speed = 2.5 + Math.random() * 3.5;
        velocities[i * 3] = Math.sin(phi) * Math.cos(theta) * speed;
        velocities[i * 3 + 1] = Math.abs(Math.cos(phi)) * speed + 1.2;
        velocities[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * speed + 1.5;
      }

      tmpCol.copy(colA).lerp(colB, Math.random());
      colors[i * 3] = tmpCol.r;
      colors[i * 3 + 1] = tmpCol.g;
      colors[i * 3 + 2] = tmpCol.b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: isV03 ? 0.14 : 0.2,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });

    const points = new THREE.Points(geo, mat);
    this.fxGroup.add(points);

    this.particleBursts.push({
      points,
      velocities,
      gravity: mode === 'solved' ? -6.0 : -4.0,
      damping: mode === 'solved' ? 0.98 : 0.94,
      elapsed: 0,
      duration: mode === 'solved' ? 1.6 : 1.0,
    });
  }

  private spawnShockwave(
    node: THREE.Group,
    colorHex: number,
    maxScale: number,
    duration: number,
    delay: number
  ) {
    const wp = new THREE.Vector3();
    node.getWorldPosition(wp);
    wp.y += 0.25;

    const geo = new THREE.RingGeometry(0.32, 0.44, 48);
    const mat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.88,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.copy(wp);
    mesh.scale.setScalar(0.2);
    mesh.visible = delay <= 0;
    this.fxGroup.add(mesh);

    this.shockwaves.push({
      mesh,
      mat,
      delay,
      elapsed: 0,
      duration,
      maxScale,
    });
  }

  private spawnDataReturn(curve: THREE.Curve<THREE.Vector3>) {
    const count = 28;
    const positions = new Float32Array(count * 3);
    const offsets = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      offsets[i] = (i / count) * 0.35;
    }

    const isV03 = this.currentVersion === '0.3' || this.currentVersion === '0.5';
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: isV03 ? 0x00d4ff : STATE_COLOR.solved,
      size: isV03 ? 0.16 : 0.24,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
    });
    const points = new THREE.Points(geo, mat);
    this.fxGroup.add(points);

    this.dataReturns.push({
      points,
      curve,
      offsets,
      elapsed: 0,
      duration: 1.9,
    });
  }

  private spawnCircularBusPulse(startTheta: number) {
    const arcGeo = new THREE.TorusGeometry(8.6, 0.2, 10, 48, Math.PI * 0.32);
    const mat = new THREE.MeshBasicMaterial({
      color: STATE_COLOR.solved,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
    });
    const meshCW = new THREE.Mesh(arcGeo, mat);
    const meshCCW = new THREE.Mesh(arcGeo, mat.clone());
    meshCW.rotation.x = Math.PI / 2;
    meshCCW.rotation.x = Math.PI / 2;
    meshCW.position.y = 0.28;
    meshCCW.position.y = 0.28;
    this.coreGroup.add(meshCW, meshCCW);

    this.busPulses.push({
      meshCW,
      meshCCW,
      startTheta,
      elapsed: 0,
      duration: 1.8,
    });
  }

  private spawnGroundRipple(x: number, z: number, colorHex: number) {
    const slot = this.groundRipples.find((r) => !r.active) || this.groundRipples[0];
    slot.active = true;
    slot.elapsed = 0;
    slot.mat.color.setHex(colorHex);
    slot.mat.opacity =
      this.currentVersion === '0.3' || this.currentVersion === '0.5' ? 0.45 : 0.78;
    slot.mesh.position.set(x, -0.55, z);
    slot.mesh.scale.setScalar(0.5);
    slot.mesh.visible = true;
  }

  private spawnFloatText(worldPos: THREE.Vector3, text: string, colorHex: string) {
    // v0.3 / v0.5 严格禁止任何动态飘字 (no floating combat text)
    if (this.currentVersion === '0.3' || this.currentVersion === '0.5') return;
    const sprite = createFloatTextSprite(text, colorHex);
    sprite.position.copy(worldPos);
    this.fxGroup.add(sprite);
    this.floatTexts.push({
      sprite,
      elapsed: 0,
      duration: 1.5,
      startY: worldPos.y,
    });
  }

  private highlightCrossLinksForZone(zoneId: ZoneId) {
    this.crossLinks.forEach((val, key) => {
      if (key.includes(zoneId)) {
        val.timer = 2.4;
      }
    });
  }

  private refreshZoneTelemetry(zone: ZoneRuntime, _flashWhite = false) {
    const solvedCount = zone.config.challenges.filter((c) => c.state === 'solved').length;
    const threatsCount = zone.config.challenges.filter((c) => c.state === 'attacking').length;
    zone.config.threats = threatsCount;
    const roundedScore = Math.round(zone.displayedScore);
    zone.v03LabelSprite.userData.redraw?.(
      roundedScore,
      zone.config.totalScore,
      solvedCount,
      zone.config.challenges.length,
      threatsCount,
      true,
      this.currentVersion === '0.3'
    );
    zone.v03FloorProjRedraw(
      solvedCount,
      zone.config.challenges.length,
      threatsCount > 0
    );
  }

  private refreshAttackTelemetry() {
    const activeCount = this.activeBeams.filter((b) => !b.retiring).length;
    this.attackTelemetrySprite?.userData?.redraw?.(
      activeCount,
      this.playerOrbs.length,
      this.totalPayloadsDispatched
    );
  }

  public findChallengeAndZone(challengeId: string): {
    challenge: Challenge;
    zone: ZoneRuntime;
    node: THREE.Group;
  } | null {
    for (const zone of this.zones.values()) {
      const node = zone.nodes.get(challengeId);
      if (node) {
        const ch = zone.config.challenges.find((c) => c.id === challengeId)!;
        return { challenge: ch, zone, node };
      }
    }
    return null;
  }

  private getOverviewScale(): number {
    const w = this.container.clientWidth || window.innerWidth || 1920;
    const h = this.container.clientHeight || window.innerHeight || 1080;
    const aspect = w / Math.max(1, h);
    if (!this.panelsVisible) {
      if (aspect < 1.3) return 1.04;
      if (aspect > 2.05) return 0.84;
      return 0.90;
    }
    if (aspect < 1.1) return 1.16;
    if (aspect < 1.35) return 1.04;
    return 0.96;
  }

  private getDefaultOverviewPose(mode: CameraMode): {
    endPos: THREE.Vector3;
    endTarget: THREE.Vector3;
  } {
    const isV05 = this.currentVersion === '0.5';
    const ovScale = this.getOverviewScale();
    if (mode === 'panorama') {
      const distZ = 54 * ovScale;
      const posY = 38 * ovScale;
      return {
        endPos: new THREE.Vector3(0, posY, distZ),
        endTarget: new THREE.Vector3(0, -0.8, 0),
      };
    }

    // 默认视角与回中视角：视角再拉远一些，在 1920x1080 下清晰展示前景分区所有设备、中央高能光球与环周流光管道
    const azimuthRad = (23 * Math.PI) / 180;
    const sinA = Math.sin(azimuthRad);
    const cosA = Math.cos(azimuthRad);

    const target = isV05
      ? new THREE.Vector3(2.1, -0.75, 3.6)
      : new THREE.Vector3(2.1, -0.75, 3.8);
    const horizR = (isV05 ? 41.2 : 42.2) * ovScale;
    const heightY = (isV05 ? 14.0 : 14.4) * ovScale;
    return {
      endPos: new THREE.Vector3(
        target.x + sinA * horizR,
        heightY,
        target.z + cosA * horizR
      ),
      endTarget: target,
    };
  }

  public setCameraMode(mode: CameraMode) {
    this.currentCameraMode = mode;
    this.focusedZoneId = null;
    if (this.attackFollowAnim) {
      this.attackFollowAnim = null;
      this.onAttackFollowBanner?.(null);
    }
    this.scene.fog =
      this.currentVersion === '0.3'
        ? new THREE.FogExp2(0x020610, 0.035)
        : new THREE.FogExp2(0x020408, 0.005);
    const { endPos, endTarget } = this.getDefaultOverviewPose(mode);
    this.startCameraTransition(endPos, endTarget, this.autoRotateEnabled, 1.2);
  }

  /**
   * 按钮1：回中 (Reset View) - 1.2s easeInOutCubic 平滑复位默认俯瞰视角并关闭冲突控制
   */
  public resetView() {
    if (this.attackFollowAnim) {
      this.attackFollowAnim = null;
      this.onAttackFollowBanner?.(null);
    }
    this.targetPullTimer = 0;
    this.focusedZoneId = null;
    const { endPos, endTarget } = this.getDefaultOverviewPose(this.currentCameraMode);
    this.startCameraTransition(endPos, endTarget, this.autoRotateEnabled, 1.2);
  }

  /**
   * 按钮2：自动旋转 (Auto Rotate) - 开启/关闭，拖拽暂停，松手 3 秒自动恢复
   */
  public setAutoRotateEnabled(enabled: boolean) {
    this.autoRotateEnabled = enabled;
    this.controls.autoRotateSpeed = 1.6;
    if (this.autoRotateResumeTimer !== null) {
      clearTimeout(this.autoRotateResumeTimer);
      this.autoRotateResumeTimer = null;
    }
    if (!enabled) {
      this.controls.autoRotate = false;
    } else if (!this.cameraTransition && !this.attackFollowAnim) {
      this.controls.autoRotate = true;
    }
  }

  /**
   * 按钮3：面板隐藏 - 同步更新取景缩放并在 ResizeObserver 下无畸变适配
   */
  public setPanelsVisible(visible: boolean) {
    if (this.panelsVisible === visible) return;
    const prevScale = this.getOverviewScale();
    this.panelsVisible = visible;
    const nextScale = this.getOverviewScale();
    this.handleResize();

    if (!this.focusedZoneId && !this.attackFollowAnim && !this.cameraTransition) {
      const ratio = nextScale / Math.max(0.01, prevScale);
      const offset = this.camera.position.clone().sub(this.controls.target);
      offset.multiplyScalar(ratio);
      const nextPos = this.controls.target.clone().add(offset);
      this.startCameraTransition(
        nextPos,
        this.controls.target.clone(),
        this.autoRotateEnabled,
        0.45
      );
    }
  }

  /**
   * 按钮4：攻击跟踪 (Attack Follow) - 仅在解题/一血触发 4 阶段 CatmullRomCurve3 运镜
   */
  public setAttackFollowEnabled(enabled: boolean) {
    this.attackFollowEnabled = enabled;
    if (!enabled && this.attackFollowAnim) {
      const originPos = this.attackFollowAnim.originCamPos.clone();
      const originTarget = this.attackFollowAnim.originTarget.clone();
      this.attackFollowAnim = null;
      this.onAttackFollowBanner?.(null);
      this.startCameraTransition(originPos, originTarget, this.autoRotateEnabled, 0.9);
    }
  }

  public getControlDebugState() {
    return {
      autoRotateEnabled: this.autoRotateEnabled,
      controlsAutoRotate: this.controls.autoRotate,
      attackFollowEnabled: this.attackFollowEnabled,
      attackFollowActive: Boolean(this.attackFollowAnim),
      attackFollowElapsed: this.attackFollowAnim
        ? this.attackFollowAnim.elapsed
        : null,
      panelsVisible: this.panelsVisible,
      cameraPos: this.camera.position.toArray(),
      targetPos: this.controls.target.toArray(),
    };
  }

  private startAttackFollow(
    challenge: Challenge,
    zone: ZoneRuntime,
    node: THREE.Group,
    teamName: string,
    isFirstBlood: boolean
  ) {
    if (this.disposed || this.attackFollowAnim) return;

    const originCamPos = this.camera.position.clone();
    const originTarget = this.controls.target.clone();

    if (this.autoRotateResumeTimer !== null) {
      clearTimeout(this.autoRotateResumeTimer);
      this.autoRotateResumeTimer = null;
    }
    this.cameraTransition = null;
    this.targetPullTimer = 0;
    this.controls.enabled = false;
    this.controls.autoRotate = false;

    const worldTarget = new THREE.Vector3();
    node.getWorldPosition(worldTarget);
    const devicePos = worldTarget.clone().setY(worldTarget.y + 1.15);

    // 0.3 与 0.5 攻击激光起点均位于绝对中心高能橙红等离子光球 (0, 1.48, 0)
    const attackOrigin = new THREE.Vector3(0, 1.48, 0);
    const mid = attackOrigin.clone().lerp(devicePos, 0.5);
    mid.y += 1.85;

    const curve = new THREE.CatmullRomCurve3(
      [attackOrigin, mid, devicePos],
      false,
      'catmullrom',
      0.45
    );

    const dirFromOrigin = devicePos.clone().sub(attackOrigin).normalize();
    const sideVec = new THREE.Vector3(-dirFromOrigin.z, 0, dirFromOrigin.x).normalize();

    const vantageStartPos = attackOrigin
      .clone()
      .addScaledVector(dirFromOrigin, -4.6)
      .addScaledVector(sideVec, 2.0);
    vantageStartPos.y = Math.max(4.6, attackOrigin.y + 3.4);

    const outwardDir = new THREE.Vector3(devicePos.x, 0, devicePos.z);
    if (outwardDir.lengthSq() < 0.01) {
      outwardDir.set(0.6, 0, 1);
    }
    outwardDir.normalize();
    const orbitBaseAngle = Math.atan2(outwardDir.x, outwardDir.z);

    this.onAttackFollowBanner?.(null);

    this.attackFollowAnim = {
      elapsed: 0,
      originCamPos,
      originTarget,
      startCamPos: this.camera.position.clone(),
      startTarget: this.controls.target.clone(),
      curve,
      vantageStartPos,
      devicePos,
      orbitRadius: 3.4,
      orbitBaseAngle,
      orbitHeight: 3.1,
      bannerShown: false,
      meta: {
        teamName,
        teamColor: isFirstBlood ? '#ffd24a' : '#00ff88',
        challengeId: challenge.id,
        challengeName: challenge.name,
        zoneName: zone.config.shortName,
        isFirstBlood,
        points: challenge.points,
      },
    };
  }

  public focusZone(zoneId: ZoneId | 'attack') {
    if (zoneId === 'attack') {
      this.focusedZoneId = null;
      this.startCameraTransition(
        new THREE.Vector3(0, 11.2, 19.5),
        new THREE.Vector3(0, 0.8, 0),
        this.autoRotateEnabled
      );
      return;
    }
    const z = this.zones.get(zoneId);
    if (!z) return;
    this.focusedZoneId = zoneId;
    const activePos = z.config.position;
    const zp = new THREE.Vector3(...activePos);
    const outDir = zp.clone().normalize();
    const camPos = zp
      .clone()
      .add(outDir.multiplyScalar(16.5))
      .add(new THREE.Vector3(0, 9.5, 0));
    this.startCameraTransition(
      camPos,
      zp.clone().setY(1.1 + activePos[1]),
      this.autoRotateEnabled
    );
  }

  public selectChallengeById(challengeId: string | null) {
    if (!challengeId) {
      if (this.selectedNode) {
        (this.selectedNode.userData as ChallengeNodeUserData).setSelected(false);
        this.selectedNode = null;
      }
      this.onSelectChange?.(null);
      return;
    }
    const found = this.findChallengeAndZone(challengeId);
    if (!found) return;
    if (this.selectedNode && this.selectedNode !== found.node) {
      (this.selectedNode.userData as ChallengeNodeUserData).setSelected(false);
    }
    this.selectedNode = found.node;
    (found.node.userData as ChallengeNodeUserData).setSelected(true);
    this.emitSelectedNodeScreenPosition();
  }

  private startCameraTransition(
    endPos: THREE.Vector3,
    endTarget: THREE.Vector3,
    endAutoRotate: boolean,
    duration = 1.2
  ) {
    if (this.autoRotateResumeTimer !== null) {
      clearTimeout(this.autoRotateResumeTimer);
      this.autoRotateResumeTimer = null;
    }
    this.controls.enabled = false;
    this.controls.autoRotate = false;
    this.cameraTransition = {
      active: true,
      elapsed: 0,
      duration,
      startPos: this.camera.position.clone(),
      endPos,
      startTarget: this.controls.target.clone(),
      endTarget,
      endAutoRotate,
    };
  }

  private bindEvents() {
    window.addEventListener('resize', this.handleResize);
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.handleResize());
      this.resizeObserver.observe(this.container);
    }
    const dom = this.renderer.domElement;
    dom.addEventListener('pointermove', this.handlePointerMove);
    dom.addEventListener('click', this.handleClick);
    dom.addEventListener('webglcontextlost', this.handleContextLost);
    dom.addEventListener('webglcontextrestored', this.handleContextRestored);
  }

  private handleContextLost = (e: Event) => {
    e.preventDefault();
    this.contextLost = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
  };

  private handleContextRestored = () => {
    if (this.disposed) return;
    this.contextLost = false;
    this.handleResize();
    this.startLoop();
  };

  private handleResize = () => {
    if (this.disposed || this.contextLost) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    if (width <= 0 || height <= 0) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    if (this.isSoftwareGl) {
      this.renderer.setPixelRatio(Math.min(1, 1280 / Math.max(1, width)));
    }
    this.renderer.setSize(width, height);
    if (this.composer) {
      this.composer.setSize(width, height);
    }
    if (this.fxaaPass) {
      const pr = this.renderer.getPixelRatio();
      this.fxaaPass.material.uniforms['resolution'].value.set(
        1 / (width * pr),
        1 / (height * pr)
      );
    }
  };

  private lastRaycastTime = 0;
  private handlePointerMove = (e: PointerEvent) => {
    const now = performance.now();
    if (now - this.lastRaycastTime < 28) return;
    this.lastRaycastTime = now;

    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.pickTargets, false);

    if (hits.length > 0) {
      const hitBody = hits[0].object;
      const node = (hitBody.userData.challengeGroup || hitBody.parent) as THREE.Group;
      if (node && node.userData?.challengeId) {
        if (this.hoveredNode !== node) {
          (this.hoveredNode?.userData as ChallengeNodeUserData | undefined)?.setHover(false);
          this.hoveredNode = node;
          (node.userData as ChallengeNodeUserData).setHover(true);
          this.renderer.domElement.style.cursor = 'pointer';
        }
        const ud = node.userData as ChallengeNodeUserData;
        const zone = this.zones.get(ud.zoneId)!;
        this.onHoverChange?.({
          challenge: ud.challenge,
          zoneName: zone.config.name,
          zoneColor: '#00d4ff',
          screenX: e.clientX,
          screenY: e.clientY,
        });
        return;
      }
    }

    if (this.hoveredNode) {
      (this.hoveredNode.userData as ChallengeNodeUserData).setHover(false);
      this.hoveredNode = null;
      this.renderer.domElement.style.cursor = 'grab';
      this.onHoverChange?.(null);
    }
  };

  private handleClick = (e: MouseEvent) => {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.pickTargets, false);

    if (hits.length > 0) {
      const hitBody = hits[0].object;
      const node = (hitBody.userData.challengeGroup || hitBody.parent) as THREE.Group;
      if (node && node.userData?.challengeId) {
        if (this.selectedNode && this.selectedNode !== node) {
          (this.selectedNode.userData as ChallengeNodeUserData).setSelected(false);
        }
        this.selectedNode = node;
        (node.userData as ChallengeNodeUserData).setSelected(true);
        this.emitSelectedNodeScreenPosition();
        return;
      }
    }
  };

  private emitSelectedNodeScreenPosition() {
    if (!this.selectedNode) return;
    const ud = this.selectedNode.userData as ChallengeNodeUserData;
    const zone = this.zones.get(ud.zoneId);
    if (!zone) return;

    this.selectedNode.getWorldPosition(_projVec);
    _projVec.y += 2.2;
    _projVec.project(this.camera);

    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    const screenX = (_projVec.x * 0.5 + 0.5) * width;
    const screenY = (-(_projVec.y * 0.5) + 0.5) * height;

    this.onSelectChange?.({
      challenge: ud.challenge,
      zoneName: zone.config.name,
      zoneColor: '#00d4ff',
      screenX,
      screenY,
    });
  }

  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
    gl.flush();
    const startMs = performance.now();
    const scheduleRaf = () => {
      if (this.disposed || this.contextLost) return;
      this.frameId = requestAnimationFrame(cb);
    };
    const poll = () => {
      if (this.disposed || this.contextLost) {
        if (sync) gl.deleteSync(sync);
        return;
      }
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED && performance.now() - startMs < 1500) {
        this.frameId = window.setTimeout(poll, 20);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(scheduleRaf, 120);
      }
    };
    this.frameId = window.setTimeout(poll, 20);
  }

  private renderSingleFrame(): number {
    if (this.disposed || this.contextLost) return 0;
    const t0 = performance.now();
    if (this.useSoftwarePacing || !this.composer) {
      this.renderer.render(this.scene, this.camera);
    } else {
      try {
        this.composer.render();
      } catch (err) {
        console.warn('Composer fallback to direct render:', err);
        this.composer = undefined;
        this.renderer.render(this.scene, this.camera);
      }
    }
    return performance.now() - t0;
  }

  private startLoop() {
    this.lastFrameTimeMs = performance.now();
    const tick = () => {
      if (this.disposed || this.contextLost) return;
      const nowMs = performance.now();
      const rawDt = Math.max(0, (nowMs - this.lastFrameTimeMs) / 1000);
      this.lastFrameTimeMs = nowMs;

      if (document.hidden) {
        this.frameId = requestAnimationFrame(tick);
        return;
      }

      const dt = Math.min(rawDt || 0.016, 0.05);
      this.elapsed += dt;
      this.sharedUniforms.uTime.value = this.elapsed;
      if (this.vignettePass) {
        this.vignettePass.uniforms.uTime.value = this.elapsed;
      }

      this.updateScene(dt, this.elapsed, rawDt);

      const renderMs = this.renderSingleFrame();

      if (!this.useSoftwarePacing && (renderMs > 450 || renderMs > 280)) {
        this.slowFrameStreak += renderMs > 450 ? 2 : 1;
        if (this.slowFrameStreak >= 4) {
          // Automatic graceful step-down for throttled/integrated/emulated GPUs
          this.useSoftwarePacing = true;
          this.controls.enableDamping = false;
          if (this.mirrorReflector) {
            this.mirrorReflector.visible = false;
          }
          if (this.composer) {
            this.composer.dispose();
            this.composer = undefined;
            this.bloomPass = undefined;
            this.vignettePass = undefined;
            this.fxaaPass = undefined;
          }
          this.renderer.setPixelRatio(1);
          this.handleResize();
          this.slowFrameStreak = 0;
        }
      } else {
        this.slowFrameStreak = 0;
      }

      if (this.useSoftwarePacing) {
        this.afterDraw(tick);
      } else if (renderMs > 80) {
        this.frameId = window.setTimeout(() => {
          if (!this.disposed && !this.contextLost) {
            this.frameId = requestAnimationFrame(tick);
          }
        }, 24);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    this.loopTick = tick;
    this.frameId = requestAnimationFrame(tick);
  }

  private updateScene(dt: number, elapsed: number, rawDt = dt) {
    if (this.starField) {
      this.starField.rotation.y += dt * 0.008;
    }

    // 0.8s 平滑溶解过渡动画：从 0.2版 实体金属溶解至 0.1版 赛博线框（反之亦然）
    if (Math.abs(this.wireframeMix - this.targetWireframeMix) > 0.0005) {
      const step = dt / 0.8;
      if (this.wireframeMix < this.targetWireframeMix) {
        this.wireframeMix = Math.min(this.targetWireframeMix, this.wireframeMix + step);
      } else {
        this.wireframeMix = Math.max(this.targetWireframeMix, this.wireframeMix - step);
      }
      this.applyWireframeTransitionMix(this.wireframeMix);
    }

    // 0.1版 (Tron 赛博线框风) 中央交织红色线框环旋转动画与地面雷达扫描线旋转
    if (this.wireframeMix > 0.005) {
      for (let i = 0; i < this.v01TronRedTorusRings.length; i++) {
        const ring = this.v01TronRedTorusRings[i];
        const dir = i % 2 === 0 ? 1 : -1;
        ring.rotation.x += dt * (0.65 + i * 0.18) * dir;
        ring.rotation.y += dt * (0.85 - i * 0.11) * -dir;
        ring.rotation.z += dt * 0.32 * dir;
      }
      if (this.v01TronRadarSweepLine) {
        this.v01TronRadarSweepLine.rotation.y -= dt * 0.55;
      }
    }

    // v0.3 外圈冷却环与 v0.5 中央高能等离子光球及双环陀螺动画
    if (this.v03CoreGimbalA && this.v03CoreGimbalB) {
      this.v03CoreGimbalA.rotation.y += dt * 0.22;
      this.v03CoreGimbalB.rotation.y -= dt * 0.18;
    }

    if (
      this.wireframeMix < 0.995 &&
      this.v05OrangeRedCore &&
      this.v05ConsoleGimbalA &&
      this.v05ConsoleGimbalB
    ) {
      const pulse = Math.sin(elapsed * 4.2);
      if (this.v05PlasmaOuterShell) {
        this.v05PlasmaOuterShell.scale.setScalar(1.0 + pulse * 0.065);
      }
      if (this.v05PlasmaHaloSprite) {
        const s = 4.8 + pulse * 0.32;
        this.v05PlasmaHaloSprite.scale.set(s, s, 1);
      }
      this.v05ConsoleGimbalA.rotation.y += dt * 0.45;
      this.v05ConsoleGimbalB.rotation.y -= dt * 0.34;
    }

    // 更新径向数据管道上的流动光粒子流 (仅在非纯线框模式下更新)
    if (this.wireframeMix < 0.995) {
      for (let i = 0; i < this.pipeParticleStreams.length; i++) {
        const stream = this.pipeParticleStreams[i];
        const posAttr = stream.points.geometry.attributes.position as THREE.BufferAttribute;
        const arr = posAttr.array as Float32Array;
        const count = stream.offsets.length;
        for (let k = 0; k < count; k++) {
          const rawT = (elapsed * stream.speed + stream.offsets[k]) % 1;
          const u = stream.dir > 0 ? rawT : 1 - rawT;
          stream.curve.getPointAt(u, _tmpVecC);
          arr[k * 3] = _tmpVecC.x;
          arr[k * 3 + 1] = _tmpVecC.y + 0.025;
          arr[k * 3 + 2] = _tmpVecC.z;
        }
        posAttr.needsUpdate = true;
      }
    }

    const isV03 = true;
    const isV03OrV04 = true;
    const solidAlpha = 1.0 - this.wireframeMix;
    this.zones.forEach((zone) => {
      zone.platformGroup.position.y = 0;

      if (zone.edgeHighlightTimer > 0) {
        zone.edgeHighlightTimer = Math.max(0, zone.edgeHighlightTimer - dt);
        zone.edgeNeonMat.opacity = 0.86 * solidAlpha;
      } else {
        zone.edgeNeonMat.opacity = 0.42 * solidAlpha;
      }

        let needRedraw = false;
        if (Math.abs(zone.displayedScore - zone.targetScore) > 0.5) {
          zone.displayedScore = THREE.MathUtils.damp(
            zone.displayedScore,
            zone.targetScore,
            5,
            dt
          );
          if (Math.abs(zone.displayedScore - zone.targetScore) < 2) {
            zone.displayedScore = zone.targetScore;
          }
          needRedraw = true;
        }
        if (zone.telemetryBounceTimer > 0) {
          zone.telemetryBounceTimer = Math.max(0, zone.telemetryBounceTimer - dt);
          if (zone.telemetryBounceTimer === 0) {
            needRedraw = true;
          }
        }
        if (needRedraw) {
          this.refreshZoneTelemetry(zone, zone.telemetryBounceTimer > 0.35);
        }
      });

      this.crossLinks.forEach((link) => {
        if (link.timer > 0) {
          link.timer = Math.max(0, link.timer - dt);
          link.mat.opacity = 0.14 + (link.timer / 2.4) * 0.42;
        }
      });

      for (let i = 0; i < this.allChallengeNodes.length; i++) {
        updateChallengeNode(this.allChallengeNodes[i], dt, elapsed);
      }

      void isV03;
      for (let i = this.activeBeams.length - 1; i >= 0; i--) {
        const b = this.activeBeams[i];
        b.beamMat.uniforms.uColor.value.lerp(b.targetColor, Math.min(1, dt * 10));
        const sXZ = THREE.MathUtils.damp(b.tubeMesh.scale.x, b.targetScaleXZ, 10, dt);
        b.tubeMesh.scale.set(sXZ, 1, sXZ);
        b.haloMesh?.scale.set(sXZ, 1, sXZ);

        if (!b.arrived) {
          b.progress += dt / b.duration;
          const t = Math.min(1.0, b.progress);
          const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

          b.curve.getPointAt(eased, _tmpVecC);
          b.probeMesh.position.copy(_tmpVecC);
          b.probeMesh.scale.setScalar(1.0 + Math.sin(eased * Math.PI) * 0.5);
          b.beamMat.uniforms.uProgress.value = eased;
          if (b.haloMat) b.haloMat.uniforms.uProgress.value = eased;

          const arr = b.trailPositions;
          for (let k = 7; k > 0; k--) {
            arr[k * 3] = arr[(k - 1) * 3];
            arr[k * 3 + 1] = arr[(k - 1) * 3 + 1];
            arr[k * 3 + 2] = arr[(k - 1) * 3 + 2];
          }
          arr[0] = _tmpVecC.x;
          arr[1] = _tmpVecC.y;
          arr[2] = _tmpVecC.z;
          b.trailLine.geometry.attributes.position.needsUpdate = true;

          if (t >= 1.0) {
            b.arrived = true;
            b.probeMesh.visible = false;
            b.trailLine.visible = false;
            b.beamMat.uniforms.uOpacity.value = isV03OrV04 ? 0.85 : 0.55;
            if (b.haloMat) b.haloMat.uniforms.uOpacity.value = 0.88;
            b.onArriveCallback?.();
          }
        } else if (!b.retiring) {
          b.beamMat.uniforms.uOpacity.value = 0.82 + Math.sin(elapsed * 4.0) * 0.1;
        }

        if (b.solvingCard) {
          b.solvingCard.visible = !isV03OrV04;
          b.solvingCard.lookAt(this.camera.position);
          b.solvingCard.scale.y = THREE.MathUtils.damp(b.solvingCard.scale.y, 1.0, 12, dt);
        }

        if (b.retiring) {
          b.retireTimer -= dt;
          const fadeOp = Math.max(0, b.retireTimer);
          b.beamMat.uniforms.uOpacity.value = fadeOp;
          if (b.haloMat) b.haloMat.uniforms.uOpacity.value = fadeOp * 0.88;
          if (b.retireTimer <= 0) {
            this.disposeBeam(b);
            this.activeBeams.splice(i, 1);
            this.refreshAttackTelemetry();
          }
        }
      }

      this.updateFXPools(dt, elapsed);
      this.updateCameraChoreography(dt, rawDt);
    }

  private updateFXPools(dt: number, _elapsed: number) {
    // 1) 3D 球形护盾 (3.0s)
    for (let i = this.shieldDomes.length - 1; i >= 0; i--) {
      const sd = this.shieldDomes[i];
      sd.elapsed += dt;
      sd.mesh.rotation.y += dt * 0.65;
      if (sd.elapsed < 0.22) {
        const s = 0.32 + (sd.elapsed / 0.22) * 0.68;
        sd.mesh.scale.setScalar(s);
        sd.mat.uniforms.uOpacity.value = 0.92;
        sd.wireMat.opacity = 0.38;
      } else if (sd.elapsed > sd.duration - 0.6) {
        const fade = Math.max(0, 1.0 - (sd.elapsed - (sd.duration - 0.6)) / 0.6);
        sd.mat.uniforms.uOpacity.value = fade * 0.92;
        sd.wireMat.opacity = fade * 0.38;
        sd.mesh.scale.setScalar(1.0 + (1.0 - fade) * 0.12);
      } else {
        const breathe = 1.0 + Math.sin(sd.elapsed * 5.0) * 0.025;
        sd.mesh.scale.setScalar(breathe);
      }
      if (sd.elapsed >= sd.duration) {
        this.fxGroup.remove(sd.mesh);
        sd.mesh.geometry.dispose();
        sd.mat.dispose();
        sd.wireMesh.geometry.dispose();
        sd.wireMat.dispose();
        this.shieldDomes.splice(i, 1);
      }
    }

    // 2) 设备底部向上射出并旋转的夺旗成功(青绿)/一血(金黄)光效 (3.0s)
    for (let i = this.risingVortexes.length - 1; i >= 0; i--) {
      const rv = this.risingVortexes[i];
      rv.elapsed += dt;
      rv.group.rotation.y += dt * 3.8;
      rv.innerCyl.rotation.y -= dt * 5.4;

      const pAttr = rv.particles.geometry.attributes.position as THREE.BufferAttribute;
      const pArr = pAttr.array as Float32Array;
      const pCount = rv.particleSpeeds.length;
      for (let k = 0; k < pCount; k++) {
        pArr[k * 3 + 1] += rv.particleSpeeds[k] * dt;
        if (pArr[k * 3 + 1] > 3.6) {
          pArr[k * 3 + 1] = 0.08;
        }
      }
      pAttr.needsUpdate = true;

      let alphaMult = 1.0;
      let yScale = 1.0;
      if (rv.elapsed < 0.24) {
        const u = rv.elapsed / 0.24;
        yScale = 0.1 + 0.9 * (1.0 - Math.pow(1.0 - u, 3));
        alphaMult = u;
      } else if (rv.elapsed > rv.duration - 0.65) {
        alphaMult = Math.max(0, 1.0 - (rv.elapsed - (rv.duration - 0.65)) / 0.65);
      }
      rv.group.scale.set(1, yScale, 1);
      rv.outerMat.uniforms.uOpacity.value = 0.92 * alphaMult;
      rv.innerMat.uniforms.uOpacity.value = 0.95 * alphaMult;
      rv.baseRingMat.opacity = 0.9 * alphaMult;
      rv.spiralMat.opacity = 0.85 * alphaMult;
      (rv.particles.material as THREE.PointsMaterial).opacity = 0.9 * alphaMult;
      rv.baseRing.scale.setScalar(1.0 + Math.sin(rv.elapsed * 8.0) * 0.08);

      if (rv.elapsed >= rv.duration) {
        this.fxGroup.remove(rv.group);
        rv.outerCyl.geometry.dispose();
        rv.outerMat.dispose();
        rv.innerCyl.geometry.dispose();
        rv.innerMat.dispose();
        rv.baseRing.geometry.dispose();
        rv.baseRingMat.dispose();
        rv.spiralMeshes.forEach((m) => m.geometry.dispose());
        rv.spiralMat.dispose();
        rv.particles.geometry.dispose();
        (rv.particles.material as THREE.Material).dispose();
        this.risingVortexes.splice(i, 1);
      }
    }

    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      if (sw.delay > 0) {
        sw.delay -= dt;
        if (sw.delay <= 0) sw.mesh.visible = true;
        continue;
      }
      sw.elapsed += dt;
      const p = Math.min(1, sw.elapsed / sw.duration);
      const scale = 0.2 + p * (sw.maxScale - 0.2);
      sw.mesh.scale.setScalar(scale);
      sw.mat.opacity = (1.0 - p) * 0.88;
      if (p >= 1) {
        this.fxGroup.remove(sw.mesh);
        sw.mesh.geometry.dispose();
        sw.mat.dispose();
        this.shockwaves.splice(i, 1);
      }
    }

    for (let i = this.particleBursts.length - 1; i >= 0; i--) {
      const pb = this.particleBursts[i];
      pb.elapsed += dt;
      const p = Math.min(1, pb.elapsed / pb.duration);
      const posAttr = pb.points.geometry.attributes.position as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;
      const vels = pb.velocities;
      const count = arr.length / 3;

      for (let k = 0; k < count; k++) {
        vels[k * 3] *= pb.damping;
        vels[k * 3 + 1] += pb.gravity * dt;
        vels[k * 3 + 2] *= pb.damping;

        arr[k * 3] += vels[k * 3] * dt;
        arr[k * 3 + 1] = Math.max(0.05, arr[k * 3 + 1] + vels[k * 3 + 1] * dt);
        arr[k * 3 + 2] += vels[k * 3 + 2] * dt;
      }
      posAttr.needsUpdate = true;
      (pb.points.material as THREE.PointsMaterial).opacity = 1.0 - p;

      if (p >= 1) {
        this.fxGroup.remove(pb.points);
        pb.points.geometry.dispose();
        (pb.points.material as THREE.Material).dispose();
        this.particleBursts.splice(i, 1);
      }
    }

    for (let i = this.dataReturns.length - 1; i >= 0; i--) {
      const dr = this.dataReturns[i];
      dr.elapsed += dt;
      const p = Math.min(1, dr.elapsed / dr.duration);
      const posAttr = dr.points.geometry.attributes.position as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;
      const count = dr.offsets.length;

      for (let k = 0; k < count; k++) {
        const t = Math.max(0, Math.min(1, 1.0 - (p * 1.35 - dr.offsets[k])));
        dr.curve.getPointAt(t, _tmpVecC);
        arr[k * 3] = _tmpVecC.x;
        arr[k * 3 + 1] = _tmpVecC.y + 0.15;
        arr[k * 3 + 2] = _tmpVecC.z;
      }
      posAttr.needsUpdate = true;
      (dr.points.material as THREE.PointsMaterial).opacity = p > 0.8 ? (1.0 - p) * 5.0 : 0.92;

      if (p >= 1) {
        this.fxGroup.remove(dr.points);
        dr.points.geometry.dispose();
        (dr.points.material as THREE.Material).dispose();
        this.dataReturns.splice(i, 1);
      }
    }

    for (let i = this.busPulses.length - 1; i >= 0; i--) {
      const bp = this.busPulses[i];
      bp.elapsed += dt;
      const p = Math.min(1, bp.elapsed / bp.duration);
      bp.meshCW.rotation.z = bp.startTheta + p * Math.PI * 2;
      bp.meshCCW.rotation.z = bp.startTheta - p * Math.PI * 2;
      const op = p > 0.75 ? (1.0 - p) * 4.0 : 0.88;
      (bp.meshCW.material as THREE.MeshBasicMaterial).opacity = op;
      (bp.meshCCW.material as THREE.MeshBasicMaterial).opacity = op;

      if (p >= 1) {
        this.coreGroup.remove(bp.meshCW, bp.meshCCW);
        bp.meshCW.geometry.dispose();
        (bp.meshCW.material as THREE.Material).dispose();
        (bp.meshCCW.material as THREE.Material).dispose();
        this.busPulses.splice(i, 1);
      }
    }

    for (let i = 0; i < this.groundRipples.length; i++) {
      const gr = this.groundRipples[i];
      if (!gr.active) continue;
      gr.elapsed += dt;
      const p = Math.min(1, gr.elapsed / gr.duration);
      gr.mesh.scale.setScalar(0.8 + p * 11.2);
      gr.mat.opacity = (1.0 - p) * 0.72;
      if (p >= 1) {
        gr.active = false;
        gr.mesh.visible = false;
      }
    }

    for (let i = this.floatTexts.length - 1; i >= 0; i--) {
      const ft = this.floatTexts[i];
      ft.elapsed += dt;
      const p = Math.min(1, ft.elapsed / ft.duration);
      ft.sprite.position.y = ft.startY + p * 1.5;
      (ft.sprite.material as THREE.SpriteMaterial).opacity = p > 0.5 ? (1.0 - p) * 2.0 : 1.0;

      if (p >= 1) {
        this.fxGroup.remove(ft.sprite);
        const mat = ft.sprite.material as THREE.SpriteMaterial;
        mat.map?.dispose();
        mat.dispose();
        this.floatTexts.splice(i, 1);
      }
    }
  }

  private updateCameraChoreography(dt: number, rawDt = dt) {
    const easeInOutCubic = (x: number) =>
      x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;

    if (this.attackFollowAnim) {
      const af = this.attackFollowAnim;
      af.elapsed += Math.min(Math.max(0.016, rawDt), 0.28);
      const t = af.elapsed;

      const stage1End = 0.5;
      const stage2End = 1.5;
      const stage3End = 3.5;
      const stage4End = 4.5;

      const showcaseStartPos = new THREE.Vector3(
        af.devicePos.x + Math.sin(af.orbitBaseAngle) * af.orbitRadius,
        af.devicePos.y + af.orbitHeight,
        af.devicePos.z + Math.cos(af.orbitBaseAngle) * af.orbitRadius
      );

      if (t < stage1End) {
        // 阶段一 (0.0s ~ 0.5s)：从当前视角平滑拉近至攻击源起点上方并朝向光束
        const u = easeInOutCubic(Math.min(1, t / stage1End));
        const stage1Target = af.curve.getPointAt(0.32);
        this.camera.position.lerpVectors(af.startCamPos, af.vantageStartPos, u);
        this.controls.target.lerpVectors(af.startTarget, stage1Target, u);
      } else if (t < stage2End) {
        // 阶段二 (0.5s ~ 1.5s)：沿着 CatmullRomCurve3 激光轨迹高速追随飞向目标设备
        const rawU = Math.min(1, (t - stage1End) / (stage2End - stage1End));
        const u = easeInOutCubic(rawU);
        const curvePt = af.curve.getPointAt(u);
        const lookAheadPt = af.curve.getPointAt(Math.min(1, u + 0.14));

        // 结合攻击源位置向特写展示点平滑收拢，避免穿过机柜模型
        const chaseAnchor = new THREE.Vector3().lerpVectors(
          af.vantageStartPos,
          showcaseStartPos,
          u
        );
        const tangentLift = curvePt.clone().add(new THREE.Vector3(0, 2.8 * (1 - rawU * 0.45), 0));
        chaseAnchor.lerp(tangentLift, Math.sin(rawU * Math.PI) * 0.45);

        this.camera.position.copy(chaseAnchor);
        this.controls.target.lerpVectors(lookAheadPt, af.devicePos, u * u);
      } else if (t < stage3End) {
        // 阶段三 (1.5s ~ 3.5s)：到达设备上方斜侧面环绕展示爆炸/皇冠特效，并弹出队伍与题目横幅
        if (!af.bannerShown) {
          af.bannerShown = true;
          this.onAttackFollowBanner?.(af.meta);
        }
        const rawU = Math.min(1, (t - stage2End) / (stage3End - stage2End));
        const sweepAngle = af.orbitBaseAngle + rawU * (Math.PI * 0.34);
        const bobY = Math.sin(rawU * Math.PI) * 0.35;
        this.camera.position.set(
          af.devicePos.x + Math.sin(sweepAngle) * af.orbitRadius,
          af.devicePos.y + af.orbitHeight + bobY,
          af.devicePos.z + Math.cos(sweepAngle) * af.orbitRadius
        );
        this.controls.target.copy(af.devicePos);
      } else if (t < stage4End) {
        // 阶段四 (3.5s ~ 4.5s)：平滑退回原大局视角并消隐追踪横幅
        if (af.bannerShown) {
          af.bannerShown = false;
          this.onAttackFollowBanner?.(null);
        }
        const u = easeInOutCubic(Math.min(1, (t - stage3End) / (stage4End - stage3End)));
        const endOrbitAngle = af.orbitBaseAngle + Math.PI * 0.34;
        const orbitEndPos = new THREE.Vector3(
          af.devicePos.x + Math.sin(endOrbitAngle) * af.orbitRadius,
          af.devicePos.y + af.orbitHeight,
          af.devicePos.z + Math.cos(endOrbitAngle) * af.orbitRadius
        );
        this.camera.position.lerpVectors(orbitEndPos, af.originCamPos, u);
        this.controls.target.lerpVectors(af.devicePos, af.originTarget, u);
      } else {
        this.camera.position.copy(af.originCamPos);
        this.controls.target.copy(af.originTarget);
        this.attackFollowAnim = null;
        this.onAttackFollowBanner?.(null);
        this.controls.enabled = true;
        this.controls.autoRotate = this.autoRotateEnabled;
      }
      // 运镜期间直接 lookAt 目标点，绕过 OrbitControls minDistance=14 对近景特写的钳制
      this.camera.lookAt(this.controls.target);
    } else if (this.cameraTransition && this.cameraTransition.active) {
      const ct = this.cameraTransition;
      ct.elapsed += Math.min(Math.max(0.016, rawDt), 0.25);
      const t = Math.min(1, ct.elapsed / ct.duration);
      const eased = easeInOutCubic(t);

      this.camera.position.lerpVectors(ct.startPos, ct.endPos, eased);
      this.controls.target.lerpVectors(ct.startTarget, ct.endTarget, eased);

      if (t >= 1) {
        this.cameraTransition = null;
        this.controls.enabled = true;
        this.controls.autoRotate = ct.endAutoRotate;
      }
      this.controls.update();
    } else if (this.targetPullTimer > 0) {
      this.targetPullTimer = Math.max(0, this.targetPullTimer - dt);
      if (this.targetPullTimer > 1.3) {
        this.controls.target.lerp(this.targetPullGoal, dt * 3.5);
      } else {
        this.controls.target.lerp(this.targetPullOrigin, dt * 2.5);
      }
      this.controls.update();
    } else {
      this.controls.update();
    }

    if (this.shakeTimer > 0) {
      this.shakeTimer = Math.max(0, this.shakeTimer - dt);
      const mag = this.shakeIntensity * (this.shakeTimer / 0.2);
      this.camera.position.x += (Math.random() - 0.5) * mag;
      this.camera.position.y += (Math.random() - 0.5) * mag;
    }

    if (this.selectedNode) {
      this.emitSelectedNodeScreenPosition();
    }
  }

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    if (this.autoRotateResumeTimer !== null) {
      clearTimeout(this.autoRotateResumeTimer);
      this.autoRotateResumeTimer = null;
    }
    this.attackFollowAnim = null;
    window.removeEventListener('resize', this.handleResize);
    this.resizeObserver?.disconnect();
    const dom = this.renderer.domElement;
    dom.removeEventListener('pointermove', this.handlePointerMove);
    dom.removeEventListener('click', this.handleClick);
    dom.removeEventListener('webglcontextlost', this.handleContextLost);
    dom.removeEventListener('webglcontextrestored', this.handleContextRestored);
    this.envRT?.dispose();
    this.cubeEnvRT?.dispose();
    this.blueCubeEnvTex?.dispose();
    this.pipeParticleSpriteTex?.dispose();
    if (this.v05PlasmaHaloSprite) {
      const mat = this.v05PlasmaHaloSprite.material as THREE.SpriteMaterial;
      mat.map?.dispose();
      mat.dispose();
    }
    this.composer?.dispose();
    if (this.mirrorReflector) {
      this.mirrorReflector.getRenderTarget().dispose();
      this.mirrorReflector.geometry.dispose();
    }
    this.controls.dispose();
    this.renderer.dispose();
    if (dom.parentNode) {
      dom.parentNode.removeChild(dom);
    }
  }
}
