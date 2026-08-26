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

// the document stub never clears children on innerHTML='' (unlike a real browser),
// so drop stale nodes from earlier renders before asserting on fresh output
function freshRender() {
  appEl.children.length = 0;
  APP.render();
}

sandbox.Math.random = () => 0.5;

const char = {
  version: 1, id: 't20-seed', name: 'Журнал',
  raceId: 'dwarf', statusId: null, traitId: null, traitRolled: false,
  level: 1,
  attrs: { сила: 12, ловкость: 10, живучесть: 12, воля: 10, восприятие: 10, харизма: 10, мудрость: 10, интеллект: 10 },
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

APP.state.chars.push(char);
APP.state.currentId = char.id;
APP.goto('sheet');

let m = markup();
ok(m.includes('Журнал бросков'), 'roll log block present under tracker');
ok(m.includes('Журнал пуст'), 'empty state shown initially');
ok(APP.state.rollLog.length === 0, 'log starts empty');

// init roll logs an entry
click('init-roll');
ok(APP.state.rollLog.length === 1, 'init-roll adds one entry');
ok(APP.state.rollLog[0].label === 'инициатива', 'entry label is инициатива');
ok(APP.state.rollLog[0].total === 15, 'entry total 11 d20 + 4 speed');
m = markup();
ok(m.includes('инициатива') && m.includes('= 15'), 'log line rendered with total');
ok(m.includes('height:200px;overflow-y:auto'), 'entries live in fixed-height scroll container');

// single die logs
click('dice', 'd6');
ok(APP.state.rollLog.length === 2, 'dice adds entry');
ok(APP.state.rollLog[0].label === 'd6' && APP.state.rollLog[0].total === 4, 'newest first, d6 -> 4');

// check roll logs (attr selector found via parentNode; харизма has no dwarf bonus)
click('check-roll', null, { parentNode: { querySelector: () => ({ value: 'харизма' }) } });
ok(APP.state.rollLog.length === 3, 'check-roll adds entry');
ok(APP.state.rollLog[0].label === 'проверка «харизма»', 'check label includes attr');
ok(APP.state.rollLog[0].total === 11, 'check total 11 + 0');

// mastery bonus is NOT added to attribute checks; free bonus is used instead
APP.mutate(() => { char.masteryBonus = 2; });
input('check-bonus', null, '-1');
ok(APP.state.checkBonus === -1, 'check free bonus stored');
click('check-roll', null, { parentNode: { querySelector: () => ({ value: 'харизма' }) } });
ok(APP.state.rollLog[0].expr === '11 + +0 + -1', 'check expr: d20 + mod + free bonus (no mastery)');
ok(APP.state.rollLog[0].total === 10, 'check total 11 + 0 - 1 = 10 (mastery ignored)');
input('check-bonus', null, '0');
click('check-roll', null, { parentNode: { querySelector: () => ({ value: 'харизма' }) } });
ok(APP.state.rollLog[0].expr === '11 + +0', 'zero bonus omitted from expr');

// reroll logs
APP.mutate(() => { char.inspiration = 2; });
click('reroll');
ok(APP.state.rollLog.length === 6, 'reroll adds entry');
ok(APP.state.rollLog[0].label.indexOf('переброс') === 0, 'reroll label prefixed');

// cap at 20
for (let i = 0; i < 25; i++) click('dice', 'd4');
ok(APP.state.rollLog.length === 20, 'log capped at 20');

// toggle collapse
ok(APP.state.rollLogOpen !== false, 'log open by default');
m = markup();
ok(m.includes(' open><summary data-action="rolllog-toggle"'), 'log details rendered open by default');
click('rolllog-toggle');
ok(APP.state.rollLogOpen === false, 'toggle collapses');
freshRender();
m = markup();
const sumIdx = m.indexOf('data-action="rolllog-toggle"');
ok(sumIdx !== -1 && m.slice(Math.max(0, sumIdx - 80), sumIdx).indexOf(' open') === -1, 'collapsed log loses open attr');
click('rolllog-toggle');
ok(APP.state.rollLogOpen === true, 'toggle expands back');

// clear
click('rolllog-clear');
ok(APP.state.rollLog.length === 0, 'clear empties log');
freshRender();
m = markup();
ok(m.includes('Журнал пуст'), 'empty state after clear');

if (consoleLog.length) { console.log('CONSOLE ERRORS: ' + consoleLog.join('; ')); fails++; }

console.log(checks + ' checks, ' + fails + ' failures');
if (fails) process.exit(1);
console.log('ROLLLOG HARNESS OK');
