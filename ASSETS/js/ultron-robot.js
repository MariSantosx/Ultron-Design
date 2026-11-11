// Ultron — robô futurista 3D (procedural, three.js).
// Capacete cromado de viseira cheia (sem rosto), pescoço segmentado, ombreiras e peitoral
// mecânicos. Todas as luzes usam o laranja da marca (#FF6B00).
// API: activate(gsap), setProgress(), setVisible(), destroy().
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createIcons } from './ultron-icons.js';

const ACCENT = 0xFF6B00;
const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
const isMobile = matchMedia('(max-width: 767px)').matches;

export async function createRobot(canvas) {
  const photo = new Image();                         // recorte da foto de referência (fundo removido)
  await new Promise((ok, fail) => { photo.onload = ok; photo.onerror = () => fail(new Error('robot-photo.png')); photo.src = 'ASSETS/img/robo/robot-front.png'; });
  const depthImg = new Image();                      // relevo falso do robô (só para a paralaxe do olhar)
  await new Promise((ok) => { depthImg.onload = ok; depthImg.onerror = ok; depthImg.src = 'ASSETS/img/robo/robot-front-depth.png'; });
  const headMaskImg = new Image();                   // contorno do capacete: dentro dele a cabeça é um volume 3D que gira de verdade
  await new Promise((ok) => { headMaskImg.onload = ok; headMaskImg.onerror = ok; headMaskImg.src = 'ASSETS/img/robo/robot-head-mask.png'; });
  const devImg = new Image();                        // foto do dispositivo de vidro em camadas (dobra 2), com o fundo removido
  await new Promise((ok, fail) => { devImg.onload = ok; devImg.onerror = () => fail(new Error('ASSETS/img/dobra-2/device.png')); devImg.src = 'ASSETS/img/dobra-2/device.png'; });
  const devDepthImg = new Image();
  await new Promise((ok) => { devDepthImg.onload = ok; devDepthImg.onerror = ok; devDepthImg.src = 'ASSETS/img/dobra-2/device-depth.png'; });
  const luSrc = [1, 2, 3, 4].map(i => 'ASSETS/img/dobra-3/lineup-' + i + '.png');            // os quatro objetos da dobra 3 (imagens com fundo transparente)
  const luImgs = await Promise.all(luSrc.map(src => new Promise((ok, fail) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => fail(new Error(src)); im.src = src; })));
  const luDeps = await Promise.all(luSrc.map(src => new Promise((ok) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => ok(im); im.src = src.replace('.png', '-depth.png'); })));
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, isMobile ? 2 : 1.5));
  renderer.setClearColor(0x000000, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0;

  const scene = new THREE.Scene();

  // Fundo contínuo da página inteira (o site todo é uma cena só, como no site de referência):
  // degradê âmbar na primeira dobra que escurece e desliza para a direita conforme a rolagem.
  const bgMat = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false,
    uniforms: {
      uP: { value: 0 }, uHero: { value: 1 }, uT: { value: 0 }, uS: { value: 0 }, uRes: { value: new THREE.Vector2(innerWidth, innerHeight) },
      c0: { value: new THREE.Color('#f6a043') }, c1: { value: new THREE.Color('#e4781f') }, c2: { value: new THREE.Color('#a24a0f') },
      c3: { value: new THREE.Color('#4a1c06') }, c4: { value: new THREE.Color('#1b0a03') },
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv = position.xy * .5 + .5; gl_Position = vec4(position.xy, .9999, 1.); }`,
    fragmentShader: `
      varying vec2 vUv; uniform float uP; uniform float uHero; uniform float uT; uniform float uS; uniform vec2 uRes;
      uniform vec3 c0; uniform vec3 c1; uniform vec3 c2; uniform vec3 c3; uniform vec3 c4;
      // fundos "Midnight Amber": azul-marinho profundo + âmbar quente, sem borda, com grão. Seis composições que se
      // misturam sem emenda conforme a página desce (e voltam ao começo: o fundo é infinito).
      float wob(vec2 p){
        float v = 0., a = .5;
        for (int i = 0; i < 3; i++) {
          v += a * sin(p.x * 1.6 + sin(p.y * 1.3 + uT * .15) * 1.3 + float(i) * 1.7) * sin(p.y * 1.8 + cos(p.x * 1.1 - uT * .12) * 1.2 + float(i));
          p *= 1.9; a *= .5;
        }
        return v;
      }
      float blob(vec2 p, vec2 c, vec2 r, float ang){
        vec2 q = p - c; float cs = cos(ang), sn = sin(ang);
        q = vec2(cs * q.x + sn * q.y, -sn * q.x + cs * q.y);
        float d = clamp(length(q / r), 0., 1.);
        d = 1. - d; return d * d * (3. - 2. * d);
      }
      vec3 paint(float a, float b, float dark){
        vec3 navy = vec3(.004, .003, .0025), blue = vec3(.22, .05, .008), amber = vec3(1., .36, .035), pale = vec3(1., .72, .34);
        vec3 col = mix(navy, blue, clamp(b, 0., 1.));
        col = mix(col, amber, smoothstep(.0, .75, a));
        col = mix(col, pale, pow(clamp(a, 0., 1.), 3.2) * .28);
        return col * mix(1., .0, clamp(dark, 0., 1.)) + navy * clamp(dark, 0., 1.) * .0;
      }
      vec3 scene(int k, vec2 p){
        vec2 w = p + .07 * vec2(wob(p * 1.2 + uT * .05), wob(p * 1.2 + 4.1 - uT * .04));
        float a = 0., b = 0., dk = 0.;
        if (k == 0) {                                   // brilho âmbar no canto inferior esquerdo, azul se abrindo
          a = blob(w, vec2(-.62, -.4), vec2(.8, .42), .5) * 1.05;
          b = blob(w, vec2(.1, -.42), vec2(.95, .42), 0.) * .9 + blob(w, vec2(.7, .25), vec2(.6, .5), 0.) * .25;
        } else if (k == 1) {                            // faixa ondulada de âmbar sobre fundo escuro
          float d = abs(w.y - (.2 + .13 * sin(w.x * 2.3 + uT * .2)));
          a = smoothstep(.3, .0, d) * smoothstep(-.9, -.1, w.x + .6 + w.y * .5) * 1.0;
          b = blob(w, vec2(.7, .22), vec2(.75, .5), 0.) * .9;
          dk = smoothstep(.02, -.3, w.y - (.18 + .13 * sin(w.x * 2.3 + uT * .2))) * .25;
        } else if (k == 2) {                            // eclipse: círculo escuro com aro de luz
          vec2 ce = vec2(.18, -.08); float r = .34, dist = length(w - ce);
          float face = dot(normalize(w - ce + 1e-4), normalize(vec2(-.75, .66))) * .5 + .5;
          a = smoothstep(r + .5, r - .02, dist) * pow(face, 1.7) * 1.15;
          b = smoothstep(r + .75, r, dist) * (1. - face * .6) * .95;
          dk = smoothstep(r + .03, r - .06, dist);
        } else if (k == 3) {                            // azul à esquerda, âmbar à direita
          a = smoothstep(-.15, .85, w.x * .95 + .05 * wob(w * 2.)) * smoothstep(-.55, .25, w.y + .3) * .95;
          b = smoothstep(.55, -.45, w.x) * .95;
          dk = smoothstep(.1, .55, -w.y - w.x * .3) * .75;
        } else if (k == 4) {                            // triângulo de luz entrando pela direita
          a = blob(w, vec2(.6, -.22), vec2(.62, .26), -.35) * 1.05;
          b = blob(w, vec2(-.05, .22), vec2(.95, .55), 0.) * .8 + blob(w, vec2(-.6, -.3), vec2(.7, .5), 0.) * .3;
        } else {                                        // curva escura embaixo à direita, âmbar em cima, azul à esquerda
          vec2 ce = vec2(.55, -.45); float r = .62, dist = length(w - ce);
          a = blob(w, vec2(-.35, .45), vec2(.85, .4), -.4) * 1.05;
          b = blob(w, vec2(-.5, -.4), vec2(.7, .5), 0.) * .95;
          dk = smoothstep(r + .05, r - .1, dist) * .9;
        }
        return paint(a, b, dk);
      }
      float hsh(float n){ return fract(sin(n * 127.1) * 43758.5453); }
      void main(){
        float asp = uRes.x / uRes.y;
        vec2 p = vec2((vUv.x - .5) * asp, vUv.y - .5);
        // cada dobra mostra um fundo diferente; entre uma e outra eles se completam (mistura suave). Dá a volta (infinito).
        float ph = max(uS, 0.) * .62;
        float fl = floor(ph), fr = ph - fl; fr = fr * fr * (3. - 2. * fr);
        int k0 = int(mod(fl, 6.)), k1 = int(mod(fl + 1., 6.));
        vec3 col = mix(scene(k0, p), scene(k1, p), fr);
        col *= .8 + .2 * smoothstep(-.8, .2, p.x);
        float hz = 1.;                                              // todas as dobras têm o mesmo fundo escuro da dobra 1 (os feixes laranja continuam subindo)
        col *= 1. - .985 * hz;
        float gt1 = smoothstep(.7, 1.5, uS), gt2 = smoothstep(2.3, 3.2, uS);      // o brilho suave acompanha o elemento de cada dobra
        vec2 gc = mix(mix(vec2(.25 * asp, .1), vec2(-.21 * asp, 0.), gt1), vec2(0., 0.), gt2);
        col += vec3(.15, .045, .006) * hz * (1. - gt1) * smoothstep(.62, .0, length(p - gc));
        // feixes de luz laranja subindo, atrás de tudo
        float bn = 20., bid = floor(vUv.x * bn), h1 = hsh(bid), h2 = hsh(bid + 7.3);
        float bfx = fract(vUv.x * bn) - .5;
        float bcore = smoothstep(.05 + .1 * h1, .0, abs(bfx));
        float byy = vUv.y * (.8 + h1) - uT * (.05 + .1 * h2) - h2 * 9.;
        float bpulse = pow(.5 + .5 * sin(byy * 6.2832), 3.);
        col += vec3(1., .33, .04) * bcore * bpulse * pow(1. - vUv.y, 1.2) * (.07 + .22 * h1 * h2) * 0.;        // escurece um pouco a coluna do texto, à esquerda, para a leitura
        // véu de grão fino, como nas imagens de referência
        float gr = fract(sin(dot(gl_FragCoord.xy + uT * 7., vec2(12.9898, 78.233))) * 43758.5453) - .5;
        col += gr * .035 * (.25 + col.r + col.b);
        col += vec3(.004, .0035, .0035);                                  // preto levemente azulado, como o fundo do site de referência
        gl_FragColor = vec4(max(col, 0.), 1.);
      }`,
  });
  const bgQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMat);
  bgQuad.frustumCulled = false; bgQuad.renderOrder = -1000;
  scene.add(bgQuad);
  /* ---------- fundo do site de referência: partículas brilhantes + anéis em aramado, que giram com a rolagem e o mouse ---------- */
  const EK = 0.14;                                    // escala da cena de referência (câmera 60°/z=30) para a nossa (30°/z=9)
  const ember = new THREE.Group(); ember.scale.setScalar(EK); scene.add(ember);
  const spr = document.createElement('canvas'); spr.width = spr.height = 64;
  { const g = spr.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.65)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }
  const EN = isMobile ? 150 : 280, ePos = new Float32Array(EN * 3), eCol = new Float32Array(EN * 3);
  const cA = new THREE.Color('#ff4d2d'), cB = new THREE.Color('#ff9900'), cC = new THREE.Color('#8a1a06');
  for (let i = 0; i < EN; i++) {
    ePos[i * 3] = (Math.random() - 0.5) * 80; ePos[i * 3 + 1] = (Math.random() - 0.5) * 80; ePos[i * 3 + 2] = (Math.random() - 0.5) * 60;
    const c = cA.clone().lerp(Math.random() > 0.5 ? cB : cC, Math.random()); eCol.set([c.r, c.g, c.b], i * 3);
  }
  const eGeo = new THREE.BufferGeometry();
  eGeo.setAttribute('position', new THREE.BufferAttribute(ePos, 3)); eGeo.setAttribute('color', new THREE.BufferAttribute(eCol, 3));
  const emberPts = new THREE.Points(eGeo, new THREE.PointsMaterial({ size: 1.15 * EK * 1.1, map: new THREE.CanvasTexture(spr), vertexColors: true, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  emberPts.renderOrder = -9;                          // sempre desenhadas antes do robô: ficam atrás dele
  ember.add(emberPts);
  // linhas de luz verticais, finas e discretas, que sobem devagar (no lugar dos anéis)
  const streakGeo = new THREE.PlaneGeometry(1, 1);
  const streaks = [];
  const SN = isMobile ? 9 : 16;
  for (let i = 0; i < SN; i++) {
    const warm = i % 7 === 3;
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      uniforms: { uC: { value: new THREE.Color(warm ? 0x8a3a10 : 0x2a3f8c) }, uA: { value: warm ? 0.1 : 0.14 + Math.random() * 0.08 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: 'varying vec2 vUv; uniform vec3 uC; uniform float uA; void main(){ float f = sin(3.14159 * vUv.y); float e = 1. - abs(vUv.x - .5) * 2.; gl_FragColor = vec4(uC, pow(f, 1.6) * pow(e, 1.5) * uA); }',
    });
    const mesh = new THREE.Mesh(streakGeo, m); mesh.renderOrder = -9;
    const len = 22 + Math.random() * 40, w = 0.1 + Math.random() * 0.14;
    mesh.scale.set(w, len, 1);
    streaks.push({ mesh, x: (Math.random() - 0.5) * 90, y0: Math.random() * 100, z: -8 - Math.random() * 26, sp: 0.5 + Math.random() * 1.4, par: 0.004 + Math.random() * 0.006 });
    ember.add(mesh);
  }
  const em = { ox: 0, oy: 0, tx: 0, ty: 0, B: scrollY };
  addEventListener('pointermove', (e) => { em.tx = (e.clientX - innerWidth / 2) * 0.02; em.ty = (e.clientY - innerHeight / 2) * 0.02; }, { passive: true });
  function emberUpdate(t) {
    em.ox += (em.tx - em.ox) * 0.05; em.oy += (em.ty - em.oy) * 0.05; em.B += (scrollY - em.B) * 0.08;
    const B = em.B;
    emberPts.rotation.y = t * 0.04 + em.ox * 0.1 + B * 1.5e-4; emberPts.rotation.x = em.oy * 0.1 + Math.sin(B * 5e-4) * 0.35; emberPts.position.y = Math.sin(B * 9e-4) * 9;
    for (const k of streaks) { const span = 120; k.mesh.position.set(k.x, ((k.y0 + t * k.sp + B * k.par * 0.3) % span + span) % span - span / 2, k.z); }
  }
  scene.fog = new THREE.Fog(0x1b0a03, 9, 26);        // as peças que se afastam escurecem (profundidade)

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
  camera.position.set(0, -0.15, 9);

  /* ---------- ambiente: painéis de luz que viram os reflexos no cromado ---------- */
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x000000);
  const panel = (w, h, color, k, pos) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide, toneMapped: false }));
    m.position.set(...pos); m.lookAt(0, 0, 0); envScene.add(m);
  };
  panel(7, 1.8, 0xffffff, 2.8, [-4, 5, 3]);        // softbox branco, topo esquerdo
  panel(5, 7, 0xffffff, 1.0, [-6, 0.5, 4.5]);      // preenchimento cinza, esquerda
  panel(2.2, 7, 0xffffff, 1.5, [6, 0.5, 3.5]);     // faixa branca, direita
  panel(5, 0.5, 0xffffff, 1.8, [3, 6, 2]);         // faixa branca fina, topo
  panel(7, 5, 0xffffff, 0.9, [1, 1, 9]);           // preenchimento neutro, frente
  panel(6, 4.5, ACCENT, 2.2, [-5, -2.5, 3.5]);     // laranja, embaixo à esquerda
  panel(1.6, 7, ACCENT, 4.2, [5.5, 0.5, -2.5]);    // laranja de contraluz, direita
  panel(6, 2, ACCENT, 0.9, [0, -5.5, 2.5]);        // laranja, chão
  panel(8, 1, 0xffffff, 1.4, [0, 3, -6]);          // contraluz de cima
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(envScene, 0.03).texture;
  pmrem.dispose();

  /* ---------- materiais ---------- */
  const chrome = new THREE.MeshPhysicalMaterial({ color: 0x08090c, metalness: 0.55, roughness: 0.13, clearcoat: 1, clearcoatRoughness: 0.025, envMapIntensity: 2.3 });   // preto de verniz, com reflexos brancos e laranja
  const darkMetal = new THREE.MeshPhysicalMaterial({ color: 0x050506, metalness: 0.8, roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.15, envMapIntensity: 1.3 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x000000, metalness: 0.2, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02, side: THREE.DoubleSide, envMapIntensity: 1.6 });
  const glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(ACCENT).multiplyScalar(2.4), toneMapped: false });
  const glowSoft = new THREE.MeshBasicMaterial({ color: new THREE.Color(ACCENT).multiplyScalar(1.1), toneMapped: false });

  /* ---------- capacete ---------- */
  const SX = 0.92, SZ = 1.05;
  const prof = [[0, -1.2], [0.26, -1.16], [0.5, -1.02], [0.68, -0.72], [0.78, -0.3], [0.82, 0.15], [0.78, 0.6], [0.62, 0.9], [0.34, 1.08], [0, 1.14]];
  const hp = new THREE.SplineCurve(prof.map(([r, y]) => new THREE.Vector2(r, y))).getPoints(100);
  const rAt = (y) => {
    for (let i = 1; i < hp.length; i++) {
      const a = hp[i - 1], b = hp[i];
      if (a.y <= y && y <= b.y) return a.x + (b.x - a.x) * ((y - a.y) / ((b.y - a.y) || 1));
    }
    return 0;
  };

  const root = new THREE.Group();
  scene.add(root);
  const headPivot = new THREE.Group();         // gira no pescoço
  headPivot.position.set(0, -0.35, 0);
  root.add(headPivot);
  const face = new THREE.Group();
  face.position.set(0, 0.35, 0);
  headPivot.add(face);

  const shell = new THREE.Mesh(new THREE.LatheGeometry(hp, 128), chrome);
  shell.scale.set(SX, 1, SZ);
  face.add(shell);

  // viseira cheia: vidro preto em formato de olho de gato, cobrindo todo o rosto
  const A = 1.2, yc = 0.02, hh = 0.56;
  const shape = (u) => Math.pow(Math.max(0, 1 - Math.pow(Math.abs(u), 4)), 0.5);
  const vyB = (th) => yc - hh * 0.95 * shape(th / A);
  const vyT = (th) => yc + hh * 1.05 * shape(th / A);
  const vPoint = (th, y, off) => {
    const r = rAt(y) + off;
    return new THREE.Vector3(Math.sin(th) * r * SX, y, Math.cos(th) * r * SZ);
  };
  const VN = 96, VM = 28, vPos = [], vIdx = [];
  for (let j = 0; j <= VM; j++) for (let i = 0; i <= VN; i++) {
    const th = -A + 2 * A * i / VN, b = vyB(th), t = vyT(th);
    const y = b + (t - b) * (j / VM);
    const bulge = 0.035 + 0.025 * shape(th / A);
    const p = vPoint(th, y, bulge); vPos.push(p.x, p.y, p.z);
  }
  for (let j = 0; j < VM; j++) for (let i = 0; i < VN; i++) {
    const a = j * (VN + 1) + i, b = a + 1, c = a + VN + 1, d = c + 1;
    vIdx.push(a, b, c, b, d, c);
  }
  const vGeo = new THREE.BufferGeometry();
  vGeo.setAttribute('position', new THREE.Float32BufferAttribute(vPos, 3));
  vGeo.setIndex(vIdx); vGeo.computeVertexNormals();
  face.add(new THREE.Mesh(vGeo, glass));

  // moldura da viseira em metal escuro
  const rim = [];
  for (let i = 0; i <= 120; i++) { const th = -A + 2 * A * i / 120; rim.push(vPoint(th, vyB(th), 0.06)); }
  for (let i = 120; i >= 0; i--) { const th = -A + 2 * A * i / 120; rim.push(vPoint(th, vyT(th), 0.06)); }
  face.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rim, true), 400, 0.03, 8, true), darkMetal));

  // contorno inferior fino
  const under = [];
  for (let i = 0; i <= 100; i++) { const th = -A * 0.92 + 2 * A * 0.92 * i / 100; under.push(vPoint(th, vyB(th) + 0.02, 0.07)); }
  face.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(under), 200, 0.008, 6), glowSoft));

  // "ULTRON" escrito no vidro da viseira, curvado junto com ela, no meio (onde ficava a fenda de luz)
  const nameCv = document.createElement('canvas'); nameCv.width = 1024; nameCv.height = 200;
  const nameTex = new THREE.CanvasTexture(nameCv); nameTex.colorSpace = THREE.SRGBColorSpace; nameTex.anisotropy = 4;
  function drawName() {
    const g = nameCv.getContext('2d');
    g.clearRect(0, 0, 1024, 200);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '600 120px PPNeueMontreal, system-ui, sans-serif';
    if ('letterSpacing' in g) g.letterSpacing = '30px';
    g.shadowColor = 'rgba(255,107,0,0.95)'; g.shadowBlur = 30; g.fillStyle = '#FFE1CC'; g.fillText('ULTRON', 512, 108);
    g.shadowBlur = 0; g.fillText('ULTRON', 512, 108);
    nameTex.needsUpdate = true;
  }
  drawName();
  if (document.fonts && document.fonts.load) document.fonts.load('600 120px PPNeueMontreal').then(drawName).catch(() => {});
  {
    const TA = 0.8, ty0 = 0.0, ty1 = 0.22, TN = 56, pos = [], uv = [], idx = [];
    for (let i = 0; i <= TN; i++) for (let j = 0; j <= 1; j++) {
      const th = -TA + 2 * TA * i / TN, y = ty0 + (ty1 - ty0) * j, p = vPoint(th, y, 0.085);
      pos.push(p.x, p.y, p.z); uv.push(i / TN, j);
    }
    for (let i = 0; i < TN; i++) { const a = i * 2, b = a + 1, c = a + 2, d = a + 3; idx.push(a, c, b, b, c, d); }
    const nameGeo = new THREE.BufferGeometry();
    nameGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    nameGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    nameGeo.setIndex(idx);
    const nameMesh = new THREE.Mesh(nameGeo, new THREE.MeshBasicMaterial({ map: nameTex, transparent: true, toneMapped: false, depthWrite: false, side: THREE.DoubleSide }));
    nameMesh.renderOrder = 5;
    face.add(nameMesh);
  }

  // pods laterais com anel de luz
  [-1, 1].forEach(s => {
    const x = s * (rAt(0.0) * SX + 0.02);
    const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.14, 56), chrome);
    pod.rotation.z = Math.PI / 2; pod.position.set(x, -0.02, -0.05); face.add(pod);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.014, 12, 64), glowMat);
    ring.rotation.y = Math.PI / 2; ring.position.set(x + s * 0.075, -0.02, -0.05); face.add(ring);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.02, 40), darkMetal);
    cap.rotation.z = Math.PI / 2; cap.position.set(x + s * 0.075, -0.02, -0.05); face.add(cap);
  });

  // marca Ultron (quatro quadrados) no queixo do capacete
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const cx = cv.getContext('2d');
  cx.fillStyle = '#050505'; cx.fillRect(0, 0, 128, 128);
  cx.fillStyle = '#FF6B00';
  [[23, 4], [42, 23], [23, 42], [4, 23]].forEach(([x, y]) => cx.fillRect(x / 52 * 128 + 4, y / 52 * 128 + 4, 20, 20));
  const logoTex = new THREE.CanvasTexture(cv); logoTex.colorSpace = THREE.SRGBColorSpace;
  const ly = -0.78, lr = rAt(ly) * SZ + 0.012;
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16), new THREE.MeshBasicMaterial({ map: logoTex, toneMapped: false }));
  logo.position.set(0, ly, lr); logo.rotation.x = 0.3; face.add(logo);

  // luz de preenchimento laranja
  const fill = new THREE.PointLight(ACCENT, 4, 7, 2);
  fill.position.set(-1.2, -1.4, 1.8); face.add(fill);

  /* ---------- pescoço segmentado ---------- */
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.9, 32), glowSoft);
  core.position.y = -1.3; root.add(core);
  for (let k = 0; k < 4; k++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.075, 20, 64), k % 2 ? darkMetal : chrome);
    ring.rotation.x = Math.PI / 2; ring.position.y = -1.08 - k * 0.15; ring.scale.set(1, 1, 1.2); root.add(ring);
  }

  /* ---------- peitoral, ombreiras e colar ---------- */
  const chestPts = new THREE.SplineCurve([[0, -1.65], [0.5, -1.7], [0.85, -1.85], [1.12, -2.2], [1.2, -2.9], [1.1, -4.4]].map(([r, y]) => new THREE.Vector2(r, y))).getPoints(60);
  chestPts.push(new THREE.Vector2(0, -4.4));
  const chest = new THREE.Mesh(new THREE.LatheGeometry(chestPts, 96), chrome);
  chest.scale.set(1, 1, 0.5); root.add(chest);

  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.07, 24, 96), darkMetal);
  collar.rotation.x = Math.PI / 2; collar.position.y = -1.68; root.add(collar);
  const collarGlow = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.012, 12, 96), glowMat);
  collarGlow.rotation.x = Math.PI / 2; collarGlow.position.y = -1.745; root.add(collarGlow);

  [-1, 1].forEach(s => {
    const p = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 40), chrome);
    p.scale.set(0.58, 0.4, 0.58); p.position.set(s * 1.12, -2.0, 0); p.rotation.z = s * -0.35; root.add(p);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.012, 12, 80), glowMat);
    band.position.set(s * 1.12, -2.0, 0); band.rotation.set(Math.PI / 2 - 0.1, 0, s * -0.35); band.scale.set(1.25, 1, 1.0); root.add(band);
  });

  // braços: braço superior, cotovelo e antebraço, com anéis de luz
  [-1, 1].forEach(s => {
    const arm = new THREE.Group();
    arm.position.set(s * 1.4, -2.08, 0.02); arm.rotation.z = s * 0.1; root.add(arm);
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.27, 0.95, 16, 40), chrome);
    upper.position.y = -0.72; arm.add(upper);
    const ringG = new THREE.Mesh(new THREE.TorusGeometry(0.285, 0.014, 12, 64), glowMat);
    ringG.rotation.x = Math.PI / 2; ringG.position.y = -0.55; arm.add(ringG);
    const ringD = new THREE.Mesh(new THREE.TorusGeometry(0.285, 0.05, 16, 64), darkMetal);
    ringD.rotation.x = Math.PI / 2; ringD.position.y = -0.8; arm.add(ringD);
    const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.31, 40, 28), darkMetal);
    elbow.position.y = -1.32; arm.add(elbow);
    const elbowRing = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.011, 12, 48), glowMat);
    elbowRing.rotation.y = Math.PI / 2; elbowRing.position.set(s * 0.315, -1.32, 0); arm.add(elbowRing);
    const fore = new THREE.Group(); fore.position.y = -1.32; fore.rotation.set(-0.35, 0, s * -0.12); arm.add(fore);
    const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 1.0, 16, 36), chrome);
    forearm.position.y = -0.75; fore.add(forearm);
    const foreRing = new THREE.Mesh(new THREE.TorusGeometry(0.235, 0.012, 12, 64), glowMat);
    foreRing.rotation.x = Math.PI / 2; foreRing.position.y = -0.45; fore.add(foreRing);
  });

  // grade de luz no peitoral
  [[0.34, -2.62], [0.5, -2.78], [0.34, -2.94]].forEach(([w, y]) => {
    const g = new THREE.Mesh(new THREE.BoxGeometry(w, 0.022, 0.02), glowMat);
    g.position.set(0, y, 0.62); root.add(g);
  });

  /* ---------- acabamento ultrarrealista (referência): armadura preta de verniz com linhas de luz laranja ---------- */
  // capacete: faixas laranja sobre a cabeça, placa no topo, luzes nas laterais da viseira, grade no queixo
  {
    const crownPt = (x, y, back) => {
      const r = rAt(y), rx = r * SX, rz = r * SZ, u = clamp(x / Math.max(rx, 1e-3), -0.98, 0.98), z = Math.sqrt(Math.max(0, 1 - u * u)) * rz;
      return new THREE.Vector3(x * 1.03, y * 1.004, (back ? -z : z) * 1.03 + (back ? -0.012 : 0.012));
    };
    [-1, 1].forEach(s => {
      const pts = [];
      for (let k = 0; k <= 14; k++) pts.push(crownPt(s * 0.27, 0.5 + 0.6 * k / 14, false));
      for (let k = 1; k <= 14; k++) pts.push(crownPt(s * 0.27, 1.1 - 1.0 * k / 14, true));
      face.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 0.017, 8), glowMat));
      const side = [];                                                   // luz que desce pela lateral da viseira
      for (let k = 0; k <= 26; k++) { const t = k / 26, th = s * (A + 0.1 + 0.12 * Math.sin(t * Math.PI)); side.push(vPoint(th, yc + 0.52 - 1.06 * t, 0.05)); }
      face.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(side), 120, 0.03, 8), glowMat));
      const side2 = [];
      for (let k = 0; k <= 22; k++) { const t = k / 22, th = s * (A - 0.02 + 0.1 * Math.sin(t * Math.PI)); side2.push(vPoint(th, yc + 0.38 - 0.74 * t, 0.06)); }
      face.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(side2), 100, 0.012, 8), glowMat));
      const slit = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.012, 0.02), glowMat);   // frestas no queixo
      slit.position.copy(vPoint(s * 0.34, -0.78, 0.012)); slit.rotation.y = s * 0.34; face.add(slit);
    });
    const crest = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 24), chrome);
    crest.scale.set(0.2, 0.05, 0.34); crest.position.set(0, 1.115, 0.12); crest.rotation.x = -0.12; face.add(crest);
    const crestLine = new THREE.Mesh(new THREE.TorusGeometry(1, 0.012, 8, 72), glowMat);
    crestLine.scale.set(0.215, 0.36, 1); crestLine.rotation.x = Math.PI / 2; crestLine.position.set(0, 1.155, 0.12); face.add(crestLine);
    const chin = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 24), chrome);
    chin.scale.set(0.3, 0.1, 0.2); chin.position.copy(vPoint(0, -0.66, 0.0)); chin.rotation.x = 0.35; face.add(chin);
  }
  // cabos que descem do capacete até o ombro
  const cable = (pts, r) => root.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))), 60, r, 8), darkMetal));
  cable([[0.68, -0.45, -0.3], [0.82, -1.0, -0.46], [0.6, -1.5, -0.3], [0.86, -1.98, 0.04]], 0.024);
  cable([[-0.66, -0.5, -0.3], [-0.76, -1.05, -0.4], [-0.56, -1.55, -0.28]], 0.016);
  // peitoral: placas em relevo e linhas de luz nas emendas
  {
    const chestR = (y) => { for (let i = 1; i < chestPts.length; i++) { const a = chestPts[i - 1], b = chestPts[i]; if (a.y >= y && y >= b.y) return a.x + (b.x - a.x) * ((a.y - y) / ((a.y - b.y) || 1)); } return 0.5; };
    const cz = (x, y) => 0.5 * Math.sqrt(Math.max(0, Math.pow(chestR(y), 2) - x * x)) + 0.014;
    const seam = (pts, r) => root.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(([x, y]) => new THREE.Vector3(x, y, cz(x, y)))), 90, r, 8), glowMat));
    seam([[0, -1.95], [0, -2.6], [0, -3.4], [0, -4.1]], 0.012);
    [-1, 1].forEach(s => {
      seam([[s * 0.03, -2.95], [s * 0.2, -2.55], [s * 0.5, -2.3], [s * 0.85, -2.28], [s * 1.05, -2.55]], 0.011);
      seam([[s * 0.12, -3.5], [s * 0.5, -3.45], [s * 0.95, -3.62]], 0.009);
      seam([[s * 0.22, -1.86], [s * 0.55, -1.96], [s * 0.92, -2.08]], 0.008);
      const pec = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), chrome);
      pec.scale.set(0.47, 0.3, 0.05); pec.position.set(s * 0.5, -2.6, cz(s * 0.5, -2.6) + 0.005); pec.rotation.set(0.1, s * -0.42, s * 0.14); root.add(pec);
    });
    const abs = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), chrome);
    abs.scale.set(0.58, 0.36, 0.045); abs.position.set(0, -3.4, cz(0, -3.4) + 0.005); root.add(abs);
  }

  /* ---------- dobra 2: mão do robô com a palma aberta para cima e o carrossel girando em cima dela ---------- */
  const rng = (() => { let s = 11; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  const accent = new THREE.Color(ACCENT);
  const f2 = new THREE.Group();
  scene.add(f2);

  // mão (vista de lado, apontando para a esquerda): palma, dorso com faixa de luz, pulso metálico, antebraço e dedos curvados
  const hand = new THREE.Group();
  f2.add(hand);
  const palm = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.9, 14, 28), chrome);
  palm.rotation.z = Math.PI / 2; palm.scale.set(0.7, 1, 1.45);
  const palmRing = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.013, 10, 48), glowMat);
  palmRing.rotation.y = Math.PI / 2; palmRing.scale.set(1.45, 0.72, 1); palmRing.position.x = -0.15;
  const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.07, 16, 48), darkMetal);
  cuff.rotation.y = Math.PI / 2; cuff.scale.set(1.45, 0.9, 1); cuff.position.x = 0.62;
  const cuffGlow = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.012, 10, 48), glowMat);
  cuffGlow.rotation.y = Math.PI / 2; cuffGlow.scale.set(1.45, 0.9, 1); cuffGlow.position.x = 0.7;
  const fdir = new THREE.Vector3(0.975, -0.22, 0).normalize();
  const foreG = new THREE.Group();
  foreG.position.set(0.7 + fdir.x * 1.7, fdir.y * 1.7, 0); foreG.rotation.z = Math.atan2(-fdir.x, fdir.y);
  const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.33, 2.6, 16, 32), chrome);
  forearm.scale.set(1, 1, 1.2);
  foreG.add(forearm);
  [0.9, 0.2].forEach(y => { const r = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.014, 10, 48), glowMat); r.rotation.x = Math.PI / 2; r.position.y = y; r.scale.set(1, 1.2, 1); foreG.add(r); });
  hand.add(palm, palmRing, cuff, cuffGlow, foreG);
  // acabamento da armadura (igual ao robô da foto): placa em relevo na palma e linhas de luz laranja no antebraço
  {
    const plate = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 24), chrome);
    plate.scale.set(0.52, 0.035, 0.3); plate.position.set(-0.05, 0.215, 0); hand.add(plate);
    const outline = new THREE.Mesh(new THREE.TorusGeometry(1, 0.011, 8, 72), glowMat);
    outline.scale.set(0.5, 0.29, 1); outline.rotation.x = Math.PI / 2; outline.position.set(-0.05, 0.235, 0); hand.add(outline);
    const seamP = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.012, 0.012), glowMat); seamP.position.set(-0.05, 0.24, 0); hand.add(seamP);
    [-1, 1].forEach(sg => { const line = new THREE.Mesh(new THREE.BoxGeometry(0.012, 2.3, 0.012), glowMat); line.position.set(sg * 0.13, 0, 0.376); foreG.add(line); });
  }
  // dedo: cadeia de segmentos que sai do bordo esquerdo da palma e se curva para cima
  const addFinger = (base, lens, rads, bends, rotZ, rotY) => {
    const g = new THREE.Group(); g.position.copy(base); g.rotation.set(0, rotY, rotZ); hand.add(g);
    let node = g, offset = 0;
    lens.forEach((len, s) => {
      const sg = new THREE.Group(); sg.position.y = offset; sg.rotation.z = -bends[s]; node.add(sg);
      const seg = new THREE.Mesh(new THREE.CapsuleGeometry(rads[s], Math.max(len - rads[s] * 2, 0.02), 8, 16), chrome); seg.position.y = len / 2; sg.add(seg);
      const joint = new THREE.Mesh(new THREE.SphereGeometry(rads[s] * 1.18, 16, 12), darkMetal); joint.position.y = len; sg.add(joint);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(rads[s] * 1.06, 0.009, 8, 24), glowMat); ring.rotation.x = Math.PI / 2; ring.position.y = len * 0.5; sg.add(ring);
      node = sg; offset = len;
    });
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.032, 12, 8), glowMat); tip.position.y = lens[lens.length - 1] + 0.02; node.add(tip);
  };
  const HEAD = Math.PI / 2;   // gira o eixo do segmento (+y) para apontar para a esquerda
  [[-0.36, [0.5, 0.38, 0.3], 0.1], [-0.12, [0.56, 0.42, 0.32], 0.03], [0.12, [0.5, 0.38, 0.3], -0.04], [0.36, [0.4, 0.3, 0.24], -0.1]].forEach(([z, lens, ry]) =>
    addFinger(new THREE.Vector3(-0.72, 0.1, z), lens.map(l => l * 1.1), [0.115, 0.1, 0.088], [0.08, 0.5, 0.6], HEAD, ry));
  addFinger(new THREE.Vector3(-0.3, 0.06, 0.52), [0.58, 0.46], [0.125, 0.105], [0.05, 0.4], 0.62, 0.15);   // polegar

  // carrossel em cima da palma: os três cartões se revezam (o do meio sobe e acende, os outros recuam)
  const carousel = new THREE.Group();
  carousel.position.set(-0.3, 1.95, 0);
  f2.add(carousel);
  const iconCv = [0, 1, 2].map(() => { const c = document.createElement('canvas'); c.width = c.height = 256; return c; });
  const icons = createIcons(iconCv, ['download', 'gear', 'folder']);
  icons.setVisible(false);
  const CARD_TEXT = [['A referência está em', 'Downloads.'], ['A headline ficou em', 'outra ferramenta.'], ['A fonte, numa pasta de', 'um projeto antigo.']];
  const cards = CARD_TEXT.map((lines) => {
    const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 1408;
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.12, 1.54), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, side: THREE.DoubleSide, depthWrite: false }));
    carousel.add(mesh);
    return { mesh, cv, ctx: cv.getContext('2d'), tex, lines, cur: { x: 0, y: 0, z: 0, ry: 0, s: 1, b: 1 } };
  });
  function drawCard(c, i) {
    const g = c.ctx, K = c.cv.width / 512, W = 512, H = 704, r = 46, m = 6;
    g.setTransform(K, 0, 0, K, 0, 0); g.imageSmoothingQuality = 'high'; g.clearRect(0, 0, W, H);
    const rr = (x, y, w, h, q) => { g.beginPath(); g.moveTo(x + q, y); g.arcTo(x + w, y, x + w, y + h, q); g.arcTo(x + w, y + h, x, y + h, q); g.arcTo(x, y + h, x, y, q); g.arcTo(x, y, x + w, y, q); g.closePath(); };
    // corpo de vidro fosco: quase transparente, um pouco mais claro no topo
    rr(m, m, W - 2 * m, H - 2 * m, r);
    const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, 'rgba(255,248,240,0.30)'); bg.addColorStop(0.55, 'rgba(255,236,218,0.14)'); bg.addColorStop(1, 'rgba(255,190,140,0.20)');
    g.fillStyle = bg; g.fill();
    g.save(); g.clip();
    // reflexo diagonal suave, como luz batendo na superfície do vidro
    const sh = g.createLinearGradient(0, 0, W, H * 0.7); sh.addColorStop(0, 'rgba(255,255,255,0.42)'); sh.addColorStop(0.32, 'rgba(255,255,255,0.10)'); sh.addColorStop(0.5, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = sh; g.fillRect(0, 0, W, H);
    // faixa fina de brilho atravessando o vidro
    g.save(); g.translate(W * 0.5, H * 0.18); g.rotate(-0.62);
    const st = g.createLinearGradient(0, -34, 0, 34); st.addColorStop(0, 'rgba(255,255,255,0)'); st.addColorStop(0.5, 'rgba(255,255,255,0.14)'); st.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = st; g.fillRect(-W, -34, W * 2, 68); g.restore();
    // luz quente que sobe da base (reflexo do fundo laranja)
    const wm = g.createLinearGradient(0, H * 0.62, 0, H); wm.addColorStop(0, 'rgba(255,140,50,0)'); wm.addColorStop(1, 'rgba(255,140,50,0.22)');
    g.fillStyle = wm; g.fillRect(0, H * 0.62, W, H * 0.38);
    // granulado fino de vidro jateado
    for (let n = 0; n < 900; n++) { g.fillStyle = 'rgba(255,255,255,' + (0.025 + Math.random() * 0.04) + ')'; g.fillRect(Math.random() * W, Math.random() * H, 1.2, 1.2); }
    // sombra interna nas bordas para dar espessura
    rr(m - 14, m - 14, W - 2 * m + 28, H - 2 * m + 28, r + 14); g.lineWidth = 30; g.strokeStyle = 'rgba(120,50,10,0.10)'; g.stroke();
    g.restore();
    // borda: fio de luz forte no topo/esquerda e mais fraco embaixo/direita
    rr(m, m, W - 2 * m, H - 2 * m, r);
    const eg = g.createLinearGradient(0, 0, W, H); eg.addColorStop(0, 'rgba(255,255,255,0.95)'); eg.addColorStop(0.45, 'rgba(255,255,255,0.35)'); eg.addColorStop(1, 'rgba(255,200,150,0.75)');
    g.lineWidth = 2.6; g.strokeStyle = eg; g.stroke();
    rr(m + 3, m + 3, W - 2 * m - 6, H - 2 * m - 6, r - 3); g.lineWidth = 1.2; g.strokeStyle = 'rgba(255,255,255,0.22)'; g.stroke();
    g.drawImage(iconCv[i], 30, 26, 270, 270);
    g.textBaseline = 'alphabetic'; g.lineJoin = 'round';
    const fit = (txt, weight, size) => { let s = size; do { g.font = weight + ' ' + s + 'px PPNeueMontreal, system-ui, sans-serif'; s -= 1; } while (g.measureText(txt).width > 420 && s > 20); };
    const put = (txt, y, fill, lw, size) => {
      fit(txt, 700, size);
      g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillText(txt, 40, y + 2.5);   // sombra sob o texto, para ler bem sobre o fundo escuro
      g.fillStyle = fill; g.strokeStyle = fill; g.lineWidth = lw; g.fillText(txt, 40, y); g.strokeText(txt, 40, y);
    };
    put(c.lines[0], 520, '#FFFFFF', 1.2, 38);
    put(c.lines[1], 584, '#FF8A3D', 1.6, 52);
  }
  const cardState = { active: 0, clock: 0, frame: 0 };
  const cardTarget = (i) => {
    const slot = ((i - cardState.active + 1) % 3 + 3) % 3 - 1;
    return slot === 0 ? { x: 0, y: 0.12, z: 0.3, ry: 0, s: 1, b: 1 } : { x: slot * 1.0, y: -0.04, z: -0.12, ry: -slot * 0.5, s: 0.84, b: 0.82 };
  };
  function placeCards(snap, k) {
    cards.forEach((c, i) => {
      const T = cardTarget(i), cu = c.cur;
      for (const key of ['x', 'y', 'z', 'ry', 's', 'b']) cu[key] = snap ? T[key] : cu[key] + (T[key] - cu[key]) * k;
      c.mesh.position.set(cu.x, cu.y, cu.z); c.mesh.rotation.y = cu.ry; c.mesh.scale.setScalar(cu.s); c.mesh.material.color.setScalar(cu.b);
    });
  }
  placeCards(true);
  // halo de luz laranja entre a palma e os cartões
  const haloCv = document.createElement('canvas'); haloCv.width = haloCv.height = 128;
  { const g = haloCv.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,140,40,0.85)'); gr.addColorStop(1, 'rgba(255,107,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); }
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(haloCv), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, opacity: 0.55 }));
  halo.rotation.x = -Math.PI / 2; halo.position.y = -1.3; halo.userData.skip = true;
  carousel.add(halo);

  /* ---------- dobra 2 (referência "Our Technology"): dispositivo de vidro em camadas, que se separam e se juntam ---------- */
  f2.remove(hand); f2.remove(carousel);
  const dev = new THREE.Group(); dev.rotation.x = 0.5; f2.add(dev);
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xcfe0ff, metalness: 0, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02, transparent: true, opacity: 0.2, envMapIntensity: 2.4, depthWrite: false, side: THREE.DoubleSide });
  const edgeMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
  const glassShell = (w, h, d, rad) => {
    const g = new THREE.Group(), m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 6, rad), glassMat); m.userData.skip = true; g.add(m);
    g.add(new THREE.LineSegments(new THREE.EdgesGeometry(new RoundedBoxGeometry(w * 0.996, h * 0.996, d * 0.996, 2, rad), 28), edgeMat)); return g;
  };
  const dBox = (w, h, d, mat, x, y, z, rad) => { const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, rad == null ? Math.min(w, h, d) * 0.3 : rad), mat); m.position.set(x, y, z); return m; };
  const pcbCv = document.createElement('canvas'); pcbCv.width = pcbCv.height = 512;
  { const g = pcbCv.getContext('2d'); g.fillStyle = 'rgba(8,8,10,0)'; g.clearRect(0, 0, 512, 512); g.lineCap = 'round';
    for (let k = 0; k < 46; k++) { const x = rng() * 512, y = rng() * 512, hot = rng() < 0.14; g.strokeStyle = hot ? 'rgba(255,110,30,0.85)' : 'rgba(150,155,170,0.38)'; g.lineWidth = hot ? 2.2 : 1.4; g.beginPath(); g.moveTo(x, y); const dx = (rng() < 0.5 ? 1 : -1) * (40 + rng() * 120); g.lineTo(x + dx, y); g.lineTo(x + dx, y + (rng() < 0.5 ? 1 : -1) * (30 + rng() * 90)); g.stroke(); g.fillStyle = g.strokeStyle; g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill(); } }
  const pcbTex = new THREE.CanvasTexture(pcbCv); pcbTex.colorSpace = THREE.SRGBColorSpace;
  const clipMat = new THREE.MeshStandardMaterial({ color: 0xff6b00, roughness: 0.35, metalness: 0.2, emissive: 0xff4a00, emissiveIntensity: 0.55 });
  // camada de baixo: caixa transparente com presilhas laranja e portas
  const bot = new THREE.Group(); dev.add(bot);
  bot.add(glassShell(3.4, 1.1, 3.4, 0.24));
  bot.add(dBox(2.8, 0.5, 2.8, darkMetal, 0, -0.1, 0, 0.1));
  const strip = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.025, 0.02), glowMat); strip.position.set(0, 0.2, 1.38); bot.add(strip);
  [[-1.7, -1.7], [1.7, -1.7], [-1.7, 1.7], [1.7, 1.7]].forEach(([x, z]) => bot.add(dBox(0.14, 0.74, 0.3, clipMat, x, 0, z, 0.05)));
  [-0.85, 0.85].forEach((x) => { bot.add(dBox(0.95, 0.55, 0.06, darkMetal, x, -0.05, 1.72, 0.08)); const l = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.02, 0.02), glowMat); l.position.set(x, 0.06, 1.76); bot.add(l); });
  bot.add(dBox(0.5, 0.42, 0.05, chrome, 0, -0.08, 1.72, 0.06));
  // camada do meio: placa escura com chip e componentes
  const mid = new THREE.Group(); dev.add(mid);
  mid.add(dBox(2.8, 0.14, 2.8, darkMetal, 0, 0.12, 0, 0.05)); mid.add(dBox(2.6, 0.12, 2.6, darkMetal, 0, -0.1, 0, 0.05));
  const traces = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 2.7), new THREE.MeshBasicMaterial({ map: pcbTex, transparent: true, toneMapped: false, depthWrite: false })); traces.rotation.x = -Math.PI / 2; traces.position.y = 0.2; traces.userData.skip = true; mid.add(traces);
  mid.add(dBox(0.95, 0.13, 0.95, chrome, 0.15, 0.26, -0.1, 0.05)); mid.add(dBox(0.6, 0.04, 0.6, darkMetal, 0.15, 0.34, -0.1, 0.02));
  for (let k = 0; k < 16; k++) mid.add(dBox(0.12 + rng() * 0.28, 0.06 + rng() * 0.1, 0.12 + rng() * 0.28, darkMetal, (rng() - 0.5) * 2.3, 0.25, (rng() - 0.5) * 2.3, 0.02));
  [[-0.9, 0.9], [0.95, 0.8], [-0.7, -0.95]].forEach(([x, z]) => { const l = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, 0.07), glowMat); l.position.set(x, 0.31, z); mid.add(l); });
  // camada de cima: tampa de vidro com a placa interna
  const top = new THREE.Group(); dev.add(top);
  top.add(glassShell(3.4, 0.7, 3.4, 0.24)); top.add(dBox(2.5, 0.1, 2.5, darkMetal, 0, -0.18, 0, 0.06));
  const lid = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 2.3), new THREE.MeshBasicMaterial({ map: pcbTex, transparent: true, opacity: 0.5, toneMapped: false, depthWrite: false })); lid.rotation.x = -Math.PI / 2; lid.position.y = -0.11; lid.userData.skip = true; top.add(lid);
  // a foto ultrarrealista do dispositivo substitui o modelo por código: ela se inclina com o mouse (paralaxe) e se monta em pixels
  f2.remove(dev);
  const DH = 4.4, DW = DH * devImg.naturalWidth / devImg.naturalHeight;
  const devTex = new THREE.Texture(devImg); devTex.colorSpace = THREE.SRGBColorSpace; devTex.anisotropy = 8; devTex.generateMipmaps = true; devTex.minFilter = THREE.LinearMipmapLinearFilter; devTex.needsUpdate = true;
  const devDepthTex = new THREE.Texture(devDepthImg); devDepthTex.minFilter = THREE.LinearFilter; devDepthTex.magFilter = THREE.LinearFilter; devDepthTex.generateMipmaps = false; devDepthTex.needsUpdate = true;
  const devMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { map: { value: devTex }, depthMap: { value: devDepthTex }, uLook: { value: new THREE.Vector2() } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `uniform sampler2D map; uniform sampler2D depthMap; uniform vec2 uLook; varying vec2 vUv;
      void main(){
        float dep = texture2D(depthMap, vUv).r;
        vec4 c = texture2D(map, vUv - vec2(uLook.x, uLook.y * .8) * (dep - .45) * .07);
        c.a *= smoothstep(0., .02, vUv.x) * smoothstep(1., .98, vUv.x) * smoothstep(0., .07, vUv.y);
        gl_FragColor = vec4(c.rgb * 1.08, c.a);
      }`,
  });
  const devPlane = new THREE.Mesh(new THREE.PlaneGeometry(DW, DH), devMat); devPlane.userData.skip = true; f2.add(devPlane); devMat.visible = false;   // o vídeo da dobra 2 (HTML) substitui a foto estática; a foto só serve de molde para os pixels
  function sampleDev(total) {                                     // pixels com as cores reais da foto (coordenadas da dobra 2)
    const cvp = document.createElement('canvas'); cvp.width = devImg.naturalWidth; cvp.height = devImg.naturalHeight;
    const g = cvp.getContext('2d', { willReadFrequently: true }); g.drawImage(devImg, 0, 0);
    const Wp = cvp.width, Hp = cvp.height, data = g.getImageData(0, 0, Wp, Hp).data, out = [], lin = (v) => Math.pow(v / 255, 2.2);
    let guard = 0;
    while (out.length < total && guard++ < total * 90) {
      const px = (rng() * Wp) | 0, py = (rng() * Hp) | 0, i = (py * Wp + px) * 4;
      if (data[i + 3] < 120) continue;
      const r = data[i], gg = data[i + 1], b = data[i + 2], mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
      if (rng() > 0.1 + (mx / 255) * 0.55 + ((mx - mn) / 255) * 1.0) continue;
      out.push({ x: (px / Wp - 0.5) * DW, y: (0.5 - py / Hp) * DH, z: (rng() - 0.5) * 0.02, c: [lin(r), lin(gg), lin(b)] });
    }
    while (out.length < total) out.push({ ...out[(rng() * out.length) | 0] });
    return out;
  }
  function orbAnimate(t, dt, on) {
    devPlane.position.y = Math.sin(t * 0.7) * 0.06; devMat.uniforms.uLook.value.set(look.x, look.y);
    return;
    const gp = 1 - 0.34 * sstep(1.05, 1.9, story.s);                       // as camadas se aproximam conforme a dobra avança: "junta tudo em um só lugar"
    const br = Math.sin(t * 0.7) * 0.07;
    top.position.y = 1.75 * gp + br; mid.position.y = 0.05 + br * 0.4; bot.position.y = -1.6 * gp - br;
    top.rotation.y = Math.sin(t * 0.35) * 0.07; bot.rotation.y = -Math.sin(t * 0.3) * 0.05;
    dev.rotation.y = 0.55 + Math.sin(t * 0.22) * 0.16;
  }
  const f2Parts = [{ obj: devPlane, rank: 0 }];

  /* ---------- dobra 3 (referência "Product Lineup"): quatro objetos de vidro 3D, alinhados aos cartões da página ---------- */
  const lineup = new THREE.Group(); scene.add(lineup);
  let lineupRects = [], lineupPops = [], lineupHov = [];
  const mkTexCv = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
  const rrp = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  const auroraTex = mkTexCv(512, 320, (g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#2a1230'); sky.addColorStop(0.55, '#c2410c'); sky.addColorStop(1, '#ffb066'); g.fillStyle = sky; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,232,196,.92)'; g.beginPath(); g.arc(w * 0.74, h * 0.46, 34, 0, 7); g.fill();
    g.fillStyle = '#1d0b14'; g.beginPath(); g.moveTo(0, h); g.lineTo(w * 0.28, h * 0.5); g.lineTo(w * 0.48, h * 0.72); g.lineTo(w * 0.7, h * 0.44); g.lineTo(w, h * 0.8); g.lineTo(w, h); g.fill();
    g.fillStyle = '#33121c'; g.beginPath(); g.moveTo(0, h); g.lineTo(w * 0.2, h * 0.74); g.lineTo(w * 0.45, h * 0.9); g.lineTo(w * 0.72, h * 0.7); g.lineTo(w, h); g.fill();
    g.fillStyle = '#fff'; g.font = '800 54px Orbitron, Inter, system-ui, sans-serif'; g.fillText('Aurora', 34, 108); g.font = '500 17px Inter, system-ui, sans-serif'; g.fillStyle = 'rgba(255,255,255,.88)'; g.fillText('Studio de design e movimento', 36, 138);
    rrp(g, 36, 160, 120, 36, 18); g.fillStyle = '#FF6B00'; g.fill();
  });
  const tagTex = mkTexCv(512, 320, (g, w, h) => {
    g.fillStyle = '#120b08'; g.fillRect(0, 0, w, h);
    ['Todas', 'Interface', 'Cores'].forEach((n, k) => { rrp(g, 26 + k * 100, 24, 88, 30, 15); g.fillStyle = k === 1 ? '#FF6B00' : 'rgba(255,255,255,.1)'; g.fill(); g.fillStyle = '#fff'; g.font = '600 14px Inter, system-ui, sans-serif'; g.textAlign = 'center'; g.fillText(n, 70 + k * 100, 44); });
    g.textAlign = 'left'; rrp(g, 22, 76, w - 44, 150, 16); g.fillStyle = 'rgba(255,255,255,.07)'; g.fill(); g.lineWidth = 2; g.strokeStyle = 'rgba(255,107,0,.8)'; g.stroke();
    g.fillStyle = '#fff'; g.font = '700 25px Orbitron, Inter, system-ui, sans-serif'; g.fillText('Aurora Studio', 40, 118);
    g.fillStyle = '#a99f99'; g.font = '400 16px Inter, system-ui, sans-serif'; g.fillText('Interface  ·  3,2 MB', 40, 146);
    rrp(g, 40, 164, 112, 32, 16); g.lineWidth = 1.6; g.strokeStyle = '#FF8A3D'; g.stroke(); g.fillStyle = '#FF8A3D'; g.font = '700 13px Orbitron, Inter, sans-serif'; g.fillText('INTERFACE', 52, 185);
    g.fillStyle = '#d8cfca'; g.font = '500 16px Inter, system-ui, sans-serif'; ['#dark', '#hero', '#saas'].forEach((t, k) => g.fillText(t, 170 + k * 70, 186));
    rrp(g, 22, 244, w - 44, 54, 14); g.fillStyle = 'rgba(255,255,255,.05)'; g.fill();
  });
  const faceM = (tex) => new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
  const luAsp = luImgs.map(im => im.naturalWidth / im.naturalHeight);
  const luMats = luImgs.map((im, i) => {
    const tex = new THREE.Texture(im); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.needsUpdate = true;
    const dep = new THREE.Texture(luDeps[i]); dep.minFilter = THREE.LinearFilter; dep.magFilter = THREE.LinearFilter; dep.generateMipmaps = false; dep.needsUpdate = true;
    return new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { map: { value: tex }, depthMap: { value: dep }, uLook: { value: new THREE.Vector2() }, uA: { value: 1 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: `uniform sampler2D map; uniform sampler2D depthMap; uniform vec2 uLook; uniform float uA; varying vec2 vUv;
        void main(){
          float dep = texture2D(depthMap, vUv).r;
          vec4 c = texture2D(map, vUv - vec2(uLook.x, uLook.y * .8) * (dep - .45) * .09);
          gl_FragColor = vec4(c.rgb * 1.06, c.a * uA);
        }`,
    });
  });
  const luObjs = luMats.map((m, i) => new THREE.Mesh(new THREE.PlaneGeometry(luAsp[i], 1), m));
  const luHolders = luObjs.map((o) => { const h = new THREE.Group(); h.add(o); h.visible = false; lineup.add(h); return h; });
  function lineupUpdate(t) {
    luHolders.forEach((h, i) => {
      const r = lineupRects[i], pop = lineupPops[i] || 0;
      if (!r || pop < 0.01) { h.visible = false; return; }
      h.visible = true;
      const wpp = 2 * halfHv / innerHeight, cx = (r.x + r.w / 2) / innerWidth * 2 - 1, cy = (r.y + r.h / 2) / innerHeight * 2 - 1;
      const hov = lineupHov[i] ? 1 : 0;
      h.position.set(cx * hw, -cy * halfHv + Math.sin(t * 0.8 + i * 1.2) * 0.04, 0);
      h.scale.setScalar(Math.max(Math.min(r.w / luAsp[i], r.h) * wpp * 0.96 * (r.s !== undefined ? r.s : 0.5 + 0.5 * pop) * (1 + 0.07 * hov), 0.0001));
      luMats[i].uniforms.uA.value = pop;
      // o objeto "vira" para o mouse (paralaxe pelo relevo) e balança sozinho
      luMats[i].uniforms.uLook.value.set(look.x * 0.9 + Math.sin(t * 0.55 + i * 1.7) * 0.45 * (1 + hov), look.y * 0.7 + Math.sin(t * 0.42 + i) * 0.22);
      luObjs[i].rotation.y = look.x * 0.12 + (hov ? Math.sin(t * 1.6) * 0.08 : 0);
    });
  }

  /* ---------- dobra 3: a biblioteca em carrossel (pôsteres emoldurados lado a lado, do lado esquerdo) ---------- */
  const f3 = new THREE.Group();
  scene.add(f3);
  const AW = 1.0, AH = 1.35, AC_W = 400, AC_H = 540;              // área do pôster (unidades 3D e pixels do desenho)
  const PITCH = 1.4, NIT = 8, LOOP = NIT * PITCH;                  // distância entre pôsteres e volta completa do carrossel
  let FADE_IN = 3.0, FADE_OUT = 4.2;                                // os pôsteres das pontas esmaecem na borda da tela (valores ajustados no layout)
  const PW = 2.8;
  const CAP_Y = -(AH / 2 + 0.075 + 0.2);                           // legenda logo abaixo da moldura
  const ax = (px) => (px / AC_W - 0.5) * AW, ay = (py) => (0.5 - py / AC_H) * AH;
  const wrapX = (v) => ((((v + LOOP / 2) % LOOP) + LOOP) % LOOP) - LOOP / 2;
  const fadeOf = (x) => 1 - sstepL(FADE_IN, FADE_OUT, Math.abs(x));
  function sstepL(a, b, x) { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  const rrShape = (w, h, r) => {
    const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
  };
  const FONT = (w, s) => w + ' ' + s + 'px PPNeueMontreal, system-ui, sans-serif';
  const mkCv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const mkTex = (cv) => { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  const mkPlane = (w, h, tex, extra) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial(Object.assign({ map: tex, transparent: true, toneMapped: false, depthWrite: false }, extra))); m.userData.skip = true; return m; };
  const drawTex = (w, h, draw) => { const c = mkCv(w, h); draw(c.getContext('2d'), w, h); return mkTex(c); };
  const roundPath = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };

  const LIB_ITEMS = [
    { kind: 0, name: 'Landing SaaS escuro', cat: 'Interface', tags: '#dark  #saas' },
    { kind: 1, name: 'Tipografia editorial', cat: 'Tipografia', tags: '#serif  #bold' },
    { kind: 3, name: 'Pasta monitorada', cat: 'Automático', tags: '#sem importar' },
    { kind: 2, name: 'Cartaz em movimento', cat: 'Cartaz', tags: '#laranja  #vibe' },
    { kind: 5, name: 'Paleta âmbar', cat: 'Cores', tags: '#quente  #marca' },
    { kind: 4, name: 'Gerar design system', cat: '1 clique', tags: '#proposta' },
    { kind: 6, name: 'Pack de ícones', cat: 'Ícones', tags: '#3d  #pack' },
    { kind: 7, name: 'Dashboard fintech', cat: 'Interface', tags: '#dados  #escuro' },
  ];
  // desenho de cada pôster (cada um lembra um tipo de referência; os dois últimos mostram a pasta monitorada e o design system)
  function drawArt(i, g, w, h) {
    const T = (txt, x, y, font, col, al) => { g.font = font; g.fillStyle = col; g.textAlign = al || 'left'; g.fillText(txt, x, y); };
    g.textBaseline = 'alphabetic'; g.clearRect(0, 0, w, h);
    const blur = (px, fn) => { g.save(); g.filter = 'blur(' + px + 'px)'; fn(); g.restore(); };
    if (i === 0) {
      g.fillStyle = '#0b0705'; g.fillRect(0, 0, w, h);
      const beam = g.createLinearGradient(w, 0, 0, h); beam.addColorStop(0, 'rgba(255,170,60,0.95)'); beam.addColorStop(0.45, 'rgba(235,85,0,0.9)'); beam.addColorStop(1, 'rgba(120,30,0,0.15)');
      g.fillStyle = beam; g.beginPath(); g.moveTo(w, 150); g.lineTo(w, h); g.lineTo(0, h); g.lineTo(0, h - 50); g.lineTo(w - 90, 150); g.closePath(); g.fill();
      g.fillStyle = 'rgba(40,10,0,0.55)'; for (let k = 0; k < 7; k++) g.fillRect(36 + k * 44, h - 70 - k * 38, w - 36 - k * 44, 38);
      g.fillStyle = '#0b0705'; g.beginPath(); g.arc(150, h - 262, 14, 0, 7); g.fill(); g.fillRect(140, h - 248, 20, 70);
      T('A', 28, 92, FONT(400, 70), '#fff'); g.fillStyle = '#fff'; g.fillRect(92, 68, 118, 3); T('SERIES', 232, 92, FONT(400, 70), '#fff');
      g.fillStyle = 'rgba(255,255,255,0.5)'; [0, 1, 2].forEach(k => g.fillRect(28, 124 + k * 16, 250 - k * 30, 5));
    } else if (i === 1) {
      const bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#6b1100'); bg.addColorStop(1, '#2a0600'); g.fillStyle = bg; g.fillRect(0, 0, w, h);
      for (let k = 0; k < w; k += 16) { g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(k, 0, 7, h); }
      const lg = g.createRadialGradient(w * 0.5, h * 0.55, 0, w * 0.5, h * 0.55, w * 0.7); lg.addColorStop(0, 'rgba(255,120,20,0.85)'); lg.addColorStop(1, 'rgba(255,60,0,0)'); g.fillStyle = lg; g.fillRect(0, 0, w, h);
      T('Aa', w / 2, h * 0.62, FONT(600, 270), '#fff4ea', 'center');
      T('Stay connected', w / 2, 86, FONT(400, 42), '#fff', 'center'); T('anytime, anywhere', w / 2, 136, FONT(400, 42), '#fff', 'center');
      g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(34, h - 72, 140, 4); T('Regular  /  SemiBold', 34, h - 34, FONT(400, 24), '#ffd9bf');
    } else if (i === 2) {
      const bg = g.createRadialGradient(w * 0.5, h * 0.5, 0, w * 0.5, h * 0.5, w * 0.9); bg.addColorStop(0, '#ff8a2a'); bg.addColorStop(0.55, '#f2540a'); bg.addColorStop(1, '#a52d00'); g.fillStyle = bg; g.fillRect(0, 0, w, h);
      blur(14, () => { g.fillStyle = '#1a0702'; g.beginPath(); g.ellipse(w * 0.55, h * 0.3, 36, 46, 0, 0, 7); g.fill(); g.beginPath(); g.moveTo(w * 0.42, h * 0.38); g.lineTo(w * 0.72, h * 0.38); g.lineTo(w * 0.8, h * 0.78); g.lineTo(w * 0.5, h * 0.98); g.lineTo(w * 0.3, h * 0.95); g.closePath(); g.fill(); });
      g.fillStyle = 'rgba(255,255,255,0.9)'; [30, 140, 250].forEach(x => g.fillRect(x, 30, 108, 4));
      g.fillStyle = '#fff'; g.beginPath(); g.arc(42, 70, 12, 0, 7); g.fill(); T('ultron  ·  1h atrás', 66, 78, FONT(400, 24), '#fff');
    } else if (i === 3) {
      g.fillStyle = '#0b0705'; g.fillRect(0, 0, w, h);
      const gl = g.createRadialGradient(w / 2, h * 0.3, 0, w / 2, h * 0.3, w * 0.7); gl.addColorStop(0, 'rgba(255,107,0,0.5)'); gl.addColorStop(1, 'rgba(255,107,0,0)'); g.fillStyle = gl; g.fillRect(0, 0, w, h);
      const fx = w / 2 - 100, fy = 96;                                    // pasta grande
      const fg = g.createLinearGradient(0, fy, 0, fy + 150); fg.addColorStop(0, '#ff9a3d'); fg.addColorStop(1, '#e24f00');
      g.fillStyle = '#c24200'; roundPath(g, fx, fy - 18, 90, 40, 12); g.fill(); g.fillStyle = fg; roundPath(g, fx, fy, 200, 150, 22); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.28)'; roundPath(g, fx + 8, fy + 6, 184, 22, 10); g.fill();
      T('Referências', w / 2, 316, FONT(600, 40), '#fff', 'center'); T('~/Design/Referências', w / 2, 354, FONT(200, 24), '#b3a69d', 'center');
      g.fillStyle = 'rgba(255,255,255,0.07)'; roundPath(g, 40, 384, w - 80, 56, 28); g.fill();
      T('Monitorando', 112, 421, FONT(600, 26), '#FF9A4D');
      [0, 1, 2].forEach(k => { g.fillStyle = ['#ff8a2a', '#f2540a', '#fff4ea'][k]; roundPath(g, 40 + k * 84, 462, 72, 52, 10); g.fill(); });
      T('+', w - 52, 502, FONT(600, 34), '#FF9A4D', 'center');
    } else if (i === 5) {
      ['#FF6B00', '#F6A043', '#A24A0F', '#4A1C06', '#1B0A03'].forEach((c, k) => { g.fillStyle = c; g.fillRect(k * w / 5, 0, w / 5 + 1, h); T(c, k * w / 5 + 10, h - 24, FONT(600, 20), k < 2 ? '#1b0a03' : '#fff'); });
      T('Paleta', 28, 96, FONT(600, 64), '#1b0a03'); T('5 cores', 30, 134, FONT(400, 26), '#1b0a03');
    } else if (i === 6) {
      const bg = g.createLinearGradient(0, 0, w, h); bg.addColorStop(0, '#ff8f33'); bg.addColorStop(1, '#d94f00'); g.fillStyle = bg; g.fillRect(0, 0, w, h);
      for (let k = 0; k < 12; k++) {
        const x = 34 + (k % 3) * 122, y = 38 + Math.floor(k / 3) * 118; roundPath(g, x, y, 104, 98, 24); g.fillStyle = 'rgba(255,255,255,0.93)'; g.fill(); g.fillStyle = k % 2 ? '#1c120b' : '#FF6B00';
        const cx = x + 52, cy = y + 49, m = k % 6;
        if (m === 0) { g.beginPath(); g.arc(cx, cy, 22, 0, 7); g.fill(); } else if (m === 1) { g.beginPath(); g.moveTo(cx, cy - 26); g.lineTo(cx + 26, cy + 20); g.lineTo(cx - 26, cy + 20); g.fill(); }
        else if (m === 2) { roundPath(g, cx - 24, cy - 24, 48, 48, 9); g.fill(); } else if (m === 3) { g.lineWidth = 10; g.strokeStyle = g.fillStyle; g.beginPath(); g.arc(cx, cy, 19, 0, 7); g.stroke(); }
        else if (m === 4) { g.fillRect(cx - 26, cy - 4, 52, 8); g.fillRect(cx - 4, cy - 26, 8, 52); } else { g.beginPath(); g.arc(cx - 13, cy, 13, 0, 7); g.arc(cx + 13, cy, 13, 0, 7); g.fill(); }
      }
    } else if (i === 7) {
      g.fillStyle = '#0f0b09'; g.fillRect(0, 0, w, h);
      T('R$ 84,2k', 30, 96, FONT(600, 58), '#fff'); T('+12,4% no mês', 32, 134, FONT(600, 26), '#FF8A3D');
      const pts = [[30, 380], [96, 340], [162, 360], [228, 290], [294, 312], [360, 240]];
      g.beginPath(); g.moveTo(30, 470); pts.forEach(p => g.lineTo(p[0], p[1])); g.lineTo(360, 470); g.closePath();
      const q = g.createLinearGradient(0, 240, 0, 470); q.addColorStop(0, 'rgba(255,107,0,0.55)'); q.addColorStop(1, 'rgba(255,107,0,0)'); g.fillStyle = q; g.fill();
      g.lineWidth = 6; g.strokeStyle = '#FF6B00'; g.lineJoin = 'round'; g.beginPath(); pts.forEach((p, k) => k ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.16)'; [0, 1, 2, 3, 4, 5].forEach(k => g.fillRect(30 + k * 62, 190 + (k % 3) * 12, 36, 44 - (k % 3) * 10));
    } else {
      const bg = g.createLinearGradient(0, 0, w, h); bg.addColorStop(0, '#ff8a2a'); bg.addColorStop(0.6, '#e85500'); bg.addColorStop(1, '#7a2600'); g.fillStyle = bg; g.fillRect(0, 0, w, h);
      const sh = g.createLinearGradient(0, 0, 0, h * 0.6); sh.addColorStop(0, 'rgba(255,255,255,0.22)'); sh.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = sh; g.fillRect(0, 0, w, h);
      const sx = w * 0.5, sy = 150; g.fillStyle = 'rgba(255,255,255,0.95)'; g.beginPath(); g.moveTo(sx, sy - 74); g.quadraticCurveTo(sx + 10, sy - 10, sx + 74, sy); g.quadraticCurveTo(sx + 10, sy + 10, sx, sy + 74); g.quadraticCurveTo(sx - 10, sy + 10, sx - 74, sy); g.quadraticCurveTo(sx - 10, sy - 10, sx, sy - 74); g.fill();
      T('Gostou de uma', w / 2, 270, FONT(600, 42), '#fff', 'center'); T('referência?', w / 2, 318, FONT(600, 42), '#fff', 'center');
      T('Um clique transforma ela em', w / 2, 362, FONT(200, 24), 'rgba(255,255,255,0.95)', 'center'); T('uma proposta de design system.', w / 2, 392, FONT(200, 24), 'rgba(255,255,255,0.95)', 'center');
      ['#140a04', '#fff4ea', '#FFD2A6', '#7a2600'].forEach((c, k) => { g.fillStyle = c; g.beginPath(); g.arc(w / 2 - 78 + k * 52, 440, 18, 0, 7); g.fill(); });
    }
  }
  function drawCaption(it, g, w, h) {
    g.clearRect(0, 0, w, h); g.textBaseline = 'alphabetic'; g.textAlign = 'left';
    g.shadowColor = 'rgba(30,8,0,0.65)'; g.shadowBlur = 8; g.shadowOffsetY = 2;
    g.font = FONT(600, 40); g.fillStyle = '#fff'; g.fillText(it.name, 8, 46);
    g.font = FONT(600, 22); const cw = g.measureText(it.cat.toUpperCase()).width + 28;
    g.shadowBlur = 0; g.shadowOffsetY = 0; roundPath(g, 8, 68, cw, 38, 19); g.fillStyle = 'rgba(14,6,3,0.72)'; g.fill(); g.lineWidth = 2; g.strokeStyle = 'rgba(255,140,60,0.95)'; g.stroke();
    g.fillStyle = '#FF9A4D'; g.fillText(it.cat.toUpperCase(), 22, 94);
    g.shadowColor = 'rgba(30,8,0,0.65)'; g.shadowBlur = 8; g.font = FONT(400, 24); g.fillStyle = '#fff4ea'; g.fillText(it.tags, cw + 26, 95);
  }

  const frameMat = darkMetal.clone(); frameMat.transparent = true;
  const frameGeo = new THREE.ExtrudeGeometry(rrShape(AW + 0.15, AH + 0.15, 0.07), { depth: 0.09, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 3, curveSegments: 14 });
  const shTex = drawTex(128, 128, (g) => { const q = g.createRadialGradient(64, 64, 0, 64, 64, 64); q.addColorStop(0, 'rgba(0,0,0,0.9)'); q.addColorStop(0.6, 'rgba(0,0,0,0.35)'); q.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = q; g.fillRect(0, 0, 128, 128); });
  const dotTex = drawTex(64, 64, (g) => { const q = g.createRadialGradient(32, 32, 0, 32, 32, 32); q.addColorStop(0, '#fff'); q.addColorStop(0.3, '#FF8A3D'); q.addColorStop(1, 'rgba(255,107,0,0)'); g.fillStyle = q; g.fillRect(0, 0, 64, 64); });
  const haloTex = new THREE.CanvasTexture(haloCv);

  // cada pôster: slot (posição no carrossel + destaque do mouse) → pop (surge em pixels) → moldura, arte, legenda, sombra, brilho
  const slots = LIB_ITEMS.map((it, i) => {
    const slot = new THREE.Group(), pop = new THREE.Group(); slot.add(pop); f3.add(slot);
    const artCv = mkCv(AC_W, AC_H), artCtx = artCv.getContext('2d', { willReadFrequently: true }), artTex = mkTex(artCv);
    const art = mkPlane(AW, AH, artTex); art.material.depthWrite = true; art.userData.item = i;
    const frame = new THREE.Mesh(frameGeo, frameMat.clone()); frame.position.z = -0.14;
    const capCv = mkCv(460, 128), capTex = mkTex(capCv);
    const cap = mkPlane(1.15, 0.32, capTex); cap.position.set(0, CAP_Y, 0.01);
    const shadow = mkPlane(AW * 1.7, AH * 1.45, shTex, { opacity: 0.6 }); shadow.position.set(0.02, -0.16, -0.14);
    const glow = mkPlane(AW * 2.2, AH * 1.8, haloTex, { blending: THREE.AdditiveBlending, opacity: 0 }); glow.position.z = -0.08;
    pop.add(shadow, glow, frame, art, cap);
    const s = { it, i, slot, pop, art, frame, cap, shadow, glow, artCv, artCtx, artTex, capCv, capTex, hv: 0, x: 0, op: 1 };
    return s;
  });
  function redrawLibrary() {
    slots.forEach((s) => { drawArt(s.it.kind, s.artCtx, AC_W, AC_H); s.artTex.needsUpdate = true; drawCaption(s.it, s.capCv.getContext('2d', { willReadFrequently: true }), 460, 128); s.capTex.needsUpdate = true; });
  }
  redrawLibrary();
  if (document.fonts && document.fonts.load) {   // redesenha quando a fonte do design system terminar de carregar
    Promise.all([document.fonts.load('600 30px PPNeueMontreal'), document.fonts.load('400 30px PPNeueMontreal'), document.fonts.load('200 30px PPNeueMontreal')]).then(redrawLibrary).catch(() => {});
  }

  // animações dos pôsteres da pasta monitorada (ponto que pulsa e aviso de arquivo novo) e do design system (botão flutuante)
  const mon = slots.find(s => s.it.kind === 3), ds = slots.find(s => s.it.kind === 4);
  const monDot = mkPlane(0.1, 0.1, dotTex); monDot.position.set(ax(88), ay(402), 0.03);
  const monHalo = mkPlane(0.3, 0.3, dotTex, { blending: THREE.AdditiveBlending, opacity: 0.6 }); monHalo.position.copy(monDot.position);
  const BADGE_Y = ay(80);
  const badge = mkPlane(0.74 * 0.7, 0.185 * 0.7, drawTex(370, 92, (g, w, h) => {
    roundPath(g, 4, 4, w - 8, h - 8, 42); g.fillStyle = 'rgba(255,107,0,0.97)'; g.fill(); g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,0.75)'; g.stroke();
    g.fillStyle = '#fff'; g.font = FONT(600, 38); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('+1 arquivo novo', w / 2, h / 2 + 2);
  }));
  badge.position.set(0, BADGE_Y, 0.06);
  mon.pop.add(monDot, monHalo, badge);
  const BW = 0.84, BH = BW * 150 / 650, BZ = 0.2, BX = 0, BY = ay(490);
  const btnGlow = mkPlane(BW * 1.5, BH * 3.4, haloTex, { blending: THREE.AdditiveBlending, opacity: 0.5 }); btnGlow.position.set(BX, BY, BZ - 0.06);
  const btn = mkPlane(BW, BH, drawTex(650, 150, (g, w, h) => {
    roundPath(g, 4, 4, w - 8, h - 8, 71); const q = g.createLinearGradient(0, 0, w, h); q.addColorStop(0, '#16100c'); q.addColorStop(1, '#050302'); g.fillStyle = q; g.fill(); g.lineWidth = 5; g.strokeStyle = 'rgba(255,255,255,0.7)'; g.stroke();
    const sx = 96, sy = h / 2; g.fillStyle = '#FF7A1A'; g.beginPath(); g.moveTo(sx, sy - 34); g.quadraticCurveTo(sx + 5, sy - 5, sx + 34, sy); g.quadraticCurveTo(sx + 5, sy + 5, sx, sy + 34); g.quadraticCurveTo(sx - 5, sy + 5, sx - 34, sy); g.quadraticCurveTo(sx - 5, sy - 5, sx, sy - 34); g.fill();
    g.fillStyle = '#fff'; g.font = FONT(600, 46); g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText('Gerar design system', 150, h / 2 + 3);
  }), { color: new THREE.Color(0.95, 0.95, 0.95) });
  btn.position.set(BX, BY, BZ);
  ds.pop.add(btnGlow, btn);

  // sombra no chão, abaixo do carrossel flutuante (fica na cena, não gira com os pôsteres)
  const libShadow = mkPlane(1, 1, shTex, { opacity: 0 }); libShadow.visible = false; libShadow.renderOrder = -5; scene.add(libShadow);

  const car = { auto: 0, mul: 1, started: false };
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let hvBtn = 0, hovered = -1, pointerSeen = false;
  // quem está sob o cursor: 0-4 pôster, 5 botão, -1 nenhum
  function hoverTest(enabled) {
    if (!enabled || !pointerSeen) return -1;
    f3.updateMatrixWorld(true);
    ndc.set(mouse.x, mouse.y); ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects([btn, ...slots.map(s => s.art)], false);
    for (const h of hits) {
      if (h.object === btn) { if (ds.op > 0.5) return 99; continue; }
      const s = slots[h.object.userData.item]; if (s.op > 0.5) return s.i;
    }
    return -1;
  }
  function animateLibrary(t, dt, k, enabled) {
    hovered = hoverTest(enabled);
    document.documentElement.style.cursor = hovered >= 0 ? 'pointer' : '';
    const anyHover = hovered >= 0 ? 1 : 0;
    if (!car.started) car.started = true;
    car.mul += ((anyHover ? 0 : 1) - car.mul) * 0.08 * k;               // o carrossel gira rápido e pausa suavemente sob o mouse
    car.auto -= 0.55 * dt * car.mul;
    const off = -(story.s - 3.2) * 1.0 + car.auto;
    let maxHv = 0;
    slots.forEach((s) => {
      const x = wrapX((s.i - 3) * PITCH + off), op = fadeOf(x);
      s.x = x; s.op = op;
      const isH = hovered === s.i || (hovered === 99 && s === ds);
      s.hv += ((isH ? 1 : 0) - s.hv) * 0.16 * k; maxHv = Math.max(maxHv, s.hv);
    });
    slots.forEach((s) => {
      const v = s.hv, curve = -0.07 * s.x * s.x;
      s.slot.position.set(s.x, Math.sin(t * 0.8 + s.i * 1.3) * 0.03, curve + 0.34 * v);
      s.slot.rotation.y = -s.x * 0.1; s.slot.scale.setScalar(1 + 0.08 * v);
      s.art.material.opacity = s.op; s.art.material.color.setScalar(1 + 0.12 * v - 0.22 * maxHv * (1 - v));
      s.frame.material.opacity = s.op; s.cap.material.opacity = s.op; s.shadow.material.opacity = 0.6 * s.op * (1 - 0.0 * v);
      s.glow.material.opacity = 0.85 * v * s.op; s.glow.scale.setScalar(1 + 0.1 * v);
      s.slot.visible = s.op > 0.003;
    });
    hvBtn += ((hovered === 99 ? 1 : 0) - hvBtn) * 0.16 * k;
    const pulse = 1 + 0.35 * Math.sin(t * 3.2), mo = mon.op;
    monDot.scale.setScalar(pulse * 0.85); monHalo.scale.setScalar(1 + 0.5 * Math.sin(t * 3.2 + 1));
    monDot.material.opacity = mo; monHalo.material.opacity = (0.35 + 0.25 * Math.sin(t * 3.2)) * mo;
    const ph = (t % 5.5) / 5.5, bo = ph < 0.55 ? Math.sin(Math.PI * ph / 0.55) : 0;
    badge.material.opacity = Math.min(1, bo * 1.6) * mo; badge.position.y = BADGE_Y + 0.05 * (ph < 0.55 ? ph / 0.55 : 1);
    btn.scale.setScalar(1 + 0.02 * Math.sin(t * 2.4) + 0.1 * hvBtn); btn.position.z = BZ + 0.1 * hvBtn; btn.material.opacity = ds.op;
    btnGlow.material.opacity = (0.4 + 0.18 * Math.sin(t * 2.4) + 0.4 * hvBtn) * ds.op; btnGlow.position.z = btn.position.z - 0.06;
  }

  const f3Parts = slots.map((s, i) => ({ obj: s.pop, rank: clamp(Math.abs(wrapX((i - 3) * PITCH)) / 4.5, 0, 1) * 0.7 }));
  // pontos da biblioteca (cor tirada do próprio desenho) para os pixels que vêm da mão
  function sampleLibrary(total) {
    const out = [], lin = (v) => Math.pow(v / 255, 2.2);
    const vis = slots.map(s => ({ s, x: wrapX((s.i - 3) * PITCH) })).filter(o => fadeOf(o.x) > 0.5);
    const per = Math.ceil(total / vis.length);
    vis.forEach(({ s, x }) => {
      const z0 = -0.07 * x * x, art = s.artCtx.getImageData(0, 0, AC_W, AC_H).data, cap = s.capCv.getContext('2d').getImageData(0, 0, 460, 128).data;
      const nArt = Math.round(per * 0.7), nEdge = Math.round(per * 0.12);
      let guard = 0, n = 0;
      while (n < nArt && guard++ < nArt * 60) {
        const px = (rng() * AC_W) | 0, py = (rng() * AC_H) | 0, i = (py * AC_W + px) * 4, r = art[i], gg = art[i + 1], b = art[i + 2], mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
        if (rng() > 0.08 + (mx / 255) * 0.55 + ((mx - mn) / 255) * 0.9) continue;
        out.push({ x: x + ax(px), y: ay(py), z: z0 + (rng() - 0.5) * 0.02, c: [lin(r), lin(gg), lin(b)] }); n++;
      }
      for (let k = 0; k < nEdge; k++) {                                  // moldura preta
        const u = rng(), side = (rng() * 4) | 0, w2 = (AW + 0.15) / 2, h2 = (AH + 0.15) / 2, v = 0.05 + rng() * 0.12;
        out.push({ x: x + (side < 2 ? (u * 2 - 1) * w2 : (side === 2 ? -w2 : w2)), y: side < 2 ? (side === 0 ? h2 : -h2) : (u * 2 - 1) * h2, z: z0 - 0.05, c: [v, v, v * 1.05] });
      }
      guard = 0; n = out.length;                                         // legenda (letras brancas e etiqueta laranja)
      const target = n + (per - nArt - nEdge);
      while (out.length < target && guard++ < 4000) {
        const px = (rng() * 460) | 0, py = (rng() * 128) | 0, i = (py * 460 + px) * 4;
        if (cap[i + 3] < 140) continue;
        out.push({ x: x + (px / 460 - 0.5) * 1.15, y: CAP_Y + (0.5 - py / 128) * 0.32, z: z0 + 0.01, c: [lin(cap[i]), lin(cap[i + 1]), lin(cap[i + 2])] });
      }
    });
    while (out.length < total) out.push({ ...out[(rng() * out.length) | 0] });
    while (out.length > total) out.splice((rng() * out.length) | 0, 1);
    return out;
  }

  /* ---------- robô da foto de referência (recorte ultrarrealista) ---------- */
  // o robô montado por código sai de cena; no lugar entra o recorte da foto, que se desfaz em pixels com as cores dela
  const procRobot = root.children.slice();
  procRobot.forEach(o => root.remove(o));
  const PHH = 5.79, PHW = PHH * photo.naturalWidth / photo.naturalHeight, PHY = 1.2 - PHH / 2;
  const depthTex = new THREE.Texture(depthImg); depthTex.minFilter = THREE.LinearFilter; depthTex.magFilter = THREE.LinearFilter; depthTex.generateMipmaps = false; depthTex.needsUpdate = true;
  const photoTex = new THREE.Texture(photo); photoTex.colorSpace = THREE.SRGBColorSpace; photoTex.anisotropy = 8; photoTex.generateMipmaps = true; photoTex.minFilter = THREE.LinearMipmapLinearFilter; photoTex.needsUpdate = true;
  const NOISE_GLSL = `
    float dsH(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float dsN(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
      return mix(mix(dsH(i), dsH(i + vec2(1., 0.)), f.x), mix(dsH(i + vec2(0., 1.)), dsH(i + vec2(1., 1.)), f.x), f.y); }
    float dsF(vec2 uv){ vec2 p = uv * vec2(7., 9.); return dsN(p) * .55 + dsN(p * 2.1 + 4.3) * .3 + dsN(p * 4.4 + 9.1) * .15; }`;
  const photoMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uBFade: { value: 0 }, uGlitch: { value: 0 }, uTimeG: { value: 0 }, map: { value: photoTex }, uMask: { value: null }, depthMap: { value: depthTex }, uLook: { value: new THREE.Vector2() }, uPs: { value: 0 }, uShow: { value: 0 }, uY0: { value: PHY - PHH / 2 }, uY1: { value: PHY + PHH / 2 } },
    vertexShader: `varying vec2 vUv; varying float vY; void main(){ vUv = uv; vY = position.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `
      uniform float uGlitch; uniform float uTimeG; uniform float uBFade;
      ${NOISE_GLSL}
      uniform sampler2D map; uniform sampler2D uMask; uniform sampler2D depthMap; uniform vec2 uLook;
      uniform sampler2D uTrail; uniform sampler2D uHuman; uniform float uHumanOn; uniform vec2 uImg; uniform vec4 uTBox; uniform vec4 uHBox; uniform float uPs; uniform float uShow; uniform float uY0; uniform float uY1;
      varying vec2 vUv; varying float vY;
      void main(){
        // o robô "vira" para o lado do mouse: as partes mais próximas deslizam mais que as de trás (paralaxe pelo relevo)
        // falha: faixas horizontais deslocadas, cores separadas e um clarão rápido (só durante as rajadas)
        vec2 uvg = vUv; float gband = 0., gr = 0.;
        if (uGlitch > .001) {
          float tick = floor(uTimeG * 4.);
          float row = floor(vUv.y * 150. + tick * 3.7);
          gr = fract(sin(row * 12.9898 + tick * 78.233) * 43758.5453);
          gband = step(.975, gr) * uGlitch;
          uvg.x += (gr - .5) * .011 * gband;
        }
        float gs = .0015 * uGlitch * (.5 + gr);
        vec4 c = vec4(texture2D(map, uvg + vec2(gs, 0.)).r, texture2D(map, uvg).g, texture2D(map, uvg - vec2(gs, 0.)).b, texture2D(map, uvg).a);
        c.rgb += gband * vec3(.02, .007, .0);
        if (uHumanOn > .5) {
          vec2 px = vec2(vUv.x * uImg.x, (1. - vUv.y) * uImg.y);
          vec2 tuv = (px - uTBox.xy) / uTBox.zw; tuv.y = 1. - tuv.y;
          float inT = step(0., tuv.x) * step(tuv.x, 1.) * step(0., tuv.y) * step(tuv.y, 1.);
          float m = texture2D(uTrail, clamp(tuv, 0., 1.)).r * inT;
          float hm = smoothstep(.35, .75, c.a);                                  // em qualquer parte do robô (capacete e roupa)
          vec2 huv = (px - uHBox.xy) / uHBox.zw; huv.y = 1. - huv.y;
          float inH = step(0., huv.x) * step(huv.x, 1.) * step(0., huv.y) * step(huv.y, 1.);
          vec4 hc = texture2D(uHuman, clamp(huv, 0., 1.));
          float rv = smoothstep(.14, .55, m) * hm * inH * hc.a;                  // quanto do rosto humano aparece
          c.rgb = mix(c.rgb, hc.rgb, rv);
          c.a = max(c.a, rv);
        }
        c.a *= mix(1., smoothstep(0., .5, vUv.y), uBFade);                    // no celular a base do robô se apaga em degradê
        c.a *= smoothstep(0., .015, vUv.x);   // bordas do recorte se dissolvem (a foto é cortada no peito e no ombro)
        // desintegração: a foto some em manchas irregulares (de baixo para cima), com uma brasa laranja na borda de cada mancha
        float q = clamp((dsF(vUv) * .72 + vUv.y * .28 - .2) / .6, 0., 1.);
        float t = uPs - (.05 + .82 * q);
        if (t > 0.) discard;
        float edge = smoothstep(-.07, 0., t);
        vec3 col = mix(c.rgb * 1.1, vec3(1., .24, .015), edge * .92);          // a borda queima em laranja (não em amarelo)
        gl_FragColor = vec4(col, c.a * uShow);
      }`,
  });
  const photoMesh = new THREE.Mesh(new THREE.PlaneGeometry(PHW, PHH), photoMat);
  photoMesh.position.y = PHY; photoMesh.userData.skip = true; photoMesh.renderOrder = 0; root.add(photoMesh);
  const headMaskTex = new THREE.Texture(headMaskImg); headMaskTex.minFilter = THREE.LinearFilter; headMaskTex.magFilter = THREE.LinearFilter; headMaskTex.generateMipmaps = false; headMaskTex.needsUpdate = true;
  photoMat.uniforms.uMask.value = headMaskTex;
  const IW = photo.naturalWidth, IH = photo.naturalHeight, KPX = PHH / IH;       // mundo por pixel da imagem
  /* ---------- rosto humano por baixo: onde o mouse passa, a casca do robô se abre e aparece um rosto humano ---------- */
  const TB = { x0: 0, y0: 0, w: IW, h: IH }, TCW = 384, TCH = Math.round(384 * IH / IW);   // o rastro cobre o robô inteiro (rosto e roupa)
  const trailCv = document.createElement('canvas'); trailCv.width = TCW; trailCv.height = TCH;
  const trailCx = trailCv.getContext('2d'); trailCx.fillStyle = '#000'; trailCx.fillRect(0, 0, TCW, TCH);
  const trailTex = new THREE.CanvasTexture(trailCv); trailTex.minFilter = THREE.LinearFilter; trailTex.magFilter = THREE.LinearFilter; trailTex.generateMipmaps = false;
  const humanImg = new Image(); let humanOn = false;
  await new Promise((ok) => { humanImg.onload = () => { humanOn = true; ok(); }; humanImg.onerror = ok; humanImg.src = 'ASSETS/img/robo/human-face.png'; });
  const humanTex = new THREE.Texture(humanImg); humanTex.colorSpace = THREE.SRGBColorSpace; humanTex.minFilter = THREE.LinearFilter; humanTex.generateMipmaps = false; humanTex.needsUpdate = true;
  // o rosto é encaixado pelos olhos: os olhos da foto ficam na altura/centro da viseira do robô
  const HK = humanOn ? 1.68 * 736 / humanImg.naturalWidth : 1, hW = humanOn ? humanImg.naturalWidth * HK : 700, hH = humanOn ? humanImg.naturalHeight * HK : 700;
  const hX0 = IW / 2 - (humanOn ? 0.514 * hW : hW / 2), hY0 = 560 - (humanOn ? 0.350 * hH : hH / 2);
  Object.assign(photoMat.uniforms, {
    uTrail: { value: trailTex }, uHuman: { value: humanTex }, uHumanOn: { value: humanOn ? 1 : 0 }, uImg: { value: new THREE.Vector2(IW, IH) },
    uTBox: { value: new THREE.Vector4(TB.x0, TB.y0, TB.w, TB.h) }, uHBox: { value: new THREE.Vector4(hX0, hY0, hW, hH) },
  });
  photoMat.needsUpdate = true;
  const glitch = { next: 3.2, until: -1, start: 0, dur: 0.6 }, glitchReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let trailLast = null;
  const coarse = matchMedia('(hover: none)').matches; let touchAt = -9;
  function trailUpdate() {
    trailCx.fillStyle = 'rgba(0,0,0,0.03)'; trailCx.fillRect(0, 0, TCW, TCH);          // o rastro se fecha devagar
    let pxI = 0, pyI = 0, has = false;
    if (humanOn && st.show > 0.5) {
      const now = performance.now() / 1000;
      if (coarse && now - touchAt > 1.2) {
        // celular (sem mouse): a cada ~7 s um "escaneamento" passa pelo rosto e depois pela roupa, e o dedo também abre a casca ao tocar
        if (story.s < 0.5) {
          const ph = (now % 7) / 7;
          if (ph < 0.3) { const u = ph / 0.3; pxI = IW * 0.5 + (u * 2 - 1) * 330; pyI = 540 + 70 * Math.sin(u * Math.PI * 2); has = true; }
          else if (ph > 0.45 && ph < 0.75) { const u = (ph - 0.45) / 0.3; pxI = IW * 0.5 + (1 - u * 2) * 340; pyI = 1010 + 80 * Math.sin(u * Math.PI * 2); has = true; }
        }
      } else if (pointerSeen) {
        const sR = root.scale.x, lx = (mouse.x * hw - root.position.x) / sR, ly = (mouse.y * halfHv - root.position.y) / sR - PHY;
        pxI = (lx / PHW + 0.5) * IW; pyI = (0.5 - ly / PHH) * IH; has = true;
      }
    }
    if (has) {
      const tx = (pxI - TB.x0) / TB.w * TCW, ty = (pyI - TB.y0) / TB.h * TCH;
      if (trailLast) {
        trailCx.save(); trailCx.lineCap = 'round'; trailCx.strokeStyle = '#fff'; trailCx.lineWidth = coarse ? 20 : 12; trailCx.shadowColor = '#fff'; trailCx.shadowBlur = 6;
        trailCx.beginPath(); trailCx.moveTo(trailLast.x, trailLast.y); trailCx.lineTo(tx, ty); trailCx.stroke(); trailCx.restore();
      }
      trailLast = { x: tx, y: ty };
    } else trailLast = null;
    trailTex.needsUpdate = true;
  }
  // "ULTRON" escrito em luz no vidro da viseira da foto
  const visorTxt = new THREE.Mesh(new THREE.PlaneGeometry(0.4 * PHW, 0.4 * PHW * 200 / 1024), new THREE.MeshBasicMaterial({ map: nameTex, transparent: true, toneMapped: false, depthWrite: false, opacity: 0 }));
  visorTxt.visible = false; visorTxt.position.set(-0.01 * PHW, PHY + (0.5 - 0.44) * PHH, 0.012); visorTxt.userData.skip = true; root.add(visorTxt);
  // arcos de luz atrás do robô, centrados na cabeça (acompanham o robô)
  const headRings = new THREE.Group();
  headRings.position.set(0, PHY + (0.5 - 0.41) * PHH, -0.35); root.add(headRings);
  const arcMat = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  const mkArc = (r, w, start, len, c, o) => { const m = new THREE.Mesh(new THREE.RingGeometry(r - w / 2, r + w / 2, 160, 1, start, len), arcMat(c, o)); m.renderOrder = -5; m.userData.skip = true; headRings.add(m); return m; };
  const arcA = mkArc(0.44 * PHH, 0.0022 * PHH, Math.PI * 0.55, Math.PI * 1.35, 0xff6b00, 0.3);
  const arcAglow = mkArc(0.44 * PHH, 0.012 * PHH, Math.PI * 0.55, Math.PI * 1.35, 0xff5a10, 0.03);
  const arcB = mkArc(0.6 * PHH, 0.0016 * PHH, Math.PI * 0.1, Math.PI * 0.8, 0xffc9a0, 0.1);
  const arcC = mkArc(0.6 * PHH, 0.0016 * PHH, Math.PI * 1.3, Math.PI * 0.5, 0xff6b00, 0.12);
  function samplePhoto(total) {
    const cvp = document.createElement('canvas'); cvp.width = photo.naturalWidth; cvp.height = photo.naturalHeight;
    const g = cvp.getContext('2d', { willReadFrequently: true }); g.drawImage(photo, 0, 0);
    const Wp = cvp.width, Hp = cvp.height, data = g.getImageData(0, 0, Wp, Hp).data, out = [], lin = (v) => Math.pow(v / 255, 2.2);
    let guard = 0;
    while (out.length < total && guard++ < total * 90) {
      const px = (rng() * Wp) | 0, py = (rng() * Hp) | 0, i = (py * Wp + px) * 4;
      if (data[i + 3] < 200) continue;
      const r = data[i], gg = data[i + 1], b = data[i + 2], mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
      if (rng() > 0.12 + (mx / 255) * 0.5 + ((mx - mn) / 255) * 1.0) continue;   // mais pixels nas partes claras e coloridas
      out.push({ x: (px / Wp - 0.5) * PHW, y: PHY + (0.5 - py / Hp) * PHH, z: (rng() - 0.5) * 0.02, c: [lin(r), lin(gg), lin(b)], h: 1 - py / Hp });
    }
    while (out.length < total) out.push({ ...out[(rng() * out.length) | 0] });
    return out;
  }

  /* ---------- peças do robô ---------- */
  const parts = procRobot.map((obj) => {
    const y = new THREE.Box3().setFromObject(obj).getCenter(new THREE.Vector3()).y;
    return {
      obj, y, rank: 0, dynamicRot: obj === headPivot,
      p: obj.position.clone(), q: obj.quaternion.clone(), s: obj.scale.clone(),
      dir: new THREE.Vector3(0.35 + rng() * 1.3, (rng() - 0.5) * 1.8, -(0.8 + rng() * 1.6)).normalize(), // para a direita e para trás
      dist: 3 + rng() * 4.5,
      axis: new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize(),
      spin: (rng() - 0.5) * Math.PI * 2.4,
    };
  });
  const yMin = Math.min(...parts.map(p => p.y)), yMax = Math.max(...parts.map(p => p.y));
  parts.forEach(p => { p.rank = (p.y - yMin) / ((yMax - yMin) || 1); });   // 0 = peça mais baixa, 1 = mais alta
  const spinQ = new THREE.Quaternion();
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const SPREAD = 0.6;
  // ex: entrada (as peças chegam de fora e montam o robô, de cima para baixo);
  // ps: dissolução (cada peça encolhe e some enquanto vira pixels, de baixo para cima)
  function applyParts(ex, ps) {
    for (const p of parts) {
      const t = clamp(ex * (1 + SPREAD) - SPREAD * p.rank, 0, 1), e = t * t * (3 - 2 * t);
      p.obj.position.copy(p.p).addScaledVector(p.dir, p.dist * e);
      if (!p.dynamicRot) p.obj.quaternion.copy(p.q);
      p.obj.quaternion.premultiply(spinQ.setFromAxisAngle(p.axis, p.spin * e));
      const td = clamp(ps * (1 + SPREAD) - SPREAD * p.rank, 0, 1);
      const k = 1 - sstep(0, 0.4, td);
      p.obj.scale.copy(p.s).multiplyScalar(Math.max(k, 0.0001));
      p.obj.visible = k > 0.003;
    }
  }

  /* ---------- pixels discretos: o robô se desintegra e viaja até a mão com a pasta (cada pixel leva a cor da sua peça) ---------- */
  const N = 11000;
  root.updateMatrixWorld(true);
  f2.updateMatrixWorld(true);
  const colorFor = (mat) => {
    if (mat === glowMat || mat === glowSoft) return () => [accent.r * 1.1, accent.g * 1.1, accent.b * 1.1];
    if (mat === darkMetal || mat === glass) return () => { const v = 0.1 + rng() * 0.18; return [v, v, v * 1.03]; };
    if (mat === chrome) return () => { if (rng() < 0.1) return [0.8, 0.8, 0.85]; const v = 0.05 + rng() * 0.2; return [v, v, v * 1.04]; };
    return () => { const v = 0.22 + rng() * 0.4; return [v, v, v * 1.03]; };
  };
  // pontos sobre as superfícies de um grupo de malhas; coordenadas relativas à raiz do grupo (que está na origem)
  function sampleMeshes(group, total, weightOf) {
    const list = [];
    group.traverse(o => { if (o.isMesh && !o.userData.skip) list.push(o); });
    const info = list.map(mesh => {
      const s = new MeshSurfaceSampler(mesh).build();
      const sc3 = new THREE.Vector3().setFromMatrixScale(mesh.matrixWorld);
      return { mesh, s, area: s.distribution[s.distribution.length - 1] * Math.pow((sc3.x + sc3.y + sc3.z) / 3, 2) };
    });
    const sum = info.reduce((a, b) => a + b.area, 0) || 1;
    const out = [], v = new THREE.Vector3();
    info.forEach(({ mesh, s, area }) => {
      const n = Math.max(12, Math.round(total * area / sum)), pick = colorFor(mesh.material);
      let top = mesh; while (top.parent && top.parent !== group) top = top.parent;
      for (let k = 0; k < n; k++) {
        s.sample(v); v.applyMatrix4(mesh.matrixWorld);
        out.push({ x: v.x, y: v.y, z: v.z, c: pick(), top });
      }
    });
    while (out.length > total) out.splice((rng() * out.length) | 0, 1);
    while (out.length < total) out.push({ ...out[(rng() * out.length) | 0] });
    return out;
  }
  const src = samplePhoto(N);
  const dst = sampleDev(N);
  const dst3 = sampleLibrary(N);
  // rank de cada pixel de origem = rank da peça do robô de onde saiu
  const rankOf = new Map(parts.map(p => [p.obj, p.rank]));
  src.forEach(p => { p.rank = clamp(p.h + (rng() - 0.5) * 0.04, 0, 1); });
  src.sort((a, b) => b.y - a.y);
  dst.sort((a, b) => b.y - a.y);
  dst3.sort((a, b) => b.y - a.y);
  const bx0 = Math.min(...dst.map(d => d.x)), bx1 = Math.max(...dst.map(d => d.x));   // a mão se desfaz da ponta dos dedos para o punho

  const aPos = new Float32Array(N * 3), aB = new Float32Array(N * 3), aC0 = new Float32Array(N * 3), aC1 = new Float32Array(N * 3);
  const aD = new Float32Array(N * 3), aC2 = new Float32Array(N * 3), aRank2 = new Float32Array(N);
  const aRank = new Float32Array(N), aSeed = new Float32Array(N), aSize = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const a = src[i], b = dst[i], d = dst3[i];
    aPos.set([a.x, a.y, a.z], i * 3); aB.set([b.x, b.y, b.z], i * 3); aD.set([d.x, d.y, d.z], i * 3);
    aC0.set(a.c, i * 3); aC1.set(b.c, i * 3); aC2.set(d.c, i * 3);
    aRank2[i] = clamp((b.x - bx0) / ((bx1 - bx0) || 1) + (rng() - 0.5) * 0.1, 0, 1);
    aRank[i] = a.rank; aSeed[i] = rng(); aSize[i] = 1.3 + rng() * 0.9;
  }
  const cloudGeo = new THREE.BufferGeometry();
  cloudGeo.setAttribute('position', new THREE.BufferAttribute(aPos, 3));
  cloudGeo.setAttribute('aB', new THREE.BufferAttribute(aB, 3));
  cloudGeo.setAttribute('aC0', new THREE.BufferAttribute(aC0, 3));
  cloudGeo.setAttribute('aC1', new THREE.BufferAttribute(aC1, 3));
  cloudGeo.setAttribute('aD', new THREE.BufferAttribute(aD, 3));
  cloudGeo.setAttribute('aC2', new THREE.BufferAttribute(aC2, 3));
  cloudGeo.setAttribute('aRank2', new THREE.BufferAttribute(aRank2, 1));
  cloudGeo.setAttribute('aRank', new THREE.BufferAttribute(aRank, 1));
  cloudGeo.setAttribute('aSeed', new THREE.BufferAttribute(aSeed, 1));
  cloudGeo.setAttribute('aSize', new THREE.BufferAttribute(aSize, 1));
  const pu = {
    uPlane: { value: new THREE.Vector3(PHW, PHH, PHY) },
    uRoot: { value: root.matrixWorld }, uF2: { value: f2.matrixWorld }, uF3: { value: f3.matrixWorld },
    uPs: { value: 0 }, uPs2: { value: 0 }, uForm: { value: 0 }, uFade: { value: 0 }, uTime: { value: 0 }, uPix: { value: renderer.getPixelRatio() },
  };
  const cloud = new THREE.Points(cloudGeo, new THREE.ShaderMaterial({
    uniforms: pu, transparent: true, depthWrite: false,
    vertexShader: `
      attribute vec3 aB; attribute vec3 aC0; attribute vec3 aC1; attribute vec3 aD; attribute vec3 aC2;
      attribute float aRank; attribute float aRank2; attribute float aSeed; attribute float aSize;
      uniform mat4 uRoot; uniform mat4 uF2; uniform mat4 uF3; uniform float uPs; uniform float uPs2; uniform float uForm; uniform float uFade; uniform float uTime; uniform float uPix; uniform vec3 uPlane;
      ${NOISE_GLSL}
      varying vec3 vC; varying float vA; varying float vS;
      void main(){
        vec2 puv = vec2(position.x / uPlane.x + .5, (position.y - uPlane.z) / uPlane.y + .5);
        float qq = clamp((dsF(puv) * .72 + puv.y * .28 - .2) / .6, 0., 1.);
        float t = clamp((uPs - (.05 + .82 * qq)) * 3.2, 0., 1.);
        float e = t * t * (3. - 2. * t);
        vec3 a = (uRoot * vec4(position, 1.)).xyz;
        vec3 b = (uF2 * vec4(aB, 1.)).xyz;
        float t2 = clamp(uPs2 * 1.6 - 0.6 * aRank2, 0., 1.);
        float e2 = t2 * t2 * (3. - 2. * t2);
        vec3 d = (uF3 * vec4(aD, 1.)).xyz;
        float bulge = sin(e * 3.14159265);
        vec3 sw = vec3(sin(aSeed * 6.283 + uTime * .9), cos(aSeed * 12.57 + uTime * .7), sin(aSeed * 9.42 + uTime * .8));
        // os pixels existem só no robô: ao rolar, ele se desfaz em pixels que sobem e se apagam (não formam mais a peça da dobra 2 nem seguem para a dobra 3)
        vec3 out3 = vec3(.4 + 1.5 * fract(aSeed * 3.1) + sin(aSeed * 91.7) * .5, .5 + 2.1 * fract(aSeed * 7.7), sin(aSeed * 13.1) * .7);
        vec3 p = mix(a, a + out3, e) + sw * bulge * .45;
        vec4 mv = modelViewMatrix * vec4(p, 1.);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = max(aSize * uPix * (9. / max(-mv.z, 1.)) * (1.15 - .5 * e), 1.5);
        vS = e;
        vC = mix(aC0, vec3(1., .27, .03), smoothstep(0., .5, e) * .75);
        vA = smoothstep(0., .05, t) * (1. - smoothstep(.4, .95, e)) * (1. - uForm) * .9;
      }`,
    fragmentShader: `
      varying vec3 vC; varying float vA; varying float vS;
      void main(){ float d = length(gl_PointCoord - .5); if (vA < .01 || d > .5) discard; gl_FragColor = vec4(vC, vA * smoothstep(.5, .12, d)); }`,
  }));
  cloud.frustumCulled = false;
  scene.add(cloud);

  /* ---------- pós-processamento: brilho nas luzes laranja ---------- */
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.6, 0.65, 0.92));
  composer.addPass(new OutputPass());

  /* ---------- estado ---------- */
  const st = { show: 0, assemble: 1 };               // assemble: 1 = peças fora do lugar → 0 = robô montado (entrada de 3 s)
  const story = { t: 0, s: 0 };                      // progresso de rolagem, em "telas" (0 = topo, 1 = fim da 1ª dobra)
  let visible = true, raf = 0;
  const mouse = { x: 0, y: 0 }, cur = { x: 0, y: 0 };
  const sc = { x: 0, y: 0, tx: 0, ty: 0 };           // reação ao scroll (-1..1)
  let baseX = 0, baseY = 0, baseS = 1, hw = 3, halfHv = 2.4, f2X = 1.6, f2Y = 0, f2S = 0.8, f3X = -1.6, f3Y = 0, f3S = 0.8;

  function layout() {
    const w = innerWidth, h = innerHeight, aspect = w / h;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    bgMat.uniforms.uRes.value.set(w, h);
    camera.aspect = aspect; camera.updateProjectionMatrix();
    const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z, halfW = halfH * aspect;
    hw = halfW; halfHv = halfH;
    photoMat.uniforms.uBFade.value = aspect >= 1.15 ? 0 : 1;
    if (aspect >= 1.15) { f2S = clamp(halfH * 0.36, 0.5, 1.3); f2X = halfW * 0.03; f2Y = 0.0; }   // mão com a pasta, do lado direito
    else { f2S = clamp(halfW * 0.5, 0.45, 0.9); f2X = 0; f2Y = -0.25 * halfH; }
    if (aspect >= 1.15) { f3S = clamp(halfH * 0.42, 0.4, 1.5); f3X = 0; f3Y = 0.1 * halfH; }   // carrossel no meio da dobra, entre o título e os cards
    else { f3S = clamp(halfW * 0.5, 0.3, 1.0); f3X = 0; f3Y = 0.1 * halfH; }
    FADE_IN = halfW / f3S * 0.8; FADE_OUT = halfW / f3S * 1.15;
    if (aspect >= 1.15) {
      baseS = Math.min(1.3, Math.max(halfW * 0.2, halfH * 0.34));               // robô de frente, na metade direita da tela
      baseX = halfW * 0.52;
      baseY = 2 * halfH * 0.475 - 1.2 * baseS;         // topo da cabeça a ~10% da altura
    }
    else { baseS = Math.min(0.62, 0.455 * halfW); baseX = 0; baseY = 0.5 * halfH + 1.17 * baseS; }       // cabeça a ~25% da altura; o texto começa abaixo
  }
  layout();
  addEventListener('resize', layout);

  addEventListener('pointermove', (e) => {
    mouse.x = clamp(2 * (e.clientX / innerWidth - 0.5), -1, 1);
    mouse.y = clamp(-2 * (e.clientY / innerHeight - 0.5), -1, 1);
    pointerSeen = true; if (e.pointerType !== 'mouse') touchAt = performance.now() / 1000;
  }, { passive: true });
  addEventListener('pointerdown', (e) => {       // toque: a casca se abre onde o dedo encosta
    if (e.pointerType === 'mouse') return;
    mouse.x = clamp(2 * (e.clientX / innerWidth - 0.5), -1, 1); mouse.y = clamp(-2 * (e.clientY / innerHeight - 0.5), -1, 1);
    pointerSeen = true; touchAt = performance.now() / 1000;
  }, { passive: true });

  const look = { x: 0, y: 0, px: 0, py: 0 };
  const clock = new THREE.Clock();
  function frame() {
    raf = requestAnimationFrame(frame);
    if (!visible) return;
    const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
    const k = 0.075 * Math.min(dt * 60, 3);
    cur.x += (mouse.x - cur.x) * k; cur.y += (mouse.y - cur.y) * k;
    sc.x += (sc.tx - sc.x) * 0.1; sc.y += (sc.ty - sc.y) * 0.1;

    // história da rolagem (lerp 0.1 como no design system):
    //   0 → 1      : o robô se desintegra em pixels discretos que viajam até o lado direito
    //   0.8 → 1    : os pixels formam a mão do robô segurando a pasta de vidro laranja (as malhas surgem)
    //   2.05 → 2.6 : a mão e a pasta voltam a virar pixels, que se dispersam rumo à próxima dobra
    story.s += (story.t - story.s) * 0.1 * Math.min(dt * 60, 3);
    const ps = sstep(0.06, 0.95, story.s);
    const form = sstep(0.8, 1.0, story.s) * (1 - sstep(2.0, 2.4, story.s));   // mão com o carrossel (dobra 2)
    const ps2 = sstep(2.1, 3.0, story.s);                                     // pixels da mão fluem para a esquerda
    const form3 = 0;                                   // biblioteca de referências (dobra 3)
    const intro = 1 - st.show;
    root.scale.setScalar(baseS * (1 + 0.09 * ps));      // câmera: o robô se aproxima enquanto se desfaz em pixels
    // o scroll empurra o corpo no sentido do gesto e inclina a cabeça; tudo volta ao lugar sozinho
    root.position.set(baseX - sc.x * 0.12, baseY + Math.sin(t * 0.7) * 0.05 - intro * 0.6 + sc.y * 0.14, 0);
    root.rotation.y = intro * 0.35 - 0.06 * ps;       // a foto gira só um pouco (paralaxe com o mouse)
    root.rotation.x = 0;
    trailUpdate();
    // rajadas de falha no robô: a cada 3 a 6,5 s, por cerca de meio segundo (a intensidade pisca)
    if (!glitchReduced) {
      if (glitch.until < 0 && t > glitch.next) { glitch.start = t; glitch.dur = 1.1 + Math.random() * 0.5; glitch.until = t + glitch.dur; glitch.next = t + 4.5 + Math.random() * 4; }
      if (glitch.until > 0) {
        if (t > glitch.until) { glitch.until = -1; photoMat.uniforms.uGlitch.value = 0; }
        else { const ph = (t - glitch.start) / glitch.dur; photoMat.uniforms.uGlitch.value = Math.pow(Math.sin(Math.PI * ph), 1.2) * (0.75 + 0.25 * Math.sin(t * 40)); }
      } else photoMat.uniforms.uGlitch.value = 0;
      photoMat.uniforms.uTimeG.value = t;
    }
    const mvx = mouse.x - look.px, mvy = mouse.y - look.py; look.px = mouse.x; look.py = mouse.y;       // o olhar vai para onde o mouse está indo
    look.x += (clamp(mouse.x + mvx * 10, -1, 1) - look.x) * 0.08; look.y += (clamp(mouse.y + mvy * 10, -1, 1) - look.y) * 0.08;
    photoMat.uniforms.uLook.value.set(look.x, look.y);
    photoMat.uniforms.uPs.value = ps; photoMat.uniforms.uShow.value = st.show; photoMesh.scale.setScalar(1 + 0.06 * st.assemble);
    { const ra = st.show * (1 - sstep(0.0, 0.25, ps)); arcA.material.opacity = 0.3 * ra; arcAglow.material.opacity = 0.03 * ra; arcB.material.opacity = 0.1 * ra; arcC.material.opacity = 0.12 * ra;
      headRings.rotation.z = Math.sin(t * 0.25) * 0.05 + cur.x * 0.03; headRings.scale.setScalar(1 + 0.02 * Math.sin(t * 0.6)); }
    visorTxt.material.opacity = st.show * (1 - sstep(0.0, 0.1, ps)); visorTxt.scale.setScalar(1 + 0.06 * st.assemble);
    headPivot.rotation.y = 0.14 + cur.x * 0.32 + Math.sin(t * 0.5) * 0.03 + sc.x * 0.12;
    headPivot.rotation.x = -0.14 - cur.y * 0.12 + sc.y * 0.16;
    headPivot.rotation.z = -0.03 + cur.x * 0.02;
    applyParts(st.assemble, ps);

    // dobra 2: a mão com a pasta flutua do lado direito; cada parte surge quando os pixels chegam
    f2.position.set(f2X, f2Y + Math.sin(t * 0.8) * 0.06, 0);
    f2.scale.setScalar(f2S);
    f2.rotation.set(cur.y * 0.04, cur.x * 0.08, 0);
    for (const p of f2Parts) {
      const tt = clamp(form * (1 + SPREAD) - SPREAD * p.rank, 0, 1);
      const k = Math.max(sstep(0, 0.55, tt), 0.0001);
      p.obj.scale.setScalar(k); p.obj.visible = k > 0.004;
    }
    // carrossel dentro da pasta: a cada 3,4 s outro cartão sobe e os demais recuam
    icons.setVisible(false);
    orbAnimate(t, dt, form > 0.05);
    lineupUpdate(t);
    emberUpdate(t);
    // dobra 3: a biblioteca flutua do lado esquerdo e se monta quando os pixels chegam
    f3.position.set(f3X, f3Y + Math.sin(t * 0.7 + 1) * 0.05, 0);
    f3.scale.setScalar(f3S);
    f3.rotation.set(-0.02 + cur.y * 0.03, 0.1 + cur.x * 0.06 + sc.x * 0.04, 0);
    for (const p of f3Parts) {
      const tt = clamp(form3 * (1 + SPREAD) - SPREAD * p.rank, 0, 1);
      const kk = Math.max(sstep(0, 0.55, tt), 0.0001);
      p.obj.scale.setScalar(kk); p.obj.visible = kk > 0.004;
    }
    if (form3 > 0.02) animateLibrary(t, dt, Math.min(dt * 60, 3), form3 > 0.9);
    else if (hovered >= 0) { hovered = -1; document.documentElement.style.cursor = ''; }
    const fl = Math.sin(t * 0.7 + 1);                                  // sombra no chão: encolhe e clareia quando a janela sobe
    libShadow.visible = form3 > 0.01;
    libShadow.position.set(f3X, f3Y - 1.3 * f3S, -0.5);
    libShadow.scale.set(hw * 1.7 * (0.95 - 0.07 * fl), f3S * 1.5 * (0.95 - 0.07 * fl), 1); libShadow.material.opacity = form3 * (0.7 - 0.14 * fl);
    pu.uPs.value = ps; pu.uPs2.value = ps2; pu.uForm.value = Math.max(form, form3); pu.uFade.value = sstep(2.8, 3.4, story.s); pu.uTime.value = t;

    bgMat.uniforms.uT.value = t; bgMat.uniforms.uS.value = story.s;     // o brilho do fundo anda no tempo e cresce com a rolagem
    renderer.toneMappingExposure = 1.05 * st.show;
    composer.render();
  }
  frame();

  return {
    activate(gsap) {
      if (gsap) {
        gsap.to(st, { show: 1, duration: 1.5, ease: 'power2.out' });
        gsap.to(st, { assemble: 0, duration: 3, ease: 'power2.out' });   // entrada de 3 s: as peças chegam e o robô se forma
      } else { st.show = 1; st.assemble = 0; }
    },
    setProgress(p) { story.t = p; },
    glitch() { const n = clock.elapsedTime; glitch.start = n; glitch.dur = 0.7; glitch.until = n + 0.7; },
    setLineup(r, p, h) { lineupRects = r; lineupPops = p; lineupHov = h || []; },
    setScroll(x, y) { sc.tx = x; sc.ty = y; },
    setVisible(v) { visible = v; if (v) clock.getDelta(); },
    destroy() { cancelAnimationFrame(raf); renderer.dispose(); },
  };
}
