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
    document.getElementById('filieres-view').classList.add('hidden');
    document.getElementById('users-view').classList.add('hidden');
    document.getElementById('requests-view').classList.add('hidden');

    if (view === 'filieres') {
        document.getElementById('filieres-view').classList.remove('hidden');
    } else if (view === 'users') {
        document.getElementById('users-view').classList.remove('hidden');
        displayUsers();
    } else {
        document.getElementById('requests-view').classList.remove('hidden');
        displayAllRequests();
    }
}

// Afficher tous les utilisateurs
function displayUsers() {
    const container = document.getElementById('users-list');

    const students = allUsers.filter(u => u.role === 'student');
    const delegates = allUsers.filter(u => u.role === 'delegate');

    let html = '<div class="table-container"><table class="table">';
    html += '<thead><tr><th>Nom</th><th>Email</th><th>Téléphone</th><th>Rôle</th><th>Actions</th></tr></thead><tbody>';

    [...delegates, ...students].forEach(user => {
        const roleBadge = user.role === 'delegate'
            ? '<span class="badge badge-approved">Délégué</span>'
            : '<span class="badge badge-pending">Étudiant</span>';

        html += `
            <tr>
                <td>${user.fullName}</td>
                <td>${user.email}</td>
                <td>${user.phone || 'N/A'}</td>
                <td>${roleBadge}</td>
                <td>
                    ${user.role === 'student' ? `<button class="btn btn-success btn-small" onclick="promoteToDelegate('${user.uid}')">Promouvoir</button>` : ''}
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
