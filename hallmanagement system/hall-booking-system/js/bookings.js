// bookings.js — booking management API calls and table rendering
// Requires auth.js to be loaded first (requireLogin/apiCall)

document.addEventListener('DOMContentLoaded', () => {
  if (!window.requireLogin()) return;

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'index.html';
  });

  getAllBookings();

  // If the page was opened with hall info (from halls page), prefill the hallId and bookingFor
  try {
    const params = new URLSearchParams(window.location.search);
    const hallId = params.get('hallId');
    const hallName = params.get('hallName');
    if (hallId) {
      const el = document.getElementById('hallId');
      if (el) el.value = hallId;
    }
    if (hallName) {
      const bf = document.getElementById('bookingFor');
      if (bf && !bf.value) bf.value = `Booking — ${hallName}`;
    }
    // prefill userId from params or localStorage
    const paramUser = params.get('userId');
    const userEl = document.getElementById('userId');
    if (paramUser && userEl) userEl.value = paramUser;
    else if (userEl && !userEl.value && localStorage.getItem('user')) userEl.value = localStorage.getItem('user');
  } catch (e) {
    // ignore
  }
});

// ── CREATE a booking ───────────────────────────────────────
async function createBooking() {
  const btn = document.getElementById('createBookingBtn');
  if (btn) btn.disabled = true;

  const reservedDate = (document.getElementById('reservedDate').value || '').trim();
  const startTime = (document.getElementById('startTime').value || '').trim();
  const bookingFor = (document.getElementById('bookingFor').value || '').trim();
  const expectedParticipants = Number(document.getElementById('participants').value || 0);
  const specialRequirements = (document.getElementById('requirements').value || '').trim();
  const hallId = (document.getElementById('hallId').value || '').trim();
  let userId = (document.getElementById('userId').value || '').trim();
  if (!userId) {
    userId = getCurrentUserIdentifier();
    const userEl = document.getElementById('userId');
    if (userEl && userId) userEl.value = userId;
  }

  // basic validation
  if (!reservedDate) {
    window.showGlobalMessage ? window.showGlobalMessage('Please select a reserved date.', 'error') : alert('Please select a reserved date.');
    if (btn) btn.disabled = false;
    return;
  }
  if (!startTime) {
    window.showGlobalMessage ? window.showGlobalMessage('Please select a start time.', 'error') : alert('Please select a start time.');
    if (btn) btn.disabled = false;
    return;
  }
  if (!hallId) {
    window.showGlobalMessage ? window.showGlobalMessage('Please provide a hall ID.', 'error') : alert('Please provide a hall ID.');
    if (btn) btn.disabled = false;
    return;
  }
  if (!userId) {
    window.showGlobalMessage ? window.showGlobalMessage('Please provide a user ID.', 'error') : alert('Please provide a user ID.');
    if (btn) btn.disabled = false;
    return;
  }

  const basePayload = {
    reservedDate,
    startTime,
    bookingFor,
    expectedParticipants,
    specialRequirements,
    hall: { id: hallId },
    createdAt: new Date().toISOString()
  };

  // Try the API with different user-field shapes to handle backend DTO differences.
  let data = await safeApiCall('/production/booking/save', 'POST', {
    ...basePayload,
    requestedBy: { userId }
  });
  if (!data && isUserNotFoundError()) {
    data = await safeApiCall('/production/booking/save', 'POST', {
      ...basePayload,
      requestedBy: { id: userId }
    });
  }
  if (!data && isUserNotFoundError()) {
    // Final fallback: backend may resolve user from JWT token.
    data = await safeApiCall('/production/booking/save', 'POST', basePayload);
  }
  if (!data) {
    if (btn) btn.disabled = false;
    return;
  }
  console.log('Booking created:', data);
  window.showGlobalMessage ? window.showGlobalMessage('Booking created!', 'info') : alert('Booking created!');
  if (btn) btn.disabled = false;
  await getAllBookings();
}

// ── UPDATE a booking ───────────────────────────────────────
async function updateBooking() {
  const btn = document.getElementById('updateBookingBtn');
  if (btn) btn.disabled = true;

  const id = (document.getElementById('bookingId').value || '').trim();
  const reservedDate = (document.getElementById('reservedDate').value || '').trim();
  const startTime = (document.getElementById('startTime').value || '').trim();
  const endTime = (document.getElementById('endTime').value || '').trim();
  const bookingFor = (document.getElementById('bookingFor').value || '').trim();
  const expectedParticipants = Number(document.getElementById('participants').value || 0);
  const specialRequirements = (document.getElementById('requirements').value || '').trim();
  const hallId = (document.getElementById('hallId').value || '').trim();
  let userId = (document.getElementById('userId').value || '').trim();
  if (!userId) {
    userId = getCurrentUserIdentifier();
    const userEl = document.getElementById('userId');
    if (userEl && userId) userEl.value = userId;
  }

  if (!id) {
    window.showGlobalMessage ? window.showGlobalMessage('Please enter booking ID to update.', 'error') : alert('Please enter booking ID to update.');
    if (btn) btn.disabled = false;
    return;
  }
  if (!hallId) {
    window.showGlobalMessage ? window.showGlobalMessage('Please enter Hall ID for booking update.', 'error') : alert('Please enter Hall ID for booking update.');
    if (btn) btn.disabled = false;
    return;
  }
  if (!userId) {
    window.showGlobalMessage ? window.showGlobalMessage('Please enter User ID for booking update.', 'error') : alert('Please enter User ID for booking update.');
    if (btn) btn.disabled = false;
    return;
  }

  const basePayload = {
    id,
    reservedDate,
    startTime,
    endTime,
    bookingFor,
    expectedParticipants,
    specialRequirements,
    hall: { id: hallId },
    createdAt: new Date().toISOString()
  };

  let data = await safeApiCall('/production/booking/update', 'POST', {
    ...basePayload,
    requestedBy: { userId }
  });
  if (!data && isUserNotFoundError()) {
    data = await safeApiCall('/production/booking/update', 'POST', {
      ...basePayload,
      requestedBy: { id: userId }
    });
  }
  if (!data && isUserNotFoundError()) {
    data = await safeApiCall('/production/booking/update', 'POST', basePayload);
  }
  if (!data) {
    if (btn) btn.disabled = false;
    return;
  }
  console.log('Booking updated:', data);
  window.showGlobalMessage ? window.showGlobalMessage('Booking updated!', 'info') : alert('Booking updated!');
  if (btn) btn.disabled = false;
  await getAllBookings();
}

// ── VERIFY or CANCEL a booking ─────────────────────────────
async function updateBookingStatus(bookingId, approve) {
  const cleanId = (bookingId || '').toString().trim();
  if (!cleanId) {
    window.showGlobalMessage ? window.showGlobalMessage('Booking ID is required to change status.', 'error') : alert('Booking ID is required to change status.');
    return;
  }
  const data = await safeApiCall('/production/booking/update/status', 'POST', {
    id: cleanId,
    status: approve,
    updatedAt: new Date().toISOString()
  });
  if (!data) return;
  console.log('Booking status updated:', data);
  alert(approve ? 'Booking verified!' : 'Booking cancelled!');
  await getAllBookings();
}

// ── 6. Get ALL bookings (use this on page load) ────────────
async function getAllBookings() {
  const listEl = document.getElementById('bookingsList');
  if (listEl) listEl.textContent = 'Loading...';

  const data = await safeApiCall('/production/booking/get/all/bookings');
  if (data) {
    console.log('All bookings:', data);
    renderBookingsTable(normalizeBookingList(data));
    return;
  }
  console.warn('Could not fetch bookings — using sample data');
  renderBookingsTable(sampleBookings());
}

// ── 7. Get one booking by ID ───────────────────────────────
async function getBookingById(bookingId) {
  const cleanId = (bookingId || '').toString().trim();
  if (!cleanId) {
    window.showGlobalMessage ? window.showGlobalMessage('Booking ID is required.', 'error') : alert('Booking ID is required.');
    return null;
  }
  const data = await safeApiCall(`/production/booking/get/one/${encodeURIComponent(cleanId)}`);
  if (!data) return;
  console.log('Booking:', data);
  renderBookingsTable(normalizeBookingList(data, true));
}

async function loadBookingByIdFromField() {
  const bookingId = (document.getElementById('searchBookingId').value || '').trim();
  if (!bookingId) {
    alert('Please enter a booking ID.');
    return;
  }
  await getBookingById(bookingId);
}

// ── Helper: draw bookings into a table ────────────────────
function renderBookingsTable(bookings) {
  const tbody = document.getElementById('bookingsTableBody');
  if (!tbody) return;

  const rows = Array.isArray(bookings) ? bookings : [];
  tbody.innerHTML = '';

  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="muted">No bookings found.</td></tr>';
    return;
  }

  rows.forEach(booking => {
    tbody.innerHTML += `
      <tr>
        <td>${escapeHtml(booking.id ?? '')}</td>
        <td>${escapeHtml(booking.bookingFor ?? '')}</td>
        <td>${escapeHtml(booking.reservedDate ?? '')}</td>
        <td>${escapeHtml(booking.startTime ?? '')}</td>
        <td>${escapeHtml(booking.expectedParticipants ?? '')}</td>
      </tr>`;
  });
}

function normalizeBookingList(data, single = false) {
  if (Array.isArray(data)) return data;
  if (single && data) return [data];
  if (data && Array.isArray(data.content)) return data.content;
  if (data && Array.isArray(data.data)) return data.data;
  if (data && Array.isArray(data.result)) return data.result;
  if (data && Array.isArray(data.bookings)) return data.bookings;
  return [];
}

function getCurrentUserIdentifier() {
  const fromStorage = (localStorage.getItem('user') || '').trim();
  if (fromStorage) return fromStorage;

  const token = localStorage.getItem('token');
  if (!token) return '';
  try {
    const payload = token.split('.')[1] || '';
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return (json.sub || '').toString().trim();
  } catch (e) {
    return '';
  }
}

function isUserNotFoundError() {
  const err = window.lastApiError;
  if (!err) return false;
  const payloadText = typeof err.payload === 'string' ? err.payload : JSON.stringify(err.payload || {});
  const msg = `${err.message || ''} ${payloadText}`.toLowerCase();
  return msg.includes('user not found');
}

function sampleBookings() {
  return [
    {
      id: 1,
      reservedDate: '2026-06-01',
      startTime: '09:00:00',
      endTime: '11:00:00',
      bookingFor: 'Workshop',
      expectedParticipants: 40,
      specialRequirements: 'Projector',
      hall: { id: 'H-001' },
      requestedBy: { userId: 'U-001' },
      status: true
    },
    {
      id: 2,
      reservedDate: '2026-06-05',
      startTime: '13:00:00',
      endTime: '15:00:00',
      bookingFor: 'Seminar',
      expectedParticipants: 60,
      specialRequirements: 'AC and whiteboard',
      hall: { id: 'H-002' },
      requestedBy: { userId: 'U-002' },
      status: false
    }
  ];
}


// Simple escaping helper (duplicate is OK for small starter app)
function escapeHtml(s){
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

window.createBooking = createBooking;
window.updateBooking = updateBooking;
window.updateBookingStatus = updateBookingStatus;
window.getAllBookings = getAllBookings;
window.getBookingById = getBookingById;
window.loadBookingByIdFromField = loadBookingByIdFromField;
window.renderBookingsTable = renderBookingsTable;

