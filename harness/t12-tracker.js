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

function change(action, value, checked) {
  const t = { getAttribute: (n) => (n === 'data-action' ? action : n === 'data-id' ? value : null), value, checked };
  appEl.onchange({ target: t });
}

function input(action, id, value) {
  const t = { getAttribute: (n) => (n === 'data-action' ? action : n === 'data-id' ? id : null), value };
  appEl.oninput({ target: t });
}

sandbox.Math.random = () => 0.5;

const char = {
  version: 1, id: 't12-seed', name: 'Трекер',
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
  masteryBonus: 0,
  notes: '', createdAt: 0, updatedAt: 0, humanBonusChoice: null,
};

APP.state.chars.push(char);
APP.state.currentId = char.id;
APP.goto('sheet');

let m = markup();
ok(m.includes('Боевой трекер'), 'tracker present');
ok(m.includes('Хиты') && m.includes('55') && m.includes('Восстановить'), 'hp bar 55 (dwarf con12)');
ok(m.includes('Запас сил') && m.includes('10'), 'stamina bar 10');
ok(m.includes('Действия') || m.includes('Истощение'), 'exhaustion row');
ok(m.includes('Травмы'), 'injuries row');
ok(m.includes('Состояния') && m.includes('data-action="cond-open"'), 'conditions row');
ok(m.includes('Бросок инициативы'), 'init roll in tracker');
ok(m.includes('Новый ход'), 'new turn btn');
ok(char.hp.current === 0 && char.hp.max === 55, 'seed pools computed');

APP.mutate(() => { char.hp.current = 15; char.stamina.current = 4; char.mana.current = 1; });
m = markup();
ok(m.includes('15 / 55'), 'hp current shown');
ok(m.includes('низкий уровень'), 'hp low threshold flagged (15 <= 55/3)');
ok(m.includes('4 / 10'), 'stamina current shown');

click('pool-inc', 'hp');
ok(char.hp.current === 16, 'pool +1');
click('pool-dec5', 'hp');
ok(char.hp.current === 11, 'pool -5');
click('pool-dec', 'stamina');
ok(char.stamina.current === 3, 'pool -1');
click('pool-rest', 'mana');
ok(char.mana.current === 6, 'pool rest to max');

click('pool-edit', 'hp');
m = markup();
ok(m.includes('pool-set') && m.includes('data-action="pool-set"'), 'pool edit renders input');
input('pool-set', 'hp', '50');
ok(char.hp.current === 50, 'pool-set manual 50');
input('pool-set', 'hp', '999');
ok(char.hp.current === 55, 'pool-set clamps to max');
input('pool-set', 'hp', '-5');
ok(char.hp.current === 0, 'pool-set clamps to 0');

APP.mutate(() => { char.hp.current = 0; char.deathSaves.fail = 0; });
m = markup();
ok(m.includes('Спасброски от смерти'), 'death panel shown at 0 hp');
ok(!m.includes('СМЕРТЬ'), 'no death badge yet');
click('death-toggle', 'fail', { _index: 1 });
click('death-toggle', 'fail', { _index: 2 });
ok(char.deathSaves.fail === 2, 'fail dots = 2');
m = markup();
ok(m.includes('СМЕРТЬ'), 'death badge at 2 fails');
click('death-toggle', 'fail', { _index: 2 });
ok(char.deathSaves.fail === 0, 'fail dot untoggled');

click('exh-inc');
click('exh-inc');
ok(char.exhaustion === 2, 'exhaustion 2');
click('exh-open');
m = markup();
ok(m.includes('Степени истощения') && m.includes('Смерть'), 'exhaustion modal');
click('exh-close');
ok(char.exhaustion === 2, 'close modal no change');

change('injury-set', 'head', true);
ok(char.injuries.head === true, 'injury head set');
change('injury-set', 'torso', true);
ok(char.injuries.torso === true, 'injury torso set');

click('cond-open');
m = markup();
ok(m.includes('Состояния') && m.includes('Оглушен'), 'cond modal list');
click('cond-toggle', 'ispugan');
click('cond-toggle', 'osleplen');
click('cond-toggle', 'otravlen');
ok(char.conditions.length === 3, '3 conditions added');
click('cond-close');
m = markup();
ok(m.includes('Испуган') && m.includes('Ослеплен') && m.includes('Отравлен'), 'condition chips shown');
click('cond-del', 'ispugan');
ok(char.conditions.length === 2 && char.conditions.indexOf('ispugan') === -1, 'condition removed');

const m1 = APP.state.chars.length;
APP.newChar();
APP.state.wizard.draft.raceId = 'human';
APP.state.wizard.draft.statusId = 'peasant';
APP.state.wizard.draft.attrs = { сила: 12, ловкость: 12, живучесть: 14, воля: 12, восприятие: 10, харизма: 10, мудрость: 10, интеллект: 10 };
APP.state.wizard.draft.traits = ['t15'];
APP.state.wizard.draft.traitRolled = true;
APP.state.wizard.draft.specializations = ['martial', 'strength', 'warding', 'transmutation'];
APP.createChar();
const m15 = APP.state.chars[APP.state.chars.length - 1];
APP.state.currentId = m15.id;
APP.mutate(() => { m15.stamina.current = 8; m15.mana.current = 4; });
const st0 = m15.stamina.current, ma0 = m15.mana.current;
APP.goto('sheet');
click('new-turn');
ok(m15.stamina.current === st0 + 1 && m15.mana.current === ma0 + 1, 'marathoner restores 1/1 on new turn');

APP.mutate(() => { m15.traits = ['t11']; });
APP.goto('sheet');
APP.mutate(() => { m15.inspiration = 0; });
click('new-day');
ok(m15.inspiration === 3, 'new day restores inspiration 3');
click('new-day');
ok(m15.inspiration === 3, 'new day caps at 3');

if (consoleLog.length) { console.log('CONSOLE ERRORS: ' + consoleLog.join('; ')); fails++; }

console.log(checks + ' checks, ' + fails + ' failures');
if (fails) process.exit(1);
console.log('TRACKER HARNESS OK');