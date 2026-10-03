const $ = (id) => document.getElementById(id);
const api = window.definicoes;

function mostrarGuardado() {
  $('ok').classList.add('visivel');
  setTimeout(() => $('ok').classList.remove('visivel'), 1500);
}

async function guardar(dados) {
  await api.guardar(dados);
  mostrarGuardado();
  await carregar();
}

async function carregar() {
  const d = await api.obter();

  $('pasta').value = d.pastaCultos;
  $('modelo').value = d.ficheiroModelo;
  const det = $('detetado');
  if (d.detetado) {
    det.className = 'detetado';
    det.textContent = `✓ A usar: ${d.detetado.pastaCultos}  ·  modelo: ${d.detetado.modelo}`;
  } else {
    det.className = 'detetado falta';
    det.textContent = '⚠ Nenhuma pasta "Cultos" encontrada neste momento (disco desligado?).';
  }

  const sel = $('ecra');
  sel.innerHTML = '';
  const auto = new Option('Automático (segundo ecrã)', '');
  sel.add(auto);
  for (const e of d.ecras) sel.add(new Option(e.nome, String(e.id)));
  if (d.projectionDisplayId !== null && !d.ecras.some(e => e.id === d.projectionDisplayId)) {
    sel.add(new Option('Ecrã guardado (não ligado agora)', String(d.projectionDisplayId)));
  }
  sel.value = d.projectionDisplayId === null ? '' : String(d.projectionDisplayId);

  const sync = d.ultimaSincronizacao ? new Date(d.ultimaSincronizacao).toLocaleString('pt-PT') : 'nunca';
  $('offline-info').textContent = `Igreja guardada: ${d.igreja ?? '—'}. Última sincronização: ${sync}.` +
    (d.pendentes ? ` ${d.pendentes} alteração(ões) feitas offline por enviar.` : '');
  $('versao').textContent = `Versão ${d.versao}`;
  $('lja-endereco').value = d.louvorjaEndereco;
  $('lja-token').value = d.louvorjaToken;
}

$('escolher-pasta').onclick = async () => {
  const p = await api.escolherPasta();
  if (p) guardar({ pastaCultos: p });
};
$('limpar-pasta').onclick = () => guardar({ pastaCultos: '' });
$('escolher-modelo').onclick = async () => {
  const f = await api.escolherFicheiro();
  if (f) guardar({ ficheiroModelo: f });
};
$('limpar-modelo').onclick = () => guardar({ ficheiroModelo: '' });
$('ecra').onchange = (e) => guardar({ projectionDisplayId: e.target.value ? Number(e.target.value) : null });
$('logs').onclick = () => api.abrirLogs();
$('lja-endereco').onchange = (e) => guardar({ louvorjaEndereco: e.target.value });
$('lja-token').onchange = (e) => guardar({ louvorjaToken: e.target.value });
$('lja-testar').onclick = async () => {
  // Save what is typed first, in case the field still has focus
  await api.guardar({ louvorjaEndereco: $('lja-endereco').value, louvorjaToken: $('lja-token').value });
  const r = $('lja-resultado');
  r.className = 'detetado';
  r.textContent = 'A testar…';
  const t = await api.testarLouvorJA();
  r.className = t.ok ? 'detetado' : 'detetado falta';
  r.textContent = (t.ok ? '✓ ' : '⚠ ') + t.mensagem;
};
$('sincronizar').onclick = async () => {
  $('sincronizar').disabled = true;
  $('sincronizar').textContent = 'A sincronizar…';
  await api.sincronizar();
  $('sincronizar').disabled = false;
  $('sincronizar').textContent = 'Sincronizar agora';
  carregar();
};

carregar();
