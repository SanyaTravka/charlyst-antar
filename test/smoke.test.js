const test = require('node:test');
const assert = require('node:assert');

test('build produces antar-sheet.html containing app mount', () => {
  const html = require('fs').readFileSync(require('path').join(__dirname, '..', 'antar-sheet.html'), 'utf8');
  assert.ok(html.includes('<div id="app"></div>'));
  assert.ok(html.includes('window.APP'));
});