let offlineData = null;

const agendaView = document.getElementById('agenda-view');
const eventView = document.getElementById('event-view');
const loadingEl = document.getElementById('loading');
const eventsList = document.getElementById('events-list');
const eventContent = document.getElementById('event-content');
const lastSyncDate = document.getElementById('last-sync-date');
const offlineBanner = document.getElementById('offline-banner');

async function init() {
    try {
        offlineData = await window.electron.getOfflineData();
        loadingEl.style.display = 'none';

        if (!offlineData || !offlineData.eventos) {
            showNoData();
            return;
        }

        lastSyncDate.textContent = new Date(offlineData.lastSync).toLocaleString('pt-PT');
        offlineBanner.style.display = 'flex';
        renderAgenda();
        showAgenda();
    } catch (err) {
        console.error('Initialization error:', err);
        loadingEl.innerHTML = `<div class="empty-box"><div class="empty-icon">⚠️</div><div class="empty-title">Erro</div><p class="empty-text">${err.message}</p></div>`;
    }
}

function showAgenda() {
    agendaView.style.display = '';
    eventView.style.display = 'none';
}

function showEvent() {
    agendaView.style.display = 'none';
    eventView.style.display = '';
}

function renderAgenda() {
    eventsList.innerHTML = '';

    const sorted = [...offlineData.eventos].sort((a, b) => new Date(a.data) - new Date(b.data));

    if (sorted.length === 0) {
        eventsList.innerHTML = '<div class="empty-box"><div class="empty-icon">📅</div><div class="empty-title">Nenhum evento</div><p class="empty-text">Sincronize os dados com internet usando o menu Liturgia > Sincronizar Tudo.</p></div>';
        return;
    }

    sorted.forEach(event => {
        const card = document.createElement('div');
        card.className = 'card event-card';
        card.onclick = () => loadEvent(event.id);
        card.innerHTML = `
            <div>
                <div class="event-meta">${formatDate(new Date(event.data))}</div>
                <div class="event-title">${event.titulo || 'Culto'}</div>
            </div>
            <span class="chevron">›</span>
        `;
        eventsList.appendChild(card);
    });
}

function loadEvent(eventId) {
    const event = offlineData.eventos.find(e => e.id === eventId);
    if (!event) return;

    const items = (offlineData.escalas || []).filter(i => i.evento_id === eventId).sort((a, b) => a.ordem - b.ordem);
    const roles = (offlineData.cargos || []).filter(c => c.evento_id === eventId);

    document.getElementById('event-title').textContent = event.titulo || 'Culto';
    document.getElementById('event-date').textContent = formatDate(new Date(event.data));

    renderEventContent(items, roles);
    showEvent();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderEventContent(items, roles) {
    eventContent.innerHTML = '';

    // -- Staff Section --
    if (roles.length > 0) {
        const section = document.createElement('div');
        section.innerHTML = `
            <h2>
                <svg style="display:inline;vertical-align:middle;margin-right:8px;color:#6366f1" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                Equipa de Apoio / Staff
            </h2>
            <div class="staff-grid" id="staff-grid"></div>
            <hr class="staff-divider">
        `;
        eventContent.appendChild(section);

        const grid = document.getElementById('staff-grid');
        roles.forEach(role => {
            const func = (offlineData.funcoes || []).find(f => f.id === role.funcao_id);
            const member = (offlineData.membros || []).find(m => m.id === role.pessoa_id);
            const sub = role.substituto_id ? (offlineData.membros || []).find(m => m.id === role.substituto_id) : null;

            let nameHtml;
            if (sub) {
                nameHtml = `<div class="staff-name-crossed">${member?.nome || role.pessoa_nome || ''}</div><div class="staff-name-sub">${sub.nome}</div>`;
            } else if (member) {
                nameHtml = `<div class="staff-name">${member.nome}</div>`;
            } else if (role.pessoa_nome) {
                nameHtml = `<div class="staff-name">${role.pessoa_nome}</div>`;
            } else {
                nameHtml = `<div class="staff-name staff-unset">Não definido</div>`;
            }

            const card = document.createElement('div');
            card.className = 'staff-card';
            card.innerHTML = `
                <div class="staff-badge" style="background:${func?.cor || '#6b7280'}">${func?.nome || 'Cargo'}</div>
                ${nameHtml}
            `;
            grid.appendChild(card);
        });
    }

    // -- Timeline --
    items.forEach((item, idx) => {
        if (item.tipo === 'seccao') {
            const sec = document.createElement('div');
            sec.className = 'section-header';
            sec.innerHTML = `<h2>${item.titulo}</h2>`;
            eventContent.appendChild(sec);
            return;
        }

        const member = (offlineData.membros || []).find(m => m.id === item.pessoa_id);
        const sub = item.substituto_id ? (offlineData.membros || []).find(m => m.id === item.substituto_id) : null;

        let personHtml = '';
        if (item.tipo === 'musica') {
            personHtml = item.musica
                ? `<div class="item-music">${item.musica}</div>`
                : `<div class="item-music empty">(Música não definida)</div>`;
        } else if (item.tipo === 'responsabilidade') {
            if (sub) {
                personHtml = `
                    <div>
                        <span class="item-person-crossed">${member?.nome || item.pessoa_nome || ''}</span>
                        <span class="item-person-sub">${sub.nome}</span>
                    </div>`;
            } else {
                const name = member?.nome || item.pessoa_nome;
                personHtml = name
                    ? `<div class="item-person">${name}</div>`
                    : `<div class="item-person empty">(Não definido)</div>`;
            }
        } else if (item.tipo === 'fixo' && item.observacoes) {
            personHtml = `<div style="color:#6b7280;font-style:italic">${item.observacoes}</div>`;
        }

        const obsHtml = item.observacoes && item.tipo !== 'fixo'
            ? `<div class="item-obs">Obs: ${item.observacoes}</div>` : '';

        const iconSvg = {
            musica: `<svg class="item-icon musica" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
            responsabilidade: `<svg class="item-icon responsabilidade" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
            fixo: `<svg class="item-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14 2z"/><polyline points="14 2 14 8 20 8"/></svg>`
        };

        const card = document.createElement('div');
        card.className = `item-card ${item.tipo || 'fixo'}`;
        card.innerHTML = `
            <div style="display:flex;flex-direction:column;align-items:center;min-width:40px;">
                <div class="item-number">${idx + 1}</div>
                ${iconSvg[item.tipo] || ''}
            </div>
            <div class="item-body">
                <div class="item-title">${item.titulo}</div>
                ${personHtml}
                ${obsHtml}
            </div>
        `;
        eventContent.appendChild(card);
    });

    if (items.length === 0) {
        eventContent.innerHTML += '<div class="card" style="text-align:center;color:#6b7280;padding:40px;">Nenhum item na escala deste evento.</div>';
    }
}

function formatDate(date) {
    return date.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function showNoData() {
    agendaView.style.display = '';
    eventView.style.display = 'none';
    offlineBanner.style.display = 'flex';
    lastSyncDate.textContent = 'Nunca';
    document.querySelector('#agenda-view h1').textContent = 'Sem Dados Offline';
    document.querySelector('#agenda-view .page-subtitle').textContent = '';
    eventsList.innerHTML = `
        <div class="empty-box">
            <div class="empty-icon">📡</div>
            <div class="empty-title">Nenhum dado guardado</div>
            <p class="empty-text">Conecte-se à internet e use o menu <strong>Liturgia › Sincronizar Tudo para Offline</strong> para guardar os dados localmente.</p>
            <button class="btn-primary" onclick="window.location.reload()">Tentar Reconectar</button>
        </div>
    `;
}

init();
