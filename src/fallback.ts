import { DAKSH, type Card } from './data';

export function $(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element: ${id}`);
  return element;
}

export const isFill = (s: unknown): boolean => typeof s === 'string' && s.startsWith('[fill');
export const cardLabel = (c: Card): string => c.rank === 'joker' ? `The joker: ${DAKSH.name}` : c.rank === 'A' ? 'The ace of spades: how to reach Daksh' : `Jack of ${isFill(c.trade) ? 'a trade still to be written' : c.trade}`;

export function fail(glTimer: number): void {
  clearTimeout(glTimer);
  document.body.classList.add('nogl');
}

/* ---- plain-HTML parts: maker's address, keyboard index, the flat deck (also the no-WebGL fallback) ---- */
export function renderFallback(): number {
  const D = DAKSH;
  const esc = (s: string) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
  const para = (s: string | undefined) => s ? `<p${isFill(s) ? ' class="pencil"' : ''}>${esc(s)}</p>` : '';
  const pip = { spades: '♠︎', hearts: '♥︎', diamonds: '♦︎', clubs: '♣︎' };
  const gh = D.github.replace(/^https?:\/\//, ''), xx = D.x.replace(/^https?:\/\//, '');

  $('maker').innerHTML =
    `<div class="lead">Write to Daksh</div><div class="row"><a href="mailto:${esc(D.email)}">${esc(D.email)}</a><a href="${esc(D.github)}" target="_blank" rel="noopener">GitHub</a><a href="${esc(D.x)}" target="_blank" rel="noopener">X</a></div>`;

  $('index').innerHTML = D.cards.map((c, i) =>
    `<li><button type="button" data-i="${i}">${esc(cardLabel(c))}. Press Enter to pick it up</button></li>`).join('');

  $('flat').innerHTML = `<h2>${esc(D.name)}</h2><p>Jack of all trades. His deck, laid flat.</p><ol>` +
    D.cards.map((c) => {
      const red = c.suit === 'hearts' || c.suit === 'diamonds' || c.rank === 'joker';
      const ix = c.rank === 'joker' ? 'Joker' : `${c.rank} ${pip[c.suit]}`;
      if (c.rank === 'A') return `<li><div class="ix">${ix}</div><h3><small>The maker’s card</small>Write to Daksh</h3>
        <p><a href="mailto:${esc(D.email)}">${esc(D.email)}</a></p><p><a href="${esc(D.github)}">${esc(gh)}</a></p><p><a href="${esc(D.x)}">${esc(xx)}</a></p></li>`;
      const kicker = c.rank === 'joker' ? 'The wildcard' : 'Jack of';
      const title = c.rank === 'joker' ? c.title : isFill(c.trade) ? c.trade : c.trade.charAt(0).toUpperCase() + c.trade.slice(1);
      return `<li><div class="ix${red ? ' red' : ''}">${ix}</div><h3><small>${kicker}</small>${isFill(title) ? `<span class="pencil">${esc(title)}</span>` : esc(title)}</h3>${para(c.body)}${para(c.note)}${c.links?.length ? `<p class="links">${c.links.map((l) => `<a href="${esc(l.href)}" target="_blank" rel="noopener">${esc(l.label)}</a>`).join(', ')}</p>` : ''}</li>`;
    }).join('') + '</ol>';

  // If the scene never starts (offline assets or a blocked script), show the flat deck
  return window.setTimeout(() => { if (!document.body.classList.contains('gl')) document.body.classList.add('nogl'); }, 9000);
}
