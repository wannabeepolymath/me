export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';

interface CardContent {
  trade: string;
  body?: string;
  note?: string;
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
      body: 'Lives in Bangalore. Online he goes by wannabeepolymath. Every other card here is a trade he has picked up.',
      note: '[fill: one line about you, in your own words]' },
    { rank: 'J', suit: 'diamonds', trade: 'Bangalore',
      body: 'Where he lives.',
      note: '[fill: the corner of the city you would send a friend to]' },
    { rank: 'J', suit: 'clubs', trade: 'studies',
      body: 'Computer science at BITS Pilani. A bachelor’s and a master’s, through 2027.' },
    { rank: 'J', suit: 'spades', trade: 'systems',
      body: 'A WebSocket multiplexer in Rust. A Redis clone in Go. Backends for AI agents at Emergent.' },
    { rank: 'J', suit: 'spades', trade: 'small apps',
      body: 'Parla, voice dictation for the Mac. Burmese, a pet that lives on your desktop. A Solana game inside Telegram.' },
    { rank: 'J', suit: 'hearts', trade: '[fill: a trade]',
      body: '[fill: something you make that is not code]' },
    { rank: 'J', suit: 'clubs', trade: '[fill: a trade]',
      body: '[fill: what you are reading, and why]' },
    { rank: 'J', suit: 'hearts', trade: '[fill: a trade]',
      body: '[fill: the music on repeat right now]' },
    { rank: 'J', suit: 'diamonds', trade: '[fill: a trade]',
      body: '[fill: a place you would go back to]' },
    { rank: 'J', suit: 'clubs', trade: '[fill: a trade]',
      body: '[fill: what you are learning now, and how it is going]' },
    { rank: 'A', suit: 'spades', trade: 'the maker' }
  ]
};

