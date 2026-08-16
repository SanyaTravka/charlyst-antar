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