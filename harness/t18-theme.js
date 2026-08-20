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

function evaluate(stored, themeAttr) {
  const docBody = makeEl();
  docBody.setAttribute = function (n, v) { themeAttr[n] = v; };
  docBody.removeAttribute = function (n) { delete themeAttr[n]; };
  const documentStub = {
    getElementById(id) { return id === 'app' ? appEl : null; },
    createElement(tag) { return tag === 'template' ? templateEl : makeEl(); },
    createTextNode(t) { return { text: t }; },
    body: docBody,
  };
  const app2 = makeEl();
  const documentStub2 = {
    getElementById(id) { return id === 'app' ? app2 : null; },
    createElement(tag) { return tag === 'template' ? templateEl : makeEl(); },
    createTextNode(t) { return { text: t }; },
    body: docBody,
  };
  const sandbox = {
    document: documentStub2,
    window: {},
    localStorage: {
      getItem: (k) => (k in stored ? stored[k] : null),
      setItem: (k, v) => { stored[k] = String(v); },
      removeItem: (k) => { delete stored[k]; },
    },
    confirm: () => true,
    Blob: function () {},
    URL: { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} },
    FileReader: function () { this.readAsText = () => {}; },
    setTimeout: (fn) => 0,
    console: { log: () => {}, error: () => {} },
    Math: Object.create(Math),
    Date, JSON, Object, Array, String, Number,
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(script, sandbox, { filename: 'antar-sheet.html' });
  return { APP: sandbox.window.APP, appEl: app2 };
}

const themeAttr = {};
const stored = {};
const first = evaluate(stored, themeAttr);
const APP = first.APP;
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
  return first.appEl.children.map(flat).join('');
}

function click(action, id, extra) {
  const node = Object.assign(makeEl(), extra || {});
  node.getAttribute = function (n) { return n === 'data-action' ? action : n === 'data-id' ? id : n === 'data-index' ? (extra && extra._index) || '' : null; };
  node.closest = function (sel) { return (extra && extra._closestFor && extra._closestFor(sel)) || node; };
  first.appEl.onclick({ target: node });
  return node;
}

let m = markup();
ok(m.includes('Тёмная тема'), 'toggle button label in light mode');
ok(!themeAttr['data-theme'], 'no dark attribute by default');

click('theme-toggle');
ok(stored['antar-theme'] === 'dark', 'theme persisted to localStorage');
ok(themeAttr['data-theme'] === 'dark', 'dark attribute applied');
m = markup();
ok(m.includes('Светлая тема'), 'toggle button label in dark mode');

click('theme-toggle');
ok(stored['antar-theme'] === 'light', 'theme returns to light');
ok(!themeAttr['data-theme'], 'dark attribute removed');
m = markup();
ok(m.includes('Тёмная тема'), 'toggle button label back to light');

stored['antar-theme'] = 'dark';
evaluate(stored, themeAttr);
ok(themeAttr['data-theme'] === 'dark', 'dark theme restored on reload from localStorage');

console.log(checks + ' checks, ' + fails + ' failures');
if (fails) process.exit(1);
console.log('THEME HARNESS OK');