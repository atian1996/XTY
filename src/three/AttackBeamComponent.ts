import * as THREE from 'three';
import { ZoneId } from '../types/cyberRange';
import { attackBeamFragmentShader, attackBeamVertexShader } from './shaders';

export interface ActiveBeamRuntime {
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
  progress: number;
  duration: number;
  arrived: boolean;
  autoRetireDelay: number;
  retiring: boolean;
  retireTimer: number;
  targetColor: THREE.Color;
  targetScaleXZ: number;
  onArriveCallback?: () => void;
  onDisposeCallback?: () => void;
}

const _tmpVec = new THREE.Vector3();

/**
 * 独立的动态攻击射线组件：
 * - 平时保持零常驻射线，仅中心与平台间保留青色粗数据管道；
 * - 仅在触发攻击/解题事件时动态生成单条红线并沿贝塞尔弧线飞向目标设备；
 * - 动画播放完毕后立即自动销毁并释放 GPU 几何体与材质资源。
 */
export class AttackBeamComponent {
  private beams: ActiveBeamRuntime[] = [];

  constructor(
    private fxGroup: THREE.Group,
    private sharedTimeUniform: { value: number }
  ) {}

  public get activeCount(): number {
    return this.beams.filter((b) => !b.retiring).length;
  }

  public findByChallenge(challengeId: string): ActiveBeamRuntime | undefined {
    return this.beams.find((b) => b.challengeId === challengeId);
  }

  public spawn(opts: {
    challengeId: string;
    zoneId: ZoneId;
    teamName: string;
    curve: THREE.Curve<THREE.Vector3>;
    colorHex?: number;
    duration?: number;
    autoRetireDelay?: number;
    onArrive?: () => void;
    onDispose?: () => void;
  }): ActiveBeamRuntime {
    // 若同一题目存在尚在飞行的旧射线，先立即销毁，杜绝乱线叠加
    const existingIdx = this.beams.findIndex((b) => b.challengeId === opts.challengeId);
    if (existingIdx !== -1) {
      this.disposeOne(this.beams[existingIdx], false);
      this.beams.splice(existingIdx, 1);
    }

    const beamRadius = 0.036;
    const beamColorHex = opts.colorHex ?? 0xff2a1a;

    const tubeGeo = new THREE.TubeGeometry(opts.curve, 80, beamRadius, 8, false);
    const beamMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: this.sharedTimeUniform,
        uProgress: { value: 0.0 },
        uIntensity: { value: 2.35 },
        uOpacity: { value: 0.96 },
        uColor: { value: new THREE.Color(beamColorHex) },
      },
      vertexShader: attackBeamVertexShader,
      fragmentShader: attackBeamFragmentShader,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const tubeMesh = new THREE.Mesh(tubeGeo, beamMat);
    this.fxGroup.add(tubeMesh);

    const probeMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.125, 14, 14),
      new THREE.MeshBasicMaterial({
        color: 0xff8a55,
        blending: THREE.AdditiveBlending,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
      })
    );
    const startPt = opts.curve.getPointAt(0);
    probeMesh.position.copy(startPt);
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
        opacity: 0.78,
      })
    );
    this.fxGroup.add(trailLine);

    const runtime: ActiveBeamRuntime = {
      id: `${opts.challengeId}-${Date.now()}`,
      challengeId: opts.challengeId,
      zoneId: opts.zoneId,
      teamName: opts.teamName,
      curve: opts.curve,
      tubeMesh,
      beamMat,
      probeMesh,
      trailLine,
      trailPositions,
      progress: 0.0,
      duration: opts.duration ?? 0.75,
      arrived: false,
      autoRetireDelay: opts.autoRetireDelay ?? 0.4,
      retiring: false,
      retireTimer: 0,
      targetColor: new THREE.Color(beamColorHex),
      targetScaleXZ: 1.0,
      onArriveCallback: opts.onArrive,
      onDisposeCallback: opts.onDispose,
    };

    this.beams.push(runtime);
    return runtime;
  }

  public retire(beam: ActiveBeamRuntime, fadeDuration = 0.42) {
    if (!beam.retiring) {
      beam.retiring = true;
      beam.retireTimer = fadeDuration;
    }
  }

  public update(dt: number, onAfterChange?: () => void) {
    let changed = false;

    for (let i = this.beams.length - 1; i >= 0; i--) {
      const b = this.beams[i];
      b.beamMat.uniforms.uColor.value.lerp(b.targetColor, Math.min(1, dt * 10));
      const sXZ = THREE.MathUtils.damp(b.tubeMesh.scale.x, b.targetScaleXZ, 10, dt);
      b.tubeMesh.scale.set(sXZ, 1, sXZ);

      if (!b.arrived) {
        b.progress += dt / b.duration;
        const t = Math.min(1.0, b.progress);
        const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

        b.curve.getPointAt(eased, _tmpVec);
        b.probeMesh.position.copy(_tmpVec);
        b.probeMesh.scale.setScalar(1.0 + Math.sin(eased * Math.PI) * 0.45);
        b.beamMat.uniforms.uProgress.value = eased;

        const arr = b.trailPositions;
        for (let k = 7; k > 0; k--) {
          arr[k * 3] = arr[(k - 1) * 3];
          arr[k * 3 + 1] = arr[(k - 1) * 3 + 1];
          arr[k * 3 + 2] = arr[(k - 1) * 3 + 2];
        }
        arr[0] = _tmpVec.x;
        arr[1] = _tmpVec.y;
        arr[2] = _tmpVec.z;
        b.trailLine.geometry.attributes.position.needsUpdate = true;

        if (t >= 1.0) {
          b.arrived = true;
          b.probeMesh.visible = false;
          b.trailLine.visible = false;
          b.beamMat.uniforms.uOpacity.value = 0.85;
          b.onArriveCallback?.();
        }
      } else if (!b.retiring) {
        if (b.autoRetireDelay >= 0) {
          b.autoRetireDelay -= dt;
          if (b.autoRetireDelay <= 0) {
            b.retiring = true;
            b.retireTimer = 0.42;
          }
        }
      }

      if (b.retiring) {
        b.retireTimer -= dt;
        b.beamMat.uniforms.uOpacity.value = Math.max(0, (b.retireTimer / 0.45) * 0.85);
        if (b.retireTimer <= 0) {
          this.disposeOne(b, true);
          this.beams.splice(i, 1);
          changed = true;
        }
      }
    }

    if (changed) {
      onAfterChange?.();
    }
  }

  public clearAll() {
    for (let i = this.beams.length - 1; i >= 0; i--) {
      this.disposeOne(this.beams[i], false);
    }
    this.beams = [];
  }

  private disposeOne(beam: ActiveBeamRuntime, notifyDispose: boolean) {
    this.fxGroup.remove(beam.tubeMesh, beam.probeMesh, beam.trailLine);
    beam.tubeMesh.geometry.dispose();
    beam.beamMat.dispose();
    beam.probeMesh.geometry.dispose();
    (beam.probeMesh.material as THREE.Material).dispose();
    beam.trailLine.geometry.dispose();
    (beam.trailLine.material as THREE.Material).dispose();
    if (notifyDispose) {
      beam.onDisposeCallback?.();
    }
  }
}
