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
  latin: string;
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
   ===================================================================== */
export const DAKSH: DakshContent = {
  name: 'Daksh Jain',
  latin: 'Polymathus wannabee',
  intro: 'Grows in Bangalore. Studying computer science at BITS Pilani until 2027. Builds software, and keeps wandering into other fields.',
  email: 'dakshjainn2004@gmail.com',
  github: 'https://github.com/wannabeepolymath',
  x: 'https://x.com/dakshhjainn',
  flowers: [
    { title: 'Why a bee?', species: 'daisy', color: '#FFFFFF', lines: [
      'His handle is wannabeepolymath. Read it twice: wanna-bee polymath.',
      'A bee visits hundreds of flowers a day and makes one thing out of all of them. That is roughly the plan.',
    ] },
    { title: 'Burmese', species: 'cosmos', color: '#FF6FA8', lines: [
      'A desktop cat for the Mac that he founded and builds. It reacts to your coding agents and keeps your reminders.',
    ], links: [
      { label: 'theburmese.xyz', href: 'https://www.theburmese.xyz/' },
      { label: 'Download', href: 'https://github.com/wannabeepolymath/burmese-download' },
    ] },
    { title: 'AI agents', species: 'sunflower', color: '#FFC21A', lines: [
      'Backend engineer at Emergent in 2025, on the workflows that run AI agents.',
    ], list: [
      'Circuit breakers so one failing tool can’t take an agent down',
      '58% less pod memory on Kubernetes',
    ], links: [{ label: 'Emergent', href: 'https://emergent.sh/' }] },
    { title: 'Chains', species: 'cosmos', color: '#FF8A1F', lines: [
      'A Solana staking contract in Rust, and a Telegram survival game that pays its winners in SOL.',
    ], links: [
      { label: 'Staking', href: 'https://github.com/wannabeepolymath/Solana-Staking-Contract' },
      { label: 'Survival pot', href: 'https://github.com/wannabeepolymath/Sol-survival-jackpot' },
    ] },
    { title: 'BITS Pilani', species: 'poppy', color: '#FF4B2B', lines: [
      'Studying computer science there: a bachelor’s and a master’s, finishing in 2027.',
      'Built MiniDB along the way: B+ trees, a write-ahead log and two-phase locking.',
    ], links: [{ label: 'MiniDB', href: 'https://github.com/wannabeepolymath/miniDB' }] },
    { title: 'Mac apps', species: 'daisy', color: '#FFB3D1', lines: [
      'Small tools for the machine he lives on.',
    ], list: [
      'Parla, on-device dictation with Whisper on Metal',
      'Branch Visualizer, git in the menu bar, on Homebrew',
    ], links: [
      { label: 'Parla', href: 'https://github.com/wannabeepolymath/parla' },
      { label: 'Branch Visualizer', href: 'https://github.com/wannabeepolymath/git-branch-Visualizer' },
    ] },
    { title: 'Markets', species: 'poppy', color: '#7A3CE0', lines: [
      'cexy, a matching engine and orderbook in Rust, with benchmarks. And an orderbook in C++.',
    ], links: [
      { label: 'cexy', href: 'https://github.com/wannabeepolymath/cexy' },
      { label: 'Orderbook', href: 'https://github.com/wannabeepolymath/Orderbook-CPP' },
    ] },
    { title: 'Systems', species: 'allium', color: '#9152F2', lines: [
      'Mostly the parts of software nobody sees: servers, sockets, caches and queues.',
    ], list: [
      'mux, Rust WebSockets that keep audio flowing with 36% of backends down',
      'A Redis clone in Go that holds 20K connections',
    ], links: [
      { label: 'mux', href: 'https://github.com/wannabeepolymath/mux' },
      { label: 'Redis clone', href: 'https://github.com/wannabeepolymath/redis' },
    ] },
    { title: 'Android', species: 'sunflower', color: '#FF9F1C', lines: [
      'A native GPS simulator with a Node and Postgres backend, and a Kotlin tool that edits file metadata.',
    ], links: [
      { label: 'GPS simulator', href: 'https://github.com/wannabeepolymath/gps-simulation' },
      { label: 'Metadata tool', href: 'https://github.com/wannabeepolymath/forensics' },
    ] },
  ],
};
