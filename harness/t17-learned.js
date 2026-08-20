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
  version: 1, id: 't17-seed', name: 'Изучающий',
  raceId: 'human', statusId: null, traitId: null, traitRolled: false,
  level: 1,
  attrs: { сила: 10, ловкость: 10, живучесть: 10, воля: 10, восприятие: 10, харизма: 10, мудрость: 10, интеллект: 10 },
  hp: { current: 0, max: 0 }, stamina: { current: 0, max: 0 }, mana: { current: 0, max: 0 },
  trained: { skills: {}, lores: {}, crafts: {} },
  specializations: ['strength', 'martial', 'conjuration', 'warding'], abilities: [], customAbilities: [],
  weapons: [], armor: null, shield: null, inventory: [],
  conditions: [], injuries: { head: false, arms: false, torso: false, legs: false },
  exhaustion: 0, deathSaves: { success: 0, fail: 0 }, inspiration: 0,
  spentOS: 0, osBonuses: { stamina: 0, mana: 0, hp: 0 },
  masteryBonus: 0,
  notes: '', createdAt: 0, updatedAt: 0, humanBonusChoice: null,
};

APP.state.chars.push(char);
APP.state.currentId = char.id;
APP.state.tab = 'learned';
APP.goto('sheet');

let m = markup();
ok(m.includes('data-id="learned"'), 'learned tab in tab bar');
ok(m.includes('Изученные способности'), 'learned tab header');
ok(m.includes('ни одной способности'), 'empty state when nothing learned');
ok(!m.includes('data-id="specs"') || m.includes('Специализации'), 'specs tab still present');

const t1id = Object.keys(APP.DATA.allAbilities).find(id => {
  const ab = APP.DATA.allAbilities[id];
  return ab.specId === 'strength' && ab.tier === 1 && ab.type === 'active';
});
const t2id = Object.keys(APP.DATA.allAbilities).find(id => {
  const ab = APP.DATA.allAbilities[id];
  return ab.specId === 'strength' && ab.tier === 2 && ab.type === 'passive';
});
const wardingId = Object.keys(APP.DATA.allAbilities).find(id => {
  const ab = APP.DATA.allAbilities[id];
  return ab.specId === 'warding' && ab.tier === 1 && ab.type === 'active' && ab.castTime;
});
APP.mutate(() => { char.level = 6; });
click('ab-buy', t1id);
click('ab-buy', t2id);
click('ab-buy', wardingId);
ok(char.abilities.length === 3 && char.spentOS === 2.5, 'bought 3 abilities (2 somatic + 1 acquired)');

APP.goto('sheet');
m = markup();
ok(m.includes('Изученные способности'), 'header after learn');
ok(m.includes('Сила') && m.includes('Ограждение'), 'groups by specialization');
ok(m.includes('2 шт.') && m.indexOf('1 шт.') !== -1, 'per-spec counts');
ok(m.includes('ОС: 2.5 / 15'), 'OS counter');
ok(!m.includes('Взять'), 'no buy buttons on learned tab');
ok(m.includes('Тир 2') && m.includes('пассивная'), 'full ability meta');
ok(APP.DATA.allAbilities[wardingId].castTime ? m.includes('Время: ' + APP.DATA.allAbilities[wardingId].castTime) : true, 'cast time shown');

click('ab-sell', wardingId);
ok(char.abilities.indexOf(wardingId) === -1 && char.spentOS === 2, 'ability returned via Отдать');
m = markup();
ok(m.includes('ОС: 2 / 15'), 'OS counter after refund');

APP.mutate(() => {
  char.customAbilities.push({ specId: 'conjuration', name: 'Дух леса', tier: 1, type: 'active', cost: '2 маны', desc: 'Призывает духа.' });
  char.customAbilities.push({ specId: 'martial', name: 'Приём', tier: 2, type: 'passive', cost: '', desc: '' });
});
APP.goto('sheet');
m = markup();
ok(m.includes('Призыв') && m.includes('Дух леса'), 'custom abilities grouped by spec');
ok(m.includes('Воинское искусство') && m.includes('Приём'), 'custom in another spec group');
ok(m.includes('Призывает духа.'), 'custom desc shown');

click('custom-del', '0');
ok(char.customAbilities.length === 1 && char.customAbilities[0].name === 'Приём', 'custom returned via Отдать');
click('custom-del', '0');
ok(char.customAbilities.length === 0, 'second custom returned');

const door = Object.keys(APP.DATA.allAbilities).find(id => {
  const ab = APP.DATA.allAbilities[id];
  return ab.specId === 'strength' && ab.type === 'passive' && ab.tier === 1;
});
if (door && char.abilities.indexOf(door) !== -1) {
  click('ab-sell', door);
}
APP.mutate(() => { char.spentOS = 0; char.abilities.splice(0, char.abilities.length); });
APP.goto('sheet');
m = markup();
ok(m.includes('ни одной способности'), 'empty state after returning everything');

if (consoleLog.length) { console.log('CONSOLE ERRORS: ' + consoleLog.join('; ')); fails++; }

console.log(checks + ' checks, ' + fails + ' failures');
if (fails) process.exit(1);
console.log('LEARNED TAB HARNESS OK');