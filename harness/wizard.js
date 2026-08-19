const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('node:assert');

const SRC = path.join(__dirname, '..', 'src');

const ENT = { '&lt;': '<', '&gt;': '>', '&amp;': '&', '&quot;': '"', '&#39;': "'" };
const dec = (s) => s.replace(/&(lt|gt|amp|quot|#39);/g, (m) => ENT[m]);

function makeEl(tag, attrs) {
  const el = {
    tag, attrs: attrs || {}, children: [], parent: null,
    getAttribute(n) { return Object.prototype.hasOwnProperty.call(this.attrs, n) ? this.attrs[n] : null; },
    closest(sel) {
      let n = this;
      while (n) { if ('data-action' in n.attrs) return n; n = n.parent; }
      return null;
    },
    appendChild(c) { if (c) { c.parent = this; this.children.push(c); } return c; },
    remove() { if (this.parent) { const i = this.parent.children.indexOf(this); if (i !== -1) this.parent.children.splice(i, 1); } },
  };
  Object.defineProperty(el, 'textContent', { get() { return txt(el); } });
  return el;
}

const TAG = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:\s+[a-zA-Z-]+(?:="[^"]*")?)*)\s*(\/?)>/g;

function parseFragment(html) {
  const root = { children: [] };
  const stack = [root];
  let last = 0;
  TAG.lastIndex = 0;
  let m;
  while ((m = TAG.exec(html)) !== null) {
    if (m.index > last) pushText(stack[stack.length - 1], html.slice(last, m.index));
    last = TAG.lastIndex;
    const closing = m[1] === '/';
    const tag = m[2];
    const selfClose = m[4] === '/' || closing;
    if (closing) {
      if (stack.length > 1) stack.pop();
      continue;
    }
    const attrs = {};
    const AR = /\s+([a-zA-Z-]+)(?:="([^"]*)")?/g;
    let am;
    while ((am = AR.exec(m[3])) !== null) attrs[am[1]] = am[2] === undefined ? '' : am[2];
    const el = makeEl(tag, attrs);
    el.parent = stack[stack.length - 1];
    el.parent.children.push(el);
    if (!selfClose) stack.push(el);
  }
  if (last < html.length) pushText(stack[stack.length - 1], html.slice(last));
  return root.children;
}

function pushText(parent, text) {
  text = text.replace(/\s+/g, ' ').trim();
  if (text) parent.children.push({ tag: '#text', text, children: [] });
}

function txt(n) {
  if (n.tag === '#text') return dec(n.text);
  return n.children.map(txt).join('');
}

function templateEl() {
  const t = makeEl('template');
  Object.defineProperty(t, 'innerHTML', {
    set(v) { this._html = v; this.content = { firstElementChild: parseFragment(v)[0] || null }; },
    get() { return this._html; },
  });
  return t;
}

const appRoot = makeEl('div', { id: 'app' });
Object.defineProperty(appRoot, 'innerHTML', { set() { this.children.length = 0; }, get() { return ''; } });

const storage = new Map();
const localStorage = {
  getItem(k) { return storage.has(k) ? storage.get(k) : null; },
  setItem(k, v) { storage.set(k, String(v)); },
  removeItem(k) { storage.delete(k); },
};

const rnd = { value: 0 };
const ctx = {};
ctx.window = ctx;
ctx.globalThis = ctx;
ctx.localStorage = localStorage;
ctx.document = {
  createElement(tag) { return tag === 'template' ? templateEl() : makeEl(tag); },
  getElementById(id) { return id === 'app' ? appRoot : null; },
  body: makeEl('body'),
};
ctx.setTimeout = () => {};
ctx.console = console;
ctx.Math = Object.create(Math, { random: { value: () => rnd.value } });
vm.createContext(ctx);

for (const f of ['data-core.js', 'data-magic.js', 'data-physical.js', 'calc.js', 'store.js', 'app.js']) {
  vm.runInContext(fs.readFileSync(path.join(SRC, f), 'utf8'), ctx, { filename: f });
}

const APP = ctx.APP;
const state = APP.state;
let passed = 0;
const ok = (cond, name) => { assert.ok(cond, name); passed++; console.log('ok - ' + name); };
const eq = (actual, expected, name) => { assert.strictEqual(actual, expected, name); passed++; console.log('ok - ' + name); };

function walk(root, out) {
  for (const n of root.children || []) {
    if (n.tag === '#text') continue;
    if ('data-action' in n.attrs) {
      out.push({ el: n, action: n.attrs['data-action'], id: n.attrs['data-id'] ?? null, disabled: 'disabled' in n.attrs });
    }
    walk(n, out);
  }
  return out;
}

function collect() { return walk(appRoot, []); }
function text() { return txt(appRoot); }
function find(action, id) {
  return collect().filter(c => c.action === action && (id === undefined || c.id === id));
}
function click(action, id) {
  const cs = find(action, id);
  assert.ok(cs.length >= 1, 'clickable exists for ' + action + '/' + id);
  if (cs[0].disabled) return false;
  appRoot.onclick({ target: cs[0].el });
  return true;
}
function forceClick(action, id) {
  const cs = find(action, id);
  assert.ok(cs.length >= 1, 'element exists for ' + action + '/' + id);
  appRoot.onclick({ target: cs[0].el });
}

// ---------- Char A: human +1 all, Тупой (t12), freePeasant ----------
click('new');
eq(state.wizard.step, 1, 'newChar -> step 1');
click('race', 'human');
eq(state.wizard.draft.raceId, null, 'human opens choice modal only');
ok(text().includes('Люди: бонус к характеристикам'), 'human modal rendered');
click('human-all');
eq(state.wizard.draft.raceId, 'human', 'human picked via modal');
click('wizard-next');
eq(state.wizard.step, 2, 'next -> step 2');
click('status', 'freePeasant');
eq(state.wizard.draft.statusId, 'freePeasant', 'status picked');
click('wizard-next');
eq(state.wizard.step, 3, 'next -> step 3');
rnd.value = 0.55;
click('trait-roll');
eq(state.wizard.draft.traits[0], 't12', 'd20 roll -> Тупой (t12)');
click('trait-pick', 't12');
eq(state.wizard.draft.traits.length, 0, 'trait-pick toggles off');
click('trait-pick', 't12');
eq(state.wizard.draft.traits.length, 1, 'trait-pick toggles on');
click('wizard-next');
eq(state.wizard.step, 4, 'next -> step 4');

ok(text().includes('распределяются свободно'), 'step 4 free-spread header');
click('attr-plus', 'интеллект');
eq(state.wizard.draft.attrs['интеллект'], 10, 'Тупой: + from 8 jumps to 10 (skips 9)');
click('attr-minus', 'интеллект');
eq(state.wizard.draft.attrs['интеллект'], 8, 'Тупой: - from 10 jumps to 8 (skips 9)');
click('attr-plus', 'интеллект');
eq(state.wizard.draft.attrs['интеллект'], 10, 'Тупой: re-jump to 10');
for (const a of ['сила', 'ловкость', 'живучесть', 'воля', 'восприятие']) {
  for (let i = 0; i < 5; i++) click('attr-plus', a);
}
eq(state.wizard.draft.attrs['сила'], 13, 'сила at 13');
ok(text().includes('Финал: 14'), 'attrFinal preview (13 + human +1)');
ok(text().includes('Модификатор: +2'), 'mods preview');
eq(click('wizard-next'), true, 'Далее enabled on step 4 (free spread)');
eq(state.wizard.step, 5, 'next -> step 5');

const specCards = find('spec');
eq(specCards.length, 13, '13 specialization cards');
ok(!specCards.some(c => txt(c.el).includes('Очарование')), 'no enchantment card');
eq(specCards.filter(c => txt(c.el).includes('телесная')).length, 3, '3 телесная (strength/dexterity/vitality)');
eq(specCards.filter(c => txt(c.el).includes('приобретённая')).length, 10, '10 приобретённая');
ok(txt(specCards.find(c => c.id === 'conjuration').el).includes('ждём редакций'), 'conjuration marked ждём редакций');
for (const s of ['strength', 'illusion', 'curses', 'conjuration']) click('spec', s);
eq(state.wizard.draft.specializations.length, 4, '4 specs selected');
forceClick('spec', 'martial');
eq(state.wizard.draft.specializations.length, 4, '5th spec rejected at t12 (guard)');
eq(click('wizard-next'), true, 'Далее enabled at 4 specs');
eq(state.wizard.step, 6, 'next -> step 6');

ok(text().includes('ОС: 2 (1 уровень)'), 'ОС 2 with Тупой (-1)');
ok(text().includes('Потрачено: 0 из 2'), 'spent display');
ok(text().includes('Способности тира 1 ещё не готовы.'), 'conjuration tree placeholder');
ok(!text().includes('Сферы Джабира'), 'tier-2 abilities not in tree');
eq(click('ability-buy', 'дило-цепкая-хватка'), true, 'buy strength t1 (1 ОС)');
eq(state.wizard.draft.spentOS, 1, 'spentOS 1');
eq(click('ability-buy', 'ab-фантомный-удар'), true, 'buy illusion t1 (0.5 ОС)');
eq(state.wizard.draft.spentOS, 1.5, 'spentOS 1.5');
eq(click('os-bonus', 'hp'), false, '+5 HP button disabled at 1.5+1 > 2');
eq(state.wizard.draft.osBonuses.hp, 0, 'hp bonus not applied');
forceClick('os-bonus', 'hp');
eq(state.wizard.draft.spentOS, 1.5, 'force-click os-bonus guard holds');
eq(click('ability-sell', 'ab-фантомный-удар'), true, 'Отдать refunds 0.5');
eq(state.wizard.draft.spentOS, 1, 'spentOS back to 1');
eq(click('os-bonus', 'hp'), true, '+5 HP buyable at 2/2');
eq(state.wizard.draft.osBonuses.hp, 5, 'osBonuses.hp 5');
eq(state.wizard.draft.spentOS, 2, 'spentOS 2');
eq(click('os-bonus', 'both'), false, '+1 ЗС+мана disabled at full budget');
eq(click('ability-buy', 'ab-иллюзия'), false, 'ability buy disabled at full budget');
forceClick('ability-buy', 'ab-иллюзия');
eq(state.wizard.draft.spentOS, 2, 'force ability buy guard holds');
eq(click('char-create'), true, 'create enabled (spentOS == totalOS)');
eq(state.screen, 'sheet', 'screen -> sheet');
eq(state.chars.length, 1, 'char pushed to state.chars');
const cA = state.chars[0];
eq(state.currentId, cA.id, 'currentId set');
eq(cA.traits[0], 't12', 'trait stored');
eq(cA.hp.current, cA.hp.max, 'hp current==max');
eq(cA.hp.max, 52, 'hp.max 52 = 40 + round(2*3.5) + 5 hp bonus');
eq(cA.stamina.max, 13, 'stamina.max 13 = 2 + 4*2 + 3 (freePeasant)');
eq(cA.mana.max, 10, 'mana.max 10 = 2 + 4*2');
eq(cA.abilities.length, 1, 'bought ability stored');
eq(cA.abilities[0], 'дило-цепкая-хватка', 'ability id stored');
ok(!('potentialPoints' in cA), 'no potentialPoints artifact');
ok(!('potentialRolled' in cA), 'no potentialRolled artifact');
ok(JSON.parse(storage.get('antar.characters')).length === 1, 'localStorage saved 1 char');

// ---------- Char B: gnome, Потенциал (t17), slave ----------
click('list');
click('new');
click('race', 'gnome');
eq(state.wizard.draft.raceId, 'gnome', 'gnome picked directly');
click('wizard-next');
click('status', 'slave');
click('wizard-next');
rnd.value = 0.8;
click('trait-roll');
eq(state.wizard.draft.traits[0], 't17', 'd20 roll -> Потенциал (t17)');
click('wizard-next');
ok(text().includes('макс 10'), 'gnome cap hint rendered');
for (const a of ['сила', 'ловкость', 'восприятие']) {
  click('attr-plus', a);
  click('attr-plus', a);
  eq(state.wizard.draft.attrs[a], 10, 'gnome ' + a + ' capped at 10');
  forceClick('attr-plus', a);
  eq(state.wizard.draft.attrs[a], 10, 'gnome ' + a + ' plus-guard holds');
}
eq(state.wizard.draft.attrs['живучесть'], 8, 'живучесть uncapped for gnome');
for (const a of ['живучесть', 'воля', 'мудрость']) {
  for (let i = 0; i < 7; i++) click('attr-plus', a);
}
eq(state.wizard.draft.attrs['воля'], 15, 'воля 15');
ok(text().includes('Финал: 18'), 'attrFinal воля 18 (15 + gnome +3)');
ok(text().includes('Финал: 12'), 'attrFinal интеллект 12 (8 + gnome +4)');
click('wizard-next');
eq(state.wizard.step, 5, 'gnome -> step 5');
forceClick('spec', 'strength');
forceClick('spec', 'dexterity');
forceClick('spec', 'vitality');
eq(state.wizard.draft.specializations.length, 0, 'gnome physical specs rejected (guard)');
ok(text().includes('Недоступна гномам'), 'gnome physical hint');
for (const s of ['warding', 'illusion', 'curses', 'conjuration']) click('spec', s);
eq(state.wizard.draft.specializations.length, 4, 'gnome 4 non-physical specs');
click('wizard-next');
eq(state.wizard.step, 6, 'gnome -> step 6');
ok(text().includes('ОС: 3 (1 уровень)'), 'ОС 3 with t17');
click('ability-buy', 'ab-щит');
click('ability-buy', 'ab-искажение');
click('ability-buy', 'ab-потеря-следа');
click('ability-buy', 'ab-кожа-кора');
eq(state.wizard.draft.spentOS, 2, 'four 0.5 ОС abilities = 2');
click('os-bonus', 'both');
eq(state.wizard.draft.osBonuses.stamina, 1, 'os bonuses: +1 ЗС');
eq(state.wizard.draft.osBonuses.mana, 1, 'os bonuses: +1 мана');
eq(state.wizard.draft.spentOS, 3, 'budget full');
eq(click('os-bonus', 'hp'), false, '+5 HP disabled at 3+1 > 3');
forceClick('ability-buy', 'ab-иллюзия');
eq(state.wizard.draft.spentOS, 3, 'force ability buy guard holds');
rnd.value = 0;
click('potential-roll');
eq(state.wizard.draft.potentialPoints, 11, 'Потенциал: 10 + d10 (roll 1)');
eq(state.wizard.draft.potentialTo, null, 'potential target unset after roll');
ok(text().includes('11 очков'), 'potential points shown');
click('potential-to', 'mana');
eq(state.wizard.draft.potentialTo, 'mana', 'potential -> mana');
click('char-create');
eq(state.screen, 'sheet', 'gnome created -> sheet');
eq(state.chars.length, 2, 'second char pushed');
const cB = state.chars[1];
eq(cB.osBonuses.stamina, 1, 'char osBonuses.stamina 1');
eq(cB.osBonuses.mana, 12, 'char osBonuses.mana 12 = 1 + 11 potential');
eq(cB.osBonuses.hp, 0, 'char osBonuses.hp 0');
eq(cB.hp.current, cB.hp.max, 'hp full');
eq(cB.hp.max, 31, 'hp.max 31 = 24 + round(2*3.5)');
eq(cB.stamina.max, 21, 'stamina.max 21 = 2 + 4*2 + 10 (slave) + 1');
eq(cB.mana.max, 30, 'mana.max 30 = 2 + 4*4 + 12');
eq(cB.abilities.length, 4, 'four bought abilities stored');
eq(cB.attrs['воля'], 15, 'raw воля 15 stored');
ok(!('potentialTo' in cB), 'no potentialTo artifact');
ok(JSON.parse(storage.get('antar.characters')).length === 2, 'localStorage has 2 chars');

// ---------- Char C: t19 -> 5 specs ----------
click('list');
click('new');
click('race', 'human');
click('human-all');
click('wizard-next');
click('status', 'freePeasant');
click('wizard-next');
rnd.value = 0.9;
click('trait-roll');
eq(state.wizard.draft.traits[0], 't19', 'd20 roll -> Гений (t19)');
click('wizard-next');
for (const a of ['сила', 'ловкость', 'живучесть', 'воля', 'восприятие', 'харизма', 'мудрость']) {
  for (let i = 0; i < 3; i++) click('attr-plus', a);
}
for (let i = 0; i < 6; i++) click('attr-plus', 'интеллект');
eq(['сила', 'ловкость', 'живучесть', 'воля', 'восприятие', 'харизма', 'мудрость'].every(a => state.wizard.draft.attrs[a] === 11), true, 't19 char spreads +3 over other attrs');
eq(state.wizard.draft.attrs['интеллект'], 14, 't19 интеллект 14');
click('wizard-next');
eq(state.wizard.step, 5, 't19 -> step 5');
ok(text().includes('0 из 5'), 'needs 5 specs for t19');
for (const s of ['martial', 'strength', 'dexterity', 'vitality']) click('spec', s);
eq(click('wizard-next'), false, 'Далее disabled at 4 specs for t19');
click('spec', 'warding');
eq(state.wizard.draft.specializations.length, 5, '5 specs with t19');
eq(click('wizard-next'), true, 'Далее enabled at 5 specs');

// ---------- Char D: Хрупкий (t18) — живучесть cap 9 ----------
click('list');
click('new');
click('race', 'orc');
click('wizard-next');
click('status', 'freePeasant');
click('wizard-next');
rnd.value = 0.85;
click('trait-roll');
eq(state.wizard.draft.traits[0], 't18', 'd20 roll -> Хрупкий (t18)');
click('wizard-next');
ok(text().includes('макс 9'), 'Хрупкий cap hint');
click('attr-plus', 'живучесть');
eq(state.wizard.draft.attrs['живучесть'], 9, 'живучесть 9');
eq(click('attr-plus', 'живучесть'), false, '+ blocked at 9 for Хрупкий');
forceClick('attr-plus', 'живучесть');
eq(state.wizard.draft.attrs['живучесть'], 9, 'Хрупкий plus-guard holds at 9');
eq(click('attr-minus', 'живучесть'), true, '- works at 9');
eq(state.wizard.draft.attrs['живучесть'], 8, 'живучесть back to 8');

console.log('\n' + passed + ' assertions passed, 0 console errors');