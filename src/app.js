(function () {
  const DATA = Object.assign({}, DATA_CORE, {
    abilities: Object.assign({}, DATA_MAGIC.abilities, DATA_PHYSICAL.abilities),
    allAbilities: Object.assign({}, DATA_MAGIC.abilities, DATA_PHYSICAL.abilities),
  });

  const state = { chars: STORE.load(), currentId: null, screen: 'select', tab: 'overview', spellQuery: '', refQuery: '', editingPool: null, collapsedSpecs: {}, openDescs: {} };

  const WIZARD_TITLES = ['Раса', 'Статус', 'Черта', 'Характеристики', 'Специализации', 'Стартовые ОС'];
  let humanModalOpen = false;
  let humanPickA = null;
  let weaponModalOpen = false;
  let condModalOpen = false;
  let exhModalOpen = false;
  let levelUpOpen = false;
  let levelUpState = null;
  let lastDice = null;
  let notesTimer = null;

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

  function dis(v) { return v ? ' disabled style="opacity:0.55;cursor:default"' : ''; }

  function goto(screen) {
    state.screen = screen;
    weaponModalOpen = false;
    render();
  }

  function selectChar(id) {
    state.currentId = id;
    state.tab = 'overview';
    weaponModalOpen = false;
    goto('sheet');
  }

  function newChar() {
    state.wizard = { step: 1, draft: CALC.defaults() };
    goto('wizard');
  }

  function exportChar(id) {
    const c = id ? state.chars.find(x => x.id === id) : currentChar();
    if (!c) return;
    const blob = new Blob([STORE.exportJson(c)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = String(c.name || 'character').replace(/[\\/:*?"<>|]/g, '_') + '.antar.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('Экспортировано: ' + esc(c.name));
  }

  function deleteChar(id) {
    const c = state.chars.find(x => x.id === id);
    if (!c) return;
    if (!confirm('Удалить персонажа «' + c.name + '»?')) return;
    mutate(() => {
      state.chars = state.chars.filter(x => x.id !== id);
      if (state.currentId === id) state.currentId = null;
    });
    toast('Удалено: ' + esc(c.name));
  }

  let fileInput = null;
  function ensureFileInput() {
    if (fileInput) return fileInput;
    fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json,.antar.json';
    fileInput.style.display = 'none';
    fileInput.addEventListener('change', () => {
      const f = fileInput.files && fileInput.files[0];
      fileInput.value = '';
      if (f) importChar(f);
    });
    document.body.appendChild(fileInput);
    return fileInput;
  }

  function importChar(file) {
    const reader = new FileReader();
    reader.onload = () => {
      const res = STORE.parseImport(String(reader.result));
      if (!res.ok) { toast('Ошибка импорта'); return; }
      const exists = state.chars.some(x => x.id === res.char.id);
      mutate(() => {
        if (exists) state.chars = state.chars.map(x => (x.id === res.char.id ? res.char : x));
        else state.chars.push(res.char);
      });
      toast('Импортировано: ' + esc(res.char.name));
    };
    reader.readAsText(file);
  }

  function charCard(c) {
    const race = DATA.races[c.raceId];
    const specs = (c.specializations || []).map(id => (DATA.specializations[id] || { name: id }).name);
    return el(`
      <div class="card char-card" data-action="open" data-id="${esc(c.id)}">
        <div class="row between">
          <h3>${esc(c.name || 'Без имени')}</h3>
          <span class="muted">ур. ${esc(c.level)}</span>
        </div>
        <div class="row muted">
          <span>${esc(race ? race.name : '—')}</span>
          <span>Тир ${CALC.tier(c.level)}</span>
        </div>
        <p class="small muted">${specs.length ? specs.map(esc).join(', ') : 'Без специализаций'}</p>
        <div class="row">
          <button class="btn" data-action="export" data-id="${esc(c.id)}">Экспорт</button>
          <button class="btn btn-danger" data-action="delete" data-id="${esc(c.id)}">Удалить</button>
        </div>
      </div>
    `);
  }

  function header() {
    const btns = [];
    if (state.screen !== 'select') btns.push('<button class="btn" data-action="list">← К списку</button>');
    if (currentChar()) btns.push('<button class="btn" data-action="export">Экспорт</button>');
    return el(`
      <header class="topbar">
        <h1>Чарлист Антар</h1>
        <div class="row">${btns.join('')}</div>
      </header>
    `);
  }

  function renderSelect(app) {
    app.appendChild(header());
    const page = el('<div class="page"></div>');
    if (state.chars.length === 0) {
      page.appendChild(el(`
        <div class="card empty">
          <p>Пока нет ни одного персонажа.</p>
          <button class="btn" data-action="new">Создать первого персонажа</button>
        </div>
      `));
    } else {
      const grid = el('<div class="grid"></div>');
      for (const c of state.chars) grid.appendChild(charCard(c));
      page.appendChild(grid);
    }
    page.appendChild(el(`
      <div class="row">
        <button class="btn" data-action="new">Создать</button>
        <button class="btn" data-action="import">Импорт</button>
      </div>
    `));
    app.appendChild(page);
  }

  function renderWizard(app) {
    app.appendChild(header());
    const page = el('<div class="page"></div>');
    page.appendChild(wizardDots());
    const w = state.wizard;
    const box = el('<div class="card"></div>');
    box.appendChild(el('<h2>Шаг ' + w.step + ' из 6: ' + WIZARD_TITLES[w.step - 1] + '</h2>'));
    if (w.step === 1) wizardStep1(box);
    else if (w.step === 2) wizardStep2(box);
    else if (w.step === 3) wizardStep3(box);
    else if (w.step === 4) wizardStep4(box);
    else if (w.step === 5) wizardStep5(box);
    else wizardStep6(box);
    page.appendChild(box);
    page.appendChild(wizardNav());
    app.appendChild(page);
    if (humanModalOpen) app.appendChild(humanModal());
  }

  function wizardDots() {
    const w = state.wizard;
    const dots = WIZARD_TITLES.map((t, i) => {
      const n = i + 1;
      let circle = 'background:#e8dcc0;border:1px solid #c9b98f;color:rgba(44,36,24,0.65);';
      if (n < w.step) circle = 'background:var(--border);border:1px solid var(--border);color:var(--text);';
      if (n === w.step) circle = 'background:var(--accent);border:1px solid var(--accent);color:var(--surface);';
      return `
        <div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
          <div style="width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.8rem;${circle}">${n}</div>
          <span class="small muted">${esc(t)}</span>
        </div>
      `;
    });
    return el(`<div class="row" style="justify-content:center;margin-bottom:1rem;">${dots.join('')}</div>`);
  }

  function wizardStep1(container) {
    const d = state.wizard.draft;
    const grid = el('<div class="grid"></div>');
    for (const id in DATA.races) {
      const r = DATA.races[id];
      const sel = d.raceId === id;
      let bonus;
      if (r.bonusMode === 'choice') {
        bonus = sel && d.humanBonusChoice
          ? (d.humanBonusChoice.all ? '+1 ко всем характеристикам' : '+3 ' + d.humanBonusChoice.a + ', +2 ' + d.humanBonusChoice.b)
          : 'Бонус на выбор: +1 ко всем или +3/+2 к двум';
      } else {
        bonus = Object.keys(r.bonuses || {}).map(k => '+' + r.bonuses[k] + ' ' + k).join(', ');
      }
      const caps = r.attrCaps ? 'Потолки: ' + Object.keys(r.attrCaps).map(k => k + ' ≤ ' + r.attrCaps[k]).join(', ') : '';
      grid.appendChild(el(`
        <div class="card char-card" data-action="race" data-id="${esc(id)}"${sel ? ' style="border:2px solid var(--accent)"' : ''}>
          <h3>${esc(r.name)}</h3>
          <p class="small muted">Кость хитов: d${r.hitDie} · Размер: ${esc(r.size)}</p>
          <p class="small">${esc(bonus)}</p>
          ${caps ? `<p class="small muted">${esc(caps)}</p>` : ''}
        </div>
      `));
    }
    container.appendChild(grid);
  }

  function wizardStep2(container) {
    const d = state.wizard.draft;
    const grid = el('<div class="grid"></div>');
    for (const id in DATA.statuses) {
      const s = DATA.statuses[id];
      const sel = d.statusId === id;
      const parts = [];
      for (const k in (s.bonuses || {})) parts.push('+' + s.bonuses[k] + ' ' + k);
      if (s.staminaBonus) parts.push('+' + s.staminaBonus + ' к запасу сил');
      if (s.manaBonus) parts.push('+' + s.manaBonus + ' к мане');
      const trained = [].concat(
        (s.skills || []).map(x => (DATA.skills[x] || {}).name),
        (s.lores || []).map(x => (DATA.lores[x] || {}).name),
        (s.crafts || []).map(x => (DATA.crafts[x] || {}).name)
      ).filter(Boolean);
      if (trained.length) parts.push('Владения: ' + trained.join(', '));
      grid.appendChild(el(`
        <div class="card char-card" data-action="status" data-id="${esc(id)}"${sel ? ' style="border:2px solid var(--accent)"' : ''}>
          <h3>${esc(s.name)}</h3>
          <p class="small muted">${esc(s.text)}</p>
          ${parts.length ? `<p class="small">${esc(parts.join(' · '))}</p>` : ''}
          ${s.propertyText ? `<p class="small muted">${esc(s.propertyText)}</p>` : ''}
        </div>
      `));
    }
    container.appendChild(grid);
  }

  function wizardStep3(container) {
    const d = state.wizard.draft;
    container.appendChild(el(`
      <div class="row">
        <button class="btn" data-action="trait-roll">Кинуть d20</button>
        <button class="btn btn-danger" data-action="trait-skip">Очистить</button>
      </div>
      <p class="small muted" style="margin-top:1rem;">Выберите любые черты (можно несколько) или бросьте d20 для случайной.</p>
    `));
    const grid = el('<div class="grid"></div>');
    for (const id in DATA.traits) {
      const t = DATA.traits[id];
      const sel = d.traits.indexOf(id) !== -1;
      grid.appendChild(el(`
        <div class="card char-card" data-action="trait-pick" data-id="${esc(id)}" style="${sel ? 'border:2px solid var(--accent);' : ''}">
          <h3>${esc(t.name)} <span class="muted small">№${t.num}</span></h3>
          <p class="small muted">«${esc(t.quote)}»</p>
          <p class="small">${esc(t.desc)}</p>
          ${sel ? '<p class="small muted">выбрано</p>' : ''}
        </div>
      `));
    }
    container.appendChild(grid);
  }

  function specRequired(d) {
    return CALC.hasTrait(d, DATA, 't19') ? 5 : 4;
  }

  function attrMax(d, a) {
    let m = 18;
    for (const t of CALC.traits(d, DATA)) {
      if (t.vitCap && a === 'живучесть') m = Math.min(m, t.vitCap);
    }
    const r = d.raceId ? DATA.races[d.raceId] : null;
    if (r && r.attrCaps && r.attrCaps[a]) m = Math.min(m, r.attrCaps[a]);
    return m;
  }

  function attrInc(a) {
    mutate(() => {
      const d = state.wizard.draft;
      if (d.attrs[a] >= attrMax(d, a)) return;
      let v = d.attrs[a] + 1;
      if (CALC.hasTrait(d, DATA, 't12') && a === 'интеллект' && v === 9) v = 10;
      d.attrs[a] = v;
    });
  }

  function attrDec(a) {
    mutate(() => {
      const d = state.wizard.draft;
      if (d.attrs[a] <= 8) return;
      let v = d.attrs[a] - 1;
      if (CALC.hasTrait(d, DATA, 't12') && a === 'интеллект' && v === 9) v = 8;
      d.attrs[a] = v;
    });
  }

  function wizardStep4(container) {
    const d = state.wizard.draft;
    const fin = CALC.attrFinal(d, DATA);
    const mds = CALC.mods(d, DATA);
    container.appendChild(el(`
      <div class="row between" style="margin-bottom:0.5rem;">
        <h3 style="margin:0;">Характеристики</h3>
        <span class="muted small">распределяются свободно (максимум — потолок расы)</span>
      </div>
    `));
    for (const a of CALC.ATTRS) {
      const cur = d.attrs[a];
      const max = attrMax(d, a);
      const note = [];
      if (max < 18) note.push('макс ' + max);
      if (CALC.hasTrait(d, DATA, 't12') && a === 'интеллект') note.push('без 9');
      container.appendChild(el(`
        <div class="row between" style="padding:0.5rem 0;border-bottom:1px solid var(--border);">
          <div>
            <strong>${esc(a)}</strong>
            <div class="small muted">Финал: ${fin[a]} · Модификатор: ${mds[a] >= 0 ? '+' + mds[a] : mds[a]}${note.length ? ' · ' + esc(note.join(' · ')) : ''}</div>
          </div>
          <div class="row">
            <button class="btn" data-action="attr-minus" data-id="${esc(a)}"${dis(cur <= 8)}>−</button>
            <strong style="min-width:1.6rem;text-align:center;">${cur}</strong>
            <button class="btn" data-action="attr-plus" data-id="${esc(a)}"${dis(cur >= max)}>+</button>
          </div>
        </div>
      `));
    }
  }

  function pickSpec(id) {
    const d = state.wizard.draft;
    if (d.raceId === 'gnome') {
      const s = DATA.specializations[id];
      if (s && s.somatic) return;
    }
    mutate(() => {
      const i = d.specializations.indexOf(id);
      if (i !== -1) d.specializations.splice(i, 1);
      else if (d.specializations.length < specRequired(d)) d.specializations.push(id);
    });
  }

  function wizardStep5(container) {
    const d = state.wizard.draft;
    const need = specRequired(d);
    const gnome = d.raceId === 'gnome';
    container.appendChild(el(`
      <div class="row between" style="margin-bottom:0.5rem;">
        <h3 style="margin:0;">Выбрано специализаций: ${d.specializations.length} из ${need}</h3>
        <span class="muted small">Телесные недоступны гномам</span>
      </div>
    `));
    const grid = el('<div class="grid"></div>');
    for (const id in DATA.specializations) {
      const s = DATA.specializations[id];
      const sel = d.specializations.indexOf(id) !== -1;
      const off = gnome && s.somatic;
      const full = !sel && d.specializations.length >= need;
      grid.appendChild(el(`
        <div class="card char-card" data-action="spec" data-id="${esc(id)}"
          style="${sel ? 'border:2px solid var(--accent);' : ''}${off || full ? 'opacity:0.5;cursor:default;' : ''}">
          <div class="row between">
            <h3 style="margin:0;">${esc(s.name)}</h3>
            <span class="muted small">${s.somatic ? 'телесная' : 'приобретённая'}${s.empty ? ' · ждём редакций' : ''}</span>
          </div>
          ${s.desc ? `<p class="small muted">${esc(s.desc)}</p>` : ''}
          ${off ? '<p class="small muted">Недоступна гномам</p>' : ''}
        </div>
      `));
    }
    container.appendChild(grid);
  }

  function fmtOS(n) {
    return String(n);
  }

  function wizardStep6(container) {
    const d = state.wizard.draft;
    const total = CALC.totalOS(d, DATA);
    const maxTier = CALC.tier(d.level);
    container.appendChild(el(`
      <div class="row between" style="margin-bottom:0.5rem;">
        <h3 style="margin:0;">ОС: ${total} (${d.level} уровень)</h3>
        <span class="muted small">Потрачено: ${fmtOS(d.spentOS)} из ${total}</span>
      </div>
    `));
    for (const sid of d.specializations) {
      const s = DATA.specializations[sid];
      container.appendChild(el(`<h4 style="margin:1rem 0 0.25rem;">${esc(s ? s.name : sid)}</h4>`));
      const ids = Object.keys(DATA.allAbilities).filter(id => {
        const ab = DATA.allAbilities[id];
        return ab.specId === sid && ab.tier <= maxTier;
      });
      if (ids.length === 0) {
        container.appendChild(el('<p class="small muted">Способности тира 1 ещё не готовы.</p>'));
        continue;
      }
      for (const id of ids) {
        const ab = DATA.allAbilities[id];
        const cost = CALC.abilityCost(DATA, id);
        const owned = d.abilities.indexOf(id) !== -1;
        container.appendChild(el(`
          <div class="card" style="margin-top:0.5rem;">
            <div class="row between">
              <strong>${esc(ab.name)} <span class="muted small">Тир ${ab.tier} · ${fmtOS(cost)} ОС</span></strong>
              ${owned
                ? `<button class="btn btn-danger" data-action="ability-sell" data-id="${esc(id)}">Отдать</button>`
                : `<button class="btn" data-action="ability-buy" data-id="${esc(id)}"${dis(d.spentOS + cost > total)}>Взять</button>`}
            </div>
            <p class="small muted" style="margin:0.5rem 0 0;">${esc(ab.desc)}</p>
          </div>
        `));
      }
    }
    container.appendChild(el(`
      <div class="card" style="margin-top:1rem;">
        <div class="row">
          <button class="btn" data-action="os-bonus" data-id="both"${dis(d.spentOS + 1 > total)}>+1 ЗС и +1 мана за 1 ОС</button>
          <button class="btn" data-action="os-bonus" data-id="hp"${dis(d.spentOS + 1 > total)}>+5 HP за 1 ОС</button>
        </div>
        <p class="small muted" style="margin-top:0.5rem;">Бонусы: ЗС +${d.osBonuses.stamina} · Мана +${d.osBonuses.mana} · HP +${d.osBonuses.hp}</p>
      </div>
    `));
    if (CALC.hasTrait(d, DATA, 't17')) {
      const block = el('<div class="card" style="margin-top:1rem;"></div>');
      block.appendChild(el('<div class="row between"><h3 style="margin:0;">Потенциал</h3><span class="muted small">+10 к запасу сил или мане</span></div>'));
      if (!d.potentialRolled) {
        block.appendChild(el('<div class="row" style="margin-top:0.5rem;"><button class="btn" data-action="potential-roll">Кинуть d10</button></div>'));
      } else {
        block.appendChild(el(`<p class="small muted" style="margin-top:0.5rem;">Бросок: ${d.potentialPoints} очков.</p>`));
        if (!d.potentialTo) {
          block.appendChild(el(`
            <div class="row" style="margin-top:0.5rem;">
              <button class="btn" data-action="potential-to" data-id="stamina">В запас сил</button>
              <button class="btn" data-action="potential-to" data-id="mana">В ману</button>
            </div>
          `));
        } else {
          block.appendChild(el(`<p class="small" style="margin-top:0.5rem;">Направлено: ${d.potentialTo === 'stamina' ? 'в запас сил' : 'в ману'}</p>`));
        }
      }
      container.appendChild(block);
    }
    container.appendChild(el(`
      <div class="row" style="margin-top:1rem;">
        <button class="btn" data-action="char-create"${dis(d.spentOS > total)}>Создать персонажа</button>
      </div>
    `));
  }

  function buyAbility(d, id) {
    mutate(() => {
      if (d.abilities.indexOf(id) !== -1) return;
      const cost = CALC.abilityCost(DATA, id);
      if (d.spentOS + cost > CALC.totalOS(d, DATA)) return;
      d.abilities.push(id);
      d.spentOS += cost;
    });
  }

  function sellAbility(d, id) {
    mutate(() => {
      const i = d.abilities.indexOf(id);
      if (i === -1) return;
      d.abilities.splice(i, 1);
      d.spentOS -= CALC.abilityCost(DATA, id);
    });
  }

  function osBonus(kind) {
    mutate(() => {
      const d = state.wizard.draft;
      if (d.spentOS + 1 > CALC.totalOS(d, DATA)) return;
      d.spentOS += 1;
      if (kind === 'hp') d.osBonuses.hp += 5;
      else { d.osBonuses.stamina += 1; d.osBonuses.mana += 1; }
    });
  }

  function potentialRoll() {
    mutate(() => {
      const n = 1 + Math.floor(Math.random() * 10);
      state.wizard.draft.potentialRolled = true;
      state.wizard.draft.potentialPoints = 10 + n;
      state.wizard.draft.potentialTo = null;
    });
  }

  function potentialTo(target) {
    mutate(() => { state.wizard.draft.potentialTo = target; });
  }

  function createChar() {
    const d = state.wizard.draft;
    if (d.spentOS > CALC.totalOS(d, DATA)) return;
    if (d.potentialTo === 'stamina' || d.potentialTo === 'mana') {
      d.osBonuses[d.potentialTo] += d.potentialPoints;
    }
    const c = STORE.normalize(d);
    c.id = STORE.newId();
    c.createdAt = c.updatedAt = Date.now();
    delete c.potentialRolled;
    delete c.potentialPoints;
    delete c.potentialTo;
    const ts = CALC.traits(c, DATA);
    const insp = ts.reduce((s, t) => s || (t.inspirationDaily || 0), 0);
    if (insp) c.inspiration = insp;
    c.hp.current = c.hp.max = CALC.maxHp(c, DATA);
    c.stamina.current = c.stamina.max = CALC.maxStamina(c, DATA);
    c.mana.current = c.mana.max = CALC.maxMana(c, DATA);
    mutate(() => {
      state.chars.push(c);
      state.currentId = c.id;
      state.screen = 'sheet';
    });
  }

  function wizardNav() {
    const w = state.wizard;
    return el(`
      <div class="row between" style="margin-top:1rem;">
        <button class="btn" data-action="wizard-back"${dis(w.step <= 1)}>← Назад</button>
        <button class="btn" data-action="wizard-next"${dis(!wizardCanNext())}>Далее →</button>
      </div>
    `);
  }

  function wizardCanNext() {
    const w = state.wizard;
    return w.step === 1 ? !!w.draft.raceId
      : w.step === 2 ? !!w.draft.statusId
      : w.step === 3 ? true
      : w.step === 4 ? true
      : w.step === 5 ? w.draft.specializations.length === specRequired(w.draft)
      : false;
  }

  function humanModal() {
    const chips = CALC.ATTRS.map(a => {
      const pick = a === humanPickA;
      return `<button class="btn" data-action="human-attr" data-id="${esc(a)}"${pick ? ' style="border:2px solid var(--accent)"' : ''}>${esc(a)}${pick ? ' (+3)' : ''}</button>`;
    });
    return el(`
      <div class="wizard-overlay" data-action="human-close" style="position:fixed;inset:0;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;z-index:50;padding:1rem;">
        <div class="card wizard-modal" style="max-width:600px;width:100%;" data-action="human-stop">
          <div class="row between">
            <h3>Люди: бонус к характеристикам</h3>
            <button class="btn btn-danger" data-action="human-close">×</button>
          </div>
          <p class="small muted">Выберите, как распределятся бонусы людей.</p>
          <div class="row">
            <button class="btn" data-action="human-all">+1 ко всем</button>
            <span class="muted small">или</span>
          </div>
          <p class="small" style="margin:0.75rem 0 0.25rem;">+3 и +2 к двум разным характеристикам:</p>
          <div class="row">${chips.join('')}</div>
        </div>
      </div>
    `);
  }

  function renderSheet(app) {
    app.appendChild(header());
    const page = el('<div class="page"></div>');
    const char = currentChar();
    if (!char) {
      page.appendChild(el('<div class="card"><p class="muted">Персонаж не найден.</p></div>'));
      app.appendChild(page);
      return;
    }
    page.appendChild(sheetHeader(char));
    page.appendChild(trackerBlock(char));
    page.appendChild(tabBar());
    if (state.tab === 'specs') renderSpecs(page, char);
    else if (state.tab === 'spells') renderSpells(page, char);
    else if (state.tab === 'refbook') renderRefbook(page);
    else if (state.tab === 'inventory') renderInventory(page, char);
    else if (state.tab === 'notes') renderNotes(page, char);
    else renderOverview(page, char);
    app.appendChild(page);
    if (weaponModalOpen) app.appendChild(weaponModal());
    if (condModalOpen) app.appendChild(condModal(char));
    if (exhModalOpen) app.appendChild(exhModal());
    if (levelUpOpen) { const lc = currentChar(); if (lc) app.appendChild(levelUpModal(lc)); }
  }

  function trackerBlock(char) {
    const ts = CALC.traits(char, DATA);
    const insp = ts.reduce((s, t) => s || (t.inspirationDaily || 0), 0);
    const rerollInit = ts.some(t => t.rerollInit);
    const card = el('<details class="card" open style="margin-bottom:1rem;"><summary style="cursor:pointer;font-weight:700;">Боевой трекер</summary></details>');
    card.appendChild(barRow(char, 'Хиты', char.hp, 'hp', true));
    card.appendChild(barRow(char, 'Запас сил', char.stamina, 'stamina', false));
    card.appendChild(barRow(char, 'Мана', char.mana, 'mana', false));
    if (char.hp.current <= 0) card.appendChild(deathPanel(char));
    const exhaustion = el(`
      <div class="row between" style="margin-top:0.75rem;padding-top:0.75rem;border-top:1px solid var(--border);">
        <span class="muted">Истощение</span>
        <div class="row">
          <button class="btn" data-action="exh-dec"${dis(char.exhaustion <= 0)}>−</button>
          <strong style="min-width:2rem;text-align:center;${char.exhaustion >= 6 ? 'color:var(--danger);' : ''}">${char.exhaustion}</strong>
          <button class="btn" data-action="exh-inc"${dis(char.exhaustion >= 6)}>+</button>
          <button class="btn" data-action="exh-open">Степени 1–6</button>
        </div>
      </div>
    `);
    card.appendChild(exhaustion);
    const injuries = el(`
      <div class="row" style="margin-top:0.75rem;padding-top:0.75rem;border-top:1px solid var(--border);">
        <span class="muted">Травмы</span>
        ${['head', 'arms', 'torso', 'legs'].map(k => `
          <label class="row" style="margin:0;gap:0.3rem;cursor:pointer;">
            <input type="checkbox" data-action="injury-set" data-id="${k}"${char.injuries[k] ? ' checked' : ''}>
            <span class="small">${esc(DATA.injuries[k].name)}</span>
          </label>
        `).join('')}
      </div>
    `);
    card.appendChild(injuries);
    const conds = el(`
      <div class="row" style="margin-top:0.75rem;padding-top:0.75rem;border-top:1px solid var(--border);align-items:flex-start;">
        <span class="muted">Состояния</span>
        ${char.conditions.map(id => {
          const c = DATA.conditions[id] || { name: id };
          return `<span class="chip">${esc(c.name)}<button class="chip-x" data-action="cond-del" data-id="${esc(id)}">×</button></span>`;
        }).join('')}
        <button class="btn" data-action="cond-open">+</button>
      </div>
    `);
    card.appendChild(conds);
    const hints = [];
    if (rerollInit) hints.push('Живчик: 3 броска d20, лучший');
    if (CALC.hasTrait(char, DATA, 't16')) hints.push('Параноик: −10');
    if (CALC.hasTrait(char, DATA, 't10')) hints.push('Косноязычный: −2 после вербального заклинания (вручную)');
    const initRow = el(`
      <div class="row" style="margin-top:0.75rem;padding-top:0.75rem;border-top:1px solid var(--border);">
        <button class="btn" data-action="init-roll">Бросок инициативы</button>
        <span class="small muted">d20 + скорость${rerollInit ? ' (3 броска)' : ''}${CALC.hasTrait(char, DATA, 't16') ? ' − 10' : ''}</span>
      </div>
    `);
    if (hints.length) {
      initRow.appendChild(el(`<p class="small muted" style="width:100%;margin:0.35rem 0 0;">${hints.map(esc).join('<br>')}</p>`));
    }
    card.appendChild(initRow);
    const turnRow = el(`
      <div class="row" style="margin-top:0.75rem;padding-top:0.75rem;border-top:1px solid var(--border);">
        <button class="btn" data-action="new-turn">Новый ход</button>
        ${insp ? `<button class="btn" data-action="new-day">Новый день</button>` : ''}
      </div>
    `);
    card.appendChild(turnRow);
    return card;
  }

  function barRow(char, label, pool, key, low) {
    const isLow = low && pool.max > 0 && pool.current <= pool.max / 3;
    const pct = pool.max > 0 ? Math.round((pool.current / pool.max) * 100) : 0;
    const editing = state.editingPool === key;
    const val = editing
      ? `<input class="field" type="number" min="0" max="${pool.max}" data-action="pool-set" data-id="${key}" value="${esc(pool.current)}" style="width:4.5rem;"> / ${pool.max}`
      : `<button class="pool-val" data-action="pool-edit" data-id="${key}" title="Нажмите, чтобы ввести вручную">${pool.current} / ${pool.max}</button>`;
    return el(`
      <div style="margin:0.6rem 0;">
        <div class="row between">
          <strong>${esc(label)}</strong>
          <span class="muted small">${val}${isLow ? ' · низкий уровень: скорость и уклонение вдвое' : ''}</span>
        </div>
        <div class="bar"><div class="bar-fill" style="width:${Math.max(0, Math.min(100, pct))}%;${isLow ? 'background:var(--danger);' : ''}"></div></div>
        <div class="row" style="margin-top:0.35rem;">
          <button class="btn" data-action="pool-dec" data-id="${key}">−1</button>
          <button class="btn" data-action="pool-dec5" data-id="${key}">−5</button>
          <button class="btn" data-action="pool-inc" data-id="${key}">+1</button>
          <button class="btn" data-action="pool-rest" data-id="${key}">Восстановить</button>
        </div>
      </div>
    `);
  }

  function deathPanel(char) {
    const dots = key => [1, 2, 3].map(i => `
      <button class="dot${char.deathSaves[key] >= i ? ' on' : ''}" data-action="death-toggle" data-id="${key}" data-index="${i}" title="${key === 'success' ? 'Успех' : 'Провал'}"></button>
    `).join('');
    return el(`
      <div class="card" style="margin-top:0.75rem;background:#f6e3da;">
        <div class="row between">
          <strong>Спасброски от смерти</strong>
          ${char.deathSaves.fail >= 2 ? '<span class="badge">СМЕРТЬ</span>' : ''}
        </div>
        <div class="row" style="margin-top:0.5rem;">
          <span class="small muted">Успех</span>${dots('success')}
          <span class="small muted" style="margin-left:0.75rem;">Провал</span>${dots('fail')}
        </div>
        <p class="small muted" style="margin:0.5rem 0 0;">2 провала — смерть персонажа.</p>
      </div>
    `);
  }

  function condModal(char) {
    const list = Object.keys(DATA.conditions).map(id => {
      const c = DATA.conditions[id];
      const on = char.conditions.indexOf(id) !== -1;
      return `
        <div class="card${on ? ' card-on' : ''}" data-action="cond-toggle" data-id="${esc(id)}" style="cursor:pointer;margin:0.25rem;">
          <div class="row between"><strong>${esc(c.name)}</strong><span class="small muted">${on ? 'вкл' : 'выкл'}</span></div>
          <p class="small muted" style="margin:0.25rem 0 0;">${esc(c.desc)}</p>
        </div>
      `;
    }).join('');
    return el(`
      <div class="wizard-overlay" data-action="cond-close" style="position:fixed;inset:0;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;z-index:50;padding:1rem;">
        <div class="card wizard-modal" data-action="cond-stop" style="max-width:640px;width:100%;max-height:80vh;overflow:auto;">
          <div class="row between">
            <h3>Состояния</h3>
            <button class="btn btn-danger" data-action="cond-close">×</button>
          </div>
          <div class="grid" style="grid-template-columns:1fr;">${list}</div>
        </div>
      </div>
    `);
  }

  function exhModal() {
    const list = [1, 2, 3, 4, 5, 6].map(n => {
      const e = DATA.exhaustion[n];
      return `<div class="card" style="margin:0.25rem;"><strong>${esc(n)} — ${esc(e.name)}</strong><p class="small muted" style="margin:0.25rem 0 0;">${esc(e.desc)}</p></div>`;
    }).join('');
    return el(`
      <div class="wizard-overlay" data-action="exh-close" style="position:fixed;inset:0;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;z-index:50;padding:1rem;">
        <div class="card wizard-modal" data-action="exh-stop" style="max-width:520px;width:100%;max-height:80vh;overflow:auto;">
          <div class="row between">
            <h3>Степени истощения</h3>
            <button class="btn btn-danger" data-action="exh-close">×</button>
          </div>
          ${list}
        </div>
      </div>
    `);
  }

  function renderRefbook(container) {
    const q = String(state.refQuery || '').trim().toLowerCase();
    const open = q.length > 0;
    container.appendChild(el(`
      <div>
        <h3 style="margin:0 0 0.75rem;">Справочник</h3>
        <input class="field" style="width:100%;margin-bottom:1rem;" data-action="ref-search" placeholder="Поиск по всем разделам" value="${esc(state.refQuery)}">
      </div>
    `));
    const hit = (text) => !q || String(text || '').toLowerCase().indexOf(q) !== -1;
    const itemHtml = (name, body) => hit(name) || hit(body)
      ? `<div class="card" style="margin:0.35rem 0;"><strong>${esc(name)}</strong>${body ? `<p class="small muted" style="margin:0.35rem 0 0;">${esc(body).split('\n').join('<br>')}</p>` : ''}</div>`
      : '';
    const section = (title, html) => el(`
      <details class="card" style="margin-bottom:0.75rem;"${open ? ' open' : ''}>
        <summary style="cursor:pointer;font-weight:700;">${esc(title)}</summary>
        <div style="margin-top:0.5rem;">${html}</div>
      </details>
    `);
    let html;
    html = '';
    for (const id in DATA.conditions) {
      const c = DATA.conditions[id];
      html += itemHtml(c.name, c.desc);
    }
    if (q && !html) html = '<p class="small muted">Ничего не найдено.</p>';
    container.appendChild(section('Состояния (' + Object.keys(DATA.conditions).length + ')', html));
    html = '';
    for (const id in DATA.injuries) {
      const i = DATA.injuries[id];
      html += itemHtml(i.name, i.desc);
    }
    if (q && !html) html = '<p class="small muted">Ничего не найдено.</p>';
    container.appendChild(section('Травмы (' + Object.keys(DATA.injuries).length + ')', html));
    html = '';
    for (let n = 1; n <= 6; n++) {
      const e = DATA.exhaustion[n];
      if (e) html += itemHtml(n + ' — ' + e.name, e.desc);
    }
    if (q && !html) html = '<p class="small muted">Ничего не найдено.</p>';
    container.appendChild(section('Истощение (' + Object.keys(DATA.exhaustion).length + ')', html));
    html = '';
    for (const id in DATA.traits) {
      const t = DATA.traits[id];
      html += itemHtml(t.num + ' — ' + t.name, t.quote + '\n' + t.desc);
    }
    if (q && !html) html = '<p class="small muted">Ничего не найдено.</p>';
    container.appendChild(section('Черты (' + Object.keys(DATA.traits).length + ')', html));
    html = '';
    for (const id in DATA.races) {
      const r = DATA.races[id];
      const parts = ['Кость хитов: d' + r.hitDie, 'Размер: ' + r.size, 'Жизнь: ' + (r.lifespan || '—')];
      if (r.bonuses) parts.push(Object.keys(r.bonuses).map(k => '+' + r.bonuses[k] + ' ' + k).join(', '));
      if (r.bonusMode === 'choice') parts.push('Бонус на выбор: +1 ко всем или +3/+2 к двум');
      if (r.attrCaps) parts.push('Потолки: ' + Object.keys(r.attrCaps).map(k => k + ' ≤ ' + r.attrCaps[k]).join(', '));
      html += itemHtml(r.name, parts.join(' · '));
    }
    if (q && !html) html = '<p class="small muted">Ничего не найдено.</p>';
    container.appendChild(section('Расы (' + Object.keys(DATA.races).length + ')', html));
    html = '';
    for (const id in DATA.statuses) {
      const s = DATA.statuses[id];
      const parts = [s.text];
      for (const k in (s.bonuses || {})) parts.push('+' + s.bonuses[k] + ' ' + k);
      if (s.staminaBonus) parts.push('+' + s.staminaBonus + ' к запасу сил');
      if (s.manaBonus) parts.push('+' + s.manaBonus + ' к мане');
      const trained = [].concat(
        (s.skills || []).map(x => (DATA.skills[x] || {}).name),
        (s.lores || []).map(x => (DATA.lores[x] || {}).name),
        (s.crafts || []).map(x => (DATA.crafts[x] || {}).name)
      ).filter(Boolean);
      if (trained.length) parts.push('Владения: ' + trained.join(', '));
      html += itemHtml(s.name, parts.join('\n'));
    }
    if (q && !html) html = '<p class="small muted">Ничего не найдено.</p>';
    container.appendChild(section('Статусы (' + Object.keys(DATA.statuses).length + ')', html));
    html = '';
    for (const id in DATA.specializations) {
      const s = DATA.specializations[id];
      html += itemHtml(s.name + (s.somatic ? ' (телесная)' : ' (приобретённая)') + (s.empty ? ' — ждём редакций' : ''), s.desc || '');
    }
    if (q && !html) html = '<p class="small muted">Ничего не найдено.</p>';
    container.appendChild(section('Специализации (' + Object.keys(DATA.specializations).length + ')', html));
  }

  function renderNotes(container, char) {
    container.appendChild(section('Заметки', el(`
      <div>
        <textarea class="field" rows="14" style="width:100%;resize:vertical;" data-action="notes-input" placeholder="Запишите всё, что важно для персонажа...">${esc(char.notes)}</textarea>
      </div>
    `)));
  }

  function notesInput(v) {
    const char = currentChar();
    if (!char) return;
    if (notesTimer) clearTimeout(notesTimer);
    notesTimer = setTimeout(() => {
      notesTimer = null;
      mutate(() => { char.notes = String(v || ''); });
    }, 300);
  }

  function calcFull(char) {
    const out = {
      hp: CALC.maxHp(char, DATA),
      stamina: CALC.maxStamina(char, DATA),
      mana: CALC.maxMana(char, DATA),
      speed: CALC.speed(char, DATA),
      ac: CALC.ac(char, DATA),
      mods: CALC.mods(char, DATA),
      attrFinal: CALC.attrFinal(char, DATA),
    };
    char.hp.max = out.hp;
    char.stamina.max = out.stamina;
    char.mana.max = out.mana;
    return out;
  }

  function sheetHeader(char) {
    const race = CALC.race(char, DATA);
    const st = CALC.status(char, DATA);
    const parts = [race ? race.name : '—', st ? st.name : '—', 'ур. ' + char.level];
    return el(`
      <div class="card" style="margin-bottom:1rem;">
        <div class="row between">
          <input class="field" type="text" data-action="name-set" value="${esc(char.name)}" placeholder="Имя персонажа" style="font-size:1.15rem;font-weight:700;">
          <div class="row">
            <span class="muted small">${esc(parts.join(' · '))}</span>
            <button class="btn" data-action="levelup"${dis(char.level >= 20)}>Повысить уровень</button>
          </div>
        </div>
      </div>
    `);
  }

  function tabBar() {
    const tabs = [['overview', 'Обзор'], ['inventory', 'Инвентарь'], ['specs', 'Специализации'], ['spells', 'Заклинания'], ['refbook', 'Справочник'], ['notes', 'Заметки']];
    return el(`
      <div class="tabs">
        ${tabs.map(([id, name]) => `<button class="tab${state.tab === id ? ' active' : ''}" data-action="tab" data-id="${id}">${esc(name)}</button>`).join('')}
      </div>
    `);
  }

  function tabSet(id) {
    state.tab = id;
    state.editingPool = null;
    weaponModalOpen = false;
    condModalOpen = false;
    exhModalOpen = false;
    render();
  }

  function tierRange(t) {
    const lo = 5 * t - 4, hi = 5 * t;
    return 'уровень ' + lo + '–' + hi;
  }

  const MAGIC_SPECS = ['manifestation', 'restoration', 'transmutation', 'illusion', 'warding', 'antimagic', 'curses'];

  function costLabel(ab) {
    if (ab.cost && typeof ab.cost === 'object') {
      return Object.keys(ab.cost).map(k => {
        const v = ab.cost[k];
        const unit = k === 'mana' ? 'маны' : 'запаса сил';
        return typeof v === 'number' ? v + ' ' + unit : String(v);
      }).join(', ');
    }
    return '—';
  }

  function renderSpells(container, char) {
    const total = CALC.totalOS(char, DATA);
    const q = String(state.spellQuery || '').trim().toLowerCase();
    container.appendChild(el(`
      <div class="row between" style="margin-bottom:0.75rem;">
        <h3 style="margin:0;">Заклинания</h3>
        <span class="muted">ОС: ${char.spentOS} / ${total}</span>
      </div>
    `));
    container.appendChild(el(`
      <input class="field" style="width:100%;margin-bottom:1rem;" data-action="spell-search" placeholder="Поиск по названию или тексту" value="${esc(state.spellQuery)}">
    `));
    for (const sid of MAGIC_SPECS) {
      const spec = DATA.specializations[sid];
      if (!spec) continue;
      const card = el('<div class="card" style="margin-bottom:1rem;"></div>');
      card.appendChild(el(`<h3 style="margin-top:0;">${esc(spec.name)}</h3>`));
      let shown = 0;
      for (let t = 1; t <= 4; t++) {
        const ids = Object.keys(DATA.allAbilities).filter(id => {
          const ab = DATA.allAbilities[id];
          return ab && ab.specId === sid && ab.tier === t;
        });
        if (!ids.length) continue;
        const group = el(`<h4 style="margin:0.75rem 0 0.25rem;">Тир ${t} <span class="muted small">(${tierRange(t)})</span></h4>`);
        let groupShown = 0;
        for (const id of ids) {
          const ab = DATA.allAbilities[id];
          if (q && ab.name.toLowerCase().indexOf(q) === -1 && String(ab.desc || '').toLowerCase().indexOf(q) === -1) continue;
          group.appendChild(spellCard(char, id));
          groupShown++;
        }
        if (groupShown) {
          card.appendChild(group);
          shown += groupShown;
        }
      }
      if (!shown) {
        card.appendChild(el(`<p class="small muted">${q ? 'Ничего не найдено по запросу «' + esc(state.spellQuery) + '».' : 'В этой школе пока нет заклинаний.'}</p>`));
      }
      container.appendChild(card);
    }
  }

  function spellCard(char, id) {
    const ab = DATA.allAbilities[id];
    const tierMax = CALC.tier(char.level);
    const cost = CALC.abilityCost(DATA, id);
    const owned = char.abilities.indexOf(id) !== -1;
    let btn;
    if (owned) {
      btn = '<span class="badge" style="background:var(--success);">Выучено</span>';
    } else if (ab.tier > tierMax) {
      btn = `<button class="btn" data-action="spell-buy" data-id="${esc(id)}" disabled style="opacity:0.55;cursor:default;">Требуется тир ${ab.tier} (${esc(tierRange(ab.tier))})</button>`;
    } else if (char.spentOS + cost > CALC.totalOS(char, DATA)) {
      btn = `<button class="btn" data-action="spell-buy" data-id="${esc(id)}" disabled style="opacity:0.55;cursor:default;">Не хватает ОС</button>`;
    } else {
      btn = `<button class="btn" data-action="spell-buy" data-id="${esc(id)}">Выучить</button>`;
    }
    const fields = [
      ab.tier ? 'Тир ' + ab.tier : '',
      ab.type === 'passive' ? 'пассивное' : 'активное',
      ab.components ? 'Компоненты: ' + ab.components : '',
      'Затрата: ' + costLabel(ab),
      ab.castTime ? 'Время: ' + ab.castTime : '',
      ab.duration ? 'Длительность: ' + ab.duration : '',
      ab.range ? 'Дистанция: ' + ab.range : '',
    ].filter(Boolean);
    return el(`
      <div class="card" style="margin:0.5rem 0;">
        <div class="row between">
          <strong>${esc(ab.name)}</strong>
          ${btn}
        </div>
        ${fields.length ? `<p class="small muted" style="margin:0.35rem 0 0;">${fields.map(esc).join(' · ')}</p>` : ''}
        <details style="margin-top:0.4rem;">
          <summary class="small muted" style="cursor:pointer;">Текст заклинания</summary>
          <p class="small" style="margin:0.35rem 0 0;">${esc(ab.desc)}</p>
        </details>
      </div>
    `);
  }

  function abilityCostLabel(id) {
    const cost = CALC.abilityCost(DATA, id);
    const ab = DATA.allAbilities[id];
    const spec = ab && DATA.specializations[ab.specId];
    return (spec && spec.somatic) ? cost + ' ОС' : '1 ОС за 2 способности';
  }

  function renderSpecs(container, char) {
    const total = CALC.totalOS(char, DATA);
    container.appendChild(el(`
      <div class="row between" style="margin-bottom:0.75rem;">
        <h3 style="margin:0;">Специализации и способности</h3>
        <span class="muted">ОС: ${char.spentOS} / ${total}</span>
      </div>
    `));
    for (const sid of char.specializations) {
      const spec = DATA.specializations[sid];
      if (!spec) continue;
      const card = el(`<details class="card" style="margin-bottom:1rem;" ${state.collapsedSpecs[sid] ? '' : 'open'}><summary data-action="spec-toggle" data-id="${esc(sid)}" style="cursor:pointer;font-weight:700;">${esc(spec.name)} <span class="muted small">${spec.somatic ? 'телесная' : 'приобретённая'}${spec.empty ? ' · ждём редакций' : ''}</span></summary></details>`);
      if (spec.empty) {
        card.appendChild(customAbilitiesBlock(char, sid));
      } else {
        for (let t = 1; t <= 4; t++) {
          const ids = Object.keys(DATA.allAbilities).filter(id => {
            const ab = DATA.allAbilities[id];
            return ab && ab.specId === sid && ab.tier === t;
          });
          if (!ids.length) continue;
          card.appendChild(el(`<h4 style="margin:0.75rem 0 0.25rem;">Тир ${t} <span class="muted small">(${tierRange(t)})</span></h4>`));
          for (const id of ids) card.appendChild(abilityCard(char, id));
        }
      }
      container.appendChild(card);
    }
    const known = char.specializations;
    const available = Object.keys(DATA.specializations).filter(id => known.indexOf(id) === -1);
    if (available.length) {
      const learn = el('<div class="card" style="margin-bottom:1rem;"></div>');
      learn.appendChild(el('<h3 style="margin-top:0;">Изучить специализацию</h3>'));
      learn.appendChild(el(`<p class="small muted">Телесная — 1 ОС, приобретённая — 1 ОС за 2. ${esc(tierRange(1))}.</p>`));
      const row = el('<div class="row"></div>');
      for (const id of available) {
        const s = DATA.specializations[id];
        const cost = s.somatic ? 1 : 0.5;
        row.appendChild(el(`
          <button class="btn" data-action="spec-learn" data-id="${esc(id)}"${dis(char.spentOS + cost > total)}>
            + ${esc(s.name)} (${cost} ОС)
          </button>
        `));
      }
      learn.appendChild(row);
      container.appendChild(learn);
    }
    container.appendChild(osBonusesBlock(char));
  }

  function abilityCard(char, id) {
    const ab = DATA.allAbilities[id];
    const tierMax = CALC.tier(char.level);
    const cost = CALC.abilityCost(DATA, id);
    const owned = char.abilities.indexOf(id) !== -1;
    let btn;
    if (owned) {
      btn = `<button class="btn btn-danger" data-action="ab-sell" data-id="${esc(id)}">Отдать</button>`;
    } else if (ab.tier > tierMax) {
      btn = `<button class="btn" data-action="ab-buy" data-id="${esc(id)}" disabled style="opacity:0.55;cursor:default;">Требуется тир ${ab.tier} (${esc(tierRange(ab.tier))})</button>`;
    } else if (char.spentOS + cost > CALC.totalOS(char, DATA)) {
      btn = `<button class="btn" data-action="ab-buy" data-id="${esc(id)}" disabled style="opacity:0.55;cursor:default;">Не хватает ОС</button>`;
    } else {
      btn = `<button class="btn" data-action="ab-buy" data-id="${esc(id)}">Взять</button>`;
    }
    return el(`
      <div class="card" style="margin:0.5rem 0;">
        <div class="row between">
          <strong>${esc(ab.name)} <span class="muted small">Тир ${ab.tier} · ${ab.type === 'passive' ? 'пассивная' : 'активная'} · ${esc(abilityCostLabel(id))}</span></strong>
          ${btn}
        </div>
        <details style="margin-top:0.4rem;" ${state.openDescs[id] ? 'open' : ''}>
          <summary class="small muted" data-action="desc-toggle" data-id="${esc(id)}" style="cursor:pointer;">Описание</summary>
          <p class="small" style="margin:0.35rem 0 0;">${esc(ab.desc)}</p>
        </details>
      </div>
    `);
  }

  function customAbilitiesBlock(char, specId) {
    const box = el('<div></div>');
    const list = char.customAbilities.filter(a => a.specId === specId);
    if (!list.length) {
      box.appendChild(el('<p class="small muted">Своих способностей пока нет.</p>'));
    }
    list.forEach((a, i) => {
      const fullIdx = char.customAbilities.indexOf(a);
      box.appendChild(el(`
        <div class="card" style="margin:0.5rem 0;">
          <div class="row between">
            <strong>${esc(a.name)} <span class="muted small">Тир ${esc(a.tier)} · ${esc(a.type === 'passive' ? 'пассивная' : 'активная')} · ${esc(a.cost)}</span></strong>
            <button class="btn btn-danger" data-action="custom-del" data-id="${fullIdx}">Убрать</button>
          </div>
          ${a.desc ? `<p class="small muted" style="margin:0.35rem 0 0;">${esc(a.desc)}</p>` : ''}
        </div>
      `));
    });
    box.appendChild(el(`
      <div class="custom-form">
        <div class="row" style="margin-top:0.5rem;">
          <input class="field" style="flex:1;" placeholder="Название" data-action="c-name">
          <select class="field" data-action="c-tier">
            <option value="1">Тир 1</option>
            <option value="2">Тир 2</option>
            <option value="3">Тир 3</option>
            <option value="4">Тир 4</option>
          </select>
          <select class="field" data-action="c-type">
            <option value="active">Активная</option>
            <option value="passive">Пассивная</option>
          </select>
        </div>
        <div class="row" style="margin-top:0.5rem;">
          <input class="field" style="flex:1;" placeholder="Затраты (например: 2 маны)" data-action="c-cost">
          <input class="field" style="flex:1;" placeholder="Текст способности" data-action="c-desc">
        </div>
        <div class="row" style="margin-top:0.5rem;">
          <button class="btn" data-action="custom-add" data-id="${esc(specId)}">Добавить свою</button>
        </div>
      </div>
    `));
    return box;
  }

  function osBonusesBlock(char) {
    return el(`
      <div class="card" style="margin-bottom:1rem;">
        <h3 style="margin-top:0;">Бонусы за ОС</h3>
        <p class="small muted" style="margin:0 0 0.5rem;">За 1 ОС: +1 к запасу сил и +1 к мане, либо +5 хитпоинтов.</p>
        <div class="row">
          <button class="btn" data-action="os-plus" data-id="both"${dis(char.spentOS + 1 > CALC.totalOS(char, DATA))}>+1 ЗС и +1 мана</button>
          <button class="btn" data-action="os-minus" data-id="both"${dis(char.spentOS <= 0 || char.osBonuses.stamina <= 0 || char.osBonuses.mana <= 0)}>− возврат</button>
          <button class="btn" data-action="os-plus" data-id="hp"${dis(char.spentOS + 1 > CALC.totalOS(char, DATA))}>+5 HP</button>
          <button class="btn" data-action="os-minus" data-id="hp"${dis(char.spentOS <= 0 || char.osBonuses.hp <= 0)}>− возврат</button>
        </div>
        <p class="small muted" style="margin-top:0.5rem;">Бонусы: ЗС +${char.osBonuses.stamina} · Мана +${char.osBonuses.mana} · HP +${char.osBonuses.hp}</p>
      </div>
    `);
  }

  function learnSpec(char, id) {
    if (char.specializations.indexOf(id) !== -1) return;
    const s = DATA.specializations[id];
    if (!s) return;
    if (char.raceId === 'gnome' && s.somatic) return;
    const cost = s.somatic ? 1 : 0.5;
    mutate(() => {
      if (char.spentOS + cost > CALC.totalOS(char, DATA)) return;
      char.specializations.push(id);
      char.spentOS += cost;
    });
  }

  function addCustomAbility(char, specId, btn) {
    const form = btn.closest('.custom-form');
    if (!form) return;
    const val = a => {
      const f = form.querySelector('[data-action="' + a + '"]');
      return f ? String(f.value || '').trim() : '';
    };
    const name = val('c-name');
    if (!name) { toast('Укажите название способности', 'error'); return; }
    mutate(() => {
      char.customAbilities.push({
        specId,
        name,
        tier: Math.max(1, Math.min(4, parseInt(val('c-tier'), 10) || 1)),
        type: val('c-type') === 'passive' ? 'passive' : 'active',
        cost: val('c-cost'),
        desc: val('c-desc'),
      });
    });
  }

  function removeCustomAbility(char, idx) {
    mutate(() => { char.customAbilities.splice(idx, 1); });
  }

  function osBonusChar(char, kind, dir) {
    mutate(() => {
      const total = CALC.totalOS(char, DATA);
      if (dir > 0) {
        if (char.spentOS + 1 > total) return;
        char.spentOS += 1;
        if (kind === 'hp') char.osBonuses.hp += 5;
        else { char.osBonuses.stamina += 1; char.osBonuses.mana += 1; }
      } else {
        if (char.spentOS <= 0) return;
        if (kind === 'hp') {
          if (char.osBonuses.hp <= 0) return;
          char.osBonuses.hp -= 5;
        } else {
          if (char.osBonuses.stamina <= 0 || char.osBonuses.mana <= 0) return;
          char.osBonuses.stamina -= 1;
          char.osBonuses.mana -= 1;
        }
        char.spentOS -= 1;
      }
    });
  }

  function section(title, body, open) {
    const s = el(`<details class="card"${open === false ? '' : ' open'}><summary>${esc(title)}</summary></details>`);
    s.appendChild(body);
    return s;
  }

  function renderOverview(page, char) {
    const out = calcFull(char);
    const grid = el('<div class="sheet-grid"></div>');
    grid.appendChild(section('Характеристики', attrsBlock(char, out)));
    grid.appendChild(section('Боевые параметры', battleBlock(char, out)));
    grid.appendChild(section('Оружие', weaponsBlock(char)));
    grid.appendChild(section('Доспех и щит', armorBlock(char)));
    grid.appendChild(section('Черта и статус', traitBlock(char)));
    grid.appendChild(section('Дайсеры', diceBlock(char)));
    page.appendChild(grid);
  }

  function attrsBlock(char, out) {
    const box = el('<div></div>');
    for (const a of CALC.ATTRS) {
      const m = out.mods[a];
      box.appendChild(el(`
        <div class="row between" style="padding:0.3rem 0;border-bottom:1px solid var(--border);">
          <div>
            <strong>${esc(a)}</strong>
            <span class="small muted">финал ${out.attrFinal[a]} · мод ${m >= 0 ? '+' : ''}${m}</span>
          </div>
          <input class="field" type="number" min="1" max="30" data-action="attr-set" data-id="${esc(a)}" value="${esc(char.attrs[a])}" style="width:4.5rem;">
        </div>
      `));
    }
    return box;
  }

  function battleBlock(char, out) {
    const rows = [
      ['Хиты', String(out.hp)],
      ['Запас сил', String(out.stamina)],
      ['Мана', String(out.mana)],
      ['КД', String(out.ac)],
      ['Скорость', out.speed + ' клетки'],
    ];
    const box = el('<div></div>');
    for (const [k, v] of rows) {
      box.appendChild(el(`<div class="row between" style="padding:0.3rem 0;border-bottom:1px solid var(--border);"><span class="muted">${esc(k)}</span><strong>${esc(v)}</strong></div>`));
    }
    box.appendChild(el(`
      <div class="row between" style="padding:0.3rem 0;">
        <span class="muted">Уровневый бонус</span>
        <input class="field" type="number" min="0" max="20" data-action="mastery-set" value="${esc(char.masteryBonus)}" style="width:4.5rem;">
      </div>
    `));
    return box;
  }

  function isCrossbow(w) {
    const tag = ((w.id || '') + ' ' + (w.kind || '') + ' ' + (w.name || '')).toLowerCase();
    return tag.indexOf('crossbow') !== -1 || tag.indexOf('арбалет') !== -1;
  }

  function weaponBase(w) {
    return (w.id && DATA.weapons[w.id]) ? DATA.weapons[w.id] : w;
  }

  function weaponsBlock(char) {
    const box = el('<div></div>');
    const aggressive = CALC.hasTrait(char, DATA, 't7');
    char.weapons.forEach((w, i) => {
      const base = weaponBase(w);
      const cross = isCrossbow(base);
      const atk = (base.speed || 1) + (aggressive && !cross ? 1 : 0);
      box.appendChild(el(`
        <div class="card" style="margin:0.5rem 0;">
          <div class="row between">
            <strong>${esc(base.name || 'Оружие')} <span class="muted small">${esc(base.kind || '')}</span></strong>
            <button class="btn btn-danger" data-action="weapon-del" data-id="${i}">Удалить</button>
          </div>
          <p class="small muted" style="margin:0.35rem 0 0;">Атак/ход: ${atk}${aggressive && !cross ? ' (+1 Агрессивный)' : ''}</p>
          <p class="small muted" style="margin:0.35rem 0 0;">Свойства: ${base.props ? esc(base.props) : '—'}</p>
          <p class="small muted" style="margin:0.35rem 0 0;">Досягаемость: ${esc(base.reach || '—')}</p>
          <p class="small" style="margin:0.35rem 0 0;">Урон: ${esc(base.damage || '—')}${aggressive ? ' · ×2 куба (Агрессивный)' : ''}</p>
        </div>
      `));
    });
    box.appendChild(el(`<div class="row"><button class="btn" data-action="weapon-add">Добавить оружие</button></div>`));
    return box;
  }

  function weaponModal() {
    const stock = Object.keys(DATA.weapons).map(id => {
      const w = DATA.weapons[id];
      return `<button class="btn" data-action="weapon-stock" data-id="${esc(id)}">${esc(w.name)}</button>`;
    }).join('');
    return el(`
      <div class="wizard-overlay" data-action="weapon-close" style="position:fixed;inset:0;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;z-index:50;padding:1rem;">
        <div class="card wizard-modal" data-action="weapon-stop" style="max-width:640px;width:100%;max-height:80vh;overflow:auto;">
          <div class="row between">
            <h3>Добавить оружие</h3>
            <button class="btn btn-danger" data-action="weapon-close">×</button>
          </div>
          <p class="small muted" style="margin:0.75rem 0 0.25rem;">Из книги:</p>
          <div class="row" style="max-height:220px;overflow:auto;">${stock}</div>
          <p class="small muted" style="margin:0.75rem 0 0.25rem;">Своё оружие:</p>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;">
            <input class="field" placeholder="Название" data-action="wc-name">
            <input class="field" placeholder="Тип" data-action="wc-kind">
            <input class="field" type="number" min="1" max="10" placeholder="Атак/ход" data-action="wc-speed">
            <input class="field" placeholder="Свойства" data-action="wc-props">
            <input class="field" placeholder="Досягаемость" data-action="wc-reach">
            <input class="field" placeholder="Урон" data-action="wc-damage">
          </div>
          <div class="row" style="margin-top:0.75rem;">
            <button class="btn" data-action="weapon-custom">Добавить своё</button>
          </div>
        </div>
      </div>
    `);
  }

  function weaponCustom(btn) {
    const modal = btn.closest('.wizard-modal');
    const val = name => {
      const f = modal.querySelector('[data-action="' + name + '"]');
      return f ? String(f.value || '').trim() : '';
    };
    const name = val('wc-name');
    if (!name) { toast('Укажите название оружия', 'error'); return; }
    mutate(() => {
      currentChar().weapons.push({
        name,
        kind: val('wc-kind'),
        speed: Math.max(1, parseInt(val('wc-speed'), 10) || 1),
        props: val('wc-props'),
        reach: val('wc-reach'),
        damage: val('wc-damage'),
      });
    });
    weaponModalOpen = false;
    render();
  }

  function armorBlock(char) {
    const box = el('<div></div>');
    const armorOpts = [['', '—']].concat(Object.keys(DATA.armor).map(id => [id, DATA.armor[id].name])).concat([['custom', 'Кастомная броня…']]);
    const shieldOpts = [['', '—']].concat(Object.keys(DATA.shield).map(id => [id, DATA.shield[id].name]));
    box.appendChild(el(`
      <div class="row">
        <span class="muted">Доспех</span>
        <select class="field" data-action="armor-set">
          ${armorOpts.map(([id, name]) => `<option value="${esc(id)}"${char.armor && char.armor.id === id ? ' selected' : ''}>${esc(name)}</option>`).join('')}
        </select>
        <span class="muted">Щит</span>
        <select class="field" data-action="shield-set">
          ${shieldOpts.map(([id, name]) => `<option value="${esc(id)}"${char.shield && char.shield.id === id ? ' selected' : ''}>${esc(name)}</option>`).join('')}
        </select>
      </div>
    `));
    if (char.armor && char.armor.id === 'custom') {
      const a = char.armor;
      box.appendChild(el(`
        <div class="row" style="margin-top:0.5rem;">
          <input class="field" style="flex:1;" data-action="armor-label-set" value="${esc(a.label || '')}" placeholder="Название брони">
          <input class="field" type="number" min="10" max="30" data-action="armor-ac-set" value="${esc(a.ac != null ? a.ac : 10)}" style="width:5rem;" title="КД">
        </div>
      `));
      box.appendChild(el(`<p class="small muted" style="margin:0.5rem 0 0;">Кастомная броня (КД ${a.ac != null ? a.ac : 10}): ${esc(a.label || 'без названия')}.</p>`));
    } else {
      const a = char.armor && DATA.armor[char.armor.id];
      if (a) box.appendChild(el(`<p class="small muted" style="margin:0.5rem 0 0;">${esc(a.name)} (КД ${a.ac}): ${esc(a.penalties)}</p>`));
    }
    return box;
  }

  function renderInventory(container, char) {
    const weight = CALC.inventoryWeight(char);
    container.appendChild(el(`
      <div class="row between" style="margin-bottom:0.75rem;">
        <h3 style="margin:0;">Инвентарь</h3>
        <span class="muted small">Суммарный вес: ${weight}</span>
      </div>
    `));
    container.appendChild(el(`
      <div class="card" style="margin-bottom:1rem;">
        <div class="row">
          <input class="field" style="flex:1;" data-action="inv-name" placeholder="Название">
          <input class="field" type="number" min="0" data-action="inv-qty" value="1" style="width:4rem;" title="Количество">
          <input class="field" type="number" min="0" step="0.1" data-action="inv-weight" placeholder="вес" style="width:5rem;" title="Вес">
          <button class="btn" data-action="inv-add">Добавить</button>
        </div>
        <textarea class="field" style="width:100%;margin-top:0.35rem;" data-action="inv-desc" placeholder="Описание..."></textarea>
      </div>
    `));
    if (!char.inventory.length) {
      container.appendChild(el('<p class="small muted">Инвентарь пуст.</p>'));
      return;
    }
    char.inventory.forEach((it, i) => {
      const o = (typeof it === 'string') ? { name: it, desc: '', qty: 1, weight: 0 } : it;
      const w = parseFloat(o.weight) || 0;
      const q = parseInt(o.qty, 10) || 0;
      container.appendChild(el(`
        <div class="card" style="margin-bottom:0.5rem;">
          <div class="row" style="align-items:center;">
            <input class="field" style="flex:1;" data-action="inv-name-set" data-id="${i}" value="${esc(o.name || '')}">
            <input class="field" type="number" min="0" data-action="inv-qty-set" data-id="${i}" value="${q}" style="width:4rem;" title="Количество">
            <span class="small muted" style="margin:0 0.25rem;">вес</span>
            <input class="field" type="number" min="0" step="0.1" data-action="inv-weight-set" data-id="${i}" value="${w}" style="width:5rem;">
            <button class="btn btn-danger" data-action="inv-del" data-id="${i}">Удалить</button>
          </div>
          <textarea class="field" style="width:100%;margin-top:0.35rem;resize:vertical;" data-action="inv-desc-set" data-id="${i}" placeholder="Описание...">${esc(o.desc || '')}</textarea>
        </div>
      `));
    });
  }

  function traitBlock(char) {
    const box = el('<div></div>');
    const ts = CALC.traits(char, DATA);
    const s = CALC.status(char, DATA);
    if (ts.length) {
      ts.forEach(t => box.appendChild(el(`
        <div class="card" style="margin:0.5rem 0;">
          <h4 style="margin:0;">Черта: ${esc(t.name)}</h4>
          <p class="small muted" style="margin:0.35rem 0;">«${esc(t.quote)}»</p>
          <p class="small">${esc(t.desc)}</p>
        </div>
      `)));
    } else {
      box.appendChild(el('<p class="small muted">Черта не выбрана.</p>'));
    }
    if (s) {
      box.appendChild(el(`
        <div class="card" style="margin:0.5rem 0;">
          <h4 style="margin:0;">Статус: ${esc(s.name)}</h4>
          <p class="small">${esc(s.text)}</p>
        </div>
      `));
    } else {
      box.appendChild(el('<p class="small muted">Статус не выбран.</p>'));
    }
    return box;
  }

  function diceBlock(char) {
    const insp = CALC.traits(char, DATA).reduce((s, t) => s || (t.inspirationDaily || 0), 0);
    const box = el('<div></div>');
    box.appendChild(el(`
      <div class="row">
        ${['d4', 'd6', 'd8', 'd10', 'd12', 'd20'].map(d => `<button class="btn" data-action="dice" data-id="${d}">${d}</button>`).join('')}
      </div>
    `));
    if (insp) {
      box.appendChild(el(`
        <div class="row" style="margin-top:0.5rem;">
          <button class="btn" data-action="reroll"${dis(char.inspiration <= 0 || !lastDice)}>Переброс (вдохновение: ${esc(char.inspiration)})</button>
          <span class="small muted">3 вдохновения в день на перебросы.</span>
        </div>
      `));
    }
    box.appendChild(el(`
      <div class="row" style="margin-top:0.5rem;">
        <select class="field" data-action="check-attr">
          ${CALC.ATTRS.map(a => `<option value="${esc(a)}">${esc(a)}</option>`).join('')}
        </select>
        <button class="btn" data-action="check-roll">Проверка</button>
        <span class="small muted">d20 + мод + уровневый бонус</span>
      </div>
    `));
    return box;
  }

  function diceRoll(key) {
    const sides = parseInt(key.slice(1), 10) || 20;
    const n = 1 + Math.floor(Math.random() * sides);
    lastDice = { desc: key, roll: n, mod: 0 };
    toast('Кость ' + key + ': ' + n);
  }

  function checkRoll(btn) {
    const char = currentChar();
    if (!char) return;
    const sel = btn.parentNode.querySelector('[data-action="check-attr"]');
    const attr = sel && sel.value ? sel.value : CALC.ATTRS[0];
    const mv = CALC.mods(char, DATA)[attr] || 0;
    const mb = char.masteryBonus || 0;
    const n = 1 + Math.floor(Math.random() * 20);
    lastDice = { desc: 'проверка «' + attr + '»', roll: n, mod: mv + mb };
    toast('Проверка «' + attr + '»: ' + n + ' + ' + (mv >= 0 ? '+' : '') + mv + ' + ' + mb + ' = ' + (n + mv + mb));
  }

  function initRoll() {
    const char = currentChar();
    if (!char) return;
    const rerollInit = CALC.traits(char, DATA).some(t => t.rerollInit);
    const rolls = rerollInit ? 3 : 1;
    let best = 0;
    for (let i = 0; i < rolls; i++) best = Math.max(best, 1 + Math.floor(Math.random() * 20));
    let total = best + CALC.speed(char, DATA);
    const parts = [best + (rolls > 1 ? ' (лучший из ' + rolls + ')' : ''), 'скорость ' + CALC.speed(char, DATA)];
    if (CALC.hasTrait(char, DATA, 't16')) { total -= 10; parts.push('Параноик −10'); }
    lastDice = { desc: 'инициатива', roll: best, mod: total - best };
    toast('Инициатива: ' + parts.join(' + ') + ' = ' + total);
  }

  function rerollDice() {
    const char = currentChar();
    if (!char || char.inspiration <= 0 || !lastDice) return;
    mutate(() => { char.inspiration -= 1; });
    const n = 1 + Math.floor(Math.random() * 20);
    const total = n + lastDice.mod;
    toast('Переброс (' + lastDice.desc + '): ' + n + (lastDice.mod ? (lastDice.mod > 0 ? ' + ' : ' − ') + Math.abs(lastDice.mod) : '') + ' = ' + total);
  }

  function handleClick(e) {
    const t = e.target && e.target.closest ? e.target.closest('[data-action]') : null;
    if (!t) return;
    const action = t.getAttribute('data-action');
    const id = t.getAttribute('data-id');
    if (action === 'new') newChar();
    else if (action === 'list') goto('select');
    else if (action === 'open') selectChar(id);
    else if (action === 'export') exportChar(id);
    else if (action === 'delete') deleteChar(id);
    else if (action === 'import') ensureFileInput().click();
    else if (action === 'race') chooseRace(id);
    else if (action === 'status') mutate(() => { state.wizard.draft.statusId = id; });
    else if (action === 'human-all') humanAll();
    else if (action === 'human-attr') humanAttr(id);
    else if (action === 'human-close') humanClose();
    else if (action === 'trait-roll') traitRoll();
    else if (action === 'trait-skip') traitSkip();
    else if (action === 'trait-pick') traitPick(id);
    else if (action === 'attr-plus') attrInc(id);
    else if (action === 'attr-minus') attrDec(id);
    else if (action === 'spec') pickSpec(id);
    else if (action === 'spec-toggle') {
      if (e && e.preventDefault) e.preventDefault();
      state.collapsedSpecs[id] = !state.collapsedSpecs[id];
      render();
    }
    else if (action === 'desc-toggle') {
      if (e && e.preventDefault) e.preventDefault();
      state.openDescs[id] = !state.openDescs[id];
      render();
    }
    else if (action === 'ability-buy') buyAbility(state.wizard.draft, id);
    else if (action === 'ability-sell') sellAbility(state.wizard.draft, id);
    else if (action === 'os-bonus') osBonus(id);
    else if (action === 'potential-roll') potentialRoll();
    else if (action === 'potential-to') potentialTo(id);
    else if (action === 'char-create') createChar();
    else if (action === 'wizard-back') wizardBack();
    else if (action === 'wizard-next') wizardNext();
    else if (action === 'tab') tabSet(id);
    else if (action === 'levelup') levelUp();
    else if (action === 'weapon-add') { weaponModalOpen = true; render(); }
    else if (action === 'weapon-close') { weaponModalOpen = false; render(); }
    else if (action === 'weapon-stop') {}
    else if (action === 'weapon-stock') weaponStock(id);
    else if (action === 'weapon-del') weaponDel(parseInt(id, 10));
    else if (action === 'weapon-custom') weaponCustom(t);
    else if (action === 'inv-add') invAdd(t);
    else if (action === 'inv-del') invDel(parseInt(id, 10));
    else if (action === 'dice') diceRoll(id);
    else if (action === 'check-roll') checkRoll(t);
    else if (action === 'init-roll') initRoll();
    else if (action === 'reroll') rerollDice();
    else if (action === 'pool-dec') poolDelta(id, -1);
    else if (action === 'pool-dec5') poolDelta(id, -5);
    else if (action === 'pool-inc') poolDelta(id, 1);
    else if (action === 'pool-rest') poolDelta(id, null);
    else if (action === 'pool-edit') poolEdit(id);
    else if (action === 'death-toggle') deathToggle(id, parseInt(t.getAttribute('data-index'), 10));
    else if (action === 'exh-inc') exhInc();
    else if (action === 'exh-dec') exhDec();
    else if (action === 'exh-open') { exhModalOpen = true; render(); }
    else if (action === 'exh-close') { exhModalOpen = false; render(); }
    else if (action === 'exh-stop') {}
    else if (action === 'cond-open') { condModalOpen = true; render(); }
    else if (action === 'cond-close') { condModalOpen = false; render(); }
    else if (action === 'cond-stop') {}
    else if (action === 'cond-toggle') condToggle(id);
    else if (action === 'cond-del') condDel(id);
    else if (action === 'new-turn') newTurn();
    else if (action === 'new-day') newDay();
    else if (action === 'spec-learn') learnSpec(currentChar(), id);
    else if (action === 'ab-buy') buyAbility(currentChar(), id);
    else if (action === 'ab-sell') sellAbility(currentChar(), id);
    else if (action === 'custom-add') addCustomAbility(currentChar(), id, t);
    else if (action === 'custom-del') removeCustomAbility(currentChar(), parseInt(id, 10));
    else if (action === 'os-plus') osBonusChar(currentChar(), id, 1);
    else if (action === 'os-minus') osBonusChar(currentChar(), id, -1);
    else if (action === 'spell-buy') buyAbility(currentChar(), id);
    else if (action === 'ref-search') { state.refQuery = String(t.value || ''); render(); }
    else if (action === 'levelup') levelUp();
    else if (action === 'levelup-close') levelUpClose();
    else if (action === 'levelup-bonus') levelUpBonus(id);
    else if (action === 'levelup-os') levelUpOs(id);
    else if (action === 'levelup-apply') applyLevelUp();
    else if (action === 'levelup-hpmode') levelUpHpMode(id);
  }

  function handleInput(e) {
    const t = e.target;
    if (!t || !t.getAttribute) return;
    const action = t.getAttribute('data-action');
    if (!action) return;
    if (action === 'name-set') nameSet(t.value);
    else if (action === 'attr-set') attrSet(t.getAttribute('data-id'), t.value);
    else if (action === 'mastery-set') masterySet(t.value);
    else if (action === 'pool-set') poolSet(t.getAttribute('data-id'), t.value);
    else if (action === 'inv-name-set') invSet(parseInt(t.getAttribute('data-id'), 10), 'name', t.value);
    else if (action === 'inv-desc-set') invSet(parseInt(t.getAttribute('data-id'), 10), 'desc', t.value);
    else if (action === 'inv-qty-set') invSet(parseInt(t.getAttribute('data-id'), 10), 'qty', t.value);
    else if (action === 'inv-weight-set') invSet(parseInt(t.getAttribute('data-id'), 10), 'weight', t.value);
    else if (action === 'armor-label-set') armorLabelSet(t.value);
    else if (action === 'armor-ac-set') armorAcSet(t.value);
    else if (action === 'spell-search') { state.spellQuery = String(t.value || ''); render(); }
    else if (action === 'ref-search') { state.refQuery = String(t.value || ''); render(); }
    else if (action === 'notes-input') notesInput(t.value);
    else if (action === 'levelup-manual') levelUpManual(t.value);
  }

  function handleBlur(e) {
    const t = e.target;
    if (!t || !t.getAttribute) return;
    if (t.getAttribute('data-action') === 'pool-set') {
      state.editingPool = null;
      render();
    }
  }

  function handleChange(e) {
    const t = e.target;
    if (!t || !t.getAttribute) return;
    const action = t.getAttribute('data-action');
    if (action === 'armor-set') armorSet(t.value);
    else if (action === 'shield-set') shieldSet(t.value);
    else if (action === 'injury-set') injurySet(t.getAttribute('data-id'), t.checked);
  }

  function injurySet(k, on) {
    mutate(() => {
      const char = currentChar();
      if (char) char.injuries[k] = !!on;
    });
  }

  function poolDelta(key, d) {
    mutate(() => {
      const char = currentChar();
      if (!char || !char[key]) return;
      const p = char[key];
      if (d === null) p.current = p.max;
      else p.current = Math.max(0, Math.min(p.max, p.current + d));
    });
  }

  function poolEdit(key) {
    state.editingPool = key;
    render();
  }

  function poolSet(key, v) {
    const char = currentChar();
    if (!char || !char[key]) return;
    const n = parseInt(v, 10);
    if (isNaN(n)) return;
    state.editingPool = null;
    mutate(() => {
      char[key].current = Math.max(0, Math.min(char[key].max, n));
    });
  }

  function deathToggle(key, i) {
    mutate(() => {
      const char = currentChar();
      if (!char) return;
      char.deathSaves[key] = char.deathSaves[key] === i ? 0 : i;
    });
  }

  function exhInc() {
    mutate(() => {
      const char = currentChar();
      if (char && char.exhaustion < 6) char.exhaustion += 1;
    });
  }

  function exhDec() {
    mutate(() => {
      const char = currentChar();
      if (char && char.exhaustion > 0) char.exhaustion -= 1;
    });
  }

  function condToggle(id) {
    mutate(() => {
      const char = currentChar();
      if (!char) return;
      const i = char.conditions.indexOf(id);
      if (i === -1) char.conditions.push(id);
      else char.conditions.splice(i, 1);
    });
  }

  function condDel(id) {
    mutate(() => {
      const char = currentChar();
      if (!char) return;
      const i = char.conditions.indexOf(id);
      if (i !== -1) char.conditions.splice(i, 1);
    });
  }

  function newTurn() {
    const char = currentChar();
    if (!char) return;
    if (CALC.traits(char, DATA).some(t => t.marathoner)) {
      mutate(() => {
        char.stamina.current = Math.min(char.stamina.max, char.stamina.current + 1);
        char.mana.current = Math.min(char.mana.max, char.mana.current + 1);
      });
      toast('Ход обновлён: Марафонец восстановил 1 запас сил и 1 ману.');
    } else {
      toast('Ход обновлён.');
    }
  }

  function newDay() {
    const char = currentChar();
    if (!char) return;
    const insp = CALC.traits(char, DATA).reduce((s, t) => s || (t.inspirationDaily || 0), 0);
    if (!insp) return;
    mutate(() => { char.inspiration = insp; });
    toast('Новый день: вдохновение обновлено (' + insp + ').');
  }

  function nameSet(v) {
    const char = currentChar();
    if (!char) return;
    mutate(() => { char.name = String(v || ''); });
  }

  function attrSet(attr, v) {
    const char = currentChar();
    if (!char) return;
    const n = parseInt(v, 10);
    if (isNaN(n)) return;
    mutate(() => { char.attrs[attr] = Math.max(1, Math.min(30, n)); });
  }

  function masterySet(v) {
    const char = currentChar();
    if (!char) return;
    const n = parseInt(v, 10);
    if (isNaN(n)) return;
    mutate(() => { char.masteryBonus = Math.max(0, Math.min(20, n)); });
  }

  function armorSet(id) {
    mutate(() => {
      const char = currentChar();
      if (char) char.armor = id ? (id === 'custom' ? { id: 'custom', label: '', ac: 10 } : { id }) : null;
    });
  }

  function armorLabelSet(v) {
    mutate(() => {
      const char = currentChar();
      if (char && char.armor && char.armor.id === 'custom') char.armor.label = String(v || '');
    });
  }

  function armorAcSet(v) {
    const n = parseInt(v, 10);
    if (isNaN(n)) return;
    mutate(() => {
      const char = currentChar();
      if (char && char.armor && char.armor.id === 'custom') char.armor.ac = Math.max(10, Math.min(30, n));
    });
  }

  function shieldSet(id) {
    mutate(() => {
      const char = currentChar();
      if (char) char.shield = id ? { id } : null;
    });
  }

  function weaponStock(id) {
    mutate(() => { currentChar().weapons.push({ id }); });
    weaponModalOpen = false;
    render();
  }

  function weaponDel(i) {
    mutate(() => { currentChar().weapons.splice(i, 1); });
  }

  function invAdd(btn) {
    let root = btn.closest ? btn.closest('.card') : null;
    if (!root || root === btn) root = (btn.parentNode && btn.parentNode.querySelector) ? btn.parentNode : document;
    const q = (sel) => {
      const n = root.querySelector(sel);
      return n ? String(n.value || '') : '';
    };
    const name = q('[data-action="inv-name"]').trim();
    if (!name) return;
    const qty = Math.max(0, parseInt(q('[data-action="inv-qty"]'), 10) || 1);
    const weight = Math.max(0, parseFloat(q('[data-action="inv-weight"]')) || 0);
    const desc = q('[data-action="inv-desc"]');
    mutate(() => { currentChar().inventory.push({ name, desc, qty, weight }); });
  }

  function invDel(i) {
    mutate(() => { currentChar().inventory.splice(i, 1); });
  }

  function invSet(i, field, v) {
    const char = currentChar();
    if (!char || !char.inventory[i]) return;
    mutate(() => {
      const it = char.inventory[i];
      if (typeof it === 'string') return;
      if (field === 'qty') it.qty = Math.max(0, parseInt(v, 10) || 0);
      else if (field === 'weight') it.weight = Math.max(0, parseFloat(v) || 0);
      else it[field] = String(v == null ? '' : v);
    });
  }

  function levelUp() {
    const char = currentChar();
    if (!char || char.level >= 20) return;
    levelUpOpen = true;
    levelUpState = { spent: 0, quickStamina: 0, quickHp: 0, bonus: 'both', manualOs: '', hpMode: 'roll', roll: null };
    render();
  }

  function levelUpClose() {
    levelUpOpen = false;
    levelUpState = null;
    render();
  }

  function levelUpGain() {
    const char = currentChar();
    if (!char || !levelUpState) return 0;
    const newLevel = char.level + 1;
    const clone = Object.assign({}, char, { level: newLevel });
    let g = CALC.totalOS(clone, DATA) - CALC.totalOS(char, DATA);
    if (newLevel > 15) g += parseInt(levelUpState.manualOs, 10) || 0;
    return g;
  }

  function levelUpModal(char) {
    const newLevel = char.level + 1;
    const race = CALC.race(char, DATA);
    const conMod = CALC.mods(char, DATA)['живучесть'];
    const conMult = CALC.conMult(char, DATA);
    const dieSize = race ? race.hitDie : 0;
    const dieVal = levelUpState.hpMode === 'avg' ? CALC.avgDie(dieSize) : levelUpState.roll;
    const hpGain = dieVal != null ? dieVal + conMod * conMult : null;
    const ts = CALC.traits(char, DATA);
    const traitNotes = [];
    ts.forEach(t => {
      if (t.osEvery3Levels && newLevel % 3 === 0) traitNotes.push('«' + t.name + '»: +' + t.osEvery3Levels + ' ОС за третий уровень');
      if (t.osPerLevel) traitNotes.push('«' + t.name + '»: ' + (t.osPerLevel > 0 ? '+' : '') + t.osPerLevel + ' ОС');
    });
    const over15 = newLevel > 15;
    const gain = levelUpGain();
    const left = gain - levelUpState.spent;
    const manualAdd = over15 ? (parseInt(levelUpState.manualOs, 10) || 0) : 0;
    const projLevels = Object.assign({}, char.hpLevels || {});
    if (dieVal != null) projLevels[newLevel] = dieVal;
    const clone = Object.assign({}, char, {
      level: newLevel,
      hpLevels: projLevels,
      extraOS: (char.extraOS || 0) + manualAdd,
      spentOS: (char.spentOS || 0) + levelUpState.spent,
      osBonuses: {
        stamina: char.osBonuses.stamina + levelUpState.quickStamina + (levelUpState.bonus === 'both' ? 1 : levelUpState.bonus === 'stamina2' ? 2 : 0),
        mana: char.osBonuses.mana + levelUpState.quickStamina + (levelUpState.bonus === 'both' ? 1 : levelUpState.bonus === 'mana2' ? 2 : 0),
        hp: char.osBonuses.hp + levelUpState.quickHp * 5,
      },
    });
    const prevTotal = CALC.totalOS(clone, DATA);
    const showHp = CALC.maxHp(clone, DATA);
    const showStam = CALC.maxStamina(clone, DATA);
    const showMana = CALC.maxMana(clone, DATA);
    const radio = (id, label) => `<button class="btn" data-action="levelup-bonus" data-id="${id}"${levelUpState.bonus === id ? ' style="border:2px solid var(--accent)"' : ''}>${esc(label)}</button>`;
    const hpLine = hpGain == null
      ? `Хиты: кость не брошена — бросьте d${dieSize} или возьмите среднее`
      : `Хиты: +${hpGain} (${levelUpState.hpMode === 'avg' ? 'среднее d' + dieSize : 'кость ' + dieVal} + мод ${conMod}${conMult > 1 ? ' ×' + conMult + ' (Закалка)' : ''}) → макс. ${showHp}`;
    return el(`
      <div class="wizard-overlay" data-action="levelup-close" style="position:fixed;inset:0;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;z-index:50;padding:1rem;">
        <div class="card wizard-modal" data-action="levelup-stop" style="max-width:560px;width:100%;max-height:80vh;overflow:auto;">
          <div class="row between">
            <h3>Повышение уровня</h3>
            <button class="btn btn-danger" data-action="levelup-close">×</button>
          </div>
          <p class="small muted">Уровень ${char.level} → ${newLevel}</p>
          <div class="card" style="margin:0.35rem 0;">
            <strong>Хиты:</strong>
            <div class="row" style="flex-wrap:wrap;gap:0.35rem;margin-top:0.35rem;">
              <button class="btn" data-action="levelup-hpmode" data-id="roll"${levelUpState.hpMode === 'roll' ? ' style="border:2px solid var(--accent)"' : ''}>Кинуть d${dieSize}</button>
              <button class="btn" data-action="levelup-hpmode" data-id="avg"${levelUpState.hpMode === 'avg' ? ' style="border:2px solid var(--accent)"' : ''}>Среднее: +${CALC.avgDie(dieSize)}</button>
            </div>
            <p class="small muted" style="margin:0.35rem 0 0;">${hpLine}</p>
          </div>
          <div class="card" style="margin:0.35rem 0;">
            <strong>ОС к получению:</strong> +${gain} <span class="small muted">(${CALC.totalOS(char, DATA)} → ${prevTotal})</span>
            ${traitNotes.length ? `<p class="small muted" style="margin:0.25rem 0 0;">${traitNotes.join('; ')}</p>` : ''}
          </div>
          ${over15 ? `<div class="card" style="margin:0.35rem 0;">
            <label class="small" for="levelup-manual">ОС за уровень 16+ (ручн.)</label>
            <input class="field" id="levelup-manual" style="margin-top:0.25rem;" data-action="levelup-manual" type="number" min="0" value="${esc(levelUpState.manualOs)}" placeholder="0">
          </div>` : ''}
          <div class="card" style="margin:0.35rem 0;">
            <strong>Бонус уровня:</strong>
            <div class="row" style="flex-wrap:wrap;gap:0.35rem;margin-top:0.35rem;">
              ${radio('both', '+1 ЗС и +1 мана')}
              ${radio('stamina2', '+2 к запасу сил')}
              ${radio('mana2', '+2 к мане')}
            </div>
          </div>
          <div class="card" style="margin:0.35rem 0;">
            <strong>Быстрая трата ОС</strong> <span class="small muted">(осталось в модалке: ${left})</span>
            <div class="row" style="flex-wrap:wrap;gap:0.35rem;margin-top:0.35rem;">
              <button class="btn" data-action="levelup-os" data-id="both"${dis(left <= 0)}>+1 ЗС и +1 мана за 1 ОС</button>
              <button class="btn" data-action="levelup-os" data-id="hp"${dis(left <= 0)}>+5 HP за 1 ОС</button>
            </div>
            <p class="small muted" style="margin:0.35rem 0 0;">Потрачено в модалке: ${levelUpState.spent} · Предпросмотр: ЗС ${char.stamina.max} → ${showStam} · Мана ${char.mana.max} → ${showMana}${hpGain != null ? ` · HP ${char.hp.max} → ${showHp}` : ''}</p>
          </div>
          <div class="row" style="justify-content:flex-end;margin-top:0.75rem;">
            <button class="btn btn-primary" data-action="levelup-apply">Применить</button>
          </div>
        </div>
      </div>
    `);
  }

  function levelUpBonus(v) {
    if (!levelUpState || !v) return;
    levelUpState.bonus = v;
    render();
  }

  function levelUpOs(mode) {
    if (!levelUpState || levelUpState.spent >= levelUpGain()) return;
    levelUpState.spent += 1;
    if (mode === 'both') levelUpState.quickStamina += 1;
    else levelUpState.quickHp += 1;
    render();
  }

  function levelUpManual(v) {
    if (!levelUpState) return;
    const s = String(v || '');
    levelUpState.manualOs = /^\d+$/.test(s) ? s : '';
    render();
  }

  function levelUpHpMode(mode) {
    if (!levelUpState) return;
    if (mode === 'avg') {
      levelUpState.hpMode = 'avg';
    } else {
      levelUpState.hpMode = 'roll';
      const race = CALC.race(currentChar(), DATA);
      levelUpState.roll = race ? Math.floor(Math.random() * race.hitDie) + 1 : null;
    }
    render();
  }

  function applyLevelUp() {
    const char = currentChar();
    if (!char || char.level >= 20 || !levelUpState) return;
    if (levelUpState.hpMode === 'roll' && levelUpState.roll == null) { toast('Бросьте кость или возьмите среднее'); return; }
    if (levelUpState.spent > levelUpGain()) { toast('Потрачено больше ОС, чем получено — уменьшите расход.'); return; }
    const st = levelUpState;
    const newLevel = char.level + 1;
    const race = CALC.race(char, DATA);
    const dieVal = st.hpMode === 'avg' ? CALC.avgDie(race.hitDie) : st.roll;
    const oldHp = char.hp.max;
    const oldStam = char.stamina.max;
    const oldMana = char.mana.max;
    const manual = newLevel > 15 ? (parseInt(st.manualOs, 10) || 0) : 0;
    levelUpOpen = false;
    levelUpState = null;
    mutate(() => {
      char.level = newLevel;
      char.spentOS = (char.spentOS || 0) + st.spent;
      if (st.bonus === 'both') { char.osBonuses.stamina += 1; char.osBonuses.mana += 1; }
      else if (st.bonus === 'stamina2') char.osBonuses.stamina += 2;
      else if (st.bonus === 'mana2') char.osBonuses.mana += 2;
      char.osBonuses.stamina += st.quickStamina;
      char.osBonuses.mana += st.quickStamina;
      char.osBonuses.hp += st.quickHp * 5;
      if (manual > 0) char.extraOS = (char.extraOS || 0) + manual;
      if (!char.hpLevels) char.hpLevels = {};
      char.hpLevels[newLevel] = dieVal;
      char.hp.max = CALC.maxHp(char, DATA);
      char.stamina.max = CALC.maxStamina(char, DATA);
      char.mana.max = CALC.maxMana(char, DATA);
      char.hp.current = Math.min(char.hp.current + (char.hp.max - oldHp), char.hp.max);
      char.stamina.current = Math.min(char.stamina.current + (char.stamina.max - oldStam), char.stamina.max);
      char.mana.current = Math.min(char.mana.current + (char.mana.max - oldMana), char.mana.max);
    });
    toast('Уровень повышен до ' + newLevel);
  }

  function racePicksReset(d) {
    const had = d.specializations.length > 0 || d.abilities.length > 0 || d.customAbilities.length > 0 || d.spentOS > 0;
    if (!had) return false;
    d.specializations = [];
    d.abilities = [];
    d.customAbilities = [];
    d.spentOS = 0;
    d.osBonuses = { stamina: 0, mana: 0, hp: 0 };
    d.extraOS = 0;
    return true;
  }

  function raceChange(id) {
    const d = state.wizard.draft;
    const reset = d.raceId && d.raceId !== id ? racePicksReset(d) : false;
    d.raceId = id;
    return reset;
  }

  function chooseRace(id) {
    const r = DATA.races[id];
    if (r && r.bonusMode === 'choice') {
      humanModalOpen = true;
      humanPickA = null;
      render();
      return;
    }
    let reset = false;
    mutate(() => {
      reset = raceChange(id);
      state.wizard.draft.humanBonusChoice = null;
    });
    if (reset) toast('Смена расы сброшена: покупки специализаций и ОС очищены.');
  }

  function humanAll() {
    humanModalOpen = false;
    humanPickA = null;
    let reset = false;
    mutate(() => {
      reset = raceChange('human');
      state.wizard.draft.humanBonusChoice = { all: true };
    });
    if (reset) toast('Смена расы сброшена: покупки специализаций и ОС очищены.');
  }

  function humanAttr(attr) {
    if (humanPickA === null) {
      humanPickA = attr;
      render();
      return;
    }
    if (humanPickA === attr) return;
    const a = humanPickA;
    humanModalOpen = false;
    humanPickA = null;
    let reset = false;
    mutate(() => {
      reset = raceChange('human');
      state.wizard.draft.humanBonusChoice = { a, b: attr };
    });
    if (reset) toast('Смена расы сброшена: покупки специализаций и ОС очищены.');
  }

  function humanClose() {
    humanModalOpen = false;
    humanPickA = null;
    render();
  }

  function traitRoll() {
    mutate(() => {
      const n = 1 + Math.floor(Math.random() * 20);
      const id = 't' + n;
      const d = state.wizard.draft;
      if (d.traits.indexOf(id) === -1) d.traits.push(id);
      d.traitRolled = true;
    });
  }

  function traitSkip() {
    mutate(() => {
      const d = state.wizard.draft;
      d.traits.length = 0;
      d.traitRolled = true;
    });
  }

  function traitPick(id) {
    mutate(() => {
      const d = state.wizard.draft;
      const i = d.traits.indexOf(id);
      if (i !== -1) d.traits.splice(i, 1);
      else d.traits.push(id);
      d.traitRolled = true;
    });
  }

  function wizardBack() {
    if (state.wizard.step <= 1) return;
    state.wizard.step -= 1;
    humanModalOpen = false;
    humanPickA = null;
    render();
  }

  function wizardNext() {
    if (!wizardCanNext() || state.wizard.step >= 6) return;
    state.wizard.step += 1;
    render();
  }

  function render() {
    const app = document.getElementById('app');
    let focus = null;
    const ae = document.activeElement;
    if (ae && ae.getAttribute && ae.getAttribute('data-action')) {
      focus = { action: ae.getAttribute('data-action'), id: ae.getAttribute('data-id'), selStart: ae.selectionStart, selEnd: ae.selectionEnd };
    }
    app.innerHTML = '';
    app.onclick = handleClick;
    app.oninput = handleInput;
    app.onchange = handleChange;
    app.onblur = handleBlur;
    if (state.screen === 'select') renderSelect(app);
    else if (state.screen === 'wizard') renderWizard(app);
    else if (state.screen === 'sheet') renderSheet(app);
    if (focus) {
      const sel = app.querySelector('[data-action="' + focus.action + '"]' + (focus.id ? '[data-id="' + focus.id + '"]' : ''));
      if (sel) {
        sel.focus({ preventScroll: true });
        if (sel.setSelectionRange && typeof focus.selStart === 'number') sel.setSelectionRange(focus.selStart, focus.selEnd);
      }
    }
  }

  render();

  window.APP = { DATA, state, el, currentChar, mutate, save, toast, goto, render, esc, selectChar, deleteChar, exportChar, importChar, newChar, calcFull, tabSet, createChar };
})();
