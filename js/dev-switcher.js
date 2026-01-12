/**
 * IBN SINA - Dev View Switcher
 * Permet de basculer entre les vues sans compte Firebase (Mode Développement)
 */

(function () {
    // Ne s'affiche que si on est sur localhost (ou si on veut forcer l'affichage)
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    // Si vous voulez forcer l'affichage même en ligne pour démo, mettez à true
    const forceShow = true;

    if (!isLocalhost && !forceShow) return;

    // Créer le conteneur du switcher
    const switcher = document.createElement('div');
    switcher.id = 'dev-view-switcher';
    switcher.innerHTML = `
        <div class="dev-switcher-button" id="dev-btn">
            <span>🛠️</span>
            <span class="dev-text">Mode Dev</span>
        </div>
        <div class="dev-switcher-menu hidden" id="dev-menu">
            <div class="dev-menu-header">🛠️ Sélecteur de Vue</div>
            <div class="dev-menu-item" data-role="admin">👑 Administrateur</div>
            <div class="dev-menu-item" data-role="mentor">🧘 Mentor (Lauréat +)</div>
            <div class="dev-menu-item" data-role="alumni">👨‍🎓 Lauréat (Alumni)</div>
            <div class="dev-menu-item" data-role="delegate">👤 Délégué</div>
            <div class="dev-menu-item" data-role="student">🎓 Étudiant</div>
            <div class="dev-menu-divider"></div>
            <div class="dev-menu-item dev-disable" id="dev-disable">❌ Désactiver Mode Dev</div>
        </div>
    `;

    // Ajouter les styles directement
    const style = document.createElement('style');
    style.textContent = `
        #dev-view-switcher {
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 999999;
            font-family: 'Outfit', sans-serif;
        }
        .dev-switcher-button {
            background: #1a1a2e;
            color: white;
            padding: 12px 18px;
            border-radius: 50px;
            cursor: pointer;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            gap: 10px;
            transition: all 0.3s ease;
            border: 2px solid #e94560;
        }
        .dev-switcher-button:hover {
            transform: scale(1.05);
            background: #e94560;
        }
        .dev-text {
            font-weight: 600;
            font-size: 0.9rem;
        }
        .dev-switcher-menu {
            position: absolute;
            bottom: 60px;
            right: 0;
            background: white;
            border-radius: 12px;
            width: 220px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.2);
            overflow: hidden;
            transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            transform-origin: bottom right;
        }
        .dev-switcher-menu.hidden {
            opacity: 0;
            transform: scale(0.8) translateY(20px);
            pointer-events: none;
        }
        .dev-menu-header {
            background: #f8f9fa;
            padding: 12px 15px;
            font-weight: 700;
            color: #1a1a2e;
            font-size: 0.85rem;
            border-bottom: 1px solid #eee;
        }
        .dev-menu-item {
            padding: 12px 15px;
            cursor: pointer;
            font-size: 0.9rem;
            color: #444;
            transition: all 0.2s;
            display: flex;
            align-items: center;
        }
        .dev-menu-item:hover {
            background: #f0f7ff;
            color: #e94560;
            padding-left: 20px;
        }
        .dev-menu-divider {
            height: 1px;
            background: #eee;
        }
        .dev-disable {
            color: #dc3545;
            font-weight: 600;
        }
        .dev-disable:hover {
            background: #fff5f5;
        }
    `;

    document.head.appendChild(style);
    document.body.appendChild(switcher);

    // Éléments
    const btn = document.getElementById('dev-btn');
    const menu = document.getElementById('dev-menu');
    const disableBtn = document.getElementById('dev-disable');

    // Toggle menu
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.classList.toggle('hidden');
    });

    // Fermer le menu si on clique ailleurs
    document.addEventListener('click', () => {
        menu.classList.add('hidden');
    });

    // Gérer la sélection de rôle
    document.querySelectorAll('.dev-menu-item[data-role]').forEach(item => {
        item.addEventListener('click', function () {
            const role = this.getAttribute('data-role');

            // Activer le mode dev
            localStorage.setItem('dev_mode_enabled', 'true');
            localStorage.setItem('dev_mode_role', role);

            // Rediriger
            let target = 'index.html';
            if (role === 'admin') target = 'admin-dashboard.html';
            if (role === 'student') target = 'student-dashboard.html';
            if (role === 'alumni' || role === 'mentor') target = 'alumni-dashboard.html';
            if (role === 'delegate') target = 'delegate-dashboard.html';

            window.location.href = target;
        });
    });

    // Désactiver le mode dev
    disableBtn.addEventListener('click', () => {
        localStorage.removeItem('dev_mode_enabled');
        localStorage.removeItem('dev_mode_role');
        window.location.href = 'index.html';
    });
})();
