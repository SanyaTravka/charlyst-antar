const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const FILES = ['t11-sheet.js', 't12-tracker.js', 't13-specs.js', 't14-spells.js', 't15-refbook.js', 't16-levelup.js', 't17-learned.js', 't18-theme.js', 't19-refsearch.js', 't20-rolllog.js', 't21-dicepool.js', 'wizard.js', 'race-change.js'];
const ROOT = path.join(__dirname, '..');

let fails = 0;
for (const f of FILES) {
  const p = path.join(__dirname, f);
  if (!fs.existsSync(p)) {
    console.log('MISSING ' + f);
    fails++;
    continue;
  }
  const r = spawnSync(process.execPath, [p], { cwd: ROOT, encoding: 'utf8' });
  const tail = r.stdout.split('\n').map(s => s.trim()).filter(Boolean).slice(-1)[0] || '(no output)';
  console.log((r.status === 0 ? 'PASS ' : 'FAIL ') + f + ' — ' + tail);
  if (r.status !== 0) {
    fails++;
    const lines = r.stdout.split('\n').concat(r.stderr.split('\n')).map(s => s.trim()).filter(Boolean);
    console.log(lines.slice(-8).join('\n'));
  }
}
console.log(fails ? fails + ' harness failure(s)' : 'All harnesses pass');
process.exit(fails ? 1 : 0);