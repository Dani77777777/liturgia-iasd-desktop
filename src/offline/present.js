// Offline projection — same layout as the website's /present page, fed by the main process.

const $ = (id) => document.getElementById(id);
let estado = null;

const PADRAO = { cor_fundo: '#000000', cor_texto: '#ffffff', cor_destaque: '#facc15', mostrar_relogio: true, mostrar_seguinte: true, mensagem_espera: null, logo_url: null };

const pad = (n) => String(n).padStart(2, '0');
const hhmm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

function horaNoDia(hora, dia) {
  const [h, m] = hora.split(':').map(Number);
  const d = new Date(dia);
  d.setHours(h, m, 0, 0);
  return d;
}

function contagem(seg) {
  const a = Math.abs(seg);
  return `${seg < 0 ? '+' : ''}${pad(Math.floor(a / 60))}:${pad(a % 60)}`;
}

/** People and music of an item (names resolved by the main process). */
function detalhe(item) {
  if (!item) return '';
  const partes = [];
  if (item.pessoas && item.pessoas.length) partes.push(item.pessoas.join(' · '));
  if (item.musica) partes.push(`♪ ${item.musica}`);
  return partes.join('\n');
}

function fimDoItem(item, agora) {
  if (item.hora_fim_fixa) return horaNoDia(item.hora_fim_fixa, agora);
  if (item.duracao && item.hora_inicio) return new Date(new Date(item.hora_inicio).getTime() + item.duracao * 60000);
  return null;
}

function corContagem(restante) {
  if (restante < 0 || restante <= 60) return '#ef4444';
  if (restante <= 600) return '#f59e0b';
  return 'var(--destaque)';
}

function aplicarTema(config) {
  const c = { ...PADRAO, ...(config || {}) };
  const root = document.documentElement.style;
  root.setProperty('--fundo', c.cor_fundo);
  root.setProperty('--texto', c.cor_texto);
  root.setProperty('--destaque', c.cor_destaque);
  // The logo is a web URL — only shown if it happens to load (cached/online)
  for (const id of ['logo-canto', 'logo-espera']) {
    const img = $(id);
    if (c.logo_url && img.getAttribute('src') !== c.logo_url) {
      img.onload = () => { img.dataset.ok = '1'; desenhar(); };
      img.onerror = () => { img.dataset.ok = ''; img.style.display = 'none'; };
      img.src = c.logo_url;
    }
    if (!c.logo_url) img.dataset.ok = '';
  }
  return c;
}

function desenhar() {
  if (!estado) return;
  const config = aplicarTema(estado.config);
  const agora = new Date();
  const relogio = agora.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const escala = estado.escala || [];
  const ev = estado.evento;
  const idx = escala.findIndex(i => i.status === 'atual');
  const item = idx !== -1 ? escala[idx] : null;
  const terminado = !item && escala.some(i => i.status === 'concluido');
  const logoOk = !!$('logo-canto').dataset.ok;

  $('espera').style.display = item ? 'none' : '';
  $('ativo').style.display = item ? 'flex' : 'none';
  $('logo-canto').style.display = logoOk && (item || terminado) ? '' : 'none';
  $('logo-espera').style.display = logoOk && !item ? '' : 'none';

  if (!item) {
    $('espera-titulo').textContent = ev?.titulo || 'Culto';
    let inicio = null;
    if (ev?.hora) {
      const [y, m, d] = ev.data.slice(0, 10).split('-').map(Number);
      inicio = horaNoDia(ev.hora, new Date(y, m - 1, d));
    }
    const falta = inicio ? Math.round((inicio - agora) / 1000) : null;
    if (!terminado && falta !== null && falta > 0 && falta < 6 * 3600) {
      $('espera-relogio').textContent = contagem(falta);
      $('espera-relogio').style.color = 'var(--destaque)';
      $('espera-legenda').textContent = 'O culto começa em';
    } else {
      $('espera-relogio').textContent = config.mostrar_relogio ? relogio : '';
      $('espera-relogio').style.color = '';
      $('espera-legenda').textContent = terminado ? 'Culto terminado' : (config.mensagem_espera ? '' : 'A aguardar início...');
    }
    $('espera-mensagem').textContent = !terminado && config.mensagem_espera ? config.mensagem_espera : '';
  } else {
    const fim = fimDoItem(item, agora);
    const restante = fim ? Math.round((fim - agora) / 1000) : null;

    $('ativo-relogio').textContent = config.mostrar_relogio ? relogio : '';
    $('ativo-relogio').style.fontSize = restante !== null ? '' : '6vw';
    $('contagem').style.display = restante !== null ? '' : 'none';
    if (restante !== null) {
      $('contagem').textContent = contagem(restante);
      $('contagem').style.color = corContagem(restante);
      $('contagem').classList.toggle('piscar', restante < 0);
    }
    $('titulo').textContent = item.titulo;
    $('detalhe').textContent = detalhe(item);
    $('obs').style.display = item.observacoes ? '' : 'none';
    $('obs').textContent = item.observacoes ? `“${item.observacoes}”` : '';

    const tempos = [];
    if (item.hora_inicio) tempos.push(`▶ ${hhmm(new Date(item.hora_inicio))}`);
    if (fim) tempos.push(`■ ${hhmm(fim)}${item.hora_fim_fixa ? '' : ' ~'}`);
    else if (item.duracao) tempos.push(`⏱ ${item.duracao} min`);
    $('tempos').textContent = tempos.join('     ');
  }

  // Next non-section item
  let seguinte = null;
  if (item) for (let i = idx + 1; i < escala.length; i++) if (escala[i].tipo !== 'seccao') { seguinte = escala[i]; break; }
  $('seguinte').style.display = seguinte && config.mostrar_seguinte ? '' : 'none';
  if (seguinte) {
    $('seguinte-titulo').textContent = seguinte.titulo;
    $('seguinte-detalhe').textContent = detalhe(seguinte);
  }

  const msg = ev?.mensagem_projecao || '';
  const caixa = $('mensagem');
  if (msg !== $('mensagem-texto').textContent) {
    // restart the flashing for every new message
    caixa.classList.remove('piscar-msg');
    void caixa.offsetWidth;
    if (msg) caixa.classList.add('piscar-msg');
  }
  caixa.style.display = msg ? 'flex' : 'none';
  $('mensagem-texto').textContent = msg;
  document.body.classList.toggle('com-mensagem', !!msg);
}

window.projecao.onEstado((novo) => {
  estado = novo;
  desenhar();
});
window.projecao.pedirEstado();
setInterval(desenhar, 1000);
