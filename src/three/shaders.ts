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

  // Procedural smooth noise for subtle glowing nebula in v0.4
  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
          mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
          mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
      f.z
    );
  }

  void main() {
    vec3 dir = normalize(vWorldPos);
    float elev = clamp(dir.y, -0.35, 1.0);

    // Unified Deep Midnight Blue Sky & Atmospheric Wet Horizon Mist across all versions (zero light pollution)
    vec3 nadirColBase   = vec3(0.010, 0.025, 0.062);
    vec3 horizonColBase = vec3(0.042, 0.105, 0.220);
    vec3 zenithColBase  = vec3(0.007, 0.018, 0.048);

    // v0.4: Deep space midnight blue with a subtle glowing nebula
    vec3 nadirCol4   = vec3(0.016, 0.042, 0.108);
    vec3 horizonCol4 = vec3(0.056, 0.145, 0.305);
    vec3 zenithCol4  = vec3(0.011, 0.030, 0.088);

    vec3 nadirCol   = mix(nadirColBase, nadirCol4, uFuturisticMode);
    vec3 horizonCol = mix(horizonColBase, horizonCol4, uFuturisticMode);
    vec3 zenithCol  = mix(zenithColBase, zenithCol4, uFuturisticMode);

    vec3 col = elev >= 0.0
      ? mix(horizonCol, zenithCol, pow(elev, 0.54))
      : mix(horizonCol, nadirCol, clamp(-elev * 3.0, 0.0, 1.0));

    // Soft, moist cinematic volumetric horizon mist (no harsh white glare or giant halos)
    float horizonGlow = exp(-abs(dir.y) * 9.5);
    float volumetricHaze = exp(-abs(dir.y - 0.03) * 5.0);
    col += vec3(0.036, 0.118, 0.235) * horizonGlow * 0.28;
    col += vec3(0.028, 0.102, 0.205) * volumetricHaze * mix(0.22, 0.34, uFuturisticMode);

    // v0.4 Subtle glowing deep-space blue/cyan nebula band across the upper sky
    if (uFuturisticMode > 0.01) {
      float n1 = noise(dir * 3.2 + vec3(1.4, 0.8, -2.1));
      float n2 = noise(dir * 6.8 - vec3(0.7, 2.3, 1.2));
      float nebulaMask = smoothstep(-0.05, 0.55, dir.y) * smoothstep(0.92, 0.18, dir.y);
      float nebulaCloud = pow(clamp(n1 * 0.65 + n2 * 0.35, 0.0, 1.0), 2.2) * nebulaMask;
      vec3 nebulaColor = mix(vec3(0.06, 0.24, 0.56), vec3(0.08, 0.52, 0.78), n2);
      col += nebulaColor * nebulaCloud * 0.36 * uFuturisticMode;
    }

    gl_FragColor = vec4(col, 1.0);
  }
`;

/**
 * 0b) v0.3 高抛光深色镜面玻璃地板实时反射 Shader (Softly blurred planar mirror reflection)
 * "The floor is a highly polished dark mirror glass that softly reflects the models above."
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
        gl_FragColor = vec4(0.008, 0.020, 0.046, 1.0);
        return;
      }

      float dist = length(vPlanePos);
      float radialFade = 1.0 - smoothstep(7.5, 31.8, dist);

      // 13-tap soft Gaussian mirror blur so the dark mirror glass softly reflects the 3D hardware above
      vec4 b = vec4(0.0);
      float r = 0.0028 * vUv.w;
      float r2 = 0.0056 * vUv.w;

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

      // Deep midnight-blue mirror glass base + soft wet reflection of models & beams above
      vec3 mirrorBase = vec3(0.006, 0.016, 0.038);
      vec3 reflected = b.rgb * color * (0.38 + 0.26 * radialFade);
      gl_FragColor = vec4(mirrorBase + reflected, 1.0);
    }
  `,
};

/**
 * 1) 地面六边形与正交工程精密网格圆盘 Shader
 * v0.3: Highly polished dark mirror glass floor that softly reflects the models above, featuring a subtle, sleek glowing cyan hexagonal grid pattern
 * v0.4: Deep midnight blue floor with subtle silver/cyan caustics bouncing off silver & glass surfaces
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

    // 主六边形精密网格 (Unified subtle, moist glowing cyan hexagonal grid across all versions)
    float edgeDistMajor = hexGrid(vPos * 0.88);
    float hexLineMajor = 1.0 - smoothstep(0.0, 0.015, edgeDistMajor);
    float hexGlowMajor = exp(-edgeDistMajor * 48.0) * 0.35;

    // 次级微距六边形子网格
    float edgeDistMinor = hexGrid(vPos * 2.64);
    float hexLineMinor = 1.0 - smoothstep(0.0, 0.014, edgeDistMinor);

    // v0.4 辅助正交精雕细网格
    vec2 orthoCell = abs(fract(vPos * 0.75) - 0.5);
    float orthoMajor = (1.0 - smoothstep(0.0, 0.016, min(orthoCell.x, orthoCell.y))) * uFuturisticMode;

    // 十字基准坐标轴刻度线
    float axisLine = 1.0 - smoothstep(0.0, 0.012, min(abs(vPos.x), abs(vPos.y)));

    // 同心拓扑轨道环（内核 R=8.6、中环 R=14.0、外环 R=20.5）
    float ring1 = 1.0 - smoothstep(0.0, 0.022, abs(dist - 8.6));
    float ring2 = 1.0 - smoothstep(0.0, 0.022, abs(dist - 14.0));
    float ring3 = 1.0 - smoothstep(0.0, 0.022, abs(dist - 20.5));

    // Soft mirror reflections directly beneath the central core, 7 hexagonal platforms & foreground console
    vec2 worldXZ = vec2(vPos.x, -vPos.y);
    float coreRefl = exp(-dot(worldXZ, worldXZ) * 0.095) * 0.36;
    float ringPlatformsRefl = exp(-pow(dist - 14.0, 2.0) * 0.18) * (0.45 + 0.55 * clamp(cos(atan(worldXZ.x, worldXZ.y) * 7.0), 0.0, 1.0));
    vec2 attackDelta = worldXZ - vec2(0.0, 18.8);
    float attackRefl = exp(-dot(attackDelta, attackDelta) * 0.32) * (1.0 - uDarkMode * 0.0);

    // v0.4 银白/亚克力玻璃表面的水波焦散反射纹
    float caustic1 = sin(vPos.x * 1.4 + uTime * 0.5) * cos(vPos.y * 1.4 - uTime * 0.4);
    float caustic2 = sin((vPos.x + vPos.y) * 1.9 - uTime * 0.35);
    float causticPattern = pow(clamp((caustic1 + caustic2) * 0.5 + 0.5, 0.0, 1.0), 4.0) * exp(-dist * 0.055);

    // Unified highly polished dark midnight-blue mirror glass base
    vec3 baseColDark = vec3(0.008, 0.020, 0.048)
                     + vec3(0.024, 0.064, 0.122) * (coreRefl + ringPlatformsRefl * 0.40)
                     + vec3(0.20, 0.028, 0.010) * attackRefl * 0.32;
    vec3 baseCol4 = vec3(0.018, 0.046, 0.106) + vec3(0.07, 0.19, 0.38) * causticPattern * 0.50;
    vec3 baseCol = mix(baseColDark, baseCol4, uFuturisticMode);

    vec3 lineColDark = vec3(0.0, 0.76, 0.98);
    vec3 lineCol4 = vec3(0.26, 0.84, 1.0);
    vec3 lineCol = mix(lineColDark, lineCol4, uFuturisticMode);

    float combinedGrid = (hexLineMajor * 0.18 + hexGlowMajor * 0.12 + hexLineMinor * 0.045) + orthoMajor * 0.12;
    float ringWeight = mix(0.11, 0.24, uFuturisticMode);

    vec3 col = baseCol + lineCol * (combinedGrid + axisLine * 0.028 + (ring1 + ring2 + ring3) * ringWeight);
    // Semi-transparent dark mirror glass so real planar Reflector reflections shine softly through on every version
    float alpha = radialFade * (mix(0.48, 0.56, uFuturisticMode) + combinedGrid * 0.42);

    gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.92));
  }
`;

/**
 * 2) 中心环形数据总线 Bus Ring 流光 Shader（克制亮度，突出流动纹理）
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
 * 3) 分区平台顶面 Shader（v0.3 深灰哑光合金甲板 + 极细暗青发光轮廓线 / v0.4 磨砂亚克力玻璃甲板）
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

    // 六边形真实边界距离 (True hexagonal distance from center for crisp thin hex outline)
    float hexRadius = hexGrid(vPos);

    // 1) 六边形精密网格线
    vec2 g = fract(vPos * mix(1.5, 2.8, max(uDarkMode, uFuturisticMode))) - 0.5;
    float hex = hexGrid(g);
    float gridLine = smoothstep(0.46, 0.485, hex) * (1.0 - smoothstep(0.485, 0.505, hex));

    // 2) 设备五边形站位地板投影环 (R=2.85) 与外沿柔润青色六边形双层发光轮廓线 (Soft, moist cyan perimeter glow)
    float mountDist = abs(d - 2.85);
    float mountRing = (1.0 - smoothstep(0.0, 0.018, mountDist)) + exp(-mountDist * 18.0) * 0.16;

    float outlineDist = abs(hexRadius - 3.82);
    float thinHexCore = 1.0 - smoothstep(0.0, 0.020, outlineDist);
    float softMoistAura = exp(-outlineDist * 11.5) * 0.48 + exp(-outlineDist * 3.8) * 0.14;
    float thinHexOutline = thinHexCore * 0.92 + softMoistAura;

    // 3) 径向扫描波
    float scan = fract((uTime + uPhase) * 0.25 - d * 0.16);
    float wave = smoothstep(0.92, 0.99, scan) * 0.25;

    // 4) 中心光泽与边缘柔润高光
    float core = (1.0 - smoothstep(0.0, 3.2, d)) * 0.22;
    float rimSpec = smoothstep(3.58, 3.85, hexRadius) * mix(0.34, 0.54, uFuturisticMode);
    float edgeFade = 1.0 - smoothstep(4.02, 4.45, d);

    // Dark matte alloy deck base (gunmetal grey, NOT pure black) & frosted acrylic glass in v0.4
    vec3 deckBase03 = mix(vec3(0.085, 0.132, 0.205), vec3(0.142, 0.188, 0.256), uDarkMode);
    vec3 deckBase04 = vec3(0.19, 0.31, 0.47) + vec3(0.14, 0.26, 0.42) * (1.0 - smoothstep(0.5, 4.2, d)) * 0.42;
    vec3 deckBase = mix(deckBase03, deckBase04, uFuturisticMode);

    float lineBoost = gridLine * mix(0.14, 0.20, uFuturisticMode)
                    + mountRing * 0.24
                    + thinHexOutline * 0.88
                    + rimSpec
                    + wave * 0.35
                    + core * 0.20;

    vec3 col = deckBase + uColor * lineBoost;
    float a = (mix(0.84, 0.96, uDarkMode) * (1.0 - uFuturisticMode * 0.22) + gridLine * 0.10 + thinHexOutline * 0.38) * edgeFade;
    gl_FragColor = vec4(col, clamp(a, 0.0, 0.98));
  }
`;

/**
 * 4) 分区接入总线管道 Access Pipe 流动 Shader
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
    float flow = fract(vUv.x * 6.0 - uTime * 1.15 * uDir);
    float pulse = pow(1.0 - abs(flow * 2.0 - 1.0), 6.0);
    float rim = pow(1.0 - abs(vUv.y - 0.5) * 2.0, 1.5);
    vec3 col = uColor * (0.42 + pulse * 1.15);
    float alpha = (0.28 + pulse * 0.52) * rim;
    gl_FragColor = vec4(col, alpha);
  }
`;

/**
 * 5) 攻击光束 Attack Beam Shader（精确还原设计文档 14.2，同时控制最高亮度防止过曝）
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
    float flow = fract(vUv.x * 8.0 - uTime * 3.0);
    float pulse = pow(1.0 - abs(flow * 2.0 - 1.0), 6.0);

    float head = smoothstep(uProgress - 0.045, uProgress, vUv.x)
               * (1.0 - smoothstep(uProgress, uProgress + 0.02, vUv.x));

    float grow = step(vUv.x, uProgress);
    float rim = pow(1.0 - abs(vUv.y - 0.5) * 2.0, 1.8);

    float a = grow * (0.42 + pulse * 0.55 + head * 0.9) * rim * uOpacity;
    vec3 col = uColor * (0.75 + pulse * 0.85 + head * 1.8) * uIntensity;

    gl_FragColor = vec4(col, clamp(a, 0.0, 0.95));
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
 * 7) 后处理：柔和暗角 + 可选微距浅景深 (v0.3 下保持 uMacroDof = 0.0 以实现 8K 全景锐利无模糊对焦)
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

      vec3 col;
      if (uMacroDof > 0.01) {
        vec2 off = c * d * 0.0008;
        col.r = texture2D(tDiffuse, uv + off).r;
        col.g = texture2D(tDiffuse, uv).g;
        col.b = texture2D(tDiffuse, uv - off).b;

        float farBlur = smoothstep(0.72, 0.98, uv.y);
        float nearBlur = smoothstep(0.14, 0.01, uv.y) * 0.45;
        float coc = clamp(farBlur + nearBlur, 0.0, 1.0) * uMacroDof * 0.0020;
        if (coc > 0.0001) {
          vec3 acc = col * 0.32;
          acc += texture2D(tDiffuse, uv + vec2( coc,  0.0)).rgb * 0.11;
          acc += texture2D(tDiffuse, uv + vec2(-coc,  0.0)).rgb * 0.11;
          acc += texture2D(tDiffuse, uv + vec2( 0.0,  coc)).rgb * 0.11;
          acc += texture2D(tDiffuse, uv + vec2( 0.0, -coc)).rgb * 0.11;
          acc += texture2D(tDiffuse, uv + vec2( coc * 0.7,  coc * 0.7)).rgb * 0.06;
          acc += texture2D(tDiffuse, uv + vec2(-coc * 0.7,  coc * 0.7)).rgb * 0.06;
          acc += texture2D(tDiffuse, uv + vec2( coc * 0.7, -coc * 0.7)).rgb * 0.06;
          acc += texture2D(tDiffuse, uv + vec2(-coc * 0.7, -coc * 0.7)).rgb * 0.06;
          col = acc;
        }
      } else {
        // Crystal-clear 8K sharp focus with zero chromatic blur
        col = texture2D(tDiffuse, uv).rgb;
      }

      // 保持充足曝光与通透度，仅在四角做极轻微的摄影级收敛
      float vig = 1.0 - smoothstep(0.46, 1.02, d);
      col *= mix(0.84, 1.0, vig);

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

/**
 * 8) 中心攻击区：高强度橙红高能等离子束核心 Shader (Concentrated Energy Beam, NOT a solid sphere)
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
  uniform float uCoreWeight; // 0.0 = outer plasma sheath, 1.0 = concentrated inner beam filament
  varying vec2 vUv;
  varying vec3 vNormalView;
  varying vec3 vViewDir;

  void main() {
    // Radial beam profile: bright along center axis, soft falloff at silhouette edges
    float ndv = clamp(abs(dot(normalize(vNormalView), normalize(vViewDir))), 0.0, 1.0);
    float radial = pow(ndv, mix(1.55, 2.6, uCoreWeight));

    // Taper smoothly at top and emitter base so it reads as an active concentrated energy column
    float vFadeBottom = smoothstep(0.0, 0.14, vUv.y);
    float vFadeTop = smoothstep(1.0, 0.72, vUv.y);
    float vEnvelope = vFadeBottom * vFadeTop;

    // Animated upward-surging plasma filaments & helical energy striations
    float angle = vUv.x * 6.2831853;
    float spiral1 = sin(angle * 3.0 + vUv.y * 14.0 - uTime * 5.2);
    float spiral2 = sin(angle * 5.0 - vUv.y * 22.0 - uTime * 7.8);
    float pulseWave = sin(vUv.y * 10.0 - uTime * 6.4) * 0.5 + 0.5;
    float filament = clamp(0.62 + 0.24 * spiral1 + 0.14 * spiral2 + 0.20 * pulseWave, 0.25, 1.35);

    // Rich crimson-orange plasma gradient (controlled peak to avoid yellow/white blowout)
    vec3 deepRed = vec3(0.92, 0.08, 0.02);
    vec3 plasmaOrange = vec3(1.00, 0.34, 0.07);
    vec3 hotCore = vec3(1.00, 0.62, 0.34);

    vec3 col = mix(deepRed, plasmaOrange, clamp(radial * 0.85 + filament * 0.25, 0.0, 1.0));
    col = mix(col, hotCore, uCoreWeight * pow(ndv, 2.2) * (0.65 + 0.35 * pulseWave));

    float intensity = mix(1.18, 1.58, uCoreWeight) * filament;
    float alpha = clamp(radial * vEnvelope * mix(0.76, 0.96, uCoreWeight), 0.0, 0.98);

    gl_FragColor = vec4(col * intensity, alpha);
  }
`;

/**
 * 9) 中心攻击区：环绕等离子光束核心的半透明全息约束罩 Shader (Translucent Holographic Containment Shell)
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
    float fresnel = pow(1.0 - ndv, 2.35);

    // Fine hexagonal containment lattice
    vec2 g = fract(vec2(vUv.x * 16.0, vUv.y * 9.0)) - 0.5;
    float h = hexDist(g);
    float hexLine = smoothstep(0.42, 0.48, h);

    // Subtle holographic upward scanline
    float scan = pow(sin(vLocalPos.y * 16.0 - uTime * 2.6) * 0.5 + 0.5, 4.0);

    // Cool cyan containment field softly reflecting warm orange-red plasma near center base
    vec3 cyanShell = vec3(0.06, 0.72, 0.96);
    vec3 warmBounce = vec3(0.95, 0.28, 0.08);
    float baseBounce = smoothstep(0.55, -0.55, vLocalPos.y) * 0.35;

    vec3 col = mix(cyanShell, warmBounce, baseBounce) * (0.45 + fresnel * 1.15 + hexLine * 0.35 + scan * 0.32);
    float alpha = clamp(0.07 + fresnel * 0.38 + hexLine * 0.14 + scan * 0.10, 0.04, 0.54);

    gl_FragColor = vec4(col, alpha);
  }
`;

