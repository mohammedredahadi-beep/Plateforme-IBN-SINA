// Logic for Alumni Directory
const directoryRef = db.collection('users');
let directoryList = []; // Store list for modal access

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
                (a.currentJob && a.currentJob.toLowerCase().includes(lowerTerm)) || // Check 'currentJob'
                (a.motivation && a.motivation.toLowerCase().includes(lowerTerm)) // Legacy check
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

        // Card is clickable to open modal
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
                        <span class="btn btn-secondary btn-small" style="font-size: 0.75rem;">Voir Profil</span>
                    </div>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

// Modal Logic
function openAlumniModal(userId) {
    const user = directoryList.find(u => u.id === userId);
    if (!user) return;

    // Fill Modal
    const initials = user.fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    document.getElementById('modal-avatar').textContent = initials;
    document.getElementById('modal-name').textContent = user.fullName;
    document.getElementById('modal-job').textContent = user.currentJob || user.motivation || "Poste non renseigné";

    document.getElementById('modal-filiere').textContent = user.filiere || "Non renseignée";
    document.getElementById('modal-promo').textContent = user.promo || "Non renseignée";
    document.getElementById('modal-parcours').innerHTML = user.bio ? user.bio.replace(/\n/g, '<br>') : "Aucune information sur le parcours.";

    // Contact Buttons
    const btnLinkedin = document.getElementById('btn-linkedin');
    const btnWhatsapp = document.getElementById('btn-whatsapp');
    const btnEmail = document.getElementById('btn-email');

    // LinkedIn
    if (user.linkedin) {
        btnLinkedin.href = user.linkedin;
        btnLinkedin.classList.remove('hidden');
        btnLinkedin.style.display = 'flex'; // Restore if hidden
    } else {
        btnLinkedin.style.display = 'none';
    }

    // WhatsApp / Phone
    // Use whatsapp field if available, else fallback to phone if it looks like mobile? 
    // User requested "contact via whatssap".
    const waNumber = user.whatsapp || user.phone;
    if (waNumber) {
        // Clean number for WA link: remove spaces, ensure it has country code if possible. 
        // Assuming user enters +212...
        const cleanVal = waNumber.replace(/[^\d+]/g, '');
        btnWhatsapp.href = `https://wa.me/${cleanVal}`;
        btnWhatsapp.style.display = 'flex';
    } else {
        btnWhatsapp.style.display = 'none';
    }

    // Email
    if (user.email) {
        btnEmail.href = `mailto:${user.email}`;
        btnEmail.style.display = 'flex';
    } else {
        btnEmail.style.display = 'none'; // Unlikely
    }

    // Show Modal
    document.getElementById('alumni-modal').classList.remove('hidden');
    document.getElementById('alumni-modal').classList.add('active'); // For flex display
}

function closeAlumniModal() {
    document.getElementById('alumni-modal').classList.add('hidden');
    document.getElementById('alumni-modal').classList.remove('active');
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

// Close modal when clicking outside content
document.addEventListener('click', (e) => {
    const modal = document.getElementById('alumni-modal');
    if (e.target === modal) {
        closeAlumniModal();
    }
});

