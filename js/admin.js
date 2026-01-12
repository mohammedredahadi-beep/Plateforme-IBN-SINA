// Fonctionnalités pour le tableau de bord administrateur

let currentUser = null;
let allFilieres = [];
let allUsers = [];
let allRequests = [];
const logsRef = db.collection('logs');

// --- DEBUG HELPER ---
function visibleLog(msg, type = 'info') {
    const debugEl = document.getElementById('debug-console');
    if (debugEl) {
        const color = type === 'error' ? 'red' : 'lime';
        debugEl.innerHTML += `<div style="color: ${color}; border-bottom: 1px solid #333;">${new Date().toLocaleTimeString()} - ${msg}</div>`;
        debugEl.scrollTop = debugEl.scrollHeight;
    }
    console.log(`[VISIBLE] ${msg}`);
}
// --------------------

/**
 * PHASE 16: JOURNAL DES ACTIONS ET MODÉRATION
 */

// Enregistrer une action administrative
async function logAction(actionType, targetId, details = {}) {
    try {
        await logsRef.add({
            adminId: auth.currentUser.uid,
            adminName: currentUser.fullName,
            actionType: actionType, // 'PROMOTE', 'SUSPEND', 'ADD_FILIERE', etc.
            targetId: targetId,
            details: details,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        console.error('Erreur lors de l\'enregistrement du log:', error);
    }
}

// Suspendre un utilisateur
async function suspendUser(userId) {
    if (!confirm('Voulez-vous vraiment suspendre cet utilisateur ? Il ne pourra plus accéder à la plateforme.')) return;

    try {
        await usersRef.doc(userId).update({
            isSuspended: true,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        await logAction('SUSPEND_USER', userId);
        showSuccess('admin-message', 'Utilisateur suspendu avec succès.');
        await loadAllUsers();
        displayUsers();
    } catch (error) {
        console.error('Erreur suspension:', error);
        showError('admin-message', 'Erreur lors de la suspension.');
    }
}

// Réactiver un utilisateur
async function unsuspendUser(userId) {
    try {
        await usersRef.doc(userId).update({
            isSuspended: false,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        await logAction('UNSUSPEND_USER', userId);
        showSuccess('admin-message', 'Compte utilisateur réactivé.');
        await loadAllUsers();
        displayUsers();
    } catch (error) {
        console.error('Erreur réactivation:', error);
        showError('admin-message', 'Erreur lors de la réactivation.');
    }
}

// Charger les logs
async function loadLogs() {
    const container = document.getElementById('logs-list');
    if (!container) return;
    container.innerHTML = '<div class="text-center"><p>Chargement du journal...</p></div>';

    try {
        const snapshot = await logsRef.limit(100).get();

        if (snapshot.empty) {
            container.innerHTML = '<div class="card text-center"><p>Aucune action enregistrée.</p></div>';
            return;
        }

        let logs = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            logs.push({ id: doc.id, ...data });
        });

        // Tri côté client par date
        logs.sort((a, b) => {
            const timeA = a.timestamp ? (a.timestamp.toMillis ? a.timestamp.toMillis() : new Date(a.timestamp).getTime()) : 0;
            const timeB = b.timestamp ? (b.timestamp.toMillis ? b.timestamp.toMillis() : new Date(b.timestamp).getTime()) : 0;
            return timeB - timeA;
        });

        let html = '<div class="table-container"><table class="table">';
        html += '<thead><tr><th>Admin</th><th>Action</th><th>Cible</th><th>Détails</th><th>Date</th></tr></thead><tbody>';

        logs.forEach(log => {
            let dateStr = '-';
            if (log.timestamp) {
                try {
                    const d = log.timestamp.toDate ? log.timestamp.toDate() : new Date(log.timestamp);
                    dateStr = d.toLocaleString('fr-FR');
                } catch (e) {
                    dateStr = 'Date invalide';
                }
            }

            let actionBadge = `<span class="badge" style="background: #e9ecef; color: #495057;">${log.actionType || 'INCONNUE'}</span>`;
            if (log.actionType && log.actionType.includes('SUSPEND')) actionBadge = `<span class="badge badge-rejected">${log.actionType}</span>`;
            if (log.actionType && (log.actionType.includes('PROMOTE') || log.actionType.includes('ADD') || log.actionType.includes('APPROVE'))) actionBadge = `<span class="badge badge-approved">${log.actionType}</span>`;

            html += `
                <tr>
                    <td><strong>${log.adminName || 'Admin'}</strong></td>
                    <td>${actionBadge}</td>
                    <td style="font-family: monospace; font-size: 0.8rem;">${log.targetId || '-'}</td>
                    <td><small>${JSON.stringify(log.details || {})}</small></td>
                    <td>${dateStr}</td>
                </tr>
            `;
        });

        html += '</tbody></table></div>';
        container.innerHTML = html;

    } catch (error) {
        console.error('Erreur logs:', error);
        container.innerHTML = `
            <div class="card text-center">
                <p class="text-error">Erreur de chargement des logs: ${error.message}</p>
                <button class="btn btn-secondary mt-2" onclick="loadLogs()">Réessayer</button>
            </div>`;
    }
}

// Ouvrir le modal d'édition
function openEditUserModal(userId) {
    const user = allUsers.find(u => u.uid === userId);
    if (!user) return;

    document.getElementById('edit-user-id').value = user.uid;
    document.getElementById('edit-user-name').value = user.fullName || '';
    document.getElementById('edit-user-email').value = user.email || '';
    document.getElementById('edit-user-phone').value = user.phone || '';
    document.getElementById('edit-user-role').value = user.role || 'student';
    document.getElementById('edit-user-niveau').value = user.niveau || 'TC';
    document.getElementById('edit-user-linkedin').value = user.linkedin || '';
    document.getElementById('edit-user-bio').value = user.bio || user.parcours || '';

    // Status Checkboxes
    document.getElementById('edit-user-approved').checked = user.isApproved === true;
    document.getElementById('edit-user-suspended').checked = user.isSuspended === true;
    document.getElementById('edit-user-mentor').checked = user.mentorStatus === 'approved';

    // Show/Hide Fields based on Role/Niveau
    const promoGroup = document.getElementById('edit-promo-group');
    const bgGroup = document.getElementById('edit-user-mentor').parentElement; // Label parent
    const promoInput = document.getElementById('edit-user-promo');

    // Logic: Mentor logic applies if Role is Alumni OR Niveau is Lauréat
    const isAlumni = (user.role === 'alumni' || user.niveau === 'Lauréat');

    if (isAlumni) {
        promoGroup.classList.remove('hidden');
        promoInput.value = user.promo || '';
        if (bgGroup) bgGroup.classList.remove('hidden'); // Show Mentor checkbox
    } else {
        promoGroup.classList.add('hidden');
        promoInput.value = '';
        if (bgGroup) bgGroup.classList.add('hidden'); // Hide Mentor checkbox
    }

    document.getElementById('edit-user-modal').classList.remove('hidden');
}

// Fermer le modal d'édition
function closeEditUserModal() {
    document.getElementById('edit-user-modal').classList.add('hidden');
}

// Basculer le champ promo dans le modal
function toggleEditPromoField(val) {
    // This is triggered by onchange of the Niveau dropdown
    // We might need to update this logic to check Role as well if they are separate
    const promoGroup = document.getElementById('edit-promo-group');
    const mentorCheckbox = document.getElementById('edit-user-mentor').parentElement;

    if (val === 'Lauréat') {
        promoGroup.classList.remove('hidden');
        if (mentorCheckbox) mentorCheckbox.classList.remove('hidden');
    } else {
        promoGroup.classList.add('hidden');
        if (mentorCheckbox) mentorCheckbox.classList.add('hidden');
    }
}

// Enregistrer les modifications de l'utilisateur
async function updateUser(e) {
    e.preventDefault();

    const userId = document.getElementById('edit-user-id').value;
    const fullName = document.getElementById('edit-user-name').value;
    const phone = document.getElementById('edit-user-phone').value;
    const role = document.getElementById('edit-user-role').value;
    const niveau = document.getElementById('edit-user-niveau').value;
    const promo = document.getElementById('edit-user-promo').value;
    const linkedin = document.getElementById('edit-user-linkedin').value;
    const bio = document.getElementById('edit-user-bio').value;

    const isApproved = document.getElementById('edit-user-approved').checked;
    const isSuspended = document.getElementById('edit-user-suspended').checked;
    const isMentor = document.getElementById('edit-user-mentor').checked;

    try {
        const updateData = {
            fullName: fullName,
            phone: phone,
            role: role,
            niveau: niveau,
            linkedin: linkedin,
            bio: bio,
            isApproved: isApproved,
            isSuspended: isSuspended,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (niveau === 'Lauréat') {
            updateData.promo = promo;
            // Update Mentor Status based on checkbox
            updateData.mentorStatus = isMentor ? 'approved' : 'none';
        } else {
            // Remove mentor status if not Alumni
            updateData.mentorStatus = firebase.firestore.FieldValue.delete();
        }

        await usersRef.doc(userId).update(updateData);

        await logAction('UPDATE_USER_PROFILE', userId, {
            name: fullName,
            role: role,
            niveau: niveau,
            isMentor: isMentor,
            status: isSuspended ? 'Suspended' : 'Active'
        });

        showSuccess('admin-message', 'Profil utilisateur mis à jour avec succès.');
        closeEditUserModal();
        await loadAllUsers();
        displayUsers();
    } catch (error) {
        console.error('Erreur mise à jour utilisateur:', error);
        showError('admin-message', 'Erreur lors de la mise à jour du profil.');
    }
}

// Track selected users for individual targeting
let selectedIndividualUsers = [];

// Search users for individual selection
async function searchUsers(query) {
    const resultsContainer = document.getElementById('user-search-results');

    if (!query || query.length < 2) {
        resultsContainer.classList.add('hidden');
        return;
    }

    const searchLower = query.toLowerCase();
    const filtered = allUsers.filter(u =>
        u.fullName.toLowerCase().includes(searchLower) ||
        u.email.toLowerCase().includes(searchLower)
    ).filter(u => !selectedIndividualUsers.find(s => s.uid === u.uid)).slice(0, 10);

    if (filtered.length === 0) {
        resultsContainer.innerHTML = '<div style="padding: 10px; text-align: center; color: var(--text-secondary);">Aucun utilisateur trouvé</div>';
        resultsContainer.classList.remove('hidden');
        return;
    }

    let html = '';
    filtered.forEach(user => {
        html += `
            <div onclick="selectUser('${user.uid}')" 
                style="padding: 10px; cursor: pointer; border-bottom: 1px solid var(--border-color); transition: 0.2s;"
                onmouseover="this.style.background='var(--bg-secondary)'" 
                onmouseout="this.style.background='transparent'">
                <strong>${user.fullName}</strong>
                <div style="font-size: 0.85rem; color: var(--text-secondary);">${user.email} • ${user.role}</div>
            </div>
        `;
    });
    resultsContainer.innerHTML = html;
    resultsContainer.classList.remove('hidden');
}

// Select user for individual targeting
function selectUser(userId) {
    const user = allUsers.find(u => u.uid === userId);
    if (!user || selectedIndividualUsers.find(s => s.uid === userId)) return;

    selectedIndividualUsers.push(user);
    renderSelectedUsers();

    // Clear search
    document.getElementById('user-search').value = '';
    document.getElementById('user-search-results').classList.add('hidden');
}

// Remove selected user
function removeSelectedUser(userId) {
    selectedIndividualUsers = selectedIndividualUsers.filter(u => u.uid !== userId);
    renderSelectedUsers();
}

// Render selected users as chips
function renderSelectedUsers() {
    const container = document.getElementById('selected-users');
    if (selectedIndividualUsers.length === 0) {
        container.innerHTML = '<small style="color: var(--text-secondary);">Aucun utilisateur sélectionné</small>';
        return;
    }

    let html = '';
    selectedIndividualUsers.forEach(user => {
        html += `
            <span class="badge" style="background: var(--primary-color); color: white; padding: 5px 10px; border-radius: 20px; display: flex; align-items: center; gap: 5px;">
                ${user.fullName}
                <button type="button" onclick="removeSelectedUser('${user.uid}')" 
                    style="background: none; border: none; color: white; cursor: pointer; font-size: 1.2rem; line-height: 1;">&times;</button>
            </span>
        `;
    });
    container.innerHTML = html;
}

// Envoyer un message marketing/annonce (Enhanced)
async function sendMarketingMessage(e) {
    e.preventDefault();

    const priority = document.getElementById('msg-priority').value;
    const target = document.getElementById('msg-target').value;
    const title = document.getElementById('msg-title').value;
    const content = document.getElementById('msg-content').value;

    if (!title || !content) {
        showError('admin-message', 'Veuillez remplir tous les champs requis.');
        return;
    }

    if (!target && selectedIndividualUsers.length === 0) {
        showError('admin-message', 'Veuillez sélectionner au moins un groupe ou un utilisateur.');
        return;
    }

    try {
        const messageData = {
            title: title,
            content: content,
            priority: priority, // urgent, communicative, warning
            target: target || 'custom',
            senderId: auth.currentUser.uid,
            senderName: currentUser.fullName,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            readBy: [],
            // Additional targeting
            individualUserIds: selectedIndividualUsers.map(u => u.uid)
        };

        // Save to Firestore (Platform Notification)
        await db.collection('messages').add(messageData);

        await logAction('SEND_MESSAGE', target || 'custom', {
            title: title,
            individualRecipients: selectedIndividualUsers.length,
            priority: priority
        });

        showSuccess('admin-message', `Message envoyé avec succès ! (Priorité: ${priority})`);
        document.getElementById('marketing-form').reset();
        selectedIndividualUsers = [];
        renderSelectedUsers();
        // Reset priority to default
        document.getElementById('msg-priority').value = 'communicative';
    } catch (error) {
        console.error('Erreur envoi message:', error);
        showError('admin-message', 'Erreur lors de l\'envoi du message: ' + error.message);
    }
}

// Initialiser le tableau de bord administrateur
async function initAdminDashboard() {
    currentUser = await checkAuthAndRedirect();

    const allowedRoles = ['admin'];
    if (!currentUser || !allowedRoles.includes(currentUser.role)) {
        window.location.href = 'index.html';
        return;
    }


    // Afficher les informations de l'utilisateur
    displayUserInfo();
    visibleLog("Admin Init: Starting...");

    // Charger toutes les données dans l'ordre (Dépendances d'abord)
    // On utilise des try-catch individuels pour qu'une erreur ne bloque pas tout le dashboard
    try {
        visibleLog("Fetching Users...");
        await loadAllUsers(); // Nécessaire pour afficher les noms des délégués dans les filières
        visibleLog(`Users loaded: ${allUsers.length}`);
        if (allUsers.length > 0) visibleLog(`First User: ${JSON.stringify(allUsers[0]).substring(0, 50)}...`);
    } catch (e) {
        console.error("Admin Init: Error loading users", e);
        visibleLog(`Error loading users: ${e.message}`, 'error');
    }

    try {
        visibleLog("Fetching Filieres...");
        await loadAllFilieres();
        visibleLog(`Filieres loaded: ${allFilieres.length}`);
        if (allFilieres.length > 0) visibleLog(`First Filiere: ${allFilieres[0].id}`);
    } catch (e) {
        console.error("Admin Init: Error loading filieres", e);
        visibleLog(`Error loading filieres: ${e.message}`, 'error');
    }

    // Initialiser l'écouteur des demandes
    try {
        visibleLog("Starting Requests Listener...");
        loadAllRequests(); // C'est non-bloquant car c'est un listener, mais on le garde safe
    } catch (e) {
        console.error("Admin Init: Error starting requests listener", e);
        visibleLog(`Error requesting listener: ${e.message}`, 'error');
    }

    // Afficher les stats initiales
    try {
        displayStats();
    } catch (e) {
        console.error("Admin Init: Error displaying stats", e);
        visibleLog(`Error displaying stats: ${e.message}`, 'error');
    }

    // Initialiser les notifications
    if (typeof initNotificationSystem === 'function') {
        initNotificationSystem();
    }

    // Initialiser les graphiques du dashboard
    if (typeof initDashboardCharts === 'function') {
        // Wait a bit for data to load before initializing charts
        setTimeout(() => {
            try {
                initDashboardCharts();
                visibleLog("Dashboard charts initialized");
            } catch (e) {
                console.error("Error initializing charts:", e);
                visibleLog(`Error initializing charts: ${e.message}`, 'error');
            }
        }, 1000);
    }

    // Afficher la vue par défaut
    showAdminView('dashboard');

    // Gestion de la fermeture des dropdowns
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.action-dropdown')) {
            document.querySelectorAll('.dropdown-menu.active').forEach(m => m.classList.remove('active'));
        }
    });
}

// Afficher les informations de l'utilisateur
function displayUserInfo() {
    const el = document.getElementById('sidebar-user-name');
    if (el && currentUser) el.textContent = currentUser.fullName;
}

// Charger toutes les filières
async function loadAllFilieres() {
    try {
        const snapshot = await filieresRef.get();
        allFilieres = [];
        snapshot.forEach(doc => {
            allFilieres.push({ id: doc.id, ...doc.data() });
        });

        // Tri client-side pour éviter les erreurs d'index manquant
        allFilieres.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

        displayFilieres();
        displayStats(); // Update KPIs
    } catch (error) {
        console.error('Erreur lors du chargement des filières:', error);
        document.getElementById('filieres-list').innerHTML = `
            <div class="card text-center">
                <p class="text-error">Erreur de chargement: ${error.message}</p>
                <button class="btn btn-secondary mt-2" onclick="loadAllFilieres()">Réessayer</button>
            </div>`;
    }
}

// Afficher les filières
async function displayFilieres() {
    const container = document.getElementById('filieres-list');

    if (allFilieres.length === 0) {
        container.innerHTML = `
            <div class="card text-center">
                <p style="color: var(--text-secondary);">Aucune filière créée</p>
                <button class="btn btn-primary mt-2" onclick="showAddFiliereForm()">Créer une filière</button>
            </div>
        `;
        return;
    }

    let html = '<div class="grid grid-2">';

    for (const filiere of allFilieres) {
        let delegateName = 'Non assigné';
        if (filiere.delegateId) {
            const delegateUser = allUsers.find(u => u.uid === filiere.delegateId);
            if (delegateUser) {
                delegateName = delegateUser.fullName;
            }
        }

        const dropdownActions = [
            { label: 'Modifier', icon: '✏️', onclick: `editFiliere('${filiere.id}')` },
            { label: 'Supprimer', icon: '🗑️', class: 'danger', onclick: `deleteFiliere('${filiere.id}')` }
        ];

        html += `
            <div class="card">
                <div class="flex" style="justify-content: space-between; align-items: start;">
                    <h3 style="font-size: 1.2rem; font-weight: 600; margin-bottom: var(--spacing-sm);">${filiere.name}</h3>
                    ${renderActionDropdown(dropdownActions)}
                </div>
                <div class="badge" style="background: var(--primary-color); color: white; margin-bottom: 10px; display: inline-block;">${filiere.niveau || 'Tous'}</div>
                <p style="color: var(--text-secondary); margin-bottom: var(--spacing-sm);">
                    👤 Délégué: <strong>${delegateName}</strong>
                </p>
                ${filiere.description ? `<p style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: var(--spacing-sm);">${filiere.description}</p>` : ''}
            </div>
        `;
    }

    html += '</div>';
    container.innerHTML = html;
}

// Charger tous les utilisateurs
async function loadAllUsers() {
    try {
        const snapshot = await usersRef.get();
        allUsers = [];
        snapshot.forEach(doc => {
            allUsers.push(doc.data());
        });
    } catch (error) {
        console.error('Erreur lors du chargement des utilisateurs:', error);
        document.getElementById('users-list').innerHTML = `
            <div class="card text-center">
                <p class="text-error">Erreur de chargement utilisateurs: ${error.message}</p>
                <button class="btn btn-secondary mt-2" onclick="loadAllUsers()">Réessayer</button>
            </div>`;
    }
    displayStats(); // Update KPIs regardless of error (might be partial or empty)
}

// Charger toutes les demandes
async function loadAllRequests() {
    try {
        // On retire orderBy pour éviter les blocages d'index si la collection est nouvelle
        requestsRef.onSnapshot(snapshot => {
            allRequests = [];
            snapshot.forEach(doc => {
                allRequests.push({ id: doc.id, ...doc.data() });
            });

            // Tri client-side
            allRequests.sort((a, b) => {
                const timeA = a.createdAt ? (a.createdAt.toMillis ? a.createdAt.toMillis() : 0) : 0;
                const timeB = b.createdAt ? (b.createdAt.toMillis ? b.createdAt.toMillis() : 0) : 0;
                return timeB - timeA;
            });

            displayStats();
        }, error => {
            console.error("Erreur écouteur demandes:", error);
            const container = document.getElementById('requests-all-list');
            if (container) {
                container.innerHTML = `
                    <div class="card text-center">
                        <p class="text-error">Erreur chargement demandes: ${error.message}</p>
                    </div>`;
            }
        });
    } catch (error) {
        console.error('Erreur lors du chargement des demandes:', error);
    }
}

// Afficher les statistiques
function displayStats() {
    // 1. Mise à jour des cartes KPI (Haut de page)
    if (document.getElementById('stat-users')) document.getElementById('stat-users').textContent = allUsers.length;
    if (document.getElementById('stat-filieres')) document.getElementById('stat-filieres').textContent = allFilieres.length;
    if (document.getElementById('stat-requests')) document.getElementById('stat-requests').textContent = allRequests.length;

    const pendingCount = allRequests.filter(r => r.status === 'pending').length;
    if (document.getElementById('stat-pending')) {
        document.getElementById('stat-pending').textContent = pendingCount;
    }

    // 2. Mise à jour des stats dans la Vue Demandes (stat-pending-view)
    const approvedCount = allRequests.filter(r => r.status === 'approved').length;

    if (document.getElementById('stat-pending-view')) {
        document.getElementById('stat-pending-view').textContent = pendingCount;
    }
    if (document.getElementById('stat-approved-view')) {
        document.getElementById('stat-approved-view').textContent = approvedCount;
    }

    // 3. Mise à jour des badges de la Sidebar
    const sidebarRequestsBadge = document.getElementById('sidebar-badge-requests');
    if (sidebarRequestsBadge) {
        sidebarRequestsBadge.textContent = pendingCount;
        if (pendingCount > 0) sidebarRequestsBadge.classList.remove('hidden');
        else sidebarRequestsBadge.classList.add('hidden');
    }

    // Calcul des lauréats en attente pour le badge "Lauréats"
    const pendingAlumniCount = allUsers.filter(u => u.role === 'alumni' && !u.isApproved).length;
    const sidebarAlumniBadge = document.getElementById('sidebar-badge-alumni');
    if (sidebarAlumniBadge) {
        sidebarAlumniBadge.textContent = pendingAlumniCount;
        if (pendingAlumniCount > 0) sidebarAlumniBadge.classList.remove('hidden');
        else sidebarAlumniBadge.classList.add('hidden');
    }

    // 4. Mise à jour des graphiques si disponibles
    if (typeof updateAllCharts === 'function' && chartsInitialized) {
        try {
            updateAllCharts();
        } catch (e) {
            console.error("Error updating charts:", e);
        }
    }
}

// Helper pour les dropdowns d'actions
function toggleActionMenu(btn, e) {
    if (e) e.stopPropagation();
    const menu = btn.nextElementSibling;
    const isActive = menu.classList.contains('active');

    // Fermer tous les menus ouverts
    document.querySelectorAll('.dropdown-menu.active').forEach(m => m.classList.remove('active'));

    if (!isActive) {
        menu.classList.add('active');
    }
}

function renderActionDropdown(items) {
    if (items.length === 0) return '-';

    return `
        <div class="action-dropdown">
            <button class="dropdown-toggle" onclick="toggleActionMenu(this, event)">⋮</button>
            <div class="dropdown-menu">
                ${items.map(item => `
                    <button class="dropdown-item ${item.class || ''}" onclick="${item.onclick}">
                        ${item.icon || ''} ${item.label}
                    </button>
                `).join('')}
            </div>
        </div>
    `;
}

// Gérer l'affichage du menu d'actions
function toggleActionMenu(button, event) {
    event.stopPropagation();
    const menu = button.nextElementSibling;
    const isVisible = menu.classList.contains('show');

    // Fermer tous les autres menus
    document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('show'));

    if (!isVisible) {
        menu.classList.add('show');
    }
}

// Fermer les menus lors d'un clic ailleurs
document.addEventListener('click', () => {
    document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('show'));
});

// Basculer entre les vues
// Basculer entre les vues
function showAdminView(viewId) {
    // Liste explicite de toutes les vues pour garantir qu'elles sont cachées
    const views = [
        'dashboard', 'filieres', 'users', 'events', 'requests',
        'alumni', 'logs', 'support', 'backup', 'marketing', 'diagnostics', 'notifications'
    ];

    // Masquer toutes les vues
    views.forEach(v => {
        const el = document.getElementById(`${v}-view`);
        if (el) el.classList.add('hidden');
    });

    // Afficher la vue demandée
    const targetView = document.getElementById(`${viewId}-view`);
    if (targetView) {
        targetView.classList.remove('hidden');
    }

    // Gestion du Header Title
    const headerTitle = document.getElementById('header-title');
    const headerSubtitle = document.getElementById('header-subtitle');

    if (headerTitle) {
        if (viewId === 'dashboard') {
            headerTitle.textContent = 'Tableau de Bord';
            if (headerSubtitle) headerSubtitle.textContent = 'Gérer la plateforme Ibn Sina';
        } else if (viewId === 'filieres') {
            headerTitle.textContent = 'Filières';
            if (headerSubtitle) headerSubtitle.textContent = 'Gérer les départements et délégués';
        } else if (viewId === 'users') {
            headerTitle.textContent = 'Utilisateurs';
            if (headerSubtitle) headerSubtitle.textContent = 'Gérer les comptes étudiants et lauréats';
        } else if (viewId === 'requests') {
            headerTitle.textContent = 'Demandes';
            if (headerSubtitle) headerSubtitle.textContent = 'Accès aux groupes WhatsApp';
        } else if (viewId === 'events') {
            headerTitle.textContent = 'Événements';
            if (headerSubtitle) headerSubtitle.textContent = 'Publier des actualités';
        } else if (viewId === 'logs') {
            headerTitle.textContent = 'Logs Système';
            if (headerSubtitle) headerSubtitle.textContent = 'Historique des actions';
        } else if (viewId === 'diagnostics') {
            headerTitle.textContent = 'Diagnostic Système';
            if (headerSubtitle) headerSubtitle.textContent = 'Détection d\'anomalies et Maintenance IA';
        } else if (viewId === 'marketing') {
            headerTitle.textContent = 'Communication';
            if (headerSubtitle) headerSubtitle.textContent = 'Envoyer des messages aux utilisateurs';
        } else if (viewId === 'notifications') {
            headerTitle.textContent = 'Notifications';
            if (headerSubtitle) headerSubtitle.textContent = 'Gérer les notifications push';
        }
    }

    // Mettre à jour l'état actif des boutons de la sidebar
    document.querySelectorAll('.sidebar-link').forEach(btn => {
        // Check if the button's data-view matches the viewId
        if (btn.dataset.view === viewId) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    if (viewId === 'users') displayUsers();
    if (viewId === 'requests') displayAllRequests();
    if (viewId === 'alumni') displayPendingAlumni();
    if (viewId === 'logs') loadLogs();
    if (viewId === 'support') loadSupportAlerts();
    if (viewId === 'events') loadAdminEvents();
    if (viewId === 'events') loadAdminEvents();
    if (viewId === 'notifications' && typeof initAdminNotificationsView === 'function') initAdminNotificationsView();
}

// Ajouter un événement
async function addEvent(e) {
    e.preventDefault();
    const title = document.getElementById('event-title').value;
    const dateInput = document.getElementById('event-date').value;
    const type = document.getElementById('event-type').value;
    const link = document.getElementById('event-link').value;
    const description = document.getElementById('event-desc').value;

    try {
        await db.collection('events').add({
            title,
            date: firebase.firestore.Timestamp.fromDate(new Date(dateInput)),
            type,
            link: link || null,
            description,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showSuccess('admin-message', 'Événement publié avec succès !');
        document.getElementById('event-form').reset();
        loadAdminEvents();
    } catch (error) {
        console.error('Erreur création événement:', error);
        showError('admin-message', 'Erreur lors de la publication.');
    }
}

// Charger les événements (Admin)
async function loadAdminEvents() {
    const container = document.getElementById('admin-events-list');
    try {
        const snapshot = await db.collection('events').get();
        if (snapshot.empty) {
            container.innerHTML = '<p class="text-center" style="color: var(--text-secondary);">Aucun événement créé.</p>';
            return;
        }

        let events = [];
        snapshot.forEach(doc => {
            events.push({ id: doc.id, ...doc.data() });
        });

        // Tri client-side
        events.sort((a, b) => {
            const timeA = a.date ? (a.date.toMillis ? a.date.toMillis() : 0) : 0;
            const timeB = b.date ? (b.date.toMillis ? b.date.toMillis() : 0) : 0;
            return timeB - timeA;
        });

        let html = '<div class="table-container"><table class="table">';
        html += '<thead><tr><th>Titre</th><th>Date</th><th>Type</th><th>Actions</th></tr></thead><tbody>';

        events.forEach(ev => {
            const date = ev.date ? new Date(ev.date.toDate()).toLocaleString('fr-FR') : 'N/A';
            const dropdownActions = [
                { label: 'Supprimer', icon: '🗑️', class: 'danger', onclick: `deleteEvent('${ev.id}')` }
            ];

            html += `
                <tr>
                    <td><strong>${ev.title}</strong></td>
                    <td>${date}</td>
                    <td><span class="badge">${ev.type}</span></td>
                    <td>${renderActionDropdown(dropdownActions)}</td>
                </tr>
            `;
        });
        html += '</tbody></table></div>';
        container.innerHTML = html;
    } catch (error) {
        console.error('Erreur chargement événements admin:', error);
        container.innerHTML = `
            <div class="card text-center">
                <p class="text-error">Erreur de chargement: ${error.message}</p>
                <button class="btn btn-secondary mt-2" onclick="loadAdminEvents()">Réessayer</button>
            </div>`;
    }
}

// Supprimer un événement
async function deleteEvent(id) {
    if (!confirm('Supprimer cet événement ?')) return;
    try {
        await db.collection('events').doc(id).delete();
        loadAdminEvents();
    } catch (error) {
        alert('Erreur suppression.');
    }
}

// Charger les alertes support
async function loadSupportAlerts() {
    const container = document.getElementById('support-list');
    if (!container) return;
    container.innerHTML = '<div class="text-center"><p>Chargement des alertes...</p></div>';

    try {
        // Retrait de l'orderBy pour éviter l'erreur d'index Firestore
        const snapshot = await db.collection('support_alerts').get();

        if (snapshot.empty) {
            container.innerHTML = '<div class="card text-center"><p style="color: var(--text-secondary);">Aucune alerte support.</p></div>';
            return;
        }

        let alerts = [];
        snapshot.forEach(doc => {
            alerts.push({ id: doc.id, ...doc.data() });
        });

        // Tri côté client par timestamp descendant
        alerts.sort((a, b) => {
            const timeA = a.timestamp ? (a.timestamp.toMillis ? a.timestamp.toMillis() : new Date(a.timestamp).getTime()) : 0;
            const timeB = b.timestamp ? (b.timestamp.toMillis ? b.timestamp.toMillis() : new Date(b.timestamp).getTime()) : 0;
            return timeB - timeA;
        });

        let html = '';

        alerts.forEach(alert => {
            let dateStr = 'N/A';
            if (alert.timestamp) {
                try {
                    const d = alert.timestamp.toDate ? alert.timestamp.toDate() : new Date(alert.timestamp);
                    dateStr = d.toLocaleString('fr-FR');
                } catch (e) {
                    dateStr = 'Date invalide';
                }
            }

            const dropdownActions = [];
            // MENTOR_REQUEST logic moved to Requests Tab

            dropdownActions.push({ label: 'Marquer Résolu', icon: '✓', onclick: `resolveAlert('${alert.id}')` });
            dropdownActions.push({ label: 'Supprimer', icon: '🗑️', class: 'danger', onclick: `deleteAlert('${alert.id}')` });

            html += `
                <div class="card fade-in" style="border-left: 4px solid var(--danger-color); margin-bottom: 15px;">
                    <div class="flex" style="justify-content: space-between; align-items: start;">
                        <div>
                            <div class="flex" style="gap: 8px; align-items: center; margin-bottom: 8px;">
                                <span class="badge badge-rejected">${alert.type || 'SUPPORT'}</span>
                                <small style="color: var(--text-secondary);">${dateStr}</small>
                            </div>
                            <h4 style="font-weight: 600; margin-bottom: 5px;">${alert.userName || 'Utilisateur inconnu'}</h4>
                            <p style="font-size: 0.9rem; color: var(--text-main); background: var(--bg-tertiary); padding: 10px; border-radius: 6px; margin-top: 5px;">
                                ${alert.message}
                            </p>
                        </div>
                        ${renderActionDropdown(dropdownActions)}
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    } catch (error) {
        console.error('Erreur logs support:', error);
        container.innerHTML = `
            <div class="card text-center">
                <p class="text-error">Erreur logs support: ${error.message}</p>
                <button class="btn btn-secondary mt-2" onclick="loadSupportAlerts()">Réessayer</button>
            </div>`;
    }
}

// Résoudre une alerte
async function resolveAlert(id) {
    try {
        await db.collection('support_alerts').doc(id).update({
            status: 'resolved',
            resolvedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        loadSupportAlerts();
    } catch (error) {
        alert('Erreur lors de la résolution.');
    }
}

// Supprimer une alerte
async function deleteAlert(id) {
    if (!confirm('Supprimer cette alerte ?')) return;
    try {
        await db.collection('support_alerts').doc(id).delete();
        loadSupportAlerts();
    } catch (error) {
        alert('Erreur lors de la suppression.');
    }
}

// ------------------------------------------------------------------
// GESTION AVANCÉE DES NOTIFICATIONS & CONFIGURATION (Admin Override)
// ------------------------------------------------------------------

async function initAdminNotificationsView() {
    const container = document.getElementById('notifications-view');
    if (!container) return;

    // 1. Get Current Config
    let currentDuration = 24;
    try {
        const configDoc = await db.collection('system').doc('config').get();
        if (configDoc.exists && configDoc.data().messageDuration) {
            currentDuration = configDoc.data().messageDuration;
        }
    } catch (e) {
        console.warn("Config load error", e);
    }

    // 2. Build Admin Interface
    container.innerHTML = `
        <div class="grid grid-2" style="margin-bottom: 20px;">
            <!-- Configuration Card -->
            <div class="card">
                <h3 style="margin-bottom: 15px;">⚙️ Configuration Système</h3>
                <div class="form-group">
                    <label class="form-label">Durée de vie des messages lus (heures)</label>
                    <div class="flex gap-1">
                        <input type="number" id="config-duration" class="form-input" value="${currentDuration}" min="1" max="720">
                        <button class="btn btn-primary" onclick="saveMessageConfig()">Enregistrer</button>
                    </div>
                </div>
            </div>

            <!-- Global Actions Card -->
            <div class="card">
                <h3 style="margin-bottom: 15px;">🗑️ Nettoyage</h3>
                <p style="margin-bottom: 15px; font-size: 0.9rem;">Supprimer définitivement tous les messages du système.</p>
                <button class="btn btn-danger" style="background: var(--danger); color: white;" onclick="deleteAllMessages()">
                    ⚠️ Supprimer TOUS les messages
                </button>
            </div>
        </div>

        <!-- Messages List -->
        <div class="card">
            <h3 style="margin-bottom: 15px;">📨 Tous les messages système</h3>
            <div id="admin-messages-list">
                <div class="text-center"><div class="loading"></div></div>
            </div>
        </div>
    `;

    loadAdminMessagesList();
}

async function saveMessageConfig() {
    const duration = document.getElementById('config-duration').value;

    if (!duration || duration < 1) {
        alert("Veuillez entrer une durée valide.");
        return;
    }

    try {
        await db.collection('system').doc('config').set({
            messageDuration: Number(duration),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: auth.currentUser.uid
        }, { merge: true });

        // Update local global config if strictly needed immediately, but reload does it
        if (window.SYSTEM_CONFIG) window.SYSTEM_CONFIG.messageDuration = Number(duration);

        alert("Configuration enregistrée avec succès !");
    } catch (e) {
        console.error("Save config error:", e);
        alert("Erreur lors de l'enregistrement.");
    }
}

async function deleteAllMessages() {
    if (!confirm("ATTENTION: Vous êtes sur le point de supprimer TOUS les messages de la plateforme. Cette action est irréversible. Continuer ?")) {
        return;
    }

    const btn = document.querySelector('button[onclick="deleteAllMessages()"]');
    const originalText = btn.textContent;
    btn.textContent = "Suppression en cours...";
    btn.disabled = true;

    try {
        const snapshot = await db.collection('messages').get();
        const batchSize = 400;
        let batch = db.batch();
        let count = 0;
        let totalDeleted = 0;

        for (const doc of snapshot.docs) {
            batch.delete(doc.ref);
            count++;
            if (count >= batchSize) {
                await batch.commit();
                batch = db.batch();
                totalDeleted += count;
                count = 0;
            }
        }
        if (count > 0) {
            await batch.commit();
            totalDeleted += count;
        }

        alert(`${totalDeleted} messages supprimés.`);
        loadAdminMessagesList();
    } catch (e) {
        console.error("Delete all error:", e);
        alert("Erreur lors de la suppression massive.");
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

async function loadAdminMessagesList() {
    const container = document.getElementById('admin-messages-list');

    try {
        const snapshot = await db.collection('messages').orderBy('createdAt', 'desc').limit(50).get();

        if (snapshot.empty) {
            container.innerHTML = '<p class="text-center text-secondary">Aucun message dans le système.</p>';
            return;
        }

        let html = '<div class="table-container"><table class="table">';
        html += '<thead><tr><th>Titre</th><th>Envoyé par</th><th>Vues</th><th>Date</th><th>Actions</th></tr></thead><tbody>';

        snapshot.forEach(doc => {
            const data = doc.data();
            const date = data.createdAt ? new Date(data.createdAt.toDate()).toLocaleDateString() : '-';
            const readCount = data.readBy ? data.readBy.length : 0;

            html += `
                <tr>
                    <td><strong>${data.title}</strong><br><small class="text-secondary">${data.content.substring(0, 30)}...</small></td>
                    <td>${data.senderName || '?'}</td>
                    <td>${readCount}</td>
                    <td>${date}</td>
                    <td>
                        <button class="btn btn-secondary btn-small" onclick="deleteMessage('${doc.id}')" style="color: var(--danger); padding: 5px 10px;">🗑️</button>
                    </td>
                </tr>
            `;
        });
        html += '</tbody></table></div>';
        container.innerHTML = html;

    } catch (e) {
        container.innerHTML = `<p class="text-error">Erreur chargement: ${e.message}</p>`;
    }
}

async function deleteMessage(id) {
    if (!confirm("Supprimer ce message ?")) return;
    try {
        await db.collection('messages').doc(id).delete();
        loadAdminMessagesList(); // Reload list
    } catch (e) {
        alert("Erreur suppression: " + e.message);
    }
}

// Override initNotificationsView for Admin context (called by showAdminView)
// But wait, showAdminView calls initNotificationsView. We should rename this or change the call in showAdminView.
// Since we can't easily jump to showAdminView in this Tool call without replacing the whole file,
// we will export initAdminNotificationsView and I will do a second pass to update showAdminView logic if needed
// OR I can overwrite `initNotificationsView` specifically for the admin scope if this file loads AFTER notifications.js?
// Safer: I will update the `showAdminView` function in the file to call `initAdminNotificationsView` appropriately.

window.initAdminNotificationsView = initAdminNotificationsView;
window.saveMessageConfig = saveMessageConfig;
window.deleteAllMessages = deleteAllMessages;
window.deleteMessage = deleteMessage;


// Afficher tous les utilisateurs
// Afficher tous les utilisateurs avec recherche
function displayUsers() {
    const container = document.getElementById('users-list');
    const searchTerm = document.getElementById('user-search') ? document.getElementById('user-search').value.toLowerCase().trim() : '';

    // Filtrer les utilisateurs selon la recherche
    const filteredUsers = allUsers.filter(user => {
        const matchesName = user.fullName && user.fullName.toLowerCase().includes(searchTerm);
        const matchesEmail = user.email && user.email.toLowerCase().includes(searchTerm);
        const matchesNiveau = user.niveau && user.niveau.toLowerCase().includes(searchTerm);
        const matchesPromo = user.promo && user.promo.toString().includes(searchTerm);

        return matchesName || matchesEmail || matchesNiveau || matchesPromo;
    });

    if (filteredUsers.length === 0) {
        container.innerHTML = '<div class="card text-center"><p style="color: var(--text-secondary);">Aucun utilisateur trouvé.</p></div>';
        return;
    }

    let html = '<div class="table-container"><table class="table">';
    html += '<thead><tr><th>Nom</th><th>Email</th><th>Classe / Promo</th><th>Rôle</th><th>Actions</th></tr></thead><tbody>';

    // Trier par rôle (délégués d'abord) puis par nom
    filteredUsers.sort((a, b) => {
        if (a.role === 'delegate' && b.role !== 'delegate') return -1;
        if (a.role !== 'delegate' && b.role === 'delegate') return 1;
        return a.fullName.localeCompare(b.fullName);
    });

    filteredUsers.forEach(user => {
        const roleBadge = user.role === 'delegate'
            ? '<span class="badge badge-approved">Délégué</span>'
            : user.role === 'admin'
                ? '<span class="badge badge-rejected">Admin</span>'
                : '<span class="badge badge-pending">Étudiant</span>';

        const displayNiveau = user.niveau === 'Lauréat'
            ? `🎓 Lauréat (${user.promo || '?'})`
            : user.niveau || 'N/A';

        // Add Mentor Badge if applicable
        const mentorBadge = (user.niveau === 'Lauréat' && user.mentorStatus === 'approved')
            ? '<span class="badge" style="background:gold; color:black; margin-left:5px;">🏅 Mentor</span>'
            : '';

        const dropdownActions = [
            { label: 'Modifier Infos', icon: '📝', onclick: `openEditUserModal('${user.uid}')` }
        ];

        if (user.role === 'student') {
            dropdownActions.push({ label: 'Promouvoir Délégué', icon: '🛡️', onclick: `promoteToDelegate('${user.uid}')` });
        }

        if (user.niveau === 'Lauréat' && !user.isApproved) {
            dropdownActions.push({ label: 'Valider Lauréat', icon: '✅', onclick: `approveAlumni('${user.uid}')` });
        }

        if (user.uid !== auth.currentUser.uid) {
            if (user.isSuspended) {
                dropdownActions.push({ label: 'Réactiver', icon: '🔓', onclick: `unsuspendUser('${user.uid}')` });
            } else {
                dropdownActions.push({ label: 'Suspendre', icon: '🚫', class: 'danger', onclick: `suspendUser('${user.uid}')` });
            }
        }

        html += `
            <tr class="fade-in">
                <td><strong>${user.fullName}</strong></td>
                <td style="font-size: 0.85rem;">${user.email}</td>
                <td><span class="badge" style="background: rgba(0,0,0,0.05); color: var(--text-main);">${displayNiveau}</span>${mentorBadge}</td>
                <td>${roleBadge}</td>
                <td>${renderActionDropdown(dropdownActions)}</td>
            </tr>
        `;
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;
}

// Afficher toutes les demandes
async function displayAllRequests() {
    const container = document.getElementById('requests-all-list');

    if (allRequests.length === 0) {
        container.innerHTML = '<div class="card text-center"><p style="color: var(--text-secondary);">Aucune demande</p></div>';
        return;
    }

    let html = '<div class="table-container"><table class="table">';
    html += '<thead><tr><th>Utilisateur</th><th>Type / Filière</th><th>Statut</th><th>Date</th><th>Actions</th></tr></thead><tbody>';

    for (const request of allRequests) {
        let reqType = 'Étudiant';
        let filiereName = 'N/A';

        if (request.type === 'MENTOR_REQUEST') {
            reqType = '<span class="badge" style="background: var(--accent-color); color: white;">MENTORAT</span>';
            filiereName = 'Demande Mentor';
        } else {
            const filiere = allFilieres.find(f => f.id === request.filiereId);
            if (filiere) filiereName = filiere.name;
        }

        const statusBadge =
            request.status === 'pending' ? '<span class="badge badge-pending">En attente</span>' :
                request.status === 'approved' ? '<span class="badge badge-approved">Approuvée</span>' :
                    '<span class="badge badge-rejected">Rejetée</span>';

        const date = request.createdAt ? new Date(request.createdAt.toDate()).toLocaleDateString('fr-FR') : 'N/A';

        const dropdownActions = [];
        if (request.status === 'pending') {
            if (request.type === 'MENTOR_REQUEST') {
                dropdownActions.push({ label: 'Valider Mentor', icon: '🎓', onclick: `approveMentorFromRequest('${request.id}', '${request.userId}')` });
                dropdownActions.push({ label: 'Rejeter', icon: '✗', class: 'danger', onclick: `adminRejectRequest('${request.id}')` });
            } else {
                dropdownActions.push({ label: 'Approuver', icon: '✓', onclick: `adminApproveRequest('${request.id}')` });
                dropdownActions.push({ label: 'Rejeter', icon: '✗', class: 'danger', onclick: `adminRejectRequest('${request.id}')` });
            }
        }

        html += `
            <tr>
                <td><strong>${request.userName}</strong></td>
                <td>
                    ${request.type === 'MENTOR_REQUEST' ? reqType : filiereName}
                </td>
                <td>${statusBadge}</td>
                <td>${date}</td>
                <td>${renderActionDropdown(dropdownActions)}</td>
            </tr>
        `;
    }

    html += '</tbody></table></div>';
    container.innerHTML = html;
}

// Promouvoir un utilisateur en délégué
async function promoteToDelegate(userId) {
    if (!confirm('Voulez-vous vraiment promouvoir cet utilisateur en délégué ?')) return;

    try {
        await usersRef.doc(userId).update({
            role: 'delegate',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        await logAction('PROMOTE_TO_DELEGATE', userId);
        showSuccess('admin-message', 'Utilisateur promu en délégué avec succès !');
        await loadAllUsers();
        displayUsers();
    } catch (error) {
        console.error('Erreur lors de la promotion:', error);
        showError('admin-message', 'Erreur lors de la promotion de l\'utilisateur.');
    }
}

// Ajouter une filière
async function addFiliere(e) {
    e.preventDefault();

    const name = document.getElementById('filiere-name').value;
    const niveau = document.getElementById('filiere-niveau').value;
    const description = document.getElementById('filiere-description').value;
    const delegateId = document.getElementById('filiere-delegate').value;
    const whatsappLink = document.getElementById('filiere-whatsapp').value;

    try {
        const docRef = await filieresRef.add({
            name: name,
            niveau: niveau,
            description: description,
            delegateId: delegateId || null,
            whatsappLink: whatsappLink || null,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        await logAction('ADD_FILIERE', docRef.id, { name: name, niveau: niveau });
        showSuccess('admin-message', 'Filière créée avec succès !');
        document.getElementById('filiere-form').reset();
        await loadAllFilieres();
    } catch (error) {
        console.error('Erreur lors de la création:', error);
        showError('admin-message', 'Erreur lors de la création de la filière.');
    }
}

// Modifier une filière
async function editFiliere(filiereId) {
    const filiere = allFilieres.find(f => f.id === filiereId);
    if (!filiere) return;

    const newName = prompt('Nouveau nom de la filière:', filiere.name);
    if (!newName) return;

    try {
        await filieresRef.doc(filiereId).update({
            name: newName,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        await logAction('EDIT_FILIERE', filiereId, { oldName: filiere.name, newName: newName });
        showSuccess('admin-message', 'Filière modifiée avec succès !');
        await loadAllFilieres();
    } catch (error) {
        console.error('Erreur lors de la modification:', error);
        showError('admin-message', 'Erreur lors de la modification de la filière.');
    }
}

// Supprimer une filière
async function deleteFiliere(filiereId) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette filière ?')) return;

    try {
        await filieresRef.doc(filiereId).delete();
        await logAction('DELETE_FILIERE', filiereId);
        showSuccess('admin-message', 'Filière supprimée avec succès !');
        await loadAllFilieres();
    } catch (error) {
        console.error('Erreur lors de la suppression:', error);
        showError('admin-message', 'Erreur lors de la suppression de la filière.');
    }
}

/**
 * PHASE 11: GESTION DES LAURÉATS
 */

// Afficher les lauréats en attente
async function displayPendingAlumni() {
    const container = document.getElementById('alumni-pending-list');
    if (!container) return;

    try {
        // Utilisation d'un seul filtre pour éviter l'erreur d'index composite
        const snapshot = await usersRef.where('niveau', '==', 'Lauréat').get();

        if (snapshot.empty) {
            container.innerHTML = '<div class="card text-center"><p style="color: var(--text-secondary);">Aucun lauréat trouvé.</p></div>';
            return;
        }

        let pending = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.isApproved === false) {
                pending.push({ id: doc.id, ...data });
            }
        });

        if (pending.length === 0) {
            container.innerHTML = '<div class="card text-center"><p style="color: var(--text-secondary);">Aucun lauréat en attente d\'approbation.</p></div>';
            return;
        }

        let html = '<div class="grid grid-2">';
        pending.forEach(user => {
            const dropdownActions = [
                { label: 'Approuver Compte', icon: '✅', onclick: `approveAlumni('${user.id}')` }
            ];

            html += `
                <div class="card fade-in" style="border-left: 4px solid var(--accent-color);">
                    <div class="flex" style="justify-content: space-between; align-items: start;">
                        <div>
                            <h4 style="font-weight: 600;">🎓 ${user.fullName}</h4>
                            <p style="font-size: 0.85rem; color: var(--text-secondary);">
                                <strong>Promo ${user.promo || 'N/A'}</strong>
                            </p>
                            <p style="font-size: 0.75rem; color: var(--text-secondary);">${user.email}</p>
                        </div>
                        ${renderActionDropdown(dropdownActions)}
                    </div>
                </div>
            `;
        });
        html += '</div>';
        container.innerHTML = html;

    } catch (error) {
        container.innerHTML = `<div class="card text-center"><p class="text-error">Erreur de chargement : ${error.message}</p></div>`;
    }
}

// Approuver un lauréat
async function approveAlumni(userId) {
    try {
        await usersRef.doc(userId).update({
            isApproved: true,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        await logAction('APPROVE_ALUMNI', userId);
        alert('Compte Lauréat approuvé ! Il peut désormais se connecter.');
        displayPendingAlumni();
    } catch (error) {
        console.error('Erreur lors de l\'approbation:', error);
        alert('Erreur lors de l\'approbation.');
    }
}

// Approuver un Mentor
async function approveMentor(userId, alertId = null) {
    if (!confirm('Voulez-vous approuver ce lauréat en tant que Mentor officiel ?')) return;

    try {
        await usersRef.doc(userId).update({
            mentorStatus: 'approved',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        await logAction('APPROVE_MENTOR', userId);

        // Si on vient d'une alerte, on la résout
        if (alertId) {
            await db.collection('support_alerts').doc(alertId).update({
                status: 'resolved',
                resolvedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            loadSupportAlerts();
        }

        showSuccess('admin-message', 'Mentor approuvé avec succès !');
        await loadAllUsers();
        displayUsers();
    } catch (error) {
        console.error('Erreur approbation mentor:', error);
        showError('admin-message', 'Erreur lors de l\'approbation du mentor.');
    }
}

/**
 * OVERRIDE ADMIN : VALIDATION DES DEMANDES ÉTUDIANTS
 */

// Approuver une demande étudiant (Override Admin)
async function adminApproveRequest(requestId) {
    if (!confirm('Voulez-vous vraiment approuver cette demande au nom du délégué ?')) return;

    try {
        await requestsRef.doc(requestId).update({
            status: 'approved',
            processedBy: auth.currentUser.uid, // Marqué comme traité par l'admin
            processedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        await logAction('ADMIN_APPROVE_REQUEST', requestId, { student: requestId });
        showSuccess('admin-message', 'Demande approuvée par l\'administrateur !');
        loadAllRequests(); // Recharger les données
    } catch (error) {
        console.error('Erreur Admin Approbation:', error);
        showError('admin-message', 'Erreur lors de l\'approbation Admin.');
    }
}

// Rejeter une demande étudiant (Override Admin)
async function adminRejectRequest(requestId) {
    const reason = prompt('Raison du rejet par l\'administrateur :');
    if (reason === null) return;

    try {
        await requestsRef.doc(requestId).update({
            status: 'rejected',
            delegateComment: `[ADMIN] ${reason || 'Refusé par l\'administrateur.'}`,
            processedBy: auth.currentUser.uid,
            processedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        await logAction('ADMIN_REJECT_REQUEST', requestId, { reason: reason });
        showSuccess('admin-message', 'Demande rejetée par l\'administrateur.');
        loadAllRequests();
    } catch (error) {
        console.error('Erreur Admin Rejet:', error);
        showError('admin-message', 'Erreur lors du rejet Admin.');
    }
}

// Approuver un Mentor depuis l'onglet Demandes
async function approveMentorFromRequest(requestId, userId) {
    if (!confirm('Voulez-vous approuver ce lauréat en tant que Mentor officiel et clore la demande ?')) return;

    try {
        // 1. Mettre à jour l'utilisateur
        await usersRef.doc(userId).update({
            mentorStatus: 'approved',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // 2. Mettre à jour la demande comme "approved"
        await requestsRef.doc(requestId).update({
            status: 'approved',
            processedBy: auth.currentUser.uid,
            processedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        await logAction('APPROVE_MENTOR_REQUEST', requestId, { userId: userId });

        showSuccess('admin-message', 'Mentor approuvé et demande clôturée avec succès !');
        loadAllRequests(); // Recharger la liste
    } catch (error) {
        console.error('Erreur approbation mentor (Request):', error);
        showError('admin-message', 'Erreur lors de l\'approbation.');
    }
}

/**
 * PHASE 12: BACKUP & RESTORE
 */

// Exporter les données (Backup)
async function exportData() {
    const btnText = document.getElementById('export-text');
    const loading = document.getElementById('export-loading');

    btnText.classList.add('hidden');
    loading.classList.remove('hidden');

    try {
        const collections = ['users', 'filieres', 'events', 'requests', 'logs', 'support_alerts'];
        const backupData = {
            timestamp: new Date().toISOString(),
            version: '1.0',
            data: {}
        };

        for (const colName of collections) {
            const snapshot = await db.collection(colName).get();
            backupData.data[colName] = {};
            snapshot.forEach(doc => {
                // Convertir les Timestamps Firestore en ISO strings pour le JSON
                const data = doc.data();
                for (const key in data) {
                    if (data[key] && typeof data[key].toDate === 'function') {
                        data[key] = data[key].toDate().toISOString();
                    }
                }
                backupData.data[colName][doc.id] = data;
            });
        }

        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "ibn_sina_backup_" + new Date().toISOString().slice(0, 10) + ".json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();

        showSuccess('admin-message', 'Sauvegarde téléchargée avec succès !');

    } catch (error) {
        console.error('Erreur export:', error);
        showError('admin-message', 'Erreur lors de l\'exportation: ' + error.message);
    } finally {
        if (btnText) btnText.classList.remove('hidden');
        if (loading) loading.classList.add('hidden');
    }
}

// Importer les données (Restore)
async function importData() {
    const fileInput = document.getElementById('import-file');
    const file = fileInput.files[0];

    if (!file) {
        alert('Veuillez sélectionner un fichier JSON de sauvegarde.');
        return;
    }

    if (!confirm('ATTENTION : Cette action va restaurer les données et écraser les éléments existants avec les mêmes IDs. Êtes-vous sûr de vouloir continuer ?')) {
        return;
    }

    const btnText = document.getElementById('import-text');
    const loading = document.getElementById('import-loading');
    const statusDiv = document.getElementById('import-status');

    btnText.classList.add('hidden');
    loading.classList.remove('hidden');
    statusDiv.textContent = "Lecture du fichier...";
    statusDiv.classList.remove('hidden');
    statusDiv.className = ""; // Reset classes

    const reader = new FileReader();

    reader.onload = async function (e) {
        try {
            const backup = JSON.parse(e.target.result);
            if (!backup.data) throw new Error("Format de fichier invalide.");

            const collections = Object.keys(backup.data);
            let totalDocs = 0;
            let processedDocs = 0;

            // Compter le total
            collections.forEach(col => {
                totalDocs += Object.keys(backup.data[col]).length;
            });

            // Batch writes (limite 500 opérations par batch)
            const BATCH_SIZE = 400;
            let batch = db.batch();
            let opCount = 0;
            let batchCount = 0;

            for (const colName of collections) {
                const docs = backup.data[colName];
                for (const docId in docs) {
                    const docData = docs[docId];
                    const docRef = db.collection(colName).doc(docId);

                    // Conversion basique des dates ISO strings
                    ['createdAt', 'updatedAt', 'date', 'timestamp', 'processedAt', 'mentorRequestDate', 'resolvedAt'].forEach(field => {
                        if (docData[field] && typeof docData[field] === 'string' && docData[field].match(/^\d{4}-\d{2}-\d{2}T/)) {
                            docData[field] = firebase.firestore.Timestamp.fromDate(new Date(docData[field]));
                        }
                    });

                    batch.set(docRef, docData, { merge: true });
                    opCount++;
                    processedDocs++;

                    if (opCount >= BATCH_SIZE) {
                        await batch.commit();
                        batch = db.batch();
                        opCount = 0;
                        batchCount++;
                        statusDiv.textContent = `Progression : ${processedDocs} / ${totalDocs} documents traités...`;
                    }
                }
            }

            if (opCount > 0) {
                await batch.commit();
            }

            statusDiv.textContent = `Terminé ! ${processedDocs} documents restaurés.`;
            statusDiv.className = "text-success";
            showSuccess('admin-message', "Restauration terminée avec succès.");

            // Recharger les données de l'interface
            if (typeof initAdminDashboard === 'function') await initAdminDashboard();

        } catch (error) {
            console.error('Erreur import:', error);
            statusDiv.textContent = "Erreur : " + error.message;
            statusDiv.className = "text-error";
            showError('admin-message', 'Erreur critique lors de l\'importation.');
        } finally {
            if (btnText) btnText.classList.remove('hidden');
            if (loading) loading.classList.add('hidden');
        }
    };

    reader.readAsText(file);
}
