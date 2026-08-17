(function () {
  const DATA = Object.assign({}, DATA_CORE, {
    abilities: Object.assign({}, DATA_MAGIC.abilities, DATA_PHYSICAL.abilities),
    allAbilities: Object.assign({}, DATA_MAGIC.abilities, DATA_PHYSICAL.abilities),
  });

  const state = { chars: STORE.load(), currentId: null, screen: 'select' };

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
    app.appendChild(el('<div class="page"><div class="card"><p class="muted">(не готово)</p></div></div>'));
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
