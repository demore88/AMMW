// Army Men: Microplastic Warfare — game data: armies, pieces (classes), weapons, cosmetics, names.
export const TEAMS = [
  { id: 'green', name: 'Green Army', color: 0x3f7d2a, css: '#3f7d2a' },
  { id: 'tan', name: 'Tan Army', color: 0xc9a96b, css: '#b8975a' },
  { id: 'blue', name: 'Blue Army', color: 0x3561b5, css: '#3561b5' },
  { id: 'grey', name: 'Grey Army', color: 0x858b92, css: '#7a8087' },
];

// Each piece is a classic bag-of-army-men pose with its own weapon.
export const CLASSES = {
  rifle:   { name: 'Rifleman',  blurb: 'Steady all-rounder', hp: 100, speed: 4.0, weapon: 'rifle' },
  bazooka: { name: 'Bazooka',   blurb: 'Blasts groups apart', hp: 100, speed: 3.5, weapon: 'bazooka' },
  sniper:  { name: 'Sniper',    blurb: 'Long shots, scope',   hp: 100, speed: 3.8, weapon: 'sniper' },
  flamer:  { name: 'Flamer',    blurb: 'Melts plastic up close', hp: 100, speed: 4.4, weapon: 'flamer' },
};
export const CLASS_IDS = Object.keys(CLASSES);

export const WEAPONS = {
  rifle:   { recoil: 0.012, wob: 0.006, dmg: 34, rate: 0.16, mag: 24, reload: 1.5, spread: 0.014, range: 70, kind: 'hit' },
  bazooka: { recoil: 0.06, wob: 0.01, dmg: 95, rate: 1.2,  mag: 1,  reload: 1.7, spread: 0.004, range: 80, kind: 'rocket', speed: 34, radius: 3.4 },
  sniper:  { recoil: 0.07, wob: 0.012, dmg: 55, rate: 1.05, mag: 5,  reload: 2.0, spread: 0.035, scoped: 0.0015, range: 140, kind: 'hit' },
  flamer:  { recoil: 0.0, wob: 0.0, dmg: 85, rate: 0.05, mag: 100, reload: 2.2, spread: 0.0, range: 7.5, kind: 'flame', use: 30 },
};
export const NADE = { dmg: 90, radius: 3.6, fuse: 2.0, per: 2 };

export const MAPS = {
  living:   { name: 'Living Room', blurb: 'Rug, couch and coffee-table legs' },
  kitchen:  { name: 'Kitchen',     blurb: 'Tile floor, chair-leg forest' },
  backyard: { name: 'Backyard',    blurb: 'Grass, sandbox and flower pots' },
};

export const MODES = {
  battle: { name: 'Team Battle', blurb: '2 armies, 5 a side', teams: 2, per: 5, goal: 25 },
  brawl:  { name: '4-Army Brawl', blurb: 'Every colour, 3 each', teams: 4, per: 3, goal: 15 },
  skirm:  { name: 'Skirmish', blurb: '2 armies, 3 a side', teams: 2, per: 3, goal: 15 },
};

// Cosmetics bought with allowance earned in matches.
export const COSMETICS = {
  head: [
    { id: 'helmet', name: 'Steel Pot', price: 0 },
    { id: 'cap', name: 'Patrol Cap', price: 120 },
    { id: 'beret', name: 'Beret', price: 150 },
    { id: 'bandana', name: 'Bandana', price: 180 },
    { id: 'bare', name: 'Bare Head', price: 90 },
    { id: 'tanker', name: 'Goggle Helmet', price: 300 },
    { id: 'boonie', name: 'Boonie Hat', price: 220 },
  ],
  finish: [
    { id: 'standard', name: 'Out of the Bag', price: 0 },
    { id: 'glossy', name: 'Extra Glossy', price: 120 },
    { id: 'faded', name: 'Sun Faded', price: 120 },
    { id: 'marbled', name: 'Marbled Swirl', price: 350 },
    { id: 'glow', name: 'Glow in the Dark', price: 450 },
    { id: 'chrome', name: 'Chrome Paint', price: 650 },
    { id: 'gold', name: 'Gold Paint', price: 900 },
  ],
  base: [
    { id: 'square', name: 'Square Base', price: 0 },
    { id: 'round', name: 'Round Base', price: 80 },
    { id: 'oval', name: 'Oval Base', price: 80 },
    { id: 'hex', name: 'Hex Base', price: 150 },
    { id: 'star', name: 'Star Base', price: 280 },
  ],
  gear: [
    { id: 'none', name: 'No Gear', price: 0 },
    { id: 'canteen', name: 'Canteen', price: 80 },
    { id: 'pack', name: 'Backpack', price: 120 },
    { id: 'belt', name: 'Ammo Belt', price: 150 },
    { id: 'radio', name: 'Radio Pack', price: 220 },
    { id: 'roll', name: 'Bedroll', price: 160 },
  ],
};
export const COS_SLOTS = [['head', 'Headgear'], ['finish', 'Plastic'], ['gear', 'Gear']];

const RANKS = ['Pvt.', 'Pfc.', 'Cpl.', 'Sgt.', 'Lt.', 'Cpt.', 'Maj.'];
const NAMES = ['Pickle', 'Crayon', 'Biscuit', 'Gravel', 'Noodle', 'Tater', 'Sprocket', 'Muffin', 'Rascal', 'Dusty', 'Buttons', 'Waffles',
  'Sneakers', 'Marbles', 'Puddle', 'Thimble', 'Gumdrop', 'Rocket', 'Crumbs', 'Domino', 'Socks', 'Bolt', 'Pebble', 'Ranger', 'Taco',
  'Scooter', 'Peanut', 'Jinx', 'Clicker', 'Moose', 'Stomp', 'Ziggy', 'Brick', 'Sarsaparilla', 'Hopper', 'Lint', 'Dingo', 'Pretzel'];
export function botName(used) {
  for (let i = 0; i < 40; i++) {
    const n = RANKS[(Math.random() * RANKS.length) | 0] + ' ' + NAMES[(Math.random() * NAMES.length) | 0];
    if (!used.has(n)) { used.add(n); return n; }
  }
  return 'Pvt. Number ' + used.size;
}
export function randomCos() {
  const pick = (a) => a[(Math.random() * a.length) | 0].id;
  return { skin: ['#f2c9a8', '#e3b08a', '#c98f63', '#a46b44', '#7a4a2c', '#5a3520'][(Math.random() * 6) | 0], head: Math.random() < 0.55 ? 'helmet' : pick(COSMETICS.head), finish: Math.random() < 0.75 ? 'standard' : pick(COSMETICS.finish.slice(0, 4)), base: pick(COSMETICS.base.slice(0, 4)), gear: pick(COSMETICS.gear) };
}
