const { spawnSync } = require('child_process');
const path = require('path');

const r = spawnSync('git', ['status', '--porcelain', '--', 'antar-sheet.html'], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
const dirty = (r.stdout || '').trim().length > 0;
console.log(dirty ? 'antar-sheet.html DIRTY after build — committed build is stale' : 'antar-sheet.html idempotent (no diff after build)');
process.exit(dirty ? 1 : 0);