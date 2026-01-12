// Fonctionnalités pour le tableau de bord délégué

let currentUser = null;
let delegateFiliereId = null;
let delegateNiveau = null;
let pendingRequests = [];

// Initialiser le tableau de bord délégué
async function initDelegateDashboard() {
    currentUser = await checkAuthAndRedirect();

    if (!currentUser || currentUser.role !== 'delegate') {
        window.location.href = 'index.html';
        return;
    }

    // Gestion du thème
    initTheme();

    // Afficher les informations de l'utilisateur
    displayUserInfo();

    // Charger la filière du délégué
    await loadDelegateFiliere();

    // Charger les demandes en attente
    await loadPendingRequests();

    // Charger les statistiques
    await loadStats();

    // Initialiser les notifications
    if (typeof initNotificationSystem === 'function') {
        initNotificationSystem();
    }
}

/**
 * Initialise le thème sombre/clair
 */
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
}

/**
 * Bascule entre mode sombre et clair
 */
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
}

/**
 * Filtre les demandes basées sur la barre de recherche
 */
function filterRequests() {
    const searchTerm = document.getElementById('search-requests').value.toLowerCase();
    const currentView = document.getElementById('pending-view').classList.contains('hidden') ? 'history' : 'pending';

    if (currentView === 'pending') {
        displayPendingRequests(searchTerm);
    } else {
        displayHistory(searchTerm);
    }
}

// Afficher les informations de l'utilisateur
function displayUserInfo() {
    document.getElementById('user-name').textContent = currentUser.fullName;
}

// Charger la filière assignée au délégué
async function loadDelegateFiliere() {
    try {
        // Trouver la filière où ce délégué est assigné
        const snapshot = await filieresRef.where('delegateId', '==', auth.currentUser.uid).get();

        if (!snapshot.empty) {
            const doc = snapshot.docs[0];
            delegateFiliereId = doc.id;
            const filiere = doc.data();
            delegateNiveau = filiere.niveau;
            document.getElementById('delegate-filiere').textContent = `${filiere.name} (${delegateNiveau || 'Tous'})`;
        } else {
            document.getElementById('delegate-filiere').textContent = 'Aucune filière assignée';
            showError('delegate-message', 'Vous n\'êtes assigné à aucune filière. Contactez l\'administrateur.');
        }
    } catch (error) {
        console.error('Erreur lors du chargement de la filière:', error);
    }
}

// Charger les demandes en attente
async function loadPendingRequests() {
    if (!delegateFiliereId) {
        document.getElementById('requests-list').innerHTML = `
            <div class="card text-center">
                <p style="color: var(--text-secondary);">En attente d'assignation à une filière...</p>
            </div>
        `;
        return;
    }

    try {
        // Écouter les changements en temps réel
        let query = requestsRef.where('filiereId', '==', delegateFiliereId);

        // Si la filière est restreinte à un niveau spécifique
        if (delegateNiveau) {
            query = query.where('niveau', '==', delegateNiveau);
        }

        query.onSnapshot(snapshot => {
            pendingRequests = [];
            snapshot.forEach(doc => {
                pendingRequests.push({ id: doc.id, ...doc.data() });
            });
            // Trier localement pour éviter les problèmes d'index composite Firebase
            pendingRequests.sort((a, b) => {
                const dateA = a.createdAt ? a.createdAt.toDate() : new Date(0);
                const dateB = b.createdAt ? b.createdAt.toDate() : new Date(0);
                return dateB - dateA;
            });
            displayPendingRequests();
            loadStats();
        }, error => {
            console.error('Erreur onSnapshot délégué:', error);
            showError('delegate-message', 'Erreur de connexion en temps réel aux demandes.');
        });
    } catch (error) {
        console.error('Erreur lors du chargement des demandes:', error);
    }
}

// Afficher les demandes en attente
function displayPendingRequests(searchFilter = '') {
    const container = document.getElementById('requests-list');

    let pending = pendingRequests.filter(r => r.status === 'pending');

    if (searchFilter) {
        pending = pending.filter(r =>
            r.userName.toLowerCase().includes(searchFilter) ||
            r.userEmail.toLowerCase().includes(searchFilter) ||
            r.userPhone.includes(searchFilter)
        );
    }

    if (pending.length === 0) {
        container.innerHTML = `
            <div class="card text-center">
                <p style="color: var(--text-secondary);">Aucune demande trouvée</p>
            </div>
        `;
        return;
    }

    let html = '';

    for (const request of pending) {
        const createdDate = request.createdAt ? new Date(request.createdAt.toDate()).toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }) : 'Date inconnue';

        // Analyse IA déplacée dans une fonction séparée pour ne pas bloquer l'affichage
        const aiContainerId = `ai-analysis-${request.id}`;
        if (request.motivation && request.motivation.length > 10) {
            // Lancer l'analyse en arrière-plan sans await
            runAIAnalysis(request.id, request.motivation, aiContainerId);
        }

        html += `
            <div class="card">
                <div style="margin-bottom: var(--spacing-md);">
                    <h3 style="font-size: 1.2rem; font-weight: 600; margin-bottom: var(--spacing-xs);">${request.userName}</h3>
                    <div style="color: var(--text-secondary); font-size: 0.9rem;">
                        <p>📧 ${request.userEmail}</p>
                        <p>📱 ${request.userPhone}</p>
                        <p>📚 Niveau: ${request.niveau || 'Non spécifié'}</p>
                        <p>🕒 ${createdDate}</p>
                    </div>
                </div>
                
                ${request.motivation ? `
                    <div style="background: var(--bg-tertiary); padding: var(--spacing-sm); border-radius: var(--radius-sm); margin-bottom: var(--spacing-md);">
                        <strong style="font-size: 0.9rem;">Motivation:</strong>
                        <p style="margin-top: var(--spacing-xs); color: var(--text-secondary);">${request.motivation}</p>
                        <div id="${aiContainerId}">
                            <small style="color: var(--text-secondary);">🤖 Analyse IA en cours...</small>
                        </div>
                    </div>
                ` : ''}
                
                <div class="flex gap-1">
                    <button class="btn btn-success" onclick="approveRequest('${request.id}')" style="flex: 1;">
                        ✓ Approuver
                    </button>
                    <button class="btn btn-danger" onclick="rejectRequest('${request.id}')" style="flex: 1;">
                        ✗ Rejeter
                    </button>
                </div>
            </div>
        `;
    }

    container.innerHTML = html;
}

// Charger les statistiques
async function loadStats() {
    const total = pendingRequests.length;
    const pending = pendingRequests.filter(r => r.status === 'pending').length;
    const approved = pendingRequests.filter(r => r.status === 'approved').length;
    const rejected = pendingRequests.filter(r => r.status === 'rejected').length;

    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-pending').textContent = pending;
    document.getElementById('stat-approved').textContent = approved;
    const statRejected = document.getElementById('stat-rejected');
    if (statRejected) statRejected.textContent = rejected;
}

// Approuver une demande avec génération de PIN sécurisé
async function approveRequest(requestId) {
    if (!confirm('Voulez-vous vraiment approuver cette demande ?')) return;

    try {
        await requestsRef.doc(requestId).update({
            status: 'approved',
            processedBy: auth.currentUser.uid,
            processedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showSuccess('delegate-message', `Demande approuvée ! L'étudiant peut désormais voir le lien WhatsApp.`);
    } catch (error) {
        console.error('Erreur lors de l\'approbation:', error);
        showError('delegate-message', 'Erreur lors de l\'approbation de la demande.');
    }
}

// Rejeter une demande
async function rejectRequest(requestId) {
    const comment = prompt('Raison du rejet (optionnel):');

    if (comment === null) return; // Annulation

    try {
        await requestsRef.doc(requestId).update({
            status: 'rejected',
            delegateComment: comment || 'Demande rejetée par le délégué.',
            processedBy: auth.currentUser.uid,
            processedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showSuccess('delegate-message', 'Demande rejetée.');
    } catch (error) {
        console.error('Erreur lors du rejet:', error);
        showError('delegate-message', 'Erreur lors du rejet de la demande.');
    }
}

// Basculer entre les vues
function showView(view) {
    // Masquer toutes les vues
    document.getElementById('pending-view').classList.add('hidden');
    document.getElementById('history-view').classList.add('hidden');
    document.getElementById('settings-view').classList.add('hidden');
    document.getElementById('announcements-view').classList.add('hidden');

    // Gérer l'en-tête global des demandes (Stats + Recherche)
    // Visible uniquement pour 'pending' et 'history'
    const header = document.getElementById('requests-header');
    if (header) {
        if (view === 'pending' || view === 'history') {
            header.classList.remove('hidden');
        } else {
            header.classList.add('hidden');
        }
    }

    if (view === 'pending') {
        document.getElementById('pending-view').classList.remove('hidden');
    } else if (view === 'history') {
        document.getElementById('history-view').classList.remove('hidden');
        displayHistory();
    } else if (view === 'settings') {
        document.getElementById('settings-view').classList.remove('hidden');
        loadSettings();
    } else if (view === 'announcements') {
        document.getElementById('announcements-view').classList.remove('hidden');
        if (typeof loadDelegateHistory === 'function') loadDelegateHistory();
    }
}

// ---- ANNOUNCEMENT FUNCTIONS ----

function openAnnouncementModal() {
    // Scroll to form (since it's inline in this version)
    document.getElementById('announcement-form').scrollIntoView({ behavior: 'smooth' });
}

async function submitAnnouncement(e) {
    e.preventDefault();
    if (typeof createAnnouncement !== 'function') {
        console.error("Module annonces non chargé");
        return;
    }

    const title = document.getElementById('ann-title').value;
    const type = document.getElementById('ann-type').value;
    const target = document.getElementById('ann-target').value;
    const content = document.getElementById('ann-content').value;

    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.textContent;
    btn.textContent = 'Publication...';
    btn.disabled = true;

    try {
        const targetId = target === 'filiere' ? delegateFiliereId : 'all';
        const result = await createAnnouncement(title, content, type, targetId);

        if (result.success) {
            alert('Annonce publiée avec succès !');
            e.target.reset();
            loadDelegateHistory();
        } else {
            alert('Erreur lors de la publication.');
        }
    } catch (error) {
        console.error(error);
        alert('Erreur inattendue.');
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

// Charger les paramètres
async function loadSettings() {
    if (!delegateFiliereId) return;
    try {
        const doc = await filieresRef.doc(delegateFiliereId).get();
        if (doc.exists) {
            const data = doc.data();
            document.getElementById('setting-whatsapp').value = data.whatsappLink || '';
        }
    } catch (error) {
        console.error('Erreur chargement paramètres:', error);
    }
}

// Mettre à jour les paramètres
async function updateFiliereSettings(e) {
    e.preventDefault();
    if (!delegateFiliereId) return;

    const whatsappLink = document.getElementById('setting-whatsapp').value;

    try {
        await filieresRef.doc(delegateFiliereId).update({
            whatsappLink: whatsappLink,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        showSuccess('delegate-message', 'Lien WhatsApp mis à jour avec succès !');
    } catch (error) {
        console.error('Erreur mise à jour paramètres:', error);
        showError('delegate-message', 'Erreur lors de la mise à jour.');
    }
}

// Afficher l'historique
function displayHistory(searchFilter = '') {
    const container = document.getElementById('history-list');
    let processed = pendingRequests.filter(r => r.status !== 'pending');

    if (searchFilter) {
        processed = processed.filter(r =>
            r.userName.toLowerCase().includes(searchFilter) ||
            r.userEmail.toLowerCase().includes(searchFilter) ||
            r.userPhone.includes(searchFilter)
        );
    }

    if (processed.length === 0) {
        container.innerHTML = `
            <div class="card text-center">
                <p style="color: var(--text-secondary);">Aucune demande trouvée dans l'historique</p>
            </div>
        `;
        return;
    }

    let html = '<div class="table-container"><table class="table"><thead><tr><th>Étudiant</th><th>Email</th><th>Téléphone</th><th>Statut</th><th>Date</th></tr></thead><tbody>';

    processed.forEach(request => {
        const statusBadge = request.status === 'approved'
            ? '<span class="badge badge-approved">Approuvée</span>'
            : '<span class="badge badge-rejected">Rejetée</span>';
        const processedDate = request.processedAt ? new Date(request.processedAt.toDate()).toLocaleDateString('fr-FR') : '-';

        html += `
            <tr>
                <td>${request.userName}</td>
                <td>${request.userEmail}</td>
                <td>${request.userPhone}</td>
                <td>${statusBadge}</td>
                <td>${processedDate}</td>
            </tr>
        `;
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;
}

/**
 * Exporte la liste des étudiants approuvés en format CSV
 */
function exportApprovedToCSV() {
    const approved = pendingRequests.filter(r => r.status === 'approved');

    if (approved.length === 0) {
        alert("Aucun étudiant approuvé à exporter.");
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Nom,Email,Telephone,Niveau,Date Approbation\n";

    approved.forEach(req => {
        const date = req.processedAt ? new Date(req.processedAt.toDate()).toLocaleDateString('fr-FR') : 'N/A';
        const row = [
            `"${req.userName}"`,
            `"${req.userEmail}"`,
            `"${req.userPhone}"`,
            `"${req.niveau || 'N/A'}"`,
            `"${date}"`
        ].join(",");
        csvContent += row + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `etudiants_approuves_${delegateFiliereId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * Fonction helper pour l'analyse IA asynchrone (non-bloquante)
 */
async function runAIAnalysis(requestId, motivation, containerId) {
    try {
        const aiAnalysis = await analyzeMotivation(motivation);
        const container = document.getElementById(containerId);
        if (!container || !aiAnalysis) return;

        const color = aiAnalysis.score >= 7 ? 'var(--success-color)' : (aiAnalysis.score >= 5 ? 'var(--warning-color)' : 'var(--danger-color)');
        container.innerHTML = `
            <div style="margin-top: 10px; padding: 10px; border-radius: 8px; background: rgba(0,0,0,0.03); border-left: 4px solid ${color};">
                <small style="color: var(--text-secondary); font-weight: 600;">🤖 ANALYSE IA :</small><br>
                <span style="font-size: 0.85rem;">${aiAnalysis.resume} (Score: ${aiAnalysis.score}/10)</span><br>
                <strong style="font-size: 0.8rem; color: ${color};">Conseil : ${aiAnalysis.recommandation}</strong>
            </div>
        `;
    } catch (error) {
        console.error("Erreur d'analyse IA pour requestId:", requestId, error);
        const container = document.getElementById(containerId);
        if (container) container.innerHTML = '';
    }
}
