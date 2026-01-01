// Logic for Alumni Directory
const directoryRef = db.collection('users');

// Initialize Directory
async function initDirectory() {
    console.log("Initializing Directory...");
    // Load default: all alumni
    await loadDirectory();
}

/**
 * Load alumni directory with optional filters
 */
async function loadDirectory(filiereFilter = 'all', searchTerm = '') {
    const container = document.getElementById('directory-grid');
    if (!container) return;

    container.innerHTML = `
        <div class="card text-center" style="grid-column: span 3; padding: 40px;">
            <div class="loading"></div>
            <p style="margin-top: 10px; color: var(--text-secondary);">Recherche des anciens...</p>
        </div>
    `;

    try {
        // Base query: All users with role 'alumni'
        // Firestore filtering is limited, so we'll fetch all alumni and filter client-side for search/complex logic
        // For production with thousands of users, this would need a specialized search service (Algolia/Typesense)

        let query = directoryRef.where('role', '==', 'alumni');

        const snapshot = await query.get();

        if (snapshot.empty) {
            container.innerHTML = `
                <div class="card text-center" style="grid-column: span 3; padding: 40px;">
                   <p>Aucun ancien trouvé.</p>
                </div>
            `;
            return;
        }

        let alumni = [];
        snapshot.forEach(doc => {
            alumni.push({ id: doc.id, ...doc.data() });
        });

        // Client-side Filtering
        if (filiereFilter !== 'all') {
            alumni = alumni.filter(a => a.filiere === filiereFilter || (a.filiere && a.filiere.id === filiereFilter));
            // Note: 'filiere' field might vary depending on how it was saved (ID string or object). 
            // Assuming string ID or Name for now based on 'signup'.
        }

        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            alumni = alumni.filter(a =>
                (a.fullName && a.fullName.toLowerCase().includes(lowerTerm)) ||
                (a.motivation && a.motivation.toLowerCase().includes(lowerTerm)) // motivation often holds "Job/Studies" info for alumni
            );
        }

        renderDirectory(alumni, container);

    } catch (error) {
        console.error("Error loading directory:", error);
        container.innerHTML = `
            <div class="card text-center" style="grid-column: span 3;">
                <p class="text-error">Erreur de chargement de l'annuaire.</p>
            </div>
        `;
    }
}

function renderDirectory(alumniList, container) {
    if (alumniList.length === 0) {
        container.innerHTML = `
            <div class="card text-center" style="grid-column: span 3; padding: 40px;">
               <div style="font-size: 3rem; margin-bottom: 15px; opacity: 0.5;">🔍</div>
               <p>Aucun résultat pour cette recherche.</p>
            </div>
        `;
        return;
    }

    let html = '';
    alumniList.forEach(user => {
        const initials = user.fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        const job = user.motivation || "Non renseigné"; // Re-using motivation field as 'Current Status' for MVP

        html += `
            <div class="card directory-card fade-in" style="display: flex; gap: 15px; align-items: start;">
                 <div style="width: 50px; height: 50px; border-radius: 50%; background: var(--primary-color); color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; flex-shrink: 0;">
                    ${initials}
                </div>
                <div style="flex: 1;">
                    <h4 style="font-weight: 600; font-size: 1rem; color: var(--text-main); margin-bottom: 2px;">${user.fullName}</h4>
                    <span class="badge" style="font-size: 0.7em; background: var(--bg-secondary); color: var(--text-secondary); margin-bottom: 5px; display: inline-block;">${user.filiere || 'Filière inconnue'}</span>
                    <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 10px; line-height: 1.4;">
                        ${job.substring(0, 60)}${job.length > 60 ? '...' : ''}
                    </p>
                    <div class="flex gap-1">
                        <button class="btn btn-secondary btn-small" onclick="window.location.href='mailto:${user.email}'">✉️ Contacter</button>
                    </div>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

// Event Listeners for search inputs (to be attached in HTML)
function handleDirectorySearch() {
    const search = document.getElementById('dir-search').value;
    const filiere = document.getElementById('dir-filiere').value;
    loadDirectory(filiere, search);
}

// Exports
window.initDirectory = initDirectory;
window.loadDirectory = loadDirectory;
window.handleDirectorySearch = handleDirectorySearch;
