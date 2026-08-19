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
  version: 1, id: 't13-seed', name: 'Спец',
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
APP.state.tab = 'specs';
APP.goto('sheet');

let m = markup();
ok(m.includes('Специализации и способности'), 'specs tab header');
ok(m.includes('ОС: 0 / 3'), 'OS counter 0/3 (level1 human)');
ok(m.includes('Сила') && m.includes('Воинское искусство') && m.includes('Призыв') && m.includes('Ограждение'), '4 spec sections');
ok(m.includes('Изучить специализацию'), 'learn block present');

const t1id = Object.keys(APP.DATA.allAbilities).find(id => {
  const ab = APP.DATA.allAbilities[id];
  return ab.specId === 'strength' && ab.tier === 1 && ab.type === 'active';
});
ok(!!t1id, 'found strength t1 active ability');
m = markup();
ok(m.includes('Взять'), 'buy buttons rendered');

const costT1 = APP.CALC ? null : null;
click('ab-buy', t1id);
ok(char.abilities.indexOf(t1id) !== -1, 'ability bought');
ok(char.spentOS === 1, 'spentOS +1 (somatic)');
m = markup();
ok(m.includes('ОС: 1 / 3'), 'OS counter updated');

const t2id = Object.keys(APP.DATA.allAbilities).find(id => {
  const ab = APP.DATA.allAbilities[id];
  return ab.specId === 'strength' && ab.tier === 2;
});
ok(!!t2id, 'found strength t2 ability');
m = markup();
ok(m.includes('Требуется тир 2 (уровень 6–10)'), 'tier gate label at level 1');

click('ab-sell', t1id);
ok(char.abilities.indexOf(t1id) === -1 && char.spentOS === 0, 'ability refunded');

APP.mutate(() => { char.level = 6; });
m = markup();
ok(m.includes('Тир 2') && m.includes('(уровень 6–10)'), 'tier 2 section at level 6');
click('ab-buy', t2id);
ok(char.abilities.indexOf(t2id) !== -1 && char.spentOS === 1, 'tier 2 bought at level 6');

const wardingId = Object.keys(APP.DATA.allAbilities).find(id => {
  const ab = APP.DATA.allAbilities[id];
  return ab.specId === 'warding' && ab.tier === 1;
});
APP.mutate(() => { char.level = 1; char.spentOS = 3; });
click('ab-buy', wardingId);
ok(char.abilities.indexOf(wardingId) === -1, 'over-buy blocked');
m = markup();
ok(m.includes('Не хватает ОС'), 'not enough OS label');

APP.mutate(() => { char.spentOS = 0; });
click('spec-learn', 'dexterity');
ok(char.specializations.indexOf('dexterity') !== -1 && char.spentOS === 1, 'learned dexterity for 1 OS');
const n = APP.state.chars.length;
APP.newChar();
APP.state.wizard.draft.raceId = 'human';
APP.state.wizard.draft.statusId = 'peasant';
APP.state.wizard.draft.attrs = { сила: 12, ловкость: 12, живучесть: 14, воля: 12, восприятие: 10, харизма: 10, мудрость: 10, интеллект: 10 };
APP.state.wizard.draft.traits = ['t11'];
APP.state.wizard.draft.traitRolled = true;
APP.state.wizard.draft.specializations = ['strength', 'martial', 'conjuration', 'warding'];
APP.createChar();
const c2 = APP.state.chars[APP.state.chars.length - 1];
APP.state.currentId = c2.id;
APP.state.tab = 'specs';
APP.goto('sheet');
m = markup();
ok(m.includes('Своих способностей пока нет'), 'custom empty state');
ok(m.includes('Добавить свою'), 'custom add form');

const formStub = {
  querySelector: (sel) => {
    const map = {
      '[data-action="c-name"]': { value: 'Мой призыв' },
      '[data-action="c-tier"]': { value: '2' },
      '[data-action="c-type"]': { value: 'passive' },
      '[data-action="c-cost"]': { value: '3 маны' },
      '[data-action="c-desc"]': { value: 'Призывает нечто.' },
    };
    return map[sel] || null;
  },
};
click('custom-add', 'conjuration', { _closestFor: (sel) => (sel === '.custom-form' ? formStub : null) });
ok(c2.customAbilities.length === 1, 'custom ability added');
ok(c2.customAbilities[0].specId === 'conjuration' && c2.customAbilities[0].tier === 2 && c2.customAbilities[0].type === 'passive', 'custom fields stored');
m = markup();
ok(m.includes('Мой призыв') && m.includes('Призывает нечто.'), 'custom ability rendered');
click('custom-del', '0');
ok(c2.customAbilities.length === 0, 'custom ability removed');

APP.state.currentId = char.id;
APP.state.tab = 'specs';
APP.mutate(() => { char.spentOS = 0; char.osBonuses = { stamina: 0, mana: 0, hp: 0 }; });
APP.goto('sheet');
click('os-plus', 'both');
ok(char.spentOS === 1 && char.osBonuses.stamina === 1 && char.osBonuses.mana === 1, 'os bonus both +1');
click('os-plus', 'hp');
ok(char.spentOS === 2 && char.osBonuses.hp === 5, 'os bonus hp +5');
click('os-minus', 'both');
ok(char.spentOS === 1 && char.osBonuses.stamina === 0 && char.osBonuses.mana === 0, 'os bonus both refunded');
m = markup();
ok(m.includes('Бонусы: ЗС +0 · Мана +0 · HP +5'), 'bonuses display');

APP.mutate(() => { char.osBonuses = { stamina: 5, mana: 0, hp: 0 }; char.spentOS = 5; });
APP.goto('sheet');
click('os-minus', 'both');
ok(char.spentOS === 5 && char.osBonuses.stamina === 5 && char.osBonuses.mana === 0, 'asymmetric refund blocked (no negative mana)');
APP.mutate(() => { char.osBonuses = { stamina: 0, mana: 0, hp: 0 }; char.spentOS = 0; });

APP.mutate(() => { c2.customAbilities.splice(0, c2.customAbilities.length); });
APP.mutate(() => {
  c2.customAbilities.push({ specId: 'conjuration', name: 'Первый', tier: 1, type: 'active', cost: '', desc: '' });
  c2.customAbilities.push({ specId: 'conjuration', name: 'Второй', tier: 1, type: 'active', cost: '', desc: '' });
  c2.customAbilities.push({ specId: 'conjuration', name: 'Третий', tier: 1, type: 'active', cost: '', desc: '' });
});
APP.state.currentId = c2.id;
APP.state.tab = 'specs';
APP.goto('sheet');
click('custom-del', '1');
ok(c2.customAbilities.length === 2 && c2.customAbilities[0].name === 'Первый' && c2.customAbilities[1].name === 'Третий', 'custom identity delete by full-array index');

if (consoleLog.length) { console.log('CONSOLE ERRORS: ' + consoleLog.join('; ')); fails++; }

console.log(checks + ' checks, ' + fails + ' failures');
if (fails) process.exit(1);
console.log('SPECS TAB HARNESS OK');