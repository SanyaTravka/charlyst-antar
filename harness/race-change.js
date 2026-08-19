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

function spend27() {
  for (const a of ['сила', 'ловкость', 'живучесть', 'воля', 'восприятие', 'харизма', 'мудрость', 'интеллект']) {
    for (let i = 0; i < 3; i++) click('attr-plus', a);
  }
  for (let i = 0; i < 3; i++) click('attr-plus', 'сила');
}

function newOrcToSpecs(somaticSpecId) {
  click('new');
  click('race', 'orc');
  click('wizard-next');
  click('status', 'freePeasant');
  click('wizard-next');
  rnd.value = 0.5;
  click('trait-roll');
  click('wizard-next');
  spend27();
  click('wizard-next');
  click('spec', somaticSpecId);
  click('spec', 'martial');
  click('spec', 'dexterity');
  click('spec', 'vitality');
}

function backToStep1() {
  for (let i = 0; i < 5; i++) click('wizard-back');
  eq(state.wizard.step, 1, 'back to step 1');
}

function forwardToStep5() {
  click('wizard-next');
  click('wizard-next');
  click('wizard-next');
  click('wizard-next');
  eq(state.wizard.step, 5, 'forward to step 5');
}

newOrcToSpecs('strength');
eq(state.wizard.draft.specializations.length, 4, 'orc took strength (somatic) + 3 more');
ok(state.wizard.draft.specializations.indexOf('strength') !== -1, 'strength among specs');
click('wizard-next');
eq(state.wizard.step, 6, 'orc at step 6');
click('ability-buy', 'дило-цепкая-хватка');
click('os-bonus', 'hp');
eq(state.wizard.draft.spentOS, 2, 'spentOS 2 = 1 ability + 1 bonus');
eq(state.wizard.draft.abilities.length, 1, '1 ability bought');
eq(state.wizard.draft.osBonuses.hp, 5, 'hp bonus 5');

backToStep1();
click('race', 'gnome');
eq(state.wizard.draft.raceId, 'gnome', 'gnome picked at step 1');
eq(state.wizard.draft.specializations.length, 0, 'specs cleared on race change');
eq(state.wizard.draft.abilities.length, 0, 'abilities cleared on race change');
eq(state.wizard.draft.spentOS, 0, 'spentOS cleared on race change');
eq(state.wizard.draft.osBonuses.hp, 0, 'osBonuses cleared on race change');
ok(text().toLowerCase().includes('сброшена'), 'reset toast shown');

forwardToStep5();
forceClick('spec', 'strength');
eq(state.wizard.draft.specializations.length, 0, 'gnome somatic guard holds after reset');
for (const s of ['warding', 'illusion', 'curses', 'conjuration']) click('spec', s);
eq(state.wizard.draft.specializations.length, 4, 'gnome took 4 acquired specs');
eq(click('wizard-next'), true, 'Далее enabled at 4 gnome specs');

backToStep1();
click('race', 'gnome');
eq(state.wizard.draft.specializations.length, 4, 'same race keeps picks');
forwardToStep5();
eq(state.wizard.draft.specializations.length, 4, 'picks preserved at step 5');

backToStep1();
click('race', 'human');
ok(text().includes('Люди: бонус к характеристикам'), 'human modal opened');
click('human-all');
eq(state.wizard.draft.raceId, 'human', 'human picked via modal');
eq(state.wizard.draft.specializations.length, 0, 'human via modal clears picks');
forwardToStep5();
forceClick('spec', 'strength');
eq(state.wizard.draft.specializations.length, 1, 'human may take somatic after reset');
for (const s of ['martial', 'dexterity', 'vitality']) click('spec', s);
eq(state.wizard.draft.specializations.length, 4, 'human at 4 specs');
eq(click('wizard-next'), true, 'human Далее enabled');

console.log('\n' + passed + ' assertions passed, 0 console errors');