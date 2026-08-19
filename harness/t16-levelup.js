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

function seed() {
  const attrs = { сила: 11, ловкость: 11, живучесть: 12, воля: 11, восприятие: 11, харизма: 10, мудрость: 10, интеллект: 8 };
  return {
    version: 1, id: 't16-seed', name: 'ЛевелАп', raceId: 'human', statusId: 'freePeasant', traitId: null, traitRolled: true,
    level: 1, attrs,
    hp: { current: 0, max: 0 }, stamina: { current: 0, max: 0 }, mana: { current: 0, max: 0 },
    trained: { skills: {}, lores: {}, crafts: {} },
    specializations: ['martial'], abilities: [], customAbilities: [],
    weapons: [], armor: null, shield: null, inventory: [],
    conditions: [], injuries: { head: false, arms: false, torso: false, legs: false },
    exhaustion: 0, deathSaves: { success: 0, fail: 0 }, inspiration: 0,
    spentOS: 0, osBonuses: { stamina: 0, mana: 0, hp: 0 },
    masteryBonus: 0,
    notes: '', createdAt: 0, updatedAt: 0, humanBonusChoice: { all: true },
  };
}

const char = seed();
APP.state.chars.push(char);
APP.state.currentId = char.id;
APP.calcFull(char);
char.hp.current = char.hp.max;
char.stamina.current = char.stamina.max;
char.mana.current = char.mana.max;
APP.goto('sheet');

let m = markup();
ok(m.includes('Повысить уровень'), 'header levelup button');
ok(m.includes('44 / 44'), 'lvl1 hp max 44 (con 13 mod +1)');
ok(m.includes('9 / 9'), 'lvl1 stamina 9 (2+4+3 status)');
ok(m.includes('6 / 6'), 'lvl1 mana 6');

click('levelup');
m = markup();
ok(m.includes('Уровень 1 → 2'), 'modal shows 1 → 2');
ok(m.includes('Кинуть d10') && m.includes('Среднее: +6'), 'hp mode buttons');
ok(!m.includes('+11'), 'no automatic max die');
ok(m.includes('кость не брошена'), 'roll pending hint');
ok(m.includes('ОС к получению:</strong> +2'), 'gain 2 OS');
ok(m.includes('(3 → 5)'), 'pool 3 → 5');
ok(m.includes('ЗС 9 → 10') && m.includes('Мана 6 → 7'), 'default both bonus preview');
ok(!m.includes('HP 44 →'), 'no hp preview until rolled');

click('levelup-apply');
m = markup();
ok(m.includes('Бросьте кость или возьмите среднее'), 'guard toast without roll');
ok(m.includes('Повышение уровня</h3>'), 'modal stays open on guard');

sandbox.Math.random = () => 0.2;
click('levelup-hpmode', 'roll');
m = markup();
ok(m.includes('+4 (кость 3 + мод 1)'), 'roll 3 + con 1 = 4');
ok(m.includes('HP 44 → 48'), 'hp preview after roll');

click('levelup-os', 'both');
m = markup();
ok(m.includes('Потрачено в модалке: 1'), 'spent 1 after both quick');
ok(m.includes('ЗС 9 → 11') && m.includes('Мана 6 → 8'), 'quick both preview');

click('levelup-os', 'hp');
m = markup();
ok(m.includes('Потрачено в модалке: 2'), 'spent 2');
ok(m.includes('HP 44 → 53'), 'hp preview +5 quick');
ok(m.includes('disabled'), 'quick buttons disabled when spent all');

click('levelup-bonus', 'stamina2');
m = markup();
ok(m.includes('ЗС 9 → 12'), 'bonus stamina2 reroutes preview (9 + 1 quick + 2)');
ok(m.includes('Мана 6 → 7'), 'mana keeps quick +1 only');

click('levelup-hpmode', 'avg');
m = markup();
ok(m.includes('+7 (среднее d10 + мод 1)'), 'avg d10 = 6, gain 7');
ok(m.includes('HP 44 → 56'), 'hp preview with avg + quick hp');

click('levelup-apply');
m = markup();
ok(!m.includes('Повышение уровня</h3>'), 'modal closed after apply');
ok(char.level === 2, 'level 2');
ok(char.hp.max === 56 && char.hp.current === 56, 'hp max/current 56 (44 + 6 + 1 + 5)');
ok(char.hpLevels[2] === 6, 'hpLevels 2 = avg d10');
ok(char.stamina.max === 12 && char.stamina.current === 12, 'stamina 12 (9+1quick+2bonus)');
ok(char.mana.max === 7 && char.mana.current === 7, 'mana 7 (6+1)');
ok(char.spentOS === 2, 'spentOS 2');
APP.state.tab = 'specs';
APP.goto('sheet');
m = markup();
ok(m.includes('ОС: 2 / 5'), 'totalOS 5 at lvl2 shown in specs');

const t12 = seed();
t12.id = 't12-seed';
t12.traits = ['t12'];
APP.state.chars.push(t12);
APP.state.currentId = t12.id;
APP.calcFull(t12);
APP.goto('sheet');
click('levelup');
m = markup();
ok(m.includes('ОС к получению:</strong> +1'), 't12 gain 1');
ok(m.includes('Тупой'), 't12 note shown');
click('levelup-close');
m = markup();
ok(!m.includes('Повышение уровня</h3>'), 'close works');

const t1 = seed();
t1.id = 't1-seed';
t1.traits = ['t1'];
t1.level = 2;
APP.state.chars.push(t1);
APP.state.currentId = t1.id;
APP.calcFull(t1);
APP.goto('sheet');
click('levelup');
m = markup();
ok(m.includes('ОС к получению:</strong> +3'), 't1 at lvl3 gain +3 (2 base + 1 trait)');
ok(m.includes('Приспосабливаемый'), 't1 note shown');
click('levelup-close');

const hi = seed();
hi.id = 'hi-seed';
hi.level = 15;
APP.state.chars.push(hi);
APP.state.currentId = hi.id;
APP.calcFull(hi);
APP.goto('sheet');
click('levelup');
m = markup();
ok(m.includes('Уровень 15 → 16'), '16+ modal');
ok(m.includes('ОС за уровень 16+'), 'manual input shown for 16+');
ok(m.includes('ОС к получению:</strong> +0'), 'gain 0 before manual (osByLevel16 none)');
input('levelup-manual', '3');
m = markup();
ok(m.includes('ОС к получению:</strong> +3'), 'manual adds 3');
click('levelup-hpmode', 'avg');
click('levelup-apply');
ok(hi.level === 16, 'hi level 16');
ok(hi.extraOS === 3, 'extraOS stored 3');
APP.state.tab = 'specs';
APP.goto('sheet');
m = markup();
ok(m.includes('ОС: 0 / 39'), 'totalOS 39 = 36 + 3');

const top = seed();
top.id = 'top-seed';
top.level = 20;
APP.state.chars.push(top);
APP.state.currentId = top.id;
APP.goto('sheet');
m = markup();
ok(m.includes('data-action="levelup" disabled'), 'levelup disabled at 20');
click('levelup');
m = markup();
ok(!m.includes('Уровень 20 → 21'), 'no modal at 20');

if (consoleLog.length) { console.log('CONSOLE ERRORS: ' + consoleLog.join('; ')); fails++; }

console.log(checks + ' checks, ' + fails + ' failures');
if (fails) process.exit(1);
console.log('LEVELUP HARNESS OK');