import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
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
  attackBeamVertexShader,
  busRingFragmentShader,
  busRingVertexShader,
  DarkMirrorReflectorShader,
  groundDiscFragmentShader,
  groundDiscVertexShader,
  hexShieldFragmentShader,
  hexShieldVertexShader,
  holoShellFragmentShader,
  holoShellVertexShader,
  plasmaBeamFragmentShader,
  plasmaBeamVertexShader,
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
  private nodePalette!: SharedNodePalette;
  private resizeObserver?: ResizeObserver;
  private envRT?: THREE.WebGLRenderTarget;
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

  // v0.5 Central Octagonal Dark Chrome Attack Command Console
  private v05OrangeRedCore!: THREE.Group;
  private v05ConsoleGimbalA = new THREE.Group();
  private v05ConsoleGimbalB = new THREE.Group();

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

    // 1) Scene & Camera (Deep midnight blue with cinematic volumetric fog, 85mm telephoto lens)
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050e20);
    this.scene.fog = new THREE.FogExp2(0x061226, 0.0052);

    this.camera = new THREE.PerspectiveCamera(24, width / height, 0.1, 450);

    // 2) Renderer (8K sharp focus antialiasing)
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.06;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height);
    this.maxAnisotropy = Math.min(4, Math.max(1, this.renderer.capabilities.getMaxAnisotropy()));

    container.appendChild(this.renderer.domElement);

    // 3) Studio Environment Reflection
    try {
      const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
      const roomEnv = new RoomEnvironment();
      this.envRT = pmremGenerator.fromScene(roomEnv, 0.04);
      this.scene.environment = this.envRT.texture;
      roomEnv.dispose();
      pmremGenerator.dispose();
    } catch (err) {
      console.warn('Environment PMREM fallback:', err);
    }

    // 4) OrbitControls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = !this.isSoftwareGl;
    this.controls.dampingFactor = 0.055;
    this.controls.autoRotate = false;
    this.controls.autoRotateSpeed = 0.8;
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

    // 5) 后处理链（8K 清晰锐焦 + FXAA 抗锯齿 + 柔润克制微辉光）
    if (!this.isSoftwareGl) {
      try {
        const pr = this.renderer.getPixelRatio();
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.camera));

        const isMobile = width < 900;
        this.bloomPass = new UnrealBloomPass(
          new THREE.Vector2(width, height),
          isMobile ? 0.16 : 0.24,
          0.28,
          0.84
        );
        this.composer.addPass(this.bloomPass);

        if (!isMobile) {
          this.vignettePass = new ShaderPass(VignetteChromaticShader);
          this.vignettePass.uniforms.uMacroDof.value = 0.0;
          this.composer.addPass(this.vignettePass);
        }

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

    // 6) Build Scene Hierarchy & Shared Material/Geometry Palette
    this.nodePalette = createSharedNodePalette(this.maxAnisotropy);
    this.scene.add(this.worldGroup);
    this.coreGroup.add(
      this.v01CoreGroup,
      this.v02CoreGroup,
      this.v03CoreGroup,
      this.v04CoreGroup,
      this.v05CenterAttackGroup
    );
    this.worldGroup.add(
      this.groundGroup,
      this.coreGroup,
      this.v01PipesGroup,
      this.v02EnvGroup,
      this.v03PipesGroup,
      this.attackGroup,
      this.fxGroup
    );

    this.setupLights(zonesData);
    this.buildGroundAndAtmosphere();
    this.buildV02HorizonAndBridges(zonesData);
    this.buildCoreBusHub(zonesData);
    this.buildV02CentralCrystalHub(zonesData);
    this.buildV03SleekCoreAndCyanPipelines(zonesData);
    this.buildV04TranslucentGlassCore();
    this.buildZones(zonesData);
    this.buildCrossZoneLinks();
    this.buildAttackZone(teamsData);
    this.buildV02AttackDomeAndSignatureBeams();
    this.buildV03SleekAttackConsole();
    this.buildV05CenterAttackConsole();

    // 初始化默认版本为 v0.5（中央突击版 · 八角暗黑镀铬攻击指挥台 + 高能橙红等离子束核心 + 倾斜单分区大局视角）
    this.setVersion('0.5', true);
    this.seedInitialActiveBeams(zonesData);


    this.bindEvents();
    this.startLoop();
  }

  /**
   * 电影级多点位照明系统 + 双侧冷青轮廓逆光（v0.3 柔和冷色环境光 + 锐利金属棱边反光）
   */
  private setupLights(zonesData: ZoneConfig[]) {
    this.ambientLight = new THREE.AmbientLight(0x284166, 1.18);
    this.scene.add(this.ambientLight);

    this.hemiLight = new THREE.HemisphereLight(0x60a5fa, 0x0a1528, 1.3);
    this.scene.add(this.hemiLight);

    this.keyLight = new THREE.DirectionalLight(0xeef6ff, 2.15);
    this.keyLight.position.set(22, 42, 26);
    this.scene.add(this.keyLight);

    // 左后方强冷青轮廓逆光 (Crisp Rim Lighting on Metal Edges)
    this.rimLight = new THREE.DirectionalLight(0x38bdf8, 2.45);
    this.rimLight.position.set(-26, 28, -28);
    this.scene.add(this.rimLight);

    // 右后方冰青金属棱边轮廓补光
    this.backRightRimLight = new THREE.DirectionalLight(0x22d3ee, 1.9);
    this.backRightRimLight.position.set(26, 26, -24);
    this.scene.add(this.backRightRimLight);

    this.fillLight = new THREE.DirectionalLight(0x6488b4, 1.1);
    this.fillLight.position.set(-18, 22, 24);
    this.scene.add(this.fillLight);

    // Note: Keeping a single PointLight (consoleRedLight) instead of 7 extra per-zone PointLights
    // keeps PBR shader compilation ~3x smaller and prevents WebGL driver stalls/context loss.
    void zonesData;

    // v0.3 前景攻击台单点炽烈橙红核环境微光（全场唯一暖色点光源）
    this.consoleRedLight = new THREE.PointLight(0xff3318, 1.35, 9.0, 2);
    this.consoleRedLight.position.set(0, 1.6, 18.8);
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
      color: 0x16202e,
      metalness: 0.88,
      roughness: 0.28,
    });
    const outerRim = new THREE.Mesh(
      new THREE.TorusGeometry(28.5, 0.12, 8, 96),
      this.outerRimMat
    );
    outerRim.rotation.x = Math.PI / 2;
    outerRim.position.y = -0.58;
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
    this.groundGroup.add(groundDisc);

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

    // 2) 中央流线型暗黑钛金属未来主机核 (Sleek Dark Metallic Futuristic Core)
    this.v03CoreTurbineGroup.position.set(0, 0.35, 0);

    // 核心主柱：分段式哑光黑与拉丝钛金属精密圆柱塔 (无任何抽象多面体)
    const coreLowerCylinder = new THREE.Mesh(
      new THREE.CylinderGeometry(1.38, 1.56, 1.15, 48),
      matteBlackMetal
    );
    coreLowerCylinder.position.y = 0.58;

    const coreMidChamber = new THREE.Mesh(
      new THREE.CylinderGeometry(1.18, 1.18, 1.35, 48),
      carbonFiber
    );
    coreMidChamber.position.y = 1.75;

    const coreUpperCap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.92, 1.32, 0.72, 48),
      brushedTitanium
    );
    coreUpperCap.position.y = 2.72;

    const coreTopCrown = new THREE.Mesh(
      new THREE.CylinderGeometry(0.58, 0.85, 0.24, 36),
      matteBlackMetal
    );
    coreTopCrown.position.y = 3.18;

    this.v03CoreTurbineGroup.add(
      coreLowerCylinder,
      coreMidChamber,
      coreUpperCap,
      coreTopCrown
    );

    // 主核外围 14 层精密拉丝钛金属水平散热鳍片环 (Industrial Metal Cooling Fins)
    const finGeo = new THREE.CylinderGeometry(1.42, 1.42, 0.028, 48);
    const finInst = new THREE.InstancedMesh(finGeo, brushedTitanium, 14);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 14; i++) {
      dummy.position.set(0, 0.45 + i * 0.16, 0);
      const s = 1.0 - Math.abs(i - 6.5) * 0.022;
      dummy.scale.set(s, 1, s);
      dummy.updateMatrix();
      finInst.setMatrixAt(i, dummy.matrix);
    }
    finInst.instanceMatrix.needsUpdate = true;
    this.v03CoreTurbineGroup.add(finInst);

    // 8 根环绕核心的垂直暗钛导轨与稀疏微光蓝青数据灯带
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const rib = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 2.55, 0.22),
        brushedTitanium
      );
      rib.position.set(Math.sin(a) * 1.36, 1.62, Math.cos(a) * 1.36);
      rib.rotation.y = a;

      const dataStrip = new THREE.Mesh(
        new THREE.BoxGeometry(0.026, 2.15, 0.04),
        i % 2 === 0 ? cyanStripMat : blueStripMat
      );
      dataStrip.position.set(0, 0, 0.115);
      rib.add(dataStrip);
      this.v03CoreTurbineGroup.add(rib);
    }

    // 外部精密双环暗金属稳定环 (Sleek Dark Metal Gimbal Rings)
    this.v03CoreGimbalA.position.set(0, 1.75, 0);
    const gimbalMeshA = new THREE.Mesh(
      new THREE.TorusGeometry(1.92, 0.048, 12, 72),
      brushedTitanium
    );
    gimbalMeshA.rotation.x = Math.PI / 2;
    const gimbalCyanA = new THREE.Mesh(
      new THREE.TorusGeometry(1.86, 0.015, 8, 72),
      cyanStripMat
    );
    gimbalCyanA.rotation.x = Math.PI / 2;
    this.v03CoreGimbalA.add(gimbalMeshA, gimbalCyanA);

    this.v03CoreGimbalB.position.set(0, 2.15, 0);
    const gimbalMeshB = new THREE.Mesh(
      new THREE.TorusGeometry(1.68, 0.038, 12, 72),
      matteBlackMetal
    );
    gimbalMeshB.rotation.x = Math.PI * 0.44;
    this.v03CoreGimbalB.add(gimbalMeshB);

    this.v03CoreGroup.add(
      this.v03CoreTurbineGroup,
      this.v03CoreGimbalA,
      this.v03CoreGimbalB
    );

    // 3) 优雅发光青色数据管道网络 (Elegant Glowing Cyan Data Pipelines connecting Core & 7 Platforms)
    zonesData.forEach((z, idx) => {
      const targetPos = new THREE.Vector3(z.position[0], 0.0, z.position[2]);
      const dir = targetPos.clone().setY(0).normalize();
      const startPt = dir.clone().multiplyScalar(4.15).setY(-0.08);
      const endPt = targetPos.clone().addScaledVector(dir, -4.45).setY(0.04);
      const midPt = startPt.clone().lerp(endPt, 0.5);
      midPt.y = 0.22;

      // 中央暗黑金属护套管 + 两侧流光青色光纤管道
      const ortho = new THREE.Vector3(-dir.z, 0, dir.x);
      [-0.16, 0.16].forEach((offset, pIdx) => {
        const pStart = startPt.clone().addScaledVector(ortho, offset);
        const pMid = midPt.clone().addScaledVector(ortho, offset);
        const pEnd = endPt.clone().addScaledVector(ortho, offset);
        const curve = new THREE.QuadraticBezierCurve3(pStart, pMid, pEnd);
        // Hair-thin cyan and blue laser lines (radius = 0.022)
        const tubeGeo = new THREE.TubeGeometry(curve, 44, 0.022, 8, false);
        const pipeMat = new THREE.ShaderMaterial({
          uniforms: {
            uTime: this.sharedUniforms.uTime,
            uColor: { value: new THREE.Color(pIdx === 0 ? 0x00d4ff : 0x0284c7) },
            uDir: { value: pIdx === 0 ? 1.0 : -1.0 },
          },
          vertexShader: accessPipeVertexShader,
          fragmentShader: accessPipeFragmentShader,
          transparent: true,
          depthWrite: false,
        });
        this.v03PipesGroup.add(new THREE.Mesh(tubeGeo, pipeMat));
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

      // 衔接相邻六边形平台的发丝级发光青蓝激光环线 (Hair-thin cyan/blue laser ring lines)
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
      const ringGeo = new THREE.TubeGeometry(ringCurve, 32, 0.018, 6, false);
      const ringMat = new THREE.ShaderMaterial({
        uniforms: {
          uTime: this.sharedUniforms.uTime,
          uColor: { value: new THREE.Color(0x0284c7) },
          uDir: { value: 1.0 },
        },
        vertexShader: accessPipeVertexShader,
        fragmentShader: accessPipeFragmentShader,
        transparent: true,
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
      color: 0x0a0e16,
      metalness: 0.78,
      roughness: 0.48,
    });
    this.rimSilverMat = new THREE.MeshStandardMaterial({
      color: 0x1c2533,
      metalness: 0.9,
      roughness: 0.26,
    });

    zonesData.forEach((zCfg, zIdx) => {
      const root = new THREE.Group();
      root.position.set(zCfg.position[0], zCfg.position[1], zCfg.position[2]);

      const platformGroup = new THREE.Group();
      root.add(platformGroup);

      const baseHeight = 0.56;
      const baseYOffset = 0;

      // 1) 上层外圈重型装甲边框 + 主六棱甲板 + 下层倒锥形推进底壳 + 6 组顶点防撞墩
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
      }

      // v0.2 专属：还原设计图中六边形浮空岛侧面的发光霓虹灯槽与顶面高亮霓虹圈
      const v02ArmorGroup = new THREE.Group();
      const v02NeonMat = new THREE.MeshBasicMaterial({
        color: zCfg.v02Color,
      });

      const topNeonRim = new THREE.Mesh(
        new THREE.RingGeometry(4.28, 4.48, 6),
        new THREE.MeshBasicMaterial({
          color: zCfg.v02Color,
          side: THREE.DoubleSide,
        })
      );
      topNeonRim.rotation.x = -Math.PI / 2;
      topNeonRim.rotation.z = Math.PI / 6;
      topNeonRim.position.y = 0.025;
      v02ArmorGroup.add(topNeonRim);

      for (let s = 0; s < 6; s++) {
        const sa = (s / 6) * Math.PI * 2;
        const dist = 4.62 * Math.cos(Math.PI / 6) + 0.02;
        const sideSlot = new THREE.Mesh(
          new THREE.BoxGeometry(2.35, 0.1, 0.06),
          v02NeonMat
        );
        sideSlot.position.set(Math.sin(sa) * dist, -0.26, Math.cos(sa) * dist);
        sideSlot.rotation.y = sa;
        v02ArmorGroup.add(sideSlot);
      }
      platformGroup.add(v02ArmorGroup);

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

      // 5) v0.1 分区中央差异化立体地标装饰
      const v01DecorGroup = new THREE.Group();
      platformGroup.add(v01DecorGroup);
      const updateCustomDecor = this.buildZoneUniqueDecoration(
        zCfg,
        v01DecorGroup,
        baseYOffset
      );

      // 5b) v0.3 / v0.4 专属：7 大分区差异化核心工业设备总成 + 地面微光刻度环
      const v03CenterHardwareGroup = this.buildV03PlatformCenterHardware(
        zCfg,
        baseYOffset,
        false
      );
      const v04CenterHardwareGroup = this.buildV03PlatformCenterHardware(
        zCfg,
        baseYOffset,
        true
      );
      platformGroup.add(v03CenterHardwareGroup, v04CenterHardwareGroup);

      const { mesh: v03FloorProjMesh, redraw: v03FloorProjRedraw } =
        createV03FloorProjectionMesh(this.maxAnisotropy);
      platformGroup.add(v03FloorProjMesh);

      // 6) v0.1 全息遥测牌 / v0.2 设计图横幅牌 / v0.3 & v0.4 极简暗底切角青光中文全息分区标牌
      const telemetrySprite = createZoneTelemetrySprite(zCfg, this.maxAnisotropy);
      const v02PlaqueSprite = createV02ZonePlaqueSprite(zCfg, this.maxAnisotropy);
      const v03LabelSprite = createV03ZoneLabelSprite(zCfg, this.maxAnisotropy);
      platformGroup.add(telemetrySprite, v02PlaqueSprite, v03LabelSprite);

      // 7) v0.1 接入总线管道 Access Pipe
      const dirToCenter = new THREE.Vector3(-zCfg.position[0], 0, -zCfg.position[2]).normalize();
      const innerEdgeWorld = new THREE.Vector3(
        zCfg.position[0] + dirToCenter.x * 4.35,
        0.15,
        zCfg.position[2] + dirToCenter.z * 4.35
      );
      const busPoint = new THREE.Vector3(
        Math.sin(zCfg.theta) * 8.6,
        0.28,
        Math.cos(zCfg.theta) * 8.6
      );
      const midPoint = innerEdgeWorld.clone().lerp(busPoint, 0.5);
      midPoint.y += 1.1;

      const pipeCurve = new THREE.QuadraticBezierCurve3(innerEdgeWorld, midPoint, busPoint);
      const pipeGeo = new THREE.TubeGeometry(pipeCurve, 36, 0.08, 8, false);
      const pipeMat = new THREE.ShaderMaterial({
        uniforms: {
          uTime: this.sharedUniforms.uTime,
          uColor: { value: new THREE.Color(zCfg.color) },
          uDir: { value: 1.0 },
        },
        vertexShader: accessPipeVertexShader,
        fragmentShader: accessPipeFragmentShader,
        transparent: true,
        depthWrite: false,
      });
      this.v01PipesGroup.add(new THREE.Mesh(pipeGeo, pipeMat));

      // 8) 5 台高精度算力设备（支持 v0.1 / v0.2 / v0.3 / v0.4 七大分区专属差异化硬件设备集群）
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

        const labelHeights = [2.36, 2.58, 2.80, 2.58, 2.36];
        (node.userData as ChallengeNodeUserData).label.position.y = labelHeights[idx % 5];

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
      color: 0x2c3b50,
      metalness: 0.96,
      roughness: 0.08,
      envMapIntensity: 2.65,
    });
    const brushedGunmetal = new THREE.MeshStandardMaterial({
      color: 0x566b86,
      metalness: 0.94,
      roughness: 0.15,
      envMapIntensity: 2.25,
    });
    const charcoalAlloy = new THREE.MeshStandardMaterial({
      color: 0x344357,
      metalness: 0.78,
      roughness: 0.28,
      envMapIntensity: 1.85,
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

    const v03OuterPlasmaMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: this.sharedUniforms.uTime,
        uCoreWeight: { value: 0.0 },
      },
      vertexShader: plasmaBeamVertexShader,
      fragmentShader: plasmaBeamFragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const v03InnerPlasmaMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: this.sharedUniforms.uTime,
        uCoreWeight: { value: 1.0 },
      },
      vertexShader: plasmaBeamVertexShader,
      fragmentShader: plasmaBeamFragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });

    const v03OuterBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.17, 1.35, 28, 12, true),
      v03OuterPlasmaMat
    );
    v03OuterBeam.position.y = 0.68;

    const v03InnerBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.075, 1.42, 20, 12, true),
      v03InnerPlasmaMat
    );
    v03InnerBeam.position.y = 0.70;

    const v03HoloShellMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: this.sharedUniforms.uTime,
      },
      vertexShader: holoShellVertexShader,
      fragmentShader: holoShellFragmentShader,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const v03ShellGeo = new THREE.CylinderGeometry(0.46, 0.56, 1.16, 8, 1, true);
    const v03HoloShell = new THREE.Mesh(v03ShellGeo, v03HoloShellMat);
    v03HoloShell.position.y = 0.58;
    v03HoloShell.add(
      new THREE.LineSegments(
        new THREE.EdgesGeometry(v03ShellGeo),
        new THREE.LineBasicMaterial({
          color: 0x00d4ff,
          transparent: true,
          opacity: 0.34,
        })
      )
    );

    this.v03OrangeRedCore.add(v03EmitterBase, v03OuterBeam, v03InnerBeam, v03HoloShell);
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
      color: 0x2c3c52,
      metalness: 0.97,
      roughness: 0.07,
      envMapIntensity: 2.85,
    });
    const gunmetalBrushed = new THREE.MeshStandardMaterial({
      color: 0x566c88,
      map: brushedTex,
      bumpMap: brushedTex,
      bumpScale: 0.011,
      metalness: 0.94,
      roughness: 0.14,
      envMapIntensity: 2.55,
    });
    const slateSilverMat = new THREE.MeshStandardMaterial({
      color: 0x8ea6c4,
      map: brushedTex,
      bumpMap: brushedTex,
      bumpScale: 0.009,
      metalness: 0.96,
      roughness: 0.11,
      envMapIntensity: 2.75,
    });
    const charcoalCarbon = new THREE.MeshStandardMaterial({
      color: 0x35455a,
      map: carbonTex,
      bumpMap: carbonTex,
      bumpScale: 0.014,
      metalness: 0.84,
      roughness: 0.22,
      envMapIntensity: 2.15,
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

    // 6) 中央绝对核心：高强度受控橙红高能等离子光束核心 + 半透明全息约束罩 (Concentrated Energy Beam + Translucent Holographic Containment Shell, NOT a solid sphere)
    this.v05OrangeRedCore = new THREE.Group();
    this.v05OrangeRedCore.position.set(0, 0.56, 0);

    const emitterNozzle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.38, 0.54, 0.22, 8),
      darkChromeMat
    );
    emitterNozzle.rotation.y = octAngleOffset;
    emitterNozzle.position.y = 0.06;

    const emitterLens = new THREE.Mesh(
      new THREE.RingGeometry(0.14, 0.34, 8),
      new THREE.MeshBasicMaterial({
        color: 0xff451a,
        transparent: true,
        opacity: 0.92,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    emitterLens.rotation.x = -Math.PI / 2;
    emitterLens.rotation.z = octAngleOffset;
    emitterLens.position.y = 0.18;

    const outerPlasmaMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: this.sharedUniforms.uTime,
        uCoreWeight: { value: 0.0 },
      },
      vertexShader: plasmaBeamVertexShader,
      fragmentShader: plasmaBeamFragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const innerPlasmaMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: this.sharedUniforms.uTime,
        uCoreWeight: { value: 1.0 },
      },
      vertexShader: plasmaBeamVertexShader,
      fragmentShader: plasmaBeamFragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });

    const plasmaOuterBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.26, 1.98, 32, 16, true),
      outerPlasmaMat
    );
    plasmaOuterBeam.position.y = 1.08;

    const plasmaInnerBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.068, 0.11, 2.12, 24, 16, true),
      innerPlasmaMat
    );
    plasmaInnerBeam.position.y = 1.12;

    const focalCollarRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.32, 0.016, 8, 32),
      new THREE.MeshBasicMaterial({
        color: 0xff4d1f,
        transparent: true,
        opacity: 0.85,
      })
    );
    focalCollarRing.rotation.x = Math.PI / 2;
    focalCollarRing.position.y = 0.82;

    // 环绕等离子光束核心的半透明八角全息约束罩 (Translucent Holographic Containment Shell)
    const holoShellMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: this.sharedUniforms.uTime,
      },
      vertexShader: holoShellVertexShader,
      fragmentShader: holoShellFragmentShader,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const holoDomeGeo = new THREE.IcosahedronGeometry(0.84, 1);
    const holoContainmentShell = new THREE.Mesh(holoDomeGeo, holoShellMat);
    holoContainmentShell.position.y = 0.92;
    holoContainmentShell.scale.set(1.0, 1.18, 1.0);
    holoContainmentShell.add(
      new THREE.LineSegments(
        new THREE.EdgesGeometry(holoDomeGeo),
        new THREE.LineBasicMaterial({
          color: 0x00d4ff,
          transparent: true,
          opacity: 0.30,
        })
      )
    );

    this.v05OrangeRedCore.add(
      emitterNozzle,
      emitterLens,
      plasmaOuterBeam,
      plasmaInnerBeam,
      focalCollarRing,
      holoContainmentShell
    );
    this.v05CenterAttackGroup.add(this.v05OrangeRedCore);

    // 双层暗黑镀铬聚焦稳定环（八角环 + 圆环）
    this.v05ConsoleGimbalA.position.set(0, 1.38, 0);
    const gimbalOctMesh = new THREE.Mesh(
      new THREE.TorusGeometry(0.76, 0.036, 12, 8),
      darkChromeMat
    );
    gimbalOctMesh.rotation.x = Math.PI * 0.42;
    const gimbalOctRedEdge = new THREE.Mesh(
      new THREE.TorusGeometry(0.71, 0.012, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xff3b18 })
    );
    gimbalOctRedEdge.rotation.x = Math.PI * 0.42;
    this.v05ConsoleGimbalA.add(gimbalOctMesh, gimbalOctRedEdge);

    this.v05ConsoleGimbalB.position.set(0, 1.38, 0);
    const gimbalOuterMesh = new THREE.Mesh(
      new THREE.TorusGeometry(0.98, 0.028, 12, 64),
      slateSilverMat
    );
    gimbalOuterMesh.rotation.x = -Math.PI * 0.38;
    gimbalOuterMesh.rotation.y = Math.PI * 0.25;
    this.v05ConsoleGimbalB.add(gimbalOuterMesh);

    this.v05CenterAttackGroup.add(this.v05ConsoleGimbalA, this.v05ConsoleGimbalB);
  }

  /**
   * 切换沙盘版本：
   * - '0.1': 经典工业版 (35台独立精工机柜 + 环形脉冲总线)
   * - '0.2': 全息星际版 · 设计图还原 (巨型二十面体蓝晶核 + 全息玻璃穹顶 + 7大微缩景观)
   * - '0.3': 暗黑钛金版 · 物理微距风 (85mm f/2.8 浅景深 + 枪铁灰/暗银拉丝/碳纤维写实机柜 + 前景单点橙红核激光台)
   * - '0.4': 未来沙盘版 · 战术沙盘风 (抛光纯银/磨砂白陶瓷/透明亚克力玻璃 + 中央半透明玻璃核心 + 7座磨砂玻璃浮空平台 + 深空午夜蓝星云与银面焦散)
   * - '0.5': 中央突击版 · 中心八角暗黑镀铬强袭台 (中央八角形暗黑镀铬攻击台取代中央枢纽，高强橙红核向外周七大平台放射红色激光束)
   */
  public setVersion(version: SandboxVersion, immediateCamera = false) {
    this.currentVersion = version;
    const isV01 = version === '0.1';
    const isV02 = version === '0.2';
    const isV03 = version === '0.3';
    const isV04 = version === '0.4';
    const isV05 = version === '0.5';
    const isV03Style = isV03 || isV05;
    const isV03OrV04OrV05 = isV03Style || isV04;

    this.sharedUniforms.uDarkMode.value = isV03Style ? 1.0 : 0.0;
    this.sharedUniforms.uFuturisticMode.value = isV04 ? 1.0 : 0.0;

    // 1) 全版本统一的高端午夜蓝体积雾氛围、镜面玻璃地面、强冷青边缘逆光与受控柔润辉光
    this.scene.background = new THREE.Color(isV04 ? 0x061024 : 0x050e20);
    this.scene.fog = new THREE.FogExp2(
      isV04 ? 0x07152e : 0x061226,
      this.currentCameraMode === 'panorama' ? 0.0022 : 0.0052
    );
    this.scene.environmentIntensity = isV04 ? 1.52 : 1.44;
    this.renderer.toneMappingExposure = 1.06;
    this.camera.fov = isV03OrV04OrV05 ? 24 : 40;
    this.camera.updateProjectionMatrix();

    if (this.bloomPass) {
      // Subtle, controlled moist bloom on cyan borders, plasma core, and lasers — ZERO glare/giant halos
      this.bloomPass.strength = 0.24;
      this.bloomPass.radius = 0.28;
      this.bloomPass.threshold = 0.84;
    }
    if (this.vignettePass) {
      // Crystal-clear 8K sharp focus across all versions
      this.vignettePass.uniforms.uMacroDof.value = 0.0;
    }

    // Soft diffused ambient lighting + dual strong cool-cyan rim lighting on ALL versions
    this.ambientLight.color.setHex(isV04 ? 0x3b68a8 : 0x34578a);
    this.ambientLight.intensity = isV04 ? 1.42 : 1.36;
    this.hemiLight.color.setHex(0x88bef8);
    this.hemiLight.groundColor.setHex(0x0b1c38);
    this.hemiLight.intensity = 1.48;
    this.keyLight.color.setHex(0xdbeafe);
    this.keyLight.intensity = isV04 ? 1.65 : 1.38;
    this.rimLight.color.setHex(0x38bdf8);
    this.rimLight.intensity = 2.35;
    this.backRightRimLight.color.setHex(0x00e5ff);
    this.backRightRimLight.intensity = 2.05;
    this.backRightRimLight.visible = true;
    this.fillLight.color.setHex(0x6492ca);
    this.fillLight.intensity = 1.18;

    if (isV05) {
      this.consoleRedLight.position.set(0, 1.9, 0);
      this.consoleRedLight.intensity = 1.45;
      this.consoleRedLight.distance = 10.5;
      this.consoleRedLight.visible = true;
    } else if (isV03 || isV04) {
      this.consoleRedLight.position.set(0, 1.4, 18.8);
      this.consoleRedLight.intensity = 1.3;
      this.consoleRedLight.distance = 9.0;
      this.consoleRedLight.visible = true;
    } else {
      this.consoleRedLight.visible = false;
    }

    if (isV04) {
      // Seven floating hexagonal platforms made of frosted glass & polished silver trim
      this.hullDarkMat.color.setHex(0x8ec5fc);
      this.hullDarkMat.metalness = 0.24;
      this.hullDarkMat.roughness = 0.14;
      this.hullDarkMat.transparent = true;
      this.hullDarkMat.opacity = 0.56;
      this.hullDarkMat.needsUpdate = true;

      this.rimSilverMat.color.setHex(0xcbd5e1);
      this.rimSilverMat.metalness = 0.90;
      this.rimSilverMat.roughness = 0.16;
      this.backingMat.color.setHex(0x040d21);
      this.outerRimMat.color.setHex(0x7a96ba);
      this.starField.visible = true;
    } else {
      // Seven hexagonal platforms made of dark grey matte alloy with beveled slate silver edges
      this.hullDarkMat.color.setHex(0x283649);
      this.hullDarkMat.metalness = 0.64;
      this.hullDarkMat.roughness = 0.42;
      this.hullDarkMat.transparent = false;
      this.hullDarkMat.opacity = 1.0;
      this.hullDarkMat.needsUpdate = true;

      this.rimSilverMat.color.setHex(0x6680a0);
      this.rimSilverMat.metalness = 0.90;
      this.rimSilverMat.roughness = 0.18;
      this.backingMat.color.setHex(0x020714);
      this.outerRimMat.color.setHex(0x3a5478);
      this.starField.visible = isV01 || isV02;
    }

    // Highly polished dark mirror glass floor active across ALL versions
    if (this.mirrorReflector) {
      this.mirrorReflector.visible = !this.useSoftwarePacing;
    }

    if (isV03OrV04OrV05) {
      for (let i = this.floatTexts.length - 1; i >= 0; i--) {
        const ft = this.floatTexts[i];
        this.fxGroup.remove(ft.sprite);
        const mat = ft.sprite.material as THREE.SpriteMaterial;
        mat.map?.dispose();
        mat.dispose();
      }
      this.floatTexts = [];
    }

    // 2) 核心组、光纤管道组与攻击指挥台显隐切换
    this.v01CoreGroup.visible = isV01;
    this.v02CoreGroup.visible = isV02;
    this.v03CoreGroup.visible = isV03;
    this.v04CoreGroup.visible = isV04;
    this.v05CenterAttackGroup.visible = isV05;
    this.busRingMesh.visible = !isV03OrV04OrV05;

    this.v01PipesGroup.visible = isV01;
    this.v02EnvGroup.visible = isV02;
    this.v03PipesGroup.visible = isV03OrV04OrV05;

    this.v012AttackBaseGroup.visible = !isV03OrV04OrV05;
    this.v01AttackTurretGroup.visible = isV01;
    this.v02AttackDomeGroup.visible = isV02;
    this.v03AttackConsoleGroup.visible = isV03 || isV04;

    // 3) 七大六边形平台外观、全息中文标牌、地面投影与点光源同步切换
    let zIdx = 0;
    this.zones.forEach((zone) => {
      const zCfg = zone.config;
      const pos = isV02 ? zCfg.v02Position : zCfg.position;
      zone.root.position.set(pos[0], pos[1], pos[2]);

      const pl = this.zonePointLights[zIdx++];
      if (pl) {
        pl.position.set(pos[0], 3.2 + pos[1], pos[2]);
        if (isV04) {
          pl.color.setHex(0x38bdf8);
          pl.intensity = 0.45;
        } else if (isV03Style) {
          pl.color.setHex(0x38bdf8);
          pl.intensity = 0.26;
        } else {
          pl.color.setHex(isV02 ? zCfg.v02Color : zCfg.color);
          pl.intensity = 0.48;
        }
      }

      const dirToCenter = new THREE.Vector3(-pos[0], 0, -pos[2]).normalize();
      zone.innerEdgePoint.set(
        pos[0] + dirToCenter.x * 4.35,
        0.15 + pos[1],
        pos[2] + dirToCenter.z * 4.35
      );

      zone.v01DecorGroup.visible = isV01;
      zone.v02ArmorGroup.visible = isV02;
      zone.v03CenterHardwareGroup.visible = isV03Style;
      zone.v04CenterHardwareGroup.visible = isV04;
      zone.v03FloorProjMesh.visible = isV03OrV04OrV05;
      zone.telemetrySprite.visible = isV01;
      zone.v02PlaqueSprite.visible = isV02;
      zone.v03LabelSprite.visible = isV03OrV04OrV05;

      if (isV04) {
        // Frosted glass hexagonal platform rim & soft cyan-blue caustic underglow
        zone.edgeNeonMat.color.setHex(0x7dd3fc);
        zone.edgeNeonMat.opacity = 0.72;
        zone.topShaderMat.uniforms.uColor.value.setHex(0x38bdf8);
        zone.underBeamMat.color.setHex(0x0ea5e9);
        zone.underBeamMat.opacity = 0.055;
      } else if (isV03Style) {
        // Extremely thin, elegant glowing cyan outlines on the 7 dark matte alloy hexagonal platforms
        zone.edgeNeonMat.color.setHex(0x00c8f0);
        zone.edgeNeonMat.opacity = 0.68;
        zone.topShaderMat.uniforms.uColor.value.setHex(0x00c8f0);
        zone.underBeamMat.color.setHex(0x0284c7);
        zone.underBeamMat.opacity = 0.0;
      } else {
        const themeCol = isV02 ? zCfg.v02Color : zCfg.color;
        zone.edgeNeonMat.color.setHex(themeCol);
        zone.edgeNeonMat.opacity = 0.85;
        zone.topShaderMat.uniforms.uColor.value.setHex(themeCol);
        zone.underBeamMat.color.setHex(themeCol);
        zone.underBeamMat.opacity = isV02 ? 0.095 : 0.045;
      }

      zone.nodes.forEach((node) => {
        (node.userData as ChallengeNodeUserData).setVersion(version);
      });

      this.refreshZoneTelemetry(zone, false);
    });

    // 4) 重建当前活跃激光束轨迹，确保在 v0.3 / v0.4 / v0.5 下展示数道锐利红激光
    const snapshot = this.activeBeams.map((b) => ({
      challengeId: b.challengeId,
      teamName: b.teamName,
    }));
    for (let i = this.activeBeams.length - 1; i >= 0; i--) {
      this.disposeBeam(this.activeBeams[i]);
    }
    this.activeBeams = [];

    const minBeams = isV05 ? 4 : 3;
    if (isV03OrV04OrV05 && snapshot.length < minBeams) {
      const defaultTargets = isV05
        ? ['AI-02', 'INF-02', 'KDB-03', 'OPS-02']
        : ['AI-02', 'OPS-02', 'CMP-02'];
      defaultTargets.forEach((cid) => {
        if (!snapshot.some((s) => s.challengeId === cid)) {
          snapshot.push({ challengeId: cid, teamName: '网络护卫队' });
        }
      });
    }

    snapshot.forEach((item) => {
      const found = this.findChallengeAndZone(item.challengeId);
      if (found) {
        if (isV03OrV04OrV05 && found.challenge.state === 'idle') {
          found.challenge.state = 'attacking';
          found.challenge.activeAttacker = item.teamName;
          (found.node.userData as ChallengeNodeUserData).transitionState('attacking', {
            team: item.teamName,
          });
        }
        const curve = this.buildAttackPath(found.node, found.zone);
        this.spawnBeamInternal({
          challenge: found.challenge,
          zone: found.zone,
          node: found.node,
          teamName: item.teamName,
          curve,
          instantArrive: true,
        });
      }
    });

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

  private seedInitialActiveBeams(zonesData: ZoneConfig[]) {
    if (this.activeBeams.length > 0) {
      this.refreshAttackTelemetry();
      return;
    }
    zonesData.forEach((z) => {
      z.challenges.forEach((ch) => {
        if (ch.state === 'attacking') {
          const zRuntime = this.zones.get(z.id);
          const node = zRuntime?.nodes.get(ch.id);
          if (zRuntime && node) {
            const curve = this.buildAttackPath(node, zRuntime);
            this.spawnBeamInternal({
              challenge: ch,
              zone: zRuntime,
              node,
              teamName: ch.activeAttacker || '网络护卫队',
              curve,
              instantArrive: true,
            });
          }
        }
      });
    });
    this.refreshAttackTelemetry();
  }

  private buildAttackPath(targetDevice: THREE.Group, zone: ZoneRuntime): THREE.Curve<THREE.Vector3> {
    const isV02 = this.currentVersion === '0.2';
    const isV05 = this.currentVersion === '0.5';
    const isV03OrV04 = this.currentVersion === '0.3' || this.currentVersion === '0.4';

    const worldTarget = new THREE.Vector3();
    targetDevice.getWorldPosition(worldTarget);
    worldTarget.y += 1.35;

    if (isV05) {
      // v0.5：从绝对中心八角暗黑镀铬攻击台的橙红高能等离子束核心 (0, 1.48, 0) 向外周七大平台放射纤细锐利的红色激光束
      const centerRedCoreOrigin = new THREE.Vector3(0, 1.48, 0);
      const mid = centerRedCoreOrigin.clone().lerp(worldTarget, 0.5);
      mid.y += 1.65;
      return new THREE.QuadraticBezierCurve3(centerRedCoreOrigin, mid, worldTarget);
    }

    if (isV03OrV04) {
      // v0.3 / v0.4：从近景深色铬金属攻击台唯一的炽烈橙红发光核心 (0, 1.01, 18.8) 发射纤细锐利的微弧红色激光束直达目标设备
      const redCoreOrigin = new THREE.Vector3(0, 1.01, 18.8);
      const mid = redCoreOrigin.clone().lerp(worldTarget, 0.5);
      mid.y += 1.65;
      return new THREE.QuadraticBezierCurve3(redCoreOrigin, mid, worldTarget);
    }

    const muzzle = isV02
      ? new THREE.Vector3(0, 2.1, 18.2)
      : new THREE.Vector3(0, 1.8, 19.2);

    if (isV02 || this.activeBeams.length >= 12) {
      const mid = muzzle.clone().lerp(worldTarget, 0.5);
      mid.y += 4.2;
      return new THREE.QuadraticBezierCurve3(muzzle, mid, worldTarget);
    }

    const points: THREE.Vector3[] = [];
    points.push(muzzle);

    const BUS_R = 8.6;
    const BUS_Y = 0.5;
    points.push(new THREE.Vector3(0, BUS_Y + 0.4, BUS_R));

    let targetTheta = zone.config.theta;
    if (targetTheta > Math.PI) {
      targetTheta -= Math.PI * 2;
    }
    const STEPS = 5;
    for (let i = 1; i <= STEPS; i++) {
      const frac = i / STEPS;
      const th = targetTheta * frac;
      points.push(
        new THREE.Vector3(
          Math.sin(th) * BUS_R,
          BUS_Y + 0.4 + Math.sin(frac * Math.PI) * 0.35,
          Math.cos(th) * BUS_R
        )
      );
    }

    points.push(zone.innerEdgePoint.clone().setY(1.15));
    points.push(worldTarget);

    return new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.32);
  }

  private spawnBeamInternal(opts: {
    challenge: Challenge;
    zone: ZoneRuntime;
    node: THREE.Group;
    teamName: string;
    curve: THREE.Curve<THREE.Vector3>;
    instantArrive?: boolean;
    onArrive?: () => void;
  }) {
    const existingIdx = this.activeBeams.findIndex((b) => b.challengeId === opts.challenge.id);
    if (existingIdx !== -1) {
      this.disposeBeam(this.activeBeams[existingIdx]);
      this.activeBeams.splice(existingIdx, 1);
    }

    const isV03OrV04 =
      this.currentVersion === '0.3' ||
      this.currentVersion === '0.4' ||
      this.currentVersion === '0.5';
    // v0.3 / v0.4 / v0.5 采用极纤细、高锐度的红色激光束 (Thin, sharp red laser beams, radius = 0.018, color = 0xff2614)
    const beamRadius = isV03OrV04 ? 0.018 : 0.045;
    const beamColorHex = isV03OrV04 ? 0xff2614 : STATE_COLOR.attacking;

    const tubeGeo = new THREE.TubeGeometry(opts.curve, 96, beamRadius, 6, false);
    const beamMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: this.sharedUniforms.uTime,
        uProgress: { value: opts.instantArrive ? 1.0 : 0.0 },
        uIntensity: { value: isV03OrV04 ? 1.38 : 0.9 },
        uOpacity: { value: opts.instantArrive ? (isV03OrV04 ? 0.88 : 0.52) : 0.95 },
        uColor: { value: new THREE.Color(beamColorHex) },
      },
      vertexShader: attackBeamVertexShader,
      fragmentShader: attackBeamFragmentShader,
      transparent: true,
      depthWrite: false,
    });
    const tubeMesh = new THREE.Mesh(tubeGeo, beamMat);
    this.fxGroup.add(tubeMesh);

    const probeMesh = new THREE.Mesh(
      new THREE.SphereGeometry(isV03OrV04 ? 0.09 : 0.16, 12, 12),
      new THREE.MeshBasicMaterial({ color: isV03OrV04 ? 0xff4d38 : 0xfef08a })
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
        opacity: 0.75,
      })
    );
    trailLine.visible = !opts.instantArrive;
    this.fxGroup.add(trailLine);

    let solvingCard: THREE.Mesh | undefined;
    // v0.3 / v0.4 禁止额外大号解题悬浮窗，保持画面纯净
    if (opts.instantArrive && !isV03OrV04) {
      solvingCard = createSolvingCardMesh(opts.challenge, opts.teamName);
      const worldPos = new THREE.Vector3();
      opts.node.getWorldPosition(worldPos);
      solvingCard.position.set(worldPos.x, worldPos.y + 3.45, worldPos.z);
      this.fxGroup.add(solvingCard);
    }

    const runtime: ActiveBeamRuntime = {
      id: `${opts.challenge.id}-${Date.now()}`,
      challengeId: opts.challenge.id,
      zoneId: opts.zone.config.id,
      teamName: opts.teamName,
      curve: opts.curve,
      tubeMesh,
      beamMat,
      probeMesh,
      trailLine,
      trailPositions,
      solvingCard,
      progress: opts.instantArrive ? 1.0 : 0.0,
      duration: 0.82,
      arrived: Boolean(opts.instantArrive),
      retiring: false,
      retireTimer: 0,
      targetColor: new THREE.Color(beamColorHex),
      targetScaleXZ: 1.0,
      onArriveCallback: opts.onArrive,
    };

    this.activeBeams.push(runtime);
    return runtime;
  }

  private disposeBeam(beam: ActiveBeamRuntime) {
    this.fxGroup.remove(beam.tubeMesh, beam.probeMesh, beam.trailLine);
    beam.tubeMesh.geometry.dispose();
    beam.beamMat.dispose();
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

    const orb =
      this.playerOrbs.find((o) => o.team.name === teamName) ||
      this.playerOrbs[Math.floor(Math.random() * this.playerOrbs.length)];

    const launchBeamNow = () => {
      this.muzzleChargeTimer = 0.35;
      this.busRingMat.uniforms.uHighlight.value = 0.65;
      const curve = this.buildAttackPath(node, zone);

      this.spawnBeamInternal({
        challenge,
        zone,
        node,
        teamName,
        curve,
        onArrive: () => {
          const isV03Style =
            this.currentVersion === '0.3' || this.currentVersion === '0.5';
          this.spawnShockwave(
            node,
            isV03Style ? 0xff2a1f : STATE_COLOR.attacking,
            isV03Style ? 2.2 : 3.4,
            0.65,
            0
          );
          if (ud.state !== 'solved') {
            ud.transitionState('attacking', { team: teamName });
          }

          const beam = this.activeBeams.find((b) => b.challengeId === challengeId);
          if (beam && !beam.solvingCard && !isV03Style) {
            const card = createSolvingCardMesh(challenge, teamName);
            const wp = new THREE.Vector3();
            node.getWorldPosition(wp);
            card.position.set(wp.x, wp.y + 3.45, wp.z);
            card.scale.set(1, 0.02, 1);
            this.fxGroup.add(card);
            beam.solvingCard = card;
          }

          this.refreshZoneTelemetry(zone);
          this.refreshAttackTelemetry();
          this.onStatsSync?.();
        },
      });
      this.refreshAttackTelemetry();
    };

    if (this.currentVersion === '0.1' && orb && orb.state === 'orbit') {
      orb.state = 'toMuzzle';
      orb.timer = 0;
      orb.startPos.copy(orb.mesh.position);
      orb.onChargedCallback = launchBeamNow;
    } else {
      launchBeamNow();
    }
  }

  public triggerFailed(challengeId: string, teamName: string, userInitiated = false) {
    const found = this.findChallengeAndZone(challengeId);
    if (!found) return;
    const { challenge, zone, node } = found;
    const ud = node.userData as ChallengeNodeUserData;

    challenge.totalAttempts += 1;
    challenge.activeAttempts = Math.max(0, challenge.activeAttempts - 1);
    challenge.lastEventAt = Date.now();

    const activeZonePos =
      this.currentVersion === '0.2' ? zone.config.v02Position : zone.config.position;

    const executeImpactFail = (beam?: ActiveBeamRuntime) => {
      const isV03 = this.currentVersion === '0.3' || this.currentVersion === '0.5';
      soundFX.playFailed();
      this.spawnHexShieldDome(node);
      this.spawnParticleBurst(node, 'failed');
      this.spawnShockwave(
        node,
        isV03 ? 0x0284c7 : STATE_COLOR.failed,
        isV03 ? 3.2 : 4.8,
        0.72,
        0
      );

      if (!isV03) {
        const wp = new THREE.Vector3();
        node.getWorldPosition(wp);
        wp.y += 2.5;
        this.spawnFloatText(wp, 'ACCESS DENIED', STATE_COLOR_HEX.failed);
      }

      ud.flashFail(challenge.totalAttempts);
      if (ud.state === 'attacking' && challenge.activeAttempts === 0) {
        ud.transitionState('idle');
      }

      this.spawnGroundRipple(
        activeZonePos[0],
        activeZonePos[2],
        isV03 ? 0x0284c7 : STATE_COLOR.failed
      );

      if (userInitiated || this.focusedZoneId === zone.config.id) {
        this.shakeIntensity = 0.12;
        this.shakeTimer = 0.2;
      }

      if (beam) {
        beam.retiring = true;
        beam.retireTimer = 0.65;
      }

      this.refreshZoneTelemetry(zone);
      this.refreshAttackTelemetry();
      this.onStatsSync?.();
    };

    const existingBeam = this.activeBeams.find((b) => b.challengeId === challengeId);
    const failBeamColor =
      this.currentVersion === '0.3' || this.currentVersion === '0.5'
        ? 0xff2a1f
        : STATE_COLOR.failed;
    if (existingBeam) {
      existingBeam.targetColor.setHex(failBeamColor);
      existingBeam.beamMat.uniforms.uIntensity.value = 1.3;
      if (existingBeam.arrived) {
        executeImpactFail(existingBeam);
      } else {
        existingBeam.duration = 0.18;
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
      });
      b.targetColor.setHex(failBeamColor);
      b.duration = 0.35;
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

    if (this.attackFollowEnabled) {
      this.startAttackFollow(challenge, zone, node, teamName, isFirstBlood);
    }

    const activeZonePos =
      this.currentVersion === '0.2' ? zone.config.v02Position : zone.config.position;

    const executeImpactSolve = (beam: ActiveBeamRuntime) => {
      const isV03 = this.currentVersion === '0.3' || this.currentVersion === '0.5';
      soundFX.playSolved(isFirstBlood);
      this.spawnParticleBurst(node, 'solved');
      this.spawnShockwave(
        node,
        isV03 ? 0x00d4ff : STATE_COLOR.solved,
        isV03 ? 3.8 : 5.5,
        0.9,
        0.0
      );
      this.spawnShockwave(
        node,
        isV03 ? 0x0284c7 : STATE_COLOR.solved,
        isV03 ? 3.8 : 5.5,
        0.9,
        0.08
      );
      if (!isV03) {
        this.spawnShockwave(node, STATE_COLOR.firstBlood, 5.5, 0.9, 0.16);
      }

      ud.transitionState('solved', { team: teamName, firstBlood: isFirstBlood });

      if (!isV03) {
        const wp = new THREE.Vector3();
        node.getWorldPosition(wp);
        if (isFirstBlood) {
          const fbPos = wp.clone();
          fbPos.y += 3.0;
          this.spawnFloatText(fbPos, '★ FIRST BLOOD ★', STATE_COLOR_HEX.firstBlood);
        } else {
          const solvedPos = wp.clone();
          solvedPos.y += 2.7;
          this.spawnFloatText(solvedPos, '✓ SYSTEM PWNED', STATE_COLOR_HEX.solved);
        }
      }

      this.spawnDataReturn(beam.curve);

      const orb =
        this.playerOrbs.find((o) => o.team.name === teamName) || this.playerOrbs[0];
      if (orb) {
        orb.celebrateTimer = 2.0;
      }
      if (!isV03) {
        setTimeout(() => {
          if (this.disposed) return;
          this.spawnFloatText(
            new THREE.Vector3(0, 3.0, 19.2),
            `+${challenge.points}`,
            STATE_COLOR_HEX.solved
          );
        }, 650);
      }

      if (!isV03) {
        this.spawnCircularBusPulse(zone.config.theta);
      }

      zone.config.score = Math.min(zone.config.totalScore, zone.config.score + challenge.points);
      zone.targetScore = zone.config.score;
      zone.telemetryBounceTimer = 0.65;
      zone.edgeHighlightTimer = 1.5;
      this.spawnGroundRipple(
        activeZonePos[0],
        activeZonePos[2],
        isV03 ? 0x00d4ff : STATE_COLOR.solved
      );

      this.targetPullOrigin.copy(this.controls.target);
      this.targetPullGoal
        .copy(this.controls.target)
        .lerp(new THREE.Vector3(...activeZonePos), 0.15);
      this.targetPullTimer = 2.2;

      beam.retiring = true;
      beam.retireTimer = 1.6;

      this.refreshZoneTelemetry(zone, true);
      this.refreshAttackTelemetry();
      this.onStatsSync?.();
    };

    const existingBeam = this.activeBeams.find((b) => b.challengeId === challengeId);
    const isDarkStyle =
      this.currentVersion === '0.3' || this.currentVersion === '0.5';
    const solveBeamCol = isDarkStyle ? 0x00d4ff : STATE_COLOR.solved;
    if (existingBeam) {
      existingBeam.targetColor.setHex(solveBeamCol);
      existingBeam.targetScaleXZ = isDarkStyle ? 1.15 : 1.55;
      existingBeam.beamMat.uniforms.uIntensity.value = 1.4;
      if (existingBeam.arrived) {
        executeImpactSolve(existingBeam);
      } else {
        existingBeam.duration = 0.22;
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
      });
      b.targetColor.setHex(solveBeamCol);
      b.targetScaleXZ = isDarkStyle ? 1.15 : 1.55;
      b.beamMat.uniforms.uIntensity.value = 1.4;
      b.duration = 0.42;
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
    wp.y += 1.1;

    const geo = new THREE.CircleGeometry(1.75, 6);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: this.sharedUniforms.uTime,
        uOpacity: { value: 0.9 },
        uColor: { value: new THREE.Color(0x00d4ff) },
      },
      vertexShader: hexShieldVertexShader,
      fragmentShader: hexShieldFragmentShader,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(wp);
    mesh.lookAt(0, wp.y + 1.5, 20);
    mesh.scale.setScalar(0.3);
    this.fxGroup.add(mesh);

    this.shieldDomes.push({
      mesh,
      mat,
      elapsed: 0,
      duration: 1.3,
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

  private refreshZoneTelemetry(zone: ZoneRuntime, flashWhite = false) {
    const solvedCount = zone.config.challenges.filter((c) => c.state === 'solved').length;
    const threatsCount = zone.config.challenges.filter((c) => c.state === 'attacking').length;
    zone.config.threats = threatsCount;
    zone.telemetrySprite.userData.redraw(
      Math.round(zone.displayedScore),
      zone.config.totalScore,
      solvedCount,
      zone.config.challenges.length,
      threatsCount,
      flashWhite
    );
    zone.v02PlaqueSprite.userData.redraw?.(
      Math.round(zone.displayedScore),
      zone.config.totalScore,
      solvedCount,
      zone.config.challenges.length,
      threatsCount,
      flashWhite
    );
    zone.v03LabelSprite.userData.redraw?.(
      Math.round(zone.displayedScore),
      zone.config.totalScore,
      solvedCount,
      zone.config.challenges.length,
      threatsCount,
      this.currentVersion === '0.3' || this.currentVersion === '0.5'
    );
    zone.v03FloorProjRedraw(
      solvedCount,
      zone.config.challenges.length,
      threatsCount > 0
    );
  }

  private refreshAttackTelemetry() {
    const activeCount = this.activeBeams.filter((b) => !b.retiring).length;
    this.attackTelemetrySprite.userData.redraw(
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
    const isTelephotoWide =
      this.currentVersion === '0.3' ||
      this.currentVersion === '0.4' ||
      isV05;
    const ovScale = this.getOverviewScale();
    if (mode === 'panorama') {
      const distZ = (isTelephotoWide ? 54 : 36) * ovScale;
      const posY = (isTelephotoWide ? 38 : 26) * ovScale;
      return {
        endPos: new THREE.Vector3(0, posY, distZ),
        endTarget: new THREE.Vector3(0, -0.8, 0),
      };
    }

    // 默认视角与回中视角：场景居中，视角拉近放大至完整展示前景单个分区（全部分区设备），
    // 俯仰高度处于平视与俯视之间（约 18.5°~19.5° 接近平视的倾斜视角），同时无遮挡呈现中央攻击核心区域
    const azimuthRad = (15 * Math.PI) / 180;
    const sinA = Math.sin(azimuthRad);
    const cosA = Math.cos(azimuthRad);

    if (isV05) {
      const target = new THREE.Vector3(2.2, -0.35, 4.0);
      const horizR = 32.5 * ovScale;
      const heightY = 11.2 * ovScale;
      return {
        endPos: new THREE.Vector3(
          target.x + sinA * horizR,
          heightY,
          target.z + cosA * horizR
        ),
        endTarget: target,
      };
    }

    if (this.currentVersion === '0.3' || this.currentVersion === '0.4') {
      const target = new THREE.Vector3(1.8, -0.45, 5.8);
      const horizR = 36.0 * ovScale;
      const heightY = 12.2 * ovScale;
      return {
        endPos: new THREE.Vector3(
          target.x + sinA * horizR,
          heightY,
          target.z + cosA * horizR
        ),
        endTarget: target,
      };
    }

    // v0.1 / v0.2 (FOV 40°) 等比例缩距对齐单分区 + 中央区域取景
    const target = new THREE.Vector3(2.0, -0.35, 4.4);
    const horizR = 20.5 * ovScale;
    const heightY = 7.1 * ovScale;
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
    const isV04 = this.currentVersion === '0.4';
    this.scene.fog = new THREE.FogExp2(
      isV04 ? 0x07152e : 0x061226,
      mode === 'panorama' ? 0.0022 : 0.0052
    );
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
    this.controls.autoRotateSpeed = 0.8;
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

    // Match the active version's laser attack source origin
    let attackOrigin: THREE.Vector3;
    if (this.currentVersion === '0.5') {
      attackOrigin = new THREE.Vector3(0, 1.38, 0);
    } else if (this.currentVersion === '0.3' || this.currentVersion === '0.4') {
      attackOrigin = new THREE.Vector3(0, 1.01, 18.8);
    } else if (this.currentVersion === '0.2') {
      attackOrigin = new THREE.Vector3(0, 2.1, 18.2);
    } else {
      attackOrigin = new THREE.Vector3(0, 1.8, 19.2);
    }

    const mid = attackOrigin.clone().lerp(devicePos, 0.5);
    mid.y += this.currentVersion === '0.3' || this.currentVersion === '0.4' || this.currentVersion === '0.5' ? 1.85 : 3.2;

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

    // Orbit showcase angle aligned slightly outward from sandbox center for clear visibility
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
    const isV05 = this.currentVersion === '0.5';
    const isTelephotoWide =
      this.currentVersion === '0.3' ||
      this.currentVersion === '0.4' ||
      isV05;
    if (zoneId === 'attack') {
      this.focusedZoneId = null;
      if (isV05) {
        // v0.5 攻击源位于绝对中心 (0, 0, 0)
        this.startCameraTransition(
          new THREE.Vector3(0, 11.2, 19.5),
          new THREE.Vector3(0, 0.8, 0),
          this.autoRotateEnabled
        );
      } else {
        this.startCameraTransition(
          new THREE.Vector3(0, isTelephotoWide ? 8.5 : 10.5, isTelephotoWide ? 33.5 : 32.5),
          new THREE.Vector3(0, isTelephotoWide ? 0.8 : 1.2, 18.8),
          this.autoRotateEnabled
        );
      }
      return;
    }
    const z = this.zones.get(zoneId);
    if (!z) return;
    this.focusedZoneId = zoneId;
    const activePos =
      this.currentVersion === '0.2' ? z.config.v02Position : z.config.position;
    const zp = new THREE.Vector3(...activePos);
    const outDir = zp.clone().normalize();
    const camPos = zp
      .clone()
      .add(outDir.multiplyScalar(isTelephotoWide ? 16.5 : 11.5))
      .add(new THREE.Vector3(0, isTelephotoWide ? 9.5 : 8.2, 0));
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
          zoneColor:
            this.currentVersion === '0.3' || this.currentVersion === '0.5'
              ? '#00d4ff'
              : this.currentVersion === '0.2'
              ? zone.config.v02ColorHex
              : zone.config.colorHex,
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
      zoneColor:
        this.currentVersion === '0.3' || this.currentVersion === '0.5'
          ? '#00d4ff'
          : this.currentVersion === '0.2'
          ? zone.config.v02ColorHex
          : zone.config.colorHex,
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
      if (state === gl.UNSIGNALED && performance.now() - startMs < 140) {
        this.frameId = window.setTimeout(poll, 16);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(scheduleRaf, 60);
      }
    };
    this.frameId = window.setTimeout(poll, 16);
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

      if (!this.useSoftwarePacing && (renderMs > 450 || renderMs > 120)) {
        this.slowFrameStreak += renderMs > 450 ? 2 : 1;
        if (this.slowFrameStreak >= 2) {
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
    this.starField.rotation.y += dt * 0.008;

    const hubBreath = 1.0 + Math.sin(elapsed * 1.2) * 0.04;
    this.hubCoreGroup.scale.setScalar(hubBreath);
    this.hubRingA.rotation.y += dt * 0.35;
    this.hubRingA.rotation.x += dt * 0.15;
    this.hubRingB.rotation.z -= dt * 0.45;
    this.busRingMat.uniforms.uHighlight.value = THREE.MathUtils.damp(
      this.busRingMat.uniforms.uHighlight.value,
      0,
      2.2,
      dt
    );
    this.busNodes.forEach((gem, i) => {
      gem.rotation.y += dt * (0.8 + (i % 3) * 0.2);
      gem.position.y = 0.68 + Math.sin(elapsed * 2.0 + i) * 0.05;
    });

    // v0.2 全息星际版动画更新
    if (this.v02GiantIcoGroup) {
      this.v02GiantIcoGroup.rotation.y += dt * 0.28;
      this.v02GiantIcoGroup.rotation.x = Math.sin(elapsed * 0.7) * 0.08;
      this.v02GiantIcoGroup.position.y = 3.15 + Math.sin(elapsed * 1.4) * 0.12;
    }
    for (let i = 0; i < this.v02OrbitRings.length; i++) {
      const ring = this.v02OrbitRings[i];
      ring.rotation.z += dt * (i % 2 === 0 ? 0.32 : -0.26);
    }
    for (let i = 0; i < this.v02CubeNodes.length; i++) {
      const cube = this.v02CubeNodes[i];
      cube.rotation.y += dt * 0.55;
      cube.position.y = 0.78 + Math.sin(elapsed * 1.8 + i * 0.8) * 0.06;
    }
    for (let i = 0; i < this.v02AvatarNodes.length; i++) {
      const av = this.v02AvatarNodes[i];
      av.position.y = 0.22 + Math.sin(elapsed * 2.2 + i * 1.1) * 0.03;
    }
    if (this.v02ImpactSpark) {
      const pulse = 0.85 + Math.sin(elapsed * 9.0) * 0.3;
      this.v02ImpactSpark.scale.setScalar(pulse);
      this.v02ImpactSpark.rotation.y += dt * 3.0;
    }

    // v0.3 暗黑钛金版核心与前景橙红核脉冲动画
    if (this.v03CoreGimbalA) {
      this.v03CoreGimbalA.rotation.y += dt * 0.22;
      this.v03CoreGimbalB.rotation.z -= dt * 0.18;
    }
    if (this.v03OrangeRedCore && this.v03ConsoleRing) {
      const redPulse = 1.0 + Math.sin(elapsed * 4.2) * 0.05;
      this.v03OrangeRedCore.scale.set(redPulse, 1.0, redPulse);
      this.v03ConsoleRing.rotation.z += dt * 0.45;
    }

      // v0.4 未来沙盘版玻璃核心内部发光能量环动态旋转与脉冲
      for (let i = 0; i < this.v04CoreInnerRings.length; i++) {
        const ir = this.v04CoreInnerRings[i];
        ir.rotation.z += dt * (i % 2 === 0 ? 0.48 : -0.36);
        const s = 1.0 + Math.sin(elapsed * 2.8 - i * 0.55) * 0.045;
        ir.scale.set(s, s, 1);
      }
      if (this.v04CoreOuterGimbal) {
        this.v04CoreOuterGimbal.rotation.y -= dt * 0.25;
        this.v04CoreOuterGimbal.rotation.z += dt * 0.14;
      }

      // v0.5 中央八角暗黑镀铬攻击台高能等离子束核心与双聚焦稳定环动画
      if (this.v05OrangeRedCore && this.v05ConsoleGimbalA && this.v05ConsoleGimbalB) {
        const v05RedPulse = 1.0 + Math.sin(elapsed * 4.2) * 0.055;
        this.v05OrangeRedCore.scale.set(v05RedPulse, 1.0, v05RedPulse);
        this.v05ConsoleGimbalA.rotation.y += dt * 0.42;
        this.v05ConsoleGimbalA.rotation.z -= dt * 0.18;
        this.v05ConsoleGimbalB.rotation.y -= dt * 0.28;
        this.v05ConsoleGimbalB.rotation.z += dt * 0.22;
      }

      const isV03 = this.currentVersion === '0.3' || this.currentVersion === '0.5';
      const isV04 = this.currentVersion === '0.4';
      const isV03OrV04 = isV03 || isV04;
      let idx = 0;
      this.zones.forEach((zone) => {
        // v0.3 / v0.5 为稳固物理沙盘；v0.4 为悬浮磨砂玻璃六边形平台 (seven floating hexagonal platforms made of frosted glass)
        zone.platformGroup.position.y = isV03
          ? 0
          : Math.sin(elapsed * 0.65 + idx * 0.9) * (isV04 ? 0.08 : 0.06);
        idx++;

        if (!isV03OrV04) {
          zone.updateCustomDecor?.(dt, elapsed);
        }

        if (zone.edgeHighlightTimer > 0) {
          zone.edgeHighlightTimer = Math.max(0, zone.edgeHighlightTimer - dt);
          zone.edgeNeonMat.opacity = isV03OrV04 ? 0.88 : 1.0;
        } else {
          zone.edgeNeonMat.opacity = isV04 ? 0.68 : isV03 ? 0.42 : 0.72;
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
          const p = 1.0 - zone.telemetryBounceTimer / 0.65;
          const bounce = 1.0 + Math.sin(p * Math.PI) * 0.12;
          zone.telemetrySprite.scale.set(3.5 * bounce, 1.36 * bounce, 1);
          zone.v02PlaqueSprite.scale.set(4.55 * bounce, 1.68 * bounce, 1);
          if (zone.telemetryBounceTimer === 0) {
            needRedraw = true;
          }
        } else {
          zone.telemetrySprite.scale.set(3.5, 1.36, 1);
          zone.v02PlaqueSprite.scale.set(4.55, 1.68, 1);
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

      this.muzzleRing.rotation.z += dt * 1.5;
      if (this.muzzleChargeTimer > 0) {
        this.muzzleChargeTimer = Math.max(0, this.muzzleChargeTimer - dt);
        const p = 1.0 - this.muzzleChargeTimer / 0.35;
        const s = 1.0 + Math.sin(p * Math.PI) * 0.55;
        this.muzzleCore.scale.setScalar(s);
      } else {
        const idleCharge = 1.0 + Math.sin(elapsed * 3.0) * 0.1;
        this.muzzleCore.scale.setScalar(idleCharge);
      }

      const muzzleLocal = _tmpVecA.set(0, 0.85, -0.8);
      for (let i = 0; i < this.playerOrbs.length; i++) {
        const orb = this.playerOrbs[i];
        orb.angle += orb.orbitSpeed * dt;
        const orbitPos = _tmpVecB.set(
          Math.cos(orb.angle) * orb.orbitRadius,
          0.46,
          Math.sin(orb.angle) * orb.orbitRadius
        );

        if (orb.state === 'orbit') {
          orb.mesh.position.copy(orbitPos);
        } else if (orb.state === 'toMuzzle') {
          orb.timer += dt;
          const t = Math.min(1, orb.timer / 0.35);
          const eased = 1 - Math.pow(1 - t, 3);
          orb.mesh.position.lerpVectors(orb.startPos, muzzleLocal, eased);
          if (t >= 1) {
            orb.state = 'charging';
            orb.timer = 0;
          }
        } else if (orb.state === 'charging') {
          orb.timer += dt;
          const t = Math.min(1, orb.timer / 0.25);
          orb.mesh.scale.setScalar(1.0 + Math.sin(t * Math.PI) * 0.65);
          if (t >= 1) {
            orb.mesh.scale.setScalar(1.0);
            orb.onChargedCallback?.();
            orb.onChargedCallback = undefined;
            orb.state = 'returning';
            orb.timer = 0;
          }
        } else if (orb.state === 'returning') {
          orb.timer += dt;
          const t = Math.min(1, orb.timer / 0.45);
          orb.mesh.position.lerpVectors(muzzleLocal, orbitPos, t);
          if (t >= 1) {
            orb.state = 'orbit';
          }
        }

        if (orb.celebrateTimer > 0) {
          orb.celebrateTimer = Math.max(0, orb.celebrateTimer - dt);
          const p = orb.celebrateTimer / 2.0;
          orb.mesh.scale.setScalar(1.0 + Math.sin(p * Math.PI) * 1.1);
          (orb.haloMesh.material as THREE.MeshBasicMaterial).opacity = Math.sin(p * Math.PI) * 0.85;
        } else {
          (orb.haloMesh.material as THREE.MeshBasicMaterial).opacity = 0;
        }
      }

      for (let i = this.activeBeams.length - 1; i >= 0; i--) {
        const b = this.activeBeams[i];
        b.beamMat.uniforms.uColor.value.lerp(b.targetColor, Math.min(1, dt * 10));
        const sXZ = THREE.MathUtils.damp(b.tubeMesh.scale.x, b.targetScaleXZ, 10, dt);
        b.tubeMesh.scale.set(sXZ, 1, sXZ);

        if (!b.arrived) {
          b.progress += dt / b.duration;
          const t = Math.min(1.0, b.progress);
          const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

          b.curve.getPointAt(eased, _tmpVecC);
          b.probeMesh.position.copy(_tmpVecC);
          b.probeMesh.scale.setScalar(1.0 + Math.sin(eased * Math.PI) * 0.5);
          b.beamMat.uniforms.uProgress.value = eased;

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
            b.onArriveCallback?.();
          }
        } else if (!b.retiring) {
          b.beamMat.uniforms.uOpacity.value = isV03OrV04
            ? 0.82 + Math.sin(elapsed * 4.0) * 0.1
            : 0.44 + Math.sin(elapsed * 5.0) * 0.1;
        }

        if (b.solvingCard) {
          b.solvingCard.visible = !isV03OrV04;
        b.solvingCard.lookAt(this.camera.position);
        b.solvingCard.scale.y = THREE.MathUtils.damp(b.solvingCard.scale.y, 1.0, 12, dt);
      }

      if (b.retiring) {
        b.retireTimer -= dt;
        b.beamMat.uniforms.uOpacity.value = Math.max(0, b.retireTimer);
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
    for (let i = this.shieldDomes.length - 1; i >= 0; i--) {
      const sd = this.shieldDomes[i];
      sd.elapsed += dt;
      if (sd.elapsed < 0.14) {
        const s = 0.3 + (sd.elapsed / 0.14) * 0.7;
        sd.mesh.scale.setScalar(s);
      } else if (sd.elapsed > 0.85) {
        const fade = 1.0 - (sd.elapsed - 0.85) / (sd.duration - 0.85);
        sd.mat.uniforms.uOpacity.value = Math.max(0, fade * 0.9);
        sd.mesh.scale.setScalar(1.0 + (1.0 - fade) * 0.18);
      }
      if (sd.elapsed >= sd.duration) {
        this.fxGroup.remove(sd.mesh);
        sd.mesh.geometry.dispose();
        sd.mat.dispose();
        this.shieldDomes.splice(i, 1);
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
