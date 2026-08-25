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
  node.closest = function (sel) { return (extra && extra._closest && extra._closest(sel)) || node; };
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
  version: 1, id: 't23-seed', name: 'Оружие',
  raceId: 'human', statusId: null, traitId: null, traitRolled: true,
  level: 1,
  attrs: { сила: 12, ловкость: 10, живучесть: 10, воля: 10, восприятие: 10, харизма: 10, мудрость: 10, интеллект: 10 },
  hp: { current: 0, max: 0 }, stamina: { current: 0, max: 0 }, mana: { current: 0, max: 0 },
  trained: { skills: {}, lores: {}, crafts: {} },
  specializations: ['martial'], abilities: [], customAbilities: [],
  weapons: [{ id: 'dagger' }, { id: 'lightCrossbow' }, { name: 'Артефакт', kind: 'своё', speed: 1, damage: '1d6', atkBonus: 3 }, { name: 'Хлам', kind: 'своё', speed: 1, damage: 'особый' }],
  armor: null, shield: null, inventory: [],
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
ok(m.split('data-action="wpn-atk"').length - 1 === 4, 'attack button on each weapon card');
ok(m.split('data-action="wpn-dmg"').length - 1 === 4, 'damage button on each weapon card');
ok(m.includes('d20 + мод.Ловкости + уровневый бонус'), 'attack hint names dexterity');

// attack: d20(11) + dex mod(0) + mastery(0); damage stays strength-based
click('wpn-atk', '0');
ok(APP.state.rollLog.length === 1, 'attack logged');
ok(APP.state.rollLog[0].label === 'атака: Кинжал', 'attack label uses weapon name');
ok(APP.state.rollLog[0].expr === '11 + +0 + 0', 'attack expr d20 + dex mod + mastery');
ok(APP.state.rollLog[0].total === 11, 'attack total 11 (dex 10)');
m = markup();
ok(m.includes('Атака (Кинжал): 11 + +0 + 0 = 11'), 'attack toast shown');

// damage dagger: 2d4 -> 3+3, STR mod +1 (урон от силы)
click('wpn-dmg', '0');
ok(APP.state.rollLog.length === 2, 'damage logged');
ok(APP.state.rollLog[0].label === 'урон: Кинжал', 'damage label');
ok(APP.state.rollLog[0].expr === '3+3+1', 'damage expr dice then str mod');
ok(APP.state.rollLog[0].total === 7, 'damage total 7');

// crossbow: flat 10 + 2d10 (6+6), no mod
click('wpn-dmg', '1');
ok(APP.state.rollLog.length === 3, 'crossbow damage logged');
ok(APP.state.rollLog[0].label === 'урон: Лёгкий арбалет', 'crossbow label');
ok(APP.state.rollLog[0].expr === '10+6+6', 'flat first then dice');
ok(APP.state.rollLog[0].total === 22, 'crossbow total 22');

// custom unparseable damage -> error toast, no log entry
click('wpn-dmg', '3');
ok(APP.state.rollLog.length === 3, 'unparseable damage not logged');
m = markup();
ok(m.includes('Не удалось распознать кость урона'), 'error toast for unparseable damage');

// custom weapon with atkBonus: attack adds weapon bonus term
m = markup();
ok(m.includes('Бонус к попаданию: +3'), 'weapon card shows attack bonus');
click('wpn-atk', '2');
ok(APP.state.rollLog.length === 4 && APP.state.rollLog[0].label === 'атака: Артефакт', 'custom weapon attack logged');
ok(APP.state.rollLog[0].expr === '11 + +0 + 0 + +3', 'attack expr includes weapon bonus');
ok(APP.state.rollLog[0].total === 14, 'custom attack 11 + 3');

// aggressive doubles damage dice only
APP.mutate(() => { char.traits = ['t7']; });
click('wpn-dmg', '0');
ok(APP.state.rollLog[0].total === 13, 'aggressive: 4d4 (3×4) + 1 = 13');
ok(APP.state.rollLog[0].expr === '3+3+3+3+1', 'aggressive expr four dice plus mod');
click('wpn-atk', '0');
ok(APP.state.rollLog[0].total === 11, 'aggressive leaves attack unchanged');

// creating custom weapon via modal stores atkBonus and uses it in rolls
const modal = makeEl();
modal.querySelector = (sel) => {
  const vals = {
    'wc-name': 'Тестовый клинок',
    'wc-kind': 'своё',
    'wc-speed': '1',
    'wc-props': '',
    'wc-reach': '',
    'wc-damage': '2d6',
    'wc-atkbonus': '+3',
  };
  return sel && vals[sel.replace('[data-action="', '').replace('"]', '')] !== undefined
    ? Object.assign(makeEl(), { value: vals[sel.replace('[data-action="', '').replace('"]', '')] })
    : null;
};
click('weapon-custom', null, { _closest: (sel) => (sel === '.wizard-modal' ? modal : null) });
const created = char.weapons[char.weapons.length - 1];
ok(created.name === 'Тестовый клинок' && created.atkBonus === 3, 'created weapon stores atkBonus from form');
freshRender();
click('wpn-atk', String(char.weapons.length - 1));
ok(APP.state.rollLog[0].label === 'атака: Тестовый клинок', 'newly created weapon attackable');
ok(APP.state.rollLog[0].expr === '11 + +0 + 0 + +3', 'created weapon bonus applied to roll');

// edit existing weapon: button per card, modal prefilled
freshRender();
m = markup();
ok(m.split('data-action="weapon-edit"').length - 1 === char.weapons.length, 'edit button on each weapon card');
click('weapon-edit', '1');
freshRender();
m = markup();
ok(m.includes('Изменение оружия'), 'edit modal opens');
ok(m.includes('value="Лёгкий арбалет"'), 'stock weapon prefilled from data');
click('weapon-editclose');
freshRender();
m = markup();
ok(!m.includes('Изменение оружия'), 'edit modal closes without changes');
ok(char.weapons[1].id === 'lightCrossbow', 'closing edit keeps weapon untouched');

// saving edit rewrites the slot (stock becomes own instance)
const emodal = makeEl();
emodal.querySelector = (sel) => {
  const vals = {
    'wc-name': 'Рунный клинок',
    'wc-kind': 'своё',
    'wc-speed': '3',
    'wc-props': '',
    'wc-reach': '',
    'wc-damage': '3d6',
    'wc-atkbonus': '-1',
  };
  const key = sel && sel.replace('[data-action="', '').replace('"]', '');
  return key && vals[key] !== undefined ? Object.assign(makeEl(), { value: vals[key] }) : null;
};
click('weapon-edit', '0');
click('weapon-editsave', null, { _closest: (sel) => (sel === '.wizard-modal' ? emodal : null) });
const edited = char.weapons[0];
ok(edited.name === 'Рунный клинок' && edited.atkBonus === -1 && edited.speed === 3, 'save writes edited fields');
ok(!edited.id, 'edited stock weapon becomes own instance');
freshRender();
click('wpn-atk', '0');
ok(APP.state.rollLog[0].label === 'атака: Рунный клинок', 'edited weapon attackable under new name');
ok(APP.state.rollLog[0].expr === '11 + +0 + 0 + -1', 'negative weapon bonus applied');
click('wpn-dmg', '0');
// Агрессивный (t7) из предыдущей секции всё ещё активен: 3d6 -> 6 кубов
ok(APP.state.rollLog[0].label === 'урон: Рунный клинок' && APP.state.rollLog[0].expr === '4+4+4+4+4+4', 'edited damage dice rolled');

if (consoleLog.length) { console.log('CONSOLE ERRORS: ' + consoleLog.join('; ')); fails++; }

console.log(checks + ' checks, ' + fails + ' failures');
if (fails) process.exit(1);
console.log('WPNROLL HARNESS OK');
