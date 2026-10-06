export type Species = 'daisy' | 'sunflower' | 'cosmos' | 'poppy' | 'allium';

export interface Link {
  label: string;
  href: string;
}

export interface Flower {
  title: string;
  species: Species;
  color: string;
  lines: string[];
  list?: string[];
  links?: Link[];
}

export interface DakshContent {
  name: string;
  intro: string;
  email: string;
  github: string;
  x: string;
  flowers: Flower[];
}

/* =====================================================================
   EDIT ME. Everything the site says lives here.
   A flower blooms as soon as at least one of its lines is filled in.
   If every line still starts with "[fill", it stays a closed bud.
   species: daisy | sunflower | cosmos | poppy | allium
   Write [text](https://…) inside a line to make that text a link.
   ===================================================================== */
export const DAKSH: DakshContent = {
  name: 'Daksh Jain',
  intro: 'Based in Bangalore. Studying computer science at BITS Pilani until 2027. I build software, and keep wandering into other fields.',
  email: 'dakshjainn2004@gmail.com',
  github: 'https://github.com/wannabeepolymath',
  x: 'https://x.com/dakshhjainn',
  flowers: [
    { title: 'Why a bee?', species: 'daisy', color: '#FFFFFF', lines: [
      '[My handle is wannabeepolymath.](https://github.com/wannabeepolymath) Read it twice: wanna-bee polymath.',
      'A bee never settles on one flower. It drifts from bloom to bloom, collects a little nectar from each, and carries it all home to make something no single flower could.',
      'That’s how I learn. A bit of systems here, a bit of markets there, whatever catches my eye next. I collect the nectar of knowledge wherever it grows, and hope it turns into honey.',
    ] },
    { title: 'Burmese', species: 'cosmos', color: '#FF6FA8', lines: [
      'A desktop cat for the Mac that I founded and build. It reacts to your coding agents and keeps your reminders.',
    ], links: [{ label: 'theburmese.xyz', href: 'https://www.theburmese.xyz/' }] },
    { title: 'AI agents', species: 'sunflower', color: '#FFC21A', lines: [
      'I was a backend engineer at Emergent in 2025, working on the workflows that run AI agents.',
    ], list: [
      'Circuit breakers so one failing tool can’t take an agent down',
      '58% less pod memory on Kubernetes',
    ], links: [{ label: 'Emergent', href: 'https://emergent.sh/' }] },
    { title: 'Chains', species: 'cosmos', color: '#FF8A1F', lines: [
      'I wrote a Solana staking contract in Rust, and a Telegram survival game that pays its winners in SOL.',
    ], links: [
      { label: 'Staking', href: 'https://github.com/wannabeepolymath/Solana-Staking-Contract' },
      { label: 'Survival pot', href: 'https://github.com/wannabeepolymath/Sol-survival-jackpot' },
    ] },
    { title: 'BITS Pilani', species: 'poppy', color: '#FF4B2B', lines: [
      'I’m studying computer science there: a bachelor’s and a master’s, finishing in 2027.',
    ] },
    { title: 'Mac apps', species: 'daisy', color: '#FFB3D1', lines: [
      'Small tools for the machine I live on.',
    ], list: [
      'Parla, on-device dictation with Whisper on Metal',
      'Branch Visualizer, git in the menu bar, on Homebrew',
    ], links: [
      { label: 'Parla', href: 'https://github.com/wannabeepolymath/parla' },
      { label: 'Branch Visualizer', href: 'https://github.com/wannabeepolymath/git-branch-Visualizer' },
    ] },
    { title: 'Markets', species: 'poppy', color: '#7A3CE0', lines: [
      'I built cexy, a matching engine and orderbook in Rust, with benchmarks. And an orderbook in C++.',
    ], links: [
      { label: 'cexy', href: 'https://github.com/wannabeepolymath/cexy' },
      { label: 'Orderbook', href: 'https://github.com/wannabeepolymath/Orderbook-CPP' },
    ] },
    { title: 'Systems', species: 'allium', color: '#9152F2', lines: [
      'I mostly build the parts of software nobody sees: servers, sockets, caches and queues.',
    ], list: [
      'mux, Rust WebSockets that keep audio flowing with 36% of backends down',
      'A Redis clone in Go that holds 20K connections',
      'MiniDB, a database from scratch: B+ trees, a write-ahead log and two-phase locking',
    ], links: [
      { label: 'mux', href: 'https://github.com/wannabeepolymath/mux' },
      { label: 'Redis clone', href: 'https://github.com/wannabeepolymath/redis' },
      { label: 'MiniDB', href: 'https://github.com/wannabeepolymath/miniDB' },
    ] },
    { title: 'Android', species: 'sunflower', color: '#FF9F1C', lines: [
      'I built a native GPS simulator with a Node and Postgres backend, and a Kotlin tool that edits file metadata.',
    ], links: [
      { label: 'GPS simulator', href: 'https://github.com/wannabeepolymath/gps-simulation' },
      { label: 'Metadata tool', href: 'https://github.com/wannabeepolymath/forensics' },
    ] },
  ],
};
