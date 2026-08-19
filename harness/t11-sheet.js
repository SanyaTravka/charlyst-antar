const vm = require('vm');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'antar-sheet.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];

function makeEl() {
  const o = { innerHTML: '', children: [], style: {}, onclick: null, oninput: null, onchange: null };
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
  localStorage: {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  },
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
  node.closest = function (sel) { return (extra && extra._closest && extra._closest(sel)) || node; };
  appEl.onclick({ target: node });
  return node;
}

function input(action, id, value) {
  const t = { getAttribute: (n) => (n === 'data-action' ? action : n === 'data-id' ? id : null), value };
  appEl.oninput({ target: t });
}

function change(action, value) {
  const t = { getAttribute: (n) => (n === 'data-action' ? action : null), value };
  appEl.onchange({ target: t });
}

sandbox.Math.random = () => 0.5;

const dwarf = APP.state ? null : null;
const char = {
  version: 1, id: 't11-seed', name: 'Бронни',
  raceId: 'dwarf', statusId: null, traitId: null, traitRolled: false,
  level: 1,
  attrs: { сила: 12, ловкость: 14, живучесть: 12, воля: 10, восприятие: 10, харизма: 10, мудрость: 10, интеллект: 10 },
  hp: { current: 0, max: 0 }, stamina: { current: 0, max: 0 }, mana: { current: 0, max: 0 },
  trained: { skills: {}, lores: {}, crafts: {} },
  specializations: [], abilities: [], customAbilities: [],
  weapons: [], armor: null, shield: null, inventory: [],
  conditions: [], injuries: { head: false, arms: false, torso: false, legs: false },
  exhaustion: 0, deathSaves: { success: 0, fail: 0 }, inspiration: 0,
  spentOS: 0, osBonuses: { stamina: 0, mana: 0, hp: 0 },
  masteryBonus: 1,
  notes: '', createdAt: 0, updatedAt: 0, humanBonusChoice: null,
};

APP.state.chars.push(char);
APP.state.currentId = char.id;
APP.goto('sheet');

let m = markup();
ok(APP.state.screen === 'sheet', 'screen = sheet');
ok(m.includes('Характеристики') && m.includes('Боевые параметры') && m.includes('Оружие') && m.includes('Доспех и щит') && m.includes('Черта и статус') && m.includes('Дайсеры'), 'all sections');
ok(m.includes('Хиты') && m.includes('55'), 'hp 55 (dwarf con14)');
ok(m.includes('10') && m.includes('Запас сил'), 'stamina 10');
ok(m.includes('КД') && m.includes('10'), 'ac 10 bare');
ok(m.includes('Скорость') && m.includes('5 клетки'), 'speed 5');
ok(m.includes('Уровневый бонус') && m.includes('value="1"'), 'mastery input');
ok(m.includes('ур. 1'), 'level in header');
ok(m.includes('Бронни'), 'name shown');

input('name-set', null, 'Брунгильда');
ok(char.name === 'Брунгильда', 'name set');
m = markup();
ok(m.includes('Брунгильда'), 'name re-rendered');

input('attr-set', 'живучесть', '16');
ok(char.attrs['живучесть'] === 16, 'attr set 16');
m = markup();
ok(m.includes('62'), 'hp recalc to 62 (con16 final 18, mod 4)');

change('armor-set', 'light');
ok(char.armor && char.armor.id === 'light', 'armor set');
m = markup();
ok(m.includes('КД') && m.includes('16'), 'ac 16 with light armor');
ok(m.includes('Легкие'), 'armor name in markup');

change('armor-set', '');
ok(char.armor === null, 'armor cleared');

click('weapon-stock', 'dagger');
ok(char.weapons.length === 1 && char.weapons[0].id === 'dagger', 'weapon added');
m = markup();
ok(m.includes('Кинжал'), 'dagger in markup');
ok(m.includes('Атак/ход: 3'), 'dagger 3 attacks/round');

click('weapon-del', '0');
ok(char.weapons.length === 0, 'weapon removed');

click('tab', 'inventory');
m = markup();
ok(APP.state.tab === 'inventory', 'inventory tab opened');
ok(m.includes('Суммарный вес') && m.includes('0'), 'empty inventory weight 0');
const invRow = {
  querySelector: (sel) => ({
    '[data-action="inv-name"]': { value: 'Факел' },
    '[data-action="inv-qty"]': { value: '2' },
    '[data-action="inv-weight"]': { value: '1.5' },
    '[data-action="inv-desc"]': { value: 'Даёт свет' },
  })[sel] || null,
};
click('inv-add', null, { parentNode: invRow });
ok(char.inventory.length === 1 && char.inventory[0].name === 'Факел' && char.inventory[0].qty === 2 && char.inventory[0].weight === 1.5 && char.inventory[0].desc === 'Даёт свет', 'inventory add (object with desc)');
m = markup();
ok(m.includes('Факел'), 'inventory item shown');
ok(m.includes('Суммарный вес') && m.includes('3'), 'weight 2×1.5 = 3');

input('inv-qty-set', '0', '4');
ok(char.inventory[0].qty === 4, 'inv qty edited');
input('inv-name-set', '0', 'Факелы');
ok(char.inventory[0].name === 'Факелы', 'inv name edited');
input('inv-weight-set', '0', '1');
ok(char.inventory[0].weight === 1, 'inv weight edited');
m = markup();
ok(m.includes('Суммарный вес') && m.includes('4'), 'weight recalc to 4×1 = 4');

click('inv-del', '0');
ok(char.inventory.length === 0, 'inventory remove');
click('tab', 'overview');
m = markup();
ok(m.includes('Характеристики'), 'back to overview');

click('dice', 'd8', { _closest: (sel) => null });
ok(appEl.children.some(c => (c.innerHTML || '').includes('Кость d8: 5')), 'dice toast');

click('init-roll');
ok(appEl.children.some(c => (c.innerHTML || '').includes('Инициатива: 11 + скорость 5 = 16')), 'init toast');

const checkRow = { querySelector: (sel) => (sel === '[data-action="check-attr"]' ? { value: 'ловкость' } : null) };
click('check-roll', null, { _closest: (sel) => null, parentNode: checkRow });
ok(appEl.children.some(c => (c.innerHTML || '').includes('Проверка «ловкость»: 11 + +2 + 1 = 14')), 'check roll toast');

click('tab', 'specs');
m = markup();
ok(APP.state.tab === 'specs', 'tab switched');
ok(m.includes('Специализации и способности'), 'specs tab content');
click('tab', 'overview');
m = markup();
ok(m.includes('Характеристики'), 'back to overview');

APP.exportChar(char.id);
ok(true, 'export call ok');

APP.newChar();
APP.state.wizard.draft.raceId = 'human';
APP.state.wizard.draft.statusId = 'peasant';
APP.state.wizard.draft.traits = ['t11'];
APP.state.wizard.draft.traitRolled = true;
APP.state.wizard.draft.specializations = ['martial', 'strength', 'warding', 'transmutation'];
APP.state.wizard.draft.spentOS = 0;
const n0 = APP.state.chars.length;
APP.createChar();
const t11c = APP.state.chars[APP.state.chars.length - 1];
ok(t11c.id && t11c.id.length > 0, 'created id assigned');
ok(t11c.inspiration === 3, 't11 inspiration initialized to 3');
ok(t11c.hp.current === t11c.hp.max && t11c.hp.max > 0, 'hp pools initialized on create');
ok(t11c.osBonuses.stamina === 0 && t11c.osBonuses.mana === 0 && t11c.spentOS === 0, 'no treasure spent');

if (consoleLog.length) { console.log('CONSOLE ERRORS: ' + consoleLog.join('; ')); fails++; }

console.log(checks + ' checks, ' + fails + ' failures');
if (fails) process.exit(1);
console.log('SHEET HARNESS OK');