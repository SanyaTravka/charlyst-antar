(function () {
  const DATA = Object.assign({}, DATA_CORE, {
    abilities: Object.assign({}, DATA_MAGIC.abilities, DATA_PHYSICAL.abilities),
    allAbilities: Object.assign({}, DATA_MAGIC.abilities, DATA_PHYSICAL.abilities),
  });

  const state = { chars: STORE.load(), currentId: null, screen: 'select', tab: 'overview' };

  const WIZARD_TITLES = ['Раса', 'Статус', 'Черта', 'Характеристики', 'Специализации', 'Стартовые ОС'];
  let humanModalOpen = false;
  let humanPickA = null;
  let weaponModalOpen = false;
  let lastDice = null;

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
        <button class="btn btn-danger" data-action="trait-skip">Пропустить</button>
      </div>
    `));
    if (!d.traitRolled) {
      container.appendChild(el('<p class="small muted" style="margin-top:1rem;">Бросьте d20, чтобы определить черту персонажа, или пропустите.</p>'));
    } else {
      const t = d.traitId ? DATA.traits[d.traitId] : null;
      if (t) {
        container.appendChild(el(`
          <div class="card" style="margin-top:1rem;">
            <div class="row between">
              <h3>${esc(t.name)}</h3>
              <span class="muted small">Бросок: ${t.num}</span>
            </div>
            <p class="small muted">«${esc(t.quote)}»</p>
            <p>${esc(t.desc)}</p>
          </div>
        `));
      } else {
        container.appendChild(el('<div class="card" style="margin-top:1rem;"><p class="muted">Черта пропущена — персонаж без черты.</p></div>'));
      }
    }
  }

  function specRequired(d) {
    return d.traitId === 't19' ? 5 : 4;
  }

  function pointsLeft(d) {
    return 27 - CALC.ATTRS.reduce((s, a) => s + (d.attrs[a] - 8), 0);
  }

  function attrMax(d, a) {
    let m = 18;
    const t = d.traitId ? DATA.traits[d.traitId] : null;
    if (t && t.vitCap && a === 'живучесть') m = Math.min(m, t.vitCap);
    const r = d.raceId ? DATA.races[d.raceId] : null;
    if (r && r.attrCaps && r.attrCaps[a]) m = Math.min(m, r.attrCaps[a]);
    return m;
  }

  function attrInc(a) {
    mutate(() => {
      const d = state.wizard.draft;
      if (d.attrs[a] >= attrMax(d, a) || pointsLeft(d) <= 0) return;
      let v = d.attrs[a] + 1;
      if (d.traitId === 't12' && a === 'интеллект' && v === 9) v = 10;
      d.attrs[a] = v;
    });
  }

  function attrDec(a) {
    mutate(() => {
      const d = state.wizard.draft;
      if (d.attrs[a] <= 8) return;
      let v = d.attrs[a] - 1;
      if (d.traitId === 't12' && a === 'интеллект' && v === 9) v = 8;
      d.attrs[a] = v;
    });
  }

  function wizardStep4(container) {
    const d = state.wizard.draft;
    const left = pointsLeft(d);
    const fin = CALC.attrFinal(d, DATA);
    const mds = CALC.mods(d, DATA);
    container.appendChild(el(`
      <div class="row between" style="margin-bottom:0.5rem;">
        <h3 style="margin:0;">Осталось очков: ${left}</h3>
        <span class="muted small">27 очков поверх значения 8</span>
      </div>
    `));
    for (const a of CALC.ATTRS) {
      const cur = d.attrs[a];
      const max = attrMax(d, a);
      const note = [];
      if (max < 18) note.push('макс ' + max);
      if (d.traitId === 't12' && a === 'интеллект') note.push('без 9');
      container.appendChild(el(`
        <div class="row between" style="padding:0.5rem 0;border-bottom:1px solid var(--border);">
          <div>
            <strong>${esc(a)}</strong>
            <div class="small muted">Финал: ${fin[a]} · Модификатор: ${mds[a] >= 0 ? '+' + mds[a] : mds[a]}${note.length ? ' · ' + esc(note.join(' · ')) : ''}</div>
          </div>
          <div class="row">
            <button class="btn" data-action="attr-minus" data-id="${esc(a)}"${dis(cur <= 8)}>−</button>
            <strong style="min-width:1.6rem;text-align:center;">${cur}</strong>
            <button class="btn" data-action="attr-plus" data-id="${esc(a)}"${dis(left <= 0 || cur >= max)}>+</button>
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
    if (d.traitId === 't17') {
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

  function buyAbility(id) {
    mutate(() => {
      const d = state.wizard.draft;
      if (d.abilities.indexOf(id) !== -1) return;
      const cost = CALC.abilityCost(DATA, id);
      if (d.spentOS + cost > CALC.totalOS(d, DATA)) return;
      d.abilities.push(id);
      d.spentOS += cost;
    });
  }

  function sellAbility(id) {
    mutate(() => {
      const d = state.wizard.draft;
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
    const tr = CALC.trait(c, DATA);
    if (tr && tr.inspirationDaily) c.inspiration = tr.inspirationDaily;
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
      : w.step === 3 ? !!w.draft.traitRolled
      : w.step === 4 ? pointsLeft(w.draft) === 0
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
    page.appendChild(tabBar());
    if (state.tab === 'specs') page.appendChild(el('<div class="card"><p class="muted">Вкладка «Специализации» пока не готова.</p></div>'));
    else if (state.tab === 'spells') page.appendChild(el('<div class="card"><p class="muted">Вкладка «Заклинания» пока не готова.</p></div>'));
    else if (state.tab === 'refbook') page.appendChild(el('<div class="card"><p class="muted">Вкладка «Справочник» пока не готова.</p></div>'));
    else if (state.tab === 'notes') page.appendChild(el('<div class="card"><p class="muted">Вкладка «Заметки» пока не готова.</p></div>'));
    else renderOverview(page, char);
    app.appendChild(page);
    if (weaponModalOpen) app.appendChild(weaponModal());
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
    const tabs = [['overview', 'Обзор'], ['specs', 'Специализации'], ['spells', 'Заклинания'], ['refbook', 'Справочник'], ['notes', 'Заметки']];
    return el(`
      <div class="tabs">
        ${tabs.map(([id, name]) => `<button class="tab${state.tab === id ? ' active' : ''}" data-action="tab" data-id="${id}">${esc(name)}</button>`).join('')}
      </div>
    `);
  }

  function tabSet(id) {
    state.tab = id;
    weaponModalOpen = false;
    render();
  }

  function section(title, body) {
    const s = el(`<div class="card"><h3 style="margin-top:0;">${esc(title)}</h3></div>`);
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
    grid.appendChild(section('Инвентарь', inventoryBlock(char)));
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
    const tr = CALC.trait(char, DATA);
    const hints = [];
    if (tr && tr.rerollInit) hints.push('Живчик: 3 броска d20, берём лучший');
    if (char.traitId === 't16') hints.push('Параноик: −10');
    if (char.traitId === 't10') hints.push('Косноязычный: −2, если кастовали вербальное заклинание (вручную)');
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
      <div class="row" style="padding:0.3rem 0;border-bottom:1px solid var(--border);">
        <button class="btn" data-action="init-roll">Инициатива</button>
        <span class="small muted">d20 + скорость${tr && tr.rerollInit ? ' (3 броска)' : ''}${char.traitId === 't16' ? ' − 10' : ''}</span>
      </div>
    `));
    if (hints.length) {
      box.appendChild(el(`<p class="small muted" style="margin:0.5rem 0 0;">${hints.map(esc).join('<br>')}</p>`));
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
    const aggressive = char.traitId === 't7';
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
    const armorOpts = [['', '—']].concat(Object.keys(DATA.armor).map(id => [id, DATA.armor[id].name]));
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
    const a = char.armor && DATA.armor[char.armor.id];
    if (a) box.appendChild(el(`<p class="small muted" style="margin:0.5rem 0 0;">${esc(a.name)} (КД ${a.ac}): ${esc(a.penalties)}</p>`));
    return box;
  }

  function inventoryBlock(char) {
    const box = el('<div></div>');
    char.inventory.forEach((it, i) => {
      box.appendChild(el(`
        <div class="row between" style="padding:0.25rem 0;border-bottom:1px solid var(--border);">
          <span>${esc(it)}</span>
          <button class="btn btn-danger" data-action="inv-del" data-id="${i}">Убрать</button>
        </div>
      `));
    });
    box.appendChild(el(`
      <div class="row" style="margin-top:0.5rem;">
        <input class="field" style="flex:1;" data-action="inv-input" placeholder="Название предмета">
        <button class="btn" data-action="inv-add">Добавить</button>
      </div>
    `));
    return box;
  }

  function traitBlock(char) {
    const box = el('<div></div>');
    const t = CALC.trait(char, DATA);
    const s = CALC.status(char, DATA);
    if (t) {
      box.appendChild(el(`
        <div class="card" style="margin:0.5rem 0;">
          <h4 style="margin:0;">Черта: ${esc(t.name)}</h4>
          <p class="small muted" style="margin:0.35rem 0;">«${esc(t.quote)}»</p>
          <p class="small">${esc(t.desc)}</p>
        </div>
      `));
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
    const tr = CALC.trait(char, DATA);
    const box = el('<div></div>');
    box.appendChild(el(`
      <div class="row">
        ${['d4', 'd6', 'd8', 'd10', 'd12', 'd20'].map(d => `<button class="btn" data-action="dice" data-id="${d}">${d}</button>`).join('')}
      </div>
    `));
    if (tr && tr.inspirationDaily) {
      box.appendChild(el(`
        <div class="row" style="margin-top:0.5rem;">
          <button class="btn" data-action="reroll"${dis(char.inspiration <= 0 || !lastDice)}>Переброс (вдохновение: ${esc(char.inspiration)})</button>
          <span class="small muted">«Везунчик»: 3 вдохновения в день на перебросы.</span>
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
    const tr = CALC.trait(char, DATA);
    const rolls = tr && tr.rerollInit ? 3 : 1;
    let best = 0;
    for (let i = 0; i < rolls; i++) best = Math.max(best, 1 + Math.floor(Math.random() * 20));
    let total = best + CALC.speed(char, DATA);
    const parts = [best + (rolls > 1 ? ' (лучший из ' + rolls + ')' : ''), 'скорость ' + CALC.speed(char, DATA)];
    if (char.traitId === 't16') { total -= 10; parts.push('Параноик −10'); }
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
    else if (action === 'attr-plus') attrInc(id);
    else if (action === 'attr-minus') attrDec(id);
    else if (action === 'spec') pickSpec(id);
    else if (action === 'ability-buy') buyAbility(id);
    else if (action === 'ability-sell') sellAbility(id);
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
  }

  function handleInput(e) {
    const t = e.target;
    if (!t || !t.getAttribute) return;
    const action = t.getAttribute('data-action');
    if (!action) return;
    if (action === 'name-set') nameSet(t.value);
    else if (action === 'attr-set') attrSet(t.getAttribute('data-id'), t.value);
    else if (action === 'mastery-set') masterySet(t.value);
  }

  function handleChange(e) {
    const t = e.target;
    if (!t || !t.getAttribute) return;
    const action = t.getAttribute('data-action');
    if (action === 'armor-set') armorSet(t.value);
    else if (action === 'shield-set') shieldSet(t.value);
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
      if (char) char.armor = id ? { id } : null;
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
    const inp = btn.parentNode.querySelector('[data-action="inv-input"]');
    const v = inp && inp.value ? String(inp.value).trim() : '';
    if (!v) return;
    mutate(() => { currentChar().inventory.push(v); });
  }

  function invDel(i) {
    mutate(() => { currentChar().inventory.splice(i, 1); });
  }

  function levelUp() {
    const char = currentChar();
    if (!char || char.level >= 20) return;
    toast('Повышение уровня появится в следующем обновлении.');
  }

  function chooseRace(id) {
    const r = DATA.races[id];
    if (r && r.bonusMode === 'choice') {
      humanModalOpen = true;
      humanPickA = null;
      render();
      return;
    }
    mutate(() => {
      state.wizard.draft.raceId = id;
      state.wizard.draft.humanBonusChoice = null;
    });
  }

  function humanAll() {
    humanModalOpen = false;
    humanPickA = null;
    mutate(() => {
      state.wizard.draft.raceId = 'human';
      state.wizard.draft.humanBonusChoice = { all: true };
    });
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
    mutate(() => {
      state.wizard.draft.raceId = 'human';
      state.wizard.draft.humanBonusChoice = { a, b: attr };
    });
  }

  function humanClose() {
    humanModalOpen = false;
    humanPickA = null;
    render();
  }

  function traitRoll() {
    mutate(() => {
      const n = 1 + Math.floor(Math.random() * 20);
      state.wizard.draft.traitId = 't' + n;
      state.wizard.draft.traitRolled = true;
    });
  }

  function traitSkip() {
    mutate(() => {
      state.wizard.draft.traitId = null;
      state.wizard.draft.traitRolled = true;
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
    if (state.screen === 'select') renderSelect(app);
    else if (state.screen === 'wizard') renderWizard(app);
    else if (state.screen === 'sheet') renderSheet(app);
    if (focus) {
      const sel = app.querySelector('[data-action="' + focus.action + '"]' + (focus.id ? '[data-id="' + focus.id + '"]' : ''));
      if (sel) {
        sel.focus();
        if (sel.setSelectionRange && typeof focus.selStart === 'number') sel.setSelectionRange(focus.selStart, focus.selEnd);
      }
    }
  }

  render();

  window.APP = { DATA, state, el, currentChar, mutate, save, toast, goto, render, esc, selectChar, deleteChar, exportChar, importChar, newChar, calcFull, tabSet, createChar };
})();
