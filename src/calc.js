const CALC = (function () {
  const ATTRS = ['сила', 'ловкость', 'живучесть', 'воля', 'восприятие', 'харизма', 'мудрость', 'интеллект'];

  function mod(attr) { return Math.floor((attr - 10) / 2); }

  function defaults() {
    const attrs = {}; ATTRS.forEach(a => attrs[a] = 8);
    return {
      version: 1, id: '', name: '', raceId: null, statusId: null, traitId: null, traits: [], traitRolled: false,
      level: 1, attrs,
      hp: { current: 0, max: 0 }, stamina: { current: 0, max: 0 }, mana: { current: 0, max: 0 },
      trained: { skills: {}, lores: {}, crafts: {} },
      specializations: [], abilities: [], customAbilities: [],
      weapons: [], armor: null, shield: null, inventory: [],
      conditions: [], injuries: { head: false, arms: false, torso: false, legs: false },
      exhaustion: 0, deathSaves: { success: 0, fail: 0 }, inspiration: 0,
      spentOS: 0, osBonuses: { stamina: 0, mana: 0, hp: 0 },
      hpLevels: {},
      masteryBonus: 0,
      notes: '', createdAt: 0, updatedAt: 0, humanBonusChoice: null,
    };
  }

  function race(char, DATA) { return DATA.races[char.raceId] || null; }
  function status(char, DATA) { return DATA.statuses[char.statusId] || null; }
  function traitIds(char) {
    if (Array.isArray(char.traits) && char.traits.length) return char.traits;
    return char.traitId ? [char.traitId] : [];
  }

  function traits(char, DATA) {
    return traitIds(char).map(id => DATA.traits[id] || null).filter(Boolean);
  }

  function hasTrait(char, DATA, id) {
    return traitIds(char).indexOf(id) !== -1;
  }

  function sumOs(level, DATA) {
    let s = 0;
    for (let l = 1; l <= Math.min(level, 15); l++) s += DATA.osByLevel[l] || 0;
    return s;
  }

  function totalOS(char, DATA) {
    let s = sumOs(char.level, DATA);
    for (const t of traits(char, DATA)) {
      if (t.osEvery3Levels) s += Math.floor(char.level / 3);
      if (t.osPerLevel) s += t.osPerLevel * char.level;
    }
    s += char.extraOS || 0;
    return s;
  }

  function tier(level) { return Math.min(4, Math.ceil(level / 5)); }

  function attrFinal(char, DATA) {
    const out = {};
    ATTRS.forEach(a => out[a] = char.attrs[a]);
    const r = race(char, DATA);
    if (r) {
      if (char.humanBonusChoice && r.bonusMode === 'choice') {
        if (char.humanBonusChoice.all) ATTRS.forEach(a => out[a] += 1);
        else { out[char.humanBonusChoice.a] += 3; out[char.humanBonusChoice.b] += 2; }
      } else if (r.bonusMode === 'all1') {
        ATTRS.forEach(a => out[a] += 1);
      } else if (r.bonuses) {
        for (const k in r.bonuses) out[k] += r.bonuses[k];
      }
    }
    const st = status(char, DATA);
    if (st && st.bonuses) for (const k in st.bonuses) out[k] += st.bonuses[k];
    let allBonus = 0;
    let vitCapMin = Infinity;
    for (const t of traits(char, DATA)) {
      if (t.allAttrBonus) allBonus += t.allAttrBonus;
      if (t.vitCap) vitCapMin = Math.min(vitCapMin, t.vitCap);
    }
    if (allBonus) ATTRS.forEach(a => out[a] += allBonus);
    if (vitCapMin !== Infinity) out['живучесть'] = Math.min(out['живучесть'], vitCapMin);
    if (DATA.allAbilities) {
      for (const id of char.abilities) {
        const ab = DATA.allAbilities[id];
        if (ab && ab.mech && ab.mech.attrBonus) for (const k in ab.mech.attrBonus) out[k] += ab.mech.attrBonus[k];
      }
    }
    if (r && r.attrCaps) for (const k in r.attrCaps) out[k] = Math.min(out[k], r.attrCaps[k]);
    return out;
  }

  function mods(char, DATA) {
    const f = attrFinal(char, DATA);
    const m = {};
    ATTRS.forEach(a => m[a] = mod(f[a]));
const t = traits(char, DATA);
    if (t.some(x => x.doubleWillMod)) { m['воля'] *= 2; } // «Оптимист» — воля к защите удваивается
    return m;
  }

  function hasAbility(char, DATA, id) { return char.abilities.indexOf(id) !== -1; }

  function conMult(char, DATA) {
    let m = 1;
    if (DATA.allAbilities) for (const id of char.abilities) {
      const ab = DATA.allAbilities[id];
      if (ab && ab.mech && ab.mech.conMult) m *= ab.mech.conMult;
    }
    return m;
  }

  function avgDie(d) { return Math.floor(d / 2) + 1; }

  function maxHp(char, DATA) {
    const r = race(char, DATA);
    if (!r) return char.hp.max || 0;
    const conMod = mods(char, DATA)['живучесть'];
    let total = 4 * r.hitDie + Math.round(conMod * 3.5);
    const cm = conMult(char, DATA);
    for (let l = 2; l <= char.level; l++) {
      const die = char.hpLevels && char.hpLevels[l] != null ? char.hpLevels[l] : r.hitDie;
      total += die + conMod * cm;
    }
    total += char.osBonuses.hp;
    return total;
  }

  function maxStamina(char, DATA) {
    const conMod = mods(char, DATA)['живучесть'];
    const st = status(char, DATA);
    return 2 + 4 * conMod + (st && st.staminaBonus ? st.staminaBonus : 0) + char.osBonuses.stamina;
  }

  function maxMana(char, DATA) {
    const wilMod = mods(char, DATA)['воля'];
    const st = status(char, DATA);
    return 2 + 4 * wilMod + (st && st.manaBonus ? st.manaBonus : 0) + char.osBonuses.mana;
  }

  function speed(char, DATA) {
    const dexMod = mods(char, DATA)['ловкость'];
    let s = 4 + Math.floor(dexMod / 2);
    if (DATA.allAbilities) for (const id of char.abilities) {
      const ab = DATA.allAbilities[id];
      if (ab && ab.mech && ab.mech.speedBonus) s += ab.mech.speedBonus;
    }
    return s;
  }

  function ac(char, DATA) {
    let a = 10;
    if (char.armor && char.armor.id) {
      if (char.armor.id === 'custom') a = char.armor.ac;
      else if (DATA.armor && DATA.armor[char.armor.id]) a = DATA.armor[char.armor.id].ac;
    }
    if (char.shield && char.shield.id) {
      if (char.shield.id === 'custom') a += Math.max(0, parseInt(char.shield.bonus, 10) || 0);
      else if (DATA.shield && DATA.shield[char.shield.id]) a += DATA.shield[char.shield.id].bonus;
    }
    if (DATA.allAbilities) for (const id of char.abilities) {
      const ab = DATA.allAbilities[id];
      if (ab && ab.mech && ab.mech.acBonus) a += ab.mech.acBonus;
    }
    return a;
  }

  function abilityCost(DATA, abilityId) {
    const ab = DATA.allAbilities && DATA.allAbilities[abilityId];
    if (!ab) return 1;
    const spec = DATA.specializations[ab.specId];
    if (spec && spec.somatic) return 1;
    return 0.5;
  }

  function inventoryWeight(char) {
    const inv = Array.isArray(char.inventory) ? char.inventory : [];
    let w = 0;
    for (const it of inv) {
      if (!it || typeof it !== 'object') continue;
      const weight = parseFloat(it.weight);
      const qty = parseInt(it.qty, 10);
      w += Math.max(0, weight || 0) * Math.max(0, qty || 0);
    }
    return w;
  }

  function parseDamage(s) {
    const str = String(s == null ? '' : s);
    const re = /(\d+)\s*[dд]\s*(\d+)/gi;
    const groups = [];
    let m;
    while ((m = re.exec(str)) !== null) {
      const dice = parseInt(m[1], 10);
      const sides = parseInt(m[2], 10);
      if (dice >= 1 && sides >= 1) groups.push({ dice, sides });
    }
    if (!groups.length) return null;
    const rest = str.replace(/(\d+)\s*[dд]\s*(\d+)/gi, ' ');
    let flat = 0;
    const nums = rest.match(/-?\d+/g) || [];
    for (const t of nums) flat += parseInt(t, 10);
    return { groups, flat, mod: /мод\.?\s*силы/i.test(str) };
  }

  return { ATTRS, mod, defaults, race, status, traitIds, traits, hasTrait, sumOs, totalOS, tier, attrFinal, mods, maxHp, maxStamina, maxMana, speed, ac, abilityCost, conMult, avgDie, inventoryWeight, parseDamage };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = { CALC };