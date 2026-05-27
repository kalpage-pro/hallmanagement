// halls.js — stubbed API calls and rendering for halls page
// Requires auth.js to be loaded first (ensureAuth)

document.addEventListener('DOMContentLoaded', () => {
  if (!window.requireLogin()) return;

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    // allow the link to navigate or force a redirect
    window.location.href = 'index.html';
  });

  getAllActiveHalls();
});

// ── CREATE a new hall ──────────────────────────────────────
async function saveHall() {
  const btn = document.getElementById('saveHallBtn');
  if (btn) btn.disabled = true;
  const name = document.getElementById('hallName').value.trim();
  const description = document.getElementById('hallDesc').value.trim();
  const location = document.getElementById('hallLocation').value.trim();
  const capacity = Number(document.getElementById('hallCapacity').value || 0);
  const hasProjector = document.getElementById('hasProjector').checked;
  const hasAc = document.getElementById('hasAc').checked;
  const hasWhiteboard = document.getElementById('hasWhiteboard').checked;

  // simple validation
  if (!name) {
    window.showGlobalMessage ? window.showGlobalMessage('Please enter a hall name.', 'error') : alert('Please enter a hall name.');
    if (btn) btn.disabled = false;
    return;
  }
  if (!description) {
    window.showGlobalMessage ? window.showGlobalMessage('Please enter a description.', 'error') : alert('Please enter a description.');
    if (btn) btn.disabled = false;
    return;
  }

  const data = await safeApiCall('/production/hall/save', 'POST', {
    name,
    description,
    location,
    capacity,
    hasProjector,
    hasAc,
    hasWhiteboard
  });
  if (!data) {
    if (btn) btn.disabled = false;
    return;
  }
  console.log('Hall saved:', data);
  window.showGlobalMessage ? window.showGlobalMessage('Hall created successfully!', 'info') : alert('Hall created successfully!');
  if (btn) btn.disabled = false;
  await getAllHalls();
}

// ── UPDATE an existing hall ────────────────────────────────
async function updateHall() {
  const hallId = (document.getElementById('hallId').value || '').trim();
  if (!isValidIdValue(hallId)) {
    window.showGlobalMessage ? window.showGlobalMessage('Please enter Hall ID before updating.', 'error') : alert('Please enter Hall ID before updating.');
    return;
  }

  const data = await safeApiCall('/production/hall/update', 'POST', {
    id: hallId,
    name: document.getElementById('hallName').value,
    description: document.getElementById('hallDesc').value,
    location: document.getElementById('hallLocation').value,
    capacity: Number(document.getElementById('hallCapacity').value),
    hasProjector: document.getElementById('hasProjector').checked,
    hasAc: document.getElementById('hasAc').checked,
    hasWhiteboard: document.getElementById('hasWhiteboard').checked,
    status: true
  });
  if (!data) return;
  console.log('Hall updated:', data);
  alert('Hall updated!');
  await getAllHalls();
}

// ── 1. Get one hall by its ID ──────────────────────────────
async function getHallById(hallId) {
  const cleanId = (hallId || '').toString().trim();
  if (!isValidIdValue(cleanId)) {
    window.showGlobalMessage ? window.showGlobalMessage('Hall ID is required.', 'error') : alert('Hall ID is required.');
    return null;
  }
  const data = await apiCall('/production/hall/get/one/' + encodeURIComponent(cleanId));
  console.log('Hall details:', data);
  return data;
}

// ── 2. Get ALL active halls (use this on page load) ────────
async function getAllActiveHalls() {
  const listEl = document.getElementById('hallsList');
  if (listEl) listEl.textContent = 'Loading...';

  const data = await safeApiCall('/production/hall/get/all/active');
  if (data) {
    console.log('All halls:', data);
    renderHallsTable(normalizeHallList(data));
    return;
  }
  console.warn('Could not fetch active halls — using sample data');
  renderHallsTable(sampleHalls());
}

// Helper that returns the normalized list (does not render)
async function getAllActiveHallsData() {
  const data = await safeApiCall('/production/hall/get/all/active');
  if (!data) return [];
  return normalizeHallList(data);
}

// ── 3. Search halls by name ────────────────────────────────
async function searchByName() {
  const name = (document.getElementById('searchName').value || '').trim();
  if (!name) return alert('Enter a name to search.');

  const data = await safeApiCall(`/production/hall/get/name/like/${encodeURIComponent(name)}`);
  let list = normalizeHallList(data);

  // If server returned nothing, fall back to client-side filter of all halls
  if ((!list || list.length === 0)) {
    const all = await getAllActiveHallsData();
    const lower = name.toLowerCase();
    list = all.filter(h => (h.name || '').toLowerCase().includes(lower));
  }

  renderHallsTable(list);
}

// ── 4. Search halls by capacity ───────────────────────────
async function searchByCapacity() {
  const capacityVal = (document.getElementById('searchCapacity').value || '').trim();
  if (!capacityVal) return alert('Enter a capacity number.');
  const capacity = Number(capacityVal);
  if (Number.isNaN(capacity)) return alert('Enter a valid number for capacity.');

  const data = await safeApiCall(`/production/hall/get/capacity/less/equal/${encodeURIComponent(capacity)}`);
  let list = normalizeHallList(data);

  // If server returned nothing, fallback to client-side filter
  if ((!list || list.length === 0)) {
    const all = await getAllActiveHallsData();
    list = all.filter(h => Number(h.capacity) <= capacity);
  }

  renderHallsTable(list);
}

// ── 5. Advanced search ────────────────────────────────────
async function advancedSearch() {
  const name = document.getElementById('advName').value || 'all';
  const capacity = document.getElementById('advCapacity').value || '0';
  const hasProjector = document.getElementById('advProjector').checked ? 'true' : 'false';
  const hasAc = document.getElementById('advAc').checked ? 'true' : 'false';
  const hasWhiteboard = document.getElementById('advWhiteboard').checked ? 'true' : 'false';
  const status = 'true';

  const url = `/production/hall/advanced/search/${encodeURIComponent(name)}/${encodeURIComponent(capacity)}/${hasProjector}/${hasAc}/${hasWhiteboard}/${status}`;
  const data = await safeApiCall(url);
  if (!data) return;
  renderHallsTable(normalizeHallList(data));
}

// ── Render halls into an HTML table ───────────────────────
function renderHallsTable(halls) {
  const tbody = document.getElementById('hallsTableBody');
  if (!tbody) return;

  const rows = Array.isArray(halls) ? halls : [];
  tbody.innerHTML = '';

  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="muted">No halls found.</td></tr>';
    return;
  }

  rows.forEach(hall => {
    tbody.innerHTML += `
      <tr>
        <td>${escapeHtml(hall.name ?? '')}</td>
        <td>${escapeHtml(hall.description ?? '')}</td>
        <td>${escapeHtml(hall.location ?? '')}</td>
        <td>${escapeHtml(hall.capacity ?? '')}</td>
        <td>${hall.hasProjector ? '✅' : '❌'}</td>
        <td>${hall.hasAc ? '✅' : '❌'}</td>
        <td>${hall.hasWhiteboard ? '✅' : '❌'}</td>
        <td><button type="button" onclick="bookHall('${escapeJs(hall.id ?? '')}','${escapeJs(hall.name ?? '')}')">Book</button></td>
      </tr>`;
  });
}

// Navigate to bookings page and prefill with hall info
function bookHall(hallId, hallName) {
  if (!isValidIdValue(hallId)) {
    window.showGlobalMessage ? window.showGlobalMessage('Cannot book this hall because Hall ID is missing.', 'error') : alert('Cannot book this hall because Hall ID is missing.');
    return;
  }
  const params = new URLSearchParams({ hallId: hallId || '', hallName: hallName || '' });
  window.location.href = `bookings.html?${params.toString()}`;
}

window.bookHall = bookHall;

function normalizeHallList(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.content)) return data.content;
  if (data && Array.isArray(data.data)) return data.data;
  if (data && Array.isArray(data.result)) return data.result;
  return [];
}

function sampleHalls() {
  return [
    { id: 1, name: 'Main Hall', description: 'Large event hall', location: 'Block A', capacity: 200, hasProjector: true, hasAc: true, hasWhiteboard: true, status: true },
    { id: 2, name: 'Conference Room A', description: 'Medium meeting room', location: 'Block B', capacity: 50, hasProjector: true, hasAc: true, hasWhiteboard: false, status: true },
    { id: 3, name: 'Banquet Hall', description: 'Banquet and ceremony hall', location: 'Block C', capacity: 120, hasProjector: false, hasAc: true, hasWhiteboard: false, status: true }
  ];
}


// Simple escaping helper
function escapeHtml(s){
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

function escapeJs(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function isValidIdValue(id) {
  const v = String(id || '').trim().toLowerCase();
  return !!v && v !== 'null' && v !== 'undefined';
}

window.saveHall = saveHall;
window.updateHall = updateHall;
window.getHallById = getHallById;
window.getAllActiveHalls = getAllActiveHalls;
window.searchByName = searchByName;
window.searchByCapacity = searchByCapacity;
window.advancedSearch = advancedSearch;
// Backward-compatible aliases used by older buttons
window.getAllHalls = getAllActiveHalls;
window.searchHallByName = searchByName;
window.searchHallByCapacity = searchByCapacity;
window.renderHallsTable = renderHallsTable;
