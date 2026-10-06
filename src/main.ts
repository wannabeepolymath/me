import './styles.css';
import { DAKSH, type Flower } from './data';
import type { Item, World } from './meadow';

const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const COARSE = matchMedia('(pointer: coarse)').matches;
const $ = <T extends HTMLElement = HTMLElement>(s: string): T => {
  const el = document.querySelector<T>(s);
  if (!el) throw new Error(`Missing ${s}`);
  return el;
};
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);
const isFill = (s: string) => /^\s*\[fill/i.test(s);
// [text](https://…) inside a line becomes a link; everything else is escaped
const rich = (s: string) => esc(s).replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
const blooms = (f: Flower) => f.lines.some((l) => !isFill(l)) || (f.list?.length ?? 0) > 0;
const ON_A: Record<string, string> = { daisy: 'a daisy', sunflower: 'a sunflower', cosmos: 'a cosmos', poppy: 'a poppy', allium: 'an allium' };
const bare = (url: string) => url.replace(/^https?:\/\//, '');

/* ---------- packet ---------- */
$('#p-name').textContent = DAKSH.name;
$('#p-intro').textContent = DAKSH.intro;
$<HTMLAnchorElement>('#l-mail').href = 'mailto:' + DAKSH.email;
$<HTMLAnchorElement>('#l-gh').href = DAKSH.github;
$<HTMLAnchorElement>('#l-x').href = DAKSH.x;
const you = $('#you');
if (COARSE) you.textContent = 'This is you. Tap a flower to land.';

/* ---------- items: flowers + the hive ---------- */
const items: Item[] = DAKSH.flowers.map((f) => ({ ...f, kind: blooms(f) ? f.species : 'bud' }));
const NF = items.length;
items.push({ title: 'Say hello', kind: 'hive', color: '#E2A83F', lines: [] });
const HIVE = NF;

const tagsEl = $('#tags');
const tags = items.map((it, i) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'tag' + (it.kind === 'bud' ? ' bud' : '');
  b.style.setProperty('--c', it.color);
  b.innerHTML = `<span>${esc(it.title)}</span>` + (it.kind === 'bud' ? '<small>still a bud</small>' : '');
  b.addEventListener('click', () => land(i));
  tagsEl.append(b);
  return b;
});

/* ---------- pollen ---------- */
let world: World | null = null;
const seen = new Set<number>();
const cells = $('.cells');
for (let i = 0; i < NF; i++) cells.append(document.createElement('i'));
const pollenText = $('#pollen-text');
function markVisited(i: number) {
  if (i >= NF || seen.has(i)) return;
  seen.add(i);
  tags[i]?.classList.add('seen');
  cells.children[seen.size - 1]?.classList.add('on');
  if (seen.size === NF) {
    pollenText.textContent = 'Every flower visited. ';
    const go = document.createElement('button');
    go.type = 'button';
    go.textContent = 'Fly to the hive';
    go.addEventListener('click', () => land(HIVE));
    pollenText.append(go);
  } else {
    pollenText.textContent = `Pollen from ${seen.size} of ${NF} flowers`;
  }
  world?.setPollen(seen.size / NF);
}

/* ---------- the note ---------- */
const note = $('#note');
const noteTitle = $('#note-title');
const nextBtn = $('#next');
let current = -1;
function fillNote(i: number) {
  const it = items[i];
  if (!it) return;
  note.style.setProperty('--c', it.color);
  noteTitle.textContent = it.title;
  let html = '';
  if (it.kind === 'hive') {
    $('#note-landed').textContent = 'Landed at the hive.';
    html = `<p>Email is the quickest way to reach me. I also post on X and keep my code on GitHub.</p>
      <ul><li><a href="mailto:${esc(DAKSH.email)}">${esc(DAKSH.email)}</a></li>
      <li><a href="${esc(DAKSH.github)}" target="_blank" rel="noopener">${esc(bare(DAKSH.github))}</a></li>
      <li><a href="${esc(DAKSH.x)}" target="_blank" rel="noopener">${esc(bare(DAKSH.x))}</a></li></ul>`;
  } else {
    $('#note-landed').textContent = it.kind === 'bud'
      ? 'Landed on a bud. This one hasn’t bloomed yet.'
      : `Landed on ${ON_A[it.kind] ?? 'a flower'}.`;
    html = it.lines.map((l) => `<p${isFill(l) ? ' class="fill"' : ''}>${rich(l)}</p>`).join('');
    if (it.list) html += '<ul>' + it.list.map((l) => `<li>${esc(l)}</li>`).join('') + '</ul>';
    if (it.links) html += '<p class="go">' + it.links.map((l) => `<a href="${esc(l.href)}" target="_blank" rel="noopener">${esc(l.label)}</a>`).join('') + '</p>';
  }
  $('#note-body').innerHTML = html;
  nextBtn.textContent = i === HIVE ? 'Back to the flowers' : 'Next flower';
}
function land(i: number) {
  current = i;
  fillNote(i);
  note.hidden = false;
  note.scrollTop = 0;
  document.body.classList.add('is-landed');
  tagsEl.classList.add('away');
  you.classList.add('gone');
  noteTitle.focus({ preventScroll: true });
  if (world) world.land(i);
  else markVisited(i);
}
function takeOff() {
  if (current < 0) return;
  const was = current;
  current = -1;
  note.hidden = true;
  document.body.classList.remove('is-landed');
  tagsEl.classList.remove('away');
  world?.takeOff();
  tags[was]?.focus({ preventScroll: true });
}
$('#close').addEventListener('click', takeOff);
nextBtn.addEventListener('click', () => land(current === HIVE ? 0 : (current + 1) % NF));
addEventListener('keydown', (e) => { if (e.key === 'Escape') takeOff(); });

/* ---------- the meadow: if it fails, the page is a seed packet plus a list of tags ---------- */
import('./meadow')
  .then(({ makeWorld }) => makeWorld({
    canvas: $<HTMLCanvasElement>('#meadow'), packet: $('.packet'), note, you, tags, items, nf: NF,
    reducedMotion: RM, coarse: COARSE, current: () => current, land, takeOff, markVisited,
  }))
  .then((w) => {
    world = w;
    if (seen.size) w.setPollen(seen.size / NF);
    document.body.classList.add('gl');
  })
  .catch((err: unknown) => {
    console.warn('Meadow unavailable, showing the list instead.', err);
    document.body.classList.add('no-gl');
  });
