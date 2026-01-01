// Shared Logic for Events
const eventsRef = db.collection('events');

/**
 * Load events into a container
 * @param {string} containerId - ID of the container element
 * @param {boolean} isPreview - If true, shows a simplified list (for dashboard widgets)
 */
async function loadEvents(containerId, isPreview = false) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!isPreview) {
        container.innerHTML = `
            <div class="card text-center" style="grid-column: span 3; padding: 40px;">
                <div class="loading"></div>
                <p style="margin-top: 10px; color: var(--text-secondary);">Chargement des événements...</p>
            </div>
        `;
    }

    try {
        const snapshot = await eventsRef.orderBy('date', 'desc').limit(20).get();

        if (snapshot.empty) {
            container.innerHTML = `
                <div class="card text-center" style="grid-column: span 3; padding: 20px;">
                   <p>Aucun événement à venir.</p>
                </div>
            `;
            return;
        }

        let html = '';
        snapshot.forEach(doc => {
            const event = doc.data();
            const date = event.date ? new Date(event.date.toDate()).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'Date à venir';

            if (isPreview) {
                html += `
                    <div style="border-bottom: 1px solid var(--border-color); padding: 10px 0;">
                        <strong style="display: block; font-size: 0.9rem;">${event.title}</strong>
                        <div class="flex" style="justify-content: space-between; font-size: 0.8rem; color: var(--text-secondary);">
                            <span>${event.type || 'Événement'}</span>
                            <span>${date}</span>
                        </div>
                    </div>
                `;
            } else {
                html += `
                    <div class="card event-card fade-in">
                        <div class="flex" style="justify-content: space-between; align-items: start; margin-bottom: 10px;">
                            <div class="badge" style="background: var(--bg-tertiary); color: var(--primary-color);">${event.type || 'Événement'}</div>
                            <span style="font-size: 0.85rem; color: var(--text-secondary);">📅 ${date}</span>
                        </div>
                        <h3 style="font-weight: 700; margin-bottom: 10px; font-size: 1.2rem;">${event.title}</h3>
                        <p style="font-size: 0.95rem; color: var(--text-secondary); margin-bottom: 15px; line-height: 1.5;">${event.description || ''}</p>
                        ${event.link ? `<a href="${event.link}" target="_blank" class="btn btn-secondary btn-small" style="width: 100%; justify-content: center;">En savoir plus</a>` : ''}
                    </div>
                `;
            }
        });

        container.innerHTML = html;

    } catch (error) {
        console.error("Error loading events:", error);
        container.innerHTML = `
            <div class="card text-center" style="grid-column: span 3;">
                <p class="text-error">Erreur de chargement des événements.</p>
            </div>
        `;
    }
}

// Export
window.loadEvents = loadEvents;
