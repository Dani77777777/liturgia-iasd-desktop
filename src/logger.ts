import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';

const TAMANHO_MAX = 2 * 1024 * 1024; // rotate at 2 MB

let ficheiro: string | null = null;

export const pastaLogs = () => path.join(app.getPath('userData'), 'logs');

function escrever(nivel: string, args: unknown[]) {
  if (!ficheiro) return;
  const linha = `${new Date().toISOString()} [${nivel.toUpperCase()}] ${util.format(...args)}\n`;
  fs.appendFile(ficheiro, linha, () => { /* never crash because of logging */ });
}

/**
 * Mirrors console output to <userData>/logs/main.log so problems that happen
 * during a service can be looked at afterwards (Ajuda › Abrir pasta de registos).
 */
export function iniciarLogger() {
  try {
    const dir = pastaLogs();
    fs.mkdirSync(dir, { recursive: true });
    ficheiro = path.join(dir, 'main.log');
    if (fs.existsSync(ficheiro) && fs.statSync(ficheiro).size > TAMANHO_MAX) {
      fs.renameSync(ficheiro, path.join(dir, 'main.old.log'));
    }
  } catch {
    ficheiro = null;
    return;
  }

  for (const nivel of ['log', 'info', 'warn', 'error'] as const) {
    const original = console[nivel].bind(console);
    console[nivel] = (...args: unknown[]) => {
      original(...args);
      escrever(nivel, args);
    };
  }

  process.on('uncaughtException', (err) => console.error('uncaughtException:', err));
  process.on('unhandledRejection', (err) => console.error('unhandledRejection:', err));
  console.log(`--- Liturgia IASD ${app.getVersion()} (Electron ${process.versions.electron}) ---`);
}
