function setupGoogleUi() {
  const connectionStatus = document.getElementById('connectionStatus');
  const connectBtn = document.getElementById('connectBtn');
  const disconnectBtn = document.getElementById('disconnectBtn');

  if (!connectionStatus || !connectBtn || !disconnectBtn) return;

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  async function post(url, body) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  async function refreshHealth() {
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      if (data.connected) {
        connectionStatus.className = 'status-pill status-connected';
        connectionStatus.innerHTML = data.email
          ? `<span class="status-dot"></span><span>Google connected</span><span class="google-email">${escapeHtml(data.email)}</span>`
          : '<span class="status-dot"></span><span>Google connected</span>';
        connectBtn.style.display = 'none';
        disconnectBtn.style.display = '';
      } else {
        connectionStatus.className = 'status-pill status-disconnected';
        connectionStatus.innerHTML = '<span class="status-dot"></span><span>Google not connected</span>';
        connectBtn.style.display = '';
        disconnectBtn.style.display = 'none';
      }
    } catch {
      connectionStatus.className = 'status-pill status-disconnected';
      connectionStatus.innerHTML = '<span class="status-dot"></span><span>Unable to check connection</span>';
      connectBtn.style.display = '';
      disconnectBtn.style.display = 'none';
    }
  }

  connectBtn.addEventListener('click', () => {
    window.location.href = '/auth/google/start';
  });

  disconnectBtn.addEventListener('click', async () => {
    const confirmed = window.confirm('Disconnect Google for this app on this machine?');
    if (!confirmed) return;

    try {
      connectBtn.disabled = true;
      disconnectBtn.disabled = true;
      await post('/api/auth/disconnect', {});
      await refreshHealth();
    } catch (err) {
      window.alert(err.message || 'Disconnect failed');
    } finally {
      connectBtn.disabled = false;
      disconnectBtn.disabled = false;
    }
  });

  refreshHealth();
}

window.setupGoogleUi = setupGoogleUi;
