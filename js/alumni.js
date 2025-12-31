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
        loadEvents();
        updateMentorStatusDisplay();
    }
});

// Afficher les infos du lauréat
function displayAlumniInfo() {
    document.getElementById('welcome-name').textContent = `Bonjour, ${currentUser.fullName}`;

    // Remplir la vue profil
    document.getElementById('profile-name').value = currentUser.fullName;
    document.getElementById('profile-email').value = currentUser.email;
    document.getElementById('profile-promo').value = `Promo ${currentUser.promo || 'N/A'}`;
    document.getElementById('profile-phone').value = currentUser.phone || 'N/A';
}

// Basculer entre les vues
function showAlumniView(view) {
    const views = ['dashboard', 'events', 'mentor', 'profile'];
    views.forEach(v => {
        const el = document.getElementById(`${v}-view`);
        if (el) el.classList.add('hidden');
    });

    // Mettre à jour l'état actif dans la sidebar
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('onclick').includes(view)) {
            item.classList.add('active');
        }
    });

    const activeView = document.getElementById(`${view}-view`);
    if (activeView) activeView.classList.remove('hidden');

    if (view === 'events') loadEvents();
    if (view === 'mentor') updateMentorStatusDisplay();
}

// Charger les événements depuis Firestore
async function loadEvents() {
    const eventsList = document.getElementById('events-list');
    const eventsPreview = document.getElementById('events-preview-list');

    try {
        // Supposons une collection 'events' gérée par l'admin
        const snapshot = await db.collection('events').orderBy('date', 'asc').limit(10).get();

        if (snapshot.empty) {
            const emptyMsg = '<p style="color: var(--text-light);">Aucun événement prévu pour le moment.</p>';
            if (eventsList) eventsList.innerHTML = emptyMsg;
            if (eventsPreview) eventsPreview.innerHTML = emptyMsg;
            return;
        }

        let html = '';
        snapshot.forEach(doc => {
            const event = doc.data();
            const eventDate = event.date ? new Date(event.date.toDate()).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'Date à venir';

            html += `
                <div class="card event-card fade-in">
                    <div class="badge" style="background: var(--bg-tertiary); color: var(--primary-color); margin-bottom: 10px;">${event.type || 'Événement'}</div>
                    <h4 style="font-weight: 700; margin-bottom: 8px;">${event.title}</h4>
                    <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 12px;">📅 ${eventDate}</p>
                    <p style="font-size: 0.9rem; margin-bottom: 15px;">${event.description || ''}</p>
                    ${event.link ? `<a href="${event.link}" target="_blank" class="btn btn-secondary btn-small">En savoir plus</a>` : ''}
                </div>
            `;
        });

        if (eventsList) eventsList.innerHTML = html;
        if (eventsPreview) {
            // Pour la prévieuw, on prend juste les 2 premiers
            const previewSnapshot = snapshot.docs.slice(0, 2);
            let previewHtml = '';
            previewSnapshot.forEach(doc => {
                const event = doc.data();
                previewHtml += `
                    <div style="border-bottom: 1px solid var(--border-color); padding: 10px 0;">
                        <strong style="display: block; font-size: 0.9rem;">${event.title}</strong>
                        <small style="color: var(--text-secondary);">${event.type || 'Conférence'}</small>
                    </div>
                `;
            });
            eventsPreview.innerHTML = previewHtml;
        }

    } catch (error) {
        console.error('Erreur chargement événements:', error);
        const errMsg = '<p class="text-error">Impossible de charger les événements.</p>';
        if (eventsList) eventsList.innerHTML = errMsg;
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
        showError('alumni-message', 'Erreur lors de l\'envoi de la demande.');
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
