// Fonctionnalités pour le tableau de bord étudiant

let currentUser = null;
let userRequests = [];
let allFilieres = []; // Cache global pour les noms des filières

// Initialiser le tableau de bord
async function initStudentDashboard() {
    currentUser = await checkAuthAndRedirect();

    if (!currentUser || currentUser.role !== 'student') {
        window.location.href = 'index.html';
        return;
    }

    // Thème
    initTheme();

    // Afficher les informations de l'utilisateur
    displayUserInfo();

    // Afficher le lien WhatsApp
    await displayWhatsAppAccess();

    // Affichage automatique de l'espace lauréat si le profil le confirme
    if (currentUser.niveau === 'Lauréat') {
        toggleLauratView('Lauréat');
        loadPromoNetwork();
    }

    // Initialiser les notifications
    if (typeof initNotificationSystem === 'function') {
        initNotificationSystem();
    }
}

function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
}

// Afficher les informations de l'utilisateur
function displayUserInfo() {
    document.getElementById('user-name').textContent = currentUser.fullName;
    document.getElementById('user-email').textContent = currentUser.email;
}

// Charger les filières disponibles
async function loadFilieres() {
    try {
        const snapshot = await filieresRef.orderBy('name').get();
        const filiereSelect = document.getElementById('request-filiere');
        filiereSelect.innerHTML = '<option value="">-- Sélectionnez une filière --</option>';

        snapshot.forEach(doc => {
            const filiere = doc.data();

            // Ne montrer que les filières du même niveau que l'étudiant ou sans restriction
            if (!filiere.niveau || filiere.niveau === currentUser.niveau) {
                allFilieres.push({ id: doc.id, ...filiere });
                const option = document.createElement('option');
                option.value = doc.id;
                option.textContent = filiere.name;
                filiereSelect.appendChild(option);
            }
        });
    } catch (error) {
        console.error('Erreur lors du chargement des filières:', error);
        showError('request-message', 'Erreur lors du chargement des filières.');
    }
}

// Charger les demandes de l'utilisateur
async function loadUserRequests() {
    try {
        // Écouter les changements en temps réel
        requestsRef
            .where('userId', '==', auth.currentUser.uid)
            .onSnapshot(snapshot => {
                userRequests = [];
                snapshot.forEach(doc => {
                    userRequests.push({ id: doc.id, ...doc.data() });
                });

                // Trier localement par date de création (desc)
                userRequests.sort((a, b) => {
                    const dateA = a.createdAt ? a.createdAt.toDate() : new Date(0);
                    const dateB = b.createdAt ? b.createdAt.toDate() : new Date(0);
                    return dateB - dateA;
                });

                displayUserRequests();
            }, error => {
                console.error('Erreur onSnapshot étudiant:', error);
                // Si l'erreur est liée à l'index, le listener ne marchera pas sans cette version simplifiée
            });
    } catch (error) {
        console.error('Erreur lors du chargement des demandes:', error);
    }
}

// Afficher les demandes de l'utilisateur
function displayUserRequests() {
    const container = document.getElementById('requests-list');

    if (userRequests.length === 0) {
        container.innerHTML = `
            <div class="card text-center">
                <p style="color: var(--text-secondary);">Vous n'avez encore soumis aucune demande.</p>
            </div>
        `;
        return;
    }

    let html = '';

    for (const request of userRequests) {
        // Utiliser allFilieres chargées précédemment pour éviter les appels Firestore en boucle
        let filiereName = 'Chargement...';
        const found = allFilieres.find(f => f.id === request.filiereId);
        if (found) {
            filiereName = found.name;
        }

        const statusBadge = getStatusBadge(request.status);
        const createdDate = request.createdAt ? new Date(request.createdAt.toDate()).toLocaleDateString('fr-FR') : 'Date inconnue';

        // Nouveau système : Affichage direct du lien WhatsApp si approuvé
        let linkInfo = '';
        if (request.status === 'approved') {
            const whatsappLink = found ? found.whatsappLink : null;
            if (whatsappLink) {
                linkInfo = `
                    <div style="margin-top: 15px; padding: 15px; background: rgba(16, 185, 129, 0.1); border-radius: 10px; border: 2px solid var(--success-color); text-align: center;">
                        <p style="font-weight: 700; color: var(--success-color); margin-bottom: 10px;">✅ Demande Approuvée !</p>
                        <a href="${whatsappLink}" target="_blank" class="btn btn-success" style="width: 100%; justify-content: center; text-decoration: none; display: flex; align-items: center; gap: 8px;">
                            <span>📱 Rejoindre le groupe WhatsApp</span>
                        </a>
                        <p style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 10px;">
                            Cliquez sur le bouton ci-dessus pour rejoindre votre classe.
                        </p>
                    </div>
                `;
            } else {
                linkInfo = `
                    <div style="margin-top: 15px; padding: 15px; background: rgba(0, 0, 0, 0.05); border-radius: 10px; text-align: center;">
                        <p style="color: var(--text-secondary); font-size: 0.85rem;">
                            ℹ️ Demande approuvée, mais le lien WhatsApp n'a pas encore été configuré par le délégué.
                        </p>
                    </div>
                `;
            }
        }

        html += `
            <div class="card fade-in">
                <div class="flex" style="justify-content: space-between; align-items: start; margin-bottom: var(--spacing-sm);">
                    <div>
                        <h3 style="font-size: 1.1rem; font-weight: 600; margin-bottom: var(--spacing-xs);">${filiereName}</h3>
                        <p style="color: var(--text-secondary); font-size: 0.9rem;">Niveau: ${request.niveau || 'Non spécifié'}</p>
                    </div>
                    ${statusBadge}
                </div>
                
                <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: var(--spacing-sm);">
                    Demandé le ${createdDate}
                </div>
                
                ${request.delegateComment ? `
                    <div class="alert alert-${request.status === 'approved' ? 'success' : 'warning'}" style="margin-top: var(--spacing-sm);">
                        <strong>Commentaire du délégué:</strong><br>
                        " ${request.delegateComment} "
                    </div>
                ` : ''}
                
                ${linkInfo}
            </div>
        `;
    }

    container.innerHTML = html;

    // Phase 15 : Désactivation du formulaire si une demande existe déjà
    const requestForm = document.getElementById('request-form');
    const submitBtn = requestForm.querySelector('button[type="submit"]');
    const hasActiveRequest = userRequests.some(r => r.status === 'pending' || r.status === 'approved');

    if (hasActiveRequest) {
        submitBtn.disabled = true;
        submitBtn.style.opacity = '0.5';
        submitBtn.style.cursor = 'not-allowed';
        const infoMsg = document.getElementById('request-message');
        infoMsg.innerHTML = '<div class="alert alert-warning">Vous avez déjà une demande active. Vous ne pouvez pas soumettre plusieurs demandes d\'adhésion.</div>';
    } else {
        submitBtn.disabled = false;
        submitBtn.style.opacity = '1';
        submitBtn.style.cursor = 'pointer';
    }
}

// Obtenir le badge de statut
function getStatusBadge(status) {
    const badges = {
        pending: '<span class="badge badge-pending">En attente</span>',
        approved: '<span class="badge badge-approved">Approuvée</span>',
        rejected: '<span class="badge badge-rejected">Rejetée</span>'
    };
    return badges[status] || badges.pending;
}

// Soumettre une nouvelle demande
async function submitRequest(e) {
    e.preventDefault();

    const filiereId = document.getElementById('request-filiere').value;
    const niveau = document.getElementById('request-niveau').value;
    const phone = document.getElementById('request-phone').value;
    const motivation = document.getElementById('request-motivation').value;

    if (!filiereId) {
        showError('request-message', 'Veuillez sélectionner une filière.');
        return;
    }

    // Phase 15 : Vérification de l'unicité globale (1 seule demande par compte)
    if (userRequests.length > 0) {
        showError('request-message', 'Vous avez déjà soumis une demande d\'adhésion. Une seule demande est autorisée par compte.');
        return;
    }

    try {
        // Afficher le loading
        const submitBtn = document.querySelector('#request-form button[type="submit"]');
        const btnText = submitBtn.querySelector('span:first-child');
        const btnLoading = submitBtn.querySelector('.loading');
        btnText.classList.add('hidden');
        btnLoading.classList.remove('hidden');
        submitBtn.disabled = true;

        // Créer la demande
        await requestsRef.add({
            userId: auth.currentUser.uid,
            userName: currentUser.fullName,
            userEmail: currentUser.email,
            userPhone: phone,
            filiereId: filiereId,
            niveau: niveau,
            motivation: motivation,
            status: 'pending',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showSuccess('request-message', 'Votre demande a été soumise avec succès !');

        // Réinitialiser le formulaire
        document.getElementById('request-form').reset();

        // Masquer le loading
        btnText.classList.remove('hidden');
        btnLoading.classList.add('hidden');
        submitBtn.disabled = false;

    } catch (error) {
        console.error('Erreur lors de la soumission de la demande:', error);
        showError('request-message', 'Une erreur est survenue. Veuillez réessayer.');

        // Masquer le loading
        const submitBtn = document.querySelector('#request-form button[type="submit"]');
        const btnText = submitBtn.querySelector('span:first-child');
        const btnLoading = submitBtn.querySelector('.loading');
        btnText.classList.remove('hidden');
        btnLoading.classList.add('hidden');
        submitBtn.disabled = false;
    }
}

/**
 * Bascule l'affichage entre étudiant et lauréat selon le niveau choisi
 */
function toggleLauratView(niveau) {
    const laureatView = document.getElementById('laureat-view');
    const motivationLabel = document.querySelector('label[for="request-motivation"]');
    const motivationTextarea = document.getElementById('request-motivation');

    if (niveau === 'Lauréat') {
        if (laureatView) laureatView.classList.remove('hidden');
        if (motivationLabel) motivationLabel.textContent = "Spécialité / Occupation actuelle";
        if (motivationTextarea) motivationTextarea.placeholder = "Ex: Ingénieur Logiciel à Casablanca, Étudiant à l'étranger...";
    } else {
        if (laureatView) laureatView.classList.add('hidden');
        if (motivationLabel) motivationLabel.textContent = "Motivation (optionnel)";
        if (motivationTextarea) motivationTextarea.placeholder = "Pourquoi souhaitez-vous rejoindre ce groupe ?";
    }
}

/**
 * Fonctions pour l'Espace Lauréat
 */
function joinMentorship() {
    alert("Merci ! Un administrateur vous contactera pour vous intégrer au programme de mentorat.");
}

function shareResources() {
    const link = prompt("Veuillez coller le lien vers votre ressource (Google Drive, LinkedIn, etc.) :");
    if (link) {
        alert("Ressource reçue ! Elle sera validée avant d'être partagée avec les étudiants.");
    }
}

/**
 * Réseautage par Promotion
 */
async function loadPromoNetwork() {
    const container = document.getElementById('promo-users-list');
    const badge = document.getElementById('my-promo-badge');

    if (!currentUser.promo) {
        container.innerHTML = '<p style="color: var(--text-secondary);">Promotion non renseignée.</p>';
        return;
    }

    if (badge) badge.textContent = `Promo ${currentUser.promo}`;

    try {
        const snapshot = await usersRef
            .where('niveau', '==', 'Lauréat')
            .where('promo', '==', currentUser.promo)
            .where('isApproved', '==', true)
            .get();

        if (snapshot.size <= 1) {
            container.innerHTML = `
                <div class="card text-center" style="grid-column: span 3;">
                    <p style="color: var(--text-secondary);">Vous êtes le seul lauréat de votre promotion inscrit pour le moment.</p>
                </div>
            `;
            return;
        }

        let html = '';
        snapshot.forEach(doc => {
            const user = doc.data();
            if (user.uid === currentUser.uid) return; // Ne pas s'afficher soi-même

            html += `
                <div class="card fade-in" style="padding: 15px; border: 1px solid var(--border-color); background: white;">
                    <div style="font-weight: 600; margin-bottom: 5px; color: var(--text-main);">${user.fullName}</div>
                    <div style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 10px;">${user.email}</div>
                    <a href="mailto:${user.email}" class="btn btn-secondary btn-small" style="width: 100%; text-align: center; display: block;">
                        ✉️ Contacter
                    </a>
                </div>
            `;
        });
        container.innerHTML = html;

    } catch (error) {
        console.error('Erreur réseau promo:', error);
        container.innerHTML = '<p class="text-error">Erreur de chargement du réseau.</p>';
    }
}

// --- Notifications System ---
// La gestion des notifications est centralisée dans js/notifications.js

// Basculer entre les vues (Refactored for UICore)
function showStudentView(viewId) {
    const allViews = ['dashboard', 'events', 'mentorship', 'directory', 'notifications'];

    // Map views to elements IDs if they differ (here they seem to match: dashboard -> dashboard-view)
    // Actually in HTML: dashboard-view, laureat-view, mentorship-view, directory-view, events-view, notifications-view
    // logic in HTML handled 'laureat' view inside dashboard view logic

    // Let's replicate HTML logic
    ui.showView(viewId, allViews, () => {
        if (viewId === 'dashboard') {
            // Check Laureat logic
            const laureatView = document.getElementById('laureat-view');
            if (laureatView && currentUser && currentUser.niveau === 'Lauréat') {
                laureatView.classList.remove('hidden');
            }
        }

        if (viewId === 'events' && typeof loadEvents === 'function') loadEvents('events-feed');
        if (viewId === 'mentorship' && typeof initMentorship === 'function') initMentorship();
        if (viewId === 'directory' && typeof initDirectory === 'function') initDirectory();
        if (viewId === 'notifications' && typeof initNotificationsView === 'function') initNotificationsView();
    });

    // Update sidebar active state handled by UICore but we might need to ensure nav-tab class compatibility
    // UICore uses .sidebar-link. In student html, links have class "sidebar-link nav-tab". So it works.
}
