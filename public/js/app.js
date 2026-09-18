/* ============================================================
   AGRITECH — app.js
   ============================================================ */

const API = '/api';
let TOKEN = localStorage.getItem('agritech_token') || null;
let currentUser = null;
let pollInterval = null;
let historyChart = null;
let humidityChart = null;
let tempChart = null;
let nutrientsChart = null;
let statusChart = null;
let allSensors = [];
let firstPlotId = null;

/* ── Helpers ─────────────────────────────────────────────── */
const $ = id => document.getElementById(id);

async function api(method, endpoint, body = null) {
  const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
  if (TOKEN) headers['Authorization'] = `Bearer ${TOKEN}`;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API + endpoint, opts);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw json;
  return json;
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(String(str ?? '')));
  return d.innerHTML;
}

function formatDate(ts) {
  return new Date(ts).toLocaleString('es-CO', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
}

function setStatusClass(el, status) {
  el.classList.remove('optimal', 'alert', 'critical');
  el.classList.add(status);
}

/* ── Clock ───────────────────────────────────────────────── */
(function clock() {
  const el = $('clock');
  if (el) {
    const tick = () => { el.textContent = new Date().toLocaleTimeString('es-CO'); };
    tick();
    setInterval(tick, 1000);
  }
})();

/* ── Auth ────────────────────────────────────────────────── */
function switchTab(tab) {
  ['login', 'register'].forEach(t => {
    $(`tab-${t}`).classList.toggle('hidden', t !== tab);
  });
  document.querySelectorAll('.tab-btn').forEach((b, i) => {
    b.classList.toggle('active', (i === 0 && tab === 'login') || (i === 1 && tab === 'register'));
  });
}

async function doLogin() {
  const email    = $('login-email').value.trim();
  const password = $('login-password').value;
  const errEl    = $('login-error');
  errEl.classList.add('hidden');

  if (!email || !password) { showErr(errEl, 'Completa todos los campos.'); return; }

  try {
    const res = await api('POST', '/login', { email, password });
    TOKEN = res.token;
    currentUser = res.user;
    localStorage.setItem('agritech_token', TOKEN);
    bootApp();
  } catch (e) {
    showErr(errEl, e.message || (e.errors?.email?.[0]) || 'Credenciales incorrectas.');
  }
}

async function doRegister() {
  const name     = $('reg-name').value.trim();
  const email    = $('reg-email').value.trim();
  const password = $('reg-password').value;
  const confirm  = $('reg-confirm').value;
  const errEl    = $('reg-error');
  errEl.classList.add('hidden');

  if (!name || !email || !password || !confirm) { showErr(errEl, 'Completa todos los campos.'); return; }
  if (password !== confirm) { showErr(errEl, 'Las contraseñas no coinciden.'); return; }
  if (password.length < 8)  { showErr(errEl, 'Mínimo 8 caracteres.'); return; }

  try {
    const res = await api('POST', '/register', { name, email, password, password_confirmation: confirm });
    TOKEN = res.token;
    currentUser = res.user;
    localStorage.setItem('agritech_token', TOKEN);
    bootApp();
  } catch (e) {
    const msgs = e.errors ? Object.values(e.errors).flat().join(' ') : (e.message || 'Error al registrar.');
    showErr(errEl, msgs);
  }
}

async function doLogout() {
  try { await api('POST', '/logout'); } catch (_) {}
  TOKEN = null;
  currentUser = null;
  localStorage.removeItem('agritech_token');
  clearInterval(pollInterval);
  $('auth-screen').classList.remove('hidden');
  $('app-shell').classList.add('hidden');
}

function showErr(el, msg) {
  el.textContent = escapeHtml(msg);
  el.classList.remove('hidden');
}

/* ── Boot ────────────────────────────────────────────────── */
async function bootApp() {
  $('auth-screen').classList.add('hidden');
  $('app-shell').classList.remove('hidden');

  if (!currentUser) {
    try { currentUser = await api('GET', '/me'); } catch (_) { doLogout(); return; }
  }

  $('nav-user-name').textContent = escapeHtml(currentUser.name);
  $('nav-user-role').textContent = escapeHtml(currentUser.role || 'viewer');

  setupNav();
  await loadDashboard();
  loadWeatherData();
  startPolling();
}

function setupNav() {
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const page = link.dataset.page;
      navigateTo(page);
      if (window.innerWidth <= 768) $('sidebar').classList.remove('open');
    });
  });
}

function navigateTo(page) {
  const oldPage = document.querySelector('.page.active');
  const newPage = $(`page-${page}`);
  
  if (oldPage === newPage) return;

  document.querySelectorAll('.nav-link').forEach(l => l.classList.toggle('active', l.dataset.page === page));
  
  document.querySelectorAll('.page').forEach(p => {
    p.classList.add('hidden');
    p.classList.remove('active');
  });

  newPage.classList.remove('hidden');
  newPage.classList.add('active');
  
  const titles = { dashboard: 'Dashboard', monitoring: 'Monitoreo', reports: 'Reportes' };
  $('topbar-title').textContent = titles[page] || page;

  if (page === 'dashboard') { loadWeatherData(); }

  if (page === 'monitoring') { loadSensors(); loadHistory(); }
  if (page === 'reports')    { loadReportsList(); }
}

function toggleSidebar() {
  $('sidebar').classList.toggle('open');
}

/* ── Dashboard ───────────────────────────────────────────── */
async function loadDashboard() {
  try {
    const data = await api('GET', '/dashboard/summary');
    const plot = data.plots?.[0];
    if (!plot) return;

    firstPlotId = plot.id;
    renderKPIs(plot.sensors);
    renderLocation(plot);
    initCharts(plot.sensors);
  } catch (e) {
    console.error('Dashboard error', e);
  }
}

function renderKPIs(sensors) {
  const grid = $('kpi-grid');
  const labels = { humidity: 'HUMEDAD', temperature: 'TEMPERATURA', nutrients: 'NUTRIENTES' };
  const units = { humidity: '%', temperature: '°C', nutrients: 'ppm' };
  const statusLabels = { optimal: 'Óptimo', alert: 'Alerta', critical: 'Crítico' };

  let html = '';

  // Sensor cards first
  sensors.forEach(s => {
    const v = s.latest?.value ?? '—';
    const st = s.latest?.status ?? 'optimal';
    const unit = s.unit || units[s.type] || '';
    html += `<div class="kpi-card ${st}">
      <div class="kpi-label">${escapeHtml(labels[s.type] || s.type)}</div>
      <div class="kpi-value">${escapeHtml(String(v))}<span class="kpi-unit">${escapeHtml(unit)}</span></div>
      <div class="kpi-status ${st}">${statusLabels[st]}</div>
    </div>`;
  });

  // Overall status card at the end
  const overallStatus = sensors.some(s => s.latest?.status === 'critical') ? 'critical'
    : sensors.some(s => s.latest?.status === 'alert') ? 'alert' : 'optimal';

  const plotName = $('plot-name')?.textContent || '';
  html += `<div class="kpi-card ${overallStatus}">
    <div class="kpi-label">ESTADO CULTIVO</div>
    <div class="kpi-value" style="font-size:22px;font-style:italic">${statusLabels[overallStatus]}</div>
    <div class="kpi-status ${overallStatus}" style="font-size:11px;margin-top:6px">${escapeHtml(plotName)}</div>
  </div>`;

  grid.innerHTML = html;
  
  // Trigger entry animation for cards
  document.querySelectorAll('.kpi-card').forEach((card, i) => {
    card.style.animation = `fadeInUp 0.4s ease-out ${i * 0.1}s both`;
  });
}

function renderLocation(plot) {
  $('plot-name').textContent   = escapeHtml(plot.name);
  $('plot-detail').textContent = escapeHtml(plot.location + ` · ${plot.area} ha`);
  $('plot-coords').textContent = plot.latitude && plot.longitude
    ? `Lat: ${plot.latitude}\nLng: ${plot.longitude}` : '';
}

/* ── Charts ──────────────────────────────────────────────── */
const chartDefaults = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { grid: { color: '#30363d' }, ticks: { color: '#8b949e', maxTicksLimit: 8, font: { size: 10 } } },
    y: { grid: { color: '#30363d' }, ticks: { color: '#8b949e', font: { size: 11 } } }
  }
};

function initCharts(sensors) {
  const humidity    = sensors.find(s => s.type === 'humidity');
  const temperature = sensors.find(s => s.type === 'temperature');
  const nutrients   = sensors.find(s => s.type === 'nutrients');

  // Seed initial data from simulated readings
  const now = Date.now();
  const labels = Array.from({ length: 20 }, (_, i) =>
    new Date(now - (19 - i) * 5 * 60 * 1000).toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit' })
  );

  const seed = (type) => Array.from({ length: 20 }, () => {
    if (type === 'humidity')    return (Math.random() * 40 + 40).toFixed(1);
    if (type === 'temperature') return (Math.random() * 15 + 10).toFixed(1);
    if (type === 'nutrients')   return (Math.random() * 700 + 150).toFixed(0);
  });

  // Humidity chart - blue line with light blue fill, green optimal zone
  if (humidityChart) humidityChart.destroy();
  humidityChart = new Chart($('chart-humidity'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Lectura',
          data: seed('humidity'),
          borderColor: '#0ea5e9',
          backgroundColor: 'rgba(14,165,233,.1)',
          fill: true,
          tension: .4,
          pointRadius: 2,
          pointBackgroundColor: '#0ea5e9',
          borderWidth: 2,
        }
      ]
    },
    options: {
      ...chartDefaults,
      plugins: {
        legend: { display: false },
        annotation: undefined
      },
      scales: {
        x: { ...chartDefaults.scales.x },
        y: { ...chartDefaults.scales.y, min: 20, max: 100, ticks: { ...chartDefaults.scales.y.ticks, callback: v => v + '%' } }
      }
    }
  });

  // Temperature chart - orange line with dot markers
  if (tempChart) tempChart.destroy();
  tempChart = new Chart($('chart-temp'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: '°C',
        data: seed('temperature'),
        borderColor: '#f97316',
        backgroundColor: 'rgba(249,115,22,.1)',
        fill: true,
        tension: .4,
        pointRadius: 3,
        pointBackgroundColor: '#f97316',
        borderWidth: 2,
      }]
    },
    options: {
      ...chartDefaults,
      scales: {
        x: { ...chartDefaults.scales.x },
        y: { ...chartDefaults.scales.y, min: 0, max: 35, ticks: { ...chartDefaults.scales.y.ticks, callback: v => v + '°C' } }
      }
    }
  });

  // Nutrients chart - green bars
  if (nutrientsChart) nutrientsChart.destroy();
  nutrientsChart = new Chart($('chart-nutrients'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'ppm',
        data: seed('nutrients'),
        backgroundColor: 'rgba(34,197,94,.6)',
        borderColor: '#22c55e',
        borderWidth: 1,
        borderRadius: 3,
        barPercentage: 0.7,
        categoryPercentage: 0.8,
      }]
    },
    options: {
      ...chartDefaults,
      scales: {
        x: { ...chartDefaults.scales.x },
        y: { ...chartDefaults.scales.y, min: 0, max: 1200, ticks: { ...chartDefaults.scales.y.ticks, callback: v => v + ' ppm' } }
      }
    }
  });

  // Status donut - green/yellow/red
  if (statusChart) statusChart.destroy();
  statusChart = new Chart($('chart-status'), {
    type: 'doughnut',
    data: {
      labels: ['Óptimo', 'Alerta', 'Crítico'],
      datasets: [{
        data: [65, 25, 10],
        backgroundColor: ['#2ea043', '#d29922', '#b91c1c'],
        borderWidth: 0,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          align: 'end',
          labels: {
            color: '#8b949e',
            padding: 12,
            boxWidth: 12,
            font: { size: 11 }
          }
        }
      },
      cutout: '60%'
    }
  });
}

/* ── Polling ─────────────────────────────────────────────── */
let weatherPollCount = 0;
function startPolling() {
  pollInterval = setInterval(async () => {
    try {
      const qp = firstPlotId ? `?plot_id=${firstPlotId}` : '';
      const sensors = await api('GET', `/sensors/realtime${qp}`);
      allSensors = sensors;
      updateChartsRealtime(sensors);
      updateKPIsRealtime(sensors);

      // Recargar clima cada 15 minutos (180 ciclos de 5s)
      weatherPollCount++;
      if (weatherPollCount >= 180) {
        weatherPollCount = 0;
        loadWeatherData();
      }
    } catch (_) {}
  }, 5000);
}

function updateChartsRealtime(sensors) {
  const now = new Date().toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit' });

  const updateLine = (chart, value) => {
    if (!chart) return;
    chart.data.labels.push(now);
    chart.data.datasets[0].data.push(value);
    if (chart.data.labels.length > 30) {
      chart.data.labels.shift();
      chart.data.datasets[0].data.shift();
    }
    chart.update('none');
  };

  sensors.forEach(s => {
    const v = s.latest_reading?.value;
    if (v == null) return;
    if (s.type === 'humidity')    updateLine(humidityChart, v);
    if (s.type === 'temperature') updateLine(tempChart, v);
    if (s.type === 'nutrients')   updateLine(nutrientsChart, v);
  });
}

function updateKPIsRealtime(sensors) {
  renderKPIs(sensors.map(s => ({
    ...s,
    latest: s.latest_reading
  })));
}

/* ── Monitoring ──────────────────────────────────────────── */
async function loadSensors() {
  try {
    const qp = firstPlotId ? `?plot_id=${firstPlotId}` : '';
    const sensors = await api('GET', `/sensors/realtime${qp}`);
    allSensors = sensors;
    renderSensorsGrid(sensors);
    populateSensorSelect(sensors);
  } catch (e) { console.error(e); }
}

function renderSensorsGrid(sensors) {
  const grid = $('sensors-grid');
  const icons = { humidity: '', temperature: '', nutrients: '' };
  const labels = { humidity: 'Humedad', temperature: 'Temperatura', nutrients: 'Nutrientes' };

  grid.innerHTML = sensors.map(s => {
    const r = s.latest_reading;
    const status = r?.status ?? 'optimal';
    const statusLabels = { optimal: ' Óptimo', alert: ' Alerta', critical: ' Crítico' };
    return `<div class="sensor-card">
      <div class="sensor-type-badge ${escapeHtml(s.type)}">${escapeHtml(labels[s.type] || s.type)}</div>
      <div style="font-size:11px;color:var(--text2);margin-bottom:8px">${escapeHtml(s.name)}</div>
      <div class="sensor-big-value">${escapeHtml(String(r?.value ?? '—'))}<span style="font-size:16px;color:var(--text2);margin-left:4px">${escapeHtml(s.unit)}</span></div>
      <div class="sensor-ts">${r ? formatDate(r.created_at) : '—'}</div>
      <div class="status-pill ${status}">${statusLabels[status]}</div>
      <div style="font-size:10px;color:var(--text2);margin-top:8px">${icons[s.type]} ${escapeHtml(s.plot?.name ?? '')}</div>
    </div>`;
  }).join('');
}

function populateSensorSelect(sensors) {
  const sel = $('history-sensor');
  if (!sel) return;
  sel.innerHTML = sensors.map(s =>
    `<option value="${escapeHtml(String(s.id))}">${escapeHtml(s.name)}</option>`
  ).join('');
}

async function loadHistory() {
  const sensorId = $('history-sensor')?.value;
  const range    = $('history-range')?.value ?? 'day';
  if (!sensorId) return;

  try {
    const data = await api('GET', `/sensors/history?sensor_id=${encodeURIComponent(sensorId)}&range=${encodeURIComponent(range)}`);
    renderHistoryChart(data.readings, range);
  } catch (e) { console.error(e); }
}

function renderHistoryChart(readings, range) {
  const ctx = $('chart-history');
  if (!ctx) return;

  const sensor = allSensors.find(s => String(s.id) === $('history-sensor')?.value);
  const labels = readings.map(r => formatDate(r.created_at));
  const values = readings.map(r => r.value);

  const colors = readings.map(r =>
    r.status === 'critical' ? '#f85149' : r.status === 'alert' ? '#e3b341' : '#3fb950'
  );

  if (historyChart) historyChart.destroy();
  historyChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: sensor?.name ?? 'Sensor',
        data: values,
        borderColor: '#00b4d8',
        backgroundColor: 'rgba(0,180,216,.08)',
        pointBackgroundColor: colors,
        pointRadius: 3,
        fill: true,
        tension: .3,
        borderWidth: 2,
      }]
    },
    options: {
      ...chartDefaults,
      plugins: { legend: { display: true, labels: { color: '#8b949e' } } },
      scales: { ...chartDefaults.scales, x: { ...chartDefaults.scales.x, ticks: { color: '#8b949e', maxTicksLimit: 12 } } }
    }
  });
}

/* ── Reports ─────────────────────────────────────────────── */
function setReportType(type, el) {
  $('report-type').value = type;
  document.querySelectorAll('.report-type-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
}

async function downloadPDF(url, filename) {
  try {
    const headers = { 'Accept': 'application/pdf' };
    if (TOKEN) headers['Authorization'] = `Bearer ${TOKEN}`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error('Error al descargar');
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename || 'reporte_agritech.pdf';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 100);
  } catch (e) {
    console.error('Download error:', e);
    alert('Error al descargar el PDF. Intenta de nuevo.');
  }
}

async function generateReport() {
  const type = $('report-type').value;
  const statusEl = $('report-status');
  const btn = $('btn-gen-report');

  if (!firstPlotId) { showReportStatus('error', '⚠ No hay predio disponible.'); return; }

  btn.disabled = true;
  showReportStatus('loading', '⏳ Generando reporte PDF…');

  try {
    const res = await api('POST', '/reports/generate', { type, plot_id: firstPlotId });
    const downloadUrl = res.download_url;
    const filename = `reporte_${type}_${new Date().toISOString().slice(0,10)}.pdf`;

    showReportStatus('success',
      `✅ Reporte generado. <a href="#" onclick="downloadPDF('${escapeHtml(downloadUrl)}', '${escapeHtml(filename)}'); return false;" style="color:var(--accent);cursor:pointer">⬇ Descargar PDF</a>`
    );

    // Auto-download the PDF
    downloadPDF(downloadUrl, filename);

    loadReportsList();
  } catch (e) {
    showReportStatus('error', `❌ ${escapeHtml(e.message || 'Error al generar reporte.')}`);
  } finally {
    btn.disabled = false;
  }
}

function showReportStatus(type, msg) {
  const el = $('report-status');
  el.className = `report-status ${type}`;
  el.innerHTML = msg;
  el.classList.remove('hidden');
}

async function loadReportsList() {
  try {
    const data = await api('GET', '/reports');
    const list  = $('reports-list');
    const items = data.data ?? [];

    if (!items.length) { list.innerHTML = '<p style="color:var(--text2);font-size:13px;padding:12px 0">No hay reportes generados.</p>'; return; }

    const typeLabel = { daily: 'Diario', weekly: 'Semanal', full: 'Completo' };
    list.innerHTML = `<table class="reports-table">
      <thead><tr><th>Tipo</th><th>Predio</th><th>Fecha</th><th>Acción</th></tr></thead>
      <tbody>${items.map(r => `<tr>
        <td>${escapeHtml(typeLabel[r.type] || r.type)}</td>
        <td>${escapeHtml(r.plot?.name ?? '—')}</td>
        <td>${formatDate(r.created_at)}</td>
        <td><button class="btn-dl" onclick="downloadPDF('/api/reports/${encodeURIComponent(r.id)}/download', 'reporte_${escapeHtml(r.type)}_${r.id}.pdf')"><i class="fas fa-download"></i> PDF</button></td>
      </tr>`).join('')}</tbody>
    </table>`;
  } catch (e) { console.error(e); }
}

/* ── Chatbot ─────────────────────────────────────────────── */
function toggleChat() {
  const window = $('chat-window');
  window.classList.toggle('hidden');
  if (!window.classList.contains('hidden')) {
    $('chat-input').focus();
    $('btn-chat-toggle').classList.add('active');
  } else {
    $('btn-chat-toggle').classList.remove('active');
  }
}

function handleChatKey(e) {
  if (e.key === 'Enter') sendChatMessage();
}

async function sendChatMessage() {
  const input = $('chat-input');
  const msg = input.value.trim();
  if (!msg) return;

  appendMessage('user', msg);
  input.value = '';
  
  const loadingId = appendMessage('bot', '<i>Escribiendo...</i>');
  const chatMsgs = $('chat-messages');

  try {
    const res = await api('POST', '/chatbot/ask', { message: msg });
    removeMessage(loadingId);
    appendMessage('bot', res.message);
  } catch (e) {
    removeMessage(loadingId);
    const errorMsg = e.message || 'Error de conexión con el servidor.';
    appendMessage('bot', `❌ Lo siento, hubo un problema: ${errorMsg}`);
  }
}

function appendMessage(sender, text) {
  const chatMsgs = $('chat-messages');
  const id = 'msg-' + Date.now();
  const div = document.createElement('div');
  div.id = id;
  div.className = `msg ${sender}`;
  div.innerHTML = text;
  chatMsgs.appendChild(div);
  chatMsgs.scrollTop = chatMsgs.scrollHeight;
  return id;
}

/* ── Weather Widget ──────────────────────────────────────── */
async function loadWeatherData(forceRefresh = false) {
  const refreshBtn = document.querySelector('.btn-refresh-weather');
  if (refreshBtn) refreshBtn.classList.add('spinning');

  try {
    const endpoint = forceRefresh ? '/weather?refresh=true' : '/weather';
    const data = await api('GET', endpoint);
    renderWeatherWidget(data);
  } catch (e) {
    console.error('Weather error', e);
    const loc = $('weather-location');
    if (loc) loc.textContent = 'Error al cargar datos meteorológicos';
  } finally {
    if (refreshBtn) {
      setTimeout(() => refreshBtn.classList.remove('spinning'), 500);
    }
  }
}

function renderWeatherWidget(data) {
  if (!data || !data.current) return;

  const c = data.current;
  const loc = data.location;

  // Location
  const locEl = $('weather-location');
  if (locEl) locEl.textContent = `📍 ${loc.name}, ${loc.municipality}, ${loc.department} — ${loc.altitude} msnm`;

  // Weather icon
  const iconEl = $('weather-icon-big');
  if (iconEl) iconEl.innerHTML = `<i class="${escapeHtml(c.weather_icon)}"></i>`;

  // Temperature
  const tempEl = $('weather-temp');
  if (tempEl) tempEl.textContent = `${c.temperature}°C`;

  // Description
  const descEl = $('weather-desc');
  if (descEl) descEl.textContent = c.weather_description;

  // Feels like
  const feelsEl = $('weather-feels');
  if (feelsEl) feelsEl.textContent = `Sensación: ${c.feels_like}°C`;

  // Metrics
  const hmEl = $('wm-humidity');
  if (hmEl) hmEl.textContent = `${c.humidity}%`;

  const windEl = $('wm-wind');
  if (windEl) windEl.textContent = `${c.wind_speed} km/h`;

  const precipEl = $('wm-precip');
  if (precipEl) precipEl.textContent = `${c.precipitation} mm`;

  const pressEl = $('wm-pressure');
  if (pressEl) pressEl.textContent = `${c.pressure ? Math.round(c.pressure) : '--'} hPa`;

  // Alerts
  renderWeatherAlerts(data.alerts || []);

  // Forecast
  renderForecast(data.forecast || []);
}

function renderWeatherAlerts(alerts) {
  const container = $('weather-alerts');
  if (!container) return;

  if (!alerts.length) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = alerts.map((alert, i) => `
    <div class="alert-banner ${escapeHtml(alert.severity)}" style="animation-delay: ${i * 0.1}s">
      <i class="${escapeHtml(alert.icon)}"></i>
      <div class="alert-content">
        <div class="alert-title">${escapeHtml(alert.title)}</div>
        <div class="alert-message">${escapeHtml(alert.message)}</div>
      </div>
    </div>
  `).join('');
}

function renderForecast(forecast) {
  const grid = $('forecast-grid');
  if (!grid || !forecast.length) return;

  const today = new Date().toISOString().slice(0, 10);

  grid.innerHTML = forecast.map(day => {
    const isToday = day.date === today;
    return `
      <div class="forecast-card ${isToday ? 'today' : ''}">
        <div class="forecast-day">${escapeHtml(day.day_name)}</div>
        <div class="forecast-icon"><i class="${escapeHtml(day.icon)}"></i></div>
        <div class="forecast-temps">
          <span class="forecast-temp-max">${day.temp_max}°</span>
          <span class="forecast-temp-min">${day.temp_min}°</span>
        </div>
        <div class="forecast-precip"><i class="fas fa-tint"></i> ${day.precip_probability}%</div>
      </div>
    `;
  }).join('');
}

function removeMessage(id) {
  const el = $(id);
  if (el) el.remove();
}

/* ── Init ────────────────────────────────────────────────── */
(async function init() {
  if (TOKEN) {
    try {
      currentUser = await api('GET', '/me');
      bootApp();
    } catch (_) {
      TOKEN = null;
      localStorage.removeItem('agritech_token');
    }
  }
})();
