const test = require('node:test');
const assert = require('node:assert');
const { CALC } = require('../src/calc');

const FIXTURE = {
  races: {
    human: { name: 'Люди', hitDie: 10, size: 'средний', bonusMode: 'choice' },
    dwarf: { name: 'Дварфы', hitDie: 12, size: 'средний', bonuses: { сила: 2, живучесть: 2, воля: 2 } },
    gnome: { name: 'Гномы', hitDie: 6, size: 'мелкий', bonuses: { интеллект: 4, мудрость: 3, воля: 3 }, attrCaps: { сила: 10, ловкость: 10, восприятие: 10 }, noPhysicalSpecs: true },
  },
  statuses: {
    slave: { name: 'Раб', staminaBonus: 10 },
    scholar: { name: 'Ученый', manaBonus: 8 },
  },
  traits: {
    bigTalent: { num: 3, name: 'Большой талант', allAttrBonus: 1 },
    adaptive: { num: 1, name: 'Приспосабливаемый', osEvery3Levels: true },
    adaptive2: { num: 2, name: 'Закалённый', osEvery3Levels: true },
    dumb: { num: 12, name: 'Тупой', osPerLevel: -1, intNot9: true },
    dumb2: { num: 13, name: 'Тупой II', osPerLevel: -1 },
    fragile: { num: 18, name: 'Хрупкий', vitCap: 9 },
    fragile2: { num: 19, name: 'Хрупкий II', vitCap: 12 },
    dreamer: { num: 20, name: 'Сквозняк', doubleWillMod: true },
    bigTalent2: { num: 21, name: 'Большой талант II', allAttrBonus: 1 },
  },
  osByLevel: { 1: 3, 2: 2, 3: 2, 4: 2, 5: 3, 6: 3, 7: 2, 8: 2, 9: 2, 10: 3, 11: 3, 12: 2, 13: 2, 14: 2, 15: 3 },
  abilities: {
    za: 'x',
  },
};
const DATA = {
  races: FIXTURE.races, statuses: FIXTURE.statuses, traits: FIXTURE.traits, osByLevel: FIXTURE.osByLevel,
  abilities: FIXTURE.abilities, specializations: [],
};

function baseChar(over = {}) {
  return { ...CALC.defaults(), ...over };
}

test('mod: floor((attr-10)/2)', () => {
  assert.equal(CALC.mod(18), 4);
  assert.equal(CALC.mod(10), 0);
  assert.equal(CALC.mod(9), -1);
  assert.equal(CALC.mod(7), -2);
});

test('tier by level', () => {
  assert.equal(CALC.tier(1), 1);
  assert.equal(CALC.tier(5), 1);
  assert.equal(CALC.tier(6), 2);
  assert.equal(CALC.tier(10), 2);
  assert.equal(CALC.tier(11), 3);
  assert.equal(CALC.tier(16), 4);
  assert.equal(CALC.tier(20), 4);
});

test('attrFinal: race bonuses and human choice', () => {
  const c = baseChar({ raceId: 'dwarf', attrs: { ...CALC.defaults().attrs, сила: 12 } });
  const f = CALC.attrFinal(c, DATA);
  assert.equal(f['сила'], 14);
  const h = baseChar({ raceId: 'human', humanBonusChoice: { a: 'сила', b: 'ловкость' }, attrs: { ...CALC.defaults().attrs, сила: 12, ловкость: 12 } });
  const fh = CALC.attrFinal(h, DATA);
  assert.equal(fh['сила'], 15);   // +3
  assert.equal(fh['ловкость'], 14); // +2
  assert.equal(fh['мудрость'], 8);  // нет бонуса
  const hall = baseChar({ raceId: 'human', humanBonusChoice: { all: true }, attrs: { ...CALC.defaults().attrs, сила: 12 } });
  const fhall = CALC.attrFinal(hall, DATA);
  assert.equal(fhall['сила'], 13); // +1 за всех
});

test('attrFinal: traits bigTalent and caps', () => {
  const c = baseChar({ raceId: 'gnome', traitId: 'bigTalent', attrs: { ...CALC.defaults().attrs, ловкость: 12, сила: 12 } });
  const f = CALC.attrFinal(c, DATA);
  assert.equal(f['ловкость'], 10); // гном cap 10
  const fr = baseChar({ raceId: 'dwarf', traitId: 'fragile', attrs: { ...CALC.defaults().attrs, живучесть: 14 } });
  assert.equal(CALC.attrFinal(fr, DATA)['живучесть'], 9); // хрупкий cap 9
});

test('maxHp formula at level 1', () => {
  const c = baseChar({ raceId: 'dwarf', attrs: { ...CALC.defaults().attrs, живучесть: 14 } }); // 14+2(дварф)=16, conMod 3
  assert.equal(CALC.maxHp(c, DATA), 4 * 12 + Math.round(3 * 3.5));
});

test('maxHp: level-up contribution and Закалка', () => {
  const c = baseChar({ raceId: 'dwarf', level: 3, attrs: { ...CALC.defaults().attrs, живучесть: 14 } });
  assert.equal(CALC.maxHp(c, DATA), 4 * 12 + Math.round(3 * 3.5) + (12 + 3) * 2);
  const h = baseChar({ raceId: 'dwarf', level: 3, abilities: ['дило-закалка'], attrs: { ...CALC.defaults().attrs, живучесть: 14 } });
  const HDATA = { ...DATA, allAbilities: { 'дило-закалка': { specId: 'vitality', mech: { conMult: 3 } } } };
  assert.equal(CALC.maxHp(h, HDATA), 4 * 12 + Math.round(3 * 3.5) + (12 + 3 * 3) * 2); // ×3 con mod
  const plain = baseChar({ raceId: 'dwarf', level: 3, abilities: ['дило-закалка'], attrs: { ...CALC.defaults().attrs, живучесть: 14 } });
  assert.equal(CALC.maxHp(plain, DATA), 4 * 12 + Math.round(3 * 3.5) + (12 + 3) * 2); // no allAbilities data -> no mult
});

test('conMult: mech-driven hp multiplier by any ability id', () => {
  const c = baseChar({ raceId: 'dwarf', level: 3, abilities: ['v-закалка'], attrs: { ...CALC.defaults().attrs, живучесть: 14 } });
  const HDATA = { ...DATA, allAbilities: { 'v-закалка': { specId: 'vitality', mech: { conMult: 3 } } } };
  assert.equal(CALC.conMult(c, HDATA), 3);
  assert.equal(CALC.conMult(c, DATA), 1);
  assert.equal(CALC.maxHp(c, HDATA), 4 * 12 + Math.round(3 * 3.5) + (12 + 3 * 3) * 2);
  const multi = baseChar({ raceId: 'dwarf', level: 3, abilities: ['v-закалка', 'd-закалка'], attrs: { ...CALC.defaults().attrs, живучесть: 14 } });
  const MDATA = { ...DATA, allAbilities: { 'v-закалка': { specId: 'vitality', mech: { conMult: 3 } }, 'd-закалка': { specId: 'vitality', mech: { conMult: 2 } } } };
  assert.equal(CALC.conMult(multi, MDATA), 6);
  assert.equal(CALC.maxHp(multi, MDATA), 4 * 12 + Math.round(3 * 3.5) + (12 + 3 * 6) * 2);
});

test('avgDie: floor(d/2)+1 for each die', () => {
  assert.equal(CALC.avgDie(6), 4);
  assert.equal(CALC.avgDie(8), 5);
  assert.equal(CALC.avgDie(10), 6);
  assert.equal(CALC.avgDie(12), 7);
});

test('maxHp: per-level hpLevels override the die', () => {
  const base = 4 * 12 + Math.round(3 * 3.5); // dwarf, con 16 → mod 3
  const avg = baseChar({ raceId: 'dwarf', level: 2, hpLevels: { 2: 5 }, attrs: { ...CALC.defaults().attrs, живучесть: 14 } });
  assert.equal(CALC.maxHp(avg, DATA), base + 5 + 3); // среднее d12 + conMod
  const mixed = baseChar({ raceId: 'dwarf', level: 3, hpLevels: { 2: 7, 3: 5 }, attrs: { ...CALC.defaults().attrs, живучесть: 14 } });
  assert.equal(CALC.maxHp(mixed, DATA), base + (7 + 3) + (5 + 3)); // бросок 7, среднее 5
  const none = baseChar({ raceId: 'dwarf', level: 2, attrs: { ...CALC.defaults().attrs, живучесть: 14 } });
  assert.equal(CALC.maxHp(none, DATA), base + 12 + 3); // нет записей → hitDie (старое поведение)
  const lvl1 = baseChar({ raceId: 'dwarf', level: 1, hpLevels: { 1: 5 }, attrs: { ...CALC.defaults().attrs, живучесть: 14 } });
  assert.equal(CALC.maxHp(lvl1, DATA), base); // запись уровня 1 игнорируется
});

test('maxStamina/maxMana with status and osBonuses', () => {
  const c = baseChar({ statusId: 'slave', attrs: { ...CALC.defaults().attrs, живучесть: 14 }, osBonuses: { stamina: 2, mana: 3, hp: 0 } });
  assert.equal(CALC.maxStamina(c, DATA), 2 + 4 * 2 + 10 + 2);
  const m = baseChar({ statusId: 'scholar', attrs: { ...CALC.defaults().attrs, воля: 16 } });
  assert.equal(CALC.maxMana(m, DATA), 2 + 4 * 3 + 8);
});

test('speed and ac', () => {
  const c = baseChar({ attrs: { ...CALC.defaults().attrs, ловкость: 16 } }); // dexMod 3, speed 4+1=5
  assert.equal(CALC.speed(c, DATA), 5);
  const a = baseChar({ armor: { id: 'medium', label: 'Средние' }, shield: { id: 'large', label: 'Средний', bonus: 2 } });
  assert.equal(CALC.ac(a, { ...DATA, armor: { medium: { name: 'Средние', ac: 18 } }, shield: { large: { name: 'Средний', bonus: 2 } } }), 20);
});

test('totalOS with adaptive and dumb traits', () => {
  const c1 = baseChar({ level: 6, traitId: 'adaptive' });
  assert.equal(CALC.totalOS(c1, DATA), (3 + 2 + 2 + 2 + 3 + 3) + 2); // 17 = Σ1..6 + 2 за 3-й и 6-й
  const c2 = baseChar({ level: 3, traitId: 'dumb' });
  assert.equal(CALC.totalOS(c2, DATA), (3 + 2 + 2) - 3);  // 4 = Σ1..3 − 3 за «Тупой»
  const c3 = baseChar({ level: 11 });
  assert.equal(CALC.totalOS(c3, DATA), 27);
  const c4 = baseChar({ level: 15 });
  assert.equal(CALC.totalOS(c4, DATA), 36);
  const c5 = baseChar({ level: 16 });
  assert.equal(CALC.totalOS(c5, DATA), 36);
  const c6 = baseChar({ level: 16, extraOS: 4 });
  assert.equal(CALC.totalOS(c6, DATA), 40);
});

test('traits: list from array, migrates legacy traitId, filters unknown', () => {
  const c = baseChar({ traits: ['adaptive', 'nope'] });
  const ts = CALC.traits(c, DATA);
  assert.equal(ts.length, 1);
  assert.equal(ts[0].name, 'Приспосабливаемый');
  const legacy = baseChar({ traitId: 'adaptive' });
  assert.equal(CALC.traits(legacy, DATA)[0].name, 'Приспосабливаемый');
  assert.deepEqual(CALC.traits(baseChar({}), DATA), []);
});

test('traits: osEvery3Levels adds per trait, osPerLevel sums', () => {
  const double = baseChar({ level: 6, traits: ['adaptive', 'adaptive2'] });
  assert.equal(CALC.totalOS(double, DATA), 15 + 2 * 2); // Σ1..6 + 2 за каждую черту
  const dumbSum = baseChar({ level: 3, traits: ['dumb', 'dumb2'] });
  assert.equal(CALC.totalOS(dumbSum, DATA), 7 - 6); // (3+2+2) − 3×2
  const mixed = baseChar({ level: 6, traits: ['adaptive', 'dumb'] });
  assert.equal(CALC.totalOS(mixed, DATA), 15 + 2 - 6);
});

test('traits: allAttrBonus summed, vitCap min, doubleWillMod any', () => {
  const talents = baseChar({ raceId: 'human', traits: ['bigTalent', 'bigTalent2'], attrs: { ...CALC.defaults().attrs, сила: 12 } });
  assert.equal(CALC.attrFinal(talents, DATA)['сила'], 14); // 12 + 1 + 1
  const fragile = baseChar({ raceId: 'dwarf', traits: ['fragile', 'fragile2'], attrs: { ...CALC.defaults().attrs, живучесть: 14 } });
  assert.equal(CALC.attrFinal(fragile, DATA)['живучесть'], 9); // min(9, 12)
  const opt = baseChar({ raceId: 'human', traits: ['dreamer'], attrs: { ...CALC.defaults().attrs, воля: 14 } });
  assert.equal(CALC.mods(opt, DATA)['воля'], 4); // doubleWillMod
});

test('ac: custom armor id uses stored ac value', () => {
  const D = { ...DATA, armor: { plate: { name: 'Латы', ac: 18 } } };
  const c = baseChar({ armor: { id: 'custom', label: 'Халат', ac: 13 } });
  assert.equal(CALC.ac(c, D), 13);
  const std = baseChar({ armor: { id: 'plate', label: 'Латы' } });
  assert.equal(CALC.ac(std, D), 18);
});

test('inventoryWeight: sums weight*qty, ignores legacy strings', () => {
  const c = baseChar({ inventory: [
    'Факел',
    { name: 'Веревка', desc: '', qty: 2, weight: 1.5 },
    { name: 'Лопата', desc: '', qty: 1, weight: 4 },
    { name: 'Пусто', desc: '', qty: 0, weight: 2 },
  ] });
  assert.equal(CALC.inventoryWeight(c), 7); // 0 + 3 + 4 + 0
  assert.equal(CALC.inventoryWeight(baseChar({})), 0);
});

test('abilityCost: телесные 1, приобретённые 0.5', () => {
  const D = {
    specializations: {
      'strength': { name: 'Сила', somatic: true },
      'manifestation': { name: 'Проявление', somatic: false },
    },
    allAbilities: {
      'a-strength': { specId: 'strength' },
      'a-manifest': { specId: 'manifestation' },
    },
  };
  assert.equal(CALC.abilityCost(D, 'a-strength'), 1);
  assert.equal(CALC.abilityCost(D, 'a-manifest'), 0.5);
});

test('defaults: complete character model', () => {
  const d = CALC.defaults();
  assert.equal(d.version, 1);
  assert.equal(d.level, 1);
  assert.equal(d.spentOS, 0);
  assert.ok(Array.isArray(d.weapons));
  assert.deepEqual(d.injuries, { head: false, arms: false, torso: false, legs: false });
  assert.deepEqual(d.hpLevels, {});
});

test('parseDamage: melee NdM + мод.Силы', () => {
  assert.deepEqual(CALC.parseDamage('2d4+мод.Силы колющего или рубящего'), { dice: 2, sides: 4, flat: 0, mod: true });
  assert.deepEqual(CALC.parseDamage('2d8+мод.Силы колющего'), { dice: 2, sides: 8, flat: 0, mod: true });
});

test('parseDamage: case-insensitive Мод.Силы', () => {
  assert.equal(CALC.parseDamage('2d8+Мод.Силы дробящего или колющего').mod, true);
});

test('parseDamage: crossbow flat + NdM without mod', () => {
  assert.deepEqual(CALC.parseDamage('10+2d10 колющего'), { dice: 2, sides: 10, flat: 10, mod: false });
  assert.deepEqual(CALC.parseDamage('15+2d12 колющего'), { dice: 2, sides: 12, flat: 15, mod: false });
});

test('parseDamage: bare NdM', () => {
  assert.deepEqual(CALC.parseDamage('1d6'), { dice: 1, sides: 6, flat: 0, mod: false });
});

test('parseDamage: unparseable returns null', () => {
  assert.equal(CALC.parseDamage('особый урон'), null);
  assert.equal(CALC.parseDamage(''), null);
  assert.equal(CALC.parseDamage(null), null);
});