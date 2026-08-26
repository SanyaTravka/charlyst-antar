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
  node.getAttribute = function (n) { return n === 'data-action' ? action : n === 'data-id' ? id : null; };
  node.closest = function () { return node; };
  appEl.onclick({ target: node });
  return node;
}

function input(action, id, value) {
  const t = { getAttribute: (n) => (n === 'data-action' ? action : n === 'data-id' ? id : null), value };
  appEl.oninput({ target: t });
}

function change(action, id, value) {
  const t = { getAttribute: (n) => (n === 'data-action' ? action : n === 'data-id' ? id : null), value };
  appEl.onchange({ target: t });
}

// the document stub never clears children on innerHTML='' (unlike a real browser)
function freshRender() {
  appEl.children.length = 0;
  APP.render();
}

sandbox.Math.random = () => 0.5;

const char = {
  version: 1, id: 't24-seed', name: 'Навыки',
  raceId: 'human', statusId: null, traitId: null, traitRolled: true,
  level: 3,
  attrs: { сила: 10, ловкость: 12, живучесть: 10, воля: 10, восприятие: 10, харизма: 14, мудрость: 10, интеллект: 10 },
  hp: { current: 0, max: 0 }, stamina: { current: 0, max: 0 }, mana: { current: 0, max: 0 },
  trained: { skills: {}, lores: {}, crafts: {} },
  specializations: [], abilities: [], customAbilities: [],
  weapons: [], armor: null, shield: null, inventory: [],
  conditions: [], injuries: { head: false, arms: false, torso: false, legs: false },
  exhaustion: 0, deathSaves: { success: 0, fail: 0 }, inspiration: 0,
  spentOS: 0, osBonuses: { stamina: 0, mana: 0, hp: 0 },
  masteryBonus: 2,
  notes: '', createdAt: 0, updatedAt: 0, humanBonusChoice: null,
};
char.hp.max = APP.calcFull(char).hp;

APP.state.chars.push(char);
APP.state.currentId = char.id;
APP.goto('sheet');

let m = markup();
ok(m.includes('data-action="tab" data-id="skills"'), 'skills tab present in tab bar');

APP.tabSet('skills');
freshRender();
m = markup();
ok(m.includes('Навыки (24)') && m.includes('Знания (19)') && m.includes('Ремёсла (17)'), 'three sections with rules counts');
ok(m.includes('Азартные игры') && m.includes('Чтение по губам'), 'skills listed');
ok(m.includes('Парамедицина') && m.includes('Хирургия'), 'lores listed');
ok(m.includes('Кузнечное дело') && m.includes('Скульптура'), 'crafts listed');
ok(m.split('data-action="skill-roll"').length - 1 === 60, 'roll button per skill entry');
ok(m.split('data-action="skill-trained"').length - 1 === 60, 'trained toggle per skill entry');
ok(m.split('>Не изучен</button>').length - 1 === 60, 'untrained state labeled explicitly');

// allowed attrs only: Блеф -> харизма, мудрость
ok(m.includes('<option value="мудрость"'), 'attr options rendered');
ok(!m.includes('<option value="живучесть"></option>'), 'no empty options');

// untrained roll: no mastery bonus (blef харизма mod +2)
click('skill-roll', 'skills:blef');
ok(APP.state.rollLog.length === 1, 'skill roll logged');
ok(APP.state.rollLog[0].label === 'навык «Блеф» (харизма)', 'log label names skill and attr');
ok(APP.state.rollLog[0].expr === '11 + +2', 'untrained expr has no mastery bonus');
ok(APP.state.rollLog[0].total === 13, 'untrained total 13');
m = markup();
ok(m.includes('Блеф (харизма): 11 + +2 = 13'), 'toast shown');

// train the skill, roll again: mastery added
click('skill-trained', 'skills:blef');
ok(char.trained.skills.blef === true, 'trained flag stored in char');
freshRender();
m = markup();
ok(m.split('>Изучен</button>').length - 1 === 1, 'trained state labeled explicitly');
ok(m.split('>Не изучен</button>').length - 1 === 59, 'other skills still untrained');
ok(m.includes('border-left:4px solid var(--success)'), 'trained row highlighted');
ok(!m.includes('color:var(--success)'), 'no green font on buttons');
click('skill-roll', 'skills:blef');
ok(APP.state.rollLog[0].expr === '11 + +2 + 2', 'trained expr adds mastery');
ok(APP.state.rollLog[0].total === 15, 'trained total 15');

// attr choice changes the roll
change('skill-attr', 'skills:blef', 'мудрость');
ok((APP.state.skillAttrs || {})['skills:blef'] === 'мудрость', 'attr choice stored');
click('skill-roll', 'skills:blef');
ok(APP.state.rollLog[0].label === 'навык «Блеф» (мудрость)', 'label follows chosen attr');
ok(APP.state.rollLog[0].expr === '11 + +0 + 2', 'chosen attr mod used (мудрость 10)');

// lore and craft entries work too
click('skill-trained', 'lores:lechenie');
ok(char.trained.lores.lechenie === true, 'lore trained flag stored');
click('skill-roll', 'lores:lechenie');
ok(APP.state.rollLog[0].label.indexOf('Лечение') !== -1, 'lore roll logged by name');
click('skill-roll', 'crafts:skulptura');
ok(APP.state.rollLog[0].label.indexOf('Скульптура') !== -1, 'craft roll logged by name');

// free bonus field per skill
ok(m.split('data-action="skill-bonus"').length - 1 === 60, 'bonus input per skill entry');
input('skill-bonus', 'skills:blef', '-1');
ok(APP.state.skillBonus['skills:blef'] === -1, 'negative skill bonus stored');
// blef: trained, attr мудрость (mod 0), mastery 2, bonus -1
click('skill-roll', 'skills:blef');
ok(APP.state.rollLog[0].expr === '11 + +0 + 2 + -1', 'expr: d20 + mod + mastery + free bonus');
ok(APP.state.rollLog[0].total === 12, 'total 11 + 0 + 2 - 1 = 12');
// untrained skill ignores mastery but keeps bonus
input('skill-bonus', 'crafts:skulptura', '3');
click('skill-roll', 'crafts:skulptura');
ok(APP.state.rollLog[0].expr === '11 + +0 + +3', 'untrained: no mastery, bonus kept');
ok(APP.state.rollLog[0].total === 14, 'untrained total 11 + 3 = 14');

// inspiration reroll repeats skill check
APP.mutate(() => { char.inspiration = 1; });
APP.state.lastDiceProbe = null;
click('reroll');
ok(APP.state.rollLog[0].label.indexOf('переброс') === 0, 'reroll works after skill roll');
ok(APP.state.rollLog[0].expr.indexOf('11') === 0, 'reroll reuses d20 result');

// status grants trained skills at creation
APP.newChar();
APP.state.wizard.draft.raceId = 'human';
APP.state.wizard.draft.statusId = 'artist';
APP.state.wizard.draft.specializations = ['martial', 'strength', 'warding', 'transmutation'];
APP.createChar();
const made = APP.state.chars[APP.state.chars.length - 1];
ok(made.trained.skills.blef === true && made.trained.skills.predstavlenie === true, 'status skills marked trained');
ok(made.trained.crafts.muzyka === true && made.trained.crafts.grimirovka === true, 'status crafts marked trained');

if (consoleLog.length) { console.log('CONSOLE ERRORS: ' + consoleLog.join('; ')); fails++; }

console.log(checks + ' checks, ' + fails + ' failures');
if (fails) process.exit(1);
console.log('SKILLS HARNESS OK');
