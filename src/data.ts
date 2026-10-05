export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';

export interface CardLink {
  label: string;
  href: string;
}

interface CardContent {
  trade: string;
  body?: string;
  note?: string;
  links?: CardLink[]; // shown as buttons under the card while it is held
}

export interface JokerCard extends CardContent {
  rank: 'joker';
  title: string;
  suit?: never;
}

export interface JackCard extends CardContent {
  rank: 'J';
  suit: Suit;
  body: string;
}

export interface AceCard extends CardContent {
  rank: 'A';
  suit: 'spades';
}

export type Card = JokerCard | JackCard | AceCard;

export interface DakshContent {
  name: string;
  email: string;
  github: string;
  x: string;
  cards: Card[];
}

/* ============================================================
   EDIT ME. Everything Daksh might change lives in this object.
   Any text that starts with "[fill" is drawn in pencil, like the
   blank cards a new deck comes with. Replace it and it prints.
   Cards are dealt in this order. suit: spades | hearts | diamonds | clubs
   ============================================================ */
export const DAKSH: DakshContent = {
  name: 'Daksh Jain',
  email: 'dakshjainn2004@gmail.com',
  github: 'https://github.com/wannabeepolymath',
  x: 'https://x.com/dakshhjainn',
  cards: [
    { rank: 'joker', trade: 'wildcard', title: 'Daksh Jain',
      body: 'Bangalore. Computer science at BITS Pilani. Builds Burmese on the side. Every other card is a trade.',
      note: 'GitHub bio: &mut self' },
    { rank: 'J', suit: 'hearts', trade: 'founding',
      body: 'Burmese, a desktop cat for the Mac that reacts to coding agents and keeps reminders. theburmese.xyz',
      links: [{ label: 'Burmese', href: 'https://www.theburmese.xyz/' }, { label: 'Download', href: 'https://github.com/wannabeepolymath/burmese-download' }] },
    { rank: 'J', suit: 'spades', trade: 'agents',
      body: 'Backend at Emergent in 2025: AI-agent workflows, circuit breakers, 58% less pod memory on Kubernetes.',
      links: [{ label: 'Emergent', href: 'https://emergent.sh/' }] },
    { rank: 'J', suit: 'spades', trade: 'systems',
      body: 'mux, Rust WebSockets that keep audio flowing with 36% of backends down. A Redis clone in Go: 20K connections.',
      links: [{ label: 'mux', href: 'https://github.com/wannabeepolymath/mux' }, { label: 'Redis clone', href: 'https://github.com/wannabeepolymath/redis' }] },
    { rank: 'J', suit: 'clubs', trade: 'studies',
      body: 'A bachelor’s and a master’s at BITS Pilani, through 2027. Built MiniDB there: B+ trees, WAL, 2PL.',
      links: [{ label: 'MiniDB', href: 'https://github.com/wannabeepolymath/miniDB' }] },
    { rank: 'J', suit: 'hearts', trade: 'Mac apps',
      body: 'Parla, on-device dictation with Whisper on Metal. Branch Visualizer, git in the menu bar, on Homebrew.',
      links: [{ label: 'Parla', href: 'https://github.com/wannabeepolymath/parla' }, { label: 'Branch Visualizer', href: 'https://github.com/wannabeepolymath/git-branch-Visualizer' }] },
    { rank: 'J', suit: 'diamonds', trade: 'markets',
      body: 'cexy, a matching engine and orderbook in Rust, with benchmarks. An orderbook in C++.',
      links: [{ label: 'cexy', href: 'https://github.com/wannabeepolymath/cexy' }, { label: 'Orderbook', href: 'https://github.com/wannabeepolymath/Orderbook-CPP' }] },
    { rank: 'J', suit: 'diamonds', trade: 'chains',
      body: 'A Solana staking contract in Rust, and a Telegram survival game that pays its winners in SOL.',
      links: [{ label: 'Staking', href: 'https://github.com/wannabeepolymath/Solana-Staking-Contract' }, { label: 'Survival pot', href: 'https://github.com/wannabeepolymath/Sol-survival-jackpot' }] },
    { rank: 'J', suit: 'diamonds', trade: 'Android',
      body: 'A native GPS simulator with a Node and Postgres backend, and a Kotlin tool that edits file metadata.',
      links: [{ label: 'GPS simulator', href: 'https://github.com/wannabeepolymath/gps-simulation' }, { label: 'Metadata tool', href: 'https://github.com/wannabeepolymath/forensics' }] },
    { rank: 'A', suit: 'spades', trade: 'the maker' }
  ]
};

