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

let stored = null;
const documentStub = {
  getElementById(id) { return id === 'app' ? appEl : null; },
  createElement(tag) { return tag === 'template' ? templateEl : makeEl(); },
  createTextNode(t) { return { text: t }; },
  body: makeEl(),
};

const consoleLog = [];
const timers = [];
const sandbox = {
  document: documentStub,
  window: {},
  localStorage: {
    getItem: (k) => (k === 'antar.characters' ? stored : null),
    setItem: (k, v) => { if (k === 'antar.characters') stored = v; },
    removeItem: () => {},
  },
  confirm: () => true,
  Blob: function () {},
  URL: { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} },
  FileReader: function () { this.readAsText = () => {}; },
  setTimeout: (fn) => { timers.push(fn); return timers.length; },
  clearTimeout: (id) => {},
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
  version: 1, id: 't15-seed', name: 'Справочник',
  raceId: 'human', statusId: null, traitId: null, traitRolled: false,
  level: 1,
  attrs: { сила: 10, ловкость: 10, живучесть: 10, воля: 10, восприятие: 10, харизма: 10, мудрость: 10, интеллект: 10 },
  hp: { current: 0, max: 0 }, stamina: { current: 0, max: 0 }, mana: { current: 0, max: 0 },
  trained: { skills: {}, lores: {}, crafts: {} },
  specializations: ['martial'], abilities: [], customAbilities: [],
  weapons: [], armor: null, shield: null, inventory: [],
  conditions: [], injuries: { head: false, arms: false, torso: false, legs: false },
  exhaustion: 0, deathSaves: { success: 0, fail: 0 }, inspiration: 0,
  spentOS: 0, osBonuses: { stamina: 0, mana: 0, hp: 0 },
  masteryBonus: 0,
  notes: '',
  createdAt: 0, updatedAt: 0, humanBonusChoice: null,
};

APP.state.chars.push(char);
APP.state.currentId = char.id;
APP.state.tab = 'refbook';
APP.goto('sheet');

let m = markup();
ok(m.includes('Справочник'), 'refbook header');
ok(m.includes('Состояния (' + Object.keys(APP.DATA.conditions).length + ')'), 'conditions section count');
ok(m.includes('Травмы (' + Object.keys(APP.DATA.injuries).length + ')'), 'injuries section');
ok(m.includes('Истощение (' + Object.keys(APP.DATA.exhaustion).length + ')'), 'exhaustion section');
ok(m.includes('Черты (' + Object.keys(APP.DATA.traits).length + ')'), 'traits section');
ok(m.includes('Расы (' + Object.keys(APP.DATA.races).length + ')'), 'races section');
ok(m.includes('Статусы (' + Object.keys(APP.DATA.statuses).length + ')'), 'statuses section');
ok(m.includes('Специализации (' + Object.keys(APP.DATA.specializations).length + ')'), 'specs section');

const oslep = Object.keys(APP.DATA.conditions).filter(id => APP.DATA.conditions[id].name.indexOf('Ослеплен') !== -1);
input('ref-search', 'ослеп');
m = markup();
ok(m.includes('Ослеплен') && m.includes('Ослепленная'), 'search finds blinded condition text');
const hiddenCond = Object.keys(APP.DATA.conditions).find(id => id !== 'osleplen');
ok(!m.includes(APP.DATA.conditions[hiddenCond].name), 'search hides other conditions');
input('ref-search', '');
m = markup();
ok(m.includes(APP.DATA.conditions[hiddenCond].name), 'cleared search restores');

input('ref-search', 'раб');
m = markup();
ok(m.includes('Раб'), 'search hits statuses');
ok(m.includes('Статусы'), 'statuses section visible with matches');

APP.state.tab = 'notes';
APP.goto('sheet');
m = markup();
ok(m.includes('Заметки') && m.includes('textarea'), 'notes tab renders');
ok(APP.state.chars[0].notes === '', 'notes empty initially');

input('notes-input', 'Первая запись');
ok(APP.state.chars[0].notes === '', 'notes not saved before debounce');
ok(timers.length === 1, 'debounce timer scheduled');
timers.pop()();
ok(APP.state.chars[0].notes === 'Первая запись', 'notes saved after debounce');
ok(stored !== null && stored.indexOf('Первая запись') !== -1, 'notes persisted to localStorage');

if (consoleLog.length) { console.log('CONSOLE ERRORS: ' + consoleLog.join('; ')); fails++; }

console.log(checks + ' checks, ' + fails + ' failures');
if (fails) process.exit(1);
console.log('REFBOOK NOTES HARNESS OK');