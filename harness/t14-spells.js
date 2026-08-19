const vm = require('vm');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'antar-sheet.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];

function makeEl() {
  const o = { _html: '', children: [], style: {}, onclick: null, oninput: null, onchange: null, checked: false };
  Object.defineProperty(o, 'innerHTML', {
    get() { return this._html; },
    set(v) { this._html = v; if (v === '') this.children = []; },
  });
  o.appendChild = function (child) { this.children.push(child); return child; };
  o.remove = function () {};
  o.setAttribute = function () {};
  o.addEventListener = function () {};
  o.click = function () {};
  o.getAttribute = function () { return null; };
  o.closest = function () { return null; };
  o.querySelector = function () { return null; };
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

const consoleLog = [];
const sandbox = {
  document: documentStub,
  window: {},
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  confirm: () => true,
  Blob: function () {},
  URL: { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} },
  FileReader: function () { this.readAsText = () => {}; },
  setTimeout: (fn) => 0,
  console: { log: () => {}, error: (...a) => { consoleLog.push(a.join(' ')); } },
  Math: Object.create(Math),
  Date, JSON, Object, Array, String, Number,
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
  node.closest = function (sel) { return (extra && extra._closestFor && extra._closestFor(sel)) || node; };
  appEl.onclick({ target: node });
  return node;
}

function input(action, value) {
  const t = { getAttribute: (n) => (n === 'data-action' ? action : null), value };
  appEl.oninput({ target: t });
}

sandbox.Math.random = () => 0.5;

const char = {
  version: 1, id: 't14-seed', name: 'Маг',
  raceId: 'human', statusId: null, traitId: null, traitRolled: false,
  level: 1,
  attrs: { сила: 10, ловкость: 10, живучесть: 10, воля: 10, восприятие: 10, харизма: 10, мудрость: 10, интеллект: 10 },
  hp: { current: 0, max: 0 }, stamina: { current: 0, max: 0 }, mana: { current: 0, max: 0 },
  trained: { skills: {}, lores: {}, crafts: {} },
  specializations: ['manifestation', 'restoration', 'transmutation', 'illusion'], abilities: [], customAbilities: [],
  weapons: [], armor: null, shield: null, inventory: [],
  conditions: [], injuries: { head: false, arms: false, torso: false, legs: false },
  exhaustion: 0, deathSaves: { success: 0, fail: 0 }, inspiration: 0,
  spentOS: 0, osBonuses: { stamina: 0, mana: 0, hp: 0 },
  masteryBonus: 0,
  notes: '', createdAt: 0, updatedAt: 0, humanBonusChoice: null,
};

const MAGIC = ['manifestation', 'restoration', 'transmutation', 'illusion', 'warding', 'antimagic', 'curses'];
const schoolNames = MAGIC.map(sid => APP.DATA.specializations[sid].name);

APP.state.chars.push(char);
APP.state.currentId = char.id;
APP.state.tab = 'spells';
APP.goto('sheet');

let m = markup();
ok(m.includes('Заклинания'), 'spells tab header');
ok(m.includes('ОС: 0 / 3'), 'OS counter');
for (const n of schoolNames) ok(m.includes(n), 'school section: ' + n);
ok(m.includes('Выучить'), 'learn buttons present');
ok(m.includes('Компоненты:'), 'components shown');

const found = Object.keys(APP.DATA.allAbilities).filter(id => {
  const ab = APP.DATA.allAbilities[id];
  return MAGIC.indexOf(ab.specId) !== -1;
});
ok(found.length > 0, 'magic abilities exist in data');

const fire = found.filter(id => String(APP.DATA.allAbilities[id].desc).toLowerCase().indexOf('огонь') !== -1 || APP.DATA.allAbilities[id].name.toLowerCase().indexOf('огонь') !== -1);
input('spell-search', 'огонь');
m = markup();
if (fire.length) {
  const nonFire = found.filter(id => fire.indexOf(id) === -1);
  let allFireShown = true;
  for (const id of fire) if (!m.includes(APP.DATA.allAbilities[id].name)) allFireShown = false;
  ok(allFireShown, 'fire filter shows fire spells');
  if (nonFire.some(id => !m.includes(APP.DATA.allAbilities[id].name))) ok(true, 'fire filter hides non-fire');
  else { ok(false, 'fire filter hides non-fire'); console.log('NOTE: all spells contain огонь?'); }
} else {
  console.log('NOTE: no fire spells in data, weak search check');
}
input('spell-search', 'zzzz');
m = markup();
ok(m.includes('Ничего не найдено'), 'no-result message');
input('spell-search', '');
m = markup();
ok(m.includes('Выучить'), 'reset search restores');

const t1 = found.find(id => {
  const ab = APP.DATA.allAbilities[id];
  return ab.tier === 1 && ab.specId === 'manifestation';
});
ok(!!t1, 'found t1 manifestation spell');
click('spell-buy', t1);
ok(char.abilities.indexOf(t1) !== -1, 'spell learned');
ok(char.spentOS === 0.5, 'acquired spell cost 0.5');
m = markup();
ok(m.includes('Выучено'), 'learned badge');

const t2 = found.find(id => {
  const ab = APP.DATA.allAbilities[id];
  return ab.tier === 2 && MAGIC.indexOf(ab.specId) !== -1;
});
m = markup();
if (t2) ok(m.includes('Требуется тир 2 (уровень 6–10)'), 'tier 2 gate at level 1');

APP.mutate(() => { char.level = 6; });
m = markup();
ok(m.includes('ОС: 0.5 / 15'), 'totalOS grows with level (3+2+2+2+3+3=15)');
if (t2) {
  click('spell-buy', t2);
  ok(char.abilities.indexOf(t2) !== -1 && char.spentOS === 1, 'tier 2 learned at level 6');
}

if (consoleLog.length) { console.log('CONSOLE ERRORS: ' + consoleLog.join('; ')); fails++; }

console.log(checks + ' checks, ' + fails + ' failures');
if (fails) process.exit(1);
console.log('SPELLS TAB HARNESS OK');