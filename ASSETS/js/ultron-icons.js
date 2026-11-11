// Ultron — ícones 3D do carrossel (three.js, procedural).
// Cada ícone representa o conteúdo do seu card: download (Downloads), engrenagem (outra ferramenta)
// e pasta (projeto antigo). Mesmo acabamento do robô: cromado escuro com reflexos e detalhes em laranja #FF6B00.
// Um único renderizador desenha os três e copia cada resultado para o <canvas> do respectivo card.
import * as THREE from 'three';

const ACCENT = 0xFF6B00;

const poly = (pts) => {
  const s = new THREE.Shape();
  pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  return s;
};
const extrude = (shape, depth = 0.34, center = true) => {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.09, bevelSegments: 8, curveSegments: 28 });
  if (center) g.center();
  return g;
};
function gearShape(teeth = 8, rIn = 0.72, rOut = 0.98, holeR = 0.34) {
  const s = new THREE.Shape();
  for (let i = 0; i < teeth; i++) {
    const a = i * 2 * Math.PI / teeth;
    [[rIn, a - 0.27], [rOut, a - 0.13], [rOut, a + 0.13], [rIn, a + 0.27]].forEach(([r, t], k) => {
      const x = Math.cos(t) * r, y = Math.sin(t) * r;
      (i === 0 && k === 0) ? s.moveTo(x, y) : s.lineTo(x, y);
    });
  }
  s.closePath();
  const hole = new THREE.Path();
  hole.absarc(0, 0, holeR, 0, Math.PI * 2, true);
  s.holes.push(hole);
  return s;
}

export function createIcons(canvases, kinds = ['download', 'gear', 'folder']) {
  const N = canvases.length;
  const SIZE = canvases[0].width || 320;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(SIZE, SIZE, false);
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  /* ambiente: painéis de luz (brancos e laranja) que viram os reflexos no cromado */
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x000000);
  const panel = (w, h, color, k, pos) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide, toneMapped: false }));
    m.position.set(...pos); m.lookAt(0, 0, 0); envScene.add(m);
  };
  panel(7, 1.8, 0xffffff, 2.8, [-4, 5, 3]);
  panel(5, 7, 0xffffff, 1.0, [-6, 0.5, 4.5]);
  panel(2.2, 7, 0xffffff, 1.5, [6, 0.5, 3.5]);
  panel(7, 5, 0xffffff, 0.9, [1, 1, 9]);
  panel(6, 4.5, ACCENT, 3.0, [-5, -2.5, 3.5]);
  panel(1.6, 7, ACCENT, 4.2, [5.5, 0.5, -2.5]);
  panel(6, 2, ACCENT, 1.4, [0, -5.5, 2.5]);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(envScene, 0.03).texture;
  pmrem.dispose();

  const dark = new THREE.MeshPhysicalMaterial({ color: 0x1d0c05, metalness: 0.95, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.5 });
  const silver = new THREE.MeshPhysicalMaterial({ color: 0xcfcfd6, metalness: 1, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.3 });
  const hot = new THREE.MeshPhysicalMaterial({ color: 0xff6b00, metalness: 0.35, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.08, emissive: 0xff4a00, emissiveIntensity: 0.28, envMapIntensity: 1.2 });

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 30);
  camera.position.set(0, 0, 6.4);

  const builders = {
    // seta para baixo sobre uma bandeja
    download() {
      const g = new THREE.Group();
      const arrow = new THREE.Mesh(extrude(poly([[-0.34, 0.95], [0.34, 0.95], [0.34, 0.28], [0.78, 0.28], [0, -0.52], [-0.78, 0.28], [-0.34, 0.28]])), hot);
      arrow.position.y = 0.38;
      const tray = new THREE.Mesh(extrude(poly([[-1, -0.28], [-0.72, -0.28], [-0.72, -0.74], [0.72, -0.74], [0.72, -0.28], [1, -0.28], [1, -1.02], [-1, -1.02]]), 0.34), dark);
      tray.position.y = -0.62;
      g.add(arrow, tray);
      return g;
    },
    // engrenagem com anel de luz no miolo
    gear() {
      const g = new THREE.Group();
      const body = new THREE.Mesh(extrude(gearShape(), 0.34), dark);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.05, 20, 64), hot);
      ring.position.z = 0.0;
      g.add(body, ring);
      g.userData.spin = true;
      return g;
    },
    // pasta: aba atrás e frente em laranja
    folder() {
      const g = new THREE.Group();
      const back = new THREE.Mesh(extrude(poly([[-1, -0.68], [-1, 0.68], [-0.3, 0.68], [-0.06, 0.42], [1, 0.42], [1, -0.68]]), 0.34), dark);
      back.position.z = -0.1;
      const front = new THREE.Mesh(extrude(poly([[-1, -0.68], [-0.88, 0.16], [1.08, 0.16], [1, -0.68]]), 0.16), hot);
      front.position.set(0, -0.08, 0.2);
      g.add(back, front);
      return g;
    },
    // moldura de imagem grande, com paisagem em laranja (prévias grandes)
    preview() {
      const g = new THREE.Group();
      const frame = new THREE.Mesh(extrude(poly([[-1.1, -0.82], [1.1, -0.82], [1.1, 0.82], [-1.1, 0.82]]), 0.3), dark);
      const pic = new THREE.Mesh(extrude(poly([[-0.9, -0.62], [0.9, -0.62], [0.9, 0.62], [-0.9, 0.62]]), 0.1), hot);
      pic.position.z = 0.2;
      const mountains = new THREE.Mesh(extrude(poly([[-0.9, -0.62], [-0.35, 0.1], [0, -0.28], [0.38, 0.28], [0.9, -0.62]]), 0.1, false), dark);
      mountains.position.z = 0.26;
      const sun = new THREE.Mesh(new THREE.SphereGeometry(0.17, 32, 24), dark);
      sun.position.set(0.52, 0.34, 0.36);
      g.add(frame, pic, mountains, sun);
      return g;
    },
    // etiqueta com furo e linhas de texto (nome, categoria e tags)
    tag() {
      const g = new THREE.Group(), inner = new THREE.Group();
      const shape = new THREE.Shape();
      shape.moveTo(-0.95, 0.58); shape.lineTo(0.3, 0.58); shape.lineTo(1.0, 0); shape.lineTo(0.3, -0.58); shape.lineTo(-0.95, -0.58); shape.closePath();
      const hole = new THREE.Path(); hole.absarc(-0.58, 0, 0.15, 0, Math.PI * 2, true); shape.holes.push(hole);
      const body = new THREE.Mesh(extrude(shape, 0.3, false), hot);
      body.position.z = -0.15;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.045, 16, 48), silver);
      ring.position.set(-0.58, 0, 0);
      const l1 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.09, 0.1), dark); l1.position.set(0.06, 0.14, 0.2);
      const l2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.09, 0.1), dark); l2.position.set(-0.09, -0.12, 0.2);
      inner.add(body, ring, l1, l2); inner.rotation.z = 0.4;
      g.add(inner);
      return g;
    },
    // pasta com anel de luz (pasta monitorada)
    monitor() {
      const g = builders.folder();
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.05, 16, 48), dark);
      ring.position.set(0.12, -0.12, 0.46);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.11, 24, 18), hot);
      eye.position.set(0.12, -0.12, 0.48);
      g.add(ring, eye);
      return g;
    },
    // estrela de quatro pontas (gerar design system)
    spark() {
      const g = new THREE.Group();
      const star = (rOut, rIn) => poly(Array.from({ length: 8 }, (_, i) => {
        const r = i % 2 ? rIn : rOut, a = i * Math.PI / 4 + Math.PI / 2;
        return [Math.cos(a) * r, Math.sin(a) * r];
      }));
      const big = new THREE.Mesh(extrude(star(1.05, 0.3), 0.3), dark);
      const small = new THREE.Mesh(extrude(star(0.5, 0.15), 0.2), silver);
      small.position.set(0.9, 0.82, 0.0);
      g.add(big, small);
      g.position.x = -0.1;
      return g;
    },
  };

  const items = canvases.map((canvas, i) => {
    const scene = new THREE.Scene();
    scene.environment = env;
    const group = builders[kinds[i % kinds.length]]();
    group.scale.setScalar(1.05);
    scene.add(group);
    const rim = new THREE.PointLight(ACCENT, 14, 12, 2);
    rim.position.set(2.4, 1.2, 3.2);
    scene.add(rim);
    return { scene, group, ctx: canvas.getContext('2d'), canvas };
  });

  const mouse = { x: 0, y: 0 };
  addEventListener('pointermove', (e) => {
    mouse.x = Math.max(-1, Math.min(1, 2 * (e.clientX / innerWidth - 0.5)));
    mouse.y = Math.max(-1, Math.min(1, -2 * (e.clientY / innerHeight - 0.5)));
  }, { passive: true });

  let visible = true, raf = 0;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!visible) return;
    const t = reduce ? 0 : now / 1000;
    items.forEach((it, i) => {
      const g = it.group;
      if (g.userData.spin) { g.rotation.z = t * 0.5; g.rotation.y = Math.sin(t * 0.6) * 0.5 + mouse.x * 0.35; }
      else g.rotation.y = Math.sin(t * 0.7 + i * 1.3) * 0.75 + mouse.x * 0.35;
      g.rotation.x = -0.2 + Math.sin(t * 0.5 + i) * 0.08 + mouse.y * 0.2;
      g.position.y = Math.sin(t * 0.9 + i) * 0.05;
      renderer.render(it.scene, camera);
      it.ctx.clearRect(0, 0, SIZE, SIZE);
      it.ctx.drawImage(renderer.domElement, 0, 0, SIZE, SIZE);
    });
  }
  raf = requestAnimationFrame(frame);

  return {
    setVisible(v) { visible = v; },
    destroy() { cancelAnimationFrame(raf); renderer.dispose(); },
  };
}
