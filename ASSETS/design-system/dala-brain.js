// Dala — cena 3D do cérebro de pirâmides.
// Porte da cena original de dala.craftedbygc.com: 10.000 pirâmides instanciadas,
// 4 formações (cérebro, lâmpada, esfera, "D"), cores e tamanhos por pirâmide vindos
// das texturas originais, explosão, rotação e deslocamento ligados ao progresso de rolagem
// e repulsão pelo mouse. A física de mola do original foi trocada por suavização (lerp).
import * as THREE from 'three';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
const map = (v, a, b, c, d) => (v - a) * (d - c) / (b - a) + c;
const isMobile = matchMedia('(max-width: 767px)').matches;

// Parâmetros originais
const P = {
  count: isMobile ? 7000 : 10000,
  factor: isMobile ? 2.5 : 4.35,      // raio da formação
  scale: isMobile ? 1.2 : 1.55,       // escala das pirâmides
  colorFactor: 1.3,
  amplitude: 0.619,                   // frequência do ruído de rotação
  delay: isMobile ? 2.5e-5 : 5e-4,    // atraso em cascata das transições
  easing: 0.1,                        // suavização de todos os valores
  groupY: -0.4,                       // original -1.19; calibrado para bater com o enquadramento do site
  fov: 50,
  accentHue: 25 / 360,                // roxo da textura → matiz do laranja #FF6B00 (null mantém o original)
  cameraZ: 10,
};

const vertex = /* glsl */`
precision highp float;
attribute vec3 position;
attribute vec3 aP0; attribute vec3 aP1; attribute vec3 aP2; attribute vec3 aP3;
attribute vec3 aC0; attribute vec3 aC1; attribute vec3 aC2; attribute vec3 aC3;
attribute vec4 aS; attribute vec4 aOrd; attribute float aOrdE; attribute vec4 aRnd;
uniform mat4 modelViewMatrix; uniform mat4 projectionMatrix;
uniform float uShow, uProgress, uExplode, uFactor, uTime, uScale, uLen, uDelay, uColorFactor, uAmp, uProgress2;
uniform vec2 uMouse, uDelta, uOffset, uRes, uRes2;
uniform vec3 uRotation;
varying vec3 vCol; varying float vZ;

vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}
vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1./6.,1./3.); const vec4 D=vec4(0.,.5,1.,2.);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy; i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
  float n_=.142857142857; vec3 ns=n_*D.wyz-D.xzx; vec4 j=p-49.*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.*x_); vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw); vec4 s0=floor(b0)*2.+1.; vec4 s1=floor(b1)*2.+1.; vec4 sh=-step(h,vec4(0.));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3))); p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.); m=m*m;
  return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
mat4 rot(vec3 axis, float angle){
  axis=normalize(axis); float s=sin(angle); float c=cos(angle); float oc=1.-c;
  return mat4(oc*axis.x*axis.x+c, oc*axis.x*axis.y-axis.z*s, oc*axis.z*axis.x+axis.y*s, 0.,
              oc*axis.x*axis.y+axis.z*s, oc*axis.y*axis.y+c, oc*axis.y*axis.z-axis.x*s, 0.,
              oc*axis.z*axis.x-axis.y*s, oc*axis.y*axis.z+axis.x*s, oc*axis.z*axis.z+c, 0.,
              0.,0.,0.,1.);
}
float quintic(float x){ return x<.5 ? 16.*x*x*x*x*x : 1.-pow(-2.*x+2.,5.)/2.; }
float stagger(float v, float d, float o){ return clamp(v*(1.+d*(uLen-1.)) - d*o, 0., 1.); }

void main(){
  float show = quintic(stagger(uShow, 5e-5, aOrd.x));
  float radius = mix(uFactor + aRnd.x*3., uFactor, show);
  vec3 p0=(aP0-.5)*2.*radius; vec3 p1=(aP1-.5)*2.*radius; vec3 p2=(aP2-.5)*2.*radius; vec3 p3=(aP3-.5)*2.*radius;
  vec3 pos = mix(p0, p1, stagger(uProgress, uDelay, aOrd.y));
  pos = mix(pos, p2, stagger(max(0., uProgress-1.), 5e-4, aOrd.z));
  pos = mix(pos, p3, stagger(max(0., uProgress-2.), uDelay, aOrd.w));
  pos = mix(pos, pos*aRnd.w, stagger(uExplode, 1.5e-4, aOrdE));

  mat4 R = rot(vec3(1.,0.,0.), uRotation.x) * rot(vec3(0.,1.,0.), uRotation.y) * rot(vec3(0.,0.,1.), uRotation.z);

  // repulsão do mouse
  vec4 mPos = R * vec4(pos, 1.); mPos.y -= 1.; mPos.xy += uOffset;
  vec2 res = mix(uRes*.5, uRes2*.5, clamp(uProgress2, 0., 1.));
  float dist = smoothstep(1.25 + abs(max(uDelta.x, uDelta.y)), 0., distance(mPos.xy, uMouse*res));
  float calm = abs(uExplode - 1.);
  pos.x += dist * sin(uTime*aRnd.y) * (aRnd.z*.35 + uDelta.x) * calm;
  pos.y += dist * cos(uTime*aRnd.y) * (aRnd.z*.35 + uDelta.y) * calm;

  float n = snoise(pos*uAmp);
  mat4 spin = rot(vec3(0.,1.,1.), mod(n + uTime, 6.2832));

  float sc = mix(aS.x, aS.y, uProgress);
  sc = mix(sc, aS.z, max(0., uProgress-1.));
  sc = mix(sc, aS.w, max(0., uProgress-2.));
  sc = sc*uScale + dist*.75*calm;

  vec3 v = (spin * vec4(position*.1*sc, 1.)).xyz + pos;
  vec4 mv = modelViewMatrix * (R * vec4(v, 1.));
  mv.xy += uOffset;
  vZ = mv.z + 10.;

  vec3 col = mix(aC0, aC1, uProgress);
  col = mix(col, aC2, max(0., uProgress-1.));
  col = mix(col, aC3, max(0., uProgress-2.));
  vCol = col * uColorFactor;
  gl_Position = projectionMatrix * mv;
}`;

const fragment = /* glsl */`
precision highp float;
varying vec3 vCol; varying float vZ;
void main(){ gl_FragColor = vec4(vCol, smoothstep(-4.5, 4., vZ)); }`;

async function loadImageData(url) {
  const img = new Image();
  await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = () => reject(new Error(url)); img.src = url; });
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, img.width, img.height);
}

// Troca o matiz de cores roxas/violeta (240°–320°) pelo matiz da cor principal.
const _c = new THREE.Color(), _hsl = {};
function recolor(r, g, b) {
  if (P.accentHue == null) return [r, g, b];
  _c.setRGB(r, g, b, THREE.LinearSRGBColorSpace).getHSL(_hsl, THREE.LinearSRGBColorSpace);
  const deg = _hsl.h * 360;
  if (_hsl.s > 0.15 && deg >= 240 && deg <= 320) {
    _c.setHSL(P.accentHue, _hsl.s, _hsl.l, THREE.LinearSRGBColorSpace);
    return [_c.r, _c.g, _c.b];
  }
  return [r, g, b];
}

function rankBy(values, desc) {
  const idx = values.map((v, i) => i).sort((a, b) => desc ? values[b] - values[a] : values[a] - values[b]);
  const order = new Float32Array(values.length);
  idx.forEach((i, r) => { order[i] = r; });
  return order;
}

export async function createBrain(canvas, { base = 'ASSETS/design-system/' } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, isMobile ? 2 : 1.5));
  renderer.setClearColor(0x000000, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(P.fov, 1, 0.1, 30);
  camera.position.set(0, 0, P.cameraZ);

  const exrLoader = new EXRLoader();
  exrLoader.setDataType(THREE.FloatType);
  const [exr, colors, scales, gltf] = await Promise.all([
    fetch(base + 'pos-33.exr').then(r => { if (!r.ok) throw new Error('pos-33.exr'); return r.arrayBuffer(); }).then(b => exrLoader.parse(b)),
    loadImageData(base + 'cd-33.png'),
    loadImageData(base + 'sc-33.png'),
    new GLTFLoader().loadAsync(base + (isMobile ? 'py-monbile.glb' : 'py-lod7.glb')),
  ]);

  let mesh;
  gltf.scene.traverse(o => { if (o.isMesh && !mesh) mesh = o; });
  const src = mesh.geometry;

  const N = P.count;
  const W = exr.width;
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', src.getAttribute('position'));
  if (src.index) geo.setIndex(src.index);
  geo.instanceCount = N;

  // As 4 formações ficam em quadrantes 100x100 da textura (mesma leitura do shader original).
  const quads = [[0, 0], [1, 0], [0, 1], [1, 1]];
  const P4 = quads.map(() => new Float32Array(N * 3));
  const C4 = quads.map(() => new Float32Array(N * 3));
  const S = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) {
    const row = Math.floor(i / 100), col = i % 100;
    quads.forEach(([qx, qy], q) => {
      const dx = qx * 100 + col, dy = 199 - (qy * 100 + row);       // posição: textura com flipY
      const k = (dy * W + dx) * 4;
      P4[q][i * 3] = exr.data[k]; P4[q][i * 3 + 1] = exr.data[k + 1]; P4[q][i * 3 + 2] = exr.data[k + 2];
      const iy = qy * 100 + row, ix = qx * 100 + col;                 // cor e escala: sem flipY
      const kc = (iy * colors.width + ix) * 4;
      const rgb = recolor(colors.data[kc] / 255, colors.data[kc + 1] / 255, colors.data[kc + 2] / 255);
      C4[q][i * 3] = rgb[0]; C4[q][i * 3 + 1] = rgb[1]; C4[q][i * 3 + 2] = rgb[2];
      S[i * 4 + q] = scales.data[(iy * scales.width + ix) * 4] / 255;
    });
  }

  // Ordens das cascatas, como no original
  const col = (arr, j) => Array.from({ length: N }, (_, i) => arr[i * 3 + j]);
  const ordShow = rankBy(col(P4[0], 1), true);   // aparece de cima para baixo
  const ord1 = rankBy(col(P4[1], 0), false);     // cérebro → lâmpada, da esquerda p/ direita
  const ord2 = rankBy(col(P4[2], 0), true);      // lâmpada → esfera, da direita p/ esquerda
  const ord3 = rankBy(col(P4[3], 1), true);      // esfera → D, de cima para baixo
  const ordE = rankBy(col(P4[0], 1), false);     // explosão de baixo para cima
  const ord = new Float32Array(N * 4), rnd = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) {
    ord[i * 4] = ordShow[i]; ord[i * 4 + 1] = ord1[i]; ord[i * 4 + 2] = ord2[i]; ord[i * 4 + 3] = ord3[i];
    rnd[i * 4] = i % 2 === 0 ? Math.random() : -Math.random();
    rnd[i * 4 + 1] = 0.8 * Math.random() + 0.2;
    rnd[i * 4 + 2] = isMobile ? 0.5 * Math.random() : 0.5 * Math.random() + 0.5;
    rnd[i * 4 + 3] = 1 + 5 * Math.random();
  }
  const ia = (a, n) => new THREE.InstancedBufferAttribute(a, n);
  P4.forEach((a, q) => geo.setAttribute('aP' + q, ia(a, 3)));
  C4.forEach((a, q) => geo.setAttribute('aC' + q, ia(a, 3)));
  geo.setAttribute('aS', ia(S, 4));
  geo.setAttribute('aOrd', ia(ord, 4));
  geo.setAttribute('aOrdE', ia(ordE, 1));
  geo.setAttribute('aRnd', ia(rnd, 4));

  const U = {
    uShow: { value: 0 }, uProgress: { value: 0 }, uExplode: { value: 0 }, uFactor: { value: P.factor },
    uTime: { value: 0 }, uScale: { value: P.scale }, uLen: { value: N }, uDelay: { value: P.delay },
    uColorFactor: { value: P.colorFactor }, uAmp: { value: P.amplitude }, uProgress2: { value: 0 },
    uMouse: { value: new THREE.Vector2() }, uDelta: { value: new THREE.Vector2() },
    uOffset: { value: new THREE.Vector2(isMobile ? 1.5 : 3, isMobile ? 2 : 0) },
    uRes: { value: new THREE.Vector2() }, uRes2: { value: new THREE.Vector2() },
    uRotation: { value: new THREE.Vector3() },
  };
  const material = new THREE.RawShaderMaterial({ vertexShader: vertex, fragmentShader: fragment, uniforms: U, transparent: true });
  const brain = new THREE.Mesh(geo, material);
  brain.frustumCulled = false;
  const group = new THREE.Group();
  group.position.y = P.groupY;
  group.rotation.y = -0.25 * Math.PI;
  group.add(brain);
  scene.add(group);

  // Pirâmides soltas na frente da câmera (250 no original)
  const frontColors = ['#B8500F', '#BA882B', '#287464', '#C9A58C'].map(c => new THREE.Color(c));
  const front = new THREE.InstancedMesh(src.clone(), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.85 }), 250);
  const fData = [];
  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), v3 = new THREE.Vector3(), s3 = new THREE.Vector3(), e3 = new THREE.Euler();
  for (let i = 0; i < 250; i++) {
    fData.push({ x: Math.random() * 2 - 1, y: Math.random() * 2 - 1, z: Math.random() * 9, s: isMobile ? 0.075 : 0.05, r: [Math.random() * 6, Math.random() * 6, Math.random() * 6], sp: 0.2 + Math.random() * 0.4 });
    front.setColorAt(i, frontColors[i % 4]);
  }
  scene.add(front);

  // Estado
  let progress = 0, active = false, visible = true;
  const mouse = { x: 0, y: 0, px: 0, py: 0, dx: 0, dy: 0 };
  const plane = (d) => { const h = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * d; return new THREE.Vector2(h * camera.aspect, h); };

  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    U.uRes.value.copy(plane(10)); U.uRes2.value.copy(plane(6.5));
  }
  resize();
  addEventListener('resize', resize);

  function onMove(e) {
    const t = e.touches ? e.touches[0] : e; if (!t) return;
    mouse.x = 2 * (t.clientX / innerWidth - 0.5); mouse.y = -2 * (t.clientY / innerHeight - 0.5);
    const lim = isMobile ? 0.1 : 2;
    mouse.dx = clamp(50 * (mouse.x - mouse.px), -lim, lim); mouse.dy = clamp(50 * (mouse.y - mouse.py), -lim, lim);
    mouse.px = mouse.x; mouse.py = mouse.y;
  }
  addEventListener('pointermove', onMove, { passive: true });
  addEventListener('touchmove', onMove, { passive: true });

  // Coreografia por progresso de seção (valores do site original)
  function targets(e) {
    if (isMobile) {
      return {
        rotY: clamp(map(e, 0, 1, 0, -Math.PI / 2), -Math.PI / 2, 0) + clamp(map(e, 2.7, 3, 0, Math.PI / 2), 0, Math.PI / 2) + clamp(map(e, 3.3, 3.5, 0, Math.PI / 4), 0, Math.PI / 4) - clamp(map(e, 4.5, 5, 0, 1.25 * Math.PI), 0, 1.25 * Math.PI) + clamp(map(e, 5.7, 5.8, 0, Math.PI), 0, Math.PI),
        rotZ: clamp(map(e, 2.7, 3, 0, -0.489), -0.489, 0) + clamp(map(e, 3.3, 3.5, 0, 0.6), 0, 0.6),
        x: clamp(map(e, 0, 1, 1.5, 0), 0, 1.5) + 0.052 * U.uMouse.value.x,
        y: 2,
        explode: clamp(map(e, 1.4, 1.7, 0, 1), 0, 1) - clamp(map(e, 2.7, 3, 0, 1), 0, 1) + clamp(map(e, 4.5, 5, 0, 1), 0, 1) - clamp(map(e, 5.7, 5.8, 0, 1), 0, 1),
        progress: clamp(map(e, 2.7, 3, 0, 1), 0, 1) + clamp(map(e, 3.3, 3.5, 0, 1), 0, 1) + clamp(map(e, 5.7, 5.8, 0, 1), 0, 1),
        factor: P.factor,
        progress2: 0,
      };
    }
    return {
      rotY: clamp(map(e, 0, 1, 0, -Math.PI / 2), -Math.PI / 2, 0) + clamp(map(e, 2.7, 3, 0, Math.PI / 2), 0, Math.PI / 2) + clamp(map(e, 3.3, 3.5, 0, Math.PI / 4), 0, Math.PI / 4) - clamp(map(e, 4.5, 5, 0, 1.25 * Math.PI), 0, 1.25 * Math.PI) + clamp(map(e, 5.7, 6, 0, Math.PI), 0, Math.PI),
      rotZ: clamp(map(e, 2.7, 3, 0, -0.489), -0.489, 0) + clamp(map(e, 3.3, 3.5, 0, 0.6), 0, 0.6),
      x: clamp(map(e, 0, 1, 3, -4.5), -4.5, 3) + clamp(map(e, 1.25, 1.5, 0.905, 5), 0.905, 5) - clamp(map(e, 2.8, 3, 0.905, 3), 0.905, 3) + clamp(map(e, 3.3, 3.5, 0.905, 6), 0.905, 6) - clamp(map(e, 4.5, 5, 0.905, 5), 0.905, 4),
      y: clamp(map(e, 2.7, 3, 0, 0.5), 0, 0.5) - clamp(map(e, 3.3, 3.5, 0, 0.5), 0, 0.5) + clamp(map(e, 5.7, 6, 0, 1.75), 0, 1.75),
      explode: clamp(map(e, 1.1, 2.2, 0, 1), 0, 1) - clamp(map(e, 2.8, 3, 0, 1), 0, 1) + clamp(map(e, 4.5, 5, 0, 1), 0, 1) - clamp(map(e, 5.7, 6, 0, 1), 0, 1),
      factor: P.factor + clamp(map(e, 0, 1, 0, 1), 0, 1) - clamp(map(e, 1.25, 1.5, 0, 1), 0, 1) + clamp(map(e, 3.3, 3.5, 0, 0.3), 0, 0.3) - clamp(map(e, 5.7, 6, 0, 1), 0, 1),
      progress: clamp(map(e, 2.7, 3, 0, 1), 0, 1) + clamp(map(e, 3.3, 3.5, 0, 1), 0, 1) + clamp(map(e, 5.7, 6, 0, 1), 0, 1),
      progress2: clamp(map(e, 0, 1, 0, 1), 0, 1) - clamp(map(e, 2.7, 3, 0, 1), 0, 1) + clamp(map(e, 3, 3.5, 0, 1), 0, 1) - clamp(map(e, 5.5, 5.5001, 0, 1), 0, 1),
    };
  }

  const clock = new THREE.Clock();
  let raf = 0;
  function frame() {
    raf = requestAnimationFrame(frame);
    if (!visible) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    const k = P.easing * Math.min(dt * 60, 3);
    U.uTime.value += dt;

    const t = targets(progress);
    U.uRotation.value.y += (t.rotY - U.uRotation.value.y) * 0.75 * k;
    U.uRotation.value.z += (t.rotZ - U.uRotation.value.z) * 0.75 * k;
    U.uRotation.value.x += (0 - U.uRotation.value.x) * 0.75 * k;
    U.uOffset.value.x += (t.x - U.uOffset.value.x) * k;
    U.uOffset.value.y += (t.y - U.uOffset.value.y) * k;
    U.uExplode.value += (t.explode - U.uExplode.value) * k;
    U.uFactor.value += (t.factor - U.uFactor.value) * k;
    U.uProgress.value += (t.progress - U.uProgress.value) * k;
    U.uProgress2.value += (t.progress2 - U.uProgress2.value) * k;

    mouse.dx += (0 - mouse.dx) * k; mouse.dy += (0 - mouse.dy) * k;
    U.uMouse.value.x += (mouse.x - U.uMouse.value.x) * 0.75 * k;
    U.uMouse.value.y += (mouse.y - U.uMouse.value.y) * 0.75 * k;
    U.uDelta.value.x += (mouse.dx - U.uDelta.value.x) * 0.75 * k;
    U.uDelta.value.y += (mouse.dy - U.uDelta.value.y) * 0.75 * k;

    // câmera acompanha o mouse
    camera.rotation.y += 0.1 * (-0.075 * mouse.x - camera.rotation.y);
    camera.rotation.x += 0.1 * (0.05 * mouse.y - camera.rotation.x);

    const time = U.uTime.value;
    fData.forEach((f, i) => {
      v3.set(f.x * (1 + f.z * 0.3), f.y * (1 + f.z * 0.2) + Math.sin(time * f.sp + i) * 0.05, f.z);
      e3.set(f.r[0] + time * f.sp, f.r[1] + time * f.sp * 0.7, f.r[2]);
      q4.setFromEuler(e3); s3.setScalar(f.s);
      m4.compose(v3, q4, s3); front.setMatrixAt(i, m4);
    });
    front.instanceMatrix.needsUpdate = true;

    renderer.render(scene, camera);
  }
  frame();

  return {
    // anima a entrada (u_show 0→1 em 3s linear; rotação base -0.25π→0 em 3s power2.out)
    activate(gsap) {
      if (active) return; active = true;
      if (gsap) {
        gsap.to(U.uShow, { value: 1, duration: 3, ease: 'none' });
        gsap.to(group.rotation, { y: 0, duration: 3, ease: 'power2.out' });
      } else { U.uShow.value = 1; group.rotation.y = 0; }
    },
    setProgress(p) { progress = p; },
    setVisible(v) { visible = v; if (v) clock.getDelta(); },
    uniforms: U,
    params: P,
    destroy() { cancelAnimationFrame(raf); renderer.dispose(); },
  };
}
