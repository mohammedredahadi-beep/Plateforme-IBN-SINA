/**
 * Delegate Messaging System
 * Allows delegates to send messages to their filière students
 */

// Send message from delegate to their filière
async function sendDelegateMessage(e) {
    e.preventDefault();

    if (!currentUser || currentUser.role !== 'delegate') {
        alert('Action non autorisée.');
        return;
    }

    const title = document.getElementById('delegate-msg-title').value;
    const content = document.getElementById('delegate-msg-content').value;
    const priority = document.getElementById('delegate-msg-priority').value;

    if (!title || !content) {
        alert('Veuillez remplir tous les champs requis.');
        return;
    }

    // Get delegate's filière
    const delegateFiliereId = currentUser.filiereId;
    if (!delegateFiliereId) {
        alert('Erreur: Filière non trouvée. Contactez un administrateur.');
        return;
    }

    try {
        const messageData = {
            title: title,
            content: content,
            priority: priority,
            // Target only students in this delegate's filière
            target: 'filiere',
            targetFiliereId: delegateFiliereId,
            senderId: auth.currentUser.uid,
            senderName: currentUser.fullName,
            senderRole: 'delegate',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            readBy: []
        };

        // Save to Firestore (Platform Notification)
        await db.collection('messages').add(messageData);

        alert(`Message envoyé avec succès ! (Priorité: ${priority})`);
        document.getElementById('delegate-message-form').reset();
        // Reset priority/defaults
        document.getElementById('delegate-msg-priority').value = 'communicative';
        loadDelegateMessageHistory();
    } catch (error) {
        console.error('Erreur envoi message:', error);
        alert('Erreur lors de l\'envoi du message: ' + error.message);
    }
}

// Load delegate's message history
async function loadDelegateMessageHistory() {
    const container = document.getElementById('my-announcements-list');
    if (!container) return;

    try {
        const snapshot = await db.collection('messages')
            .where('senderId', '==', auth.currentUser.uid)
            .orderBy('createdAt', 'desc')
            .limit(20)
            .get();

        if (snapshot.empty) {
            container.innerHTML = '<p style="color: var(--text-secondary); text-align: center;">Vous n\'avez envoyé aucun message.</p>';
            return;
        }

        let html = '';
        snapshot.forEach(doc => {
            const data = doc.data();
            const date = data.createdAt ? new Date(data.createdAt.toDate()).toLocaleDateString('fr-FR', {
                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
            }) : 'N/A';

            const priorityBadge = data.priority === 'urgent' ? 'badge-rejected' :
                (data.priority === 'warning' ? 'badge-warning' : 'badge-approved');
            const priorityIcon = data.priority === 'urgent' ? '🚨' :
                (data.priority === 'warning' ? '⚠️' : '📢');

            html += `
                <div class="card" style="padding: 12px; margin-bottom: 10px; border-left: 4px solid var(--${data.priority === 'urgent' ? 'danger' : (data.priority === 'warning' ? 'warning' : 'primary')}-color);">
                    <div class="flex" style="justify-content: space-between; align-items: center; margin-bottom: 5px;">
                        <strong>${priorityIcon} ${data.title}</strong>
                        <div class="flex gap-1">
                            <span class="badge ${priorityBadge}">${data.priority || 'communicative'}</span>
                        </div>
                    </div>
                    <p style="font-size: 0.9rem; color: var(--text-secondary); margin: 5px 0;">${data.content}</p>
                    <div class="flex" style="justify-content: space-between; font-size: 0.8rem; color: var(--text-secondary); margin-top: 8px;">
                        <span>Envoyé le ${date}</span>
                        <span>Lu par: ${(data.readBy || []).length} personne(s)</span>
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;

    } catch (error) {
        console.error('Erreur chargement historique:', error);
        container.innerHTML = '<p class="text-error">Erreur de chargement.</p>';
    }
}

// Export functions
window.sendDelegateMessage = sendDelegateMessage;
window.loadDelegateMessageHistory = loadDelegateMessageHistory;
