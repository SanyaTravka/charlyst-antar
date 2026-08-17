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
    else box.appendChild(el('<p class="muted">(не готово)</p>'));
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

  function wizardNav() {
    const w = state.wizard;
    const dis = (v) => v ? '' : ' disabled style="opacity:0.55;cursor:default"';
    return el(`
      <div class="row between" style="margin-top:1rem;">
        <button class="btn" data-action="wizard-back"${dis(w.step > 1)}>← Назад</button>
        <button class="btn" data-action="wizard-next"${dis(wizardCanNext())}>Далее →</button>
      </div>
    `);
  }

  function wizardCanNext() {
    const w = state.wizard;
    return w.step === 1 ? !!w.draft.raceId
      : w.step === 2 ? !!w.draft.statusId
      : w.step === 3 ? !!w.draft.traitRolled
      : w.step < 6;
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
