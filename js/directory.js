// Logic for Alumni Directory
const directoryRef = db.collection('users');
let directoryList = []; // Store list for modal access

// Initialize Directory
async function initDirectory() {
    console.log("Initializing Directory...");

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
        let query = directoryRef.where('role', '==', 'alumni');

        const snapshot = await query.get();

        if (snapshot.empty) {
            container.innerHTML = `
                <div class="card text-center" style="grid-column: span 3; padding: 40px;">
                   <p>Aucun ancien trouvé.</p>
                </div>
            `;
            directoryList = [];
            return;
        }

        let alumni = [];
        snapshot.forEach(doc => {
            alumni.push({ id: doc.id, ...doc.data() });
        });

        // Update global list
        directoryList = alumni;

        // Client-side Filtering
        if (filiereFilter !== 'all') {
            alumni = alumni.filter(a => a.filiere === filiereFilter || (a.filiere && a.filiere.id === filiereFilter));
        }

        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            alumni = alumni.filter(a =>
                (a.fullName && a.fullName.toLowerCase().includes(lowerTerm)) ||
                (a.currentJob && a.currentJob.toLowerCase().includes(lowerTerm)) ||
                (a.motivation && a.motivation.toLowerCase().includes(lowerTerm))
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
        const initials = user.fullName ? user.fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : '??';
        const job = user.currentJob || user.motivation || "Non renseigné";
        const filiere = user.filiere || 'Filière inconnue';

        // We use INLINE ONCLICK to be absolutely sure it fires
        html += `
            <div class="card directory-card fade-in"
                 onclick="openAlumniModal('${user.id}')"
                 style="display: flex; gap: 15px; align-items: start; cursor: pointer; transition: transform 0.2s;">
                 <div style="width: 50px; height: 50px; border-radius: 50%; background: var(--primary-color); color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; flex-shrink: 0;">
                    ${initials}
                </div>
                <div style="flex: 1;">
                    <h4 style="font-weight: 600; font-size: 1rem; color: var(--text-main); margin-bottom: 2px;">${user.fullName}</h4>
                    <span class="badge" style="font-size: 0.7em; background: var(--bg-secondary); color: var(--text-secondary); margin-bottom: 5px; display: inline-block;">${filiere}</span>
                    <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 10px; line-height: 1.4;">
                        ${job.substring(0, 50)}${job.length > 50 ? '...' : ''}
                    </p>
                    <div class="flex gap-1">
                        <button class="btn btn-secondary btn-small"
                            onclick="event.stopPropagation(); openAlumniModal('${user.id}')"
                            style="font-size: 0.75rem;">Voir Profil</button>
                    </div>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

// Modal Logic
// Modal Logic
function openAlumniModal(userId) {
    console.log("LOG: openAlumniModal triggered for:", userId);

    try {
        const modal = document.getElementById('alumni-modal');
        if (!modal) {
            console.error("CRITICAL: Modal element #alumni-modal not found!");
            return;
        }

        // TEST MODE
        if (userId === 'test-open') {
            const mbName = document.getElementById('modal-name');
            if (mbName) mbName.textContent = "Test Modal Fonctionnel";

            const mbJob = document.getElementById('modal-job');
            if (mbJob) mbJob.textContent = "Si vous voyez ceci, la modale fonctionne.";

            const mbParcours = document.getElementById('modal-parcours');
            if (mbParcours) mbParcours.innerHTML = "Ceci est un test manuel. Le bouton Voir Profil fonctionne.";

            modal.classList.remove('hidden');
            modal.style.display = 'flex';
            return;
        }

        // Normal Mode
        const user = directoryList.find(u => u.id === userId);

        if (!user) {
            console.error("User ID not found in list:", userId);
            return;
        }

        // Fill Modal Data
        const initials = user.fullName ? user.fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : '??';

        if (document.getElementById('modal-avatar')) document.getElementById('modal-avatar').textContent = initials;
        if (document.getElementById('modal-name')) document.getElementById('modal-name').textContent = user.fullName || "Inconnu";
        if (document.getElementById('modal-job')) document.getElementById('modal-job').textContent = user.currentJob || user.motivation || "Poste non renseigné";

        if (document.getElementById('modal-filiere')) document.getElementById('modal-filiere').textContent = user.filiere || "Non renseignée";
        if (document.getElementById('modal-promo')) document.getElementById('modal-promo').textContent = user.promo || "Non renseignée";

        const bioContent = user.bio ? user.bio.replace(/\n/g, '<br>') : "Aucune information sur le parcours.";
        if (document.getElementById('modal-parcours')) document.getElementById('modal-parcours').innerHTML = bioContent;

        // Buttons
        const btnLink = document.getElementById('btn-linkedin');
        if (btnLink) {
            btnLink.style.display = user.linkedin ? 'flex' : 'none';
            if (user.linkedin) btnLink.href = user.linkedin;
        }

        const btnWa = document.getElementById('btn-whatsapp');
        if (btnWa) {
            const wa = user.whatsapp || user.phone;
            btnWa.style.display = wa ? 'flex' : 'none';
            if (wa) btnWa.href = `https://wa.me/${wa.replace(/[^\d]/g, '')}`;
        }

        const btnMail = document.getElementById('btn-email');
        if (btnMail) {
            btnMail.style.display = user.email ? 'flex' : 'none';
            if (user.email) btnMail.href = `mailto:${user.email}`;
        }

        // Show Modal
        modal.classList.remove('hidden');
        modal.classList.add('active');
        modal.style.display = 'flex';
        console.log("Modal opened successfully for:", user.fullName);

    } catch (e) {
        console.error("CRITICAL ERROR in openAlumniModal:", e);
    }
}

function closeAlumniModal() {
    const modal = document.getElementById('alumni-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }
}

// Event Listeners for search inputs
function handleDirectorySearch() {
    const search = document.getElementById('dir-search').value;
    const filiere = document.getElementById('dir-filiere').value;
    loadDirectory(filiere, search);
}

// Exports
window.initDirectory = initDirectory;
window.loadDirectory = loadDirectory;
window.handleDirectorySearch = handleDirectorySearch;
window.openAlumniModal = openAlumniModal;
window.closeAlumniModal = closeAlumniModal;

// Close modal when clicking outside
document.addEventListener('click', (e) => {
    const modal = document.getElementById('alumni-modal');
    // Check if modal exists and is NOT hidden
    if (modal && !modal.classList.contains('hidden')) {
        // If click is ON the modal background (container) but NOT inside modal-content
        if (e.target === modal) {
            closeAlumniModal();
        }
    }
});
