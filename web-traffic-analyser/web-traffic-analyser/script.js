// --- Auth Simulation ---
function login(e) {
    e.preventDefault();
    const email = document.getElementById('email').value;
    if(email) {
        localStorage.setItem('user', email);
        window.location.href = 'dashboard.html';
    }
}

function register(e) {
    e.preventDefault();
    localStorage.setItem('user', document.getElementById('email').value);
    window.location.href = 'dashboard.html';
}

function logout() {
    localStorage.removeItem('user');
    window.location.href = 'index.html';
}

function checkAuth() {
    const user = localStorage.getItem('user');
    if (!user) window.location.href = 'login.html';
    document.getElementById('user-email').textContent = user;
}

// --- Dashboard Logic ---
function initDashboard() {
    checkAuth();
    
    // Simulate Real-Time Visitors
    setInterval(() => {
        const base = 45;
        const fluctuation = Math.floor(Math.random() * 10) - 5;
        document.getElementById('realtime-count').textContent = base + fluctuation;
    }, 2000);

    // Initialize Charts
    const ctxTraffic = document.getElementById('trafficChart').getContext('2d');
    new Chart(ctxTraffic, {
        type: 'line',
        data: {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            datasets: [{
                label: 'Page Views',
                data: [1200, 1900, 3000, 500, 2000, 3000, 4500],
                borderColor: '#2563eb',
                tension: 0.4
            }]
        },
        options: { maintainAspectRatio: false }
    });

    const ctxBrowser = document.getElementById('browserChart').getContext('2d');
    new Chart(ctxBrowser, {
        type: 'doughnut',
        data: {
            labels: ['Chrome', 'Firefox', 'Safari', 'Edge'],
            datasets: [{
                data: [65, 15, 15, 5],
                backgroundColor: ['#2563eb', '#f59e0b', '#10b981', '#64748b']
            }]
        },
        options: { maintainAspectRatio: false }
    });

    const ctxOS = document.getElementById('osChart').getContext('2d');
    new Chart(ctxOS, {
        type: 'bar',
        data: {
            labels: ['Windows', 'Android', 'iOS', 'Linux', 'Mac'],
            datasets: [{
                label: 'Users',
                data: [400, 300, 250, 100, 150],
                backgroundColor: '#3b82f6'
            }]
        },
        options: { maintainAspectRatio: false }
    });
}

function copySnippet() {
    const code = document.getElementById('tracking-code').innerText;
    navigator.clipboard.writeText(code);
    alert('Snippet copied to clipboard!');
}