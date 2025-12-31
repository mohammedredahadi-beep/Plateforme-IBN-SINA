// Fonctionnalités pour le tableau de bord administrateur

let currentUser = null;
let allFilieres = [];
let allUsers = [];
let allRequests = [];

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
                    ${user.role === 'student' ? `<button class="btn btn-primary btn-small" onclick="promoteToDelegate('${user.uid}')">Promouvoir</button>` : ''}
                    ${user.niveau === 'Lauréat' && !user.isApproved ? `<button class="btn btn-warning btn-small" onclick="approveAlumni('${user.uid}')">Valider</button>` : ''}
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
    html += '<thead><tr><th>Étudiant</th><th>Filière</th><th>Statut</th><th>Date</th></tr></thead><tbody>';

    for (const request of allRequests) {
        let filiereName = 'N/A';
        const filiere = allFilieres.find(f => f.id === request.filiereId);
        if (filiere) filiereName = filiere.name;

        const statusBadge =
            request.status === 'pending' ? '<span class="badge badge-pending">En attente</span>' :
                request.status === 'approved' ? '<span class="badge badge-approved">Approuvée</span>' :
                    '<span class="badge badge-rejected">Rejetée</span>';

        const date = request.createdAt ? new Date(request.createdAt.toDate()).toLocaleDateString('fr-FR') : 'N/A';

        html += `
            <tr>
                <td>${request.userName}</td>
                <td>${filiereName}</td>
                <td>${statusBadge}</td>
                <td>${date}</td>
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
        await filieresRef.add({
            name: name,
            description: description,
            delegateId: delegateId || null,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

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
        alert('Compte Lauréat approuvé ! Il peut désormais se connecter.');
        displayPendingAlumni();
        // Optionnel: envoyer un mail automatique ici via Cloud Functions
    } catch (error) {
        console.error('Erreur lors de l\'approbation:', error);
        alert('Erreur lors de l\'approbation.');
    }
}
