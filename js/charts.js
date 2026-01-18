// Charts Module for Admin Dashboard
// Using Chart.js for professional visualizations

let chartsInitialized = false;
let userStatsChart = null;
let roleDistChart = null;
let requestsChart = null;

/**
 * Initialize all dashboard charts
 */
async function initDashboardCharts() {
    if (chartsInitialized) return;

    // Wait for Chart.js to load
    if (typeof Chart === 'undefined') {
        console.warn('Chart.js not loaded yet, will retry...');
        setTimeout(initDashboardCharts, 500);
        return;
    }

    // Set default Chart.js options
    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.color = getComputedStyle(document.documentElement).getPropertyValue('--text-main').trim();

    chartsInitialized = true;

    // Initialize charts
    renderUserStatsChart();
    renderRoleDistributionChart();
    renderRequestsChart();
}

/**
 * Get chart colors based on current theme
 */
function getChartColors() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const style = getComputedStyle(document.documentElement);

    return {
        primary: style.getPropertyValue('--primary').trim() || '#6366f1',
        secondary: style.getPropertyValue('--secondary').trim() || '#10b981',
        warning: style.getPropertyValue('--warning').trim() || '#f59e0b',
        danger: style.getPropertyValue('--danger').trim() || '#ef4444',
        info: style.getPropertyValue('--info').trim() || '#3b82f6',
        accent: style.getPropertyValue('--accent').trim() || '#8b5cf6',
        gridColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
        textColor: isDark ? '#94a3b8' : '#64748b'
    };
}

/**
 * User Statistics Line Chart
 */
function renderUserStatsChart() {
    const canvas = document.getElementById('user-stats-chart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const colors = getChartColors();

    // Destroy existing chart
    if (userStatsChart) {
        userStatsChart.destroy();
    }

    // Calculate monthly user registrations (mock data for demo)
    const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin'];
    const data = [5, 12, 8, 15, 22, allUsers.length];

    userStatsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: months,
            datasets: [{
                label: 'Nouveaux utilisateurs',
                data: data,
                borderColor: colors.primary,
                backgroundColor: `${colors.primary}20`,
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: colors.primary,
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        color: colors.textColor,
                        usePointStyle: true,
                        padding: 15
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    backdropFilter: 'blur(8px)',
                    padding: 12,
                    titleColor: '#fff',
                    bodyColor: '#cbd5e1',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    cornerRadius: 12,
                    displayColors: true,
                    usePointStyle: true
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: colors.gridColor
                    },
                    ticks: {
                        color: colors.textColor,
                        precision: 0
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: colors.textColor
                    }
                }
            }
        }
    });
}

/**
 * Role Distribution Doughnut Chart
 */
function renderRoleDistributionChart() {
    const canvas = document.getElementById('role-dist-chart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const colors = getChartColors();

    // Destroy existing chart
    if (roleDistChart) {
        roleDistChart.destroy();
    }

    // Calculate role distribution
    const students = allUsers.filter(u => u.role === 'student').length;
    const alumni = allUsers.filter(u => u.role === 'alumni').length;
    const delegates = allUsers.filter(u => u.role === 'delegate').length;
    const admins = allUsers.filter(u => u.role === 'admin').length;

    roleDistChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Étudiants', 'Lauréats', 'Délégués', 'Admins'],
            datasets: [{
                data: [students, alumni, delegates, admins],
                backgroundColor: [
                    colors.primary,
                    colors.secondary,
                    colors.warning,
                    colors.danger
                ],
                borderWidth: 2,
                borderColor: document.documentElement.getAttribute('data-theme') === 'dark' ? '#0f172a' : '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: colors.textColor,
                        padding: 15,
                        usePointStyle: true
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    callbacks: {
                        label: function (context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                            return `${label}: ${value} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

/**
 * Requests Status Bar Chart
 */
function renderRequestsChart() {
    const canvas = document.getElementById('requests-chart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const colors = getChartColors();

    // Destroy existing chart
    if (requestsChart) {
        requestsChart.destroy();
    }

    // Calculate request statuses
    const pending = allRequests.filter(r => r.status === 'pending').length;
    const approved = allRequests.filter(r => r.status === 'approved').length;
    const rejected = allRequests.filter(r => r.status === 'rejected').length;

    requestsChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['En attente', 'Approuvées', 'Rejetées'],
            datasets: [{
                label: 'Demandes',
                data: [pending, approved, rejected],
                backgroundColor: [
                    `${colors.warning}80`,
                    `${colors.secondary}80`,
                    `${colors.danger}80`
                ],
                borderColor: [
                    colors.warning,
                    colors.secondary,
                    colors.danger
                ],
                borderWidth: 2,
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: colors.gridColor
                    },
                    ticks: {
                        color: colors.textColor,
                        precision: 0
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: colors.textColor
                    }
                }
            }
        }
    });
}

/**
 * Update all charts with new data
 */
function updateAllCharts() {
    if (!chartsInitialized) return;

    renderUserStatsChart();
    renderRoleDistributionChart();
    renderRequestsChart();
}

/**
 * Destroy all charts (for cleanup)
 */
function destroyAllCharts() {
    if (userStatsChart) userStatsChart.destroy();
    if (roleDistChart) roleDistChart.destroy();
    if (requestsChart) requestsChart.destroy();

    chartsInitialized = false;
}

// Listen for theme changes to update chart colors
document.addEventListener('DOMContentLoaded', () => {
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
                updateAllCharts();
            }
        });
    });

    observer.observe(document.documentElement, {
        attributes: true
    });
});
