// Logic for Mentorship Connect
let allMentors = [];

// Initialize Mentorship Module
async function initMentorship() {
    console.log("Initializing Mentorship Module...");
    await loadMentors();
}

/**
 * Load approved mentors from Firestore
 */
async function loadMentors() {
    const container = document.getElementById('mentors-grid');
    if (!container) return;

    container.innerHTML = `
        <div class="card text-center" style="grid-column: span 3;">
            <div class="loading"></div>
            <p style="margin-top: 10px; color: var(--text-secondary);">Recherche des mentors...</p>
        </div>
    `;

    try {
        // Query: users where role == 'alumni' AND mentorStatus == 'approved'
        // Note: This requires a composite index in Firestore. If it fails, we will filter client-side.
        let snapshot;
        try {
            snapshot = await usersRef
                .where('role', '==', 'alumni')
                .where('mentorStatus', '==', 'approved')
                .get();
        } catch (idxError) {
            console.warn("Index missing, falling back to client-side filtering", idxError);
            // Fallback: Fetch all alumni and filter
            const alumniSnapshot = await usersRef.where('role', '==', 'alumni').get();
            const docs = alumniSnapshot.docs.filter(doc => doc.data().mentorStatus === 'approved');
            // Mock snapshot object for consistency
            snapshot = { empty: docs.length === 0, forEach: (cb) => docs.forEach(cb) };
        }

        allMentors = [];
        snapshot.forEach(doc => {
            allMentors.push({ id: doc.id, ...doc.data() });
        });

        displayMentors(allMentors);

    } catch (error) {
        console.error("Error loading mentors:", error);
        container.innerHTML = `
            <div class="card text-center" style="grid-column: span 3;">
                <p class="text-error">Impossible de charger les mentors pour le moment.</p>
                <button class="btn btn-secondary btn-small mt-2" onclick="loadMentors()">Réessayer</button>
            </div>
        `;
    }
}

/**
 * Render mentor cards
 */
function displayMentors(mentors) {
    const container = document.getElementById('mentors-grid');
    if (!container) return;

    if (mentors.length === 0) {
        container.innerHTML = `
            <div class="card text-center" style="grid-column: span 3; padding: 40px;">
                <div style="font-size: 3rem; margin-bottom: 15px; opacity: 0.5;">👨‍🏫</div>
                <h3 style="margin-bottom: 10px;">Aucun mentor disponible</h3>
                <p style="color: var(--text-secondary);">
                    Les anciens étudiants rejoignent le programme progressivement.<br>
                    Revenez bientôt !
                </p>
            </div>
        `;
        return;
    }

    let html = '';
    mentors.forEach(mentor => {
        // Safe defaults
        const name = mentor.fullName || 'Mentor';
        const promo = mentor.promo ? `Promo ${mentor.promo}` : 'Ancien Élève';
        const job = mentor.jobTitle || 'Professionnel'; // We need to add this field to the Alumni profile later
        const bio = mentor.bio || "Je suis disponible pour partager mon expérience et répondre à vos questions sur l'orientation et la carrière.";
        const company = mentor.company || '';

        // Avatar generation based on name initials
        const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

        html += `
            <div class="card mentor-card fade-in">
                <div class="mentor-header">
                    <div class="mentor-avatar">${initials}</div>
                    <div class="mentor-info">
                        <h3 class="mentor-name">${name}</h3>
                        <div class="mentor-role">${job} ${company ? 'chez <strong>' + company + '</strong>' : ''}</div>
                        <span class="badge badge-approved" style="font-size: 0.7rem; margin-top: 5px;">${promo}</span>
                    </div>
                </div>
                
                <div class="mentor-bio">
                    "${bio}"
                </div>
                
                <div class="mentor-actions" style="display: flex; gap: 10px;">
                    <button class="btn btn-primary" style="flex: 1; justify-content: center;" onclick="contactMentor('${mentor.email}', '${name.replace(/'/g, "\\'")}')">
                        📧 Email
                    </button>
                    
                    ${(mentor.whatsapp || mentor.phone) ? `
                    <button class="btn btn-whatsapp" style="width: 40px; display: flex; align-items: center; justify-content: center;" onclick="window.open('https://wa.me/${(mentor.whatsapp || mentor.phone).replace(/\D/g, '')}?text=Bonjour ${name}, je suis étudiant à Ibn Sina...', '_blank')" title="WhatsApp">
                        📱
                    </button>` : ''}

                    ${mentor.linkedin ? `
                    <button class="btn btn-linkedin" style="width: 40px; display: flex; align-items: center; justify-content: center;" onclick="window.open('${mentor.linkedin}', '_blank')" title="LinkedIn">
                        👔
                    </button>` : ''}
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

/**
 * Handle contact action
 */
function contactMentor(email, name) {
    if (!email) {
        alert("L'email de ce mentor n'est pas disponible.");
        return;
    }

    const subject = encodeURIComponent("Prise de contact via Ibn Sina - Étudiant");
    const body = encodeURIComponent(`Bonjour ${name},\n\nJe suis étudiant à Ibn Sina et j'aimerais échanger avec vous concernant votre parcours...\n\nCordialement,`);

    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
}

// Expose functions globally
window.initMentorship = initMentorship;
window.loadMentors = loadMentors;
window.contactMentor = contactMentor;
