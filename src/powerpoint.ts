import { dialog, shell } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { MESES, MODELO_PPTX_NOME } from './config';
import { eventoAtual } from './estado-culto';
import { ler } from './store';

/** External drive with "Cultos" and "Modelo" at its root (legacy auto-detection). */
function detetarDisco(): string | null {
  for (const letra of 'DEFGHIJKLMNOPQRSTUVWXYZABC') {
    const disco = `${letra}:\\`;
    try {
      if (fs.existsSync(path.join(disco, 'Cultos')) && fs.existsSync(path.join(disco, 'Modelo'))) return disco;
    } catch { /* restricted drive */ }
  }
  return null;
}

/** Where the "Cultos" folder and the template are: Definições first, then auto-detect. */
export function localizarPastas(): { pastaCultos: string; modelo: string } | null {
  const pastaCultos = ler('pastaCultos');
  if (pastaCultos && fs.existsSync(pastaCultos)) {
    return {
      pastaCultos,
      modelo: ler('ficheiroModelo') || path.join(path.dirname(pastaCultos), 'Modelo', MODELO_PPTX_NOME),
    };
  }
  const disco = detetarDisco();
  if (!disco) return null;
  return {
    pastaCultos: path.join(disco, 'Cultos'),
    modelo: ler('ficheiroModelo') || path.join(disco, 'Modelo', MODELO_PPTX_NOME),
  };
}

/** Day folder (Cultos/ano/mês/dia) and the .pptx path for the open service. */
function caminhosDoCulto(): { pastaDia: string; ficheiro: string; modelo: string } | null {
  const evento = eventoAtual();
  if (!evento) return null;

  const pastas = localizarPastas();
  if (!pastas) {
    dialog.showErrorBox(
      'Pasta dos cultos não encontrada',
      'Ligue o disco externo (com as pastas "Cultos" e "Modelo") ou escolha a pasta em Ficheiro › Definições.'
    );
    return null;
  }

  // Read the calendar day directly — new Date() on the stored UTC midnight can shift the day.
  const [ano, mes, dia] = evento.data.slice(0, 10).split('-');
  const pastaDia = path.join(pastas.pastaCultos, ano, MESES[Number(mes) - 1], String(Number(dia)));
  return {
    pastaDia,
    ficheiro: path.join(pastaDia, `${dia}-${mes}-${ano}.pptx`),
    modelo: pastas.modelo,
  };
}

export async function abrirPowerPoint() {
  const c = caminhosDoCulto();
  if (!c) return;
  if (!fs.existsSync(c.modelo)) {
    dialog.showErrorBox('Modelo não encontrado', `Ficheiro modelo não encontrado em:\n${c.modelo}\n\nPode escolher outro em Ficheiro › Definições.`);
    return;
  }
  try {
    fs.mkdirSync(c.pastaDia, { recursive: true });
    if (!fs.existsSync(c.ficheiro)) {
      fs.copyFileSync(c.modelo, c.ficheiro);
      console.log('PowerPoint criado a partir do modelo:', c.ficheiro);
    }
    const erro = await shell.openPath(c.ficheiro);
    if (erro) dialog.showErrorBox('Erro ao abrir o PowerPoint', erro);
  } catch (err) {
    console.error('abrirPowerPoint', err);
    dialog.showErrorBox('Erro de ficheiro', `Ocorreu um erro: ${(err as Error).message}`);
  }
}

export async function abrirPastaDoDia() {
  const c = caminhosDoCulto();
  if (!c) return;
  try {
    fs.mkdirSync(c.pastaDia, { recursive: true });
    const erro = await shell.openPath(c.pastaDia);
    if (erro) dialog.showErrorBox('Erro ao abrir a pasta', erro);
  } catch (err) {
    console.error('abrirPastaDoDia', err);
    dialog.showErrorBox('Erro de ficheiro', `Não foi possível abrir a pasta: ${(err as Error).message}`);
  }
}
