// Logique pour le dashboard des Lauréats (Alumni)

let currentUser = null;

// Initialisation
document.addEventListener('DOMContentLoaded', async () => {
    currentUser = await checkAuthAndRedirect();

    // Sécurité supplémentaire : vérifier le rôle
    const allowedRoles = ['alumni'];
    if (currentUser && !allowedRoles.includes(currentUser.role)) {
        redirectByRole(currentUser.role);
        return;
    }

    if (currentUser) {
        setupRoleSpecificUI();
        displayAlumniInfo();
        loadDashboardEventsPreview();
        updateMentorStatusDisplay();

        // Initialiser les notifications
        if (typeof initNotificationSystem === 'function') {
            initNotificationSystem();
        }
    }
});

/**
 * Ajuste l'interface selon le rôle spécifique (Alumni, Mentor, Bureau)
 */
function setupRoleSpecificUI() {
    const tabMentor = document.getElementById('tab-mentor');

    if (currentUser.mentorStatus === 'approved') {
        if (tabMentor) tabMentor.textContent = '👨‍🏫 Mon Mentorat';
    }
}

// Afficher les infos du lauréat
function displayAlumniInfo() {
    document.getElementById('welcome-name').textContent = `Bonjour, ${currentUser.fullName}`;
    if (document.getElementById('user-display-name')) {
        document.getElementById('user-display-name').textContent = currentUser.fullName;
    }

    // Remplir la vue profil
    document.getElementById('profile-name').value = currentUser.fullName || '';
    document.getElementById('profile-email').value = currentUser.email || '';

    // Promo : just the number now
    document.getElementById('profile-promo').value = currentUser.promo || '';

    // Filière
    document.getElementById('profile-filiere').value = currentUser.filiere || '';

    // Phone & WhatsApp
    document.getElementById('profile-phone').value = currentUser.phone || '';
    document.getElementById('profile-whatsapp').value = currentUser.whatsapp || '';

    // Charger les autres champs
    document.getElementById('profile-linkedin').value = currentUser.linkedin || '';
    document.getElementById('profile-job').value = currentUser.currentJob || '';
    document.getElementById('profile-bio').value = currentUser.bio || '';
}

// Sauvegarder le profil
async function saveAlumniProfile() {
    const name = document.getElementById('profile-name').value;
    const promo = document.getElementById('profile-promo').value;
    const filiere = document.getElementById('profile-filiere').value;
    const phone = document.getElementById('profile-phone').value;
    const whatsapp = document.getElementById('profile-whatsapp').value;

    const linkedin = document.getElementById('profile-linkedin').value;
    const job = document.getElementById('profile-job').value;
    const bio = document.getElementById('profile-bio').value;

    try {
        await usersRef.doc(currentUser.uid).update({
            // Ensure role is preserved just in case
            role: 'alumni',
            fullName: name,
            promo: promo,
            filiere: filiere,
            phone: phone,
            whatsapp: whatsapp,
            linkedin: linkedin,
            currentJob: job,
            bio: bio,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Mettre à jour l'objet local
        currentUser.fullName = name;
        currentUser.promo = promo;
        currentUser.filiere = filiere;
        currentUser.phone = phone;
        currentUser.whatsapp = whatsapp;
        currentUser.linkedin = linkedin;
        currentUser.currentJob = job;
        currentUser.bio = bio;

        // Update header name too
        document.getElementById('welcome-name').textContent = `Bonjour, ${currentUser.fullName}`;
        if (document.getElementById('user-display-name')) {
            document.getElementById('user-display-name').textContent = currentUser.fullName;
        }

        showSuccess('alumni-message', 'Profil mis à jour avec succès !');
    } catch (error) {
        console.error('Erreur sauvegarde profil:', error);
        showError('alumni-message', 'Erreur lors de la sauvegarde: ' + error.message);
    }
}

// Basculer entre les vues
async function showAlumniView(view) {
    const views = ['dashboard', 'events', 'mentor', 'profile', 'directory', 'notifications'];
    views.forEach(v => {
        const el = document.getElementById(`${v}-view`);
        if (el) el.classList.add('hidden');
    });

    // Mettre à jour l'état actif des onglets
    document.querySelectorAll('.nav-tab').forEach(item => {
        item.classList.remove('btn-primary');
        item.classList.add('btn-secondary');
        if (item.getAttribute('onclick').includes(`'${view}'`)) {
            item.classList.remove('btn-secondary');
            item.classList.add('btn-primary');
        }
    });

    const activeView = document.getElementById(`${view}-view`);
    if (activeView) activeView.classList.remove('hidden');

    if (view === 'events') loadEvents('events-list');
    if (view === 'mentor') {
        if (currentUser.mentorStatus === 'approved') {
            document.getElementById('mentor-request-section').classList.add('hidden');
            document.getElementById('mentor-active-dashboard').classList.remove('hidden');
            loadMentorDashboardData();
        } else {
            document.getElementById('mentor-request-section').classList.remove('hidden');
            document.getElementById('mentor-active-dashboard').classList.add('hidden');
            updateMentorStatusDisplay();
        }
    }
    if (view === 'directory' && typeof initDirectory === 'function') {
        await initDirectory();
    }
}

/**
 * Fonctions pour le rôle MENTOR
 */
// Charger les données du dashboard Mentor
async function loadMentorDashboardData() {
    console.log("Loading Mentor Data...");

    // Check Availability Toggle
    const toggle = document.getElementById('mentor-availability-toggle');
    if (toggle) {
        toggle.checked = currentUser.isAvailable !== false; // Default to true
        updateAvailabilityText(toggle.checked);
    }

    // Load Requests (Real Data Mock-up for now as we don't have the 'mentorship_requests' collection yet)
    // In a real app, we would query: db.collection('mentorship_requests').where('mentorId', '==', currentUser.uid).where('status', '==', 'pending')
    loadMockMentorData();
}

function updateAvailabilityText(isAvailable) {
    const text = document.getElementById('mentor-availability-text');
    if (isAvailable) {
        text.textContent = "Actif : Visible dans l'annuaire";
        text.style.color = "var(--success-color)";
    } else {
        text.textContent = "Inactif : Masqué pour le moment";
        text.style.color = "var(--text-secondary)";
    }
}

async function toggleMentorAvailability() {
    const toggle = document.getElementById('mentor-availability-toggle');
    const isAvailable = toggle.checked;
    updateAvailabilityText(isAvailable);

    try {
        await usersRef.doc(currentUser.uid).update({
            isAvailable: isAvailable
        });
        console.log("Availability updated:", isAvailable);
    } catch (e) {
        console.error("Error updating availability", e);
        // Revert UI on error
        toggle.checked = !isAvailable;
        updateAvailabilityText(!isAvailable);
    }
}

// Mock Data Loader for Demonstration
function loadMockMentorData() {
    const requestsList = document.getElementById('mentor-requests-list');
    const menteesList = document.getElementById('my-mentees-list');

    // Simulate Requests
    requestsList.innerHTML = `
        <div class="card bg-tertiary fade-in" style="display: flex; justify-content: space-between; align-items: center; padding: 10px; margin-bottom: 8px;">
            <div>
                <strong style="display: block;">Yassine (2BAC)</strong>
                <small style="color: var(--text-secondary);">Souhaite des conseils pour l'ENSA.</small>
            </div>
            <div class="flex gap-1">
                <button class="btn btn-success btn-small" onclick="alert('Fonctionnalité à venir: Accepter')">✅</button>
                <button class="btn btn-danger btn-small" onclick="alert('Fonctionnalité à venir: Refuser')">❌</button>
            </div>
        </div>
    `;
    document.getElementById('mentor-requests-count').textContent = "1 en attente";

    // Simulate Active Mentee
    menteesList.innerHTML = `
        <div class="card" style="border: 1px solid var(--border-color);">
            <div class="flex items-center gap-2 mb-1">
                <div style="width: 30px; height: 30px; background: var(--primary-color); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center;">S</div>
                <div>
                    <h4 style="font-size: 0.95rem; font-weight: 600;">Sara El Alami</h4>
                    <span class="badge badge-approved" style="font-size: 0.7rem;">Active</span>
                </div>
            </div>
            <div class="flex gap-1 mt-2">
                <button class="btn btn-secondary btn-small w-full" onclick="window.location.href='mailto:sara@student.com'">Message</button>
            </div>
        </div>
    `;
    document.getElementById('total-mentees-count').textContent = "1";
}


// Charger les événements depuis Firestore
// Charger les événements DEPRECATED -> Uses js/events.js now
// We keep this function name because existing dashboard onload might call it, but we redirect it.
// Actually, alumni-dashboard calls loadEvents() in init.
// But we should verify if 'events-list' id matches.
// In dashboard view, there is 'events-preview-list'.

// We need a small adapter to load the preview in Dashboard view
async function loadDashboardEventsPreview() {
    if (typeof loadEvents === 'function') {
        loadEvents('events-preview-list', true); // True for preview mode
    }
}

// Mettre à jour l'affichage du statut mentor
function updateMentorStatusDisplay() {
    const statusText = document.getElementById('mentor-status-text');
    const statusBox = document.getElementById('mentor-status-box');
    const actionBtn = document.getElementById('btn-mentor-action');
    const dashboardBtn = document.getElementById('btn-mentor-request');

    const status = currentUser.mentorStatus || 'none'; // 'none', 'pending', 'approved'

    switch (status) {
        case 'pending':
            statusText.textContent = "Statut : Demande en cours d'examen ⏳";
            statusBox.style.borderLeft = "4px solid var(--warning-color)";
            if (actionBtn) actionBtn.disabled = true;
            if (actionBtn) actionBtn.textContent = "Demande envoyée";
            if (dashboardBtn) dashboardBtn.disabled = true;
            if (dashboardBtn) dashboardBtn.textContent = "Demande en cours...";
            break;
        case 'approved':
            statusText.textContent = "Statut : Mentor Officiel ✅";
            statusBox.style.borderLeft = "4px solid var(--success-color)";
            if (actionBtn) actionBtn.classList.add('hidden');
            if (dashboardBtn) {
                dashboardBtn.classList.remove('btn-primary');
                dashboardBtn.classList.add('btn-success');
                dashboardBtn.textContent = "Vous êtes Mentor ✅";
                dashboardBtn.onclick = null;
            }
            break;
        default:
            statusText.textContent = "Statut : Non demandée";
            statusBox.style.borderLeft = "4px solid var(--border-color)";
    }
}

// Envoyer une demande pour devenir mentor
async function requestMentorRole() {
    if (currentUser.mentorStatus === 'pending' || currentUser.mentorStatus === 'approved') return;

    try {
        await usersRef.doc(currentUser.uid).update({
            mentorStatus: 'pending',
            mentorRequestDate: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Créer une demande formelle dans la collection 'requests'
        await db.collection('requests').add({
            userId: currentUser.uid,
            userName: currentUser.fullName,
            userRole: 'alumni',
            type: 'MENTOR_REQUEST',
            status: 'pending',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Mettre à jour l'objet local
        currentUser.mentorStatus = 'pending';
        updateMentorStatusDisplay();

        showSuccess('alumni-message', 'Votre demande de mentorat a été envoyée avec succès à l\'administrateur !');

    } catch (error) {
        console.error('Erreur demande mentor:', error);
        showError('alumni-message', 'Erreur lors de l\'envoi de la demande: ' + error.message);
    }
}

// Helpers messages (si non définis globalement)
function showSuccess(id, msg) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = `<div class="alert alert-success">${msg}</div>`;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 5000);
}

function showError(id, msg) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = `<div class="alert alert-error">${msg}</div>`;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 5000);
}

// --- Notifications System ---
// La logique des notifications est gérée centralement par js/notifications.js
// qui met à jour #notifications-feed et les badges/toasts globaux.
