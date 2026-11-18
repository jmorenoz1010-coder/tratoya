// Visor 3D procedural de las villas de Cayetana (arquitectura mediterránea en el Caribe).
// Construye la villa sobre la forma real del lote, con ciclo solar, acabados y vista interior.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { gsap } from 'gsap';
import { MAP } from './store.js';

const TYPES = {
  Savina: { w: 11, d: 9.5, floors: 1, arches: 0, rooftop: true, h: 3.4 },
  Eivissa: { w: 10, d: 10.5, floors: 2, arches: 3, rooftop: false, h: 3.3 },
  Macarella: { w: 12, d: 11.5, floors: 2, arches: 4, rooftop: true, h: 3.3 },
};

export const FINISHES = {
  facade: { 'Estuco arena': 0xeee3d3, 'Blanco cal': 0xf6f3ee, 'Piedra coralina': 0xd8c7ad },
  wood: { 'Teca': 0x8a5a3b, 'Nogal': 0x5b3a29, 'Roble claro': 0xb08a62 },
};

function causticTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#2aa8bd'; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(220,255,255,0.35)'; g.lineWidth = 2;
  for (let i = 0; i < 60; i++) {
    g.beginPath();
    const x = Math.random() * 256, y = Math.random() * 256, r = 10 + Math.random() * 26;
    g.ellipse(x, y, r, r * (0.5 + Math.random() * 0.5), Math.random() * 3, 0, Math.PI * 2); g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2);
  t.colorSpace = THREE.SRGBColorSpace; return t;
}

function latticeTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#000';
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { g.beginPath(); g.arc(16 + x * 32, 16 + y * 32, 11, 0, Math.PI * 2); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

function grassTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#6f8f47'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4000; i++) {
    g.fillStyle = `hsl(${80 + Math.random() * 25},${35 + Math.random() * 20}%,${28 + Math.random() * 18}%)`;
    g.fillRect(Math.random() * 256, Math.random() * 256, 1.5, 3);
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(8, 8);
  t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function makePalm(scale = 1, mats) {
  const g = new THREE.Group();
  const trunkMat = mats?.trunk || new THREE.MeshStandardMaterial({ color: 0x8b7355, roughness: 1 });
  const leafMat = mats?.leaf || new THREE.MeshStandardMaterial({ color: 0x4f7a32, roughness: 0.8, side: THREE.DoubleSide });
  const h = (7 + Math.random() * 3) * scale;
  const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.6 * scale, h * 0.5, 0), new THREE.Vector3(Math.random() * 1.2 * scale, h, 0));
  const trunk = new THREE.Mesh(new THREE.TubeGeometry(curve, 8, 0.18 * scale, 6), trunkMat);
  trunk.castShadow = true; g.add(trunk);
  const top = curve.getPoint(1);
  const leafGeo = new THREE.PlaneGeometry(0.9 * scale, 3.6 * scale, 1, 4);
  const pos = leafGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) + 1.8 * scale; // 0..3.6
    pos.setY(i, y); pos.setZ(i, -0.12 * y * y / scale);
    pos.setX(i, pos.getX(i) * Math.sin(Math.PI * (y / (3.6 * scale))) * 1.2);
  }
  leafGeo.computeVertexNormals();
  const n = 9;
  for (let i = 0; i < n; i++) {
    const leaf = new THREE.Mesh(leafGeo, leafMat);
    leaf.position.copy(top);
    leaf.rotation.order = 'YXZ';
    leaf.rotation.y = (i / n) * Math.PI * 2 + Math.random() * 0.3;
    leaf.rotation.x = -Math.PI / 2 + 0.5 + Math.random() * 0.4;
    leaf.castShadow = true; g.add(leaf);
  }
  g.rotation.y = Math.random() * Math.PI * 2;
  return g;
}

export function createVillaViewer(container, opts = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.55;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xcfd8d6, 90, 260);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 2000);
  camera.position.set(26, 18, 30);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.maxPolarAngle = Math.PI * 0.49; controls.minDistance = 6; controls.maxDistance = 90;
  controls.target.set(0, 3, 0); controls.autoRotate = true; controls.autoRotateSpeed = 0.6;

  const sky = new Sky(); sky.scale.setScalar(4500); scene.add(sky);
  const su = sky.material.uniforms;
  su.turbidity.value = 4; su.rayleigh.value = 2.4; su.mieCoefficient.value = 0.005; su.mieDirectionalG.value = 0.8;
  const pmrem = new THREE.PMREMGenerator(renderer);
  let envRT = null;

  const hemi = new THREE.HemisphereLight(0xdfefff, 0x7a6a4f, 0.6); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 200 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);

  // materiales
  const mats = {
    stucco: new THREE.MeshStandardMaterial({ color: FINISHES.facade['Estuco arena'], roughness: 0.92 }),
    stone: new THREE.MeshStandardMaterial({ color: 0xd9cbb2, roughness: 0.95 }),
    wood: new THREE.MeshStandardMaterial({ color: FINISHES.wood['Teca'], roughness: 0.65 }),
    terracotta: new THREE.MeshStandardMaterial({ color: 0xb86b45, roughness: 0.8 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x2a2623, roughness: 0.5, metalness: 0.6 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x9db4bb, roughness: 0.04, metalness: 0.2, transparent: true, opacity: 0.42, emissive: 0xffb36b, emissiveIntensity: 0, envMapIntensity: 1.4 }),
    water: new THREE.MeshStandardMaterial({ map: causticTexture(), roughness: 0.05, metalness: 0.15, transparent: true, opacity: 0.92, emissive: 0x1a8fa3, emissiveIntensity: 0 }),
    grass: new THREE.MeshStandardMaterial({ map: grassTexture(), roughness: 1 }),
    sand: new THREE.MeshStandardMaterial({ color: 0xe6dcc6, roughness: 1 }),
    fabric: new THREE.MeshStandardMaterial({ color: 0xf2ece2, roughness: 1 }),
    interior: new THREE.MeshStandardMaterial({ color: 0xcdbca4, roughness: 0.9 }),
    lattice: new THREE.MeshStandardMaterial({ color: FINISHES.facade['Estuco arena'], alphaMap: latticeTexture(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9 }),
    lot: new THREE.LineBasicMaterial({ color: 0xffffff }),
    leaf: new THREE.MeshStandardMaterial({ color: 0x4f7a32, roughness: 0.8, side: THREE.DoubleSide }),
    trunk: new THREE.MeshStandardMaterial({ color: 0x8b7355, roughness: 1 }),
  };
  mats.lattice.alphaMap.repeat.set(2, 5);

  const ground = new THREE.Mesh(new THREE.CircleGeometry(400, 64), new THREE.MeshStandardMaterial({ color: 0x8c9a64, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

  const root = new THREE.Group(); scene.add(root);
  let upperGroup = null, interiorGroup = null, villaGroup = null, lotGroup = null;
  const nightLights = [];
  let current = { type: opts.typology || 'Eivissa', lot: opts.lot || null, showVilla: true, interior: false, hour: 16.5 };

  function add(parent, geo, mat, x = 0, y = 0, z = 0, cast = true) {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; parent.add(m); return m;
  }
  const box = (p, w, h, d, mat, x, y, z) => add(p, new THREE.BoxGeometry(w, h, d), mat, x, y + h / 2, z);

  function archShape(x, sill, aw, ah) {
    const r = aw / 2, p = new THREE.Path();
    p.moveTo(x - r, sill); p.lineTo(x + r, sill); p.lineTo(x + r, sill + ah - r);
    p.absarc(x, sill + ah - r, r, 0, Math.PI, false); p.lineTo(x - r, sill);
    return p;
  }
  function archWall(w, h, n, t) {
    const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, h); s.lineTo(-w / 2, h); s.lineTo(-w / 2, 0);
    const aw = Math.min(1.9, (w - 1) / n - 0.5), ah = h - 0.75, gap = w / n;
    const xs = [];
    for (let i = 0; i < n; i++) { const x = -w / 2 + gap * (i + 0.5); xs.push(x); s.holes.push(archShape(x, 0.1, aw, ah)); }
    const g = new THREE.Group();
    add(g, new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false }), mats.stucco);
    xs.forEach(x => {
      // marco terracota
      const fr = new THREE.Shape(archShape(x, 0.1, aw + 0.28, ah + 0.14).getPoints(24));
      fr.holes.push(new THREE.Path(archShape(x, 0.1, aw, ah).getPoints(24)));
      add(g, new THREE.ExtrudeGeometry(fr, { depth: 0.08, bevelEnabled: false }), mats.terracotta, 0, 0, t);
      // vidrio retranqueado
      const glassShape = new THREE.Shape(archShape(x, 0.1, aw, ah).getPoints(24));
      add(g, new THREE.ShapeGeometry(glassShape), mats.glass, 0, 0, t * 0.3, false);
      // celosía de madera en el semicírculo
      const lam = add(g, new THREE.BoxGeometry(aw, 0.05, 0.06), mats.wood, x, ah - aw / 2 + 0.1, t * 0.45, false);
      lam.castShadow = false;
    });
    return g;
  }

  function railing(parent, len, x, y, z, rotY = 0) {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rotY; parent.add(g);
    box(g, len, 0.05, 0.06, mats.metal, 0, 1.0, 0);
    const n = Math.floor(len / 0.14);
    const bars = new THREE.InstancedMesh(new THREE.BoxGeometry(0.025, 1, 0.025), mats.metal, n);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < n; i++) { m4.makeTranslation(-len / 2 + (i + 0.5) * (len / n), 0.5, 0); bars.setMatrixAt(i, m4); }
    bars.castShadow = true; g.add(bars);
  }

  function pergola(parent, w, d, x, y, z, slatsAlongX = true) {
    const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
    const ph = 3.0;
    [[-w / 2, d / 2], [w / 2, d / 2]].forEach(([px, pz]) => box(g, 0.28, ph, 0.28, mats.wood, px, 0, pz));
    box(g, w + 0.4, 0.3, 0.3, mats.wood, 0, ph, d / 2);
    box(g, 0.3, 0.3, d, mats.wood, -w / 2, ph, 0); box(g, 0.3, 0.3, d, mats.wood, w / 2, ph, 0);
    const n = Math.round((slatsAlongX ? d : w) / 0.35);
    for (let i = 0; i < n; i++) {
      const t = -0.5 + (i + 0.5) / n;
      if (slatsAlongX) box(g, w, 0.16, 0.08, mats.wood, 0, ph + 0.3, t * d);
      else box(g, 0.08, 0.16, d, mats.wood, t * w, ph + 0.3, 0);
    }
    return g;
  }

  function lounger(parent, x, z, rot = 0) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; parent.add(g);
    box(g, 0.75, 0.32, 2.0, mats.wood, 0, 0, 0);
    box(g, 0.7, 0.12, 1.4, mats.fabric, 0, 0.32, 0.25);
    const back = box(g, 0.7, 0.1, 0.75, mats.fabric, 0, 0.5, -0.6); back.rotation.x = -0.7;
  }

  function buildInterior(w, d, h) {
    const g = new THREE.Group();
    // sala
    box(g, 3, 0.45, 0.9, mats.fabric, -w / 2 + 2.4, 0.3, d / 2 - 2.2);
    box(g, 0.9, 0.45, 2.2, mats.fabric, -w / 2 + 1.3, 0.3, d / 2 - 3.2);
    box(g, 1.2, 0.35, 0.7, mats.wood, -w / 2 + 2.6, 0.3, d / 2 - 3.4);
    // comedor
    box(g, 2.2, 0.75, 1.0, mats.wood, 0.6, 0.3, d / 2 - 2.6);
    for (let i = 0; i < 3; i++) { box(g, 0.45, 0.5, 0.45, mats.interior, -0.2 + i * 0.8, 0.3, d / 2 - 1.8); box(g, 0.45, 0.5, 0.45, mats.interior, -0.2 + i * 0.8, 0.3, d / 2 - 3.4); }
    // cocina
    box(g, 2.6, 0.9, 0.9, mats.stone, w / 2 - 2.2, 0.3, -d / 2 + 2.4);
    box(g, 4, 0.9, 0.6, mats.stone, w / 2 - 2.5, 0.3, -d / 2 + 0.6);
    // muros interiores
    box(g, 0.12, h - 0.4, d * 0.45, mats.stucco, -0.6, 0.3, -d / 2 + d * 0.225 + 0.2);
    return g;
  }

  function buildVilla(type) {
    const P = TYPES[type];
    const g = new THREE.Group();
    const { w, d, h } = P;
    const plinth = 0.3;
    nightLights.length = 0;
    // plataforma y terraza
    box(g, w + 2, plinth, d + 8.5, mats.stone, 0, 0, 3.4);
    const base = new THREE.Group(); base.position.y = plinth; g.add(base);
    // planta baja
    box(base, w, 0.15, d, mats.stone, 0, 0, 0);
    box(base, w, h, 0.3, mats.stucco, 0, 0, -d / 2 + 0.15);
    box(base, 0.3, h, d, mats.stucco, -w / 2 + 0.15, 0, 0);
    box(base, 0.3, h, d, mats.stucco, w / 2 - 0.15, 0, 0);
    // fachada acristalada con perfilería
    const gw = w - 0.6;
    add(base, new THREE.PlaneGeometry(gw, h - 0.2), mats.glass, 0, h / 2, d / 2 - 0.35, false);
    const nm = Math.round(gw / 1.6);
    for (let i = 0; i <= nm; i++) box(base, 0.06, h - 0.2, 0.08, mats.metal, -gw / 2 + (i * gw) / nm, 0, d / 2 - 0.35);
    // interior
    interiorGroup = buildInterior(w, d, h); base.add(interiorGroup);
    // luz cálida interior
    const pl = new THREE.PointLight(0xffb36b, 0, 14, 1.6); pl.position.set(0, h - 0.6, 0); base.add(pl); nightLights.push(pl);

    upperGroup = new THREE.Group(); upperGroup.position.y = h; base.add(upperGroup);
    box(upperGroup, w + 0.2, 0.3, d + 0.2, mats.stucco, 0, 0, 0); // losa
    let topY = 0.3;
    if (P.floors === 2) {
      const ud = d - 2.2, uz = -1.1;
      const uh = h;
      const wall = archWall(w, uh, P.arches, 0.3); wall.position.set(0, topY, uz + ud / 2 - 0.3); upperGroup.add(wall);
      box(upperGroup, w, uh, 0.3, mats.stucco, 0, topY, uz - ud / 2 + 0.15);
      box(upperGroup, 0.3, uh, ud, mats.stucco, -w / 2 + 0.15, topY, uz);
      box(upperGroup, 0.3, uh, ud, mats.stucco, w / 2 - 0.15, topY, uz);
      const pl2 = new THREE.PointLight(0xffb36b, 0, 12, 1.6); pl2.position.set(0, topY + uh - 0.7, uz); upperGroup.add(pl2); nightLights.push(pl2);
      railing(upperGroup, w - 0.4, 0, topY, d / 2 - 0.05);
      topY += uh;
      box(upperGroup, w + 0.3, 0.32, ud + 0.3, mats.stucco, 0, topY, uz); topY += 0.32;
      if (P.rooftop) {
        railing(upperGroup, w - 0.2, 0, topY, uz + ud / 2);
        railing(upperGroup, ud, -w / 2 + 0.1, topY, uz, Math.PI / 2);
        railing(upperGroup, ud, w / 2 - 0.1, topY, uz, Math.PI / 2);
        box(upperGroup, w * 0.45, 2.6, 2.4, mats.stucco, -w / 2 + w * 0.225 + 0.1, topY, uz - ud / 2 + 1.3);
        const jac = add(upperGroup, new THREE.CylinderGeometry(1.1, 1.1, 0.6, 32), mats.stone, w / 2 - 2, topY + 0.3, uz + 0.6);
        add(upperGroup, new THREE.CylinderGeometry(0.95, 0.95, 0.05, 32), mats.water, w / 2 - 2, topY + 0.58, uz + 0.6, false);
        jac.castShadow = true;
      }
    } else {
      // Savina: rooftop sobre una sola planta
      railing(upperGroup, w - 0.3, 0, topY, d / 2 - 0.1);
      railing(upperGroup, d - 0.3, -w / 2 + 0.1, topY, 0, Math.PI / 2);
      pergola(upperGroup, w * 0.5, 4, w * 0.2, topY, -d / 2 + 2.3, false);
      box(upperGroup, 2.4, 2.6, 2.4, mats.stucco, -w / 2 + 1.4, topY, -d / 2 + 1.4);
      lounger(upperGroup, -0.5, 0.5, 0.2); lounger(upperGroup, 0.6, 0.5, 0.2);
    }
    // celosía mediterránea lateral
    const lat = add(base, new THREE.PlaneGeometry(2.6, h * (P.floors) + 0.6), mats.lattice, -w / 2 - 1.2, (h * P.floors + 0.6) / 2, d / 2 - 1.2);
    lat.rotation.y = Math.PI / 2;
    box(base, 0.25, h * P.floors + 0.6, 0.25, mats.stucco, -w / 2 - 1.2, 0, d / 2 + 0.1);
    box(base, 0.25, h * P.floors + 0.6, 0.25, mats.stucco, -w / 2 - 1.2, 0, d / 2 - 2.5);

    // pérgola delantera + terraza
    pergola(base, w + 0.6, 4.2, 0, 0, d / 2 + 2.1);
    box(base, 1.8, 0.75, 0.9, mats.wood, w / 2 - 2, 0, d / 2 + 2.2);
    // piscina infinita
    const pw = w * 0.82, pl_ = 4, pz = d / 2 + 4.2 + pl_ / 2 + 0.6;
    box(base, pw + 0.6, 0.12, 0.3, mats.stone, 0, -0.05, pz - pl_ / 2 - 0.15);
    box(base, 0.3, 0.12, pl_, mats.stone, -pw / 2 - 0.15, -0.05, pz);
    box(base, 0.3, 0.12, pl_, mats.stone, pw / 2 + 0.15, -0.05, pz);
    add(base, new THREE.PlaneGeometry(pw, pl_), mats.water, 0, 0.0, pz, false).rotation.x = -Math.PI / 2;
    const poolLight = new THREE.PointLight(0x45d6e8, 0, 9, 1.5); poolLight.position.set(0, 0.2, pz); base.add(poolLight); nightLights.push(poolLight);
    lounger(base, -pw / 2 + 0.6, pz - pl_ / 2 - 1.5, Math.PI / 2);
    lounger(base, -pw / 2 + 1.6, pz - pl_ / 2 - 1.5, Math.PI / 2);
    // mesh de vegetación baja
    for (let i = 0; i < 10; i++) {
      const b = add(base, new THREE.SphereGeometry(0.5 + Math.random() * 0.5, 10, 8), mats.leaf, (Math.random() < 0.5 ? -1 : 1) * (w / 2 + 0.8 + Math.random()), 0.3, -d / 2 + Math.random() * d);
      b.scale.y = 0.75;
    }
    g.userData = { w, d, h, top: plinth + h + topY, poolZ: pz };
    return g;
  }

  function buildLot(lot) {
    const g = new THREE.Group();
    let pts;
    if (lot) {
      const s = 1 / MAP.pxPerM;
      // rotar para que el eje largo del lote quede en Z (profundidad)
      const a = -lot.angle + Math.PI / 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      pts = lot.pts.map(([x, y]) => {
        const dx = (x - lot.cx) * s, dy = (y - lot.cy) * s;
        return new THREE.Vector2(dx * ca - dy * sa, dx * sa + dy * ca);
      });
    } else {
      pts = [[-9, -14], [9, -14], [9, 16], [-9, 16]].map(([x, y]) => new THREE.Vector2(x, y));
    }
    const shape = new THREE.Shape(pts);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.18, bevelEnabled: false });
    const m = new THREE.Mesh(geo, mats.grass); m.rotation.x = Math.PI / 2; m.position.y = 0.18; m.receiveShadow = true; g.add(m);
    // línea de lindero y estacas
    const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts.map(p => new THREE.Vector3(p.x, 0.22, p.y))), mats.lot);
    g.add(line);
    pts.forEach(p => box(g, 0.12, 0.9, 0.12, mats.wood, p.x, 0.18, p.y));
    // dimensiones
    const bb = new THREE.Box2().setFromPoints(pts);
    g.userData = { width: bb.max.x - bb.min.x, depth: bb.max.y - bb.min.y, cy: (bb.max.y + bb.min.y) / 2, minY: bb.min.y, maxY: bb.max.y };
    // palmeras en el perímetro
    for (let i = 0; i < 5; i++) {
      const p = pts[Math.floor(Math.random() * pts.length)];
      const palm = makePalm(0.9, mats); palm.position.set(p.x * 0.85, 0.2, p.y * 0.9); g.add(palm);
    }
    return g;
  }

  function rebuild() {
    root.clear();
    lotGroup = buildLot(current.lot); root.add(lotGroup);
    villaGroup = null;
    if (current.showVilla) {
      villaGroup = buildVilla(current.type);
      const L = lotGroup.userData, V = villaGroup.userData;
      // escala suave si el lote es más angosto que la villa
      const sc = Math.min(1, (L.width - 1.5) / (V.w + 2), (L.depth - 1) / (V.d + 13));
      villaGroup.scale.setScalar(Math.max(0.7, sc));
      // villa al fondo del lote, piscina hacia el frente
      villaGroup.position.z = L.minY + (V.d / 2 + 1.2) * villaGroup.scale.x;
      root.add(villaGroup);
    }
    // envolvente de la vegetación lejana
    const ring = new THREE.Group();
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2, r = 32 + Math.random() * 25;
      const palm = makePalm(1 + Math.random() * 0.3, mats); palm.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); ring.add(palm);
    }
    root.add(ring);
    setTime(current.hour);
    setInterior(current.interior, true);
  }

  // --- ciclo solar ---
  const sunPos = new THREE.Vector3();
  let envTimer = null;
  function setTime(hour) {
    current.hour = hour;
    const t = (hour - 6) / 12; // 0 amanecer, 1 atardecer
    const elev = Math.sin(Math.PI * Math.min(Math.max(t, -0.08), 1.08)) * 62; // grados
    const az = 90 - t * 180 + 20;
    const phi = THREE.MathUtils.degToRad(90 - elev), theta = THREE.MathUtils.degToRad(az);
    sunPos.setFromSphericalCoords(1, phi, theta);
    su.sunPosition.value.copy(sunPos);
    sun.position.copy(sunPos).multiplyScalar(80); sun.target.position.set(0, 0, 0);
    const day = THREE.MathUtils.clamp(elev / 25, 0, 1);
    const golden = 1 - THREE.MathUtils.clamp(Math.abs(elev - 6) / 18, 0, 1);
    sun.intensity = 0.2 + day * 2.8;
    sun.color.setHSL(0.08 + day * 0.04, 0.6 * (1 - day) + 0.15, 0.55 + day * 0.2);
    hemi.intensity = 0.12 + day * 0.55;
    const night = elev < 2;
    renderer.toneMappingExposure = night ? 0.32 : 0.45 + day * 0.1;
    scene.fog.color.setHSL(0.08, 0.25, 0.25 + day * 0.55);
    const warm = night ? 1 : golden * 0.6;
    mats.glass.emissiveIntensity = warm * 0.9;
    mats.water.emissiveIntensity = night ? 0.8 : 0;
    nightLights.forEach(l => (l.intensity = night ? 18 : golden * 6));
    if (night) { sun.intensity = 0.25; sun.color.set(0x9db7ff); hemi.color.set(0x3a4a7a); hemi.intensity = 0.25; }
    else hemi.color.set(0xdfefff);
    clearTimeout(envTimer);
    envTimer = setTimeout(() => {
      if (envRT) envRT.dispose();
      const tmp = new THREE.Scene(); const s2 = new Sky(); s2.scale.setScalar(4500);
      Object.keys(su).forEach(k => s2.material.uniforms[k].value = su[k].value);
      tmp.add(s2);
      envRT = pmrem.fromScene(tmp, 0.04); scene.environment = envRT.texture;
      scene.environmentIntensity = night ? 0.15 : 0.6;
    }, 60);
  }

  function setInterior(on, instant = false) {
    current.interior = on;
    if (!upperGroup) return;
    const P = TYPES[current.type];
    gsap.to(upperGroup.position, { y: P.h + (on ? 7 : 0), duration: instant ? 0 : 1.2, ease: 'power3.inOut' });
    upperGroup.traverse(o => { if (o.material && o.material !== mats.glass) { o.material.transparent = false; } });
  }

  const PRESETS = {
    aerea: () => ({ pos: [24, 22, 30], target: [0, 2, 0] }),
    fachada: () => { const z = villaGroup ? villaGroup.position.z : 0; return { pos: [0, 3.4, z + 30], target: [0, 4, z] }; },
    piscina: () => { const z = villaGroup ? villaGroup.position.z + villaGroup.userData.poolZ * villaGroup.scale.x : 8; return { pos: [-9, 2.2, z + 6], target: [2, 2, z - 6] }; },
    rooftop: () => { const z = villaGroup ? villaGroup.position.z : 0; const y = villaGroup ? villaGroup.userData.top * villaGroup.scale.x + 1.6 : 8; return { pos: [-2, y, z - 1], target: [1, y - 1.2, z + 18] }; },
  };
  function preset(name) {
    const p = PRESETS[name]?.(); if (!p) return;
    controls.autoRotate = false;
    gsap.to(camera.position, { x: p.pos[0], y: p.pos[1], z: p.pos[2], duration: 1.6, ease: 'power3.inOut' });
    gsap.to(controls.target, { x: p.target[0], y: p.target[1], z: p.target[2], duration: 1.6, ease: 'power3.inOut' });
    if (name === 'rooftop') controls.minDistance = 0.5; else controls.minDistance = 6;
  }

  function setFinish(kind, name) {
    const c = FINISHES[kind][name]; if (c == null) return;
    if (kind === 'facade') { mats.stucco.color.setHex(c); mats.lattice.color.setHex(c); } else mats.wood.color.setHex(c);
  }

  // render loop
  const clock = new THREE.Clock();
  let raf = 0, visible = true;
  const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting)); io.observe(container);
  function resize() {
    const w = container.clientWidth || 1, h = container.clientHeight || 1;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize); ro.observe(container); resize();
  function loop() {
    raf = requestAnimationFrame(loop);
    if (!visible) return;
    const dt = clock.getDelta();
    mats.water.map.offset.x += dt * 0.02; mats.water.map.offset.y += dt * 0.013;
    controls.update();
    renderer.render(scene, camera);
  }
  rebuild(); loop();
  renderer.domElement.addEventListener('pointerdown', () => (controls.autoRotate = false));

  return {
    setTypology(t) { current.type = t; rebuild(); },
    setLot(l) { current.lot = l; rebuild(); },
    showVilla(v) { current.showVilla = v; rebuild(); },
    setTime, setFinish, preset,
    toggleInterior() { setInterior(!current.interior); return current.interior; },
    autoRotate(v) { controls.autoRotate = v; },
    snapshot() { renderer.render(scene, camera); return renderer.domElement.toDataURL('image/jpeg', 0.9); },
    dispose() {
      cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); controls.dispose();
      scene.traverse(o => { o.geometry?.dispose?.(); });
      envRT?.dispose(); pmrem.dispose(); renderer.dispose(); renderer.domElement.remove();
    },
  };
}
