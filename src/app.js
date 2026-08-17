(function () {
  const DATA = Object.assign({}, DATA_CORE, {
    abilities: Object.assign({}, DATA_MAGIC.abilities, DATA_PHYSICAL.abilities),
    allAbilities: Object.assign({}, DATA_MAGIC.abilities, DATA_PHYSICAL.abilities),
  });

  const state = { chars: STORE.load(), currentId: null, screen: 'select' };

  const WIZARD_TITLES = ['Раса', 'Статус', 'Черта', 'Характеристики', 'Специализации', 'Стартовые ОС'];
  let humanModalOpen = false;
  let humanPickA = null;

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
    render();
  }

  function selectChar(id) {
    state.currentId = id;
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
    delete c.potentialRolled;
    delete c.potentialPoints;
    delete c.potentialTo;
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
    app.appendChild(el('<div class="page"><div class="card"><p class="muted">(не готово)</p></div></div>'));
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
    app.innerHTML = '';
    app.onclick = handleClick;
    if (state.screen === 'select') renderSelect(app);
    else if (state.screen === 'wizard') renderWizard(app);
    else if (state.screen === 'sheet') renderSheet(app);
  }

  render();

  window.APP = { DATA, state, el, currentChar, mutate, save, toast, goto, render, esc, selectChar, deleteChar, exportChar, importChar, newChar };
})();
