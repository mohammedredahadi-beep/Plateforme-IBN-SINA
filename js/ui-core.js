/**
 * UI Core Functionalities - Refactored
 * Centralise la gestion de l'interface, des vues et des notifications.
 */

class UICore {
    constructor() {
        this.activeClass = 'active';
        this.hiddenClass = 'hidden';
        this.sidebarId = 'admin-sidebar';
        this.initSidebar();
    }

    /**
     * Initialise la barre latérale et les gestionnaires d'événements
     */
    initSidebar() {
        // 1. Gestion des liens actifs
        const links = document.querySelectorAll('.sidebar-link');
        links.forEach(link => {
            link.addEventListener('click', (e) => {
                // Remove active class from all links
                links.forEach(l => l.classList.remove(this.activeClass));
                // Add to clicked link
                e.currentTarget.classList.add(this.activeClass);

                // Sur mobile, fermer la sidebar après clic
                if (window.innerWidth <= 768) {
                    const sidebar = document.getElementById(this.sidebarId);
                    if (sidebar) sidebar.classList.remove('open');
                }
            });
        });
    }

    /**
     * Affiche une vue spécifique et masque les autres
     * @param {string} viewId - L'ID de la vue à afficher (sans le suffixe -view)
     * @param {Array<string>} allViews - Liste de tous les IDs de vues possibles
     * @param {Function} [callback] - Fonction optionnelle à exécuter après le changement
     */
    showView(viewId, allViews, callback) {
        // 1. Masquer toutes les vues
        allViews.forEach(v => {
            const el = document.getElementById(`${v}-view`);
            if (el) el.classList.add(this.hiddenClass);
        });

        // 2. Afficher la vue demandée
        const targetView = document.getElementById(`${viewId}-view`);
        if (targetView) {
            targetView.classList.remove(this.hiddenClass);
        } else {
            console.warn(`Vue non trouvée: ${viewId}-view`);
        }

        // 3. Mettre à jour le header (Titre et Sous-titre)
        this.updateHeader(viewId);

        // 4. Mettre à jour l'état actif du menu
        this.updateActiveMenu(viewId);

        // 5. Exécuter le callback spécifique à la vue
        if (typeof callback === 'function') {
            callback();
        }
    }

    /**
     * Met à jour le titre et le sous-titre du header en fonction de la vue
     * @param {string} viewId 
     */
    updateHeader(viewId) {
        const headerTitle = document.getElementById('header-title');
        const headerSubtitle = document.getElementById('header-subtitle');

        if (!headerTitle) return;

        // Configuration par défaut des titres (peut être surchargé ou étendu)
        const titles = {
            'dashboard': { title: 'Tableau de Bord', subtitle: 'Gérer la plateforme Ibn Sina' },
            'filieres': { title: 'Filières', subtitle: 'Gérer les départements et délégués' },
            'users': { title: 'Utilisateurs', subtitle: 'Gérer les comptes étudiants et lauréats' },
            'requests': { title: 'Demandes', subtitle: 'Accès aux groupes WhatsApp' },
            'events': { title: 'Événements', subtitle: 'Publier des actualités' },
            'logs': { title: 'Logs Système', subtitle: 'Historique des actions' },
            'diagnostics': { title: 'Diagnostic Système', subtitle: 'Détection d\'anomalies et Maintenance IA' },
            'marketing': { title: 'Communication', subtitle: 'Envoyer des messages aux utilisateurs' },
            'notifications': { title: 'Notifications', subtitle: 'Gérer les notifications push' },
            'validations': { title: 'Validations', subtitle: 'Valider les nouveaux inscrits' },
            'alumni': { title: 'Lauréats', subtitle: 'Gestion des anciens élèves' },
            'support': { title: 'Support', subtitle: 'Alertes et messages de support' },
            'backup': { title: 'Sauvegarde', subtitle: 'Sauvegarde et restauration des données' }
        };

        const config = titles[viewId] || { title: 'Administration', subtitle: '' };

        headerTitle.textContent = config.title;
        if (headerSubtitle) headerSubtitle.textContent = config.subtitle;
    }

    /**
     * Met à jour la classe active dans la sidebar
     * @param {string} viewId 
     */
    updateActiveMenu(viewId) {
        document.querySelectorAll('.sidebar-link').forEach(btn => {
            if (btn.dataset.view === viewId) {
                btn.classList.add(this.activeClass);
            } else {
                btn.classList.remove(this.activeClass);
            }
        });
    }

    /**
     * Affiche une notification toast (Succès)
     * @param {string} elementId - ID de l'élément toast container
     * @param {string} message - Message à afficher
     */
    showSuccess(elementId, message) {
        this._showToast(elementId, message, 'success');
    }

    /**
     * Affiche une notification toast (Erreur)
     * @param {string} elementId - ID de l'élément toast container
     * @param {string} message - Message à afficher
     */
    showError(elementId, message) {
        this._showToast(elementId, message, 'danger');
    }

    /**
     * Méthode interne pour afficher les toasts
     */
    _showToast(elementId, message, type) {
        const el = document.getElementById(elementId);
        if (!el) return;

        const bgColor = type === 'success' ? 'var(--success)' : 'var(--danger)';
        const icon = type === 'success' ? '✅' : '❌';

        el.innerHTML = `<div style="background: ${bgColor}; color: white; padding: 10px; border-radius: 8px;">${icon} ${message}</div>`;
        el.classList.remove(this.hiddenClass);
        el.style.display = 'block';

        setTimeout(() => {
            el.classList.add(this.hiddenClass);
            el.style.display = 'none';
        }, 3000);
    }
}

// Instance globale accessible
const ui = new UICore();

// Compatibilité rétroactive pour les fonctions globales existantes (si appelées hors de admin.js)
window.showSuccess = (id, msg) => ui.showSuccess(id, msg);
window.showError = (id, msg) => ui.showError(id, msg);

