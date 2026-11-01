/* ReciclaMais - protótipo funcional em HTML, CSS e JavaScript puro.
   Os dados ficam no localStorage deste navegador/dispositivo.
   Para uso real por vários cidadãos e administradores, será necessário um backend.
*/
const STORAGE_KEYS = { requests: 'reciclamais_requests_v1', admins: 'reciclamais_admins_v1' };
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
let currentAdmin = null;
let selectedRequestId = null;

function readStorage(key, fallback = []) {
  try { const value = JSON.parse(localStorage.getItem(key)); return Array.isArray(value) ? value : fallback; }
  catch { return fallback; }
}
function writeStorage(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function getRequests() { return readStorage(STORAGE_KEYS.requests); }
function saveRequests(items) { writeStorage(STORAGE_KEYS.requests, items); }
function getAdmins() { return readStorage(STORAGE_KEYS.admins); }
function saveAdmins(items) { writeStorage(STORAGE_KEYS.admins, items); }
function escapeHTML(value = '') {
  return String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}
function showNotice(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle('error', isError);
}
function formatDate(value) {
  return new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function createProtocol() {
  const year = new Date().getFullYear();
  const next = String(Date.now()).slice(-6);
  return `RM-${year}-${next}`;
}
function statusClass(status) { return `status-${status.toLowerCase().replaceAll(' ', '-')}`; }

// Cria o administrador inicial apenas na primeira utilização deste navegador.
if (getAdmins().length === 0) {
  saveAdmins([{ id: crypto.randomUUID(), name: 'Administrador principal', email: 'admin@reciclamais.com', password: 'admin123', createdAt: new Date().toISOString(), protected: true }]);
}

// Cadastro de solicitação pelo cidadão.
$('#requestForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const file = data.get('photo');
  let photoData = '';
  if (file && file.size) {
    if (!file.type.startsWith('image/')) return showNotice($('#requestNotice'), 'Selecione um arquivo de imagem válido.', true);
    if (file.size > 700 * 1024) return showNotice($('#requestNotice'), 'A imagem deve ter no máximo 700 KB neste protótipo.', true);
    photoData = await new Promise((resolve, reject) => {
      const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file);
    }).catch(() => '');
  }
  const request = {
    id: crypto.randomUUID(), protocol: createProtocol(), name: data.get('name').trim(), email: data.get('email').trim(),
    phone: data.get('phone').trim(), address: data.get('address').trim(), waste: data.get('waste'),
    quantity: data.get('quantity'), description: data.get('description').trim(), photo: photoData,
    status: 'Pendente', createdAt: new Date().toISOString()
  };
  const requests = getRequests(); requests.unshift(request); saveRequests(requests);
  form.reset();
  showNotice($('#requestNotice'), `Solicitação registrada! Seu protocolo é ${request.protocol}. Guarde esse número para acompanhar o pedido.`);
  $('#protocolInput').value = request.protocol;
  $('#trackingResult').innerHTML = `<div class="result-card">Solicitação registrada com sucesso. Protocolo: <strong>${escapeHTML(request.protocol)}</strong></div>`;
});

// Consulta pública por protocolo.
$('#trackingForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const protocol = $('#protocolInput').value.trim().toUpperCase();
  const request = getRequests().find(item => item.protocol.toUpperCase() === protocol);
  if (!request) {
    $('#trackingResult').innerHTML = '<p class="notice error">Nenhuma solicitação encontrada com esse protocolo. Confira o número digitado.</p>';
    return;
  }
  $('#trackingResult').innerHTML = `<div class="result-card"><div><strong>${escapeHTML(request.protocol)}</strong> · ${escapeHTML(request.waste)}</div><p style="margin:7px 0 3px">Solicitante: ${escapeHTML(request.name)}</p><p style="margin:0">Status: <strong>${escapeHTML(request.status)}</strong></p><small>Registrada em ${formatDate(request.createdAt)}</small></div>`;
});

// Abertura e fechamento de modais.
$('#openLogin').addEventListener('click', () => { $('#loginModal').hidden = false; $('#loginForm').querySelector('input').focus(); });
$$('[data-close]').forEach(button => button.addEventListener('click', () => { $('#' + button.dataset.close).hidden = true; }));
$$('.modal-backdrop').forEach(backdrop => backdrop.addEventListener('click', event => { if (event.target === backdrop) backdrop.hidden = true; }));
document.addEventListener('keydown', event => { if (event.key === 'Escape') $$('.modal-backdrop').forEach(modal => modal.hidden = true); });

// Login administrativo. Demonstração local, sem autenticação segura de servidor.
$('#loginForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const email = data.get('email').trim().toLowerCase();
  const admin = getAdmins().find(item => item.email.toLowerCase() === email && item.password === data.get('password'));
  if (!admin) return showNotice($('#loginNotice'), 'E-mail ou senha incorretos.', true);
  currentAdmin = admin;
  $('#loginModal').hidden = true; $('#adminApp').hidden = false;
  $('#adminWelcome').textContent = admin.name;
  $('#loginForm').reset(); showNotice($('#loginNotice'), '');
  renderAdmin();
});
$('#logoutButton').addEventListener('click', () => { currentAdmin = null; $('#adminApp').hidden = true; });

// Navegação entre as telas do painel.
$$('[data-admin-view]').forEach(button => button.addEventListener('click', () => {
  $$('[data-admin-view]').forEach(item => item.classList.toggle('active', item === button));
  $$('.admin-view').forEach(view => view.hidden = view.id !== button.dataset.adminView);
  renderAdmin();
}));

function renderAdmin() {
  if (!currentAdmin) return;
  const requests = getRequests();
  $('#statTotal').textContent = requests.length;
  $('#statPending').textContent = requests.filter(item => item.status === 'Pendente').length;
  $('#statProgress').textContent = requests.filter(item => item.status === 'Em andamento').length;
  $('#statDone').textContent = requests.filter(item => item.status === 'Concluída').length;
  renderRequests(); renderAdmins();
}
function renderRequests() {
  const search = ($('#requestSearch').value || '').trim().toLowerCase();
  const status = $('#statusFilter').value;
  const filtered = getRequests().filter(item => {
    const matchesSearch = item.protocol.toLowerCase().includes(search) || item.name.toLowerCase().includes(search) || item.address.toLowerCase().includes(search);
    return matchesSearch && (status === 'Todos' || item.status === status);
  });
  $('#requestsTableBody').innerHTML = filtered.map(item => `<tr>
    <td><strong>${escapeHTML(item.protocol)}</strong></td><td>${escapeHTML(item.name)}</td><td>${escapeHTML(item.waste)}</td><td>${formatDate(item.createdAt)}</td>
    <td><span class="status-pill ${statusClass(item.status)}">${escapeHTML(item.status)}</span></td><td><button class="table-action" data-open-request="${item.id}">Ver detalhes</button></td></tr>`).join('');
  $('#emptyRequests').hidden = filtered.length !== 0;
  $$('[data-open-request]').forEach(button => button.addEventListener('click', () => openRequestDetails(button.dataset.openRequest)));
}
$('#requestSearch').addEventListener('input', renderRequests);
$('#statusFilter').addEventListener('change', renderRequests);

function openRequestDetails(id) {
  const request = getRequests().find(item => item.id === id);
  if (!request) return;
  selectedRequestId = id;
  const rows = [
    ['Protocolo', request.protocol], ['Solicitante', request.name], ['E-mail', request.email || 'Não informado'],
    ['Telefone', request.phone || 'Não informado'], ['Endereço', request.address], ['Tipo de resíduo', request.waste],
    ['Quantidade', request.quantity || 'Não informada'], ['Data do pedido', formatDate(request.createdAt)], ['Descrição', request.description]
  ];
  $('#detailContent').innerHTML = `<div class="detail-grid">${rows.map(([label, value], index) => `<div class="detail-item ${index === 8 ? 'full' : ''}"><span>${label}</span><strong>${escapeHTML(value)}</strong></div>`).join('')}${request.photo ? `<div class="detail-item full"><span>Foto anexada</span><img src="${request.photo}" alt="Foto do resíduo" style="max-width:100%;max-height:220px;object-fit:contain"></div>` : ''}</div>`;
  $('#detailStatus').value = request.status; showNotice($('#detailNotice'), ''); $('#detailModal').hidden = false;
}
$('#saveStatusButton').addEventListener('click', () => {
  const requests = getRequests(); const request = requests.find(item => item.id === selectedRequestId);
  if (!request) return;
  request.status = $('#detailStatus').value; saveRequests(requests); renderAdmin();
  showNotice($('#detailNotice'), 'Status atualizado com sucesso.');
});
$('#deleteRequestButton').addEventListener('click', () => {
  const request = getRequests().find(item => item.id === selectedRequestId);
  if (!request || !confirm(`Deseja realmente excluir a solicitação ${request.protocol}?`)) return;
  saveRequests(getRequests().filter(item => item.id !== selectedRequestId));
  $('#detailModal').hidden = true; renderAdmin();
});

// Cadastro e remoção de administradores.
$('#adminForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const name = data.get('name').trim(); const email = data.get('email').trim().toLowerCase(); const password = data.get('password');
  const admins = getAdmins();
  if (admins.some(item => item.email.toLowerCase() === email)) return showNotice($('#adminNotice'), 'Já existe um administrador com esse e-mail.', true);
  admins.push({ id: crypto.randomUUID(), name, email, password, createdAt: new Date().toISOString(), protected: false });
  saveAdmins(admins); event.currentTarget.reset(); renderAdmins();
  showNotice($('#adminNotice'), 'Administrador cadastrado com sucesso.');
});
function renderAdmins() {
  $('#adminsList').innerHTML = getAdmins().map(admin => `<div class="admin-row"><div><strong>${escapeHTML(admin.name)}</strong><small>${escapeHTML(admin.email)}</small></div>${admin.protected ? '<small>Principal</small>' : `<button data-remove-admin="${admin.id}">Remover</button>`}</div>`).join('');
  $$('[data-remove-admin]').forEach(button => button.addEventListener('click', () => {
    const admin = getAdmins().find(item => item.id === button.dataset.removeAdmin);
    if (!admin || !confirm(`Remover o acesso de ${admin.name}?`)) return;
    saveAdmins(getAdmins().filter(item => item.id !== admin.id)); renderAdmins();
  }));
}

// Exportação das solicitações para planilha CSV.
$('#exportButton').addEventListener('click', () => {
  const requests = getRequests();
  if (!requests.length) return alert('Ainda não existem solicitações para exportar.');
  const columns = ['Protocolo','Nome','E-mail','Telefone','Endereço','Resíduo','Quantidade','Descrição','Status','Data'];
  const values = requests.map(item => [item.protocol,item.name,item.email,item.phone,item.address,item.waste,item.quantity,item.description,item.status,formatDate(item.createdAt)]);
  const csv = [columns, ...values].map(row => row.map(value => `"${String(value ?? '').replaceAll('"','""')}"`).join(';')).join('\r\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'solicitacoes-reciclamais.csv'; link.click(); URL.revokeObjectURL(url);
});
