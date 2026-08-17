const test = require('node:test');
const assert = require('node:assert');
const { DATA_MAGIC } = require('../src/data-magic');
const { DATA_CORE } = require('../src/data-core');

test('all spell abilities reference valid specs and tiers', () => {
  const specs = DATA_CORE.specializations || {};
  const ab = DATA_MAGIC.abilities;
  assert.ok(Object.keys(ab).length >= 60);
  for (const id in ab) {
    const a = ab[id];
    assert.ok(a.name, id);
    assert.ok(specs[a.specId], id + ' -> ' + a.specId);
    assert.ok([1, 2, 3, 4].includes(a.tier), id);
    assert.ok(['active', 'passive'].includes(a.type), id);
    assert.ok(a.desc && a.desc.length > 20, id);
    assert.ok(typeof a.cost === 'object' && (a.cost.mana || a.cost.stamina), id);
  }
});

test('key spells present', () => {
  const names = Object.values(DATA_MAGIC.abilities).map(a => a.name);
  for (const n of ['Огненная стрела', 'Огненный шар', 'Метеорит', 'Малое лечение ран', 'Великое исцеление', 'Полет', 'Высшая невидимость', 'Щит', 'Поле антимагии', 'Великое проклятие', 'Свечение', 'Перехват', 'Стронгхолд']) {
    assert.ok(names.includes(n), n);
  }
});

test('mech bonuses only from known kinds', () => {
  for (const id in DATA_MAGIC.abilities) {
    const a = DATA_MAGIC.abilities[id];
    if (a.mech && a.mech.attrBonus) {
      for (const k in a.mech.attrBonus) assert.ok(['сила', 'ловкость', 'живучесть'].includes(k), id);
    }
  }
});
