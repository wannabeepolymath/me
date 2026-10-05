import * as THREE from 'three';
import { DAKSH, type Card as CardData, type JokerCard, type JackCard, type Suit } from './data';
import { $, isFill, cardLabel, fail } from './fallback';
import { audio, sfx, toggleSound } from './audio';

type SpringKey = 'x' | 'z' | 'yaw' | 'flip' | 'lift' | 'slide' | 'bend' | 'up' | 'y0';
type SpringState = Record<SpringKey, number>;
type CardMesh = THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial> & {
  userData: { card?: DeckCard };
};
interface DeckCard {
  i: number;
  data: CardData;
  geo: THREE.PlaneGeometry;
  z0: Float32Array;
  face: CardMesh;
  back: CardMesh;
  group: THREE.Group;
  faceMat: THREE.MeshStandardMaterial;
  bendNow: number;
  gatherAt: number;
  free: boolean;
  layFlipped?: boolean;
  jx: number;
  jz: number;
  jy: number;
  p: SpringState;
  v: SpringState;
  t: SpringState;
}
interface DeckPath { pts: THREE.Vector2[]; L: number[]; len: number; gap?: number; }
interface Sweep {
  P: DeckPath;
  hand: number;
  laid: number;
  auto?: { t0: number; dur: number; to: number };
  manual?: boolean;
  flipOnLay?: number;
}
interface Layout {
  rect: [number, number, number, number];
  ppu: number;
  C: [number, number];
  rName: number;
  name: number;
  rBand: [number, number];
  quote: number;
  qShift?: number;
  rPick: number;
  pick: number;
  box: [number, number, number, number];
  elev: number;
  yaw: number;
  fov: number;
}
interface AceLink { href: string; u0: number; u1: number; v0: number; v1: number; }
type CardHit = { c: DeckCard; h: THREE.Intersection<CardMesh> };
interface Press { x: number; y: number; t: number; hit: CardHit | null; p: THREE.Vector3; id: number; }
interface Drag {
  c: DeckCard;
  r: { x: number; z: number };
  yaw0: number;
  w: number;
  last: THREE.Vector3;
  at: THREE.Vector3;
  vel: { x: number; z: number };
  tl: number;
}

export async function startScene(glTimer: number): Promise<void> {
  const D = DAKSH;
  const N = D.cards.length;
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;


  /* ---------------- palette + type ---------------- */
  const STOCK = '#fbf9f4', INK = '#161311', RED = '#c4182c', GOLD = '#dcb96e', ULTRA = '#1f3d9c', IVORY = '#f3ead7', YEL = '#e7b230', GRAPHITE = '#5d5a55';
  const ROZHA = '"Rozha One", Georgia, serif', LIT = 'Literata, Georgia, serif', PEN = '"Reenie Beanie", "Comic Sans MS", cursive';
  const suitColor = (s: Suit | 'joker' | undefined) => (s === 'hearts' || s === 'diamonds' || s === 'joker') ? RED : INK;

  /* ---------------- renderer (bail to the flat deck if WebGL is missing) ---------------- */
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    if (!renderer.getContext()) throw new Error('no gl');
  } catch (e) { fail(glTimer); throw e; }
  renderer.domElement.className = 'table';
  renderer.domElement.setAttribute('aria-hidden', 'true');
  document.body.prepend(renderer.domElement);
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const ANISO = renderer.capabilities.getMaxAnisotropy();

  try {
    await Promise.race([
      Promise.all(['400 100px "Rozha One"', '400 40px Literata', 'italic 400 40px Literata', '600 40px Literata', '400 60px "Reenie Beanie"'].map((f) => document.fonts.load(f))),
      new Promise<void>((r) => setTimeout(r, 3500))
    ]);
  } catch (e) { /* draw with fallbacks */ }

  /* ---------------- canvas helpers ---------------- */
  const SMALL = Math.min(screen.width, screen.height) < 600;
  const TS = SMALL ? 0.72 : 1;               // texture scale
  const CW = 1024, CH = 1434;                 // card face in "design pixels" (2.5 x 3.5 in)
  function canvas(w: number, h: number) { const c = document.createElement('canvas'); c.width = Math.round(w); c.height = Math.round(h); return c; }
  function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function font(g: CanvasRenderingContext2D, px: number, fam: string, style = '') { g.font = `${style} ${px}px ${fam}`.trim(); }
  function wrap(g: CanvasRenderingContext2D, text: string, maxW: number) {
    const out = []; let cur = '';
    for (const w of text.split(/\s+/)) { const t = cur ? cur + ' ' + w : w; if (g.measureText(t).width > maxW && cur) { out.push(cur); cur = w; } else cur = t; }
    if (cur) out.push(cur); return out;
  }
  function fit(g: CanvasRenderingContext2D, text: string, maxW: number, px: number, fam: string, style = '') { font(g, px, fam, style); const w = g.measureText(text).width; if (w > maxW) { px = Math.floor(px * maxW / w); font(g, px, fam, style); } return px; }

  /* suit pips drawn as shapes (glyphs vary by platform) — centred, unit height */
  function heartAt(g: CanvasRenderingContext2D, x: number, y: number, s: number, up = false) {
    g.save(); g.translate(x, y); g.scale(s, up ? -s : s);
    const a = 0.6407, h2 = Math.SQRT2;
    g.beginPath(); g.moveTo(0, 0.5); g.lineTo(-a / h2, 0.5 - a / h2); g.lineTo(0, 0.5 - a * h2); g.lineTo(a / h2, 0.5 - a / h2); g.closePath(); g.fill();
    for (const sx of [-1, 1]) { g.beginPath(); g.arc(sx * a / (2 * h2), 0.5 - 3 * a / (2 * h2), a / 2, 0, Math.PI * 2); g.fill(); }
    g.restore();
  }
  function stem(g: CanvasRenderingContext2D, x: number, y: number, s: number) {
    g.save(); g.translate(x, y); g.scale(s, s);
    g.beginPath(); g.moveTo(-0.03, 0.06); g.quadraticCurveTo(0, 0.38, -0.24, 0.5); g.lineTo(0.24, 0.5); g.quadraticCurveTo(0, 0.38, 0.03, 0.06); g.closePath(); g.fill();
    g.restore();
  }
  function pip(g: CanvasRenderingContext2D, suit: Suit | 'joker', x: number, y: number, s: number) {
    if (suit === 'hearts') heartAt(g, x, y, s);
    else if (suit === 'spades') { heartAt(g, x, y - s * 0.1, s * 0.8, true); stem(g, x, y, s); }
    else if (suit === 'clubs') {
      for (const [dx, dy] of [[0, -0.27], [-0.25, 0.04], [0.25, 0.04]] as const) { g.beginPath(); g.arc(x + dx * s, y + dy * s, 0.225 * s, 0, Math.PI * 2); g.fill(); }
      stem(g, x, y, s);
    } else if (suit === 'diamonds') {
      g.beginPath(); g.moveTo(x, y - 0.5 * s);
      g.quadraticCurveTo(x + 0.1 * s, y - 0.14 * s, x + 0.38 * s, y); g.quadraticCurveTo(x + 0.1 * s, y + 0.14 * s, x, y + 0.5 * s);
      g.quadraticCurveTo(x - 0.1 * s, y + 0.14 * s, x - 0.38 * s, y); g.quadraticCurveTo(x - 0.1 * s, y - 0.14 * s, x, y - 0.5 * s); g.fill();
    } else { // star for the joker
      g.beginPath(); for (let i = 0; i < 10; i++) { const r = (i % 2 ? 0.2 : 0.5) * s, a = -Math.PI / 2 + i * Math.PI / 5; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g.closePath(); g.fill();
    }
  }

  /* ---------------- card faces ---------------- */
  const FX = 220, FY = 70, FW = 584, FH = 1294; // the court frame
  function drawIndex(g: CanvasRenderingContext2D, c: CardData) {
    const col = suitColor(c.rank === 'joker' ? 'joker' : c.suit);
    g.fillStyle = col; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    if (c.rank === 'joker') {
      font(g, 66, ROZHA); [...'JOKER'].forEach((ch, i) => g.fillText(ch, 100, 136 + i * 70));
      pip(g, 'joker', 100, 520, 92);
      return;
    }
    font(g, 168, ROZHA); g.fillText(c.rank, 100, 196);
    pip(g, c.suit, 100, 292, 96);
    // the trade, written down the spine so a spread reads like a list
    g.save(); g.translate(92, 380); g.rotate(Math.PI / 2); g.textAlign = 'left'; g.textBaseline = 'middle';
    if (isFill(c.trade)) { font(g, 66, PEN); g.fillStyle = GRAPHITE; }
    else { font(g, 54, LIT, 'italic'); g.fillStyle = col; }
    g.fillText(c.rank === 'A' ? 'the maker' : c.trade, 0, 0);
    g.restore();
  }
  function textBlock(g: CanvasRenderingContext2D, text: string | undefined, x: number, y: number, maxW: number, px: number, lh: number, maxY: number) {
    if (!text) return y;
    if (isFill(text)) { font(g, Math.round(px * 1.5), PEN); g.fillStyle = GRAPHITE; lh *= 1.02; }
    else { font(g, px, LIT); g.fillStyle = INK; }
    for (const line of wrap(g, text, maxW)) { if (y > maxY) break; g.fillText(line, x, y); y += lh; }
    return y;
  }
  function drawHalf(g: CanvasRenderingContext2D, c: JokerCard | JackCard) { // frame-local coordinates, top half (above the diagonal)
    const col = suitColor(c.rank === 'joker' ? 'joker' : c.suit);
    // costume band, in court-card colours
    g.fillStyle = YEL; g.fillRect(0, 0, FW, 50);
    for (let x = 22, i = 0; x < FW; x += 44, i++) {
      g.fillStyle = i % 2 ? RED : ULTRA;
      g.beginPath(); g.moveTo(x, 9); g.lineTo(x + 13, 25); g.lineTo(x, 41); g.lineTo(x - 13, 25); g.closePath(); g.fill();
    }
    g.fillStyle = INK; g.fillRect(0, 50, FW, 4);
    const pad = 40, maxW = FW - pad * 2;
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    let y = 128;
    font(g, 44, LIT, 'italic'); g.fillStyle = col; g.fillText(c.rank === 'joker' ? 'The wildcard' : 'Jack of', pad, y);
    y += 106;
    const title = c.rank === 'joker' ? c.title : c.trade;
    if (isFill(title)) { fit(g, title, maxW, 104, PEN); g.fillStyle = GRAPHITE; }
    else { fit(g, title.charAt(0).toUpperCase() + title.slice(1), maxW, 104, ROZHA); g.fillStyle = INK; }
    g.fillText(isFill(title) ? title : title.charAt(0).toUpperCase() + title.slice(1), pad - 4, y);
    y += 34; g.fillStyle = col; g.fillRect(pad, y, 76, 6); y += 70;
    y = textBlock(g, c.body, pad, y, maxW, 38, 50, 548);
    textBlock(g, c.note, pad, y + 12, maxW, 38, 50, 560);
  }
  const ACE_LINKS: AceLink[] = []; // uv rectangles on the ace that act as links
  function drawFace(c: CardData) {
    const cv = canvas(CW * TS, CH * TS), g = cv.getContext('2d')!;
    g.scale(TS, TS);
    rr(g, 0, 0, CW, CH, 68); g.fillStyle = STOCK; g.fill();
    g.save(); g.clip();
    // "air-cushion" finish: a faint dimple grid
    g.fillStyle = 'rgba(90,60,30,0.045)';
    for (let y = 6, r = 0; y < CH; y += 11, r++) for (let x = (r % 2) * 5.5; x < CW; x += 11) g.fillRect(x, y, 2.2, 2.2);
    g.restore();
    drawIndex(g, c);
    g.save(); g.translate(CW, CH); g.rotate(Math.PI); drawIndex(g, c); g.restore();

    if (c.rank === 'A') {
      g.textAlign = 'center'; g.textBaseline = 'alphabetic';
      font(g, 46, LIT, 'italic'); g.fillStyle = INK; g.fillText('The maker’s card', 512, 210);
      g.fillStyle = INK; pip(g, 'spades', 512, 560, 560);
      g.fillStyle = IVORY; font(g, 128, ROZHA); g.fillText('DJ', 512, 560);
      g.fillStyle = INK; font(g, 74, ROZHA); g.fillText('Say hi.', 512, 960);
      font(g, 38, LIT, 'italic'); g.fillText(`Made by ${D.name}, Bangalore`, 512, 1020);
      const links: [string, string][] = [
        [D.email, 'mailto:' + D.email],
        [D.github.replace(/^https?:\/\//, ''), D.github],
        [D.x.replace(/^https?:\/\//, ''), D.x]
      ];
      font(g, 36, LIT);
      links.forEach(([label, href], i) => {
        const y = 1108 + i * 62, w = g.measureText(label).width;
        g.fillStyle = RED; g.fillText(label, 512, y); g.fillRect(512 - w / 2, y + 9, w, 3);
        ACE_LINKS.push({ href, u0: (512 - w / 2 - 14) / CW, u1: (512 + w / 2 + 14) / CW, v0: 1 - (y + 20) / CH, v1: 1 - (y - 44) / CH });
      });
    } else {
      // frame, diagonal split, mirrored halves: a double-ended court card
      g.strokeStyle = INK; g.lineWidth = 4; g.strokeRect(FX, FY, FW, FH);
      g.lineWidth = 1.5; g.strokeRect(FX + 11, FY + 11, FW - 22, FH - 22);
      for (const flip of [false, true]) {
        g.save();
        if (flip) { g.translate(CW, CH); g.rotate(Math.PI); }
        g.translate(FX, FY);
        g.beginPath(); g.moveTo(0, 0); g.lineTo(FW, 0); g.lineTo(FW, 577); g.lineTo(0, 717); g.closePath(); g.clip();
        drawHalf(g, c);
        g.restore();
      }
      g.strokeStyle = INK; g.lineWidth = 3;
      g.beginPath(); g.moveTo(FX, FY + 717); g.lineTo(FX + FW, FY + 577); g.stroke();
      g.fillStyle = suitColor(c.rank === 'joker' ? 'joker' : c.suit);
      pip(g, c.rank === 'joker' ? 'joker' : c.suit, FX + 44, FY + 717 - 34, 40);
      pip(g, c.rank === 'joker' ? 'joker' : c.suit, FX + FW - 44, FY + 577 + 34, 40);
    }
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = ANISO;
    return t;
  }

  /* ---------------- card back: a guilloche in ultramarine ---------------- */
  function drawBack() {
    const cv = canvas(CW * TS, CH * TS), g = cv.getContext('2d')!;
    g.scale(TS, TS);
    rr(g, 0, 0, CW, CH, 68); g.fillStyle = STOCK; g.fill();
    rr(g, 54, 54, CW - 108, CH - 108, 26); g.fillStyle = ULTRA; g.fill();
    g.save(); g.clip();
    g.strokeStyle = 'rgba(243,234,215,0.22)'; g.lineWidth = 2;
    for (let d = -CH; d < CW + CH; d += 26) {
      g.beginPath(); g.moveTo(d, 0); g.lineTo(d + CH, CH); g.stroke();
      g.beginPath(); g.moveTo(d, CH); g.lineTo(d + CH, 0); g.stroke();
    }
    g.translate(512, 717);
    g.strokeStyle = 'rgba(243,234,215,0.5)'; g.lineWidth = 1.4;
    for (let i = 0; i < 96; i++) { g.save(); g.rotate(i * Math.PI / 96); g.beginPath(); g.ellipse(0, 0, 360, 118, 0, 0, Math.PI * 2); g.stroke(); g.restore(); }
    g.strokeStyle = 'rgba(243,234,215,0.7)';
    for (let i = 0; i < 60; i++) { g.save(); g.rotate(i * Math.PI / 60); g.beginPath(); g.ellipse(0, 0, 228, 64, 0, 0, Math.PI * 2); g.stroke(); g.restore(); }
    // corner fans
    for (const [cx, cy] of [[-458, -663], [458, -663], [-458, 663], [458, 663]] as const) {
      for (let r = 30; r < 230; r += 16) { g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke(); }
    }
    g.beginPath(); g.arc(0, 0, 158, 0, Math.PI * 2); g.fillStyle = ULTRA; g.fill();
    g.strokeStyle = IVORY; g.lineWidth = 5; g.stroke();
    g.lineWidth = 1.6; g.beginPath(); g.arc(0, 0, 144, 0, Math.PI * 2); g.stroke();
    g.fillStyle = IVORY; g.textAlign = 'center'; g.textBaseline = 'middle';
    font(g, 150, ROZHA); g.fillText('DJ', 0, 14);
    font(g, 25, LIT, '600');
    const ring = ' WANNABEE • POLYMATH • WANNABEE • POLYMATH •';
    const per = (Math.PI * 2) / ring.length;
    [...ring].forEach((ch, i) => { g.save(); g.rotate(i * per); g.translate(0, -190); g.fillText(ch, 0, 0); g.restore(); });
    g.restore();
    g.strokeStyle = IVORY; g.lineWidth = 3; rr(g, 74, 74, CW - 148, CH - 148, 16); g.stroke();
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = ANISO;
    t.wrapS = THREE.RepeatWrapping; t.repeat.x = -1; // seen from below, so mirror it back
    return t;
  }

  /* ---------------- the felt ---------------- */
  function feltTile() {
    const cv = canvas(512, 512), g = cv.getContext('2d')!;
    g.fillStyle = '#d6d6d6'; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 16000; i++) {
      const x = Math.random() * 512, y = Math.random() * 512, a = Math.random() * Math.PI * 2, l = 2 + Math.random() * 7;
      g.strokeStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.11)'; g.lineWidth = 0.8;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a + 1) * l * 0.5, y + Math.sin(a + 1) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(48, 48); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = ANISO;
    return t;
  }
  const LAYOUT: Record<'land' | 'port', Layout> = {
    land: { rect: [-11, 11, -9, 7], ppu: 110, C: [-1.5, -18.6], rName: 15.0, name: 1.38, rBand: [15.42, 16.08], quote: 0.22, qShift: 0.1, rPick: 22.35, pick: 0.34,
            box: [-4.6, 4.6, -4.75, 3.35], elev: 46, yaw: -12, fov: 26 },
    port: { rect: [-7, 7, -9, 7], ppu: 120, C: [0, -21.6], rName: 15.55, name: 1.08, rBand: [15.95, 16.5], quote: 0.17, rPick: 24.75, pick: 0.32,
            box: [-3.9, 3.9, -7.3, 3.7], elev: 72, yaw: 0, fov: 36 }
  };
  function arcText(g: CanvasRenderingContext2D, text: string, cx: number, cy: number, r: number, px: number, fam: string, track: number, style = '', shift = 0) {
    font(g, px, fam, style); g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    const chars = [...text], ws = chars.map((ch) => g.measureText(ch).width);
    const total = ws.reduce((a, b) => a + b, 0) + track * (chars.length - 1);
    let a = -total / 2 + shift * r;
    chars.forEach((ch, i) => {
      const th = (a + ws[i]! / 2) / r;
      g.save(); g.translate(cx + r * Math.sin(th), cy + r * Math.cos(th)); g.rotate(-th); g.fillText(ch, 0, 0); g.restore();
      a += ws[i]! + track;
    });
    return total / r; // angle used (centred on `shift`)
  }
  function drawPrint(L: Layout) {
    const [x0, x1, z0, z1] = L.rect, ppu = L.ppu;
    const cv = canvas((x1 - x0) * ppu, (z1 - z0) * ppu), g = cv.getContext('2d')!;
    const X = (x: number) => (x - x0) * ppu, Z = (z: number) => (z - z0) * ppu;
    const cx = X(L.C[0]), cy = Z(L.C[1]);
    g.fillStyle = GOLD; g.strokeStyle = GOLD;
    arcText(g, 'DAKSH JAIN', cx, cy, L.rName * ppu, L.name * ppu, ROZHA, L.name * 0.09 * ppu);
    const [ra, rb] = L.rBand;
    const span = arcText(g, 'A JACK OF ALL TRADES IS A MASTER OF NONE, BUT OFTENTIMES BETTER THAN A MASTER OF ONE',
      cx, cy, ((ra + rb) / 2 + L.quote * 0.36) * ppu, L.quote * ppu, LIT, L.quote * 0.2 * ppu, '600', L.qShift || 0);
    const q0 = L.qShift || 0;
    g.lineWidth = 0.035 * ppu;
    for (const r of [ra, rb]) { g.beginPath(); g.arc(cx, cy, r * ppu, Math.PI / 2 - q0 - span / 2 - 0.06, Math.PI / 2 - q0 + span / 2 + 0.06); g.stroke(); }
    // little suit marks capping the band
    const capR = ((ra + rb) / 2) * ppu, capA = span / 2 + 0.035;
    (['spades', 'hearts'] as const).forEach((s, i) => {
      const th = q0 + (i ? 1 : -1) * capA;
      g.save(); g.translate(cx + capR * Math.sin(th), cy + capR * Math.cos(th)); g.rotate(-th); pip(g, s, 0, 0, (rb - ra) * 0.62 * ppu); g.restore();
    });
    arcText(g, 'PICK A CARD, ANY CARD', cx, cy, L.rPick * ppu, L.pick * ppu, LIT, L.pick * 0.3 * ppu, '600');
    // wear: printed ink on felt never sits perfectly
    g.globalCompositeOperation = 'destination-out';
    const area = cv.width * cv.height;
    for (let i = 0; i < area / 260; i++) {
      g.fillStyle = `rgba(0,0,0,${0.25 + Math.random() * 0.6})`;
      g.beginPath(); g.arc(Math.random() * cv.width, Math.random() * cv.height, 0.4 + Math.random() * 1.6, 0, Math.PI * 2); g.fill();
    }
    g.globalCompositeOperation = 'source-over';
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = ANISO;
    return t;
  }

  /* ---------------- scene ---------------- */
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#1d0509');
  const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.1, 300);

  const felt = new THREE.Mesh(
    new THREE.PlaneGeometry(160, 160).rotateX(-Math.PI / 2),
    new THREE.MeshPhysicalMaterial({ color: '#6e1729', map: feltTile(), roughness: 1, sheen: 1, sheenRoughness: 0.5, sheenColor: new THREE.Color('#c95468') })
  );
  felt.receiveShadow = true;
  scene.add(felt);

  const printMat = new THREE.MeshStandardMaterial({ transparent: true, roughness: 0.62, metalness: 0.15, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const print = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), printMat);
  print.position.y = 0.001; print.receiveShadow = true;
  scene.add(print);

  scene.add(new THREE.HemisphereLight('#ffe7d6', '#3b0b16', 0.32));
  const lamp = new THREE.SpotLight('#fff2e2', 3.9, 0, 0.36, 1, 0);
  lamp.position.set(-1.5, 24, 7);
  lamp.target.position.set(0, 0, 0.3);
  lamp.castShadow = true;
  lamp.shadow.mapSize.set(2048, 2048);
  lamp.shadow.camera.near = 8; lamp.shadow.camera.far = 50;
  lamp.shadow.bias = -0.0004; lamp.shadow.normalBias = 0.02;
  lamp.shadow.radius = 4;
  scene.add(lamp, lamp.target);

  /* ---------------- cards ---------------- */
  const W = 2.5, H = 3.5, T = 0.011, BASE = 0.006;
  const backMat = new THREE.MeshStandardMaterial({ map: drawBack(), roughness: 0.42, metalness: 0, side: THREE.BackSide, alphaTest: 0.5 });
  const SP: Record<SpringKey, [number, number]> = { x: [120, 0.82], z: [120, 0.82], yaw: [110, 0.86], flip: [85, 0.9], lift: [210, 0.8], slide: [170, 0.7], bend: [190, 0.4], up: [70, 0.93], y0: [210, 1] };
  const springKeys = Object.keys(SP) as SpringKey[];
  const cards: DeckCard[] = D.cards.map((data, i) => {
    const geo = new THREE.PlaneGeometry(W, H, 4, 14).rotateX(-Math.PI / 2);
    const z0 = Float32Array.from({ length: geo.getAttribute('position').count }, (_, k) => geo.getAttribute('position').getZ(k));
    const tex = drawFace(data);
    const faceMat = new THREE.MeshStandardMaterial({ map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.05, roughness: 0.42, metalness: 0, alphaTest: 0.5, shadowSide: THREE.DoubleSide });
    const face: CardMesh = new THREE.Mesh(geo, faceMat), back: CardMesh = new THREE.Mesh(geo, backMat);
    face.castShadow = true; face.receiveShadow = true; back.receiveShadow = true;
    const group = new THREE.Group(); group.add(face, back); scene.add(group);
    const c: DeckCard = { i, data, geo, z0, face, back, group, faceMat, bendNow: 0, gatherAt: 0, free: false,
      jx: (Math.random() - 0.5) * 0.04, jz: (Math.random() - 0.5) * 0.05, jy: (Math.random() - 0.5) * 0.05,
      p: { x: 0, z: 0, yaw: 0, flip: 0, lift: 0, slide: 0, bend: 0, up: 0, y0: 0 },
      v: { x: 0, z: 0, yaw: 0, flip: 0, lift: 0, slide: 0, bend: 0, up: 0, y0: 0 },
      t: { x: 0, z: 0, yaw: 0, flip: 0, lift: 0, slide: 0, bend: 0, up: 0, y0: 0 } };
    for (const k of springKeys) { c.p[k] = c.t[k] = 0; c.v[k] = 0; }
    c.p.flip = c.t.flip = Math.PI; // face down
    face.userData.card = back.userData.card = c;
    return c;
  });
  let order = cards.slice();
  const meshes = cards.flatMap((c) => [c.face, c.back]);

  function bendGeo(c: DeckCard, k: number) {
    if (Math.abs(k - c.bendNow) < 2e-4) return;
    c.bendNow = k;
    const pos = c.geo.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const z = c.z0[i]!;
      if (Math.abs(k) < 1e-4) { pos.setY(i, 0); pos.setZ(i, z); }
      else { const th = k * z; pos.setZ(i, Math.sin(th) / k); pos.setY(i, (1 - Math.cos(th)) / k); }
    }
    pos.needsUpdate = true; c.geo.computeVertexNormals(); c.geo.computeBoundingSphere();
  }
  const near = (a: number, ref: number) => a + Math.round((ref - a) / (Math.PI * 2)) * Math.PI * 2;

  /* ---------------- paths: cards are laid along whatever you draw ---------------- */
  function makePath(pts: THREE.Vector2[]): DeckPath { const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1]! + pts[i]!.distanceTo(pts[i - 1]!)); return { pts, L, len: L[L.length - 1]! }; }
  function pathAt(P: DeckPath, s: number) {
    if (P.pts.length === 1) return { x: P.pts[0]!.x, z: P.pts[0]!.y };
    s = Math.max(0, Math.min(P.len, s));
    let i = 1; while (i < P.L.length - 1 && P.L[i]! < s) i++;
    const a = P.pts[i - 1]!, b = P.pts[i]!, seg = (P.L[i]! - P.L[i - 1]!) || 1, t = (s - P.L[i - 1]!) / seg;
    return { x: a.x + (b.x - a.x) * t, z: a.y + (b.y - a.y) * t };
  }
  function pathDir(P: DeckPath, s: number) {
    const a = pathAt(P, s - 0.45), b = pathAt(P, s + 0.45), dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz);
    return l < 1e-4 ? null : { x: dx / l, z: dz / l };
  }
  let mode: 'land' | 'port' = innerWidth >= innerHeight ? 'land' : 'port';
  function defaultPath() {
    const pts = [];
    if (mode === 'land') {
      for (let i = 0; i <= 60; i++) { const t = i / 60; pts.push(new THREE.Vector2(-3.1 + 7.8 * t, 1.25 - 0.75 * t + 0.28 * Math.sin(t * Math.PI))); }
      return makePath(pts);
    }
    // portrait: a ribbon spread around a tight arc is a fan, held as if in a hand
    const R = 2.3, zp = 0.3, a = 0.7;
    for (let i = 0; i <= 60; i++) { const f = -a + 2 * a * i / 60; pts.push(new THREE.Vector2(R * Math.sin(f), zp - R * Math.cos(f))); }
    const P = makePath(pts); P.gap = (2 * a * R) / (N - 1); return P;
  }
  const USER_GAP = 0.62;

  let sweep: Sweep | null = null;          // an in-progress deal along a path
  let lastLayout: { P: DeckPath; hand: number; user: boolean } | null = null;     // {P, hand, user}
  function layoutAlong(P: DeckPath, hand: number, now: number, flipOnLay?: number) {
    const dirHand = pathDir(P, hand), gap = P.gap || USER_GAP;
    let laid = 0;
    order.forEach((c, k) => {
      if (now < c.gatherAt) return;
      const s = k * gap; const carried = s > hand + 1e-4;
      const at = pathAt(P, carried ? hand : s), d = carried ? dirHand : pathDir(P, s);
      c.t.x = at.x + (carried ? 0 : c.jx); c.t.z = at.z + (carried ? 0 : c.jz);
      if (d) c.t.yaw = near(Math.atan2(-d.z, d.x) + (carried ? 0 : c.jy), c.p.yaw);
      c.t.y0 = BASE + k * T + (carried ? 0.03 : 0);
      if (!carried) { laid++; if (flipOnLay !== undefined && !c.layFlipped) { c.layFlipped = true; c.t.flip = flipOnLay; } }
    });
    return laid;
  }

  /* ---------------- deck actions ---------------- */
  let faceUp = false, busy = false, touched = false;
  let picked: DeckCard | null = null, hovered: DeckCard | null = null, focused: DeckCard | null = null;
  const timers = new Set<number>();
  const later = (ms: number, fn: () => void) => { if (RM) { fn(); return; } const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); };
  const wait = (ms: number) => new Promise<void>((r) => (RM ? r() : setTimeout(r, ms)));

  function deal(P: DeckPath, { dur = 1100, flipOnLay }: { dur?: number; flipOnLay?: number } = {}) {
    order.forEach((c) => { c.layFlipped = false; c.free = false; });
    sweep = { P, hand: 0, laid: 0, auto: { t0: performance.now(), dur, to: (N - 1) * (P.gap || USER_GAP) }, flipOnLay };
    if (RM) { sweep.hand = sweep.auto!.to; finishSweep(); }
  }
  function finishSweep() {
    if (!sweep) return;
    layoutAlong(sweep.P, sweep.hand, Infinity, sweep.flipOnLay);
    lastLayout = { P: sweep.P, hand: sweep.hand, user: !sweep.auto };
    sweep = null;
  }
  function turnOver() {
    if (busy) return;
    if (picked) putBack();
    faceUp = !faceUp;
    const seq = faceUp ? order : order.slice().reverse();
    seq.forEach((c, k) => later(k * 58, () => { c.t.flip = faceUp ? 0 : Math.PI; sfx.flip(); }));
  }
  function pickUp(c: DeckCard | undefined) {
    if (busy || !c) return;
    if (picked && picked !== c) putBack(true);
    picked = c; c.t.up = 1; c.t.flip = 0; hovered = null;
    sfx.lift();
    $('held').hidden = false; $('links').hidden = c.data.rank !== 'A';
    $('hint').classList.add('gone');
    const d = c.data;
    $('live').textContent = d.rank === 'A'
      ? `The ace of spades, the maker's card. Write to Daksh at ${D.email}. GitHub and X links are below.`
      : `${cardLabel(d)}. ${isFill(d.body) ? '' : d.body || ''} ${d.note && !isFill(d.note) ? d.note : ''}`;
  }
  function putBack(silent = false) {
    if (!picked) return;
    picked.t.up = 0; picked = null;
    if (!silent) { $('held').hidden = true; later(260, () => sfx.lay()); }
  }
  function step(dir: number) {
    if (!picked) return;
    const k = order.indexOf(picked);
    pickUp(order[(k + dir + N) % N]);
  }
  async function shuffle() {
    if (busy) return;
    busy = true; if (picked) putBack(); sweep = null;
    const P = defaultPath(), at = pathAt(P, 0), d = pathDir(P, 0.01)!, yaw = Math.atan2(-d.z, d.x);
    const ax = { x: Math.cos(yaw), z: -Math.sin(yaw) };
    // square the deck, face down
    order.forEach((c, k) => later(k * 24, () => { Object.assign(c.t, { x: at.x, z: at.z, yaw: near(yaw, c.p.yaw), y0: BASE + k * T, flip: Math.PI, slide: 0 }); c.free = false; }));
    sfx.swish(0.5);
    await wait(760);
    // cut into two packets and bow them
    const h = Math.ceil(N / 2), A = order.slice(0, h), B = order.slice(h);
    [A, B].forEach((pk, side) => pk.forEach((c, k) => {
      const sgn = side ? 1 : -1;
      Object.assign(c.t, { x: at.x + ax.x * 1.42 * sgn, z: at.z + ax.z * 1.42 * sgn, yaw: near(yaw + sgn * 0.16, c.p.yaw), y0: BASE + k * T, bend: 0.3 });
    }));
    await wait(520);
    // riffle: the packets let go from the bottom, interleaving
    const out: DeckCard[] = [], a = A.slice(), b = B.slice();
    while (a.length || b.length) out.push((!b.length || (a.length && Math.random() < a.length / (a.length + b.length))) ? a.shift()! : b.shift()!);
    sfx.riffle(N + 4);
    out.forEach((c, k) => later(k * 30, () => Object.assign(c.t, { x: at.x, z: at.z, yaw: near(yaw, c.p.yaw), y0: BASE + k * T, bend: 0 })));
    order = out;
    await wait(N * 30 + 520);
    busy = false;
    deal(P, { dur: 1000, flipOnLay: faceUp ? 0 : Math.PI });
  }

  /* ---------------- camera framing ---------------- */
  const tmpV = new THREE.Vector3();
  let holdDist = 8, holdUp = 0;
  function frame() {
    const L = LAYOUT[mode];
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight; camera.fov = L.fov; camera.updateProjectionMatrix();
    const [x0, x1, z0, z1] = L.box, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const e = THREE.MathUtils.degToRad(L.elev), yw = THREE.MathUtils.degToRad(L.yaw), dir = new THREE.Vector3(Math.sin(yw) * Math.cos(e), Math.sin(e), Math.cos(yw) * Math.cos(e));
    const reserve = (innerWidth < 760 ? 128 : 76) / innerHeight * 2;
    const corners = [[x0, z0], [x1, z0], [x0, z1], [x1, z1]] as const;
    let lo = 2, hi = 200;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      camera.position.set(cx, 0, cz).addScaledVector(dir, mid); camera.lookAt(cx, 0, cz); camera.updateMatrixWorld();
      const ok = corners.every(([x, z]) => { tmpV.set(x, 0, z).project(camera); return Math.abs(tmpV.x) <= 0.97 && tmpV.y <= 0.96 && tmpV.y >= -0.97 + reserve; });
      if (ok) hi = mid; else lo = mid;
    }
    // nudge so the reserved strip sits under the table, not over it
    camera.position.set(cx, 0, cz).addScaledVector(dir, hi); camera.lookAt(cx, 0, cz);
    camera.updateMatrixWorld();
    const th = Math.tan(THREE.MathUtils.degToRad(L.fov / 2));
    holdDist = Math.max(H / (0.66 * 2 * th), W / (0.8 * 2 * th * camera.aspect));
    holdUp = holdDist * th * (innerWidth < 760 ? 0.13 : 0.07); // lift the held card clear of the buttons
  }
  function setPrint() {
    const L = LAYOUT[mode], [x0, x1, z0, z1] = L.rect;
    if (printMat.map) printMat.map.dispose();
    printMat.map = drawPrint(L); printMat.needsUpdate = true;
    print.scale.set(x1 - x0, 1, z1 - z0); print.position.set((x0 + x1) / 2, 0.001, (z0 + z1) / 2);
  }
  frame(); setPrint();

  /* ---------------- pointer: hover, pick, drag a card, or draw a spread ---------------- */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), tablePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const ptr = { x: 0, y: 0 };
  let press: Press | null = null, drag: Drag | null = null;
  function setNdc(e: PointerEvent) { ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ptr.x = ndc.x; ptr.y = ndc.y; ray.setFromCamera(ndc, camera); }
  function hitCard(): CardHit | null { const h = ray.intersectObjects<CardMesh>(meshes, false)[0]; const c = h?.object.userData.card; return h && c ? { c, h } : null; }
  function onTable() { const p = new THREE.Vector3(); return ray.ray.intersectPlane(tablePlane, p) ? p : null; }
  function aceLink(h: THREE.Intersection<CardMesh> | undefined) {
    if (!h || !h.object.userData.card || h.object !== h.object.userData.card.face || h.object.userData.card.data.rank !== 'A' || !h.uv) return null;
    const uv = h.uv;
    return ACE_LINKS.find((l) => uv.x >= l.u0 && uv.x <= l.u1 && uv.y >= l.v0 && uv.y <= l.v1) || null;
  }
  function firstTouch() { audio(); if (!touched) { touched = true; } }
  const cvs = renderer.domElement;
  cvs.addEventListener('pointerdown', (e) => {
    firstTouch(); setNdc(e);
    if (busy) return;
    const hit = hitCard();
    if (picked) {
      if (hit && hit.c === picked) { const l = aceLink(hit.h); if (l) { openLink(l.href); return; } }
      putBack(); return;
    }
    cvs.setPointerCapture(e.pointerId);
    const p = onTable(); if (!p) return;
    press = { x: e.clientX, y: e.clientY, t: performance.now(), hit, p, id: e.pointerId };
  });
  function openLink(href: string) { if (href.startsWith('mailto:')) location.href = href; else window.open(href, '_blank', 'noopener'); }
  cvs.addEventListener('pointermove', (e) => {
    setNdc(e);
    if (press && !drag && !sweep?.manual) {
      if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > 7) {
        const p = onTable(); if (!p) return;
        if (press.hit) { // slide one card around with a fingertip
          const c = press.hit.c, top = Math.max(...cards.map((o) => o.p.y0));
          drag = { c, r: { x: c.p.x - press.p.x, z: c.p.z - press.p.z }, yaw0: c.p.yaw, w: 0, last: p.clone(), at: p.clone(), vel: { x: 0, z: 0 }, tl: performance.now() };
          c.free = true; c.t.y0 = top + T; c.t.lift = 0.32; hovered = null; sfx.lift();
        } else { // gather the deck into your hand and deal along your stroke
          const now = performance.now();
          sweep = { P: makePath([new THREE.Vector2(press.p.x, press.p.z)]), hand: 0, laid: 0, manual: true };
          order.forEach((c, k) => { c.gatherAt = now + k * 14; c.free = false; c.t.slide = 0; c.t.bend = 0; });
          $('hint').classList.add('gone'); sfx.swish(0.4);
        }
      }
    }
    if (drag) {
      const p = onTable(); if (!p) return;
      const now = performance.now(), dt = Math.max(1, now - drag.tl) / 1000;
      drag.vel.x = drag.vel.x * 0.6 + ((p.x - drag.last.x) / dt) * 0.4; drag.vel.z = drag.vel.z * 0.6 + ((p.z - drag.last.z) / dt) * 0.4;
      drag.last.copy(p); drag.at.copy(p); drag.tl = now;
    } else if (sweep?.manual) {
      const p = onTable(); if (!p) return;
      const pts = sweep.P.pts, last = pts[pts.length - 1]!, v = new THREE.Vector2(p.x, p.z);
      if (v.distanceTo(last) > 0.07) { pts.push(v); sweep.P = makePath(pts); sweep.hand = sweep.P.len; }
    } else if (!press && !picked && e.pointerType === 'mouse') {
      const hit = hitCard();
      hovered = hit && !busy ? hit.c : null;
      cvs.style.cursor = hovered ? 'pointer' : 'grab';
    } else if (picked) {
      const hit = hitCard();
      cvs.style.cursor = hit && hit.c === picked && aceLink(hit.h) ? 'pointer' : 'default';
    }
  });
  function release() {
    if (!press) return;
    if (drag) {
      const c = drag.c, sp = Math.min(14, Math.hypot(drag.vel.x, drag.vel.z)), k = sp > 0 ? 0.16 * sp / Math.hypot(drag.vel.x, drag.vel.z) : 0;
      c.t.x = c.p.x + (drag.vel.x || 0) * k; c.t.z = c.p.z + (drag.vel.z || 0) * k; c.t.yaw = c.p.yaw + drag.w * 0.12; c.t.lift = 0;
      for (const key of ['x', 'z'] as const) c.v[key] = 0;
      later(140, () => sfx.lay());
      drag = null;
    } else if (sweep?.manual) {
      finishSweep();
    } else if (press.hit && performance.now() - press.t < 600) {
      pickUp(press.hit.c);
    }
    press = null;
  }
  cvs.addEventListener('pointerup', release);
  cvs.addEventListener('pointercancel', release);
  cvs.addEventListener('pointerleave', () => { if (!press) hovered = null; });

  /* ---------------- buttons + keys ---------------- */
  $('turn').addEventListener('click', () => { audio(); turnOver(); });
  $('shuffle').addEventListener('click', () => { audio(); shuffle(); });
  $('sound').addEventListener('click', () => { const soundOn = toggleSound(); $('sound').setAttribute('aria-pressed', String(soundOn)); $('sound').textContent = soundOn ? 'Sound' : 'Sound off'; if (soundOn) audio(); });
  $('putback').addEventListener('click', () => putBack());
  $('prev').addEventListener('click', () => step(-1));
  $('next').addEventListener('click', () => step(1));
  if (!matchMedia('(hover: none)').matches) $('hint').textContent = 'Click a card to read it. Drag across the felt to deal them your own way.';
  $('links').innerHTML = `<a href="mailto:${D.email}">Email</a><a href="${D.github}" target="_blank" rel="noopener">GitHub</a><a href="${D.x}" target="_blank" rel="noopener">X</a>`;
  document.querySelectorAll<HTMLButtonElement>('#index button').forEach((b) => {
    const c = cards[Number(b.dataset.i)]!;
    b.addEventListener('focus', () => { focused = c; });
    b.addEventListener('blur', () => { if (focused === c) focused = null; });
    b.addEventListener('click', () => { audio(); pickUp(c); });
  });
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && picked) { putBack(); e.preventDefault(); }
    else if (picked && e.key === 'ArrowRight') { step(1); e.preventDefault(); }
    else if (picked && e.key === 'ArrowLeft') { step(-1); e.preventDefault(); }
  });

  addEventListener('resize', () => {
    const m = innerWidth >= innerHeight ? 'land' : 'port';
    if (m !== mode) {
      mode = m; setPrint();
      if (!busy && !sweep && (!lastLayout || !lastLayout.user)) { const P = defaultPath(), h = (N - 1) * (P.gap || USER_GAP); layoutAlong(P, h, Infinity); lastLayout = { P, hand: h, user: false }; }
    }
    frame();
  });

  /* ---------------- frame loop ---------------- */
  const qT = new THREE.Quaternion(), qC = new THREE.Quaternion(), qFace = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
  const qTilt = new THREE.Quaternion(), eul = new THREE.Euler(), pT = new THREE.Vector3(), pC = new THREE.Vector3(), fwd = new THREE.Vector3();
  let last = performance.now(), invite = 0;
  function tick(now: number) {
    const dt = Math.min(1 / 30, (now - last) / 1000); last = now;

    if (sweep) {
      if (sweep.auto) {
        const u = Math.min(1, (now - sweep.auto.t0) / sweep.auto.dur);
        sweep.hand = sweep.auto!.to * (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);
      }
      const laid = layoutAlong(sweep.P, sweep.hand, now, sweep.flipOnLay);
      if (laid > sweep.laid) { for (let i = sweep.laid; i < laid; i++) sfx.lay((i - sweep.laid) * 0.012); sweep.laid = laid; }
      if (sweep.auto && now - sweep.auto.t0 >= sweep.auto.dur) finishSweep();
    }

    // a nudge from the joker until someone touches the deck
    if (!touched && !RM && !busy && !sweep && faceUp && now - invite > 3400) {
      invite = now; const j = order.find((c) => c.data.rank === 'joker'); if (j && !picked) j.v.slide += 5.5;
    }

    camera.getWorldDirection(fwd);
    pC.copy(camera.position).addScaledVector(fwd, holdDist).addScaledVector(tmpV.set(0, 1, 0).applyQuaternion(camera.quaternion), holdUp);
    qTilt.setFromEuler(eul.set(-ptr.y * 0.16, ptr.x * 0.22, 0));
    qC.copy(camera.quaternion).multiply(qTilt).multiply(qFace);

    for (const c of cards) {
      c.t.slide = (c === hovered ? 0.42 : 0) + (c === focused ? 0.7 : 0);
      if (drag && drag.c === c) {
        // card trails behind the fingertip and swings round its grab point
        const rx = drag.r.x, rz = drag.r.z, dy = c.p.yaw - drag.yaw0, cs = Math.cos(dy), sn = Math.sin(dy);
        const r = { x: rx * cs + rz * sn, z: -rx * sn + rz * cs }, rl = Math.hypot(r.x, r.z);
        if (rl > 0.2) drag.w += ((r.x * drag.vel.z - r.z * drag.vel.x) / rl) * 1.25 * dt;
        drag.w *= Math.exp(-5 * dt);
        c.p.yaw += drag.w * dt; c.t.yaw = c.p.yaw; c.v.yaw = 0;
        c.p.x = c.t.x = drag.at.x + r.x; c.p.z = c.t.z = drag.at.z + r.z; c.v.x = c.v.z = 0;
        drag.vel.x *= Math.exp(-6 * dt); drag.vel.z *= Math.exp(-6 * dt);
      }
      for (const k of springKeys) {
        if (RM) { c.p[k] = c.t[k]; c.v[k] = 0; continue; }
        const [K, Z] = SP[k], C = 2 * Math.sqrt(K) * Z;
        c.v[k] += (K * (c.t[k] - c.p[k]) - C * c.v[k]) * dt; c.p[k] += c.v[k] * dt;
      }
      const u = THREE.MathUtils.clamp(c.p.up, 0, 1.04);
      const sn = Math.sin(c.p.yaw), cs = Math.cos(c.p.yaw);
      pT.set(c.p.x + sn * c.p.slide, c.p.y0 + c.p.lift + (W / 2) * Math.abs(Math.sin(c.p.flip)), c.p.z + cs * c.p.slide);
      qT.setFromEuler(eul.set(0, c.p.yaw, c.p.flip, 'YZX'));
      if (u > 0.0005) {
        c.group.position.lerpVectors(pT, pC, Math.min(u, 1));
        c.group.position.y += Math.sin(Math.PI * Math.min(u, 1)) * 1.6;
        c.group.quaternion.slerpQuaternions(qT, qC, Math.min(u, 1));
      } else { c.group.position.copy(pT); c.group.quaternion.copy(qT); }
      bendGeo(c, c.p.bend + Math.sin(Math.PI * Math.min(u, 1)) * 0.2 + (drag && drag.c === c ? 0.05 : 0));
      c.face.castShadow = u < 0.35; // a card held up to your eye shouldn't throw a slab of shadow
      c.faceMat.emissiveIntensity = 0.05 + 0.82 * Math.min(u, 1) + (c === focused ? 0.12 : 0);
    }
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }

  /* ---------------- opening: deck squared, then dealt in one sweep, then turned ---------------- */
  document.body.classList.add('gl'); clearTimeout(glTimer);
  const P0 = defaultPath(), s0 = pathAt(P0, 0), d0 = pathDir(P0, 0.01)!;
  cards.forEach((c, k) => Object.assign(c.p, { x: s0.x, z: s0.z, yaw: Math.atan2(-d0.z, d0.x), y0: BASE + k * T }) && Object.assign(c.t, c.p));
  if (RM) {
    const h0 = (N - 1) * (P0.gap || USER_GAP);
    layoutAlong(P0, h0, Infinity); faceUp = true; cards.forEach((c) => (c.t.flip = 0));
    lastLayout = { P: P0, hand: h0, user: false };
  } else {
    setTimeout(() => deal(P0, { dur: 1150 }), 450);
    setTimeout(() => turnOver(), 1850);
  }
  requestAnimationFrame((t) => { last = t; tick(t); });
}
