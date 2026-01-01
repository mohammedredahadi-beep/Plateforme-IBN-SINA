// Logic for Delegate Announcements
const announcementsRef = db.collection('announcements');

// Initialize Announcements (for Student View)
async function initAnnouncementsValue() {
    console.log("Initializing Announcements...");
    await loadStudentAnnouncements();
}

/**
 * DELEGATE: Create a new announcement
 */
async function createAnnouncement(title, content, type, targetFiliereId) {
    if (!currentUser || currentUser.role !== 'delegate') {
        alert("Action non autorisée.");
        return;
    }

    try {
        await announcementsRef.add({
            title: title,
            content: content,
            type: type, // 'Info', 'Urgent', 'Warning'
            targetFiliereId: targetFiliereId || 'all',
            authorId: auth.currentUser.uid,
            authorName: currentUser.fullName,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        return { success: true };
    } catch (error) {
        console.error("Error creating announcement:", error);
        return { success: false, error: error };
    }
}

/**
 * DELEGATE: Load announcements created by me
 */
async function loadDelegateHistory() {
    const container = document.getElementById('my-announcements-list');
    if (!container) return;

    try {
        const snapshot = await announcementsRef
            .where('authorId', '==', auth.currentUser.uid)
            .orderBy('createdAt', 'desc')
            .get();

        if (snapshot.empty) {
            container.innerHTML = '<p style="color: var(--text-secondary); text-align: center;">Vous n\'avez publié aucune annonce.</p>';
            return;
        }

        let html = '';
        snapshot.forEach(doc => {
            const data = doc.data();
            const date = data.createdAt ? new Date(data.createdAt.toDate()).toLocaleDateString('fr-FR') : 'N/A';
            const badgeClass = data.type === 'Urgent' ? 'badge-rejected' : (data.type === 'Warning' ? 'badge-pending' : 'badge-approved');

            html += `
                <div class="card" style="padding: 10px; margin-bottom: 10px; border-left: 4px solid var(--${data.type === 'Urgent' ? 'danger' : 'primary'}-color);">
                    <div class="flex" style="justify-content: space-between;">
                        <strong>${data.title}</strong>
                        <span class="badge ${badgeClass}">${data.type}</span>
                    </div>
                    <p style="font-size: 0.9rem; color: var(--text-secondary); margin: 5px 0;">${data.content}</p>
                    <small style="color: var(--text-secondary);">Publié le ${date} • Cible: ${data.targetFiliereId === 'all' ? 'Tous' : 'Ma Filière'}</small>
                </div>
            `;
        });
        container.innerHTML = html;

    } catch (error) {
        console.error("Error loading history:", error);
        container.innerHTML = '<p class="text-error">Erreur de chargement.</p>';
    }
}

/**
 * STUDENT: Load relevant announcements
 */
async function loadStudentAnnouncements() {
    const container = document.getElementById('announcements-feed');
    if (!container) return;

    if (!document.getElementById('announcements-section')) return;

    try {
        // Simple global fetch for MVP (client-side filtering for complex targeting if needed)
        // Ideally we query: where('targetFiliereId', 'in', ['all', user.filiereId])
        // But we don't always have user.filiereId easily accessible in 'currentUser' object without extra fetch
        // So we'll fetch 'all' and if we can, filtered ones. 
        // For MVP: Fetch ALL and filter in JS if needed, or just fetch 'all' public ones.

        const snapshot = await announcementsRef.orderBy('createdAt', 'desc').limit(5).get();

        if (snapshot.empty) {
            document.getElementById('announcements-section').classList.add('hidden');
            return;
        }

        let html = '';
        let count = 0;

        snapshot.forEach(doc => {
            const data = doc.data();

            // Filter: Show if target is 'all' OR target matches one of the user's requests (complicated)
            // Simpler: Show 'all'. 
            // If we want specific filiere, we need to know student's approved filiere.
            // Let's assume for now we show Global announcements + those matching the filiere logic we might implement later.

            if (count >= 3) return; // Limit to 3

            const date = data.createdAt ? new Date(data.createdAt.toDate()).toLocaleDateString('fr-FR') : '';
            let icon = '📢';
            let color = 'var(--primary-color)';
            let bg = 'var(--bg-secondary)';

            if (data.type === 'Urgent') { icon = '🚨'; color = 'var(--danger-color)'; bg = 'rgba(239, 68, 68, 0.1)'; }
            if (data.type === 'Warning') { icon = '⚠️'; color = 'var(--warning-color)'; bg = 'rgba(245, 158, 11, 0.1)'; }

            html += `
                <div style="background: ${bg}; border-left: 4px solid ${color}; padding: 10px 15px; border-radius: 6px; margin-bottom: 10px;">
                    <div class="flex" style="justify-content: space-between; margin-bottom: 5px;">
                        <strong style="color: var(--text-main); font-size: 0.95rem;">${icon} ${data.title}</strong>
                        <span style="font-size: 0.75rem; color: var(--text-secondary);">${date}</span>
                    </div>
                    <p style="font-size: 0.9rem; color: var(--text-main); margin: 0;">${data.content}</p>
                    <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 5px;">Par ${data.authorName}</div>
                </div>
            `;
            count++;
        });

        if (count > 0) {
            container.innerHTML = html;
            document.getElementById('announcements-section').classList.remove('hidden');
        } else {
            document.getElementById('announcements-section').classList.add('hidden');
        }

    } catch (error) {
        console.error("Error loading announcements:", error);
    }
}

// Exports
window.createAnnouncement = createAnnouncement;
window.loadDelegateHistory = loadDelegateHistory;
window.initAnnouncementsValue = initAnnouncementsValue;
