// Fonctionnalités pour le tableau de bord administrateur

let currentUser = null;
let allFilieres = [];
let allUsers = [];
let allDelegateRequests = [];
let allMentorRequests = [];
const logsRef = db.collection('logs');

// --- SIDEBAR TOGGLE ---
function toggleSidebar() {
    document.querySelector('.admin-sidebar').classList.toggle('open');
}

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

    document.getElementById('edit-user-approved').checked = user.isApproved === true;
    document.getElementById('edit-user-suspended').checked = user.isSuspended === true;

    const promoGroup = document.getElementById('edit-promo-group');
    const promoInput = document.getElementById('edit-user-promo');

    if (user.niveau === 'Lauréat') {
        promoGroup.classList.remove('hidden');
        promoInput.value = user.promo || '';
    } else {
        promoGroup.classList.add('hidden');
        promoInput.value = '';
    }

    document.getElementById('edit-user-modal').classList.remove('hidden');
}

// Fermer le modal d'édition
function closeEditUserModal() {
    document.getElementById('edit-user-modal').classList.add('hidden');
}

// Basculer le champ promo dans le modal
function toggleEditPromoField(val) {
    const promoGroup = document.getElementById('edit-promo-group');
    if (val === 'Lauréat') {
        promoGroup.classList.remove('hidden');
    } else {
        promoGroup.classList.add('hidden');
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
        }

        await usersRef.doc(userId).update(updateData);

        await logAction('UPDATE_USER_PROFILE', userId, {
            name: fullName,
            role: role,
            niveau: niveau,
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

// Envoyer un message marketing/annonce
async function sendMarketingMessage(e) {
    e.preventDefault();
    const target = document.getElementById('msg-target').value;
    const title = document.getElementById('msg-title').value;
    const content = document.getElementById('msg-content').value;

    if (!title || !content) return;

    try {
        const messageData = {
            title: title,
            content: content,
            target: target,
            senderId: auth.currentUser.uid,
            senderName: currentUser.fullName,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            readBy: []
        };

        // On enregistre dans une collection principale 'messages'
        await db.collection('messages').add(messageData);

        await logAction('SEND_MESSAGE', target, { title: title });
        showSuccess('admin-message', 'Message envoyé avec succès !');
        document.getElementById('marketing-form').reset();
    } catch (error) {
        console.error('Erreur envoi message:', error);
        showError('admin-message', 'Erreur lors de l\'envoi du message.');
    }
}

// Initialiser le tableau de bord administrateur
async function initAdminDashboard() {
    currentUser = await checkAuthAndRedirect();

    if (!currentUser || currentUser.role !== 'admin') {
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

    // Initialiser l'écouteur des demandes (Délégué + Mentorat)
    try {
        visibleLog("Starting Requests Listener...");
        loadAllRequests();
        loadMentorRequests();
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

    // Afficher la vue par défaut (Home)
    showAdminView('home');

    // Charger le planning d'accueil
    loadHomePlanning();

    // Gestion de la fermeture des dropdowns
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.action-dropdown')) {
            document.querySelectorAll('.dropdown-menu.active').forEach(m => m.classList.remove('active'));
        }
    });
}

// Afficher les informations de l'utilisateur
function displayUserInfo() {
    document.getElementById('user-name').textContent = currentUser.fullName;
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

// Charger les demandes de rôle Délégué
async function loadAllRequests() {
    try {
        requestsRef.onSnapshot(snapshot => {
            allDelegateRequests = [];
            snapshot.forEach(doc => {
                allDelegateRequests.push({ id: doc.id, type: 'DELEGATE_REQUEST', ...doc.data() });
            });
            renderCombinedRequests();
        }, error => {
            console.error("Erreur écouteur demandes délégué:", error);
        });
    } catch (error) {
        console.error('Erreur loading delegate requests:', error);
    }
}

// Charger les demandes de Mentorat
async function loadMentorRequests() {
    try {
        db.collection('support_alerts').where('type', '==', 'MENTOR_REQUEST')
            .onSnapshot(snapshot => {
                allMentorRequests = [];
                snapshot.forEach(doc => {
                    allMentorRequests.push({ id: doc.id, ...doc.data() });
                });
                renderCombinedRequests();
            }, error => {
                console.error("Erreur écouteur demandes mentor:", error);
            });
    } catch (error) {
        console.error('Erreur loading mentor requests:', error);
    }
}

function renderCombinedRequests() {
    const container = document.getElementById('requests-all-list');
    if (!container) return;

    // Combiner
    const combined = [...allDelegateRequests, ...allMentorRequests];

    // Trier
    combined.sort((a, b) => {
        const timeA = a.createdAt ? (a.createdAt.toMillis ? a.createdAt.toMillis() : 0) : (a.timestamp ? (a.timestamp.toMillis ? a.timestamp.toMillis() : 0) : 0);
        const timeB = b.createdAt ? (b.createdAt.toMillis ? b.createdAt.toMillis() : 0) : (b.timestamp ? (b.timestamp.toMillis ? b.timestamp.toMillis() : 0) : 0);
        return timeB - timeA;
    });

    displayStats(); // Update counters

    if (combined.length === 0) {
        container.innerHTML = '<div class="card text-center"><p>Aucune demande en attente.</p></div>';
        return;
    }

    let html = '';
    combined.forEach(req => {
        const isMentorRef = req.type === 'MENTOR_REQUEST';
        const dateObj = req.createdAt || req.timestamp;
        const dateStr = dateObj ? (dateObj.toDate ? dateObj.toDate().toLocaleString('fr-FR') : 'Date inconnue') : 'N/A';
        const user = allUsers.find(u => u.uid === req.userId) || { fullName: req.userName || 'Inconnu' };

        let actions = '';
        if (isMentorRef) {
            if (req.status !== 'resolved') {
                // Mentor Actions
                actions += `<button class="btn btn-small btn-success" onclick="approveMentor('${req.userId}', '${req.id}')">✅ Approuver</button>`;
                actions += `<button class="btn btn-small btn-secondary" onclick="openReplyModal('${req.id}', '${req.userId}')">↩️ Répondre</button>`;
            } else {
                actions += `<span class="badge badge-approved">Traité</span>`;
            }
        } else {
            // Delegate Actions (supposons qu'elles existent ou sont gérées via les dropdowns habituels)
            if (req.status === 'pending') {
                actions += `<button class="btn btn-small btn-success" onclick="adminApproveRequest('${req.id}')">✅ Accepter</button>`;
                actions += `<button class="btn btn-small btn-danger" onclick="adminRejectRequest('${req.id}')">❌ Refuser</button>`;
            } else {
                actions += `<span class="badge badge-approved">${req.status}</span>`;
            }
        }

        html += `
            <div class="card" style="margin-bottom: 15px; border-left: 4px solid ${isMentorRef ? 'var(--primary-color)' : 'var(--warning-color)'};">
                <div class="flex" style="justify-content: space-between; align-items: start;">
                    <div>
                        <div class="flex" style="gap: 10px; margin-bottom: 5px;">
                            <span class="badge" style="background: ${isMentorRef ? '#e0f2fe' : '#fef3c7'}; color: ${isMentorRef ? '#0369a1' : '#d97706'}">
                                ${isMentorRef ? 'MENTORAT' : 'DÉLÉGUÉ'}
                            </span>
                            <small>${dateStr}</small>
                        </div>
                        <h4 style="font-weight: 600;">${user.fullName}</h4>
                        <p style="font-size: 0.9rem; color: var(--text-secondary); margin-top: 5px;">
                            ${req.message || req.reason || 'Aucun message'}
                        </p>
                    </div>
                    <div class="flex" style="gap: 5px; flex-wrap: wrap; justify-content: flex-end;">
                        ${actions}
                    </div>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

// Afficher les statistiques
function displayStats() {
    const combinedRequests = [...allDelegateRequests, ...allMentorRequests];
    const pendingCount = combinedRequests.filter(r => r.status === 'pending' || r.status === undefined).length; // undefined for new mentor requests?

    document.getElementById('stat-users').textContent = allUsers.length;
    document.getElementById('stat-filieres').textContent = allFilieres.length;
    document.getElementById('stat-requests').textContent = combinedRequests.length;

    if (document.getElementById('stat-pending')) {
        document.getElementById('stat-pending').textContent = pendingCount;
    }

    // Badger Sidebar
    const badgeReq = document.getElementById('sidebar-badge-requests');
    if (badgeReq) {
        badgeReq.textContent = pendingCount;
        badgeReq.classList.toggle('hidden', pendingCount === 0);
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

// Basculer entre les vues
// Basculer entre les vues
function showAdminView(view) {
    const views = ['home', 'filieres', 'users', 'events', 'requests', 'alumni', 'logs', 'support', 'backup', 'marketing'];

    views.forEach(v => {
        const el = document.getElementById(`${v}-view`);
        if (el) el.classList.add('hidden');
    });

    const activeView = document.getElementById(`${view}-view`);
    if (activeView) activeView.classList.remove('hidden');

    // Mettre à jour l'état actif des boutons de la sidebar
    document.querySelectorAll('.admin-nav-item').forEach(btn => {
        // Check if the button's onclick contains the view name
        const onclickAttr = btn.getAttribute('onclick');
        if (onclickAttr && onclickAttr.includes(`'${view}'`)) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    if (view === 'users') displayUsers();
    if (view === 'requests') renderCombinedRequests();
    if (view === 'alumni') displayPendingAlumni();
    if (view === 'logs') loadLogs();
    if (view === 'support') loadSupportAlerts();
    if (view === 'events') loadAdminEvents();
    if (view === 'home') {
        displayStats();
        loadHomePlanning();
    }
}

// Charger le planning simplifié (Home View)
async function loadHomePlanning() {
    const container = document.getElementById('home-events-list');
    if (!container) return;

    try {
        const snapshot = await db.collection('events')
            .where('date', '>=', firebase.firestore.Timestamp.now())
            .get();

        if (snapshot.empty) {
            container.innerHTML = '<p style="color: var(--text-secondary);">Aucun événement à venir.</p>';
            return;
        }

        let events = [];
        snapshot.forEach(doc => events.push({ id: doc.id, ...doc.data() }));

        // Tri par date croissante (le plus proche en premier)
        events.sort((a, b) => a.date.toMillis() - b.date.toMillis());
        events = events.slice(0, 5); // Max 5

        let html = '<div class="flex" style="flex-direction: column; gap: 10px;">';
        events.forEach(ev => {
            const date = ev.date.toDate().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
            html += `
                <div class="card" style="padding: 10px; display: flex; align-items: center; gap: 15px; border-left: 3px solid var(--primary-color);">
                    <div style="font-weight: bold; font-size: 1.1rem; color: var(--primary-color); text-align: center; line-height: 1;">
                        ${date.split(' ')[0]}<br><span style="font-size: 0.8rem; color: var(--text-secondary);">${date.split(' ')[1]}</span>
                    </div>
                    <div>
                        <div style="font-weight: 600;">${ev.title}</div>
                        <div style="font-size: 0.8rem; color: var(--text-secondary);">${ev.type}</div>
                    </div>
                </div>
             `;
        });
        html += '</div>';
        container.innerHTML = html;

    } catch (e) {
        console.error("Erreur chargement planning home:", e);
        container.innerHTML = '<p class="text-error">Erreur de chargement.</p>';
    }
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
        // Filtrer pour ne PAS afficher les demandes de Mentorat ici (elles sont dans "Demandes")
        const snapshot = await db.collection('support_alerts').get();

        if (snapshot.empty) {
            container.innerHTML = '<div class="card text-center"><p style="color: var(--text-secondary);">Aucune alerte support.</p></div>';
            return;
        }

        let alerts = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.type !== 'MENTOR_REQUEST') {
                alerts.push({ id: doc.id, ...data });
            }
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
            if (alert.type === 'MENTOR_REQUEST') {
                dropdownActions.push({ label: 'Approuver le Mentor', icon: '🎓', onclick: `approveMentor('${alert.userId}', '${alert.id}')` });
            }
            if (alert.status !== 'resolved') {
                dropdownActions.push({ label: 'Répondre', icon: '↩️', onclick: `openReplyModal('${alert.id}', '${alert.userId}')` });
                dropdownActions.push({ label: 'Marquer Résolu', icon: '✓', onclick: `resolveAlert('${alert.id}')` });
            }
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

// --- REPLY SYSTEM ---
function openReplyModal(alertId, userId) {
    document.getElementById('reply-alert-id').value = alertId;
    document.getElementById('reply-user-id').value = userId;
    document.getElementById('reply-message').value = '';
    document.getElementById('reply-modal').classList.remove('hidden');
}

function closeReplyModal() {
    document.getElementById('reply-modal').classList.add('hidden');
}

async function sendReply(e) {
    e.preventDefault();
    const alertId = document.getElementById('reply-alert-id').value;
    const userId = document.getElementById('reply-user-id').value;
    const message = document.getElementById('reply-message').value;

    if (!message) return;

    try {
        // 1. Mettre à jour l'alerte
        await db.collection('support_alerts').doc(alertId).update({
            status: 'resolved',
            reply: message,
            repliedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // 2. Envoyer un message privé à l'utilisateur
        await db.collection('messages').add({
            target: JSON.stringify([userId]), // Specific format for logic or just userId if simplified
            targetUserIds: [userId], // Better practice
            title: "Réponse du Support",
            content: message,
            senderId: auth.currentUser.uid,
            senderName: currentUser.fullName || 'Admin',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            readBy: []
        });

        showSuccess('admin-message', 'Réponse envoyée avec succès !');
        closeReplyModal();
        loadSupportAlerts();
    } catch (error) {
        console.error("Erreur réponse:", error);
        showError('admin-message', 'Erreur lors de l\'envoi de la réponse.');
    }
}

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
                <td><span class="badge" style="background: rgba(0,0,0,0.05); color: var(--text-main);">${displayNiveau}</span></td>
                <td>${roleBadge}</td>
                <td>${renderActionDropdown(dropdownActions)}</td>
            </tr>
        `;
    });

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
    < div class="card fade-in" style = "border-left: 4px solid var(--accent-color);" >
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
                </div >
    `;
        });
        html += '</div>';
        container.innerHTML = html;

    } catch (error) {
        container.innerHTML = `< div class="card text-center" > <p class="text-error">Erreur de chargement : ${error.message}</p></div > `;
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
            delegateComment: `[ADMIN] ${reason || 'Refusé par l\'administrateur.'} `,
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
                        statusDiv.textContent = `Progression: ${processedDocs} / ${totalDocs} documents traités...`;
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
