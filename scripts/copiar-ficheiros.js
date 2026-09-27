// Copies the non-TypeScript files (HTML/JS/CSS pages) from src/ to dist/.
// Replaces the old Windows-only `xcopy` step so the build works on any OS.
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'src');
const dist = path.join(__dirname, '..', 'dist');

const copiar = (origem) => !origem.endsWith('.ts') || fs.statSync(origem).isDirectory();

for (const nome of fs.readdirSync(src)) {
  const origem = path.join(src, nome);
  if (!copiar(origem)) continue;
  fs.cpSync(origem, path.join(dist, nome), { recursive: true, filter: copiar });
}
console.log('Páginas copiadas para dist/');
