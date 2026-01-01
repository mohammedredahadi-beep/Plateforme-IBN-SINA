// Logique pour le dashboard des Lauréats (Alumni)

let currentUser = null;

// Initialisation
document.addEventListener('DOMContentLoaded', async () => {
    currentUser = await checkAuthAndRedirect();

    // Sécurité supplémentaire : vérifier le rôle
    if (currentUser && currentUser.role !== 'alumni') {
        redirectByRole(currentUser.role);
        return;
    }

    if (currentUser) {
        displayAlumniInfo();
        loadDashboardEventsPreview();
        updateMentorStatusDisplay();

        // Initialiser les notifications
        if (typeof initNotifications === 'function') {
            initNotifications();
        }
    }
});

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
    const views = ['dashboard', 'events', 'mentor', 'profile', 'directory'];
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
    if (view === 'mentor') updateMentorStatusDisplay();
    if (view === 'directory' && typeof initDirectory === 'function') {
        await initDirectory();
    }
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

        // Créer aussi une alerte pour l'admin
        await db.collection('support_alerts').add({
            userId: currentUser.uid,
            userName: currentUser.fullName,
            userRole: 'alumni',
            message: `Demande de mentorat : Je souhaite devenir mentor pour aider les étudiants d'Ibn Sina.`,
            status: 'new',
            type: 'MENTOR_REQUEST',
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
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

let allMessages = [];
let unreadCount = 0;

async function initNotifications() {
    // Listen for messages
    db.collection('messages')
        .orderBy('createdAt', 'desc')
        .limit(20) // Limit to last 20 messages
        .onSnapshot(snapshot => {
            allMessages = [];
            const readMessages = JSON.parse(localStorage.getItem('readMessages') || '[]');
            unreadCount = 0;

            snapshot.forEach(doc => {
                const msg = doc.data();
                const isTarget = msg.target === 'all' ||
                    msg.target === 'alumni';

                if (isTarget) {
                    msg.id = doc.id;
                    allMessages.push(msg);
                    if (!readMessages.includes(doc.id)) {
                        unreadCount++;
                    }
                }
            });

            updateNotificationUI();
        }, error => {
            console.error("Erreur notifications:", error);
        });
}

function updateNotificationUI() {
    const badge = document.getElementById('notif-badge');
    const list = document.getElementById('notif-list');

    if (unreadCount > 0) {
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }

    if (allMessages.length === 0) {
        if (list) list.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-secondary); font-size: 0.85rem;">Aucune notification</div>';
        return;
    }

    let html = '';
    const readMessages = JSON.parse(localStorage.getItem('readMessages') || '[]');

    allMessages.forEach(msg => {
        const isRead = readMessages.includes(msg.id);
        let dateStr = 'Date inconnue';
        if (msg.createdAt) {
            const d = msg.createdAt.toDate();
            dateStr = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
        }

        html += `
            <div class="notification-item" style="padding: 15px; border-bottom: 1px solid var(--border-color); background: ${!isRead ? 'rgba(37, 99, 235, 0.05)' : 'transparent'}; transition: background 0.2s;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                    <div style="font-weight: 600; font-size: 0.9rem; color: var(--text-primary);">${msg.title || 'Message'}</div>
                    ${!isRead ? '<span style="width: 8px; height: 8px; background: var(--primary-color); border-radius: 50%;"></span>' : ''}
                </div>
                <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 5px; line-height: 1.4;">${msg.content}</div>
                <div style="font-size: 0.75rem; color: var(--text-light); text-align: right;">${dateStr}</div>
            </div>
        `;
    });

    if (list) list.innerHTML = html;
}

function toggleNotifications() {
    const panel = document.getElementById('notification-panel');
    if (panel) {
        panel.classList.toggle('hidden');
    }
}

function markAllRead() {
    const readMessages = JSON.parse(localStorage.getItem('readMessages') || '[]');
    allMessages.forEach(msg => {
        if (!readMessages.includes(msg.id)) {
            readMessages.push(msg.id);
        }
    });
    localStorage.setItem('readMessages', JSON.stringify(readMessages));
    unreadCount = 0;
    updateNotificationUI();
}
