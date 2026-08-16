# Интерактивный чарлист «Антар» — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Один самодостаточный HTML-файл `antar-sheet.html` — интерактивный чарлист для НРИ «Антар» 0.98 с мастером создания, авто-расчётами, боевым трекером, левел-апом и сохранением в localStorage + JSON.

**Architecture:** Исходники в `src/` (данные правил, чистые функции расчёта, хранилище, UI). Тесты на `node:test` (встроенный в Node 22) покрывают чистую логику. `build.js` (без зависимостей) склеивает исходники в один HTML — единственный артефакт, открывающийся через `file://`.

**Tech Stack:** Vanilla JS (ES2017), CSS, HTML. Node 22 только для тестов и сборки. Никаких внешних библиотек и CDN — приложение обязано работать офлайн.

## Global Constraints

- Финальный артефакт — один файл `antar-sheet.html`, работает при открытии двойным кликом (`file://`), без сети
- UI полностью на русском; пергаментная/ретро тема
- Никаких зависимостей, сборщиков, фреймворков; `build.js` — только конкатенация
- Схема чарника `version: 1`; экспорт: `<имя>.antar.json`
- localStorage ключ `antar.characters`
- Источник правил: `docs/antar-rules-0.98.txt` (извлекается из `Антар-правила 0.98.docx` в Task 1)
- Способность тира N покупается только при тире персонажа ≥ N (тир = ceil(level/5))
- Телесные специализации (Сила, Ловкость, Живучесть): 1 ОС за 1 способность; приобретённые: 1 ОС за 2 способности (бухгалтерия в долях 0.5 ОС)
- ОС за уровни (правила): 1:3, 2:2, 3:2, 4:2, 5:3, 6:3, 7:2, 8:2, 9:2, 10:3; 11+ — «ждём редакций» (вручную)
- Механики черт применяются автоматически (таблица в спеке); остальные черты — карточки-напоминания
- `mod(attr) = Math.floor((attr - 10) / 2)`
- Проверки: `npm test` (node --test test/); UI-задачи проверяются вручную в браузере по шагам задачи

---

### Task 1: Скаффолд проекта и извлечение текста правил

**Files:**
- Create: `package.json`
- Create: `docs/antar-rules-0.98.txt` (сгенерировано)
- Create: `build.js`
- Create: `src/style.css`
- Create: `src/calc.js`, `src/data-core.js`, `src/data-magic.js`, `src/data-physical.js`, `src/store.js`, `src/app.js` (каркасы, см. ниже)
- Create: `antar-sheet.html` (сгенерировано)
- Create: `test/smoke.test.js`

**Interfaces:**
- Consumes: ничего
- Produces: файловая структура; `build.js` — команда `node build.js` из корня проекта, создаёт `antar-sheet.html`; правило UMD-экспорта для всех `src/*.js`: `if (typeof module !== 'undefined' && module.exports) module.exports = {ИМЯ};` — в браузере (склейка) имена доступны как глобальные `const` в общем скрипте

- [ ] **Step 1: Извлечь текст правил из docx**

Run (PowerShell, из каталога проекта):
```powershell
$src = (Get-ChildItem -Filter *.docx | Select-Object -First 1).FullName
$dest = "C:\Users\Alex\AppData\Local\Temp\opencode\antar_docx_extract"
if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::ExtractToDirectory($src, $dest)
$xml = [xml](Get-Content "$dest\word\document.xml" -Encoding UTF8)
$ns = New-Object System.Xml.XmlNamespaceManager($xml.NameTable)
$ns.AddNamespace("w", "http://schemas.openxmlformats.org/wordprocessingml/2006/main")
$sb = New-Object System.Text.StringBuilder
foreach ($p in $xml.SelectNodes("//w:p", $ns)) {
  $line = ($p.SelectNodes(".//w:t", $ns) | ForEach-Object { $_.InnerText }) -join ""
  [void]$sb.AppendLine($line)
}
[System.IO.File]::WriteAllText("docs\antar-rules-0.98.txt", $sb.ToString(), [System.Text.Encoding]::UTF8)
```
Expected: файл `docs/antar-rules-0.98.txt` создан, ≥2900 строк (проверить `(Get-Content docs\antar-rules-0.98.txt).Count`).

- [ ] **Step 2: Создать package.json**

```json
{
  "name": "antar-sheet",
  "private": true,
  "version": "0.1.0",
  "scripts": {
    "build": "node build.js",
    "test": "node --test test/"
  }
}
```

- [ ] **Step 3: Создать build.js**

```js
const fs = require('fs');
const path = require('path');

const files = [
  ['src/style.css', '/*__STYLE__*/'],
  ['src/data-core.js', '/*__DATA_CORE__*/'],
  ['src/data-magic.js', '/*__DATA_MAGIC__*/'],
  ['src/data-physical.js', '/*__DATA_PHYSICAL__*/'],
  ['src/calc.js', '/*__CALC__*/'],
  ['src/store.js', '/*__STORE__*/'],
  ['src/app.js', '/*__APP__*/'],
];

const template = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Чарлист Антар</title>
<style>
/*__STYLE__*/
</style>
</head>
<body>
<div id="app"></div>
<script>
/*__DATA_CORE__*/

/*__DATA_MAGIC__*/

/*__DATA_PHYSICAL__*/

/*__CALC__*/

/*__STORE__*/

/*__APP__*/
</script>
</body>
</html>
`;

let out = template;
for (const [file, marker] of files) {
  const content = fs.readFileSync(path.join(__dirname, file), 'utf8');
  out = out.replace(marker, content);
}
fs.writeFileSync(path.join(__dirname, 'antar-sheet.html'), out);
console.log('Built antar-sheet.html');
```

- [ ] **Step 4: Написать падающий тест smoke**

`test/smoke.test.js`:
```js
const test = require('node:test');
const assert = require('node:assert');

test('build produces antar-sheet.html containing app mount', () => {
  const html = require('fs').readFileSync(require('path').join(__dirname, '..', 'antar-sheet.html'), 'utf8');
  assert.ok(html.includes('<div id="app"></div>'));
  assert.ok(html.includes('window.APP'));
});
```

- [ ] **Step 5: Каркасы src-файлов (минимальный валидный код)**

`src/calc.js`:
```js
const CALC = { mod: (attr) => Math.floor((attr - 10) / 2) };
if (typeof module !== 'undefined' && module.exports) module.exports = { CALC };
```
`src/data-core.js`:
```js
const DATA_CORE = { races: [], statuses: [], traits: [], skills: [], lores: [], crafts: [], weapons: [], armor: [], shield: [], conditions: [], injuries: [], exhaustion: [], osByLevel: { 1: 3 }, tiers: [] };
if (typeof module !== 'undefined' && module.exports) module.exports = { DATA_CORE };
```
`src/data-magic.js`:
```js
const DATA_MAGIC = { abilities: [] };
if (typeof module !== 'undefined' && module.exports) module.exports = { DATA_MAGIC };
```
`src/data-physical.js`:
```js
const DATA_PHYSICAL = { abilities: [] };
if (typeof module !== 'undefined' && module.exports) module.exports = { DATA_PHYSICAL };
```
`src/store.js`:
```js
const STORE = {};
if (typeof module !== 'undefined' && module.exports) module.exports = { STORE };
```
`src/app.js` (только метка для сборки, UI-логика появится с Task 8):
```js
window.APP = { version: '0.1.0' };
```
`src/style.css`: только CSS-переменные темы (пергамент) — фон `#e8dcc0`, тёмный текст `#2c2418`, акцент `#7a4a1d`, карточки `#f5ecd8`.

- [ ] **Step 6: Собрать и прогнать тесты**

Run: `node build.js; npm test`
Expected: `Built antar-sheet.html` в консоли; `node --test` — 1 pass (smoke), 0 fail. Если `antar-sheet.html` не собран — тест падает с "ENOENT" (сначала нужно собрать один раз).

- [ ] **Step 7: Проверить в браузере**

Открыть `antar-sheet.html` двойным кликом, F12 → Console: 0 ошибок, страница пустая (рендера ещё нет). Также сверить сгенерированный файл: содержит CSS и все склейки без `/*__...__*/`-маркеров (проверить grep'ом по файлу).

- [ ] **Step 8: Commit**

```bash
git add package.json build.js src docs/antar-rules-0.98.txt test/smoke.test.js antar-sheet.html
git commit -m "chore: scaffold antar-sheet single-file app with build and rules text"
```

---

### Task 2: calc.js — чистые функции авто-расчёта

**Files:**
- Create: `test/calc.test.js`
- Modify: `src/calc.js`

**Interfaces:**
- Consumes: `DATA_CORE` (структура каталогов из Task 3–4 — до заполнения тесты используют минимальную фикстуру)
- Produces:
  - `CALC.mod(attr) -> integer`
  - `CALC.attrFinal(char, DATA) -> {сила,...,интеллект}` — базовые атрибуты + бонусы расы/статуса/черты/способностей (`mech.attrBonus`)
  - `CALC.mods(char, DATA) -> {сила: mod,...}` — модификаторы от attrFinal
  - `CALC.maxHp(char, DATA) -> integer`
  - `CALC.maxStamina(char, DATA) -> integer`
  - `CALC.maxMana(char, DATA) -> integer`
  - `CALC.speed(char, DATA) -> integer`
  - `CALC.ac(char, DATA) -> integer`
  - `CALC.totalOS(char, DATA) -> integer` (с чертами «Приспосабливаемый»/«Тупой»)
  - `CALC.tier(level) -> 1|2|3|4`
  - `CALC.abilityCost(data, abilityId) -> 0.5|1` (по типу специализации: телесные 1, приобретённые 0.5)
  - `CALC.charAttrNames()` — список 8 атрибутов в порядке: сила, ловкость, живучесть, воля, восприятие, харизма, мудрость, интеллект
  - `CALC.defaults() -> Character` — полная модель чарника с дефолтами (см. спеку, все поля)

**Формулы (из спеки):**
- maxHp = `4×hitDie + round(conMod × 3.5)` + за каждый уровень > 0: `hitDie + conMod` (×3 при способности «Закалка» `mech.conMult:3`) + `osBonuses.hp`
- maxStamina = `2 + 4×conMod` + бонус статуса (поле `staminaBonus` статуса, напр. раб +10) + `osBonuses.stamina`
- maxMana = `2 + 4×wilMod` + бонус статуса (`manaBonus`, напр. учёный +8) + `osBonuses.mana`
- speed = `4 + Math.floor(деxMod / 2)` + бонусы способностей (`mech.speedBonus`, напр. «Резкий» +40 футов → в клетках: +8)
- ac = armor.baseAC + shield.bonus + `mech.acBonus` (напр. «Непрошибаемое строение» +3)
- totalOS = `Σ osByLevel[1..level]` + («Приспосабливаемый») `floor(level/3)` − («Тупой») `level`; для level > 10 вклад берётся из `osByLevel` как 0 (11+ заполняется вручную в левел-апе)
- tier = `Math.min(4, Math.ceil(level / 5))`
- abilityCost: телесные (Сила, Ловкость, Живучесть) = 1; прочие = 0.5
- `attrFinal`: attr + бонусы расы (`race.bonuses[attr]` или профиль выбора для людей) + статус (`status.bonuses[attr]`) + черта «Большой талант» (+1 всем) + способности с `mech.attrBonus[attr]`
- «Гномы» ограничение: attrFinal Ловкость/Сила/Восприятие ≤ 10 (cap). «Хрупкий»: Живучесть ≤ 9 (cap). Это тоже в `attrFinal`.

`Character` дефолты (порядок полей из спеки):
```js
{
  version: 1, id: '', name: '', raceId: null, statusId: null, traitId: null, traitRolled: false,
  level: 1,
  attrs: { сила: 8, ловкость: 8, живучесть: 8, воля: 8, восприятие: 8, харизма: 8, мудрость: 8, интеллект: 8 },
  hp: { current: 0, max: 0 }, stamina: { current: 0, max: 0 }, mana: { current: 0, max: 0 },
  trained: { skills: {}, lores: {}, crafts: {} },
  specializations: [], abilities: [], customAbilities: [],
  weapons: [], armor: null, shield: null, inventory: [],
  conditions: [], injuries: { head: false, arms: false, torso: false, legs: false },
  exhaustion: 0, deathSaves: { success: 0, fail: 0 }, inspiration: 0,
  spentOS: 0, osBonuses: { stamina: 0, mana: 0, hp: 0 },
  masteryBonus: 0,
  notes: '', createdAt: 0, updatedAt: 0, humanBonusChoice: null
}
```

- [ ] **Step 1: Написать падающие тесты**

`test/calc.test.js` (полный файл):
```js
const test = require('node:test');
const assert = require('node:assert');
const { CALC } = require('../src/calc');

const FIXTURE = {
  races: {
    human: { name: 'Люди', hitDie: 10, size: 'средний', bonusMode: 'all1' },
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
    dumb: { num: 12, name: 'Тупой', osPerLevel: -1, intNot9: true },
    fragile: { num: 18, name: 'Хрупкий', vitCap: 9 },
  },
  osByLevel: { 1: 3, 2: 2, 3: 2, 4: 2, 5: 3, 6: 3, 7: 2, 8: 2, 9: 2, 10: 3 },
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
  const c = baseChar({ raceId: 'dwarf', attrs: { ...CALC.defaults().attrs, живучесть: 14 } }); // conMod 2
  assert.equal(CALC.maxHp(c, DATA), 4 * 12 + Math.round(2 * 3.5));
});

test('maxHp: level-up contribution and Закалка', () => {
  const c = baseChar({ raceId: 'dwarf', level: 3, attrs: { ...CALC.defaults().attrs, живучесть: 14 } });
  assert.equal(CALC.maxHp(c, DATA), 4 * 12 + Math.round(2 * 3.5) + (12 + 2) * 2);
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
  assert.equal(CALC.totalOS(c1, DATA), 15 + 2); // 15 за уровни 1–6, +2 за 3-й и 6-й
  const c2 = baseChar({ level: 3, traitId: 'dumb' });
  assert.equal(CALC.totalOS(c2, DATA), 7 - 3);  // 3+2+2, −3 за «Тупой»
  const c3 = baseChar({ level: 11 });
  assert.equal(CALC.totalOS(c3, DATA), 3 + 2 + 2 + 2 + 3 + 3 + 2 + 2 + 2 + 3); // 24, только 1..10
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
});
```

Примечание: тест `totalOS` с level=11 — итоговое ожидаемое 24 (сумма osByLevel за 1..10; в Fixture osByLevel только 1..6, поэтому для level=11 сумма берётся по наличным ключам 1..10 — в фикстуре нет 7..10. Чтобы тест был честным, добавь в фикстуру `osByLevel` ключи 7:2, 8:2, 9:2, 10:3. Тогда expected для level=11 = 24; для level=6 с adaptive = 15 + 2 = 17 (поправить первый assert: `(3+2+2+2+3+3) + 2 = 17`). Скорректируй числа при написании тестов — эталон формул: `sumOs(level) = Σ osByLevel[1..min(level,10)]`.

- [ ] **Step 2: Прогнать тесты — убедиться, что падают**

Run: `npm test`
Expected: FAIL — `CALC.maxHp is not a function`, `CALC.defaults is not a function` и т.п.

- [ ] **Step 3: Реализовать calc.js**

Полный `src/calc.js`:
```js
const CALC = (function () {
  const ATTRS = ['сила', 'ловкость', 'живучесть', 'воля', 'восприятие', 'харизма', 'мудрость', 'интеллект'];

  function mod(attr) { return Math.floor((attr - 10) / 2); }

  function defaults() {
    const attrs = {}; ATTRS.forEach(a => attrs[a] = 8);
    return {
      version: 1, id: '', name: '', raceId: null, statusId: null, traitId: null, traitRolled: false,
      level: 1, attrs,
      hp: { current: 0, max: 0 }, stamina: { current: 0, max: 0 }, mana: { current: 0, max: 0 },
      trained: { skills: {}, lores: {}, crafts: {} },
      specializations: [], abilities: [], customAbilities: [],
      weapons: [], armor: null, shield: null, inventory: [],
      conditions: [], injuries: { head: false, arms: false, torso: false, legs: false },
      exhaustion: 0, deathSaves: { success: 0, fail: 0 }, inspiration: 0,
      spentOS: 0, osBonuses: { stamina: 0, mana: 0, hp: 0 },
      masteryBonus: 0,
      notes: '', createdAt: 0, updatedAt: 0, humanBonusChoice: null,
    };
  }

  function race(char, DATA) { return DATA.races[char.raceId] || null; }
  function status(char, DATA) { return DATA.statuses[char.statusId] || null; }
  function trait(char, DATA) { return DATA.traits[char.traitId] || null; }

  function sumOs(level, DATA) {
    let s = 0;
    for (let l = 1; l <= Math.min(level, 10); l++) s += DATA.osByLevel[l] || 0;
    return s;
  }

  function totalOS(char, DATA) {
    let s = sumOs(char.level, DATA);
    const t = trait(char, DATA);
    if (t && t.osEvery3Levels) s += Math.floor(char.level / 3);
    if (t && t.osPerLevel) s += t.osPerLevel * char.level;
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
      if (r.attrCaps) for (const k in r.attrCaps) out[k] = Math.min(out[k], r.attrCaps[k]);
    }
    const st = status(char, DATA);
    if (st && st.bonuses) for (const k in st.bonuses) out[k] += st.bonuses[k];
    const t = trait(char, DATA);
    if (t && t.allAttrBonus) ATTRS.forEach(a => out[a] += t.allAttrBonus);
    if (t && t.vitCap) out['живучесть'] = Math.min(out['живучесть'], t.vitCap);
    if (DATA.allAbilities) {
      for (const id of char.abilities) {
        const ab = DATA.allAbilities[id];
        if (ab && ab.mech && ab.mech.attrBonus) for (const k in ab.mech.attrBonus) out[k] += ab.mech.attrBonus[k];
      }
    }
    return out;
  }

  function mods(char, DATA) {
    const f = attrFinal(char, DATA);
    const m = {};
    ATTRS.forEach(a => m[a] = mod(f[a]));
    const t = trait(char, DATA);
    if (t && t.doubleWillMod) { m['воля'] *= 2; } // «Оптимист» — только отображение спасбросков/проверок
    return m;
  }

  function hasAbility(char, DATA, id) { return char.abilities.indexOf(id) !== -1; }

  function maxHp(char, DATA) {
    const r = race(char, DATA);
    if (!r) return char.hp.max || 0;
    const conMod = mods(char, DATA)['живучесть'];
    let total = 4 * r.hitDie + Math.round(conMod * 3.5);
    const conMult = (DATA.allAbilities && hasAbility(char, DATA, 'живучесть-закалка')) ? 3 : 1;
    for (let l = 2; l <= char.level; l++) total += r.hitDie + conMod * conMult;
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
    if (char.armor && DATA.armor && char.armor.id && DATA.armor[char.armor.id]) a = DATA.armor[char.armor.id].ac;
    if (char.shield && DATA.shield && char.shield.id && DATA.shield[char.shield.id]) a += DATA.shield[char.shield.id].bonus;
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

  return { ATTRS, mod, defaults, race, status, trait, sumOs, totalOS, tier, attrFinal, mods, maxHp, maxStamina, maxMana, speed, ac, abilityCost };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = { CALC };
```

Примечание: тесты и код используют `DATA.allAbilities = {...DATA_MAGIC.abilities, ...DATA_PHYSICAL.abilities}` (склейка в Task 8 в app.js; в тестах — фикстура). `DATA.abilities` в фикстуре — структура {id: {...}} (не массив); в Task 3–6 каталоги заведутся как объекты `{id: entry}`.

- [ ] **Step 4: Прогнать тесты**

Run: `npm test`
Expected: все тесты calc.test.js PASS. Ошибки уровней 11+, фикстура — скорректируй числа по комментариям в тестах.

- [ ] **Step 5: Проверить сборку не сломалась**

Run: `node build.js; npm test`
Expected: build ok, smoke pass, calc pass.

- [ ] **Step 6: Commit**

```bash
git add src/calc.js test/calc.test.js antar-sheet.html
git commit -m "feat: calc module with formulas for HP, stamina, mana, speed, AC, OS, tiers"
```

---

### Task 3: data-core.js — расы, статусы, черты, навыки/знания/ремёсла

**Files:**
- Create: `test/data-core.test.js`
- Modify: `src/data-core.js`

**Interfaces:**
- Consumes: `docs/antar-rules-0.98.txt` (строки: расы 2781–2856, статусы 62–121, черты 2858–2901, навыки 46–57, специализации 123–142)
- Produces:
  - `DATA_CORE.races` — объект `{id: {name, hitDie, size, lifespan, bonusMode|bonuses, attrCaps?, noPhysicalSpecs?, bonusChoice?}}`; люди: `{bonusMode:'choice', bonusChoice:null}` + `humanBonusChoice` в чарнике
  - `DATA_CORE.statuses` — `{id: {name, text, skills:[], lores:[], crafts:[], bonuses:{}, staminaBonus?, manaBonus?, propertyText}}`
  - `DATA_CORE.traits` — `{id: {num, name, quote, desc, allAttrBonus?, osEvery3Levels?, osPerLevel?, vitCap?, intNot9?, doubleWillMod?, initBonus?, inspirationDaily?, marathoner?, rerollInit?, noCrits?, textOnly?}}`
  - `DATA_CORE.skills`, `DATA_CORE.lores`, `DATA_CORE.crafts` — `{id: {name, attrs:[attrId,...]}}`
  - ID-конвенция: расы — `human, elf, dwarf, halfling, gnome, goliath, orc, genasi, goblin`; статусы — `slave, servant, farmhand, freePeasant, craftsman, artist, criminal, ranger, merchant, warrior, scholar, gentry`; черты — `t1..t20` где номер = d20; навыки/знания/ремёсла — транслит с дефисом (`azard-games`, `acrobatics`, ...)

- [ ] **Step 1: Написать падающие тесты**

`test/data-core.test.js`:
```js
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
  assert.ok(Object.keys(DATA_CORE.skills).length >= 25);
  assert.ok(Object.keys(DATA_CORE.lores).length >= 19);
  assert.ok(Object.keys(DATA_CORE.crafts).length >= 17);
});
```

- [ ] **Step 2: Прогнать — ожидается FAIL**

Run: `npm test`
Expected: FAIL (пустые каталоги).

- [ ] **Step 3: Заполнить data-core.js**

Структура — как в тестах. Всё содержимое транскрибируется из `docs/antar-rules-0.98.txt`:

**Расы (строки 2781–2856):** Люди (d10, средний, choice), Эльфы (d8, +2 харизма +2 восприятие +3 мудрость), Дварфы (d12, +2 сила +2 живучесть +2 воля), Полурослики (d6, мелкий, +3 ловкость +2 восприятие +2 харизма), Гномы (d6, мелкий, +4 интеллект +3 мудрость +3 воля, attrCaps, noPhysicalSpecs), Голиафы (d12, +3 сила +2 живучесть +1 воля), Орки (d12, +2 сила +2 живучесть +1 восприятие), Дженази (d10, +2 интеллект +1 ловкость +1 сила +2 воля), Гоблины (d6, +2 ловкость +3 восприятие).

**Статусы (62–121):** раб, прислуга, батрак, свободный крестьянин, ремесленник, артист, преступник, следопыт, торговец, воитель, ученый, мелкая знать. Поля: name, text (полный текст бонуса из правил), skills/lores/crafts (по спискам ниже), bonuses (характеристики), staminaBonus/manaBonus (раб +10 ЗС, батрак +5, свободный крестьянин +3, ремесленник +3, воитель +5, учёный +8 маны), propertyText (имущество текстом из правил).

**Черты (2858–2901):** t1..t20 как в тестах; `desc` — полный текст из правил, `quote` — цитата.

**Навыки (строка 50):** азартные-игры (Хар, Лов)… — 25 навыков: Азартные игры(хар,ловкость), Акробатика(ловкость), Альпинизм(сила,ловкость), Балансирование(ловкость), Бесшумное передвижение(ловкость), Блеф(хар,мудрость), Взлом(ловкость,сила), Вывод из строя устройства(инт,сила), Дипломатия(хар,мудрость), Запугивание(хар,сила), Изменение внешности(хар,мудрость), Использование волшебного предмета(хар,инт), Обирание карманов(ловкость,хар), Обнаружение(мудрость,инт,восприятие), Оценка(инт,мудрость,восприятие), Подделка(инт,ловкость,восприятие), Поиск(инт,ловкость,восприятие), Представление(хар), Расшифровка(инт), Сбор информации(хар,мудрость), Скрывание(ловкость), Создание ловушек(ловкость), Тонкий слух(восприятие), Чтение по губам(инт,восприятие).

**Знания (строка 54):** 19: Астрология(инт), Геральдика(мудрость,хар), Знание алхимии(инт,мудрость), Знание географии(инт,мудрость,восприятие), Знание истории(инт,мудрость), Знание магии(инт), Знание механической магии(инт,мудрость), Инженерное дело(инт,мудрость), Использование волшебства(инт), Лечение(мудрость), Палеография(инт), Парамедицина(хар,живучесть — в правилах «Сло», принимаем живучесть), Плановедение(инт), Природоведение(мудрость), Регионоведение(хар,мудрость), Религиоведение(мудрость,хар), Рудоведение(мудрость), Фитотерапия(мудрость), Хирургия(мудрость,ловкость).

**Ремёсла (строка 57):** 17: Гримировка(хар), Деревообработка(инт), Дрессировка(хар,мудрость), Живопись(мудрость), Кузнечное дело(сила), Музыка(мудрость,ловкость), Пивоварение(инт), Поэзия(инт,хар), Ремесло гончара(ловкость), Ремесло доспешника(инт), Ремесло каменщика(сила,инт), Ремесло лукодела(инт), Ремесло оружейника(инт), Ремесло переплетчика(инт), Ремесло земледельца(инт,живучесть — в правилах «Сло»), Ремесло ювелира(инт), Скульптура(мудрость).

**Специализации (строки 123–142)** — попадают в `DATA_CORE.specializations`:
```js
specializations: {
  martial: { name: 'Воинское искусство', somatic: false, desc: '…' },
  strength: { name: 'Сила', somatic: true },
  dexterity: { name: 'Ловкость', somatic: true },
  vitality: { name: 'Живучесть', somatic: true },
  warding: { name: 'Ограждение', somatic: false },
  conjuration: { name: 'Призыв', somatic: false, empty: true },
  transmutation: { name: 'Преобразование', somatic: false },
  restoration: { name: 'Восстановление', somatic: false },
  antimagic: { name: 'Антимагия', somatic: false },
  illusion: { name: 'Иллюзия', somatic: false },
  enchantment: { name: 'Очарование', somatic: false, empty: true },
  curses: { name: 'Проклятия', somatic: false },
  battleMagic: { name: 'Воинская магия', somatic: false, empty: true },
  manifestation: { name: 'Проявление', somatic: false },
},
```
Пустые (`empty: true`): conjuration, enchantment, battleMagic — это «ждём следующих редакций».

- [ ] **Step 4: Прогнать тесты**

Run: `npm test`
Expected: PASS (при несовпадении имён/счётчиков — сверь с текстом правил, это транскрипция; в test записаны точные требования).

- [ ] **Step 5: Пересобрать и коммит**

Run: `node build.js; npm test`
```bash
git add src/data-core.js test/data-core.test.js antar-sheet.html
git commit -m "feat: core data catalogs (races, statuses, traits, skills, lores, crafts, specializations)"
```

---

### Task 4: data-core.js — оружие, доспехи, состояния, травмы, истощение, ОС

**Files:**
- Modify: `src/data-core.js`
- Modify: `test/data-core.test.js` (дополнить)

**Interfaces:**
- Consumes: `docs/antar-rules-0.98.txt` (оружие 2583–2746, доспехи 2748–2779, состояния 330–427, травмы 273–325, истощение 445–471, ОС 153–166)
- Produces:
  - `DATA_CORE.weapons` — `{id: {name, kind, speed, props, reach, damage, twoHanded?}}` (kind: 'короткое клинковое'|'длинное клинковое'|'древковое'|'ударно-дробящее'|'дальнобойное'; props — строка, напр. '+1 к парированию')
  - `DATA_CORE.armor` — `{id: {name, ac, penalties}}` (очень легкие 14, легкие 16, средние 18, тяжелые 20, очень тяжелые 22)
  - `DATA_CORE.shield` — `{id: {name, bonus}}` (легкий +1, средний +2, башенный +3)
  - `DATA_CORE.conditions` — массив/объект `{id, name, desc}` (17 штук)
  - `DATA_CORE.injuries` — `{id: {name, desc}}` (4 зоны: head, arms, torso, legs)
  - `DATA_CORE.exhaustion` — `{1..6: {name, desc}}`
  - `DATA_CORE.osByLevel` — `{1:3, 2:2, 3:2, 4:2, 5:3, 6:3, 7:2, 8:2, 9:2, 10:3}`

- [ ] **Step 1: Дописать тесты**

В конец `test/data-core.test.js`:
```js
test('weapons: 20 видов из правил, все поля', () => {
  const ids = Object.keys(DATA_CORE.weapons);
  assert.ok(ids.length >= 20);
  for (const id of ids) {
    const w = DATA_CORE.weapons[id];
    assert.ok(w.name && w.kind && w.speed && w.damage, id);
    assert.ok(Number.isInteger(w.speed) && w.speed >= 1, id);
  }
  assert.equal(DATA_CORE.weapons.dagger.speed, 3);
  assert.equal(DATA_CORE.weapons['twoHandedSword'].speed, 2);
  assert.equal(DATA_CORE.weapons['heavyCrossbow'].speed, 1);
});

test('armor and shield', () => {
  assert.equal(DATA_CORE.armor['veryLight'].ac, 14);
  assert.equal(DATA_CORE.armor['light'].ac, 16);
  assert.equal(DATA_CORE.armor['medium'].ac, 18);
  assert.equal(DATA_CORE.armor['heavy'].ac, 20);
  assert.equal(DATA_CORE.armor['veryHeavy'].ac, 22);
  assert.equal(DATA_CORE.shield['light'].bonus, 1);
  assert.equal(DATA_CORE.shield['medium'].bonus, 2);
  assert.equal(DATA_CORE.shield['tower'].bonus, 3);
});

test('conditions: 17, exhaustion: 6, injuries: 4', () => {
  assert.equal(Object.keys(DATA_CORE.conditions).length, 17);
  assert.equal(Object.keys(DATA_CORE.exhaustion).length, 6);
  assert.deepEqual(Object.keys(DATA_CORE.injuries).sort(), ['arms', 'head', 'legs', 'torso']);
});

test('osByLevel 1..10', () => {
  assert.deepEqual(DATA_CORE.osByLevel, { 1: 3, 2: 2, 3: 2, 4: 2, 5: 3, 6: 3, 7: 2, 8: 2, 9: 2, 10: 3 });
});
```

- [ ] **Step 2: Заполнить каталоги в data-core.js**

**Оружие (2583–2746)** — id-конвенция: `dagger, spear, shortSword, longSword, twoHandedSword, twoHandedAxe, scimitar, longScimitar, warHammer, mace, pike, twoHandedMace, twoHandedHammer, shortBow, longBow, lightCrossbow, heavyCrossbow, dart`. Поля из правил дословно: name, kind («короткое клинковое», «длинное клинковое», «древковое», «ударно-дробящее», «Дальнобойное»), speed (атак/ход), props (строка, напр. «+1 к парированию»; пустая строка если нет), reach (текст, напр. «1 клетка», «вплотную», «3-4 клетки, не меньше», «200 футов прицельной стрельбы», «ваш мод.Силы×25»), damage (текст, напр. «2d4+мод.Силы колющего или рубящего»).

**Доспехи (2755–2767):** `veryLight` («Очень легкие», 14, ограничений нет), `light` («Легкие», 16), `medium` («Средние», 18, penalties: «−2 спасброски/проверки Ловкости, −4 Скрытность»), `heavy` («Тяжелые», 20, penalties: «дальность заклинаний/дальнобойных атак вдвое и −5, +2 бонусы попадания сбоку/сзади, −3 Ловкость, −10 Скрытность»), `veryHeavy` («Очень тяжелые», 22, «нельзя кастовать/дальнобойные атаки, +3 бонусы сбоку/сзади, автопровал Скрытности, −5 инициатива, автопровал Взлома/Моторики»).

**Щиты (2774–2778):** light +1, medium +2, tower +3.

**Состояния (330–427)** — 17: оглушен, заторможен, дестабилизирован, схвачен, свален, опрокинут, отвлечен, подавлен, испуган, ослеплен, оглохший, растерян, шокирован, дезориентирован, в панике, отравлен, опутан, подброшен, обездвижен, лишен чувств — в правилах их 20 (проверь по тексту, включи все перечисленные в 330–427; тест требует ≥17, но транскрибируй все, что есть). Формат: `{id: {name: 'Оглушен', desc: '<полный текст из правил>'}}`.

**Травмы (273–325):** head «Травма головы», arms «Травмы верхн. конечности», torso «Травма торса», legs «Травма нижн. конечности» — с полным текстом.

**Истощение (461–470):** 1..6 с текстами «Помеха при проверках характеристик», «Скорость уменьшается вдвое», «Помеха при бросках атаки и спасбросках», «Максимум хитов уменьшается вдвое», «Скорость снижается до 0», «Смерть».

**ОС (153–166):** `osByLevel = {1:3, 2:2, 3:2, 4:2, 5:3, 6:3, 7:2, 8:2, 9:2, 10:3}`.

- [ ] **Step 3: Прогнать тесты**

Run: `npm test`
Expected: PASS.

- [ ] **Step 4: Пересобрать и коммит**

Run: `node build.js; npm test`
```bash
git add src/data-core.js test/data-core.test.js antar-sheet.html
git commit -m "feat: weapons, armor, shields, conditions, injuries, exhaustion, OS table"
```

---

### Task 5: data-magic.js — 7 магических школ (все заклинания)

**Files:**
- Create: `test/data-magic.test.js`
- Modify: `src/data-magic.js`

**Interfaces:**
- Consumes: `docs/antar-rules-0.98.txt` (Проявление 506–699, Восстановление 707–883, Преобразование 886–1110, Иллюзия 1113–1324, Ограждение 1327–1558, Антимагия 1561–1711, Проклятия 1714–1861)
- Produces: `DATA_MAGIC.abilities` — объект `{id: {specId, name, tier, type: 'active'|'passive', components, castTime, duration, cost {mana?, stamina?}, range, desc, mech?}}`

Формат записи (пример — Огненная стрела):
```js
'ab-огненная-стрела': {
  specId: 'manifestation', name: 'Огненная стрела', tier: 1, type: 'active',
  components: 'верб., сом. (одна рука)', castTime: '1 действие', duration: '1 действие',
  cost: { mana: 2 }, range: '100 футов',
  desc: 'Из вашей руки вырывается огненная стрела. При попадании атакой, вы наносите цели nd6 огненного урона, где n - ваш бонус мастерства.',
},
```
ID-конвенция: префикс `ab-` + транслит. `mech` — только для способностей, влияющих на расчёт (см. Task 2): Мифическая ловкость/живучесть/сила → `mech: {attrBonus: {ловкость: 2}}`; Закалка → `mech: {conMult: 3}` (в data-physical); Резкий → `mech: {speedBonus: 8}` (40 футов = 8 клеток); Непрошибаемое строение → `mech: {acBonus: 3}`; Заторможенное старение и прочие чисто описательные → без mech.

- [ ] **Step 1: Написать падающие тесты**

`test/data-magic.test.js`:
```js
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
  for (const n of ['Огненная стрела', 'Огненный шар', 'Метеорит', 'Малое лечение ран', 'Великое исцеление', 'Полет', 'Высшая невидимость', 'Щит', 'Поле антимагии', 'Великое проклятие']) {
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
```

- [ ] **Step 2: Прогнать — FAIL**

Run: `npm test`
Expected: FAIL (пусто).

- [ ] **Step 3: Транскрибировать все заклинания**

Из строк правил (по списку ниже). Для каждого: заголовок — название, поля компоненты/время/длительность/затрата/дистанция, текст — `desc`. Способности, помеченные «8? маны» и т.п. — оставить числом из текста (8), в `cost: {mana: 8}`.

Полный список (школа → тир → названия):
- manifestation (Проявление) T1: Огненная стрела, Пламенные руки, Лёд, Шоковая хватка, Валун, Порыв ветра, Летящие стрелы, Едкое облако, Прыгучий камень; T2: Сферы Джабира, Ловушки Рэция, Магические сети, Огненный шар; T3: Ужасающий разряд, Волна молний; T4: Энергетические клинки, Метеорит
- restoration (Восстановление) T1: Малое лечение ран, Поправка, Малая удача, Исцеление болезней, Избавление от яда, Обращение сил, Снятие страха; T2: Увеличение характеристик, Возложение, Благословение, Живительная аура; T3: Восстановление сил, Массовое лечение, Регенерация; T4: Великое исцеление, Удача
- transmutation (Преобразование) T1: Прыжок, Обеззараживание, Формация, Малый телекинез, Малое превращение; T2: Томундовы глаза, Задержка, Легкое падение, Превращение в зверя, Звериный облик, Газообразная форма; T3: Ускорение, Рост растений, Хождение по воде, Обращение в монстра, Левитация, Быстрый шаг; T4: Полет
- illusion (Иллюзия) T1: Фантомный удар, Обманная смерть, Вспышка, Иллюзия, Размытый образ, Скрытое послание; T2: Ложное заклинание, Неожиданная угроза, Подмена, Зеркальный образ, Маскировка; T3: Копия, Высшая невидимость, Псевдо-смерть; T4: Массовое наваждение
- warding (Ограждение) T1: Щит, Искажение, Потеря следа, Кожа-кора, Охранный символ, Каменная оболочка; T2: Поглощение, Скендерова оболочка, Святилище, Стихийная устойчивость, Магические цепи; T3: Упругая сфера, Защита от оружия, Итилевы коврики, Сдвиг плит, Лабиринт; T4: Силовая стена, Неуязвимость
- antimagic (Антимагия) T1: Завеса, Малое обращение, Проклятие, Пронзающая магия, Ослабление; T2: Тишина, Истинное зрение, Контрзаклинание; T3: Сокрушительный провал, Хлыст Хелбена, Прокол; T4: Щит Аль-Мугиры, Поле антимагии
- curses (Проклятия) T1: Дурнота, Печать истощения, Иссыхание, Отравление, Горечь; T2: Недомогание, Сглаз, Насылание болезни, Череда неудач; T3: Метка Армюра, Ужасающее иссыхание, Истощение; T4: Великое проклятие

- [ ] **Step 4: Прогнать тесты**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Пересобрать и коммит**

Run: `node build.js; npm test`
```bash
git add src/data-magic.js test/data-magic.test.js antar-sheet.html
git commit -m "feat: spell trees for 7 magic schools per rules 0.98"
```

---

### Task 6: data-physical.js — 4 физические ветки + 3 пустых

**Files:**
- Create: `test/data-physical.test.js`
- Modify: `src/data-physical.js`

**Interfaces:**
- Consumes: `docs/antar-rules-0.98.txt` (Воинское искусство 1870–2082, Ловкость 2085–2230, Живучесть 2231–2398, Сила 2399–2582)
- Produces: `DATA_PHYSICAL.abilities` — тот же формат, что и DATA_MAGIC.abilities (specId: 'martial', 'dexterity', 'vitality', 'strength'); пустые специализации — просто отсутствуют записи (дерево рендерится пустым из DATA_CORE.specializations[id].empty)

- [ ] **Step 1: Написать падающие тесты**

`test/data-physical.test.js`:
```js
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
```

- [ ] **Step 2: Прогнать — FAIL**

Run: `npm test`
Expected: FAIL (пусто).

- [ ] **Step 3: Транскрибировать способности**

Тот же формат, что в Task 5. Способности без затрат — `type:'passive'`, `cost:{}` опускается. С затратами — `type:'active'`, `cost:{stamina:N}` (или mana — в этих ветках запас сил). Для способностей с механикой — mech (см. тесты; точные id в тестах). Полный список:

- martial (1870–2082) T1: Адепт оружия, Атака с финтом, Отвлекающий удар, Атака с выпадом, Оборонительная стойка, Легкие удары, Подсечка, Пристрелка, Наступательная стойка, Малая концентрация; T2: Знаток оружия, Отталкивающий удар, Опрокидывающий удар, Обезоруживание, Жестокий удар, Контроль, Останавливающий удар, Контратака, Провокация, Натиск, Рокировка, Кровоточащий удар, Передышка, Намётанный глаз, Раскалывающий удар; T3: Эксперт оружия, Подавление, Калечащий удар, Вихрь, Нырок, Рефлексы; T4: Мастер оружия, Рассечение
- dexterity (2085–2230) T1: Увертливость, Легкий в ногах, Уж, Спринт, Активное уклонение, Быстрые руки; T2: Мифическая ловкость, Неприметное движение, Прорехи, Гений защиты, Ловля снарядов; T3: Поступь ветра, Широко шагая, Адреналин, Резкий, Предрекая смерть, Покоритель неба, Юркий; T4: Бег пера, Налегке, Великая скорость (и остальные по тексту до 2231)
- vitality (2231–2398) T1: Горячка, Живительный покой, Самолечение, Граница жизни, Перераспределение энергии, Ускоренное лечение; T2: Стальные легкие, Выработанный иммунитет, Мифическая живучесть, Крепость тела, Закалка, Затягивание ран; T3: Драконья кожа, Кровожадность, Регенерация, Адамантиновые кости, Непрошибаемое строение, Природная живучесть, Контроль тела, Второе дыхание; T4: Несгибаемый, Великое превозмогание, Болевой порог, Нисходящий, Заторможенное старение
- strength (2399–2582) T1: Цепкая хватка, Руки чемпиона, Крепок в ногах, Натиск, Демонстрация силы, Атлет; T2: Тяжелая рука, Разрушение, Мифический атлетизм, Пугающее присутствие, Сокрушающие удары; T3: Сила великана, Пружина, Исключительная мощь, Титан, Бронебойность, Жнец, Изверг, Совершенный удар, На равных; T4: Преодоление, Таран, Лязг, Двужильный, Дрожь земли, Неудержимый

mech-эффекты: Мифическая ловкость/живучесть → attrBonus (см. тесты); Мифический атлетизм → attrBonus {сила: 2}; Закалка → conMult 3; Резкий → speedBonus 8 (40 футов / 5 футов на клетку); Непрошибаемое строение → acBonus 3. Остальные — описательные.

- [ ] **Step 4: Прогнать тесты**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Пересобрать и коммит**

Run: `node build.js; npm test`
```bash
git add src/data-physical.js test/data-physical.test.js antar-sheet.html
git commit -m "feat: martial arts and physical ability trees with mech bonuses"
```

---

### Task 7: store.js — localStorage, экспорт/импорт, валидация

**Files:**
- Create: `test/store.test.js`
- Modify: `src/store.js`

**Interfaces:**
- Consumes: `CALC.defaults()` из Task 2
- Produces:
  - `STORE.KEY = 'antar.characters'`
  - `STORE.load() -> Character[]` (из localStorage; при отсутствии/ошибке — `[]`)
  - `STORE.save(chars) -> boolean` (true при успехе; при QuotaExceeded/ошибке → false, не бросает)
  - `STORE.normalize(raw) -> Character` (деструктуризация с дефолтами — любой битый JSON не ломает рендер)
  - `STORE.exportJson(char) -> string` (JSON, version 1, имя файла наружу)
  - `STORE.parseImport(text) -> {ok, char|error}` (валидация version и обязательных полей)
  - `STORE.newId() -> string` (`Date.now().toString(36) + random`)
  - localStorage-доступ через `globalThis.localStorage` (в тестах — мок)

- [ ] **Step 1: Написать падающие тесты**

`test/store.test.js`:
```js
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
```

- [ ] **Step 2: Прогнать — FAIL**

Run: `npm test`
Expected: FAIL (`STORE.load is not a function` и т.п.).

- [ ] **Step 3: Реализовать store.js**

```js
const STORE = (function () {
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
    const d = CALC.defaults();
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
```

- [ ] **Step 4: Прогнать тесты**

Run: `npm test`
Expected: PASS. (Внимание: тест normalize для `parseImport` с version 1 без name → {ok:false} — верно.)

- [ ] **Step 5: Пересобрать и коммит**

Run: `node build.js; npm test`
```bash
git add src/store.js test/store.test.js antar-sheet.html
git commit -m "feat: store with localStorage, export/import, validation"
```

---

### Task 8: app.js — каркас UI, экран выбора

**Files:**
- Modify: `src/app.js`
- Modify: `src/style.css`

**Interfaces:**
- Consumes: `DATA_CORE`, `DATA_MAGIC`, `DATA_PHYSICAL`, `CALC`, `STORE` (глобальные константы в одном скрипте)
- Produces:
  - `window.APP` — `{ state: {chars, currentId, screen}, render(), toast(msg, type?), goto(screen), selectChar(id), deleteChar(id), exportChar(id), importChar(file), newChar() }`
  - `APP.DATA = { ...DATA_CORE, abilities: {...DATA_MAGIC.abilities, ...DATA_PHYSICAL.abilities}, allAbilities: {...DATA_MAGIC.abilities, ...DATA_PHYSICAL.abilities} }` — единый контекст данных для CALC (calc ожидает `DATA.races/statuses/traits/osByLevel/specializations/abilities(allAbilities)/weapons/armor/shield`)
  - `APP.el(html) -> HTMLElement`
  - Рендер экранов функциями `renderScreen()`, `renderSelect()`
  - Тосты: `.toast` в #app, авто-исчезновение 2.5 с

- [ ] **Step 1: Каркас app.js**

```js
(function () {
  const DATA = Object.assign({}, DATA_CORE, {
    abilities: Object.assign({}, DATA_MAGIC.abilities, DATA_PHYSICAL.abilities),
    allAbilities: Object.assign({}, DATA_MAGIC.abilities, DATA_PHYSICAL.abilities),
  });

  const state = { chars: [], currentId: null, screen: 'select' };

  function el(html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  function currentChar() {
    return state.chars.find(c => c.id === state.currentId) || null;
  }

  const save = () => { STORE.save(state.chars); };

  function mutate(fn) {
    fn();
    save();
    render();
  }

  const toasts = [];
  let toastTimer = null;
  function toast(msg, type) {
    const box = document.getElementById('app');
    const t = el(`<div class="toast ${type || 'info'}">${msg}</div>`);
    box.appendChild(t);
    toasts.push(t);
    setTimeout(() => { t.remove(); }, 2500);
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }

  function render() {
    const app = document.getElementById('app');
    app.innerHTML = '';
    if (state.screen === 'select') renderSelect(app);
    else if (state.screen === 'wizard') renderWizard(app);
    else if (state.screen === 'sheet') renderSheet(app);
  }

  function renderSelect(app) { /* Task 8 — см. ниже */ }
  function renderWizard(app) { /* Task 9–10 */ }
  function renderSheet(app) { /* Task 11–15 */ }

  window.APP = { DATA, state, el, currentChar, mutate, save, toast, render, esc };
})();
```

- [ ] **Step 2: Экран выбора + шапка**

`renderSelect` — карточки `state.chars` (имя, раса, уровень, специализации через CALC), пустое состояние («Создать первого персонажа»), кнопки: Создать, Экспорт (по чарнику), Импорт (`<input type=file accept=".json,.antar.json">`), Удалить (confirm). Экспорт через Blob + a.download: `<имя>.antar.json`. Импорт: `STORE.parseImport` → мутация. `renderWizard`/`renderSheet` временно рендерят «(не готово)». Шапка всегда: название «Чарлист Антар», кнопки «← К списку» (если не select), «Экспорт» для текущего, тема-фон из style.css.

- [ ] **Step 3: Базовый пергаментный CSS**

`src/style.css` — переменные: фон `#e8dcc0`, поверхность `#f5ecd8`, текст `#2c2418`, акцент `#7a4a1d`, границы `#c9b98f`, тень лёгкая; шрифт system-ui + наборный `Georgia, 'Times New Roman', serif` для заголовков; карточки с закруглением 8px; кнопки акцентные; `.toast` фиксирован снизу; `.bar` для шкал; утилиты-классы `.grid`, `.card`, `.row`, `.muted`, `.btn`, `.btn-danger`. Вся вёрстка отзывчивая (flex/grid), на мобильных — одноколоночная.

- [ ] **Step 4: Проверка в браузере**

Открыть `antar-sheet.html` (собрать `node build.js` предварительно). Проверить: шапка, пустой список с предложением создать; создать чарник нельзя (вкладка-заглушка), консоль — 0 ошибок. Клики по кнопкам не падают.

- [ ] **Step 5: Commit**

```bash
git add src/app.js src/style.css antar-sheet.html
git commit -m "feat: app shell with character select screen, export/import, toasts"
```

---

### Task 9: Мастер — шаги 1–3 (раса, статус, черта)

**Files:**
- Modify: `src/app.js`

**Interfaces:**
- Consumes: `APP.state.wizard` — `{step: 1..6, draft: Character (CALC.defaults())}`; `renderWizard(app)` из Task 8
- Produces:
  - `APP.state.wizard` — dynamic в state (инициализируется при «Создать»: `state.wizard = {step: 1, draft: CALC.defaults()}`)
  - функции `wizardStep1(container)`, `wizardStep2`, `wizardStep3` — рендер шага в контейнер (внутри app.js)
  - Валидация: шаг активен когда draft заполнен (`draft.raceId`, затем `statusId`, затем trait — можно пропустить)
  - Кнопки «Назад» / «Далее» и список точек-шагов

- [ ] **Step 1: Реализовать шаги**

**Шаг 1 — Раса:** список карточек 9 рас (`DATA.races`), клик — `mutate(() => draft.raceId = id)`; карточка показывает hitDie, размер, бонусы. Для людей дополнительный выбор при клике: модалка «+1 ко всем ИЛИ +3/+2 к двум» → `draft.humanBonusChoice = {a, b}` или `{all: true}` — при `{all:true}` в `attrFinal` применится `bonusMode:'all1'`-логика (см. Task 2). Кнопка «Далее» активна только при `draft.raceId`.

**Шаг 2 — Статус:** 12 карточек, клик — `draft.statusId`; деталь показывает бонусы. «Далее» при `draft.statusId`.

**Шаг 3 — Черта:** кнопка «Кинуть d20» → результат 1..20, `draft.traitId = 't'+N`, `traitRolled = true`; карточка черты с текстом/цитатой; кнопка «Пропустить» (`traitId: null`, `traitRolled: true` — пропуск = без черты); после броска — «Далее».

- [ ] **Step 2: Проверка в браузере**

Создать → Шаг 1: выбрать каждую расу (бонусы меняются), шаг 2 (статус), шаг 3: «Кинуть d20» 5 раз — выпадают разные черты, описание меняется; «Пропустить» работает. 0 ошибок консоли.

- [ ] **Step 3: Commit**

```bash
git add src/app.js antar-sheet.html
git commit -m "feat: creation wizard steps 1-3 (race, status, d20 trait)"
```

---

### Task 10: Мастер — шаги 4–6 (характеристики, специализации, стартовые ОС) + создание

**Files:**
- Modify: `src/app.js`

**Interfaces:**
- Consumes: `CALC.attrFinal/mods/totalOS/tier/abilityCost`, `DATA.specializations`, `DATA.abilities`
- Produces: шаги `wizardStep4/5/6`; финальный шаг создаёт чарник:
  ```js
  const c = STORE.normalize(draft);
  c.hp.current = c.hp.max = CALC.maxHp(c, DATA);
  c.stamina.current = c.stamina.max = CALC.maxStamina(c, DATA);
  c.mana.current = c.mana.max = CALC.maxMana(c, DATA);
  ```
  → `mutate(() => { state.chars.push(c); state.currentId = c.id; state.screen = 'sheet'; })`

- [ ] **Step 1: Шаг 4 — характеристики**

Раскидывание 27 очков поверх базовых 8 (D&D): 8 полей `draft.attrs[a]` 8..18; табло «осталось очков» = 27 − Σ(attr − 8); кнопки «+»/«−» на каждом; ограничения: не ниже 8, не выше 18; «Хрупкий» (t18): живучесть ≤ 9; «Тупой» (t12): интеллект ≠ 9 (пропустить 9 при клике «+»: перескочить на 10, при «−»: перескочить на 8); гном: сила/ловкость/восприятие ≤ 10 (в attrFinal cap — в мастере тоже блокировать «+» за 10). Рядом предпросмотр `CALC.attrFinal(draft, DATA)` и `CALC.mods`. «Далее» при 0 очков.

- [ ] **Step 2: Шаг 5 — специализации**

Список 14 (карточки с пометкой «телесная/приобретённая», «пустая» — пометка «ждём редакций»); выбор: ровно 4 (или 5 при `draft.traitId === 't19'`); гном: телесные (strength/dexterity/vitality) не выбираются (disabled при `raceId === 'gnome'`); «Далее» при нужном количестве.

- [ ] **Step 3: Шаг 6 — стартовые способности за ОС**

Табло: «ОС: 3 (1 уровень)» — `CALC.totalOS(draft, DATA)` при level 1 (плюс «Тупой» −1, «Приспосабливаемый» 0 на 1-м); деревья выбранных специализаций по тирам (только тир ≤ tier(1)=1): карточка способности (имя, тир, затраты, текст), кнопка «Взять» (стоимость `CALC.abilityCost` — дробная сумма в `draft.spentOS`, не больше totalOS), «Отдать» (вернуть). Ниже — бонусы за ОС: «+1 ЗС и +1 мана за 1 ОС», «+5 HP за 1 ОС» (кнопки-повторы в `draft.osBonuses`). Потенциал (t17): кнопка «Кинуть d10» → очки `10 + roll` в `draft.potentialPoints` и выбор «в запас сил» или «в ману» (добавляется в osBonuses.stamina/mana при создании). Кнопка «Создать персонажа» (активна при spentOS ≤ totalOS) — создание по блоку сбора выше.

- [ ] **Step 4: Проверка в браузере**

Создать полного персонажа: раса → статус → черта → 27 очков (сумма 27; Хрупкий cap; Тупой пропуск 9) → 4 специализации (гном — без телесных) → покупка способностей тира 1 и бонусов, Потенциал. После «Создать» — экран листа (заглушка) и данные в localStorage (проверить DevTools → Application → localStorage `antar.characters`). 0 ошибок консоли.

- [ ] **Step 5: Commit**

```bash
git add src/app.js antar-sheet.html
git commit -m "feat: wizard steps 4-6 (attributes, specs, OS purchase) and character creation"
```

---

### Task 11: Лист — вкладка «Обзор» и шапка листа

**Files:**
- Modify: `src/app.js`

**Interfaces:**
- Consumes: `CALC.*`, `DATA.*`, `STORE`
- Produces: `renderSheet(app)` — шапка листа (имя, раса/статус/уровень, кнопки «Левел-ап» — заглушка до Task 16, «Экспорт», вкладки), `renderOverview(container, char)`, `renderSpecs/Spells/Refbook/Notes` — заглушки «(не готово)» до Task 13–15; утилиты `attrRow(attr, char, DATA)` — строка характеристики с модом; `calcFull(char)` — вычисляет {hp, stamina, mana, speed, ac, mods, attrFinal} и обновляет `char.hp.max` и т.д.

- [ ] **Step 1: calcFull и шапка**

`calcFull(char)`: пересчитывает max-значения (`char.hp.max = CALC.maxHp(...)` и т.д.), возвращает объект. Вызывается при каждом render листа. Шапка листа: имя (редактируемое input), раса/статус/уровень (level — readonly, меняется в левел-апе), «Назад», «Экспорт», «Повысить уровень» (disabled на 20), вкладки-табы (обзор/специализации/заклинания/справочник/заметки) — `state.tab`.

- [ ] **Step 2: Вкладка «Обзор»**

Секции (grid, 2 колонки на десктопе / 1 на мобильном):
1. **Характеристики** — 8 строк: название, значение (input number), мод (авто). Смена значения — mutate.
2. **Боевые параметры** — автоменяющиеся: Хиты (max), Мана (max), Запас сил (max), КД, Скорость (клетки), Инициатива (кнопка броска: `d20(3 попытки-«Живчик») + speed + initBonus(«Параноик» −10) − 2×(«Косноязычный» если кастовал верб.)` — верб. отметку не трекаем, показать в подсказке), Уровневый бонус (input `char.masteryBonus`).
3. **Оружие** — карточки `char.weapons`: имя, тип, атаки/ход (скорость; «Агрессивный» t7: +1 к speed кроме crossbow-типов), свойства, досягаемость, урон (t7: «×2 куба»), кнопки «Удалить», «Добавить» → модалка: выбор из `DATA.weapons` или «своё» (поля name/kind/speed/props/reach/damage).
4. **Доспех и щит** — select из `DATA.armor`/`DATA.shield` (+ «—»), показ штрафов.
5. **Инвентарь** — список строк + input «добавить»/удаление.
6. **Черта и статус** — карточки с текстом (напоминания).
7. **Дайсеры** — кнопки d4/d6/d8/d10/d12/d20: бросок в тост; «Везунчик» (t11): при inspiration>0 кнопка «Переброс» (тратит inspiration); результат броска: суммарно показать `d20+мод+мастерство` для проверок (кнопка ролла проверки — берёт мод из выбранной характеристики рядом селектом).

- [ ] **Step 3: Проверка в браузере**

Открыть созданного чарника: все значения считаются (сверить с ручным расчётом на бумаге для dwаrf lvl 1 con 14: HP=4·12+7=55, ЗС=2+4·2=10, скорость 4+½·мод...), добавить оружие (кинжал — атаки 3), сменить доспех — КД меняется 14→16, ввод характеристики пересчитывает моды/хиты. Экспорт работает. 0 ошибок консоли.

- [ ] **Step 4: Commit**

```bash
git add src/app.js antar-sheet.html
git commit -m "feat: character sheet overview tab with auto-calc values"
```

---

### Task 12: Боевой трекер (шапка листа)

**Files:**
- Modify: `src/app.js`, `src/style.css`

**Interfaces:**
- Consumes: `char.hp/stamina/mana` (current), `char.conditions/injuries/exhaustion/deathSaves/inspiration`, `DATA.conditions/exhaustion/injuries`
- Produces: `renderTracker(container, char)` — блок над вкладками; кнопки-действия вызывают `APP.mutate`

- [ ] **Step 1: Реализовать трекер**

Три шкалы (`.bar` с заливкой по текущему/макс):
- Хиты: порог ⅓ — подшкала-отметка, при current ≤ макс/3 — красная подсветка шкалы (правило скорости/уклонения вдвое); кнопки −1, −5, +1, восстановить (current = max)
- Мана и Запас сил: те же кнопки
- 0 хитов: панель спасбросков смерти — две группы точек (успех/провал), клик по точке ставит/снимает; при 2 провалах — бейдж «СМЕРТЬ»
- Истощение: счётчик 0..6 (кнопки −/+ и клик открывает модалку с текстами степеней 1–6)
- Травмы: 4 чекбокса (голова, руки, торс, ноги) с названиями из `DATA.injuries`
- Состояния: чипсы выбранных (имя, клик — снять) + кнопка «+» → модалка со всеми 17 (tin список, клик — добавить/убрать, описание под списком)
- Инициатива: кнопка «Бросок инициативы» (см. Task 11 — вынести сюда) + результат в тост
- «Новый ход»: сброс отметок (ничего не храним — просто тост «Ход обновлён»), при t15 («Марафонец»): +1 ЗС +1 мана авто
- «Новый день» (при t11 «Везунчик»): inspiration = 3

- [ ] **Step 2: Проверка в браузере**

Понизить хиты до 0 → появилась панель смерти, 2 провала → «СМЕРТЬ»; добавить состояния (3 шт.) → чипсы; травмы, истощение до 6 → тост/подсветка; Марафонец на чарнике: «Новый ход» +1/+1; Везунчик: «Новый день» inspiration=3, «Переброс» тратит. 0 ошибок консоли.

- [ ] **Step 3: Commit**

```bash
git add src/app.js src/style.css antar-sheet.html
git commit -m "feat: combat tracker with bars, conditions, injuries, exhaustion, death saves"
```

---

### Task 13: Вкладка «Специализации и способности»

**Files:**
- Modify: `src/app.js`

**Interfaces:**
- Consumes: `char.specializations/abilities/spentOS/customAbilities`, `DATA.specializations/abilities`, `CALC.totalOS/abilityCost/tier`
- Produces: `renderSpecs(container, char)`; функции `buyAbility(char, id)`, `sellAbility(char, id)`, `addCustomAbility(char, specId)`, `removeCustomAbility(char, idx)` (в app.js, вызываются из DOM-обработчиков, каждая через mutate)

- [ ] **Step 1: Реализовать вкладку**

Табло: «ОС: {spentOS} / {totalOS}». Секции по специализациям (только выбранные + возможность «изучить» из невыбранных за ту же цену — кнопка «+» у специализации добавляет её в `char.specializations`), внутри — по тирам 1–4: карточки способностей (`DATA.abilities` этой specId): тег тира, тип (активный/пассивный), затраты, короткий текст (раскрытие на полный), кнопка «Взять»/«Отдать».

Правила:
- Тир: покупка только если `CALC.tier(char.level) >= ab.tier` — иначе кнопка disabled с подписью «Требуется тир N (уровень {5N−4}–{5N})»
- Стоимость: `CALC.abilityCost(DATA, id)`; spentOS дробный (0.5 шаг) — показывать «1 ОС за 2 способности» для приобретённых
- Лимит: spentOS + цена ≤ totalOS, иначе disabled «Не хватает ОС»
- Пустые деревья (`spec.empty`): вместо карточек — список `char.customAbilities` (этих specId) + форма добавления (имя, тир, тип, затраты, текст) + удаление
- Внизу: блок бонусов за ОС (как в шаге 6 мастера): «+1 ЗС и +1 мана» / «+5 HP», кнопки +/−, показ текущих `char.osBonuses`

- [ ] **Step 2: Проверка в браузере**

Покупка способности тира 1 за ОС (spentOS растёт, totalOS тот же); попытка купить тир 2 при уровне 1 → disabled; поднять уровень нельзя (Task 16) — временно отредактировать `char.level` в консоли `APP.state.chars[0].level = 6; APP.render()` → тир 2 доступен; потратить больше ОС → disabled; custom способности для Призыва; бонусы. 0 ошибок консоли.

- [ ] **Step 3: Commit**

```bash
git add src/app.js antar-sheet.html
git commit -m "feat: specializations tab with OS spending and tier gating"
```

---

### Task 14: Вкладка «Заклинания»

**Files:**
- Modify: `src/app.js`

**Interfaces:**
- Consumes: `DATA.abilities` (specId в 7 магических школах), `char.abilities`, `CALC.tier`
- Produces: `renderSpells(container, char)`

- [ ] **Step 1: Реализовать вкладку**

Группировка: по школам (`martial`/`dexterity`/`vitality`/`strength` не входят — фильтр по `specId` из списка 7 магических: manifestation, restoration, transmutation, illusion, warding, antimagic, curses), внутри — тиры 1–4. Каждая школа — секция с деревьями (только купленные подсвечены, все видны). Поле «Поиск» сверху (фильтр по имени/тексту). Карточка: имя, тир, компоненты, затрата, дистанция, длительность, текст, бейдж «Выучено»/кнопка «Выучить» (та же покупка, что Task 13 — дублируем функцию `buyAbility`).

- [ ] **Step 2: Проверка в браузере**

Поиск «огонь» — фильтрует; все 7 школ рендерятся; кнопка «Выучить» покупает и подсвечивает; счётчик ОС меняется. 0 ошибок консоли.

- [ ] **Step 3: Commit**

```bash
git add src/app.js antar-sheet.html
git commit -m "feat: spells tab grouped by school and tier with search"
```

---

### Task 15: Вкладки «Справочник» и «Заметки»

**Files:**
- Modify: `src/app.js`

**Interfaces:**
- Produces: `renderRefbook(container)` (не зависит от char), `renderNotes(container, char)`

- [ ] **Step 1: Справочник**

Секции-аккордеоны: Состояния (17, полные тексты), Травмы (4), Истощение (6), Черты (20), Расы (9), Статусы (12), Специализации (14). Поле «Поиск» фильтрует по всем текстам. Выбранный чарник не нужен — категории кликабельны.

- [ ] **Step 2: Заметки**

`<textarea>` с `char.notes`, автосохранение по `input` (debounce 300 мс → mutate).

- [ ] **Step 3: Проверка и Commit**

Поиск «ослеп» находит состояния и черты; заметки сохраняются в localStorage. 0 ошибок.
```bash
git add src/app.js antar-sheet.html
git commit -m "feat: refbook and notes tabs"
```

---

### Task 16: Левел-ап

**Files:**
- Modify: `src/app.js`

**Interfaces:**
- Consumes: `CALC.maxHp/totalOS/maxStamina/maxMana/race`, `DATA.osByLevel`
- Produces: `openLevelUp()` — модалка: предпросмотр итогов; `applyLevelUp(gainOS, chosenBonus)` в app.js

- [ ] **Step 1: Реализовать модалку**

Кнопка «Повысить уровень» (шапка листа, disabled при level=20). Содержимое:
1. `newLevel = level + 1`
2. Хиты: `+hitDie + conMod(×3 при «Закалке»)`, итог предпросмотром
3. ОС: `gainOS = osByLevel[newLevel] || 0` + правила черт: t1 «Приспосабливаемый»: если newLevel % 3 === 0 → +1 (в сумму totalOS автоматически — здесь показать); t12 «Тупой»: −1; для 11+ уровня — input «ОС за уровень (ручн.)»: показывается, если newLevel > 10, значение добавляется
4. Выбор бонуса (radio): «+1 к запасу сил и мане» | «+2 к запасу сил» | «+2 к мане»
5. Дополнительно: быстрая трата ОС (кнопки «+1 ЗС и мана за 1 ОС», «+5 HP за 1 ОС» — повторяемые, расходуют gainOS)
6. «Применить»: `char.level = newLevel`, хиты/мана/ЗС max пересчёт (`calcFull`), current поднимается на ту же разницу Δmax (для хитов — на прибавку уровня), spentOS += всё потраченное в модалке; закрыть. current не должен превысить новый max.

- [ ] **Step 2: Проверка в браузере**

Чарник 1 уровня: левел-ап до 2 → ОС +2 (итого totalOS.s 5), HP + hitDie+conMod, выбор бонуса; при t12 — ОС −1; до 21 нельзя (disabled на 20); после левел-апа доступны способности тира 2 (с 6 уровня). 0 ошибок консоли.

- [ ] **Step 3: Commit**

```bash
git add src/app.js antar-sheet.html
git commit -m "feat: interactive level-up modal"
```

---

### Task 17: Мобильная вёрстка, финальная проверка, документация

**Files:**
- Modify: `src/style.css`, `src/app.js`
- Create: `README.md` (короткий: как собрать, как пользоваться, как переносить чарники)

**Interfaces:** —

- [ ] **Step 1: Мобильная адаптация**

Проверить в DevTools (iPhone SE 375px и iPad 768px): шапка не ломается, трекер-шкалы переносятся, модалки скроллятся, кнопки нажимаемы (min 40px). Исправить CSS-мелочи.

- [ ] **Step 2: Полный тест-лист (из спеки)**

Прогнать все 13 пунктов тест-листа спеки в браузере: 9 рас, 12 статусов, все 20 черт, 27 очков с ограничениями, ОС/бонусы, левел-ап, тиры, экспорт/импорт, закрытие/открытие файла, удаление/переименование, мобильный вид, боевой трекер, консоль. Переименование: в шапке листа input имени + сохраняется. Исправить всё найденное.

- [ ] **Step 3: Финальные тесты и сборка**

Run: `npm test` (все PASS), `node build.js`, повторно открыть файл — 0 ошибок консоли, все функции живы.

- [ ] **Step 4: README**

`README.md`: «Чарлист Антар — один HTML-файл. Откройте `antar-sheet.html` в браузере (двойной клик). Данные хранятся браузером; для переноса: Экспорт (JSON) → на другом устройстве Импорт. Разработка: `npm test`, `node build.js` (сборка из src/).»

- [ ] **Step 5: Финальный commit**

```bash
git add src README.md antar-sheet.html package.json test
git commit -m "feat: responsive polish, final validation, README"
```