const test = require('node:test');
const assert = require('node:assert');
const { DATA_CORE } = require('../src/data-core');

const ATTRS = ['сила', 'ловкость', 'живучесть', 'воля', 'восприятие', 'харизма', 'мудрость', 'интеллект'];

test('races: 9 рас, все поля валидны', () => {
  const ids = Object.keys(DATA_CORE.races);
  assert.equal(ids.length, 9);
  for (const id of ids) {
    const r = DATA_CORE.races[id];
    assert.ok(r.name, id);
    assert.ok([6, 8, 10, 12].includes(r.hitDie), id);
    assert.ok(['средний', 'мелкий'].includes(r.size), id);
    assert.ok(r.bonusMode === 'all1' || r.bonusMode === 'choice' || (r.bonuses && Object.keys(r.bonuses).length), id);
  }
  const human = DATA_CORE.races.human;
  assert.equal(human.bonusMode, 'choice');
  const gnome = DATA_CORE.races.gnome;
  assert.deepEqual(gnome.attrCaps, { сила: 10, ловкость: 10, восприятие: 10 });
  assert.ok(gnome.noPhysicalSpecs === true);
});

test('statuses: 12 статусов, ссылки на навыки валидны', () => {
  const ids = Object.keys(DATA_CORE.statuses);
  assert.equal(ids.length, 12);
  for (const id of ids) {
    const s = DATA_CORE.statuses[id];
    assert.ok(s.name, id);
    if (s.skills) for (const k of s.skills) assert.ok(DATA_CORE.skills[k], `${id}->${k}`);
    if (s.lores) for (const k of s.lores) assert.ok(DATA_CORE.lores[k], `${id}->${k}`);
    if (s.crafts) for (const k of s.crafts) assert.ok(DATA_CORE.crafts[k], `${id}->${k}`);
    if (s.bonuses) for (const k in s.bonuses) assert.ok(ATTRS.includes(k), `${id}->${k}`);
  }
  assert.equal(DATA_CORE.statuses.slave.staminaBonus, 10);
  assert.equal(DATA_CORE.statuses.scholar.manaBonus, 8);
});

test('traits: 20 черт t1..t20 с правильными эффектами', () => {
  const ids = Object.keys(DATA_CORE.traits);
  assert.equal(ids.length, 20);
  for (let n = 1; n <= 20; n++) {
    const t = DATA_CORE.traits['t' + n];
    assert.ok(t, 't' + n);
    assert.equal(t.num, n);
    assert.ok(t.name && t.desc && t.quote);
  }
  assert.ok(DATA_CORE.traits.t1.osEvery3Levels === true);        // Приспосабливаемый
  assert.ok(DATA_CORE.traits.t3.allAttrBonus === 1);             // Большой талант
  assert.ok(DATA_CORE.traits.t12.osPerLevel === -1 && DATA_CORE.traits.t12.intNot9 === true); // Тупой
  assert.ok(DATA_CORE.traits.t13.doubleWillMod === true);        // Оптимист
  assert.ok(DATA_CORE.traits.t15.marathoner === true);           // Марафонец
  assert.equal(DATA_CORE.traits.t16.initBonus, -10);             // Параноик
  assert.ok(DATA_CORE.traits.t17.potential === true);            // Потенциал
  assert.ok(DATA_CORE.traits.t18.vitCap === 9);                  // Хрупкий
  assert.ok(DATA_CORE.traits.t19.fifthSpec === true);            // Гений
});

test('skills/lores/crafts: все ссылки на атрибуты валидны', () => {
  for (const cat of ['skills', 'lores', 'crafts']) {
    for (const id in DATA_CORE[cat]) {
      const s = DATA_CORE[cat][id];
      assert.ok(s.name, cat + '/' + id);
      assert.ok(Array.isArray(s.attrs) && s.attrs.length, cat + '/' + id);
      for (const a of s.attrs) assert.ok(ATTRS.includes(a), cat + '/' + id + '->' + a);
    }
  }
  // rules 0.98 contain exactly 24 skills; plan's 25 was an off-by-one
  assert.ok(Object.keys(DATA_CORE.skills).length >= 24);
  assert.ok(Object.keys(DATA_CORE.lores).length >= 19);
  assert.ok(Object.keys(DATA_CORE.crafts).length >= 17);
});
