// Maqueta virtual 3D del masterplan: lotes reales extruidos sobre el plano, villas, palmeras y ciclo día/noche.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { gsap } from 'gsap';
import { lots, MAP, STATUS, matches } from './store.js';
import { AMENITIES } from './config.js';

const S = 1 / MAP.pxPerM;
const toX = px => (px - MAP.w / 2) * S;
const toZ = py => (py - MAP.h / 2) * S;

export function createMasterplan3D(container, { onSelect, onHover } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.5;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);
  const labels = new CSS2DRenderer();
  labels.domElement.className = 'mp3d-labels';
  container.appendChild(labels.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xd8d2c4, 500, 1400);
  const camera = new THREE.PerspectiveCamera(38, 1, 1, 5000);
  camera.position.set(0, 900, 700);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.maxPolarAngle = Math.PI * 0.43; controls.minDistance = 40; controls.maxDistance = 900;
  controls.target.set(40, 0, 40);
  controls.screenSpacePanning = false;

  const sky = new Sky(); sky.scale.setScalar(9000); scene.add(sky);
  const su = sky.material.uniforms;
  su.turbidity.value = 5; su.rayleigh.value = 1.4; su.mieCoefficient.value = 0.004; su.mieDirectionalG.value = 0.82;

  const hemi = new THREE.HemisphereLight(0xe8f2ff, 0x8a7a5a, 0.7); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 2.6); sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, { left: -380, right: 380, top: 320, bottom: -320, near: 10, far: 1600 });
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.5;
  scene.add(sun, sun.target);

  // Plano base con el mapa de lotes del brochure
  const tex = new THREE.TextureLoader().load('/img/lot-map.webp');
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const W = MAP.w * S, H = MAP.h * S;
  const base = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }));
  base.rotation.x = -Math.PI / 2; base.receiveShadow = true; scene.add(base);
  const surround = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.MeshStandardMaterial({ color: 0xece6da, roughness: 1 }));
  surround.rotation.x = -Math.PI / 2; surround.position.y = -0.3; surround.receiveShadow = true; scene.add(surround);
  // plinto de maqueta
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(W + 8, 6, H + 8), new THREE.MeshStandardMaterial({ color: 0x2c2420, roughness: 0.6 }));
  plinth.position.y = -3.05; scene.add(plinth);

  // ---- Lotes ----
  const lotMeshes = [];
  const lotGroup = new THREE.Group(); scene.add(lotGroup);
  const C = Object.fromEntries(Object.entries(STATUS).map(([k, v]) => [k, new THREE.Color(v.color)]));
  lots.forEach(l => {
    const shape = new THREE.Shape(l.pts.map(([x, y]) => new THREE.Vector2(toX(x), toZ(y))));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.9, bevelEnabled: false });
    const mat = new THREE.MeshStandardMaterial({ color: C[l.status], transparent: true, opacity: 0.78, roughness: 0.7, emissive: 0x000000 });
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = Math.PI / 2; m.position.y = 0.95; m.receiveShadow = true;
    m.userData.lot = l; l._mesh = m;
    lotGroup.add(m); lotMeshes.push(m);
  });
  const selLine = new THREE.LineLoop(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xffffff }));
  selLine.visible = false; scene.add(selLine);

  // ---- Villas (instanciadas) ----
  const lakeC = new THREE.Vector2(1050 * 2, 1080 * 2), parkC = new THREE.Vector2(643 * 2, 762 * 2);
  const houseMats = {
    body: new THREE.MeshStandardMaterial({ color: 0xf1e9dc, roughness: 0.9, emissive: 0xffa95a, emissiveIntensity: 0 }),
    upper: new THREE.MeshStandardMaterial({ color: 0xf4eee4, roughness: 0.9, emissive: 0xffa95a, emissiveIntensity: 0 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x8a5a3b, roughness: 0.7 }),
    pool: new THREE.MeshStandardMaterial({ color: 0x35b8cc, roughness: 0.1, emissive: 0x1a9fb5, emissiveIntensity: 0 }),
  };
  const N = lots.length;
  const lower = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), houseMats.body, N);
  const upper = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), houseMats.upper, N);
  const perg = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), houseMats.wood, N);
  const pool = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), houseMats.pool, N);
  [lower, upper, perg].forEach(m => { m.castShadow = true; m.receiveShadow = true; scene.add(m); });
  scene.add(pool);
  const houseInfo = lots.map(l => {
    const ux = Math.cos(l.angle), uy = Math.sin(l.angle);
    let lmin = 1e9, lmax = -1e9, wmin = 1e9, wmax = -1e9;
    l.pts.forEach(([x, y]) => { const a = (x - l.cx) * ux + (y - l.cy) * uy, b = -(x - l.cx) * uy + (y - l.cy) * ux; lmin = Math.min(lmin, a); lmax = Math.max(lmax, a); wmin = Math.min(wmin, b); wmax = Math.max(wmax, b); });
    const len = (lmax - lmin) * S, wid = (wmax - wmin) * S;
    const target = l.etapa === 2 ? lakeC : parkC;
    const sign = Math.sign((target.x - l.cx) * ux + (target.y - l.cy) * uy) || 1;
    return { len, wid, sign, ux, uy };
  });
  const dummy = new THREE.Object3D();
  function placeHouses(showAll) {
    lots.forEach((l, i) => {
      const hi = houseInfo[i];
      const visible = l.etapa === 1 || showAll;
      const w = Math.min(10, hi.wid * 0.62), d = Math.min(11, hi.len * 0.42);
      const two = l.t !== 'Savina' && l.t !== 'Aqua';
      const ang = Math.atan2(hi.ux * hi.sign, hi.uy * hi.sign);
      const cx = toX(l.cx) - hi.ux * hi.sign * hi.len * 0.12, cz = toZ(l.cy) - hi.uy * hi.sign * hi.len * 0.12;
      const s = visible ? 1 : 0.0001;
      const set = (mesh, sx, sy, sz, off, y) => {
        dummy.position.set(cx + hi.ux * hi.sign * off, y, cz + hi.uy * hi.sign * off);
        dummy.rotation.set(0, ang, 0); dummy.scale.set(sx * s, sy * s, sz * s); // x = ancho, z = profundidad (eje del lote)
        dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
      };
      set(lower, w, 3.4, d, 0, 1 + 1.7);
      set(upper, w, two ? 3.2 : 0.6, d * 0.72, -d * 0.14, 1 + 3.4 + (two ? 1.6 : 0.3));
      set(perg, w + 0.6, 0.25, 3.6, d / 2 + 1.8, 1 + 3.2);
      set(pool, w * 0.75, 0.15, 3.4, d / 2 + 5.4, 1.05);
    });
    [lower, upper, perg, pool].forEach(m => (m.instanceMatrix.needsUpdate = true));
  }
  placeHouses(false);

  // ---- Palmeras instanciadas ----
  const nT = MAP.trees.length / 2;
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.25, 0.4, 1, 6), new THREE.MeshStandardMaterial({ color: 0x8b7355 }), nT);
  const crownGeo = new THREE.ConeGeometry(1, 1, 7); crownGeo.translate(0, -0.2, 0);
  const crown = new THREE.InstancedMesh(crownGeo, new THREE.MeshStandardMaterial({ color: 0x4d7a35, roughness: 0.9, flatShading: true }), nT);
  for (let i = 0; i < nT; i++) {
    const x = toX(MAP.trees[i * 2]), z = toZ(MAP.trees[i * 2 + 1]);
    const h = 7 + ((i * 7919) % 50) / 10;
    dummy.position.set(x, h / 2, z); dummy.rotation.set(0, i, 0); dummy.scale.set(1, h, 1); dummy.updateMatrix(); trunk.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x, h + 0.6, z); dummy.scale.set(3.6, 1.6, 3.6); dummy.rotation.set(Math.PI, i, 0); dummy.updateMatrix(); crown.setMatrixAt(i, dummy.matrix);
  }
  trunk.castShadow = crown.castShadow = true; scene.add(trunk, crown);

  // ---- Amenidades (etiquetas HTML) ----
  MAP.amen.forEach(([n, x, y]) => {
    const el = document.createElement('button');
    el.className = 'mp3d-pin'; el.textContent = n; el.title = AMENITIES[n].name;
    el.innerHTML = `<span>${n}</span><em>${AMENITIES[n].name}</em>`;
    const o = new CSS2DObject(el); o.position.set(toX(x), 14, toZ(y)); scene.add(o);
  });
  const tip = document.createElement('div'); tip.className = 'mp3d-tip';
  const tipObj = new CSS2DObject(tip); tipObj.visible = false; scene.add(tipObj);

  // ---- Interacción ----
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
  let hovered = null, selected = null, down = null;
  function pick(e) {
    const r = renderer.domElement.getBoundingClientRect();
    ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ptr, camera);
    const hit = ray.intersectObjects(lotMeshes, false)[0];
    return hit ? hit.object.userData.lot : null;
  }
  function styleLot(l) {
    const m = l._mesh, ok = matches(l);
    m.material.color.copy(ok ? C[l.status] : new THREE.Color(0x9a948a));
    m.material.opacity = l === hovered || l === selected ? 0.95 : ok ? 0.78 : 0.1;
    m.material.emissive.setHex(l === hovered ? 0x333333 : 0);
    m.position.y = l === hovered || l === selected ? 2.2 : 0.95;
  }
  function refresh() { lots.forEach(styleLot); }
  renderer.domElement.addEventListener('pointermove', e => {
    const l = pick(e);
    if (l !== hovered) {
      const prev = hovered; hovered = l; if (prev) styleLot(prev); if (l) styleLot(l);
      renderer.domElement.style.cursor = l ? 'pointer' : 'grab';
      onHover?.(l);
      if (l) {
        tip.innerHTML = `<b>${l.kind === 'villa' ? 'Villa' : 'Lote'} ${l.id}</b><span>${l.t} · ${l.a} m²</span><i style="--c:${STATUS[l.status].color}">${STATUS[l.status].label}</i>`;
        tipObj.position.set(toX(l.cx), 18, toZ(l.cy)); tipObj.visible = true;
      } else tipObj.visible = false;
    }
  });
  renderer.domElement.addEventListener('pointerdown', e => (down = [e.clientX, e.clientY]));
  renderer.domElement.addEventListener('pointerup', e => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return;
    const l = pick(e); if (l) onSelect?.(l);
  });

  function focus(l) {
    const prev = selected; selected = l; if (prev) styleLot(prev); styleLot(l);
    const pts = l.pts.map(([x, y]) => new THREE.Vector3(toX(x), 2.4, toZ(y)));
    selLine.geometry.dispose(); selLine.geometry = new THREE.BufferGeometry().setFromPoints(pts); selLine.visible = true;
    const tx = toX(l.cx), tz = toZ(l.cy);
    gsap.to(controls.target, { x: tx, y: 0, z: tz, duration: 1.6, ease: 'power3.inOut' });
    gsap.to(camera.position, { x: tx + 60, y: 70, z: tz + 90, duration: 1.6, ease: 'power3.inOut' });
  }
  function clearSelection() { const p = selected; selected = null; if (p) styleLot(p); selLine.visible = false; }

  // ---- Ambientes ----
  const MODES = {
    dia: { elev: 55, az: 140, exp: 0.5, night: false },
    atardecer: { elev: 4, az: 250, exp: 0.42, night: false },
    noche: { elev: -6, az: 250, exp: 0.3, night: true },
  };
  function setMode(name) {
    const m = MODES[name]; const v = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - m.elev), THREE.MathUtils.degToRad(m.az));
    su.sunPosition.value.copy(v);
    sun.position.copy(v).multiplyScalar(800); sun.target.position.set(0, 0, 0);
    const golden = name === 'atardecer';
    sun.intensity = m.night ? 0.35 : golden ? 1.6 : 2.6;
    sun.color.set(m.night ? 0x8fa8ff : golden ? 0xffb071 : 0xffffff);
    hemi.intensity = m.night ? 0.25 : golden ? 0.5 : 0.7;
    hemi.color.set(m.night ? 0x40507f : 0xe8f2ff);
    renderer.toneMappingExposure = m.exp;
    base.material.color.set(m.night ? 0x5a6280 : 0xffffff);
    houseMats.body.emissiveIntensity = m.night ? 0.55 : golden ? 0.12 : 0;
    houseMats.upper.emissiveIntensity = m.night ? 0.35 : 0;
    houseMats.pool.emissiveIntensity = m.night ? 1.2 : 0;
    scene.fog.color.set(m.night ? 0x1c2233 : golden ? 0xe7c6a4 : 0xd8d2c4);
  }
  setMode('dia');

  // ---- loop ----
  let raf = 0, visible = true;
  const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting)); io.observe(container);
  function resize() {
    const w = container.clientWidth || 1, h = container.clientHeight || 1;
    renderer.setSize(w, h, false); labels.setSize(w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize); ro.observe(container); resize();
  const bound = 360;
  function loop() {
    raf = requestAnimationFrame(loop);
    if (!visible) return;
    controls.target.x = THREE.MathUtils.clamp(controls.target.x, -bound, bound);
    controls.target.z = THREE.MathUtils.clamp(controls.target.z, -bound, bound);
    controls.update(); renderer.render(scene, camera); labels.render(scene, camera);
  }
  loop(); refresh();
  // vuelo de entrada
  gsap.fromTo(camera.position, { x: -200, y: 950, z: 850 }, { x: 160, y: 380, z: 520, duration: 3.2, ease: 'power2.inOut' });

  return {
    refresh, focus, clearSelection, setMode,
    setBuilt: v => placeHouses(v),
    resetView() {
      clearSelection();
      gsap.to(controls.target, { x: 40, y: 0, z: 40, duration: 1.4, ease: 'power3.inOut' });
      gsap.to(camera.position, { x: 160, y: 380, z: 520, duration: 1.4, ease: 'power3.inOut' });
    },
    dispose() { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); renderer.dispose(); container.innerHTML = ''; },
  };
}
