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

const magicSpecs = ['manifestation', 'restoration', 'transmutation', 'illusion', 'warding', 'antimagic', 'curses'];
const magicAbilities = Object.keys(APP.DATA.allAbilities).filter(id => magicSpecs.indexOf(APP.DATA.allAbilities[id].specId) !== -1);

APP.state.chars.push(char);
APP.state.currentId = char.id;
APP.state.tab = 'specs';
APP.goto('sheet');

let m = markup();
ok(m.includes('Специализации и способности'), 'specs tab header');
ok(!m.includes('data-id="spells"'), 'spells tab removed from tab bar');
ok(m.includes('ОС: 0 / 3'), 'OS counter');
ok(m.includes('Компоненты:'), 'components shown inside spec blocks');
ok(m.includes('Затрата:'), 'resource cost shown inside spec blocks');
ok(magicAbilities.length > 0, 'magic abilities exist in data');

const fire = magicAbilities.find(id => {
  const ab = APP.DATA.allAbilities[id];
  return ab.specId === 'manifestation' && ab.name === 'Огненная стрела';
});
ok(!!fire, 'found Огненная стрела');
if (fire) {
  const ab = APP.DATA.allAbilities[fire];
  m = markup();
  ok(m.includes(ab.name), 'fire arrow shown in specs');
  ok(m.includes('Время: 1 действие'), 'cast time shown');
  ok(m.includes('Дистанция: 100 футов'), 'range shown');
  ok(m.includes('Затрата: 2 маны'), 'resource cost shown');
  ok(m.includes('Компоненты: верб., сом. (одна рука)'), 'components shown');
}

click('ab-buy', fire);
ok(char.abilities.indexOf(fire) !== -1, 'spell learned via ab-buy');
ok(char.spentOS === 0.5, 'acquired spell cost 0.5');
m = markup();
ok(m.includes('Отдать'), 'owned ability shows refund button');

const t2 = magicAbilities.find(id => {
  const ab = APP.DATA.allAbilities[id];
  return ab.tier === 2 && magicSpecs.indexOf(ab.specId) !== -1;
});
m = markup();
if (t2) ok(m.includes('Требуется тир 2 (уровень 6–10)'), 'tier 2 gate at level 1');

APP.mutate(() => { char.level = 6; });
m = markup();
ok(m.includes('ОС: 0.5 / 15'), 'totalOS grows with level (3+2+2+2+3+3=15)');
if (t2) {
  click('ab-buy', t2);
  ok(char.abilities.indexOf(t2) !== -1 && char.spentOS === 1, 'tier 2 learned at level 6');
}

if (consoleLog.length) { console.log('CONSOLE ERRORS: ' + consoleLog.join('; ')); fails++; }

console.log(checks + ' checks, ' + fails + ' failures');
if (fails) process.exit(1);
console.log('MERGED SPELL INFO HARNESS OK');