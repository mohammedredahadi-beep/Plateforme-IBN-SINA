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

    // Charger les paramètres WhatsApp
    await loadSettings();

    // Charger les statistiques (optionnel, peut être supprimé si non utilisé)
    // await loadStats();

    // Initialiser les notifications
    if (typeof initNotificationSystem === 'function') {
        initNotificationSystem();
    }

    // Charger le badge de validations
    loadValidationsBadge();
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
        // En mode strict, on se base sur le profil du délégué
        if (currentUser.filiere && currentUser.niveau) {
            delegateNiveau = currentUser.niveau;
            // On peut garder delegateFiliereId pour la compatibilité si nécessaire, 
            // mais on va surtout utiliser les infos du profil.
            // On essaie de trouver le doc filière correspondant pour le nom complet
            const snapshot = await filieresRef.where('code', '==', currentUser.filiere).limit(1).get();

            let filiereName = currentUser.filiere;
            if (!snapshot.empty) {
                const doc = snapshot.docs[0];
                delegateFiliereId = doc.id; // Pour compatibilité legacy
                filiereName = doc.data().name;
            }

            let label = `${filiereName} (${delegateNiveau})`;
            if (currentUser.classe) {
                label += ` - Classe ${currentUser.classe}`;
            }
            document.getElementById('delegate-filiere').textContent = label;
            return;
        }

        // Fallback: Legacy logic
        const snapshot = await filieresRef.where('delegateId', '==', auth.currentUser.uid).get();

        if (!snapshot.empty) {
            const doc = snapshot.docs[0];
            delegateFiliereId = doc.id;
            const filiere = doc.data();
            delegateNiveau = filiere.niveau;
            document.getElementById('delegate-filiere').textContent = `${filiere.name} (${delegateNiveau || 'Tous'})`;
        } else {
            document.getElementById('delegate-filiere').textContent = 'Profil incomplet';
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
        // Écouter les changements en temps réel
        // Nouvelle logique: Filtrer par Filière (nom/code), Niveau, et Classe
        let query = requestsRef
            .where('filiere', '==', currentUser.filiere)
            .where('niveau', '==', currentUser.niveau);

        if (currentUser.classe) {
            query = query.where('classe', '==', currentUser.classe);
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
function showView(viewId) {
    const allViews = [
        'dashboard', 'validation', 'announcements', 'settings', 'history', 'notifications', 'my-class',
        // IDs utilisés dans l'HTML (avec suffixe -view)
        'pending', 'history', 'settings', 'announcements', 'validations', 'my-class'
    ];
    // Normalisation pour UICore (qui attend des IDs sans suffixe "-view" correspondant aux divs)
    // Dans delegate.js, les IDs HTML sont parfois différents (ex: pending-view au lieu de dashboard-view ?)
    // Vérifions les IDs dans delegate.js original: 'pending-view', 'history-view', 'settings-view'
    // 'announcements-view', 'validations-view', 'my-class-view'

    // Mapping pour UICore
    const viewMap = {
        'dashboard': 'pending', // Le dashboard affichait pending-view par défaut ?
        'validation': 'validations'
    };

    const targetId = viewMap[viewId] || viewId;

    const viewIds = ['pending', 'history', 'settings', 'announcements', 'validations', 'my-class'];

    ui.showView(targetId, viewIds, () => {
        if (targetId === 'pending') { loadSettings(); displayPendingRequests(); }
        if (targetId === 'history') displayHistory();
        if (targetId === 'settings') loadSettings();
        if (targetId === 'announcements' && typeof loadDelegateHistory === 'function') loadDelegateHistory();
        if (targetId === 'validations') displayDelegateValidations();
        if (targetId === 'my-class') loadMyClass();
    });
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
            const link = data.whatsappLink || '';

            const input1 = document.getElementById('setting-whatsapp');
            if (input1) input1.value = link;

            const input2 = document.getElementById('setting-whatsapp-2');
            if (input2) input2.value = link;
        }
    } catch (error) {
        console.error('Erreur chargement paramètres:', error);
    }
}

// Mettre à jour les paramètres
async function updateFiliereSettings(e) {
    e.preventDefault();
    if (!delegateFiliereId) return;

    // Déterminer quel input a été utilisé
    let whatsappLink = '';
    if (e.target.id === 'whatsapp-link-form') {
        whatsappLink = document.getElementById('setting-whatsapp').value;
    } else {
        whatsappLink = document.getElementById('setting-whatsapp-2').value;
    }

    try {
        await filieresRef.doc(delegateFiliereId).update({
            whatsappLink: whatsappLink,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Mettre à jour l'autre input pour la cohérence
        const input1 = document.getElementById('setting-whatsapp');
        if (input1) input1.value = whatsappLink;

        const input2 = document.getElementById('setting-whatsapp-2');
        if (input2) input2.value = whatsappLink;

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

// --- FONCTIONS DE VALIDATION DÉCENTRALISÉE ---

// Charger le badge de validations
async function loadValidationsBadge() {
    if (!delegateFiliereId) return;

    try {
        const filiereName = currentUser.filiere;

        // Compter les étudiants non approuvés
        const snapshot = await usersRef
            .where('role', '==', 'student')
            .where('filiere', '==', filiereName)
            .where('isApproved', '==', false)
            .get();

        const count = snapshot.size;
        const badge = document.getElementById('sidebar-badge-validations');
        if (badge) {
            badge.textContent = count;
            if (count > 0) {
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        }
    } catch (error) {
        console.error('Erreur chargement badge validations:', error);
    }
}

// Afficher les étudiants en attente de validation
async function displayDelegateValidations() {
    const container = document.getElementById('validation-list');

    if (!delegateFiliereId) {
        container.innerHTML = '<div class="card text-center"><p style="color: var(--text-secondary);">⚠️ Aucune filière assignée. Contactez l\'administration.</p></div>';
        return;
    }

    container.innerHTML = '<div class="card text-center"><p style="color: var(--text-secondary);">Chargement...</p></div>';

    try {
        // Récupérer le nom de la filière
        const filiereName = currentUser.filiere;

        // Chercher les étudiants non approuvés de cette filière / niveau / classe
        let query = usersRef
            .where('role', '==', 'student')
            .where('filiere', '==', filiereName)
            .where('niveau', '==', currentUser.niveau)
            .where('isApproved', '==', false);

        if (currentUser.classe) {
            query = query.where('classe', '==', currentUser.classe);
        }

        const snapshot = await query.get();

        if (snapshot.empty) {
            container.innerHTML = '<div class="card text-center"><p style="color: var(--text-secondary);">✅ Aucune inscription en attente</p></div>';
            return;
        }

        let html = '<div class="student-grid">';
        snapshot.forEach(doc => {
            const student = doc.data();
            const photoUrl = student.photoUrl || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(student.fullName) + '&background=random&color=fff';
            const createdDate = student.createdAt ? new Date(student.createdAt.toDate()).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'long'
            }) : 'Récemment';

            html += `
                <div class="student-card">
                    <span class="status-badge status-pending">En attente</span>
                    <div class="student-header">
                        <img src="${photoUrl}" alt="${student.fullName}" class="student-avatar">
                        <div class="student-info">
                            <h4>${student.fullName}</h4>
                            <p>📧 ${student.email}</p>
                            <p>📱 ${student.phone || 'Non renseigné'}</p>
                        </div>
                    </div>
                    
                    <div class="student-details">
                        <div class="detail-item">
                            Niveau
                            <span>${student.niveau || 'N/A'}</span>
                        </div>
                        <div class="detail-item">
                            Demandé le
                            <span>${createdDate}</span>
                        </div>
                    </div>

                    <div class="student-actions">
                        <button class="btn btn-success btn-sm" onclick="delegateApproveStudent('${student.uid}')">
                            ✓ Valider
                        </button>
                        <button class="btn btn-danger btn-sm" onclick="delegateRejectStudent('${student.uid}')">
                            ✗ Refuser
                        </button>
                    </div>
                </div>
            `;
        });
        html += '</div>';

        container.innerHTML = html;

    } catch (error) {
        console.error('Erreur chargement validations:', error);
        container.innerHTML = '<div class="card text-center"><p style="color: var(--text-error);">❌ Erreur de chargement</p></div>';
    }
}

// Approuver un étudiant par le délégué
async function delegateApproveStudent(userId) {
    if (!confirm("Confirmer l'approbation de cet étudiant ?")) return;

    try {
        await ValidationService.approveUser(userId, 'student', {
            approvedBy: auth.currentUser.uid
        });

        ui.showSuccess('delegate-message', "Étudiant approuvé et ajouté à la classe.");

        // Refresh Lists
        loadValidationsBadge();
        displayDelegateValidations();
        loadMyClass();

    } catch (error) {
        console.error("Erreur approbation délégué:", error);
        ui.showError('delegate-message', "Erreur lors de l'approbation.");
    }
}

// Refuser un étudiant (suspension)
async function delegateRejectStudent(userId) {
    const reason = prompt('Raison du refus (optionnel):');
    if (reason === null) return; // Annulation

    try {
        await usersRef.doc(userId).update({
            isSuspended: true,
            suspensionReason: reason || 'Refusé par le délégué',
            suspendedBy: auth.currentUser.uid,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showSuccess('delegate-message', 'Inscription refusée.');

        // Rafraîchir
        displayDelegateValidations();
        loadValidationsBadge();

    } catch (error) {
        console.error('Erreur refus:', error);
        showError('delegate-message', 'Erreur lors du refus: ' + error.message);
    }
}

// Charger et afficher la liste "Ma Classe"
async function loadMyClass() {
    const container = document.getElementById('class-list');

    if (!delegateFiliereId) {
        container.innerHTML = '<div class="card text-center"><p style="color: var(--text-secondary);">⚠️ Aucune filière assignée. Contactez l\'administration.</p></div>';
        return;
    }

    container.innerHTML = '<div class="card text-center"><p style="color: var(--text-secondary);">Chargement de la liste des étudiants...</p></div>';

    try {
        const filiereName = currentUser.filiere;

        // Chercher les étudiants approuvés de cette filière / classe
        let query = usersRef
            .where('role', '==', 'student')
            .where('filiere', '==', filiereName)
            .where('niveau', '==', currentUser.niveau)
            .where('isApproved', '==', true);

        // Si la classe est définie
        if (currentUser.classe) {
            query = query.where('classe', '==', currentUser.classe);
        }

        const snapshot = await query.get();

        if (snapshot.empty) {
            container.innerHTML = '<div class="card text-center"><p style="color: var(--text-secondary);">Aucun étudiant trouvé dans votre classe.</p></div>';
            return;
        }

        let html = '<div class="student-grid">';
        snapshot.forEach(doc => {
            const student = doc.data();
            const photoUrl = student.photoUrl || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(student.fullName) + '&background=random&color=fff';

            html += `
                <div class="student-card">
                    <span class="status-badge status-approved">Inscrit</span>
                    <div class="student-header">
                        <img src="${photoUrl}" alt="${student.fullName}" class="student-avatar">
                        <div class="student-info">
                            <h4>${student.fullName}</h4>
                            <p>📧 ${student.email}</p>
                            <p>📱 ${student.phone || 'Non renseigné'}</p>
                        </div>
                    </div>
                    
                    <div class="student-details">
                         <div class="detail-item">
                            Niveau
                            <span>${student.niveau || 'N/A'}</span>
                        </div>
                        <div class="detail-item">
                            Statut
                            <span>Actif</span>
                        </div>
                    </div>
                </div>
            `;
        });
        html += '</div>';

        container.innerHTML = html;

    } catch (error) {
        console.error('Erreur chargement Ma Classe:', error);
        container.innerHTML = '<div class="card text-center"><p style="color: var(--text-error);">❌ Erreur de chargement</p></div>';
    }
}
