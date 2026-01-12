/**
 * IBN SINA - UI Core
 * Fonctions partagées pour l'interface (Sidebar, Thème, etc.)
 */

document.addEventListener('DOMContentLoaded', () => {
    initSidebar();
});

/**
 * Initialise la barre latérale (Sidebar)
 */
function initSidebar() {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;

    // Créer le bouton de bascule s'il n'existe pas encore
    if (!sidebar.querySelector('.sidebar-toggle-btn')) {
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'sidebar-toggle-btn';
        toggleBtn.id = 'sidebar-toggle';
        toggleBtn.innerHTML = '‹';
        toggleBtn.title = 'Réduire/Agrandir la barre latérale';
        toggleBtn.addEventListener('click', toggleSidebar);
        sidebar.appendChild(toggleBtn);
    }

    // Restaurer l'état au chargement
    const isCollapsed = localStorage.getItem('sidebar_collapsed') === 'true';
    if (isCollapsed) {
        sidebar.classList.add('collapsed');
        const btn = document.getElementById('sidebar-toggle');
        if (btn) btn.innerHTML = '›';
    }
}

/**
 * Bascule l'état de la sidebar
 */
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;

    const isCollapsed = sidebar.classList.toggle('collapsed');
    localStorage.setItem('sidebar_collapsed', isCollapsed);

    const btn = document.getElementById('sidebar-toggle');
    if (btn) {
        btn.innerHTML = isCollapsed ? '›' : '‹';
    }

    // Déclencher un événement de redimensionnement pour que les graphiques se mettent à jour si besoin
    window.dispatchEvent(new Event('resize'));
}

/**
 * Thème (Standardisation) - Si besoin de migrer le toggleTheme ici plus tard
 */
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
}

// -----------------------------------------------------------------------------
// NOTIFICATIONS SYSTEM
// -----------------------------------------------------------------------------

// Legacy code removed. Notifications are now handled in js/notifications.js via a dedicated Tab.
// We keep this block just in case other initializations are needed later.

// Expose to window (if needed)
// window.toggleNotifications = toggleNotifications; // Deprecated
