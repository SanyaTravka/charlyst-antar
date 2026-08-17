const STORE = (function () {
  const calcMod = (typeof require === 'function') ? require('./calc') : null;
  const KEY = 'antar.characters';
  const VERSION = 1;

  function ls() {
    try { const t = 'test'; globalThis.localStorage.setItem(t, t); globalThis.localStorage.removeItem(t); return globalThis.localStorage; }
    catch (e) { return null; }
  }

  function load() {
    const storage = ls();
    if (!storage) return [];
    try {
      const raw = storage.getItem(KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr.map(normalize) : [];
    } catch (e) { return []; }
  }

  function save(chars) {
    const storage = ls();
    if (!storage) return false;
    try { storage.setItem(KEY, JSON.stringify(chars)); return true; }
    catch (e) { return false; }
  }

  function normalize(raw) {
    const d = (calcMod ? calcMod.CALC : CALC).defaults();
    if (!raw || typeof raw !== 'object') return d;
    const out = { ...d, ...raw };
    out.attrs = { ...d.attrs, ...(raw.attrs || {}) };
    out.hp = { ...d.hp, ...(raw.hp || {}) };
    out.stamina = { ...d.stamina, ...(raw.stamina || {}) };
    out.mana = { ...d.mana, ...(raw.mana || {}) };
    out.trained = { ...d.trained, ...(raw.trained || {}) };
    out.injuries = { ...d.injuries, ...(raw.injuries || {}) };
    out.deathSaves = { ...d.deathSaves, ...(raw.deathSaves || {}) };
    out.osBonuses = { ...d.osBonuses, ...(raw.osBonuses || {}) };
    out.weapons = Array.isArray(raw.weapons) ? raw.weapons : [];
    out.abilities = Array.isArray(raw.abilities) ? raw.abilities : [];
    out.customAbilities = Array.isArray(raw.customAbilities) ? raw.customAbilities : [];
    out.specializations = Array.isArray(raw.specializations) ? raw.specializations : [];
    out.inventory = Array.isArray(raw.inventory) ? raw.inventory : [];
    out.conditions = Array.isArray(raw.conditions) ? raw.conditions : [];
    out.version = VERSION;
    return out;
  }

  function exportJson(char) {
    return JSON.stringify(char, null, 2);
  }

  function parseImport(text) {
    try {
      const obj = JSON.parse(text);
      if (!obj || typeof obj !== 'object') return { ok: false, error: 'not object' };
      if (obj.version !== VERSION) return { ok: false, error: 'version mismatch' };
      if (typeof obj.name !== 'string' || !obj.name.trim()) return { ok: false, error: 'no name' };
      return { ok: true, char: normalize(obj) };
    } catch (e) { return { ok: false, error: 'parse error' }; }
  }

  function newId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  return { KEY, load, save, normalize, exportJson, parseImport, newId };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = { STORE };