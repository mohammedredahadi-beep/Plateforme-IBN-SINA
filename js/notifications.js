/**
 * Notifications Management
 */

// Global Configuration (Default)
if (!window.SYSTEM_CONFIG) {
    window.SYSTEM_CONFIG = {
        messageDuration: 24 // hours
    };
}

let notificationListenerUnsubscribe = null;

// Initialize the Notification System (Background Listener for badges)
async function initNotificationSystem() {
    console.log("Initializing Notification System (Badges & Alerts)...");

    // Load config from Firestore if exists
    try {
        const configDoc = await db.collection('system').doc('config').get();
        if (configDoc.exists) {
            const data = configDoc.data();
            if (data.messageDuration) {
                window.SYSTEM_CONFIG.messageDuration = Number(data.messageDuration);
            }
        }
    } catch (e) {
        console.warn("Could not load system config, using defaults:", e);
    }

    startNotificationListener();
}

// Start Real-time Listener
function startNotificationListener() {
    if (notificationListenerUnsubscribe) return; // Already running
    if (!auth.currentUser) return;

    try {
        // Query recent messages
        notificationListenerUnsubscribe = db.collection('messages')
            .orderBy('createdAt', 'desc')
            .limit(50) // Check last 50 messages
            .onSnapshot(snapshot => {
                let unreadCount = 0;
                const messages = [];
                const userId = auth.currentUser.uid;
                const userRole = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.role : null;
                const userFiliere = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.filiereId : null;

                snapshot.forEach(doc => {
                    const data = doc.data();

                    // 1. Check Relevance
                    let isRelevant = checkMessageRelevance(data, userId, userRole, userFiliere);

                    if (isRelevant) {
                        // 2. Check Expiration (Auto-disappear logic)
                        if (!isMessageExpired(data, userId)) {
                            // 3. Check if Unread
                            if (!data.readBy || !data.readBy.includes(userId)) {
                                unreadCount++;
                            }
                            messages.push({ id: doc.id, ...data });
                        }
                    }
                });

                updateGlobalNotificationsUI(unreadCount);

                // If we are currently viewing the feed, refresh it
                const feedContainer = document.getElementById('notifications-feed');
                if (feedContainer && !feedContainer.classList.contains('hidden')) {
                    renderNotificationsFeed(messages, userId);
                }

            }, error => {
                console.error("Notification Listener Error:", error);
            });
    } catch (e) {
        console.error("Error starting notification listener:", e);
    }
}

// Check if message is relevant for current user
function checkMessageRelevance(data, userId, role, filiereId) {
    const target = data.target || 'all';

    if (data.individualUserIds && data.individualUserIds.includes(userId)) return true;
    if (target === 'all') return true;
    if (target === 'custom' && data.individualUserIds && data.individualUserIds.includes(userId)) return true;

    if (role) {
        if (role === 'student' && (target === 'students' || target === 'student')) return true;
        if (role === 'alumni' && (target === 'alumni' || target === 'alumnis')) return true;
        if (role === 'delegate' && (target === 'delegates' || target === 'delegate')) return true;
        if (role === 'admin' && (target === 'admins' || target === 'admin')) return true;
    }

    if (target === 'filiere' && data.targetFiliereId && filiereId && data.targetFiliereId === filiereId) return true;

    return false;
}

// Check if message is expired (read > X hours ago)
function isMessageExpired(data, userId) {
    const readByWithTime = data.readByWithTime || {};
    const userReadTime = readByWithTime[userId];

    if (userReadTime && userReadTime.toDate) {
        const readTimestamp = userReadTime.toDate().getTime();
        const now = new Date().getTime();
        const hoursSinceRead = (now - readTimestamp) / (1000 * 60 * 60);

        // Use message-specific duration if available, otherwise global config
        const maxDuration = (data.durationHours !== undefined) ?
            Number(data.durationHours) :
            window.SYSTEM_CONFIG.messageDuration;

        if (hoursSinceRead > maxDuration) {
            return true; // Expired
        }
    }
    return false;
}

// Update Badges and Icons
function updateGlobalNotificationsUI(count) {
    // 1. Sidebar Badge
    const badge = document.getElementById('sidebar-badge-notif');
    if (badge) {
        badge.textContent = count;
        if (count > 0) {
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }

    // 2. Bell Icon Blinking (Sidebar Link)
    // 2. Bell Icon Blinking (Sidebar Link)
    // Only animate if the badge element exists (allows disabling via HTML)
    if (badge) {
        const notifLink = document.querySelector('a[data-view="notifications"]');
        if (notifLink) {
            if (count > 0) {
                notifLink.classList.add('pulse-text');
                notifLink.style.color = 'var(--warning)';
                notifLink.style.fontWeight = '700';
            } else {
                notifLink.classList.remove('pulse-text');
                notifLink.style.color = '';
                notifLink.style.fontWeight = '';
            }
        }
    }

    // 3. Fallback for other Bell Icons (Header etc)
    const bellIcons = document.querySelectorAll('.fa-bell, .notif-bell-icon');
    bellIcons.forEach(icon => {
        if (count > 0) {
            icon.classList.add('pulse-red');
            icon.style.color = 'var(--danger)';
        } else {
            icon.classList.remove('pulse-red');
            icon.style.color = 'inherit';
        }
    });
}

// Main View Function (Called when user clicks "Notifications")
async function initNotificationsView() {
    console.log("Refreshing Notifications Feed...");
    // The listener handles the data fetching now, so we just ensure the listener is active
    if (!notificationListenerUnsubscribe) {
        await initNotificationSystem();
    }
    // We can also trigger a manual render if we have the data, but the listener does it
}

// Render the list of messages
function renderNotificationsFeed(messages, userId) {
    const container = document.getElementById('notifications-feed');
    if (!container) return;

    if (messages.length === 0) {
        container.innerHTML = '<div class="card text-center"><p>Aucune notification pour le moment.</p></div>';
        return;
    }

    const isAdmin = (typeof currentUser !== 'undefined' && currentUser && currentUser.role === 'admin') ||
        (auth.currentUser && typeof allUsers !== 'undefined' && allUsers.some(u => u.uid === auth.currentUser.uid && u.role === 'admin'));

    let html = '';
    messages.forEach(msg => {
        // Calculate style based on Read status
        const isRead = msg.readBy && msg.readBy.includes(userId);
        const badge = !isRead ? '<span class="badge" style="background:var(--danger); color:white; font-size: 0.7em; margin-left: 5px;">Nouveau</span>' : '';
        const style = !isRead ? 'border-left: 4px solid var(--danger); background: rgba(239, 68, 68, 0.05);' : 'border-left: 4px solid transparent; opacity: 0.8;';

        const dateStr = msg.createdAt && msg.createdAt.toDate ?
            msg.createdAt.toDate().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

        // Priority
        const priorityIcon = msg.priority === 'urgent' ? '🚨 ' : (msg.priority === 'important' ? '⚠️ ' : '');

        // Admin Actions
        let adminActions = '';
        if (isAdmin) {
            adminActions = `
                <div class="flex gap-1" style="margin-left: 10px;">
                    <button class="btn btn-small btn-secondary" style="padding: 2px 8px;" onclick="openEditNotificationModal('${msg.id}'); event.stopPropagation();">✏️</button>
                    <button class="btn btn-small btn-danger" style="padding: 2px 8px;" onclick="deleteNotification('${msg.id}'); event.stopPropagation();">🗑️</button>
                </div>
            `;
        }

        html += `
        <div class="card fade-in" style="${style} margin-bottom: 10px; cursor: pointer; transition: 0.2s;" onclick="markAsRead('${msg.id}')">
            <div class="flex" style="justify-content: space-between; align-items: start; margin-bottom: 5px;">
                <div class="flex" style="align-items: center; flex: 1;">
                    <h4 style="margin:0; font-size:1rem; font-weight:600;">${priorityIcon}${msg.title} ${badge}</h4>
                </div>
                <div class="flex" style="align-items: center;">
                    <small style="color:var(--text-secondary); white-space: nowrap;">${dateStr}</small>
                    ${adminActions}
                </div>
            </div>
            <p style="margin: 5px 0; color:var(--text-primary); font-size: 0.95rem;">${msg.content}</p>
            <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 8px;">
                Par: ${msg.senderName || 'Système'}
            </div>
        </div>`;
    });

    container.innerHTML = html;
}

// --- Admin Notification Actions ---

async function deleteNotification(id) {
    if (!confirm("Voulez-vous vraiment supprimer cette notification ?")) return;
    try {
        await db.collection('messages').doc(id).delete();
        showSuccess ? showSuccess('admin-message', 'Notification supprimée.') : alert('Notification supprimée.');
        // UI updates automatically via listener
    } catch (e) {
        console.error("Error deleting notification:", e);
        showError ? showError('admin-message', 'Erreur lors de la suppression.') : alert('Erreur suppression.');
    }
}

let currentEditingNotifId = null;

async function openEditNotificationModal(id) {
    if (!id) return;
    currentEditingNotifId = id;

    const modal = document.getElementById('edit-notification-modal');
    if (!modal) return; // Only exists in admin dashboard
    const form = document.getElementById('edit-notification-form');

    form.reset();

    try {
        const doc = await db.collection('messages').doc(id).get();
        if (!doc.exists) {
            alert("La notification n'existe plus.");
            return;
        }

        const data = doc.data();

        document.getElementById('edit-notif-id').value = id;
        document.getElementById('edit-notif-title').value = data.title || '';
        document.getElementById('edit-notif-priority').value = data.priority || 'communicative';
        document.getElementById('edit-notif-content').value = data.content || '';

        modal.classList.remove('hidden');

    } catch (e) {
        console.error("Error fetching notification details:", e);
        alert("Erreur lors du chargement.");
    }
}

function closeEditNotificationModal() {
    const modal = document.getElementById('edit-notification-modal');
    if (modal) modal.classList.add('hidden');
    currentEditingNotifId = null;
}

async function updateNotification(e) {
    e.preventDefault();
    if (!currentEditingNotifId) return;

    const title = document.getElementById('edit-notif-title').value;
    const priority = document.getElementById('edit-notif-priority').value;
    const content = document.getElementById('edit-notif-content').value;

    try {
        await db.collection('messages').doc(currentEditingNotifId).update({
            title,
            priority,
            content,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        closeEditNotificationModal();
        if (typeof showSuccess !== 'undefined') showSuccess('admin-message', 'Notification mise à jour !');

    } catch (error) {
        console.error("Error updating notification:", error);
        if (typeof showError !== 'undefined') showError('admin-message', 'Erreur lors de la mise à jour.');
    }
}

async function markAsRead(id) {
    if (!auth.currentUser) return;
    try {
        await db.collection('messages').doc(id).update({
            [`readByWithTime.${auth.currentUser.uid}`]: firebase.firestore.FieldValue.serverTimestamp(),
            readBy: firebase.firestore.FieldValue.arrayUnion(auth.currentUser.uid)
        });
        // Listener will update UI automatically
    } catch (e) {
        console.error("Mark read error:", e);
    }
}

// Export functions globally
window.initNotificationsView = initNotificationsView;
window.initNotificationSystem = initNotificationSystem;
window.markAsRead = markAsRead;
window.deleteNotification = deleteNotification;
window.openEditNotificationModal = openEditNotificationModal;
window.closeEditNotificationModal = closeEditNotificationModal;
window.updateNotification = updateNotification;
