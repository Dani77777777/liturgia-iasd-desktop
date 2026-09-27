// Offline panel: agenda + a service that can be run without internet.
// Changes are applied locally by the main process and sent to Supabase later.

let offlineData = null;
let estado = null; // live state of the open service (from the main process)

const $ = (id) => document.getElementById(id);
const agendaView = $('agenda-view');
const eventView = $('event-view');
const loadingEl = $('loading');
const eventsList = $('events-list');
const eventContent = $('event-content');
const footerBar = $('footer-bar');

/** Everything shown comes from the database — never inject it as HTML. */
function esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** "2026-09-19T00:00:00+00:00" → local date of that calendar day. */
function dataEvento(data) {
    const [y, m, d] = String(data).slice(0, 10).split('-').map(Number);
    return new Date(y, m - 1, d);
}

function formatDate(date) {
    return date.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function hora(iso) {
    return new Date(iso).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
}

async function init() {
    try {
        offlineData = await window.electron.getOfflineData();
        loadingEl.style.display = 'none';
        $('offline-banner').style.display = 'flex';

        if (!offlineData || !offlineData.eventos) {
            showNoData();
            return;
        }

        $('last-sync-date').textContent = new Date(offlineData.lastSync).toLocaleString('pt-PT');
        $('church-name').textContent = offlineData.igreja ? `${offlineData.igreja} · ` : '';
        renderAgenda();
        showAgenda(false);
        // If we switched to offline in the middle of a service, keep showing it
        window.electron.pedirEstado();
    } catch (err) {
        console.error('Initialization error:', err);
        loadingEl.innerHTML = `<div class="empty-box"><div class="empty-icon">⚠️</div><div class="empty-title">Erro</div><p class="empty-text">${esc(err.message)}</p></div>`;
    }
}

function showAgenda(fecharEvento = true) {
    agendaView.style.display = '';
    eventView.style.display = 'none';
    footerBar.style.display = 'none';
    estado = null;
    if (fecharEvento) window.electron.fecharEvento();
}

function mostrarCabecalho(event) {
    $('event-title').textContent = event.titulo || 'Culto';
    $('event-date').textContent = formatDate(dataEvento(event.data)) + (event.hora ? ` · ${event.hora.slice(0, 5)}` : '');
}

function showEvent() {
    agendaView.style.display = 'none';
    eventView.style.display = '';
    footerBar.style.display = 'flex';
}

function renderAgenda() {
    eventsList.innerHTML = '';
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    // Upcoming first (soonest on top), then the recent past
    const eventos = [...offlineData.eventos].sort((a, b) => dataEvento(a.data) - dataEvento(b.data));
    const proximos = eventos.filter(e => dataEvento(e.data) >= hoje);
    const anteriores = eventos.filter(e => dataEvento(e.data) < hoje).reverse();

    if (eventos.length === 0) {
        eventsList.innerHTML = '<div class="empty-box"><div class="empty-icon">📅</div><div class="empty-title">Nenhum culto</div><p class="empty-text">Sincronize com internet em Liturgia › Sincronizar para offline.</p></div>';
        return;
    }

    const bloco = (titulo, lista) => {
        if (lista.length === 0) return;
        const h = document.createElement('h2');
        h.textContent = titulo;
        h.style.marginTop = '24px';
        eventsList.appendChild(h);
        lista.forEach(event => {
            const card = document.createElement('div');
            card.className = 'card event-card';
            card.onclick = () => loadEvent(event.id);
            card.innerHTML = `
                <div>
                    <div class="event-meta">${esc(formatDate(dataEvento(event.data)))}${event.hora ? ` · ${esc(event.hora.slice(0, 5))}` : ''}</div>
                    <div class="event-title">${esc(event.titulo || 'Culto')}</div>
                </div>
                <span class="chevron">›</span>
            `;
            eventsList.appendChild(card);
        });
    };
    bloco('Próximos', proximos);
    bloco('Anteriores', anteriores);
}

function loadEvent(eventId) {
    const event = offlineData.eventos.find(e => e.id === eventId);
    if (!event) return;
    mostrarCabecalho(event);
    window.electron.abrirEvento(eventId); // main process answers with 'estado-culto'
    showEvent();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function nomeMembro(id) {
    return (offlineData.membros || []).find(m => m.id === id)?.nome;
}

function renderStaff(eventId) {
    const roles = (offlineData.cargos || []).filter(c => c.evento_id === eventId);
    if (roles.length === 0) return;

    const section = document.createElement('div');
    section.innerHTML = '<h2>Equipa de Apoio</h2><div class="staff-grid"></div><hr class="staff-divider">';
    const grid = section.querySelector('.staff-grid');

    roles.forEach(role => {
        const func = (offlineData.funcoes || []).find(f => f.id === role.funcao_id);
        const original = nomeMembro(role.pessoa_id) || role.pessoa_nome;
        const sub = role.substituto_id ? nomeMembro(role.substituto_id) : null;

        let nameHtml;
        if (sub) nameHtml = `<div class="staff-name-crossed">${esc(original)}</div><div class="staff-name-sub">${esc(sub)}</div>`;
        else if (original) nameHtml = `<div class="staff-name">${esc(original)}</div>`;
        else nameHtml = '<div class="staff-name staff-unset">Não definido</div>';

        const card = document.createElement('div');
        card.className = 'staff-card';
        card.innerHTML = `<div class="staff-badge">${esc(func?.nome || 'Cargo')}</div>${nameHtml}`;
        card.querySelector('.staff-badge').style.background = func?.cor || '#6b7280';
        grid.appendChild(card);
    });
    eventContent.appendChild(section);
}

const ICONES = {
    musica: '<svg class="item-icon musica" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
    responsabilidade: '<svg class="item-icon responsabilidade" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    fixo: '<svg class="item-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14 2z"/><polyline points="14 2 14 8 20 8"/></svg>',
};

function renderItem(item, idx) {
    if (item.tipo === 'seccao') {
        const sec = document.createElement('div');
        sec.className = 'section-header';
        sec.innerHTML = `<h2>${esc(item.titulo)}</h2>`;
        return sec;
    }

    // Any item can have people and music (names already resolved by the main process)
    const pessoas = item.pessoas || [];
    let detalhe = '';
    if (pessoas.length) detalhe += `<div class="item-person">${esc(pessoas.join(' · '))}</div>`;
    else if (item.tipo === 'responsabilidade') detalhe += '<div class="item-person empty">(Não definido)</div>';
    if (item.musica) detalhe += `<div class="item-music">${esc(item.musica)}</div>`;
    else if (item.tipo === 'musica') detalhe += '<div class="item-music empty">(Música não definida)</div>';
    if (item.tipo === 'fixo' && item.observacoes) {
        detalhe += `<div style="color:#6b7280;font-style:italic">${esc(item.observacoes)}</div>`;
    }

    const obs = item.observacoes && item.tipo !== 'fixo' ? `<div class="item-obs">Obs: ${esc(item.observacoes)}</div>` : '';

    const tempos = [];
    if (item.hora_inicio) tempos.push(`Início: <strong>${esc(hora(item.hora_inicio))}</strong>`);
    if (item.hora_fim_fixa) tempos.push(`<span class="fixed">Fim: <strong>${esc(item.hora_fim_fixa.slice(0, 5))}</strong> (fixo)</span>`);
    else if (item.duracao) tempos.push(`Duração: <strong>${esc(item.duracao)} min</strong>`);

    const atual = item.status === 'atual';
    const card = document.createElement('div');
    card.className = `item-card ${item.tipo || 'fixo'} ${item.status || ''}`;
    card.id = `item-${item.id}`;
    card.innerHTML = `
        ${atual ? '<div class="on-air">NO AR</div>' : ''}
        <div style="display:flex;flex-direction:column;align-items:center;min-width:40px;">
            <div class="item-number">${idx + 1}</div>
            ${ICONES[item.tipo] || ''}
        </div>
        <div class="item-body">
            <div class="item-title">${esc(item.titulo)}</div>
            ${tempos.length ? `<div class="item-time">🕒 ${tempos.join(' · ')}</div>` : ''}
            ${detalhe}
            ${obs}
        </div>
        <div class="item-actions"></div>
    `;

    const botao = document.createElement('button');
    if (atual) {
        botao.className = 'btn btn-sm btn-red';
        botao.textContent = '■ Parar';
        botao.onclick = () => window.electron.comando('stop');
    } else {
        botao.className = 'btn btn-sm';
        botao.textContent = item.status === 'concluido' ? '↻ Repetir' : '▶ Iniciar';
        botao.onclick = () => window.electron.comando({ ir: item.id });
    }
    card.querySelector('.item-actions').appendChild(botao);
    return card;
}

let ultimoAtual = null;

function renderEvento() {
    if (!estado || !estado.evento) return;
    eventContent.innerHTML = '';
    renderStaff(estado.evento.id);
    estado.escala.forEach((item, idx) => eventContent.appendChild(renderItem(item, idx)));
    if (estado.escala.length === 0) {
        eventContent.innerHTML += '<div class="card" style="text-align:center;color:#6b7280;padding:40px;">Nenhum item na escala deste culto.</div>';
    }

    const atualIdx = estado.escala.findIndex(i => i.status === 'atual');
    $('btn-prev').disabled = atualIdx === -1;
    $('btn-next').disabled = estado.escala.length === 0;

    // Scroll to the item on air only when it changes
    const atual = atualIdx !== -1 ? estado.escala[atualIdx].id : null;
    if (atual && atual !== ultimoAtual) {
        document.getElementById(`item-${atual}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    ultimoAtual = atual;
}

function renderPendentes(n) {
    const el = $('pending-count');
    el.style.display = n > 0 ? '' : 'none';
    el.textContent = `${n} alteração(ões) por enviar`;
}

function showNoData() {
    agendaView.style.display = '';
    eventView.style.display = 'none';
    $('last-sync-date').textContent = 'nunca';
    document.querySelector('#agenda-view h1').textContent = 'Sem dados offline';
    document.querySelector('#agenda-view .page-subtitle').textContent = '';
    eventsList.innerHTML = `
        <div class="empty-box">
            <div class="empty-icon">📡</div>
            <div class="empty-title">Nenhum dado guardado</div>
            <p class="empty-text">Ligue-se à internet e use <strong>Liturgia › Sincronizar para offline</strong> para guardar os dados localmente.</p>
        </div>
    `;
}

// --- wiring ---

$('btn-online').onclick = () => window.electron.voltarOnline();
$('btn-back').onclick = showAgenda;
$('btn-prev').onclick = () => window.electron.comando('previous');
$('btn-next').onclick = () => window.electron.comando('next');
$('btn-project').onclick = () => window.electron.abrirProjecao();
$('btn-reset').onclick = () => {
    if (confirm('Reiniciar o culto? Todos os itens voltam ao estado inicial.')) window.electron.comando('reset');
};

window.electron.onEstado((novo) => {
    renderPendentes(novo.pendentes);
    if (!novo.evento || !offlineData) return;
    if (eventView.style.display === 'none') {
        // Service already open in the main process (e.g. we just went offline mid-service)
        mostrarCabecalho(novo.evento);
        showEvent();
    }
    estado = novo;
    renderEvento();
});

init();
