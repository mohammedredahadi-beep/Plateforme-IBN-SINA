// Fonctionnalités pour le tableau de bord administrateur

let currentUser = null;
let allFilieres = [];
let allUsers = [];
let allRequests = [];
const logsRef = db.collection('logs');

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
    container.innerHTML = '<div class="text-center"><p>Chargement du journal...</p></div>';

    try {
        const snapshot = await logsRef.orderBy('timestamp', 'desc').limit(50).get();

        if (snapshot.empty) {
            container.innerHTML = '<div class="card text-center"><p>Aucune action enregistrée.</p></div>';
            return;
        }

        let html = '<div class="table-container"><table class="table">';
        html += '<thead><tr><th>Admin</th><th>Action</th><th>Cible</th><th>Détails</th><th>Date</th></tr></thead><tbody>';

        snapshot.forEach(doc => {
            const log = doc.data();
            const date = log.timestamp ? new Date(log.timestamp.toDate()).toLocaleString('fr-FR') : '-';

            // Formatage de l'action
            let actionBadge = `<span class="badge" style="background: #e9ecef; color: #495057;">${log.actionType}</span>`;
            if (log.actionType.includes('SUSPEND')) actionBadge = `<span class="badge badge-rejected">${log.actionType}</span>`;
            if (log.actionType.includes('PROMOTE') || log.actionType.includes('ADD')) actionBadge = `<span class="badge badge-approved">${log.actionType}</span>`;

            html += `
                <tr>
                    <td><strong>${log.adminName}</strong></td>
                    <td>${actionBadge}</td>
                    <td style="font-family: monospace; font-size: 0.8rem;">${log.targetId}</td>
                    <td><small>${JSON.stringify(log.details)}</small></td>
                    <td>${date}</td>
                </tr>
            `;
        });

        html += '</tbody></table></div>';
        container.innerHTML = html;

    } catch (error) {
        console.error('Erreur logs:', error);
        container.innerHTML = '<p class="text-error">Erreur de chargement des logs.</p>';
    }
}

// Ouvrir le modal d'édition
function openEditUserModal(userId) {
    const user = allUsers.find(u => u.uid === userId);
    if (!user) return;

    document.getElementById('edit-user-id').value = user.uid;
    document.getElementById('edit-user-name').value = user.fullName;
    document.getElementById('edit-user-email').value = user.email;
    document.getElementById('edit-user-phone').value = user.phone;
    document.getElementById('edit-user-niveau').value = user.niveau || 'TC';

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
    const niveau = document.getElementById('edit-user-niveau').value;
    const promo = document.getElementById('edit-user-promo').value;

    try {
        const updateData = {
            fullName: fullName,
            phone: phone,
            niveau: niveau,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (niveau === 'Lauréat') {
            updateData.promo = promo;
        }

        await usersRef.doc(userId).update(updateData);

        await logAction('UPDATE_USER_PROFILE', userId, {
            name: fullName,
            niveau: niveau,
            promo: promo
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

// Initialiser le tableau de bord administrateur
async function initAdminDashboard() {
    currentUser = await checkAuthAndRedirect();

    if (!currentUser || currentUser.role !== 'admin') {
        window.location.href = 'index.html';
        return;
    }

    // Afficher les informations de l'utilisateur
    displayUserInfo();

    // Charger toutes les données
    await loadAllFilieres();
    await loadAllUsers();
    await loadAllRequests();

    // Afficher la vue par défaut
    showAdminView('filieres');
}

// Afficher les informations de l'utilisateur
function displayUserInfo() {
    document.getElementById('user-name').textContent = currentUser.fullName;
}

// Charger toutes les filières
async function loadAllFilieres() {
    try {
        const snapshot = await filieresRef.orderBy('name').get();
        allFilieres = [];
        snapshot.forEach(doc => {
            allFilieres.push({ id: doc.id, ...doc.data() });
        });
        displayFilieres();
    } catch (error) {
        console.error('Erreur lors du chargement des filières:', error);
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

        html += `
            <div class="card">
                <h3 style="font-size: 1.2rem; font-weight: 600; margin-bottom: var(--spacing-sm);">${filiere.name}</h3>
                <p style="color: var(--text-secondary); margin-bottom: var(--spacing-sm);">
                    👤 Délégué: <strong>${delegateName}</strong>
                </p>
                ${filiere.description ? `<p style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: var(--spacing-sm);">${filiere.description}</p>` : ''}
                <div class="flex gap-1">
                    <button class="btn btn-secondary btn-small" onclick="editFiliere('${filiere.id}')">Modifier</button>
                    <button class="btn btn-danger btn-small" onclick="deleteFiliere('${filiere.id}')">Supprimer</button>
                </div>
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
    }
}

// Charger toutes les demandes
async function loadAllRequests() {
    try {
        requestsRef.orderBy('createdAt', 'desc').onSnapshot(snapshot => {
            allRequests = [];
            snapshot.forEach(doc => {
                allRequests.push({ id: doc.id, ...doc.data() });
            });
            displayStats();
        });
    } catch (error) {
        console.error('Erreur lors du chargement des demandes:', error);
    }
}

// Afficher les statistiques
function displayStats() {
    const totalUsers = allUsers.length;
    const totalStudents = allUsers.filter(u => u.role === 'student').length;
    const totalDelegates = allUsers.filter(u => u.role === 'delegate').length;
    const totalRequests = allRequests.length;
    const pendingRequests = allRequests.filter(r => r.status === 'pending').length;

    document.getElementById('stat-users').textContent = totalUsers;
    document.getElementById('stat-students').textContent = totalStudents;
    document.getElementById('stat-delegates').textContent = totalDelegates;
    document.getElementById('stat-filieres').textContent = allFilieres.length;
    document.getElementById('stat-requests').textContent = totalRequests;
    document.getElementById('stat-pending').textContent = pendingRequests;
}

// Basculer entre les vues
function showAdminView(view) {
    const filieresView = document.getElementById('filieres-view');
    const usersView = document.getElementById('users-view'); // Renamed from 'delegatesView' to 'usersView' to match existing ID
    const requestsView = document.getElementById('requests-view');
    const alumniView = document.getElementById('alumni-view'); // Assuming this ID exists in the HTML
    const logsView = document.getElementById('logs-view');
    if (logsView) logsView.classList.add('hidden');

    filieresView.classList.add('hidden');
    usersView.classList.add('hidden'); // Use usersView
    requestsView.classList.add('hidden');
    alumniView.classList.add('hidden');

    if (view === 'filieres') filieresView.classList.remove('hidden');
    if (view === 'users') { // Changed from 'delegates' to 'users'
        usersView.classList.remove('hidden');
        displayUsers();
    }
    if (view === 'requests') {
        requestsView.classList.remove('hidden');
        displayAllRequests();
    }
    if (view === 'alumni') {
        alumniView.classList.remove('hidden');
        displayPendingAlumni(); // This function needs to be implemented elsewhere
    }
    if (view === 'logs') {
        if (logsView) logsView.classList.remove('hidden');
        loadLogs();
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

        html += `
            <tr class="fade-in">
                <td><strong>${user.fullName}</strong></td>
                <td style="font-size: 0.85rem;">${user.email}</td>
                <td><span class="badge" style="background: rgba(0,0,0,0.05); color: var(--text-main);">${displayNiveau}</span></td>
                <td>${roleBadge}</td>
                <td>
                    <div class="flex gap-1">
                        <button class="btn btn-secondary btn-small" onclick="openEditUserModal('${user.uid}')">Modifier Infos</button>
                        ${user.role === 'student' ? `<button class="btn btn-primary btn-small" onclick="promoteToDelegate('${user.uid}')">Promouvoir</button>` : ''}
                        ${user.niveau === 'Lauréat' && !user.isApproved ? `<button class="btn btn-warning btn-small" onclick="approveAlumni('${user.uid}')">Valider</button>` : ''}
                        ${user.uid !== auth.currentUser.uid ? (
                user.isSuspended
                    ? `<button class="btn btn-success btn-small" onclick="unsuspendUser('${user.uid}')">Réactiver</button>`
                    : `<button class="btn btn-danger btn-small" onclick="suspendUser('${user.uid}')">Suspendre</button>`
            ) : ''}
                    </div>
                </td>
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
    html += '<thead><tr><th>Étudiant</th><th>Filière</th><th>Statut</th><th>Date</th><th>Actions</th></tr></thead><tbody>';

    for (const request of allRequests) {
        let filiereName = 'N/A';
        const filiere = allFilieres.find(f => f.id === request.filiereId);
        if (filiere) filiereName = filiere.name;

        const statusBadge =
            request.status === 'pending' ? '<span class="badge badge-pending">En attente</span>' :
                request.status === 'approved' ? '<span class="badge badge-approved">Approuvée</span>' :
                    '<span class="badge badge-rejected">Rejetée</span>';

        const date = request.createdAt ? new Date(request.createdAt.toDate()).toLocaleDateString('fr-FR') : 'N/A';

        const actions = request.status === 'pending'
            ? `<div class="flex gap-1">
                <button class="btn btn-success btn-small" onclick="adminApproveRequest('${request.id}')" title="Approuver">✓</button>
                <button class="btn btn-danger btn-small" onclick="adminRejectRequest('${request.id}')" title="Rejeter">✗</button>
               </div>`
            : '-';

        html += `
            <tr>
                <td>${request.userName}</td>
                <td>${filiereName}</td>
                <td>${statusBadge}</td>
                <td>${date}</td>
                <td>${actions}</td>
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
    const description = document.getElementById('filiere-description').value;
    const delegateId = document.getElementById('filiere-delegate').value;

    try {
        const docRef = await filieresRef.add({
            name: name,
            description: description,
            delegateId: delegateId || null,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        await logAction('ADD_FILIERE', docRef.id, { name: name });
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
        const snapshot = await usersRef
            .where('niveau', '==', 'Lauréat')
            .where('isApproved', '==', false)
            .get();

        if (snapshot.empty) {
            container.innerHTML = `
                <div class="card text-center">
                    <p style="color: var(--text-secondary);">Aucun lauréat en attente d'approbation.</p>
                </div>
            `;
            return;
        }

        let html = '';
        snapshot.forEach(doc => {
            const user = doc.data();
            html += `
                <div class="card fade-in" style="margin-bottom: 15px; border-left: 4px solid var(--accent-color);">
                    <div class="flex" style="justify-content: space-between; align-items: center;">
                        <div>
                            <h4 style="font-weight: 600;">🎓 ${user.fullName}</h4>
                            <p style="font-size: 0.85rem; color: var(--text-secondary);">
                                <strong>Promo ${user.promo || 'N/A'}</strong> | ${user.email}
                            </p>
                        </div>
                        <div class="flex gap-1">
                            <button class="btn btn-primary btn-small" onclick="approveAlumni('${doc.id}')">
                                Approuver
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;

    } catch (error) {
        console.error('Erreur lors du chargement des lauréats:', error);
        container.innerHTML = '<p class="text-error">Erreur de chargement.</p>';
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
        // Optionnel: envoyer un mail automatique ici via Cloud Functions
    } catch (error) {
        console.error('Erreur lors de l\'approbation:', error);
        alert('Erreur lors de l\'approbation.');
    }
}

/**
 * OVERRIDE ADMIN : VALIDATION DES DEMANDES ÉTUDIANTS
 */

// Approuver une demande étudiant (Override Admin)
async function adminApproveRequest(requestId) {
    if (!confirm('Voulez-vous vraiment approuver cette demande au nom du délégué ?')) return;

    try {
        const pin = Math.random().toString(36).substring(2, 8).toUpperCase();
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 48);

        await requestsRef.doc(requestId).update({
            status: 'approved',
            verificationPin: pin,
            pinExpiresAt: firebase.firestore.Timestamp.fromDate(expiresAt),
            isVerified: false,
            processedBy: auth.currentUser.uid, // Marqué comme traité par l'admin
            processedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        await logAction('ADMIN_APPROVE_REQUEST', requestId, { student: requestId });
        showSuccess('admin-message', `Demande approuvée (Admin) ! PIN : ${pin}`);
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
