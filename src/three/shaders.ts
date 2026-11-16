import * as THREE from 'three';

/**
 * 0) 全景穹顶建筑级深蓝灰渐变背景 Shader（告别死黑背景，营造通透的空间纵深感）
 */
export const skyDomeVertexShader = /* glsl */ `
  varying vec3 vWorldPos;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

export const skyDomeFragmentShader = /* glsl */ `
  uniform float uDarkMode;
  uniform float uFuturisticMode;
  varying vec3 vWorldPos;

  void main() {
    vec3 dir = normalize(vWorldPos);
    float elev = clamp(dir.y, -0.35, 1.0);

    // Match scene.background & FogExp2(0x020408, 0.005) seamlessly in linear space
    vec3 nadirCol   = vec3(0.0006, 0.0012, 0.0024);
    vec3 horizonCol = vec3(0.0028, 0.0055, 0.0115);
    vec3 zenithCol  = vec3(0.0006, 0.0012, 0.0026);

    vec3 col = elev >= 0.0
      ? mix(horizonCol, zenithCol, pow(elev, 0.65))
      : mix(horizonCol, nadirCol, clamp(-elev * 3.0, 0.0, 1.0));

    // Ultra-subtle obsidian-blue horizon transition without washing far platforms in blue
    float horizonGlow = exp(-abs(dir.y) * 9.0);
    col += vec3(0.003, 0.010, 0.024) * horizonGlow * 0.35;

    gl_FragColor = vec4(col, 1.0);
  }
`;

/**
 * 0b) v0.3 / v0.5 高抛光深色镜面玻璃地板实时反射 Shader (Softly blurred planar mirror reflection)
 * "The floor is a highly polished dark mirror glass with a subtle glowing cyan hexagonal grid.
 *  The glass softly reflects the equipment above, creating a wet and deep visual effect."
 */
export const DarkMirrorReflectorShader = {
  name: 'DarkMirrorReflectorShader',
  uniforms: {
    color: { value: null as THREE.Color | null },
    tDiffuse: { value: null as THREE.Texture | null },
    textureMatrix: { value: null as THREE.Matrix4 | null },
  },
  vertexShader: /* glsl */ `
    uniform mat4 textureMatrix;
    varying vec4 vUv;
    varying vec2 vPlanePos;

    void main() {
      vPlanePos = position.xy;
      vUv = textureMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform vec3 color;
    uniform sampler2D tDiffuse;
    varying vec4 vUv;
    varying vec2 vPlanePos;

    void main() {
      if (vUv.w <= 0.001) {
        gl_FragColor = vec4(0.006, 0.016, 0.040, 1.0);
        return;
      }

      float dist = length(vPlanePos);
      float radialFade = 1.0 - smoothstep(7.5, 31.8, dist);

      // 13-tap soft Gaussian mirror blur so the dark mirror glass softly reflects the 3D hardware above
      vec4 b = vec4(0.0);
      float r = 0.0030 * vUv.w;
      float r2 = 0.0060 * vUv.w;

      b += texture2DProj(tDiffuse, vUv) * 0.24;
      b += texture2DProj(tDiffuse, vUv + vec4( r,  0.0, 0.0, 0.0)) * 0.11;
      b += texture2DProj(tDiffuse, vUv + vec4(-r,  0.0, 0.0, 0.0)) * 0.11;
      b += texture2DProj(tDiffuse, vUv + vec4(0.0,  r,  0.0, 0.0)) * 0.11;
      b += texture2DProj(tDiffuse, vUv + vec4(0.0, -r,  0.0, 0.0)) * 0.11;
      b += texture2DProj(tDiffuse, vUv + vec4( r * 0.7,  r * 0.7, 0.0, 0.0)) * 0.05;
      b += texture2DProj(tDiffuse, vUv + vec4(-r * 0.7,  r * 0.7, 0.0, 0.0)) * 0.05;
      b += texture2DProj(tDiffuse, vUv + vec4( r * 0.7, -r * 0.7, 0.0, 0.0)) * 0.05;
      b += texture2DProj(tDiffuse, vUv + vec4(-r * 0.7, -r * 0.7, 0.0, 0.0)) * 0.05;
      b += texture2DProj(tDiffuse, vUv + vec4( r2, 0.0, 0.0, 0.0)) * 0.03;
      b += texture2DProj(tDiffuse, vUv + vec4(-r2, 0.0, 0.0, 0.0)) * 0.03;
      b += texture2DProj(tDiffuse, vUv + vec4(0.0,  r2, 0.0, 0.0)) * 0.03;
      b += texture2DProj(tDiffuse, vUv + vec4(0.0, -r2, 0.0, 0.0)) * 0.03;

      // Deep midnight-blue wet mirror glass base + soft wet reflection of models & beams above
      vec3 mirrorBase = vec3(0.005, 0.014, 0.035);
      vec3 reflected = b.rgb * color * (0.42 + 0.28 * radialFade);
      gl_FragColor = vec4(mirrorBase + reflected, 1.0);
    }
  `,
};

/**
 * 1) 地面高抛光暗夜镜面玻璃与柔润微光青色六边形网格 Shader
 * "The floor is a highly polished dark mirror glass with a subtle glowing cyan hexagonal grid.
 *  The glass softly reflects the equipment above, creating a wet and deep visual effect."
 */
export const groundDiscVertexShader = /* glsl */ `
  varying vec2 vPos;
  void main() {
    vPos = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const groundDiscFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uDarkMode;
  uniform float uFuturisticMode;
  uniform float uWireframeMode;
  varying vec2 vPos;

  float hexDist(vec2 p) {
    p = abs(p);
    return max(dot(p, normalize(vec2(1.0, 1.7320508))), p.x);
  }

  float hexGrid(vec2 p) {
    vec4 r = vec4(1.0, 1.7320508, 0.5, 0.8660254);
    vec2 a = mod(p, r.xy) - r.zw;
    vec2 b = mod(p - r.zw, r.xy) - r.zw;
    vec2 gv = dot(a, a) < dot(b, b) ? a : b;
    return 0.5 - hexDist(gv);
  }

  void main() {
    float dist = length(vPos);
    float radialFade = 1.0 - smoothstep(6.5, 32.0, dist);

    // 主六边形精密网格 (Subtle, moist glowing cyan hexagonal grid on dark mirror glass)
    float edgeDistMajor = hexGrid(vPos * 0.88);
    float hexLineMajor = 1.0 - smoothstep(0.0, 0.015, edgeDistMajor);
    float hexGlowMajor = exp(-edgeDistMajor * 44.0) * 0.42;

    // 次级微距六边形子网格
    float edgeDistMinor = hexGrid(vPos * 2.64);
    float hexLineMinor = 1.0 - smoothstep(0.0, 0.014, edgeDistMinor);

    // 十字基准坐标轴刻度线与同心拓扑轨道环
    float axisLine = 1.0 - smoothstep(0.0, 0.012, min(abs(vPos.x), abs(vPos.y)));
    float ring1 = 1.0 - smoothstep(0.0, 0.022, abs(dist - 8.6));
    float ring2 = 1.0 - smoothstep(0.0, 0.022, abs(dist - 13.0));
    float ring3 = 1.0 - smoothstep(0.0, 0.022, abs(dist - 20.5));

    // Soft wet mirror reflections directly beneath the central plasma console, 7 hexagonal platforms & cyan pipelines
    vec2 worldXZ = vec2(vPos.x, -vPos.y);
    float centerPlasmaRefl = exp(-dot(worldXZ, worldXZ) * 0.24);
    float centerConsoleRefl = exp(-dot(worldXZ, worldXZ) * 0.075);

    // 7 platforms at R = 13.0 (angles: 30, 81, 133, 184, 236, 287, 339 deg)
    float ang = atan(worldXZ.x, worldXZ.y);
    float sevenFold = 0.5 + 0.5 * cos((ang - 0.5236) * 7.0);
    float ringPlatformsRefl = exp(-pow(dist - 13.0, 2.0) * 0.14) * (0.35 + 0.65 * pow(sevenFold, 1.6));
    float rackSpecRefl = exp(-pow(dist - 13.0, 2.0) * 0.28) * pow(sevenFold, 2.5);
    float pipelineRefl = smoothstep(3.8, 5.0, dist) * (1.0 - smoothstep(8.2, 9.5, dist)) * pow(sevenFold, 6.0);

    // Subtle wet mirror ripple modulation for deep glass moisture feel
    float wetSheen = 0.92 + 0.08 * sin(dist * 1.35 - uTime * 0.45);

    // Deep obsidian mirror glass base (#020408) + restrained reflections of equipment & plasma core above
    vec3 baseCol = vec3(0.0014, 0.0026, 0.0056)
                 + vec3(0.012, 0.036, 0.068) * (centerConsoleRefl * 0.38 + ringPlatformsRefl * 0.40) * wetSheen
                 + vec3(0.025, 0.058, 0.098) * rackSpecRefl * 0.28
                 + vec3(0.0, 0.12, 0.20) * pipelineRefl * 0.32
                 + vec3(0.36, 0.085, 0.015) * centerPlasmaRefl * 0.48;

    vec3 lineCol = vec3(0.0, 0.78, 0.96);
    float combinedGrid = hexLineMajor * 0.22 + hexGlowMajor * 0.12 + hexLineMinor * 0.04;

    vec3 col = baseCol + lineCol * (combinedGrid + axisLine * 0.02 + (ring1 + ring2 + ring3) * 0.13);
    // Semi-transparent dark mirror glass so real planar Reflector reflections blend with wet depth
    float alpha = radialFade * (0.48 + combinedGrid * 0.44 + ringPlatformsRefl * 0.12);
    vec4 v02Out = vec4(col, clamp(alpha, 0.0, 0.92));

    // 0.1版 (赛博线框风)：暗蓝黑基底 (0x020610) + 暗青色 (0x003355) 若隐若现的不发光六边形地面网格
    vec3 tronBaseCol = vec3(0.001, 0.003, 0.008);
    vec3 tronHexColor = vec3(0.0, 0.20, 0.333); // 0x003355 (远低于 Bloom 阈值 0.6，绝不泛光)
    float tronHexPattern = hexLineMajor * 0.65 + hexLineMinor * 0.22;
    vec3 tronCol = tronBaseCol + tronHexColor * tronHexPattern;
    float tronAlpha = radialFade * (0.42 + tronHexPattern * 0.48);
    vec4 v01Out = vec4(tronCol, clamp(tronAlpha, 0.0, 0.88));

    gl_FragColor = mix(v02Out, v01Out, clamp(uWireframeMode, 0.0, 1.0));
  }
`;

/**
 * 2) 中心环形数据总线 Bus Ring 流光 Shader
 */
export const busRingVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const busRingFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uSpeed;
  uniform float uHighlight;
  varying vec2 vUv;

  void main() {
    float a = fract(vUv.x * 12.0 - uTime * uSpeed);
    float glow = pow(1.0 - abs(a * 2.0 - 1.0), 6.0);
    float boost = 1.0 + uHighlight * 0.8;
    vec3 col = uColor * (0.28 + glow * 0.95) * boost;
    float alpha = clamp((0.35 + glow * 0.55) * (1.0 + uHighlight * 0.3), 0.0, 0.92);
    gl_FragColor = vec4(col, alpha);
  }
`;

/**
 * 3) 分区平台顶面 Shader（深灰哑光枪铁合金甲板 + 柔润微光青色六边形发光轮廓线）
 * "The neon lines emit a soft, moist glow rather than a harsh flat light."
 */
export const zonePlatformVertexShader = /* glsl */ `
  varying vec2 vPos;
  void main() {
    vPos = position.xz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const zonePlatformFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uPhase;
  uniform float uDarkMode;
  uniform float uFuturisticMode;
  varying vec2 vPos;

  float hexGrid(vec2 p) {
    p = abs(p);
    return max(p.x * 0.8660254 + p.y * 0.5, p.y);
  }

  void main() {
    float d = length(vPos);
    if (d > 4.45) discard;

    float hexRadius = hexGrid(vPos);

    // 1) 六边形精密网格线
    vec2 g = fract(vPos * 2.8) - 0.5;
    float hex = hexGrid(g);
    float gridLine = smoothstep(0.46, 0.485, hex) * (1.0 - smoothstep(0.485, 0.505, hex));

    // 2) 设备五边形站位地板投影环 (R=2.85) 与外沿柔润青色六边形双层发光轮廓线 (Soft, moist cyan perimeter glow)
    float mountDist = abs(d - 2.85);
    float mountRing = (1.0 - smoothstep(0.0, 0.018, mountDist)) + exp(-mountDist * 16.0) * 0.18;

    float outlineDist = abs(hexRadius - 3.82);
    float thinHexCore = 1.0 - smoothstep(0.0, 0.014, outlineDist);
    float softMoistAura = exp(-outlineDist * 14.0) * 0.32 + exp(-outlineDist * 5.0) * 0.08;
    float thinHexOutline = thinHexCore * 0.95 + softMoistAura;

    // 3) 径向微光呼吸波
    float scan = fract((uTime + uPhase) * 0.22 - d * 0.16);
    float wave = smoothstep(0.93, 0.99, scan) * 0.16;

    // 4) 中心光泽与金属倒角柔润高光
    float core = (1.0 - smoothstep(0.0, 3.2, d)) * 0.08;
    float rimSpec = smoothstep(3.58, 3.85, hexRadius) * 0.12;
    float edgeFade = 1.0 - smoothstep(4.02, 4.45, d);

    // Semi-transparent interior so real directional shadows cast onto hexMesh show clearly; crisp cyan outline blooms at 0.6
    vec3 deckBase = vec3(0.015, 0.024, 0.036);

    float lineBoost = gridLine * 0.14
                    + mountRing * 0.38
                    + thinHexOutline * 1.35
                    + rimSpec * 0.14
                    + wave * 0.28
                    + core * 0.05;

    vec3 col = deckBase + uColor * lineBoost;
    float a = (0.14 + gridLine * 0.28 + mountRing * 0.45 + thinHexOutline * 0.85) * edgeFade;
    gl_FragColor = vec4(col, clamp(a, 0.0, 0.96));
  }
`;

/**
 * 4) 分区接入总线管道 Access Pipe 流动 Shader (Glowing cyan pipelines with soft moist glow)
 */
export const accessPipeVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const accessPipeFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uDir;
  varying vec2 vUv;

  void main() {
    float flow1 = fract(vUv.x * 5.0 - uTime * 1.35 * uDir);
    float pulse1 = pow(1.0 - abs(flow1 * 2.0 - 1.0), 5.0);
    float flow2 = fract(vUv.x * 2.0 - uTime * 0.65 * uDir + 0.35);
    float pulse2 = pow(1.0 - abs(flow2 * 2.0 - 1.0), 8.0);
    float rim = pow(1.0 - abs(vUv.y - 0.5) * 2.0, 1.15);
    vec3 col = uColor * (0.62 + pulse1 * 1.15 + pulse2 * 0.78) + vec3(0.28, 0.75, 0.95) * (pulse1 * 0.38);
    float alpha = clamp((0.46 + pulse1 * 0.48 + pulse2 * 0.28) * rim, 0.0, 0.96);
    gl_FragColor = vec4(col, alpha);
  }
`;

/**
 * 5) 攻击光束 Attack Beam Shader（高亮核心激光束 + 外层体积光晕护套）
 */
export const attackBeamVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const attackBeamFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uProgress;
  uniform float uIntensity;
  uniform float uOpacity;
  uniform vec3 uColor;
  varying vec2 vUv;

  void main() {
    float flow1 = fract(vUv.x * 4.0 - uTime * 3.2);
    float flow2 = fract(vUv.x * 9.0 - uTime * 5.0);
    float pulse1 = pow(1.0 - abs(flow1 * 2.0 - 1.0), 2.8);
    float pulse2 = pow(1.0 - abs(flow2 * 2.0 - 1.0), 5.0);
    float pulse = pulse1 * 0.9 + pulse2 * 0.7;

    float head = smoothstep(uProgress - 0.075, uProgress, vUv.x)
               * (1.0 - smoothstep(uProgress, uProgress + 0.015, vUv.x));

    float grow = step(vUv.x, uProgress);
    float rim = pow(1.0 - abs(vUv.y - 0.5) * 2.0, 1.05);
    float coreLine = pow(1.0 - abs(vUv.y - 0.5) * 2.0, 2.8);

    float a = grow * (0.88 + pulse * 0.35 + head * 0.95) * rim * uOpacity;
    vec3 baseLaser = uColor * (1.35 + pulse * 1.15 + head * 1.85) * uIntensity;
    vec3 hotTint = mix(uColor, vec3(1.0, 0.96, 0.88), 0.62);
    vec3 innerHot = hotTint * (coreLine * (0.85 + pulse2 * 0.75) + head * 1.25);

    gl_FragColor = vec4(baseLaser + innerHot, clamp(a, 0.0, 1.0));
  }
`;

export const attackBeamHaloVertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormalView;
  varying vec3 vViewDir;
  void main() {
    vUv = uv;
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    vNormalView = normalize(normalMatrix * normal);
    vViewDir = normalize(-mvPos.xyz);
    gl_Position = projectionMatrix * mvPos;
  }
`;

export const attackBeamHaloFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uProgress;
  uniform float uIntensity;
  uniform float uOpacity;
  uniform vec3 uColor;
  varying vec2 vUv;
  varying vec3 vNormalView;
  varying vec3 vViewDir;

  void main() {
    float flow1 = fract(vUv.x * 4.0 - uTime * 3.2);
    float flow2 = fract(vUv.x * 9.0 - uTime * 5.0);
    float pulse = pow(1.0 - abs(flow1 * 2.0 - 1.0), 2.5) * 0.9
                + pow(1.0 - abs(flow2 * 2.0 - 1.0), 4.5) * 0.6;

    float head = smoothstep(uProgress - 0.085, uProgress, vUv.x)
               * (1.0 - smoothstep(uProgress, uProgress + 0.015, vUv.x));

    float grow = step(vUv.x, uProgress);
    // Volumetric cylindrical falloff: brightest along centerline, smooth zero at outer cylinder edge
    float facing = max(dot(normalize(vNormalView), normalize(vViewDir)), 0.0);
    float haloProfile = pow(facing, 1.85);

    float a = grow * haloProfile * (0.58 + pulse * 0.42 + head * 0.75) * uOpacity;
    vec3 brightTint = clamp(uColor * 1.3 + vec3(0.25), 0.0, 1.0);
    vec3 glowCol = mix(uColor, brightTint, pulse * 0.38 + head * 0.52)
                 * (1.15 + pulse * 0.95 + head * 1.45) * uIntensity;

    gl_FragColor = vec4(glowCol, clamp(a, 0.0, 0.92));
  }
`;

/**
 * 6) 六边形蜂窝能量护盾 Shader
 */
export const hexShieldVertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vPos;
  void main() {
    vUv = uv;
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const hexShieldFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  uniform vec3 uColor;
  varying vec2 vUv;
  varying vec3 vPos;

  float hexGrid(vec2 p) {
    p = abs(p);
    return max(p.x * 0.8660254 + p.y * 0.5, p.y);
  }

  void main() {
    vec2 centered = (vUv - 0.5) * 2.0;
    float r = length(centered);

    vec2 g = fract(centered * 5.0) - 0.5;
    float h = hexGrid(g);
    float cellEdge = smoothstep(0.40, 0.47, h);

    float wave = sin(r * 16.0 - uTime * 14.0) * 0.5 + 0.5;
    float rim = smoothstep(0.45, 0.98, r);

    vec3 col = uColor * (0.5 + cellEdge * 0.95 + wave * 0.45 + rim * 0.85);
    float alpha = clamp((0.22 + cellEdge * 0.48 + rim * 0.38 + wave * 0.18) * uOpacity, 0.0, 0.92);
    gl_FragColor = vec4(col, alpha);
  }
`;

/**
 * 7) 后处理：8K 全景清晰对焦 + 摄影级柔和暗角
 */
export const VignetteChromaticShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uTime: { value: 0 },
    uMacroDof: { value: 0.0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uMacroDof;
    varying vec2 vUv;

    void main() {
      vec2 uv = vUv;
      vec2 c = uv - 0.5;
      float d = length(c);

      vec3 col = texture2D(tDiffuse, uv).rgb;

      // 保持充足曝光与通透对比度，仅在四角做极轻微的摄影级收敛
      float vig = 1.0 - smoothstep(0.50, 1.08, d);
      col *= mix(0.90, 1.0, vig);

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

/**
 * 8) 中心攻击区：高强度受控橙红高能等离子能量光束柱 Shader
 * "In the absolute center, an octagonal dark chrome console features a high-intensity,
 *  elegantly controlled orange-red glowing plasma core. It looks like a concentrated energy beam
 *  with an intense inner glow, NOT a solid yellow sphere."
 */
export const plasmaBeamVertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormalView;
  varying vec3 vViewDir;

  void main() {
    vUv = uv;
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    vNormalView = normalize(normalMatrix * normal);
    vViewDir = normalize(-mvPos.xyz);
    gl_Position = projectionMatrix * mvPos;
  }
`;

export const plasmaBeamFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uCoreWeight; // 0.0 = outer plasma corona, 0.55 = primary beam column, 1.0 = intense inner filament
  varying vec2 vUv;
  varying vec3 vNormalView;
  varying vec3 vViewDir;

  void main() {
    // Collimated radial beam profile: razor-sharp along central spine, smooth exponential falloff at edges
    float ndv = clamp(abs(dot(normalize(vNormalView), normalize(vViewDir))), 0.0, 1.0);
    float radial = pow(ndv, mix(1.85, 3.2, uCoreWeight));

    // Smooth vertical beam collimation from emitter aperture to upper crown
    float vFadeBottom = smoothstep(0.0, 0.10, vUv.y);
    float vFadeTop = smoothstep(1.0, 0.78, vUv.y);
    float vEnvelope = vFadeBottom * vFadeTop;

    // Upward-streaming concentrated energy waves & vertical plasma filaments
    float angle = vUv.x * 6.2831853;
    float verticalStriation = sin(angle * 6.0 + vUv.y * 8.0 - uTime * 3.5) * 0.5 + 0.5;
    float surgeWave1 = sin(vUv.y * 14.0 - uTime * 7.2) * 0.5 + 0.5;
    float surgeWave2 = sin(vUv.y * 26.0 - uTime * 11.5 + angle * 2.0) * 0.5 + 0.5;
    float energyFlow = 0.68 + 0.22 * surgeWave1 + 0.14 * surgeWave2 * verticalStriation;

    // High-intensity, elegantly controlled orange-red plasma palette with an intense inner glow (NO yellow ball!)
    vec3 outerCrimson = vec3(0.90, 0.07, 0.01);
    vec3 midOrangeRed = vec3(1.00, 0.28, 0.04);
    vec3 intenseInnerGlow = vec3(1.00, 0.72, 0.46);

    vec3 col = mix(outerCrimson, midOrangeRed, clamp(radial * 0.90 + uCoreWeight * 0.35, 0.0, 1.0));
    float innerSpine = pow(ndv, 3.6) * uCoreWeight;
    col = mix(col, intenseInnerGlow, clamp(innerSpine * (0.78 + 0.22 * surgeWave1), 0.0, 0.95));

    float intensity = mix(1.05, 1.65, uCoreWeight) * energyFlow;
    float alpha = clamp(radial * vEnvelope * mix(0.62, 0.98, uCoreWeight), 0.0, 0.98);

    gl_FragColor = vec4(col * intensity, alpha);
  }
`;

/**
 * 9) 中心攻击区：环绕高能等离子光束核心的半透明全息约束外壳 Shader (Translucent Holographic Shell)
 */
export const holoShellVertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vLocalPos;
  varying vec3 vNormalView;
  varying vec3 vViewDir;

  void main() {
    vUv = uv;
    vLocalPos = position;
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    vNormalView = normalize(normalMatrix * normal);
    vViewDir = normalize(-mvPos.xyz);
    gl_Position = projectionMatrix * mvPos;
  }
`;

export const holoShellFragmentShader = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vLocalPos;
  varying vec3 vNormalView;
  varying vec3 vViewDir;

  float hexDist(vec2 p) {
    p = abs(p);
    return max(p.x * 0.8660254 + p.y * 0.5, p.y);
  }

  void main() {
    float ndv = clamp(abs(dot(normalize(vNormalView), normalize(vViewDir))), 0.0, 1.0);
    // Crisp translucent glass Fresnel rim so the center stays ultra-clear for the inner plasma beam
    float fresnel = pow(1.0 - ndv, 2.55);

    // Subtle hexagonal holographic micro-lattice weighted toward the grazing edges
    vec2 g = fract(vec2(vUv.x * 16.0, vUv.y * 10.0)) - 0.5;
    float h = hexDist(g);
    float hexLine = smoothstep(0.43, 0.485, h) * (0.25 + 0.75 * fresnel);

    // Smooth upward holographic containment scan rings
    float scan = pow(sin(vUv.y * 18.0 - uTime * 2.4) * 0.5 + 0.5, 5.0);
    float endCapRim = smoothstep(0.86, 0.99, abs(vUv.y * 2.0 - 1.0));

    // Moist neon cyan holographic shell with a subtle warm orange-red plasma reflection at the inner base
    vec3 cyanHolo = vec3(0.04, 0.78, 1.00);
    vec3 warmInnerTint = vec3(1.00, 0.30, 0.06);
    float warmMix = (1.0 - smoothstep(0.0, 0.48, vUv.y)) * 0.25;

    vec3 col = mix(cyanHolo, warmInnerTint, warmMix) * (0.42 + fresnel * 1.22 + hexLine * 0.38 + scan * 0.28 + endCapRim * 0.55);
    float alpha = clamp(0.04 + fresnel * 0.36 + hexLine * 0.11 + scan * 0.08 + endCapRim * 0.22, 0.03, 0.48);

    gl_FragColor = vec4(col, alpha);
  }
`;


