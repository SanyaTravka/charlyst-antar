const test = require('node:test');
const assert = require('node:assert');
const { STORE } = require('../src/store');
const { CALC } = require('../src/calc');

function makeLocalStorage() {
  const m = new Map();
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: k => m.delete(k),
    _map: m,
  };
}

test('save/load roundtrip', () => {
  globalThis.localStorage = makeLocalStorage();
  const c = { ...CALC.defaults(), id: 'x1', name: 'Тест' };
  assert.ok(STORE.save([c]));
  const loaded = STORE.load();
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].name, 'Тест');
});

test('load returns [] on empty or corrupt storage', () => {
  const ls = makeLocalStorage();
  globalThis.localStorage = ls;
  assert.deepEqual(STORE.load(), []);
  ls.setItem(STORE.KEY, 'not json {{{');
  assert.deepEqual(STORE.load(), []);
});

test('save returns false on quota error, does not throw', () => {
  globalThis.localStorage = {
    getItem: () => null,
    setItem: () => { throw new Error('QuotaExceededError'); },
  };
  assert.equal(STORE.save([CALC.defaults()]), false);
});

test('normalize fills defaults for missing fields', () => {
  const n = STORE.normalize({ id: 'a', name: 'Битый' });
  assert.equal(n.version, 1);
  assert.equal(n.level, 1);
  assert.equal(n.spentOS, 0);
  assert.equal(n.name, 'Битый');
  assert.ok(Array.isArray(n.weapons));
  assert.deepEqual(n.deathSaves, { success: 0, fail: 0 });
});

test('parseImport validates version and required fields', () => {
  globalThis.localStorage = makeLocalStorage();
  const c = { ...CALC.defaults(), id: 'z', name: 'Ок' };
  const good = STORE.parseImport(JSON.stringify(c));
  assert.equal(good.ok, true);
  assert.equal(good.char.name, 'Ок');
  const bad1 = STORE.parseImport('garbage');
  assert.equal(bad1.ok, false);
  const bad2 = STORE.parseImport(JSON.stringify({ version: 99, name: 'Старый' }));
  assert.equal(bad2.ok, false);
  const bad3 = STORE.parseImport(JSON.stringify({ version: 1 }));
  assert.equal(bad3.ok, false);
});

test('exportJson contains version and name', () => {
  const c = { ...CALC.defaults(), name: 'Герой' };
  const s = STORE.exportJson(c);
  assert.ok(s.includes('"version": 1'));
  assert.ok(s.includes('Герой'));
});