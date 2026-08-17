const test = require('node:test');
const assert = require('node:assert');
const { DATA_PHYSICAL } = require('../src/data-physical');

test('physical abilities: valid structure and count', () => {
  const ab = DATA_PHYSICAL.abilities;
  assert.ok(Object.keys(ab).length >= 40);
  for (const id in ab) {
    const a = ab[id];
    assert.ok(a.name, id);
    assert.ok(['martial', 'dexterity', 'vitality', 'strength'].includes(a.specId), id);
    assert.ok([1, 2, 3, 4].includes(a.tier), id);
    assert.ok(['active', 'passive'].includes(a.type), id);
    assert.ok(a.desc && a.desc.length > 10, id);
    if (a.cost) assert.ok(a.cost.mana || a.cost.stamina, id);
  }
});

test('key abilities present', () => {
  const names = Object.values(DATA_PHYSICAL.abilities).map(a => a.name);
  for (const n of ['Адреналин', 'Мифическая ловкость', 'Закалка', 'Мифическая живучесть', 'Мифический атлетизм', 'Мастер оружия', 'Несгибаемый']) {
    assert.ok(names.includes(n), n);
  }
});

test('mech: attrBonus and conMult established', () => {
  const ab = DATA_PHYSICAL.abilities;
  assert.deepEqual(ab['дило-мифическая-ловкость'].mech, { attrBonus: { ловкость: 2 } });
  assert.deepEqual(ab['дило-мифическая-живучесть'].mech, { attrBonus: { живучесть: 2 } });
  assert.deepEqual(ab['дило-мифический-атлетизм'].mech, { attrBonus: { сила: 2 } });
  assert.deepEqual(ab['дило-закалка'].mech, { conMult: 3 });
});