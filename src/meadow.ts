import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Flower, Species } from './data';

export type Kind = Species | 'bud' | 'hive';

/** A flower (or the hive, at index `nf`) as the meadow sees it. */
export interface Item extends Omit<Flower, 'species'> {
  kind: Kind;
}

export interface MeadowHost {
  canvas: HTMLCanvasElement;
  packet: HTMLElement;
  note: HTMLElement;
  /** "This is you" label that follows the bee until the first landing. */
  you: HTMLElement;
  /** One tag button per item, same order as `items`. */
  tags: HTMLButtonElement[];
  items: Item[];
  /** Number of flowers; the hive is `items[nf]`. */
  nf: number;
  reducedMotion: boolean;
  coarse: boolean;
  /** Index of the item the bee is landed on, or -1. */
  current(): number;
  land(i: number): void;
  takeOff(): void;
  /** Call once the bee touches down on item i. */
  markVisited(i: number): void;
}

export interface World {
  land(i: number): void;
  takeOff(): void;
  /** k in 0..1: share of flowers visited. */
  setPollen(k: number): void;
}

export async function makeWorld(host: MeadowHost): Promise<World> {
  const { reducedMotion: RM, coarse: COARSE, items, tags, note, you } = host;
  const NF = host.nf, HIVE = host.nf;
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const TAU = Math.PI * 2;
  const UP = V(0, 1, 0);

  // seeded random so the meadow grows the same way every visit
  let s = 20041;
  const rand = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

  const canvas = host.canvas;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
  const HAZE = new THREE.Color('#FFD68A');
  scene.fog = new THREE.Fog(HAZE, 18, 90);
  const SUN = V(0.34, 0.12, -1).normalize();

  scene.add(new THREE.HemisphereLight('#FFD58A', '#4C5C14', 1.7));
  const key = new THREE.DirectionalLight('#FFF0D2', 1.5); key.position.set(-8, 12, 14); scene.add(key);
  const rim = new THREE.DirectionalLight('#FFB23E', 2.4); rim.position.copy(SUN).multiplyScalar(60); scene.add(rim);

  /* --- sky: honey, with a low sun behind the flowers --- */
  const sky = new THREE.Mesh(new THREE.SphereGeometry(450, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color('#E57E08') }, mid: { value: new THREE.Color('#FFB23A') },
      low: { value: HAZE }, sunCol: { value: new THREE.Color('#FFF7DA') }, sunDir: { value: SUN },
    },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 top, mid, low, sunCol, sunDir; varying vec3 vP;
      void main(){
        vec3 d = normalize(vP); float h = d.y;
        vec3 c = mix(low, mid, smoothstep(-0.02, 0.2, h));
        c = mix(c, top, smoothstep(0.18, 0.7, h));
        float s = max(dot(d, sunDir), 0.0);
        c += sunCol * (smoothstep(0.9994, 0.9997, s) * 1.6 + pow(s, 60.0) * 0.45 + pow(s, 7.0) * 0.22);
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  scene.add(sky);

  /* --- ground + a forest of grass blades --- */
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(500, 500).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: '#4E6316', roughness: 1 }));
  scene.add(ground);

  const uTime = { value: 0 };
  const blade = new THREE.PlaneGeometry(0.14, 1, 1, 5);
  {
    const p = blade.getAttribute('position'), col = [];
    const a = new THREE.Color('#263B0C'), b = new THREE.Color('#BFD052'), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const v = p.getY(i) + 0.5;
      p.setXYZ(i, p.getX(i) * (1 - v * 0.9), v, v * v * 0.35);
      c.copy(a).lerp(b, Math.pow(v, 1.4)); col.push(c.r, c.g, c.b);
    }
    blade.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    blade.computeVertexNormals();
  }
  const grassMat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.85 });
  grassMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec3 ip = instanceMatrix[3].xyz; float k = position.y * position.y;
      transformed.x += sin(uTime * 1.3 + ip.x * 0.35 + ip.z * 0.2) * 0.22 * k;
      transformed.z += cos(uTime * 1.05 + ip.x * 0.2) * 0.12 * k;`);
  };
  const GN = COARSE ? 6000 : 9000;
  const grass = new THREE.InstancedMesh(blade, grassMat, GN);
  {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
    for (let i = 0; i < GN; i++) {
      const z = 8 - Math.pow(rand(), 0.75) * 62;
      const x = (rand() - 0.5) * (40 + (8 - z) * 1.2);
      const near = z > 2 ? 0.6 : 1;
      const h = (0.45 + Math.pow(rand(), 2.2) * 2.3) * near;
      const w = 0.8 + rand() * 1.3;
      q.setFromAxisAngle(UP, rand() * TAU);
      m.compose(V(x, 0, z), q, V(w, h, w));
      grass.setMatrixAt(i, m);
      c.setHSL(0.2 + rand() * 0.06, 0.6, 0.45 + rand() * 0.25); grass.setColorAt(i, c);
    }
  }
  scene.add(grass);

  /* --- pollen dust drifting in the light --- */
  {
    const n = 420, pos = new Float32Array(n * 3), seed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos.set([(rand() - 0.5) * 44, rand() * 15, 8 - rand() * 40], i * 3); seed[i] = rand();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    const dust = new THREE.Points(g, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime, uPR: { value: renderer.getPixelRatio() } },
      vertexShader: `attribute float seed; uniform float uTime, uPR; varying float vA;
        void main(){ vec3 p = position;
          p.x += sin(uTime * 0.21 + seed * 6.0) * 0.8; p.y += sin(uTime * 0.33 + seed * 9.0) * 0.5; p.z += cos(uTime * 0.17 + seed * 4.0) * 0.6;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = (1.5 + seed * 4.5) * uPR * (16.0 / -mv.z);
          gl_Position = projectionMatrix * mv; vA = 0.3 + 0.7 * fract(seed * 13.7); }`,
      fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord - 0.5);
        gl_FragColor = vec4(1.0, 0.95, 0.75, smoothstep(0.5, 0.0, d) * vA * 0.75); }`,
    }));
    dust.frustumCulled = false;
    scene.add(dust);
  }

  /* ================= geometry kit ================= */
  const tmpC = new THREE.Color();
  function part(geo: THREE.BufferGeometry, hex: THREE.ColorRepresentation, m?: THREE.Matrix4) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    if (m) g.applyMatrix4(m);
    tmpC.set(hex);
    const n = g.getAttribute('position').count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = tmpC.r; a[i * 3 + 1] = tmpC.g; a[i * 3 + 2] = tmpC.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    return g;
  }
  const M4 = () => new THREE.Matrix4();
  const T = (x: number | THREE.Vector3, y = 0, z = 0) => (x instanceof THREE.Vector3 ? M4().makeTranslation(x.x, x.y, x.z) : M4().makeTranslation(x, y, z));
  const RX = (a: number) => M4().makeRotationX(a), RY = (a: number) => M4().makeRotationY(a), RZ = (a: number) => M4().makeRotationZ(a);
  const SC = (x: number, y = x, z = x) => M4().makeScale(x, y, z);
  const mul = (...ms: THREE.Matrix4[]) => ms.reduce((acc, m) => acc.multiply(m), M4());
  const shade = (hex: THREE.ColorRepresentation, k: number) => '#' + new THREE.Color(hex).multiplyScalar(k).getHexString();
  const mix = (a: THREE.ColorRepresentation, b: THREE.ColorRepresentation, k: number) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), k).getHexString();

  // a petal lying along +X, face up (+Y). a/b shape the outline, blunt squares the tip, notch scallops it.
  function petal(len: number, wid: number, { a = 1.4, b = 0.7, blunt = 0, notch = 0, curl = 0.12, cup = 0.2 } = {}) {
    const g = new THREE.PlaneGeometry(1, 1, 6, 12), p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      const u = p.getX(i) * 2, v = p.getY(i) + 0.5;
      const w = Math.pow(Math.max(0, Math.sin(Math.PI * Math.pow(v, a) * (1 - blunt * 0.5))), b) * wid * 0.5;
      let r = v * len;
      if (notch) r -= notch * len * (0.5 - 0.5 * Math.cos(u * Math.PI * 3)) * Math.pow(v, 6);
      p.setXYZ(i, r, curl * v * v * len + cup * u * u * w, u * w);
    }
    g.computeVertexNormals();
    return g;
  }
  function ring(P: THREE.BufferGeometry[], n: number, geo: THREE.BufferGeometry, col: THREE.ColorRepresentation, { r0 = 0.2, y0 = 0, lift = 0.2, off = 0, jit = 0.07 } = {}) {
    for (let k = 0; k < n; k++) {
      const a = ((k + off) / n) * TAU + (rand() - 0.5) * jit;
      P.push(part(geo, col, mul(RY(a), RZ(lift + (rand() - 0.5) * jit * 2), T(r0, y0, 0), SC(1 + (rand() - 0.5) * 0.14, 1, 1))));
    }
  }
  const dome = (r: number, sy: number) => new THREE.SphereGeometry(r, 28, 12, 0, TAU, 0, Math.PI / 2).scale(1, sy, 1);
  function dots(P: THREE.BufferGeometry[], n: number, r: number, y: number, size: number, col: THREE.ColorRepresentation) {
    const g = new THREE.IcosahedronGeometry(size, 0);
    for (let k = 0; k < n; k++) { const a = (k / n) * TAU; P.push(part(g, col, T(Math.cos(a) * r, y, Math.sin(a) * r))); }
  }

  // each returns head geometry in head space (+Y = the face), where the bee lands (landY),
  // how far below the head centre its tag hangs (below), and whether it stays upright.
  type FlowerHead = { geo: THREE.BufferGeometry; landY: number; below: number; upright?: boolean };
  const SPECIES: Record<Exclude<Kind, 'hive'>, (col: string) => FlowerHead> = {
    daisy(col) {
      const P = [part(dome(0.42, 0.55), '#FFB000')];
      const g = petal(1.6, 0.3, { a: 1.25, b: 0.55, curl: -0.12, cup: 0.12 });
      ring(P, 18, g, col, { r0: 0.25, lift: 0.14 });
      ring(P, 18, g, shade(col, 0.9), { r0: 0.22, y0: -0.03, lift: 0.26, off: 0.5 });
      return { geo: mergeGeometries(P), landY: 0.42, below: 1.75 };
    },
    sunflower(col) {
      const P = [part(dome(0.95, 0.36), '#3A190B')];
      const seed = new THREE.IcosahedronGeometry(0.062, 0);
      for (let i = 0; i < 230; i++) {
        const r = 0.88 * Math.sqrt(i / 230), a = i * 2.39996;
        const y = 0.36 * Math.sqrt(Math.max(0, 0.9025 - r * r)) + 0.02;
        P.push(part(seed, i % 3 ? '#2A1007' : '#7A4415', T(Math.cos(a) * r, y, Math.sin(a) * r)));
      }
      ring(P, 16, petal(0.8, 0.34, { a: 1.1, b: 1 }), '#4E7A1A', { r0: 0.7, y0: -0.06, lift: -0.18 });
      const g = petal(1.35, 0.4, { a: 1.12, b: 0.95, curl: 0.08, cup: 0.18 });
      ring(P, 22, g, col, { r0: 0.78, lift: 0.06 });
      ring(P, 22, g, shade(col, 0.88), { r0: 0.72, y0: -0.02, lift: 0.18, off: 0.5 });
      return { geo: mergeGeometries(P), landY: 0.4, below: 2.05 };
    },
    cosmos(col) {
      const P: THREE.BufferGeometry[] = [];
      ring(P, 8, petal(1.7, 0.95, { a: 1.6, b: 0.45, blunt: 0.85, notch: 0.06, cup: 0.25, curl: 0.04 }), col, { r0: 0.16, lift: 0.18, jit: 0.12 });
      P.push(part(dome(0.32, 0.65), '#FFC21A'));
      dots(P, 26, 0.33, 0.06, 0.05, '#E07A00');
      return { geo: mergeGeometries(P), landY: 0.32, below: 1.8 };
    },
    poppy(col) {
      const P: THREE.BufferGeometry[] = [];
      ring(P, 4, petal(1.45, 1.65, { a: 1.25, b: 0.45, blunt: 0.35, cup: 0.45, curl: 0.22 }), col, { r0: 0.08, lift: 0.7 });
      ring(P, 4, petal(1.25, 1.45, { a: 1.25, b: 0.45, blunt: 0.35, cup: 0.5, curl: 0.25 }), shade(col, 0.85), { r0: 0.06, lift: 0.98, off: 0.5 });
      P.push(part(new THREE.SphereGeometry(0.28, 18, 12).scale(1, 0.8, 1), '#7D8C46', T(0, 0.3, 0)));
      P.push(part(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 8), '#3B2440', T(0, 0.52, 0)));
      dots(P, 36, 0.42, 0.24, 0.05, '#1E0B1A');
      return { geo: mergeGeometries(P), landY: 0.74, below: 0.95 };
    },
    allium(col) {
      const P = [part(new THREE.SphereGeometry(0.82, 24, 16), shade(col, 0.45))];
      const fl = mergeGeometries([new THREE.CylinderGeometry(0.02, 0.02, 0.2, 4).translate(0, 0.1, 0), new THREE.IcosahedronGeometry(0.088, 1).scale(1, 0.6, 1).translate(0, 0.22, 0)].map((g) => (g.index ? g.toNonIndexed() : g)));
      const q = new THREE.Quaternion(), n = 300;
      for (let i = 0; i < n; i++) {
        const y = 1 - ((i + 0.5) / n) * 2, r = Math.sqrt(1 - y * y), a = i * 2.39996;
        const d = V(Math.cos(a) * r, y, Math.sin(a) * r);
        q.setFromUnitVectors(UP, d);
        P.push(part(fl, rand() > 0.22 ? col : mix(col, '#FFFFFF', 0.3), M4().compose(d.multiplyScalar(0.74), q, V(1, 1, 1))));
      }
      return { geo: mergeGeometries(P), landY: 1.02, below: 1.2, upright: true };
    },
    bud(col) {
      const tear = new THREE.SphereGeometry(0.36, 20, 14), tp = tear.getAttribute('position');
      for (let i = 0; i < tp.count; i++) {
        const y = tp.getY(i) / 0.36, k = 1 - Math.pow(Math.max(0, y), 1.6) * 0.8;
        tp.setXYZ(i, tp.getX(i) * k, tp.getY(i) * 2.1, tp.getZ(i) * k);
      }
      tear.computeVertexNormals();
      const P = [part(tear, col, T(0, 0.82, 0))];
      ring(P, 5, petal(1.3, 0.62, { a: 1.15, b: 0.9, cup: 0.4, curl: -0.08 }), '#5B8A1E', { r0: 0.03, lift: 1.28, jit: 0.12 });
      P.push(part(new THREE.SphereGeometry(0.24, 14, 10), '#4E7A1A'));
      return { geo: mergeGeometries(P).scale(0.8, 0.8, 0.8), landY: 1.3, below: 0.35, upright: true };
    },
  };
  const leafGeo = petal(2.3, 0.82, { a: 1.2, b: 0.85, cup: 0.3, curl: -0.25 });
  const flowerMat = new THREE.MeshStandardMaterial({
    vertexColors: true, side: THREE.DoubleSide, roughness: 0.6, emissive: '#FFFFFF', emissiveIntensity: 0.22,
  });
  // backlit petals glow in their own colour
  flowerMat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('vec3 totalEmissiveRadiance = emissive;', 'vec3 totalEmissiveRadiance = emissive * vColor.rgb;');
  };

  function stemGeo(h: THREE.Vector3, r: number, wob: [number, number, number, number]) {
    const curve = new THREE.CatmullRomCurve3([
      V(), V(wob[0], h.y * 0.33, wob[1]).addScaledVector(h, 0.3).setY(h.y * 0.33),
      V(-wob[0] * 0.6, 0, -wob[1] * 0.6).addScaledVector(h, 0.68).setY(h.y * 0.68), h.clone(),
    ]);
    const P = [part(new THREE.TubeGeometry(curve, 36, r, 6), '#5A8A1E')];
    if (h.y > 2.2) for (const [t, k] of [[0.2, 0], [0.42, 1]] as const) {
      const p = curve.getPoint(t);
      P.push(part(leafGeo, k ? '#4A7518' : '#5B8A1E', mul(T(p), RY((k === 0 ? wob[2] : wob[3]) * TAU), RZ(0.5), SC(0.7 + 0.35 * (h.y / 10)))));
    }
    return mergeGeometries(P);
  }

  /* --- the interactive flowers --- */
  const F = items.slice(0, NF).map((it, i) => {
    const sp = SPECIES[it.kind === 'hive' ? 'daisy' : it.kind](it.color);
    const head = new THREE.Mesh(sp.geo, flowerMat);
    if (!sp.upright) head.rotation.x = Math.PI / 2;
    const face = new THREE.Group(); face.add(head);
    const stem = new THREE.Mesh(new THREE.BufferGeometry(), flowerMat);
    const group = new THREE.Group(); group.add(face, stem);
    scene.add(group);
    head.userData.i = stem.userData.i = i;
    return { i, sp, head, face, stem, group, k: 1, rnd: [rand(), rand(), rand(), rand(), rand(), rand()] as [number, number, number, number, number, number], hover: 0, sway: rand() * TAU };
  });

  /* --- the hive (a straw skep on a stump) --- */
  const hive = (() => {
    const P = [
      part(new THREE.CylinderGeometry(2.1, 2.5, 2.2, 28), '#6E4020', T(0, 1.1, 0)),
      part(new THREE.CylinderGeometry(2.1, 2.1, 0.06, 28), '#B07A45', T(0, 2.22, 0)),
    ];
    for (let k = 0; k < 9; k++) {
      const R = 1.75 * Math.pow(Math.cos((k / 9.3) * Math.PI / 2), 0.55);
      P.push(part(new THREE.TorusGeometry(R, 0.22, 8, 40), k % 2 ? '#C98A2C' : '#E7AE45', mul(T(0, 2.45 + k * 0.32, 0), RX(Math.PI / 2))));
    }
    P.push(part(new THREE.SphereGeometry(0.42, 16, 10), '#E7AE45', T(0, 5.38, 0)));
    P.push(part(new THREE.CircleGeometry(0.46, 20, 0, Math.PI), '#2A0E33', T(0, 2.3, 1.97)));
    const m = new THREE.Mesh(mergeGeometries(P), flowerMat);
    m.userData.i = HIVE;
    scene.add(m);
    return m;
  })();
  const pickables = [...F.flatMap((f) => [f.head, f.stem]), hive];

  /* --- far-off flowers, just for depth --- */
  {
    const kinds = ['daisy', 'sunflower', 'cosmos', 'poppy', 'allium'] as const;
    const cols = ['#FFFFFF', '#FFC21A', '#FF6FA8', '#FF4B2B', '#9152F2', '#FF8A1F', '#FFB3D1'];
    for (let k = 0; k < 22; k++) {
      const kind = kinds[k % kinds.length] ?? 'daisy', sp = SPECIES[kind](cols[Math.floor(rand() * cols.length)] ?? '#FFFFFF');
      const B = V((rand() - 0.5) * 90, 0, -26 - rand() * 34), h = V((rand() - 0.5) * 2, 7 + rand() * 10, 0);
      const g = new THREE.Group(); g.position.copy(B);
      g.add(new THREE.Mesh(stemGeo(h, 0.16, [rand() - 0.5, rand() - 0.5, rand(), rand()]), flowerMat));
      const head = new THREE.Mesh(sp.geo, flowerMat); head.position.copy(h); head.scale.setScalar(1.3);
      if (!sp.upright) { head.rotation.x = Math.PI / 2 - 0.35; head.rotation.y = (rand() - 0.5) * 0.8; }
      g.add(head); scene.add(g);
    }
  }

  /* ================= the bee ================= */
  const bee = (() => {
    const root = new THREE.Group();
    const P: THREE.BufferGeometry[] = [];
    const ab = part(new THREE.SphereGeometry(1, 32, 20).rotateX(Math.PI / 2), '#FFC21A', mul(T(0, -0.02, -0.8), SC(0.5, 0.47, 0.74)));
    {
      const p = ab.getAttribute('position'), c = ab.getAttribute('color'), Y = new THREE.Color('#FFC21A'), K = new THREE.Color('#2A0E33');
      for (let i = 0; i < p.count; i++) {
        const t = (-0.06 - p.getZ(i)) / 1.48, band = Math.floor(t * 5);
        const col = t > 0.9 || band % 2 === 1 ? K : Y;
        c.setXYZ(i, col.r, col.g, col.b);
      }
    }
    P.push(ab);
    P.push(part(new THREE.SphereGeometry(0.42, 24, 16), '#F2A516', T(0, 0.05, 0)));
    P.push(part(new THREE.SphereGeometry(0.31, 24, 16), '#2A0E33', mul(T(0, 0.02, 0.5), SC(1, 0.95, 0.9))));
    P.push(part(new THREE.ConeGeometry(0.07, 0.24, 8).rotateX(-Math.PI / 2), '#2A0E33', T(0, -0.02, -1.6)));
    for (const sx of [-1, 1]) {
      const ant = new THREE.CatmullRomCurve3([V(0.08 * sx, 0.22, 0.62), V(0.2 * sx, 0.48, 0.82), V(0.34 * sx, 0.58, 1.0)]);
      P.push(part(new THREE.TubeGeometry(ant, 10, 0.025, 5), '#2A0E33'));
      P.push(part(new THREE.SphereGeometry(0.06, 10, 8), '#2A0E33', T(0.34 * sx, 0.58, 1.0)));
      for (const lz of [0.18, 0, -0.18]) {
        P.push(part(new THREE.CylinderGeometry(0.028, 0.02, 0.55, 5), '#2A0E33', mul(T(0.2 * sx, -0.42, lz), RZ(0.45 * sx), RX(-0.3))));
      }
    }
    const body = new THREE.Mesh(mergeGeometries(P), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55 }));
    root.add(body);
    const eyeMat = new THREE.MeshStandardMaterial({ color: '#160818', roughness: 0.12, metalness: 0.2 });
    const shine = new THREE.MeshBasicMaterial({ color: '#FFFFFF' });
    for (const sx of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.15, 18, 12), eyeMat); e.position.set(0.19 * sx, 0.07, 0.66); root.add(e);
      const h = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), shine); h.position.set(0.16 * sx, 0.15, 0.79); root.add(h);
    }
    // wings: a fore and hind pair per side
    const wing = (() => {
      const w1 = new THREE.CircleGeometry(1, 24).scale(0.66, 0.25, 1).translate(0.64, 0, 0).rotateX(-Math.PI / 2).rotateY(0.45);
      const w2 = new THREE.CircleGeometry(1, 20).scale(0.42, 0.17, 1).translate(0.42, 0, 0).rotateX(-Math.PI / 2).rotateY(0.95);
      return mergeGeometries([w1, w2]);
    })();
    const wingMat = new THREE.MeshBasicMaterial({ color: '#FFF8E8', transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
    const wings = [-1, 1].map((sx) => {
      const pv = new THREE.Group(); pv.position.set(0.14 * sx, 0.38, 0.02);
      const m = new THREE.Mesh(wing, wingMat); m.scale.x = sx; pv.add(m); root.add(pv);
      return pv;
    });
    const pollenMat = new THREE.MeshStandardMaterial({ color: '#FFB300', roughness: 0.8, emissive: '#FF8A00', emissiveIntensity: 0.25 });
    const pollen = [-1, 1].map((sx) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 10), pollenMat); m.position.set(0.3 * sx, -0.55, -0.2); m.scale.setScalar(0.001); root.add(m);
      return m;
    });
    root.scale.setScalar(0.55);
    scene.add(root);
    return { root, wings, pollen, pos: V(-14, 3.5, 2), vel: V(), mode: 'free' as 'free' | 'fly' | 'landed', t: 0, dur: 1, p0: V(), p1: V(), p2: V(), target: -1, pollenAmt: 0 };
  })();

  /* --- the dotted flight path a cartoon bee leaves behind --- */
  const trail = (() => {
    const n = 90, pos = new Float32Array(n * 3), age = new Float32Array(n).fill(99);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('age', new THREE.BufferAttribute(age, 1));
    const pts = new THREE.Points(g, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uPR: { value: renderer.getPixelRatio() } },
      vertexShader: `attribute float age; uniform float uPR; varying float vA;
        void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vA = clamp(1.0 - age / 2.8, 0.0, 1.0);
          gl_PointSize = 7.0 * uPR * (9.0 / -mv.z) * (0.45 + 0.55 * vA);
          gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord - 0.5);
        gl_FragColor = vec4(0.165, 0.055, 0.2, smoothstep(0.5, 0.38, d) * vA * 0.85); }`,
    }));
    pts.frustumCulled = false;
    scene.add(pts);
    let head = 0;
    const lastDot = V(1e9, 0, 0);
    return {
      update(dt: number, p: THREE.Vector3, on: boolean) {
        for (let i = 0; i < n; i++) age[i] = (age[i] ?? 99) + dt;
        if (on && p.distanceTo(lastDot) > 0.17) {
          pos[head * 3] = p.x; pos[head * 3 + 1] = p.y; pos[head * 3 + 2] = p.z; age[head] = 0;
          head = (head + 1) % n; lastDot.copy(p);
          g.getAttribute('position').needsUpdate = true;
        }
        g.getAttribute('age').needsUpdate = true;
      },
    };
  })();

  /* ================= layout: place flowers by where they should land on screen ================= */
  // [u, v, depth]: u,v in screen space (-1..1), depth = distance from the camera.
  type Placement = [u: number, v: number, depth: number];
  const LAYOUT: { wide: Placement[]; wideHive: [number, number]; tall: Placement[]; tallHive: [number, number] } = {
    wide: [[-0.26, 0.2, 12], [0.16, 0.55, 17], [0.5, 0.14, 13], [0.8, 0.56, 19], [-0.6, -0.2, 12.5], [-0.1, -0.36, 9.5], [0.3, -0.3, 10], [0.62, -0.36, 10.5], [-0.38, -0.55, 8.5]],
    wideHive: [0.78, -0.62],
    tall: [[-0.45, 0.12, 15], [0.35, 0.16, 19], [0.62, 0.01, 13], [-0.08, -0.02, 21], [-0.52, -0.3, 12], [0.13, -0.34, 10], [0.68, -0.53, 9.5], [-0.62, -0.62, 9], [0.06, -0.5, 8]],
    tallHive: [0.8, -0.96],
  };
  const camBase = V(), lookBase = V();
  let S = 1, tall = false;
  const lc = new THREE.PerspectiveCamera();
  function layout() {
    const w = innerWidth, h = innerHeight, asp = w / h;
    tall = asp < 0.85;
    renderer.setSize(w, h, false);
    camera.aspect = asp; camera.fov = tall ? 62 : 50; camera.updateProjectionMatrix();
    S = tall ? 0.62 : 1;
    bee.root.scale.setScalar(tall ? 0.42 : 0.55);
    camBase.set(0, tall ? 2.3 : 2.2, tall ? 12 : 10);
    lookBase.set(0, tall ? 5.4 : 4.8, -4);
    lc.copy(camera); lc.position.copy(camBase); lc.lookAt(lookBase); lc.updateMatrixWorld();
    const L = tall ? LAYOUT.tall : LAYOUT.wide;
    for (const f of F) {
      const [u, v, d] = L[f.i] || [((f.i * 0.618) % 1) * 1.6 - 0.8, -0.5 + ((f.i * 0.382) % 1) * 0.6, 12];
      const dir = V(u, v, 0.5).unproject(lc).sub(lc.position).normalize();
      const H = lc.position.clone().addScaledVector(dir, d);
      H.y = Math.max(H.y, 1.3);
      const lean = Math.min(1, H.y / 8);
      const B = V(H.x + (f.rnd[0] - 0.5) * 1.4 * S * lean, 0, H.z + (f.rnd[1] - 0.5) * lean);
      f.group.position.copy(B); f.group.rotation.set(0, 0, 0);
      const hl = H.clone().sub(B);
      // ponytail: near slots were designed for buds, so shrink full blooms by depth.
      f.k = S * THREE.MathUtils.clamp(d / 12, 0.55, 1);
      f.face.position.copy(hl); f.face.scale.setScalar(f.k);
      f.stem.geometry.dispose();
      f.stem.geometry = stemGeo(hl, 0.06 + 0.06 * S, [(f.rnd[2] - 0.5) * lean, (f.rnd[3] - 0.5) * 0.6 * lean, f.rnd[4], f.rnd[5]]);
      f.group.updateMatrixWorld(true);
      if (f.sp.upright) f.face.rotation.set((f.rnd[2] - 0.5) * 0.3, 0, (f.rnd[3] - 0.5) * 0.3);
      else f.face.lookAt(V((f.rnd[2] - 0.5) * 6, 2 + f.rnd[3] * 5, 0).add(lc.position));
    }
    const [hu, hv] = tall ? LAYOUT.tallHive : LAYOUT.wideHive;
    const hd = V(hu, hv, 0.5).unproject(lc).sub(lc.position).normalize();
    const t = hd.y < -0.02 ? -lc.position.y / hd.y : 9;
    hive.position.copy(lc.position).addScaledVector(hd, Math.min(t, 14)).setY(0);
    hive.scale.setScalar(S * 0.55);
    hive.rotation.y = Math.atan2(lc.position.x - hive.position.x, lc.position.z - hive.position.z);
    if (!started) { camera.position.copy(camBase).add(V(0, -1.2, 5)); look.copy(lookBase).add(V(0, -2, 0)); started = true; }
  }
  let started = false;
  const look = V();
  let rT = 0;
  // where on screen (x, -1..1) a landed flower should sit: centred in the space the note and packet leave free
  let focusNdc = -0.1;
  const tucked = matchMedia('(max-width: 900px), (max-height: 520px)');
  const sheet = matchMedia('(max-width: 900px) and (min-height: 521px)');
  const measureFocus = () => {
    if (note.hidden) return;
    const l = tucked.matches ? 0 : host.packet.getBoundingClientRect().right;
    focusNdc = ((l + note.getBoundingClientRect().left) / 2 / innerWidth) * 2 - 1;
  };
  let tagW: number[] = [], youW = 0;
  const measure = () => { tagW = tags.map((t) => t.offsetWidth); youW = you.offsetWidth; };
  document.fonts.ready.then(measure);
  addEventListener('resize', () => { clearTimeout(rT); rT = window.setTimeout(() => { layout(); measure(); measureFocus(); }, 120); });
  layout();
  if (RM) { camera.position.copy(camBase); look.copy(lookBase); }

  const flowerAt = (i: number) => {
    const f = F[i];
    if (!f) throw new RangeError(`Missing flower ${i}`);
    return f;
  };
  const landPoint = (i: number, out = V()) => {
    if (i === HIVE) return hive.localToWorld(out.set(0, 2.6, 2.35));
    const f = flowerAt(i);
    return f.head.localToWorld(out.set(0, f.sp.landY + 0.12, 0));
  };
  const tagPoint = (i: number, out = V()) => {
    if (i === HIVE) return hive.localToWorld(out.set(0, 6.1, 0));
    const f = flowerAt(i);
    f.face.getWorldPosition(out);
    return out.addScaledVector(UP, -(f.sp.below * f.k + 0.15));
  };

  /* ================= input ================= */
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2(), idleNdc = new THREE.Vector2(), pointerTarget = V();
  let pointerActive = false, hovered = -1, needPick = false;
  canvas.addEventListener('pointermove', (e) => {
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    if (e.pointerType === 'mouse') pointerActive = true;
    needPick = true;
  });
  canvas.addEventListener('pointerleave', () => { pointerActive = false; setHover(-1); });
  canvas.addEventListener('click', (e) => {
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    const i = pick();
    if (i >= 0) host.land(i); else if (host.current() >= 0) host.takeOff();
  });
  tags.forEach((b, i) => {
    b.addEventListener('pointerenter', () => setHover(i));
    b.addEventListener('pointerleave', () => setHover(-1));
    b.addEventListener('focus', () => setHover(i));
    b.addEventListener('blur', () => setHover(-1));
  });
  function pick() {
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(pickables, false)[0];
    const i: unknown = hit?.object.userData.i;
    return typeof i === 'number' ? i : -1;
  }
  function setHover(i: number) {
    if (hovered === i) return;
    if (hovered >= 0) tags[hovered]?.classList.remove('hot');
    hovered = i;
    if (i >= 0) tags[i]?.classList.add('hot');
    canvas.classList.toggle('point', i >= 0);
  }

  /* ================= loop ================= */
  const tmp = V(), tmp2 = V(), acc = V(), dummy = new THREE.Object3D(), plane = new THREE.Plane();
  const fwd = V(), right = V(), camUp = V(), desPos = V(), desLook = V();
  const easeIO = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const easeBack = (x: number) => 1 + 2.2 * Math.pow(x - 1, 3) + 1.2 * Math.pow(x - 1, 2);
  let time = 0, last = performance.now();

  function project(p: THREE.Vector3, el: HTMLElement, w: number | undefined, up = false): [number, number] | undefined {
    tmp2.copy(p).project(camera);
    if (tmp2.z > 1) { el.style.visibility = 'hidden'; return; }
    el.style.visibility = '';
    const half = (w || 0) / 2 + 8;
    const x = THREE.MathUtils.clamp((tmp2.x * 0.5 + 0.5) * innerWidth, half, innerWidth - half);
    const y = THREE.MathUtils.clamp((-tmp2.y * 0.5 + 0.5) * innerHeight - (el === you ? 10 : 0), up ? 44 : 8, innerHeight - (up ? 8 : 44));
    return [x, y];
  }

  function frame(now: number) {
    const current = host.current();
    const dt = Math.min((now - last) / 1000, 0.05); last = now; time += dt;
    uTime.value = RM ? 0 : time;
    const follow = (rate: number) => (RM ? 1 : 1 - Math.exp(-dt * rate));

    camera.getWorldDirection(fwd);
    right.crossVectors(fwd, UP).normalize();
    camUp.crossVectors(right, fwd).normalize();

    if (needPick && pointerActive) { needPick = false; setHover(pick()); }

    // flowers: bloom in, sway, nod when hovered
    F.forEach((f) => {
      const b = RM ? 1 : Math.min(1, Math.max(0, (time - 0.5 - f.i * 0.11) / 1.1));
      f.hover += ((hovered === f.i || current === f.i ? 1 : 0) - f.hover) * follow(8);
      f.head.scale.setScalar(Math.max(0.001, easeBack(b)) * (1 + f.hover * 0.08));
      if (!RM) {
        f.group.rotation.z = Math.sin(time * 0.6 + f.sway) * 0.018;
        f.group.rotation.x = Math.cos(time * 0.45 + f.sway) * 0.012;
      }
      const tag = tags[f.i];
      if (tag) tag.style.opacity = String(b);
    });
    {
      const hv = hovered === HIVE || current === HIVE ? 1.06 : 1;
      hive.scale.lerp(tmp.setScalar(S * 0.55 * hv), follow(8));
    }

    // bee
    if (bee.mode === 'free') {
      if (pointerActive) {
        ray.setFromCamera(ndc, camera);
        plane.setFromNormalAndCoplanarPoint(fwd, tmp.copy(camera.position).addScaledVector(fwd, 7));
        if (ray.ray.intersectPlane(plane, pointerTarget)) pointerTarget.y = Math.max(pointerTarget.y, 1.2);
      } else {
        ray.setFromCamera(idleNdc.set(Math.sin(time * 0.35) * 0.45, (tall ? -0.12 : 0.05) + Math.sin(time * 0.6) * 0.18), camera);
        pointerTarget.copy(ray.ray.origin).addScaledVector(ray.ray.direction, 7.5);
      }
      if (RM) { bee.pos.copy(pointerTarget); bee.vel.set(0, 0, 0); }
      else {
        acc.copy(pointerTarget).sub(bee.pos).multiplyScalar(7).addScaledVector(bee.vel, -4.2);
        bee.vel.addScaledVector(acc, dt).clampLength(0, 16);
        bee.pos.addScaledVector(bee.vel, dt);
      }
    } else if (bee.mode === 'fly') {
      landPoint(bee.target, bee.p2);
      bee.t = Math.min(1, bee.t + dt / bee.dur);
      const e = easeIO(bee.t), k = 1 - e;
      tmp.copy(bee.pos);
      bee.pos.set(0, 0, 0).addScaledVector(bee.p0, k * k).addScaledVector(bee.p1, 2 * k * e).addScaledVector(bee.p2, e * e);
      bee.vel.copy(bee.pos).sub(tmp).divideScalar(Math.max(dt, 1e-3));
      if (bee.t >= 1) { bee.mode = 'landed'; host.markVisited(bee.target); }
    } else {
      landPoint(bee.target, bee.pos); bee.vel.set(0, 0, 0);
    }
    const flying = bee.mode !== 'landed';
    bee.root.position.copy(bee.pos);
    if (!RM && flying) bee.root.position.y += Math.sin(time * 4.2) * 0.07;
    const speed = bee.vel.length();
    tmp.copy(bee.pos);
    if (flying && speed > 1.2) tmp.addScaledVector(bee.vel, 1 / speed);
    else tmp.add(tmp2.copy(camera.position).sub(bee.pos).setY(0).normalize());
    dummy.position.copy(bee.pos); dummy.lookAt(tmp);
    if (flying) dummy.rotateZ(THREE.MathUtils.clamp(bee.vel.dot(right) * -0.05, -0.5, 0.5));
    bee.root.quaternion.slerp(dummy.quaternion, follow(7));
    if (!RM) trail.update(dt, bee.root.position, flying && speed > 0.5);
    const flap = flying ? 0.35 + 0.6 * Math.sin(time * (RM ? 8 : 58)) : (Math.sin(time * 1.3) > 0.93 ? 0.4 + 0.5 * Math.sin(time * 50) : 0.12);
    bee.wings.forEach((wing, i) => { wing.rotation.z = i === 0 ? -flap : flap; });
    for (const p of bee.pollen) p.scale.setScalar(Math.max(0.001, p.scale.x + (bee.pollenAmt - p.scale.x) * follow(4)));

    // camera
    if (current >= 0) {
      landPoint(current, desLook);
      const dist = (current === HIVE ? 9 : current < NF && F[current]?.sp.upright ? 7 : 8.5) * (current === HIVE ? S : flowerAt(current).k) + 1.5;
      desPos.copy(camBase).sub(lookBase).normalize().multiplyScalar(dist).add(desLook);
      desPos.y = Math.max(desPos.y, desLook.y + 0.9, 2.2);
      if (sheet.matches) desLook.addScaledVector(UP, -dist * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 0.5);
      else {
        const shift = -focusNdc * dist * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
        desPos.addScaledVector(right, shift); desLook.addScaledVector(right, shift);
      }
    } else {
      desPos.copy(camBase); desLook.copy(lookBase);
      if (pointerActive && !RM) desPos.addScaledVector(right, ndc.x * 0.6).addScaledVector(UP, ndc.y * 0.3);
    }
    camera.position.lerp(desPos, follow(current >= 0 ? 2.2 : 1.6));
    look.lerp(desLook, follow(current >= 0 ? 2.6 : 1.6));
    camera.lookAt(look);
    sky.position.copy(camera.position);

    // tags + the bee's label follow the world
    camera.updateMatrixWorld();
    if (current < 0) items.forEach((_, i) => {
      const tag = tags[i];
      if (!tag) return;
      const xy = project(tagPoint(i, tmp), tag, tagW[i], i === HIVE);
      if (!xy) return;
      tag.style.transform = `translate(${xy[0].toFixed(1)}px, ${xy[1].toFixed(1)}px) translate(-50%, ${i === HIVE ? '-100%' : '0'})`;
    });
    if (!you.classList.contains('gone')) {
      const xy = project(tmp.copy(bee.root.position).addScaledVector(UP, 0.75), you, youW, true);
      if (xy) you.style.transform = `translate(${xy[0].toFixed(1)}px, ${xy[1].toFixed(1)}px) translate(-50%, -100%)`;
      you.style.opacity = time > 1.2 ? '1' : '0';
    }

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  const world: World = {
    land(i) {
      measureFocus();
      bee.target = i;
      bee.p0.copy(bee.pos);
      landPoint(i, bee.p2);
      const d = bee.p0.distanceTo(bee.p2);
      bee.p1.copy(bee.p0).lerp(bee.p2, 0.5).addScaledVector(UP, 1.5 + d * 0.18);
      bee.t = 0; bee.dur = RM ? 0.001 : THREE.MathUtils.clamp(d / 9, 0.7, 1.6);
      bee.mode = 'fly';
    },
    takeOff() {
      bee.mode = 'free';
      bee.vel.set(0, 3, 0);
    },
    setPollen(k) { bee.pollenAmt = 0.35 + 0.65 * k; },
  };
  // A tag can be selected before this lazy-loaded scene is ready.
  const initial = host.current();
  if (initial >= 0) world.land(initial);
  return world;
}
