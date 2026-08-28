const vm = require('vm');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'antar-sheet.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];

function makeEl() {
  const o = { innerHTML: '', children: [], style: {}, onclick: null, oninput: null, onchange: null, checked: false };
  o.appendChild = function (child) { this.children.push(child); return child; };
  o.remove = function () {};
  o.setAttribute = function () {};
  o.addEventListener = function () {};
  o.click = function () {};
  o.getAttribute = function () { return null; };
  o.closest = function () { return null; };
  o.value = '';
  o.files = [];
  return o;
}

const appEl = makeEl();
const templateEl = { _html: '' };
Object.defineProperty(templateEl, 'innerHTML', {
  get() { return this._html; },
  set(v) {
    this._html = v;
    this.content = { firstElementChild: Object.assign(makeEl(), { innerHTML: v }) };
  },
});

const documentStub = {
  getElementById(id) { return id === 'app' ? appEl : null; },
  createElement(tag) { return tag === 'template' ? templateEl : makeEl(); },
  createTextNode(t) { return { text: t }; },
  body: makeEl(),
};

const storage = {};
const consoleLog = [];
const sent = [];
const sandbox = {
  document: documentStub,
  window: {},
  localStorage: {
    getItem: (k) => (k in storage ? storage[k] : null),
    setItem: (k, v) => { storage[k] = String(v); },
    removeItem: (k) => { delete storage[k]; },
  },
  confirm: () => true,
  Blob: function () {},
  URL: { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} },
  FileReader: function () { this.readAsText = () => {}; },
  setTimeout: (fn) => 0,
  console: { log: () => {}, error: (...a) => { consoleLog.push(a.join(' ')); } },
  Math: Object.create(Math),
  Date, JSON, Object, Array, String, Number,
  fetch: (url, opts) => { sent.push({ url, body: JSON.parse(opts.body) }); return Promise.resolve({ ok: true }); },
};
sandbox.globalThis = sandbox;

vm.createContext(sandbox);
vm.runInContext(script, sandbox, { filename: 'antar-sheet.html' });

const APP = sandbox.window.APP;
if (!APP) throw new Error('APP not defined');

let checks = 0;
let fails = 0;
function ok(cond, name) {
  checks++;
  if (!cond) { fails++; console.log('FAIL: ' + name); }
}

function flat(o) {
  return (o ? (o.innerHTML || '') + (o.children || []).map(flat).join('') : '');
}
function markup() {
  return appEl.children.map(flat).join('');
}
function click(action, id, extra) {
  const node = Object.assign(makeEl(), extra || {});
  node.getAttribute = function (n) { return n === 'data-action' ? action : n === 'data-id' ? id : n === 'data-index' ? (extra && extra._index) || '' : null; };
  node.closest = function () { return node; };
  if (extra && extra._closest) node.closest = extra._closest;
  appEl.onclick({ target: node });
  return node;
}
function input(action, id, value) {
  const t = { getAttribute: (n) => (n === 'data-action' ? action : n === 'data-id' ? id : null), value };
  appEl.oninput({ target: t });
}
function change(action, id, value) {
  const t = { getAttribute: (n) => (n === 'data-action' ? action : n === 'data-id' ? id : null), value, checked: value };
  appEl.onchange({ target: t });
}
function freshRender() {
  appEl.children.length = 0;
  APP.render();
}

sandbox.Math.random = () => 0.5;

const char = {
  version: 1, id: 't25-seed', name: 'Варвар',
  raceId: 'dwarf', statusId: null, traitId: null, traitRolled: false,
  level: 1,
  attrs: { сила: 12, ловкость: 10, живучесть: 12, воля: 10, восприятие: 10, харизма: 10, мудрость: 10, интеллект: 10 },
  hp: { current: 10, max: 10 }, stamina: { current: 5, max: 5 }, mana: { current: 2, max: 2 },
  trained: { skills: {}, lores: {}, crafts: {} },
  specializations: [], abilities: [], customAbilities: [],
  weapons: [{ name: 'Меч', kind: 's', atkBonus: 0, damage: '1d6', props: '', reach: '', speed: 1 }],
  armor: null, shield: null, inventory: [],
  conditions: [], injuries: { head: false, arms: false, torso: false, legs: false },
  exhaustion: 0, deathSaves: { success: 0, fail: 0 }, inspiration: 1,
  spentOS: 0, osBonuses: { stamina: 0, mana: 0, hp: 0 },
  masteryBonus: 0,
  notes: '', createdAt: 0, updatedAt: 0, humanBonusChoice: null,
};

// ---------------------------------------------------------------------------
// Task 1: config storage helpers
// ---------------------------------------------------------------------------
ok(typeof APP.discordGetConfig === 'function', 'discordGetConfig exposed');
ok(typeof APP.discordSetConfig === 'function', 'discordSetConfig exposed');
ok(typeof APP.discordEmbed === 'function', 'discordEmbed exposed');
ok(typeof APP.discordSend === 'function', 'discordSend exposed');

// default config: no url, disabled
let cfg = APP.discordGetConfig();
ok(cfg.url === '' && cfg.enabled === false, 'default config empty + disabled');

// set then read back
APP.discordSetConfig('https://discord.com/api/webhooks/1/abc', true);
cfg = APP.discordGetConfig();
ok(cfg.url === 'https://discord.com/api/webhooks/1/abc', 'config url persisted via helper');
ok(cfg.enabled === true, 'config enabled persisted via helper');
ok(storage['antar.webhook'] === 'https://discord.com/api/webhooks/1/abc', 'webhook stored under antar.webhook');
ok(storage['antar.discordEnabled'] === '1', 'enabled stored as string 1');

// set disabled
APP.discordSetConfig('', false);
cfg = APP.discordGetConfig();
ok(cfg.url === '' && cfg.enabled === false, 'clearing config writes empty + 0');
ok(storage['antar.discordEnabled'] === '0', 'disabled stored as string 0');

// ---------------------------------------------------------------------------
// Task 2: embed building
// ---------------------------------------------------------------------------
const eCrit = APP.discordEmbed({ kind: 'test', label: 'X', expr: '20 + 4', total: 24, t: 1700000000000 }, 'Варвар');
const critEmb = eCrit.embeds[0];
ok(critEmb.title === 'X', 'embed title = label');
ok(critEmb.description === '20 + 4 = **24**', 'embed description pattern');
ok(critEmb.color === 0x2ecc71, 'crit color green');
ok(critEmb.timestamp === new Date(1700000000000).toISOString(), 'embed timestamp ISO');
ok(critEmb.author && critEmb.author.name === 'Варвар', 'embed author = char name');

const eFumb = APP.discordEmbed({ kind: 'test', label: 'Y', expr: '1 + 0', total: 1, t: 1700000000000 }, 'Варвар');
ok(eFumb.embeds[0].color === 0xe74c3c, 'fumble color red (raw die 1)');

const eNeut = APP.discordEmbed({ kind: 'test', label: 'Z', expr: '12 + 4', total: 16, t: 1700000000000 }, '');
ok(eNeut.embeds[0].color === 0x9b59b6, 'mid test stays neutral purple');
ok(eNeut.embeds[0].author.name === 'Антар', 'default author name when no char name');

ok(APP.discordEmbed({ kind: 'damage', expr: '2+3', total: 5, t: 1 }, '').embeds[0].color === 0xf1c40f, 'damage color yellow');
ok(APP.discordEmbed({ kind: 'init', expr: '20', total: 20, t: 1 }, '').embeds[0].color === 0x3498db, 'init color blue');
ok(APP.discordEmbed({ kind: 'pool', expr: '2', total: 2, t: 1 }, '').embeds[0].color === 0x1abc9c, 'pool color teal');
ok(APP.discordEmbed({ kind: 'dice', expr: '3', total: 3, t: 1 }, '').embeds[0].color === 0x95a5a6, 'plain dice color grey');
ok(APP.discordEmbed({ kind: 'reroll', expr: '5', total: 5, t: 1 }, '').embeds[0].color === 0xe67e22, 'reroll color orange');

// ---------------------------------------------------------------------------
// Task 3: sending + kind wiring
// ---------------------------------------------------------------------------
APP.state.chars.push(char);
APP.state.currentId = char.id;
// default config disabled => nothing sent so far
APP.goto('sheet');
click('dice', 'd6');
ok(sent.length === 0, 'no send when config disabled/empty');

APP.discordSetConfig('https://discord.com/api/webhooks/1/abc', true);

// plain dice
click('dice', 'd6');
ok(sent.length === 1, 'dice sends embed when enabled');
ok(sent[0].url === 'https://discord.com/api/webhooks/1/abc', 'webhook url used for POST');
ok(sent[0].body.embeds && sent[0].body.embeds.length === 1, 'payload has one embed');
ok(APP.state.rollLog[0].kind === 'dice', 'dice entry kind = dice');

// init
click('init-roll');
ok(sent.length === 2, 'init sends embed');
ok(APP.state.rollLog[0].kind === 'init', 'init entry kind = init');

// pool
APP.state.diceMode = 'pool';
click('dice', 'd6');
click('dice', 'd8');
click('pool-roll');
ok(sent.length === 3, 'pool sends embed');
ok(APP.state.rollLog[0].kind === 'pool', 'pool entry kind = pool');

// check
click('check-roll', null, { parentNode: { querySelector: () => ({ value: 'харизма' }) } });
ok(sent.length === 4, 'check sends embed');
ok(APP.state.rollLog[0].kind === 'test', 'check entry kind = test');

// skill roll (force a skill attr selection) — use the 'blef' (Блеф) skill slug
APP.state.skillAttrs['skills:blef'] = 'харизма';
click('skill-roll', 'skills:blef');
ok(sent.length === 5, 'skill sends embed');
ok(APP.state.rollLog[0].kind === 'test', 'skill entry kind = test');

// ability roll — use a valid active ability id (Intimidation / Запугивание = 'ab_???')
// find the first active ability in allAbilities
const abId = Object.keys(APP.DATA.allAbilities).find(id => APP.DATA.allAbilities[id].type !== 'passive');
if (abId) {
  APP.state.abRolls[abId] = { attr: 'харизма', extra: '0' };
  click('ab-roll', abId);
  ok(sent.length === 6, 'ability sends embed');
  ok(APP.state.rollLog[0].kind === 'test', 'ability entry kind = test');
}

// weapon attack
click('wpn-atk', '0');
ok(sent.length === 7, 'weapon attack sends embed');
ok(APP.state.rollLog[0].kind === 'test', 'weapon attack kind = test');

// weapon damage
click('wpn-dmg', '0');
ok(sent.length === 8, 'weapon damage sends embed');
ok(APP.state.rollLog[0].kind === 'damage', 'weapon damage kind = damage');

// reroll
APP.mutate(() => { char.inspiration = 1; });
click('reroll');
ok(sent.length === 9, 'reroll sends embed');
ok(APP.state.rollLog[0].kind === 'reroll', 'reroll entry kind = reroll');

// every embed has title/description/timestamp
for (const s of sent) {
  const em = s.body.embeds[0];
  ok(typeof em.title === 'string' && em.title.length > 0, 'embed title present');
  ok(typeof em.description === 'string', 'embed description present');
  ok(typeof em.timestamp === 'string', 'embed timestamp present');
  ok(em.author && em.author.name, 'embed author present');
}

// crit vs fumble color end-to-end
APP.discordSetConfig('https://discord.com/api/webhooks/1/abc', true);
APP.state.checkBonus = 0;
APP.state.rollLog = [];
const before = sent.length;

// force die 20 (crit)
sandbox.Math.random = () => 0.99;
APP.state.abRolls = {};
const abId2 = Object.keys(APP.DATA.allAbilities).find(id => APP.DATA.allAbilities[id].type !== 'passive');
if (abId2) {
  APP.state.abRolls[abId2] = { attr: 'харизма', extra: '' };
  click('ab-roll', abId2);
  ok(APP.state.rollLog.length >= 1 && APP.state.rollLog[0].total >= 20, 'crit-able roll produced');
  const last = sent[sent.length - 1].body.embeds[0];
  ok(last.color === 0x2ecc71, 'crit roll embeds green end-to-end');
}
// force die 1 (fumble)
sandbox.Math.random = () => 0;
if (abId2) {
  click('ab-roll', abId2);
  const last = sent[sent.length - 1].body.embeds[0];
  ok(last.color === 0xe74c3c, 'fumble roll embeds red end-to-end');
}
sandbox.Math.random = () => 0.5;

// ---------------------------------------------------------------------------
// Task 4: UI modal + handlers
// ---------------------------------------------------------------------------
freshRender();
let m = markup();
// seed config so the modal is filled in
APP.discordSetConfig('https://discord.com/api/webhooks/url#123', true);
freshRender();
click('discord-open');
m = markup();
ok(m.includes('data-action="discord-url"'), 'modal has url input');
ok(m.includes('data-action="discord-enabled"'), 'modal has enabled checkbox');
ok(m.includes('https://discord.com/api/webhooks/url#123'), 'url input pre-filled from config');

// toggle enabled off through checkbox change
change('discord-enabled', null, false);
cfg = APP.discordGetConfig();
ok(cfg.enabled === false, 'checkbox change disables config');
change('discord-enabled', null, true);
cfg = APP.discordGetConfig();
ok(cfg.enabled === true, 'checkbox change enables config');

// url input update
const newUrl = 'https://discord.com/api/webhooks/new/branch';
change('discord-url', null, newUrl);
cfg = APP.discordGetConfig();
ok(cfg.url === newUrl && cfg.enabled === true, 'url input persists config');

// close modal
click('discord-close');
freshRender();
m = markup();
ok(!m.includes('data-action="discord-url"'), 'modal removed after close');

if (consoleLog.length) { console.log('CONSOLE ERRORS: ' + consoleLog.join('; ')); fails++; }

console.log(checks + ' checks, ' + fails + ' failures');
if (fails) process.exit(1);
console.log('DISCORD HARNESS OK');
