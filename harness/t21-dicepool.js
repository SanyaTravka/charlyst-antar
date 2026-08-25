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
  node.getAttribute = function (n) { return n === 'data-action' ? action : n === 'data-id' ? id : null; };
  node.closest = function () { return node; };
  appEl.onclick({ target: node });
  return node;
}

// the document stub never clears children on innerHTML='' (unlike a real browser)
function freshRender() {
  appEl.children.length = 0;
  APP.render();
}

sandbox.Math.random = () => 0.5;

const char = {
  version: 1, id: 't21-seed', name: 'Пул',
  raceId: 'human', statusId: null, traitId: null, traitRolled: true,
  level: 1,
  attrs: { сила: 10, ловкость: 10, живучесть: 10, воля: 10, восприятие: 10, харизма: 10, мудрость: 10, интеллект: 10 },
  hp: { current: 0, max: 0 }, stamina: { current: 0, max: 0 }, mana: { current: 0, max: 0 },
  trained: { skills: {}, lores: {}, crafts: {} },
  specializations: [], abilities: [], customAbilities: [],
  weapons: [], armor: null, shield: null, inventory: [],
  conditions: [], injuries: { head: false, arms: false, torso: false, legs: false },
  exhaustion: 0, deathSaves: { success: 0, fail: 0 }, inspiration: 0,
  spentOS: 0, osBonuses: { stamina: 0, mana: 0, hp: 0 },
  masteryBonus: 0,
  notes: '', createdAt: 0, updatedAt: 0, humanBonusChoice: null,
};
char.hp.max = APP.calcFull(char).hp;

APP.state.chars.push(char);
APP.state.currentId = char.id;
APP.goto('sheet');

let m = markup();
ok(APP.state.diceMode === 'roll', 'default mode is single roll');
ok(m.includes('Бросок') && m.includes('Пул'), 'mode toggle rendered');

// roll mode: d6 rolls immediately, pool untouched
click('dice', 'd6');
ok(APP.state.rollLog.length === 1 && APP.state.rollLog[0].label === 'd6', 'single roll still works in roll mode');
ok(JSON.stringify(APP.state.dicePool) === '[]', 'pool untouched in roll mode');

// switch to pool mode
click('dice-mode', 'pool');
ok(APP.state.diceMode === 'pool', 'switched to pool mode');

// clicks add dice to pool, no log entries
click('dice', 'd6');
click('dice', 'd6');
click('dice', 'd4');
ok(JSON.stringify(APP.state.dicePool) === '[6,6,4]', 'pool holds added dice');
ok(APP.state.rollLog.length === 1, 'adding to pool does not log');
freshRender();
m = markup();
ok(m.includes('2d6 + 1d4'), 'composition shown as formula');
ok(m.includes('Бросить пул') && m.includes('Очистить'), 'pool buttons present');

// removing one die
click('dice-pool-remove', '6');
ok(JSON.stringify(APP.state.dicePool) === '[6,4]', 'removing one die of that size');
freshRender();
m = markup();
ok(m.includes('1d6 + 1d4'), 'composition updated after removal');

// roll the pool
click('pool-roll');
ok(JSON.stringify(APP.state.dicePool) === '[]', 'pool resets after roll');
ok(APP.state.rollLog.length === 2, 'pool roll logged');
ok(APP.state.rollLog[0].label === 'Пул 1d6 + 1d4', 'pool log label has formula');
ok(APP.state.rollLog[0].total === 7, 'pool total 4 + 3 = 7');
m = markup();
ok(m.includes('= 7'), 'pool result visible');

// clear
click('dice', 'd8');
click('dice', 'd8');
ok(JSON.stringify(APP.state.dicePool) === '[8,8]', 'pool refilled');
click('pool-clear');
ok(JSON.stringify(APP.state.dicePool) === '[]', 'clear empties pool');
ok(APP.state.rollLog.length === 2, 'clear does not log');

// back to single mode
click('dice-mode', 'roll');
click('dice', 'd20');
ok(APP.state.rollLog.length === 3 && APP.state.rollLog[0].label === 'd20', 'back to single rolls');

if (consoleLog.length) { console.log('CONSOLE ERRORS: ' + consoleLog.join('; ')); fails++; }

console.log(checks + ' checks, ' + fails + ' failures');
if (fails) process.exit(1);
console.log('DICEPOOL HARNESS OK');
