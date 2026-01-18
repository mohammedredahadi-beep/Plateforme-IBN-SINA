// Fonctionnalités pour le tableau de bord administrateur



let currentUser = null;

let allFilieres = [];

let allUsers = [];

let allRequests = [];

const logsRef = db.collection('logs');



// --- DEBUG HELPER ---

function visibleLog(msg, type = 'info') {

    const debugEl = document.getElementById('debug-console');

    if (debugEl) {

        const color = type === 'error' ? 'red' : 'lime';

        debugEl.innerHTML += `<div style="color: ${color}; border-bottom: 1px solid #333;">${new Date().toLocaleTimeString()} - ${msg}</div>`;

        debugEl.scrollTop = debugEl.scrollHeight;

    }

    console.log(`[VISIBLE] ${msg}`);

}

// --------------------



/**

 * PHASE 16: JOURNAL DES ACTIONS ET MODÉRATION

 */



// Enregistrer une action administrative

async function logAction(actionType, targetId, details = {}) {

    try {

        await logsRef.add({

            adminId: auth.currentUser.uid,

            adminName: currentUser.fullName,

            actionType: actionType, // 'PROMOTE', 'SUSPEND', 'ADD_FILIERE', etc.

            targetId: targetId,

            details: details,

            timestamp: firebase.firestore.FieldValue.serverTimestamp()

        });

    } catch (error) {

        console.error('Erreur lors de l\'enregistrement du log:', error);

    }

}



// Suspendre un utilisateur

async function suspendUser(userId) {

    if (!confirm('Voulez-vous vraiment suspendre cet utilisateur ? Il ne pourra plus accéder à la plateforme.')) return;



    try {

        await usersRef.doc(userId).update({

            isSuspended: true,

            updatedAt: firebase.firestore.FieldValue.serverTimestamp()

        });



        await logAction('SUSPEND_USER', userId);

        showSuccess('admin-message', 'Utilisateur suspendu avec succès.');

        await loadAllUsers();

        displayUsers();

    } catch (error) {

        console.error('Erreur suspension:', error);

        showError('admin-message', 'Erreur lors de la suspension.');

    }

}



// Réactiver un utilisateur

async function unsuspendUser(userId) {

    try {

        await usersRef.doc(userId).update({

            isSuspended: false,

            updatedAt: firebase.firestore.FieldValue.serverTimestamp()

        });



        await logAction('UNSUSPEND_USER', userId);

        showSuccess('admin-message', 'Compte utilisateur réactivé.');

        await loadAllUsers();

        displayUsers();

    } catch (error) {

        console.error('Erreur réactivation:', error);

        showError('admin-message', 'Erreur lors de la réactivation.');

    }

}



// Charger les logs

async function loadLogs() {

    const container = document.getElementById('logs-list');

    if (!container) return;

    container.innerHTML = '<div class="text-center"><p>Chargement du journal...</p></div>';



    try {

        const snapshot = await logsRef.limit(100).get();



        if (snapshot.empty) {

            container.innerHTML = '<div class="card text-center"><p>Aucune action enregistrée.</p></div>';

            return;

        }



        let logs = [];

        snapshot.forEach(doc => {

            const data = doc.data();

            logs.push({ id: doc.id, ...data });

        });



        // Tri côté client par date

        logs.sort((a, b) => {

            const timeA = a.timestamp ? (a.timestamp.toMillis ? a.timestamp.toMillis() : new Date(a.timestamp).getTime()) : 0;

            const timeB = b.timestamp ? (b.timestamp.toMillis ? b.timestamp.toMillis() : new Date(b.timestamp).getTime()) : 0;

            return timeB - timeA;

        });



        let html = '<div class="table-container"><table class="table">';

        html += '<thead><tr><th>Admin</th><th>Action</th><th>Cible</th><th>Détails</th><th>Date</th></tr></thead><tbody>';



        logs.forEach(log => {

            let dateStr = '-';

            if (log.timestamp) {

                try {

                    const d = log.timestamp.toDate ? log.timestamp.toDate() : new Date(log.timestamp);

                    dateStr = d.toLocaleString('fr-FR');

                } catch (e) {

                    dateStr = 'Date invalide';

                }

            }



            let actionBadge = `<span class="badge" style="background: #e9ecef; color: #495057;">${log.actionType || 'INCONNUE'}</span>`;

            if (log.actionType && log.actionType.includes('SUSPEND')) actionBadge = `<span class="badge badge-rejected">${log.actionType}</span>`;

            if (log.actionType && (log.actionType.includes('PROMOTE') || log.actionType.includes('ADD') || log.actionType.includes('APPROVE'))) actionBadge = `<span class="badge badge-approved">${log.actionType}</span>`;



            html += `

                <tr>

                    <td><strong>${log.adminName || 'Admin'}</strong></td>

                    <td>${actionBadge}</td>

                    <td style="font-family: monospace; font-size: 0.8rem;">${log.targetId || '-'}</td>

                    <td><small>${JSON.stringify(log.details || {})}</small></td>

                    <td>${dateStr}</td>

                </tr>

            `;

        });



        html += '</tbody></table></div>';

        container.innerHTML = html;



    } catch (error) {

        console.error('Erreur logs:', error);

        container.innerHTML = `

            <div class="card text-center">

                <p class="text-error">Erreur de chargement des logs: ${error.message}</p>

                <button class="btn btn-secondary mt-2" onclick="loadLogs()">Réessayer</button>

            </div>`;

    }

}



// Ouvrir le modal d'édition

function openEditUserModal(userId) {

    const user = allUsers.find(u => u.uid === userId);

    if (!user) return;



    document.getElementById('edit-user-id').value = user.uid;

    document.getElementById('edit-user-name').value = user.fullName || '';

    document.getElementById('edit-user-email').value = user.email || '';

    document.getElementById('edit-user-phone').value = user.phone || '';

    document.getElementById('edit-user-role').value = user.role || 'student';

    // Set Niveau and trigger major list update
    const niveau = user.niveau || 'TC';
    document.getElementById('edit-user-niveau').value = niveau;
    handleEditLevelChange(niveau);

    // Set Major after it's populated
    document.getElementById('edit-user-major').value = user.filiere || user.major || '';

    document.getElementById('edit-user-classe').value = user.classe || ''; // Populate Classe

    document.getElementById('edit-user-linkedin').value = user.linkedin || '';

    document.getElementById('edit-user-bio').value = user.bio || user.parcours || '';



    // Status Checkboxes

    document.getElementById('edit-user-approved').checked = user.isApproved === true;

    document.getElementById('edit-user-suspended').checked = user.isSuspended === true;

    document.getElementById('edit-user-mentor').checked = user.mentorStatus === 'approved';



    // Show/Hide Fields based on Role/Niveau

    const promoGroup = document.getElementById('edit-promo-group');

    const bgGroup = document.getElementById('edit-user-mentor').parentElement; // Label parent

    const promoInput = document.getElementById('edit-user-promo');



    // Logic: Mentor logic applies if Role is Alumni OR Niveau is Lauréat

    const isAlumni = (user.role === 'alumni' || user.niveau === 'Lauréat');



    if (isAlumni) {

        promoGroup.classList.remove('hidden');

        promoInput.value = user.promo || '';

        if (bgGroup) bgGroup.classList.remove('hidden'); // Show Mentor checkbox

    } else {

        promoGroup.classList.add('hidden');

        promoInput.value = '';

        if (bgGroup) bgGroup.classList.add('hidden'); // Hide Mentor checkbox

    }



    document.getElementById('edit-user-modal').classList.remove('hidden');

}



// Fermer le modal d'édition

function closeEditUserModal() {

    document.getElementById('edit-user-modal').classList.add('hidden');

}

// Basculer les champs selon le niveau dans le modal d'édition
// Basculer les champs selon le niveau dans le modal d'édition
window.handleEditLevelChange = function (val) {
    const majorSelect = document.getElementById('edit-user-major');
    const majorGroup = document.getElementById('edit-major-group');
    const classeGroup = document.getElementById('edit-classe-group');
    const promoGroup = document.getElementById('edit-promo-group');
    const classInput = document.getElementById('edit-user-classe');
    const mentorCheckboxGroup = document.getElementById('edit-user-mentor') ? document.getElementById('edit-user-mentor').parentElement : null;

    if (!majorSelect || !majorGroup || !classeGroup || !promoGroup) return;

    console.log("handleEditLevelChange triggered with:", val);

    // Initial Reset
    majorSelect.innerHTML = '<option value="">-- Sélectionner Branche --</option>';
    majorSelect.disabled = true;
    if (classInput) classInput.disabled = true;

    if (!val) return;

    // Déterminer quelles filières afficher
    let majorsToShow = [];
    if (val === 'Lauréat') {
        majorsToShow = SchoolStructure.getAllMajors();

        // Mode Lauréat: Show Promo, Keep Filiere but hide/disable Classe
        majorGroup.classList.remove('hidden');
        classeGroup.classList.add('hidden'); // Lauréats don't have a current class 1/2/3
        promoGroup.classList.remove('hidden');
        if (mentorCheckboxGroup) mentorCheckboxGroup.classList.remove('hidden');
    } else {
        majorsToShow = SchoolStructure.getMajorsForLevel(val);

        // Mode Étudiant: Hide Promo, Show Filiere & Classe
        majorGroup.classList.remove('hidden');
        classeGroup.classList.remove('hidden');
        promoGroup.classList.add('hidden');
        if (mentorCheckboxGroup) mentorCheckboxGroup.classList.add('hidden');
    }

    // Populate Majors
    if (majorsToShow && majorsToShow.length > 0) {
        majorSelect.disabled = false;
        majorsToShow.forEach(code => {
            const opt = document.createElement('option');
            opt.value = code;
            opt.textContent = `${code} - ${SchoolStructure.MajorLabels[code] || code}`;
            majorSelect.appendChild(opt);
        });

        // Enable class input only for non-laureates
        if (val !== 'Lauréat' && classInput) {
            classInput.disabled = false;
        }
    }
}

// Keep for compatibility if needed elsewhere
function toggleEditPromoField(val) { handleEditLevelChange(val); }



// Enregistrer les modifications de l'utilisateur

async function updateUser(e) {

    e.preventDefault();



    const userId = document.getElementById('edit-user-id').value;

    const fullName = document.getElementById('edit-user-name').value;

    const phone = document.getElementById('edit-user-phone').value;

    const role = document.getElementById('edit-user-role').value;

    const niveau = document.getElementById('edit-user-niveau').value;

    const classe = document.getElementById('edit-user-classe').value; // Read Classe

    const promo = document.getElementById('edit-user-promo').value;

    const linkedin = document.getElementById('edit-user-linkedin').value;

    const bio = document.getElementById('edit-user-bio').value;



    const isApproved = document.getElementById('edit-user-approved').checked;
    const isSuspended = document.getElementById('edit-user-suspended').checked;
    const isMentor = document.getElementById('edit-user-mentor').checked;
    const major = document.getElementById('edit-user-major').value;

    try {
        const updateData = {
            fullName: fullName,
            phone: phone,
            role: role,
            niveau: niveau,
            filiere: major, // Save Filiere/Major
            classe: classe ? parseInt(classe, 10) : null,
            linkedin: linkedin,
            bio: bio,
            isApproved: isApproved,
            isSuspended: isSuspended,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };



        if (niveau === 'Lauréat') {

            updateData.promo = promo;

            // Update Mentor Status based on checkbox

            updateData.mentorStatus = isMentor ? 'approved' : 'none';

        } else {

            // Remove mentor status if not Alumni

            updateData.mentorStatus = firebase.firestore.FieldValue.delete();

        }



        await usersRef.doc(userId).update(updateData);



        await logAction('UPDATE_USER_PROFILE', userId, {

            name: fullName,

            role: role,

            niveau: niveau,

            isMentor: isMentor,

            status: isSuspended ? 'Suspended' : 'Active'

        });



        showSuccess('admin-message', 'Profil utilisateur mis à jour avec succès.');

        closeEditUserModal();

        await loadAllUsers();

        displayUsers();

    } catch (error) {

        console.error('Erreur mise à jour utilisateur:', error);

        showError('admin-message', 'Erreur lors de la mise à jour du profil.');

    }

}



// Track selected users for individual targeting

let selectedIndividualUsers = [];



// Search users for individual selection

async function searchUsers(query) {

    const resultsContainer = document.getElementById('user-search-results');



    if (!query || query.length < 2) {

        resultsContainer.classList.add('hidden');

        return;

    }



    const searchLower = query.toLowerCase();

    const filtered = allUsers.filter(u =>

        u.fullName.toLowerCase().includes(searchLower) ||

        u.email.toLowerCase().includes(searchLower)

    ).filter(u => !selectedIndividualUsers.find(s => s.uid === u.uid)).slice(0, 10);



    if (filtered.length === 0) {

        resultsContainer.innerHTML = '<div style="padding: 10px; text-align: center; color: var(--text-secondary);">Aucun utilisateur trouvé</div>';

        resultsContainer.classList.remove('hidden');

        return;

    }



    let html = '';

    filtered.forEach(user => {

        html += `

            <div onclick="selectUser('${user.uid}')" 

                style="padding: 10px; cursor: pointer; border-bottom: 1px solid var(--border-color); transition: 0.2s;"

                onmouseover="this.style.background='var(--bg-secondary)'" 

                onmouseout="this.style.background='transparent'">

                <strong>${user.fullName}</strong>

                <div style="font-size: 0.85rem; color: var(--text-secondary);">${user.email} • ${user.role}</div>

            </div>

        `;

    });

    resultsContainer.innerHTML = html;

    resultsContainer.classList.remove('hidden');

}



// Select user for individual targeting

function selectUser(userId) {

    const user = allUsers.find(u => u.uid === userId);

    if (!user || selectedIndividualUsers.find(s => s.uid === userId)) return;



    selectedIndividualUsers.push(user);

    renderSelectedUsers();



    // Clear search

    document.getElementById('user-search').value = '';

    document.getElementById('user-search-results').classList.add('hidden');

}



// Remove selected user

function removeSelectedUser(userId) {

    selectedIndividualUsers = selectedIndividualUsers.filter(u => u.uid !== userId);

    renderSelectedUsers();

}



// Render selected users as chips

function renderSelectedUsers() {

    const container = document.getElementById('selected-users');

    if (selectedIndividualUsers.length === 0) {

        container.innerHTML = '<small style="color: var(--text-secondary);">Aucun utilisateur sélectionné</small>';

        return;

    }



    let html = '';

    selectedIndividualUsers.forEach(user => {

        html += `

            <span class="badge" style="background: var(--primary-color); color: white; padding: 5px 10px; border-radius: 20px; display: flex; align-items: center; gap: 5px;">

                ${user.fullName}

                <button type="button" onclick="removeSelectedUser('${user.uid}')" 

                    style="background: none; border: none; color: white; cursor: pointer; font-size: 1.2rem; line-height: 1;">&times;</button>

            </span>

        `;

    });

    container.innerHTML = html;

}



// Envoyer un message marketing/annonce (Enhanced)

async function sendMarketingMessage(e) {
    e.preventDefault();

    const priority = document.getElementById('msg-priority').value;
    const target = document.getElementById('msg-target').value;
    const title = document.getElementById('msg-title').value;
    const content = document.getElementById('msg-content').value;
    const durationInput = document.getElementById('msg-duration');
    const duration = durationInput ? parseInt(durationInput.value) : 24;

    if (!title || !content) {
        showError('admin-message', 'Veuillez remplir tous les champs requis.');
        return;
    }

    if (!target && selectedIndividualUsers.length === 0) {
        showError('admin-message', 'Veuillez sélectionner au moins un groupe ou un utilisateur.');
        return;
    }

    try {
        const messageData = {
            title: title,
            content: content,
            priority: priority,
            target: target || 'custom',
            senderId: auth.currentUser.uid,
            senderName: currentUser.fullName,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            readBy: [],
            individualUserIds: selectedIndividualUsers.map(u => u.uid),
            durationHours: duration // Store expiry duration
        };

        // Save to Firestore
        await db.collection('messages').add(messageData);

        await logAction('SEND_MESSAGE', target || 'custom', {
            title: title,
            individualRecipients: selectedIndividualUsers.length,
            priority: priority,
            duration: duration
        });

        showSuccess('admin-message', `Message envoyé avec succès ! (Expire dans ${duration}h)`);
        document.getElementById('marketing-form').reset();
        selectedIndividualUsers = [];
        renderSelectedUsers();
        document.getElementById('msg-priority').value = 'communicative';

        // Reset duration to default
        if (durationInput) durationInput.value = 48;

    } catch (error) {
        console.error('Erreur envoi message:', error);
        showError('admin-message', 'Erreur lors de l\'envoi du message: ' + error.message);
    }
}

// Nouvelle fonction de suppression massive
async function deleteAllMessages() {
    if (!confirm("ATTENTION: Vous êtes sur le point de supprimer TOUS les messages de la plateforme pour TOUS les utilisateurs.\n\nCette action est irréversible.\n\nContinuer ?")) {
        return;
    }

    const btn = document.querySelector('button[onclick="deleteAllMessages()"]');
    if (btn) {
        btn.textContent = "Suppression...";
        btn.disabled = true;
    }

    try {
        const snapshot = await db.collection('messages').get();
        const batchSize = 400;
        let batch = db.batch();
        let count = 0;
        let totalDeleted = 0;

        for (const doc of snapshot.docs) {
            batch.delete(doc.ref);
            count++;
            if (count >= batchSize) {
                await batch.commit();
                batch = db.batch();
                totalDeleted += count;
                count = 0;
            }
        }

        if (count > 0) {
            await batch.commit();
            totalDeleted += count;
        }

        showSuccess('admin-message', `${totalDeleted} messages supprimés avec succès.`);
        loadAdminMessagesList(); // Rafraîchir la liste si visible

    } catch (error) {
        console.error("Delete all error:", error);
        showError('admin-message', "Erreur lors de la suppression massive.");
    } finally {
        if (btn) {
            btn.innerHTML = "🗑️ Supprimer TOUT";
            btn.disabled = false;
        }
    }
}



// Initialiser le tableau de bord administrateur

async function initAdminDashboard() {

    currentUser = await checkAuthAndRedirect();



    const allowedRoles = ['admin'];

    if (!currentUser || !allowedRoles.includes(currentUser.role)) {

        window.location.href = 'index.html';

        return;

    }





    // Afficher les informations de l'utilisateur

    displayUserInfo();

    visibleLog("Admin Init: Starting...");



    // Charger toutes les données dans l'ordre (Dépendances d'abord)

    // On utilise des try-catch individuels pour qu'une erreur ne bloque pas tout le dashboard

    try {

        visibleLog("Fetching Users...");

        await loadAllUsers(); // Nécessaire pour afficher les noms des délégués dans les filières

        visibleLog(`Users loaded: ${allUsers.length}`);

        if (allUsers.length > 0) visibleLog(`First User: ${JSON.stringify(allUsers[0]).substring(0, 50)}...`);

    } catch (e) {

        console.error("Admin Init: Error loading users", e);

        visibleLog(`Error loading users: ${e.message}`, 'error');

    }



    try {

        visibleLog("Fetching Filieres...");

        await loadAllFilieres();

        visibleLog(`Filieres loaded: ${allFilieres.length}`);

        if (allFilieres.length > 0) visibleLog(`First Filiere: ${allFilieres[0].id}`);

    } catch (e) {

        console.error("Admin Init: Error loading filieres", e);

        visibleLog(`Error loading filieres: ${e.message}`, 'error');

    }



    // Initialiser l'écouteur des demandes

    try {

        visibleLog("Starting Requests Listener...");

        loadAllRequests(); // C'est non-bloquant car c'est un listener, mais on le garde safe

    } catch (e) {

        console.error("Admin Init: Error starting requests listener", e);

        visibleLog(`Error requesting listener: ${e.message}`, 'error');

    }



    // Afficher les stats initiales

    try {

        displayStats();

    } catch (e) {

        console.error("Admin Init: Error displaying stats", e);

        visibleLog(`Error displaying stats: ${e.message}`, 'error');

    }



    // Initialiser les notifications

    if (typeof initNotificationSystem === 'function') {

        initNotificationSystem();

    }



    // Initialiser les graphiques du dashboard

    if (typeof initDashboardCharts === 'function') {

        // Wait a bit for data to load before initializing charts

        setTimeout(() => {

            try {

                initDashboardCharts();

                visibleLog("Dashboard charts initialized");

            } catch (e) {

                console.error("Error initializing charts:", e);

                visibleLog(`Error initializing charts: ${e.message}`, 'error');

            }

        }, 1000);

    }



    // Afficher la vue par défaut

    showAdminView('dashboard');



    // Gestion de la fermeture des dropdowns

    document.addEventListener('click', (e) => {

        if (!e.target.closest('.action-dropdown')) {

            document.querySelectorAll('.dropdown-menu.active').forEach(m => m.classList.remove('active'));

        }

    });

}



// Afficher les informations de l'utilisateur

function displayUserInfo() {

    const el = document.getElementById('sidebar-user-name');

    if (el && currentUser) el.textContent = currentUser.fullName;

}



// Charger toutes les filières

async function loadAllFilieres() {

    try {

        const snapshot = await filieresRef.get();

        allFilieres = [];

        snapshot.forEach(doc => {

            allFilieres.push({ id: doc.id, ...doc.data() });

        });



        // Tri client-side pour éviter les erreurs d'index manquant

        allFilieres.sort((a, b) => (a.name || '').localeCompare(b.name || ''));



        displayFilieres();

        displayStats(); // Update KPIs

    } catch (error) {

        console.error('Erreur lors du chargement des filières:', error);

        document.getElementById('filieres-list').innerHTML = `

            <div class="card text-center">

                <p class="text-error">Erreur de chargement: ${error.message}</p>

                <button class="btn btn-secondary mt-2" onclick="loadAllFilieres()">Réessayer</button>

            </div>`;

    }

}



// Afficher les filières

// Afficher les filières (Groupées par Niveau - Triple Logic Redesign)
async function displayFilieres() {
    const container = document.getElementById('filieres-list');

    if (allFilieres.length === 0) {
        container.innerHTML = `
            <div class="card text-center">
                <p style="color: var(--text-secondary);">Aucune filière créée</p>
            </div>
        `;
        return;
    }

    // Grouping by Level - Using Official SchoolStructure
    const levels = {
        'TC': { label: SchoolStructure.Levels.TC, items: [] },
        'BAC1': { label: SchoolStructure.Levels.BAC1, items: [] },
        'BAC2': { label: SchoolStructure.Levels.BAC2, items: [] },
        'BTS1': { label: SchoolStructure.Levels.BTS1, items: [] },
        'BTS2': { label: SchoolStructure.Levels.BTS2, items: [] },
        'Autre': { label: 'Autre / Non défini', items: [] }
    };

    allFilieres.forEach(f => {
        const lvl = f.level || 'Autre';
        if (levels[lvl]) {
            levels[lvl].items.push(f);
        } else {
            levels['Autre'].items.push(f);
        }
    });

    let html = '';

    // Order of display - Following official structure
    const orderedKeys = ['TC', 'BAC1', 'BAC2', 'BTS1', 'BTS2', 'Autre'];

    orderedKeys.forEach(key => {
        const group = levels[key];
        if (group.items.length > 0) {
            // Section Header
            html += `
                <div style="margin-bottom: 20px;">
                    <h4 style="
                        font-size: 1.1rem; 
                        color: var(--text-main); 
                        border-bottom: 2px solid var(--border); 
                        padding-bottom: 8px; 
                        margin-bottom: 15px; 
                        display: flex; 
                        align-items: center; 
                        gap: 10px;">
                        <span style="background: var(--bg-alt); padding: 4px 10px; border-radius: 4px;">${group.label}</span>
                        <span style="font-size: 0.8rem; color: var(--text-secondary); font-weight: normal;">(${group.items.length} classes)</span>
                    </h4>
                    <div class="grid grid-3">
            `;

            // Sort items by Class Number within level
            group.items.sort((a, b) => (parseInt(a.class) || 0) - (parseInt(b.class) || 0));

            group.items.forEach(filiere => {
                let delegateName = 'Non assigné';
                if (filiere.delegateId) {
                    const delegateUser = allUsers.find(u => u.uid === filiere.delegateId);
                    if (delegateUser) {
                        delegateName = delegateUser.fullName;
                    }
                }

                const dropdownActions = [
                    { label: 'Modifier', icon: '📝', onclick: `openEditFiliereModal('${filiere.id}')` },
                    { label: 'Supprimer', icon: '🗑️', class: 'danger', onclick: `deleteFiliere('${filiere.id}')` }
                ];

                // Triple Logic Display - PREMIUM STYLING
                const majorLabel = filiere.major ? (SchoolStructure.MajorLabels[filiere.major] || filiere.major) : 'Général';

                html += `
                    <div class="filiere-card-premium">
                        <div class="flex" style="justify-content: space-between; align-items: start; margin-bottom: 12px;">
                            <div>
                                <h3 style="font-size: 1.4rem; font-weight: 800; color: var(--text-main); margin: 0; letter-spacing: -0.5px;">
                                    <span style="color: var(--primary);">${filiere.major || '?'}</span> 
                                    <span style="opacity: 0.5;">-</span> 
                                    ${filiere.class || '?'}
                                </h3>
                                <div style="font-size: 0.85rem; color: var(--text-muted); font-weight: 500; margin-top: 4px;">${majorLabel}</div>
                            </div>
                            ${renderActionDropdown(dropdownActions)}
                        </div>
                        
                        <div style="background: rgba(99, 102, 241, 0.05); padding: 10px; border-radius: 8px; margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between;">
                             <div style="font-size: 0.75rem; text-transform: uppercase; color: var(--primary); font-weight: 700; letter-spacing: 0.5px;">Délégué</div>
                             <div style="font-weight: 600; font-size: 0.9rem; color: var(--text-main);">
                                ${delegateName !== 'Non assigné' ? `👤 ${delegateName}` : '<span style="opacity: 0.5; font-style: italic;">Non défini</span>'}
                             </div>
                        </div>

                        ${filiere.whatsappLink ? `
                            <a href="${filiere.whatsappLink}" target="_blank" style="
                                display: block; 
                                text-align: center;
                                padding: 8px;
                                border-radius: 6px;
                                background: rgba(37, 211, 102, 0.1); 
                                color: #25D366; 
                                text-decoration: none; 
                                font-weight: 600; 
                                font-size: 0.85rem;
                                transition: all 0.2s;
                            " onmouseover="this.style.background='rgba(37, 211, 102, 0.2)'" onmouseout="this.style.background='rgba(37, 211, 102, 0.1)'">
                                📱 Groupe WhatsApp
                            </a>
                        ` : ''}
                    </div>
                `;
            });

            html += `
                    </div>
                </div>
            `;
        }
    });

    container.innerHTML = html;
}



// Charger tous les utilisateurs

async function loadAllUsers() {

    try {

        const snapshot = await usersRef.get();

        allUsers = [];

        snapshot.forEach(doc => {

            allUsers.push(doc.data());

        });

    } catch (error) {

        console.error('Erreur lors du chargement des utilisateurs:', error);

        document.getElementById('users-list').innerHTML = `

            <div class="card text-center">

                <p class="text-error">Erreur de chargement utilisateurs: ${error.message}</p>

                <button class="btn btn-secondary mt-2" onclick="loadAllUsers()">Réessayer</button>

            </div>`;

    }

    displayStats(); // Update KPIs regardless of error (might be partial or empty)

}



// Charger toutes les demandes

async function loadAllRequests() {

    try {

        // On retire orderBy pour éviter les blocages d'index si la collection est nouvelle

        requestsRef.onSnapshot(snapshot => {

            allRequests = [];

            snapshot.forEach(doc => {

                allRequests.push({ id: doc.id, ...doc.data() });

            });



            // Tri client-side

            allRequests.sort((a, b) => {

                const timeA = a.createdAt ? (a.createdAt.toMillis ? a.createdAt.toMillis() : 0) : 0;

                const timeB = b.createdAt ? (b.createdAt.toMillis ? b.createdAt.toMillis() : 0) : 0;

                return timeB - timeA;

            });



            displayStats();

        }, error => {

            console.error("Erreur écouteur demandes:", error);

            const container = document.getElementById('requests-all-list');

            if (container) {

                container.innerHTML = `

                    <div class="card text-center">

                        <p class="text-error">Erreur chargement demandes: ${error.message}</p>

                    </div>`;

            }

        });

    } catch (error) {

        console.error('Erreur lors du chargement des demandes:', error);

    }

}



// Afficher les statistiques

function displayStats() {

    // 1. Mise à jour des cartes KPI (Haut de page)

    if (document.getElementById('stat-users')) document.getElementById('stat-users').textContent = allUsers.length;

    if (document.getElementById('stat-filieres')) document.getElementById('stat-filieres').textContent = allFilieres.length;

    if (document.getElementById('stat-requests')) document.getElementById('stat-requests').textContent = allRequests.length;



    const pendingCount = allRequests.filter(r => r.status === 'pending').length;

    if (document.getElementById('stat-pending')) {

        document.getElementById('stat-pending').textContent = pendingCount;

    }



    // 2. Mise à jour des stats dans la Vue Demandes (stat-pending-view)

    const approvedCount = allRequests.filter(r => r.status === 'approved').length;



    if (document.getElementById('stat-pending-view')) {

        document.getElementById('stat-pending-view').textContent = pendingCount;

    }

    if (document.getElementById('stat-approved-view')) {

        document.getElementById('stat-approved-view').textContent = approvedCount;

    }



    // 3. Mise à jour des badges de la Sidebar

    const sidebarRequestsBadge = document.getElementById('sidebar-badge-requests');

    if (sidebarRequestsBadge) {

        sidebarRequestsBadge.textContent = pendingCount;

        if (pendingCount > 0) sidebarRequestsBadge.classList.remove('hidden');

        else sidebarRequestsBadge.classList.add('hidden');

    }



    // Calcul des lauréats en attente pour le badge "Lauréats"

    const pendingAlumniCount = allUsers.filter(u => u.role === 'alumni' && !u.isApproved).length;

    const sidebarAlumniBadge = document.getElementById('sidebar-badge-alumni');

    if (sidebarAlumniBadge) {

        sidebarAlumniBadge.textContent = pendingAlumniCount;

        if (pendingAlumniCount > 0) sidebarAlumniBadge.classList.remove('hidden');

        else sidebarAlumniBadge.classList.add('hidden');

    }



    // Badge VALIDATIONS

    const pendingValidations = allUsers.filter(u => !u.isApproved).length;

    const sidebarValBadge = document.getElementById('sidebar-badge-validations');

    if (sidebarValBadge) {

        sidebarValBadge.textContent = pendingValidations;

        if (pendingValidations > 0) sidebarValBadge.classList.remove('hidden');

        else sidebarValBadge.classList.add('hidden');

    }



    // 4. Mise à jour des graphiques si disponibles

    if (typeof updateAllCharts === 'function' && chartsInitialized) {

        try {

            updateAllCharts();

        } catch (e) {

            console.error("Error updating charts:", e);

        }

    }

}



// Helper pour les dropdowns d'actions
// Note: toggleActionMenu est défini plus bas (ligne ~1450)

function renderActionDropdown(items) {

    if (items.length === 0) return '-';



    return `

        <div class="action-dropdown">

            <button class="dropdown-toggle" onclick="toggleActionMenu(this, event)">⋮</button>

            <div class="dropdown-menu">

                ${items.map(item => `

                    <button class="dropdown-item ${item.class || ''}" onclick="${item.onclick}">

                        ${item.icon || ''} ${item.label}

                    </button>

                `).join('')}

            </div>

        </div>

    `;

}



// Gérer l'affichage du menu d'actions

function toggleActionMenu(button, event) {

    event.stopPropagation();

    const menu = button.nextElementSibling;

    const isVisible = menu.classList.contains('active');



    // Fermer tous les autres menus

    document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('active'));



    if (!isVisible) {

        menu.classList.add('active');

    }

}



// Fermer les menus lors d'un clic ailleurs

document.addEventListener('click', () => {
    document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('active'));
});



// Basculer entre les vues

// Basculer entre les vues

// Basculer entre les vues
function showAdminView(viewId) {
    const allViews = [
        'dashboard', 'filieres', 'users', 'events', 'requests',
        'alumni', 'logs', 'support', 'backup', 'marketing', 'diagnostics', 'notifications', 'validations'
    ];

    ui.showView(viewId, allViews, () => {
        // Callback function to load data based on the view
        if (viewId === 'users') displayUsers();
        if (viewId === 'requests') displayAllRequests();
        if (viewId === 'alumni') displayPendingAlumni();
        if (viewId === 'logs') loadLogs();
        if (viewId === 'support') loadSupportAlerts();
        if (viewId === 'events') loadAdminEvents();
        if (viewId === 'validations') displayValidations();
        if (viewId === 'marketing') loadAdminMessagesList();

        if (viewId === 'diagnostics') {
            const res = document.getElementById('diag-results');
            if (res) res.innerHTML = '<div class="card text-center" style="padding: 40px;"><p style="color: var(--text-secondary);">En attente de lancement du diagnostic...</p></div>';
        }

        if (viewId === 'notifications' && typeof initNotificationsView === 'function') initNotificationsView();
    });
}



// Ajouter un événement

async function addEvent(e) {

    if (e) e.preventDefault();

    const title = document.getElementById('event-title').value;

    const dateInput = document.getElementById('event-date').value;

    const type = document.getElementById('event-type').value;

    const link = document.getElementById('event-link').value;

    const description = document.getElementById('event-desc').value;



    try {

        await db.collection('events').add({

            title,

            date: firebase.firestore.Timestamp.fromDate(new Date(dateInput)),

            type,

            link: link || null,

            description,

            createdAt: firebase.firestore.FieldValue.serverTimestamp()

        });



        showSuccess('admin-message', 'Événement publié avec succès !');

        document.getElementById('event-form').reset();

        loadAdminEvents();

    } catch (error) {

        console.error('Erreur création événement:', error);

        showError('admin-message', 'Erreur lors de la publication.');

    }

}



// Charger les événements (Admin)

/* 
// DEPRECATED: Combined with newer implementation below
async function loadAdminEvents() {
    // ... code removed ...
}

async function deleteEvent(id) {
   // ... code removed ...
}
*/



// Charger les alertes support

async function loadSupportAlerts() {

    const container = document.getElementById('support-list');

    if (!container) return;

    container.innerHTML = '<div class="text-center"><p>Chargement des alertes...</p></div>';



    try {

        // Retrait de l'orderBy pour éviter l'erreur d'index Firestore

        const snapshot = await db.collection('support_alerts').get();



        if (snapshot.empty) {

            container.innerHTML = '<div class="card text-center"><p style="color: var(--text-secondary);">Aucune alerte support.</p></div>';

            return;

        }



        let alerts = [];

        snapshot.forEach(doc => {

            alerts.push({ id: doc.id, ...doc.data() });

        });



        // Tri côté client par timestamp descendant

        alerts.sort((a, b) => {

            const timeA = a.timestamp ? (a.timestamp.toMillis ? a.timestamp.toMillis() : new Date(a.timestamp).getTime()) : 0;

            const timeB = b.timestamp ? (b.timestamp.toMillis ? b.timestamp.toMillis() : new Date(b.timestamp).getTime()) : 0;

            return timeB - timeA;

        });



        let html = '';



        alerts.forEach(alert => {

            let dateStr = 'N/A';

            if (alert.timestamp) {

                try {

                    const d = alert.timestamp.toDate ? alert.timestamp.toDate() : new Date(alert.timestamp);

                    dateStr = d.toLocaleString('fr-FR');

                } catch (e) {

                    dateStr = 'Date invalide';

                }

            }



            const dropdownActions = [];

            // MENTOR_REQUEST logic moved to Requests Tab



            dropdownActions.push({ label: 'Marquer Résolu', icon: '✓', onclick: `resolveAlert('${alert.id}')` });

            dropdownActions.push({ label: 'Supprimer', icon: '🗑️', class: 'danger', onclick: `deleteAlert('${alert.id}')` });



            html += `

                <div class="card fade-in" style="border-left: 4px solid var(--danger-color); margin-bottom: 15px;">

                    <div class="flex" style="justify-content: space-between; align-items: start;">

                        <div>

                            <div class="flex" style="gap: 8px; align-items: center; margin-bottom: 8px;">

                                <span class="badge badge-rejected">${alert.type || 'SUPPORT'}</span>

                                <small style="color: var(--text-secondary);">${dateStr}</small>

                            </div>

                            <h4 style="font-weight: 600; margin-bottom: 5px;">${alert.userName || 'Utilisateur inconnu'}</h4>

                            <p style="font-size: 0.9rem; color: var(--text-main); background: var(--bg-tertiary); padding: 10px; border-radius: 6px; margin-top: 5px;">

                                ${alert.message}

                            </p>

                        </div>

                        ${renderActionDropdown(dropdownActions)}

                    </div>

                </div>

            `;

        });



        container.innerHTML = html;

    } catch (error) {

        console.error('Erreur logs support:', error);

        container.innerHTML = `

            <div class="card text-center">

                <p class="text-error">Erreur logs support: ${error.message}</p>

                <button class="btn btn-secondary mt-2" onclick="loadSupportAlerts()">Réessayer</button>

            </div>`;

    }

}



// Résoudre une alerte

async function resolveAlert(id) {

    try {

        await db.collection('support_alerts').doc(id).update({

            status: 'resolved',

            resolvedAt: firebase.firestore.FieldValue.serverTimestamp()

        });

        loadSupportAlerts();

    } catch (error) {

        alert('Erreur lors de la résolution.');

    }

}



// Supprimer une alerte

async function deleteAlert(id) {

    if (!confirm('Supprimer cette alerte ?')) return;

    try {

        await db.collection('support_alerts').doc(id).delete();

        loadSupportAlerts();

    } catch (error) {

        alert('Erreur lors de la suppression.');

    }

}



// ------------------------------------------------------------------

// GESTION AVANCÉE DES NOTIFICATIONS & CONFIGURATION (Admin Override)

// ------------------------------------------------------------------



async function initAdminNotificationsView() {

    const container = document.getElementById('notifications-view');

    if (!container) return;



    // 1. Get Current Config

    let currentDuration = 24;

    try {

        const configDoc = await db.collection('system').doc('config').get();

        if (configDoc.exists && configDoc.data().messageDuration) {

            currentDuration = configDoc.data().messageDuration;

        }

    } catch (e) {

        console.warn("Config load error", e);

    }



    // 2. Build Admin Interface

    container.innerHTML = `

        <div class="grid grid-2" style="margin-bottom: 20px;">

            <!-- Configuration Card -->

            <div class="card">

                <h3 style="margin-bottom: 15px;">⚙️ Configuration Système</h3>

                <div class="form-group">

                    <label class="form-label">Durée de vie des messages lus (heures)</label>

                    <div class="flex gap-1">

                        <input type="number" id="config-duration" class="form-input" value="${currentDuration}" min="1" max="720">

                        <button class="btn btn-primary" onclick="saveMessageConfig()">Enregistrer</button>

                    </div>

                </div>

            </div>



            <!-- Global Actions Card -->

            <div class="card">

                <h3 style="margin-bottom: 15px;">🗑️ Nettoyage</h3>

                <p style="margin-bottom: 15px; font-size: 0.9rem;">Supprimer définitivement tous les messages du système.</p>

                <button class="btn btn-danger" style="background: var(--danger); color: white;" onclick="deleteAllMessages()">

                    ⚠️ Supprimer TOUS les messages

                </button>

            </div>

        </div>



        <!-- Messages List -->

        <div class="card">

            <h3 style="margin-bottom: 15px;">📨 Tous les messages système</h3>

            <div id="admin-messages-list">

                <div class="text-center"><div class="loading"></div></div>

            </div>

        </div>

    `;



    loadAdminMessagesList();

}



async function saveMessageConfig() {

    const duration = document.getElementById('config-duration').value;



    if (!duration || duration < 1) {

        alert("Veuillez entrer une durée valide.");

        return;

    }



    try {

        await db.collection('system').doc('config').set({

            messageDuration: Number(duration),

            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),

            updatedBy: auth.currentUser.uid

        }, { merge: true });



        // Update local global config if strictly needed immediately, but reload does it

        if (window.SYSTEM_CONFIG) window.SYSTEM_CONFIG.messageDuration = Number(duration);



        alert("Configuration enregistrée avec succès !");

    } catch (e) {

        console.error("Save config error:", e);

        alert("Erreur lors de l'enregistrement.");

    }

}



async function deleteAllMessages() {

    if (!confirm("ATTENTION: Vous êtes sur le point de supprimer TOUS les messages de la plateforme. Cette action est irréversible. Continuer ?")) {

        return;

    }



    const btn = document.querySelector('button[onclick="deleteAllMessages()"]');

    const originalText = btn.textContent;

    btn.textContent = "Suppression en cours...";

    btn.disabled = true;



    try {

        const snapshot = await db.collection('messages').get();

        const batchSize = 400;

        let batch = db.batch();

        let count = 0;

        let totalDeleted = 0;



        for (const doc of snapshot.docs) {

            batch.delete(doc.ref);

            count++;

            if (count >= batchSize) {

                await batch.commit();

                batch = db.batch();

                totalDeleted += count;

                count = 0;

            }

        }

        if (count > 0) {

            await batch.commit();

            totalDeleted += count;

        }



        alert(`${totalDeleted} messages supprimés.`);

        loadAdminMessagesList();

    } catch (e) {

        console.error("Delete all error:", e);

        alert("Erreur lors de la suppression massive.");

    } finally {

        btn.textContent = originalText;

        btn.disabled = false;

    }

}



async function loadAdminMessagesList() {

    const container = document.getElementById('admin-messages-list');



    try {

        const snapshot = await db.collection('messages').orderBy('createdAt', 'desc').limit(50).get();



        if (snapshot.empty) {

            container.innerHTML = '<p class="text-center text-secondary">Aucun message dans le système.</p>';

            return;

        }



        let html = '<div class="table-container"><table class="table">';

        html += '<thead><tr><th>Titre</th><th>Envoyé par</th><th>Vues</th><th>Date</th><th>Actions</th></tr></thead><tbody>';



        snapshot.forEach(doc => {

            const data = doc.data();

            const date = data.createdAt ? new Date(data.createdAt.toDate()).toLocaleDateString() : '-';

            const readCount = data.readBy ? data.readBy.length : 0;



            html += `

                <tr>

                    <td><strong>${data.title}</strong><br><small class="text-secondary">${data.content.substring(0, 30)}...</small></td>

                    <td>${data.senderName || '?'}</td>

                    <td>${readCount}</td>

                    <td>${date}</td>

                    <td>

                        <button class="btn btn-secondary btn-small" onclick="deleteMessage('${doc.id}')" style="color: var(--danger); padding: 5px 10px;">🗑️</button>

                    </td>

                </tr>

            `;

        });

        html += '</tbody></table></div>';

        container.innerHTML = html;



    } catch (e) {

        container.innerHTML = `<p class="text-error">Erreur chargement: ${e.message}</p>`;

    }

}



async function deleteMessage(id) {

    if (!confirm("Supprimer ce message ?")) return;

    try {

        await db.collection('messages').doc(id).delete();

        loadAdminMessagesList(); // Reload list

    } catch (e) {

        alert("Erreur suppression: " + e.message);

    }

}



// Override initNotificationsView for Admin context (called by showAdminView)

// But wait, showAdminView calls initNotificationsView. We should rename this or change the call in showAdminView.

// Since we can't easily jump to showAdminView in this Tool call without replacing the whole file,

// we will export initAdminNotificationsView and I will do a second pass to update showAdminView logic if needed

// OR I can overwrite `initNotificationsView` specifically for the admin scope if this file loads AFTER notifications.js?

// Safer: I will update the `showAdminView` function in the file to call `initAdminNotificationsView` appropriately.



window.initAdminNotificationsView = initAdminNotificationsView;

window.saveMessageConfig = saveMessageConfig;

window.deleteAllMessages = deleteAllMessages;

window.deleteMessage = deleteMessage;





// Afficher tous les utilisateurs

// Afficher tous les utilisateurs avec recherche

/**
 * Redesign Premium: Affichage des utilisateurs sous forme de cartes
 */
function displayUsers() {
    try {
        const container = document.getElementById('users-list');
        if (!container) {
            console.error("DEBUG: #users-list not found");
            return;
        }

        const searchTerm = document.getElementById('user-search') ? document.getElementById('user-search').value.toLowerCase().trim() : '';

        // Filtrer les utilisateurs
        const filteredUsers = allUsers.filter(user => {
            const matchesName = (user.fullName || '').toLowerCase().includes(searchTerm);
            const matchesEmail = (user.email || '').toLowerCase().includes(searchTerm);
            const matchesNiveau = (user.niveau || '').toLowerCase().includes(searchTerm);
            const matchesMajor = (user.filiere || user.major || '').toLowerCase().includes(searchTerm);
            return matchesName || matchesEmail || matchesNiveau || matchesMajor;
        });

        if (filteredUsers.length === 0) {
            container.innerHTML = '<div class="card text-center" style="padding: 50px;"><p style="color: var(--text-secondary);">Aucun utilisateur ne correspond à votre recherche.</p></div>';
            return;
        }

        // Sort: Delegates first, then by name
        filteredUsers.sort((a, b) => {
            if (a.role === 'delegate' && b.role !== 'delegate') return -1;
            if (a.role !== 'delegate' && b.role === 'delegate') return 1;
            return (a.fullName || '').localeCompare(b.fullName || '');
        });

        let html = '<div class="users-grid">';

        filteredUsers.forEach(user => {
            const initials = (user.fullName || 'U').split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);

            // Status & Role Badges
            let badgesHtml = '';
            if (user.role === 'delegate') badgesHtml += '<span class="user-tag tag-role">🛡️ Délégué</span>';
            if (user.role === 'admin') badgesHtml += '<span class="user-tag tag-role" style="background:var(--accent); color:white;">⚡ Admin</span>';
            if (user.niveau) badgesHtml += `<span class="user-tag tag-niveau">${user.niveau}</span>`;
            if (user.niveau === 'Lauréat' && user.mentorStatus === 'approved') badgesHtml += '<span class="user-tag tag-mentor">🏅 Mentor</span>';
            if (user.isSuspended) badgesHtml += '<span class="user-tag tag-suspended">🚫 Suspendu</span>';

            // Actions structure
            let dropdownHtml = '';
            try {
                const dropdownActions = [
                    { label: 'Modifier Infos', icon: '📝', onclick: `openEditUserModal('${user.uid}')` }
                ];

                if (auth.currentUser && user.uid !== auth.currentUser.uid) {
                    if (user.isSuspended) {
                        dropdownActions.push({ label: 'Réactiver', icon: '🔓', onclick: `unsuspendUser('${user.uid}')` });
                    } else {
                        dropdownActions.push({ label: 'Suspendre', icon: '🚫', class: 'danger', onclick: `suspendUser('${user.uid}')` });
                    }
                }

                if (user.role === 'student') {
                    dropdownActions.push({ label: 'Promouvoir Délégué', icon: '🛡️', onclick: `promoteToDelegate('${user.uid}')` });
                } else if (user.niveau === 'Lauréat' && !user.isApproved) {
                    dropdownActions.push({ label: 'Valider Lauréat', icon: '✅', onclick: `approveAlumni('${user.uid}')` });
                }

                dropdownHtml = renderActionDropdown(dropdownActions);
            } catch (err) {
                console.error("Error generating actions for user " + user.uid, err);
                dropdownHtml = '<span style="color:red">!</span>';
            }

            // Card classes
            let cardClass = 'user-premium-card fade-in';
            if (user.isSuspended) cardClass += ' card-suspended';
            else if (user.role === 'delegate') cardClass += ' card-delegate';
            else if (user.role === 'admin') cardClass += ' card-admin';

            html += `
                <div class="${cardClass}">
                    <div class="user-card-header">
                        <div class="user-avatar-circle">${initials}</div>
                        <div class="user-main-info">
                            <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
                                <span class="user-name-title">${user.fullName || 'Utilisateur'}</span>
                                ${dropdownHtml}
                            </div>
                            <span class="user-email-sub">${user.email}</span>
                        </div>
                    </div>

                    <div class="user-card-tags">
                        ${badgesHtml}
                    </div>

                    <div class="user-card-details">
                        <div class="detail-item">
                            <span class="detail-label">Branche:</span>
                            <span class="detail-value">${user.filiere || user.major || '---'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Classe:</span>
                            <span class="detail-value">${user.classe ? 'N°' + user.classe : '---'}</span>
                        </div>
                        ${user.promo ? `<div class="detail-item"><span class="detail-label">Promotion:</span><span class="detail-value">${user.promo}</span></div>` : ''}
                    </div>
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;

    } catch (e) {
        console.error("Error in displayUsers:", e);
        const container = document.getElementById('users-list');
        if (container) container.innerHTML = `<div class="card text-center"><p class="text-error">Erreur d'affichage: ${e.message}</p></div>`;
    }
}



// Afficher toutes les demandes

async function displayAllRequests() {

    const container = document.getElementById('requests-all-list');



    if (allRequests.length === 0) {

        container.innerHTML = '<div class="card text-center"><p style="color: var(--text-secondary);">Aucune demande</p></div>';

        return;

    }



    let html = '<div class="table-container"><table class="table">';

    html += '<thead><tr><th>Utilisateur</th><th>Type / Filière</th><th>Statut</th><th>Date</th><th>Actions</th></tr></thead><tbody>';



    for (const request of allRequests) {

        let reqType = 'Étudiant';

        let filiereName = 'N/A';



        if (request.type === 'MENTOR_REQUEST') {

            reqType = '<span class="badge" style="background: var(--accent-color); color: white;">MENTORAT</span>';

            filiereName = 'Demande Mentor';

        } else {

            const filiere = allFilieres.find(f => f.id === request.filiereId);

            if (filiere) filiereName = filiere.name;

        }



        const statusBadge =

            request.status === 'pending' ? '<span class="badge badge-pending">En attente</span>' :

                request.status === 'approved' ? '<span class="badge badge-approved">Approuvée</span>' :

                    '<span class="badge badge-rejected">Rejetée</span>';



        const date = request.createdAt ? new Date(request.createdAt.toDate()).toLocaleDateString('fr-FR') : 'N/A';



        const dropdownActions = [];

        if (request.status === 'pending') {

            if (request.type === 'MENTOR_REQUEST') {

                dropdownActions.push({ label: 'Valider Mentor', icon: '🎓', onclick: `approveMentorFromRequest('${request.id}', '${request.userId}')` });

                dropdownActions.push({ label: 'Rejeter', icon: '✗', class: 'danger', onclick: `adminRejectRequest('${request.id}')` });

            } else {

                dropdownActions.push({ label: 'Approuver', icon: '✓', onclick: `adminApproveRequest('${request.id}')` });

                dropdownActions.push({ label: 'Rejeter', icon: '✗', class: 'danger', onclick: `adminRejectRequest('${request.id}')` });

            }

        }



        html += `

            <tr>

                <td><strong>${request.userName}</strong></td>

                <td>

                    ${request.type === 'MENTOR_REQUEST' ? reqType : filiereName}

                </td>

                <td>${statusBadge}</td>

                <td>${date}</td>

                <td>${renderActionDropdown(dropdownActions)}</td>

            </tr>

        `;

    }



    html += '</tbody></table></div>';

    container.innerHTML = html;

}



// Promouvoir un utilisateur en délégué

async function promoteToDelegate(userId) {

    if (!confirm('Voulez-vous vraiment promouvoir cet utilisateur en délégué ?')) return;



    try {

        await usersRef.doc(userId).update({

            role: 'delegate',

            updatedAt: firebase.firestore.FieldValue.serverTimestamp()

        });



        await logAction('PROMOTE_TO_DELEGATE', userId);

        showSuccess('admin-message', 'Utilisateur promu en délégué avec succès !');

        await loadAllUsers();

        displayUsers();

    } catch (error) {

        console.error('Erreur lors de la promotion:', error);

        showError('admin-message', 'Erreur lors de la promotion de l\'utilisateur.');

    }

}



// Logique dynamique pour le formulaire des filières (Triple Logic)
window.handleAdminLevelChange = function (level) {
    console.log('Level changed to:', level);
    const majorSelect = document.getElementById('filiere-major');
    const classInput = document.getElementById('filiere-class');
    const previewEl = document.getElementById('filiere-preview');

    // Reset
    majorSelect.innerHTML = '<option value="">-- Sélectionner Filière --</option>';
    majorSelect.disabled = true;
    classInput.disabled = true;
    classInput.value = '';
    if (previewEl) previewEl.textContent = '';

    if (!level) return;

    if (typeof SchoolStructure === 'undefined') {
        console.error("SchoolStructure non chargée - vérifiez l'ordre des scripts");
        return;
    }

    const validMajors = SchoolStructure.getMajorsForLevel(level);
    console.log('Valid majors for level:', validMajors);

    if (validMajors && validMajors.length > 0) {
        majorSelect.disabled = false;
        majorSelect.innerHTML = '<option value="">-- Sélectionner Filière --</option>';
        validMajors.forEach(code => {
            const opt = document.createElement('option');
            opt.value = code;
            opt.textContent = `${code} - ${SchoolStructure.MajorLabels[code] || code}`;
            majorSelect.appendChild(opt);
        });

        // Auto-select if only one
        if (validMajors.length === 1) {
            majorSelect.value = validMajors[0];
            window.handleAdminMajorChange(validMajors[0]);
        }
    } else {
        console.warn('Aucune filière trouvée pour le niveau:', level);
    }
};

window.handleAdminMajorChange = function (major) {
    const level = document.getElementById('filiere-level').value;
    const classInput = document.getElementById('filiere-class');
    const hintEl = document.getElementById('admin-class-hint');

    if (!major || !level) {
        classInput.disabled = true;
        classInput.value = '';
        if (hintEl) hintEl.textContent = '';
        return;
    }

    classInput.disabled = false;

    // Set default value and max based on school rules
    if (major === 'TCT') {
        if (hintEl) hintEl.textContent = "Classes 1 à 6";
        classInput.max = 6;
    } else if (SchoolStructure.Majors.BAC.includes(major)) {
        if (hintEl) hintEl.textContent = "Classes 1 ou 2";
        classInput.max = 2;
    } else {
        if (hintEl) hintEl.textContent = "Classe unique";
        classInput.value = 1;
        classInput.max = 1;
    }

    updateFilierePreview();
};

// Add listener for class input change
document.addEventListener('input', (e) => {
    if (e.target.id === 'filiere-class') {
        updateFilierePreview();
    }
});

function updateFilierePreview() {
    const level = document.getElementById('filiere-level').value;
    const major = document.getElementById('filiere-major').value;
    const classNum = document.getElementById('filiere-class').value;
    const previewEl = document.getElementById('filiere-preview');

    if (level && major && classNum) {
        previewEl.innerHTML = `<span style="opacity: 0.5; font-size: 0.8rem; vertical-align: middle; margin-right: 10px;">PREVIEW:</span> ${SchoolStructure.formatClassName(level, major, classNum)}`;
    } else {
        previewEl.textContent = '';
    }
}

// Ajouter une filière
async function addFiliere(e) {
    e.preventDefault();

    const level = document.getElementById('filiere-level').value;
    const major = document.getElementById('filiere-major').value;
    const classNum = parseInt(document.getElementById('filiere-class').value);
    const description = document.getElementById('filiere-description').value;
    const delegateId = document.getElementById('filiere-delegate').value;
    const whatsappLink = document.getElementById('filiere-whatsapp').value;

    // Validation via SchoolStructure
    const validation = SchoolStructure.validate(level, major, classNum);
    if (!validation.isValid) {
        ui.showError('admin-message', validation.error);
        return;
    }
    const fullName = SchoolStructure.formatClassName(level, major, classNum);

    try {
        const docRef = await filieresRef.add({
            name: fullName,
            level: level,
            major: major,
            class: classNum,
            niveau: level, // Legacy support
            description: description,
            delegateId: delegateId || null,
            whatsappLink: whatsappLink || null,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        await logAction('ADD_FILIERE', docRef.id, { name: fullName, level: level, major: major });
        showSuccess('admin-message', `Filière "${fullName}" créée avec succès !`);

        document.getElementById('filiere-form').reset();
        handleAdminLevelChange(''); // Clear selects

        await loadAllFilieres();
    } catch (error) {
        console.error('Erreur lors de la création:', error);
        showError('admin-message', 'Erreur lors de la création de la filière.');
    }
}



// Modifier une filière

// --- Edit Filiere Logic with Modal ---

function openEditFiliereModal(filiereId) {
    const filiere = allFilieres.find(f => f.id === filiereId);
    if (!filiere) return;

    document.getElementById('edit-filiere-id').value = filiereId;
    document.getElementById('edit-filiere-name').value = filiere.name || 'Filière';
    document.getElementById('edit-filiere-whatsapp').value = filiere.whatsappLink || '';

    // Populate Delegates Dropdown in Modal
    const delegateSelect = document.getElementById('edit-filiere-delegate');
    delegateSelect.innerHTML = '<option value="">-- Aucun délégué --</option>';

    // Filter logic: Only users with role 'delegate'
    const adminModeDelegates = allUsers.filter(u => u.role === 'delegate');

    adminModeDelegates.forEach(del => {
        const option = document.createElement('option');
        option.value = del.uid;
        option.textContent = del.fullName + (del.filiere ? ` (${del.filiere})` : '');
        if (del.uid === filiere.delegateId) option.selected = true;
        delegateSelect.appendChild(option);
    });

    document.getElementById('edit-filiere-modal').classList.remove('hidden');
}

function closeEditFiliereModal() {
    document.getElementById('edit-filiere-modal').classList.add('hidden');
}

async function updateFiliere(e) {
    e.preventDefault();
    const filiereId = document.getElementById('edit-filiere-id').value;
    const delegateId = document.getElementById('edit-filiere-delegate').value;
    const whatsappLink = document.getElementById('edit-filiere-whatsapp').value;

    const filiere = allFilieres.find(f => f.id === filiereId);
    if (!filiere) return;

    try {
        const batch = db.batch(); // Utiliser un batch pour garantir la cohérence
        const filiereRef = filieresRef.doc(filiereId);

        // 1. Mettre à jour la filière
        batch.update(filiereRef, {
            delegateId: delegateId || null,
            whatsappLink: whatsappLink || null,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // 2. Si un délégué est sélectionné, mettre à jour son profil utilisateur
        if (delegateId) {
            const userRef = usersRef.doc(delegateId);
            batch.update(userRef, {
                filiere: filiere.major, // ex: 'MPSI'
                niveau: filiere.level,  // ex: 'CPGE'
                classe: filiere.class   // ex: '1'
            });
            console.log(`Préparation mise à jour profil pour ${delegateId}:`, { major: filiere.major, level: filiere.level, class: filiere.class });
        }

        // 3. Optionnel : Si l'ancien délégué est différent et existe, on pourrait nettoyer son profil, 
        // mais c'est risqué sans savoir s'il est réassigné ailleurs. On laisse tel quel pour l'instant.

        await batch.commit(); // Exécuter toutes les mises à jour

        // Determine delegate name for logs
        const delegateUser = allUsers.find(u => u.uid === delegateId);
        const delegateName = delegateUser ? delegateUser.fullName : 'Aucun';

        await logAction('EDIT_FILIERE', filiereId, {
            name: filiere.name,
            newDelegate: delegateName,
            whatsapp: whatsappLink
        });

        showSuccess('admin-message', 'Filière et profil délégué mis à jour avec succès !');
        closeEditFiliereModal();
        await loadAllFilieres();

    } catch (error) {
        console.error('Erreur lors de la modification:', error);
        showError('admin-message', 'Erreur lors de la modification: ' + error.message);
    }
}



// Supprimer une filière

async function deleteFiliere(filiereId) {

    if (!confirm('Êtes-vous sûr de vouloir supprimer cette filière ?')) return;



    try {

        await filieresRef.doc(filiereId).delete();

        await logAction('DELETE_FILIERE', filiereId);

        showSuccess('admin-message', 'Filière supprimée avec succès !');

        await loadAllFilieres();

    } catch (error) {

        console.error('Erreur lors de la suppression:', error);

        showError('admin-message', 'Erreur lors de la suppression de la filière.');

    }

}



/**
 
 * PHASE 11: GESTION DES LAURÉATS
 
 */



// Afficher les lauréats en attente

async function displayPendingAlumni() {

    const container = document.getElementById('alumni-pending-list');

    if (!container) return;



    try {

        // Utilisation d'un seul filtre pour éviter l'erreur d'index composite

        const snapshot = await usersRef.where('niveau', '==', 'Lauréat').get();



        if (snapshot.empty) {

            container.innerHTML = '<div class="card text-center"><p style="color: var(--text-secondary);">Aucun lauréat trouvé.</p></div>';

            return;

        }



        let pending = [];

        snapshot.forEach(doc => {

            const data = doc.data();

            if (data.isApproved === false) {

                pending.push({ id: doc.id, ...data });

            }

        });



        if (pending.length === 0) {

            container.innerHTML = '<div class="card text-center"><p style="color: var(--text-secondary);">Aucun lauréat en attente d\'approbation.</p></div>';

            return;

        }



        let html = '<div class="grid grid-2">';

        pending.forEach(user => {

            const dropdownActions = [

                { label: 'Approuver Compte', icon: '✅', onclick: `approveAlumni('${user.id}')` }

            ];



            html += `

                <div class="card fade-in" style="border-left: 4px solid var(--accent-color);">

                    <div class="flex" style="justify-content: space-between; align-items: start;">

                        <div>

                            <h4 style="font-weight: 600;">🎓 ${user.fullName}</h4>

                            <p style="font-size: 0.85rem; color: var(--text-secondary);">

                                <strong>Promo ${user.promo || 'N/A'}</strong>

                            </p>

                            <p style="font-size: 0.75rem; color: var(--text-secondary);">${user.email}</p>

                        </div>

                        ${renderActionDropdown(dropdownActions)}

                    </div>

                </div>

            `;

        });

        html += '</div>';

        container.innerHTML = html;



    } catch (error) {

        container.innerHTML = `<div class="card text-center"><p class="text-error">Erreur de chargement : ${error.message}</p></div>`;

    }

}



// Approuver un lauréat

async function approveAlumni(userId) {

    try {

        await usersRef.doc(userId).update({

            isApproved: true,

            updatedAt: firebase.firestore.FieldValue.serverTimestamp()

        });

        await logAction('APPROVE_ALUMNI', userId);

        alert('Compte Lauréat approuvé ! Il peut désormais se connecter.');

        displayPendingAlumni();

    } catch (error) {
        console.error('Erreur lors de l\'approbation:', error);
        alert('Erreur lors de l\'approbation.');
    }
}

// Approuver un Mentor
async function approveMentor(userId, alertId = null) {
    if (!confirm('Voulez-vous approuver ce lauréat en tant que Mentor officiel ?')) return;

    try {
        await usersRef.doc(userId).update({
            mentorStatus: 'approved',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        await logAction('APPROVE_MENTOR', userId);

        // Si on vient d'une alerte, on la résout
        if (alertId) {
            await db.collection('support_alerts').doc(alertId).update({
                status: 'resolved',
                resolvedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            loadSupportAlerts();
        }

        showSuccess('admin-message', 'Mentor approuvé avec succès !');
        await loadAllUsers();
        displayUsers();
    } catch (error) {
        console.error('Erreur approbation mentor:', error);
        showError('admin-message', 'Erreur lors de l\'approbation du mentor.');
    }
}


/**
 * OVERRIDE ADMIN: VALIDATION DES DEMANDES ÉTUDIANTS
 */



// Approuver une demande étudiant (Override Admin)

async function adminApproveRequest(requestId) {

    if (!confirm('Voulez-vous vraiment approuver cette demande au nom du délégué ?')) return;



    try {

        await requestsRef.doc(requestId).update({

            status: 'approved',

            processedBy: auth.currentUser.uid, // Marqué comme traité par l'admin

            processedAt: firebase.firestore.FieldValue.serverTimestamp(),

            updatedAt: firebase.firestore.FieldValue.serverTimestamp()

        });



        await logAction('ADMIN_APPROVE_REQUEST', requestId, { student: requestId });

        showSuccess('admin-message', 'Demande approuvée par l\'administrateur !');

        loadAllRequests(); // Recharger les données

    } catch (error) {

        console.error('Erreur Admin Approbation:', error);

        showError('admin-message', 'Erreur lors de l\'approbation Admin.');

    }

}



// Rejeter une demande étudiant (Override Admin)

async function adminRejectRequest(requestId) {

    const reason = prompt('Raison du rejet par l\'administrateur :');

    if (reason === null) return;



    try {

        await requestsRef.doc(requestId).update({

            status: 'rejected',

            delegateComment: `[ADMIN] ${reason || 'Refusé par l\'administrateur.'}`,

            processedBy: auth.currentUser.uid,

            processedAt: firebase.firestore.FieldValue.serverTimestamp(),

            updatedAt: firebase.firestore.FieldValue.serverTimestamp()

        });



        await logAction('ADMIN_REJECT_REQUEST', requestId, { reason: reason });

        showSuccess('admin-message', 'Demande rejetée par l\'administrateur.');

        loadAllRequests();

    } catch (error) {

        console.error('Erreur Admin Rejet:', error);

        showError('admin-message', 'Erreur lors du rejet Admin.');

    }

}



// Approuver un Mentor depuis l'onglet Demandes

async function approveMentorFromRequest(requestId, userId) {

    if (!confirm('Voulez-vous approuver ce lauréat en tant que Mentor officiel et clore la demande ?')) return;



    try {

        // 1. Mettre à jour l'utilisateur

        await usersRef.doc(userId).update({

            mentorStatus: 'approved',

            updatedAt: firebase.firestore.FieldValue.serverTimestamp()

        });



        // 2. Mettre à jour la demande comme "approved"

        await requestsRef.doc(requestId).update({

            status: 'approved',

            processedBy: auth.currentUser.uid,

            processedAt: firebase.firestore.FieldValue.serverTimestamp(),

            updatedAt: firebase.firestore.FieldValue.serverTimestamp()

        });



        await logAction('APPROVE_MENTOR_REQUEST', requestId, { userId: userId });



        showSuccess('admin-message', 'Mentor approuvé et demande clôturée avec succès !');

        loadAllRequests(); // Recharger la liste

    } catch (error) {

        console.error('Erreur approbation mentor (Request):', error);

        showError('admin-message', 'Erreur lors de l\'approbation.');

    }

}



/**
 
 * PHASE 12: BACKUP & RESTORE
 
 */



// Exporter les données (Backup)

async function exportData() {

    const btnText = document.getElementById('export-text');

    const loading = document.getElementById('export-loading');



    btnText.classList.add('hidden');

    loading.classList.remove('hidden');



    try {

        const collections = ['users', 'filieres', 'events', 'requests', 'logs', 'support_alerts'];

        const backupData = {

            timestamp: new Date().toISOString(),

            version: '1.0',

            data: {}

        };



        for (const colName of collections) {

            const snapshot = await db.collection(colName).get();

            backupData.data[colName] = {};

            snapshot.forEach(doc => {

                // Convertir les Timestamps Firestore en ISO strings pour le JSON

                const data = doc.data();

                for (const key in data) {

                    if (data[key] && typeof data[key].toDate === 'function') {

                        data[key] = data[key].toDate().toISOString();

                    }

                }

                backupData.data[colName][doc.id] = data;

            });

        }



        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));

        const downloadAnchorNode = document.createElement('a');

        downloadAnchorNode.setAttribute("href", dataStr);

        downloadAnchorNode.setAttribute("download", "ibn_sina_backup_" + new Date().toISOString().slice(0, 10) + ".json");

        document.body.appendChild(downloadAnchorNode);

        downloadAnchorNode.click();

        downloadAnchorNode.remove();



        showSuccess('admin-message', 'Sauvegarde téléchargée avec succès !');



    } catch (error) {

        console.error('Erreur export:', error);

        showError('admin-message', 'Erreur lors de l\'exportation: ' + error.message);

    } finally {

        if (btnText) btnText.classList.remove('hidden');

        if (loading) loading.classList.add('hidden');

    }

}



// Importer les données (Restore)

async function importData() {

    const fileInput = document.getElementById('import-file');

    const file = fileInput.files[0];



    if (!file) {

        alert('Veuillez sélectionner un fichier JSON de sauvegarde.');

        return;

    }



    if (!confirm('ATTENTION : Cette action va restaurer les données et écraser les éléments existants avec les mêmes IDs. Êtes-vous sûr de vouloir continuer ?')) {

        return;

    }



    const btnText = document.getElementById('import-text');

    const loading = document.getElementById('import-loading');

    const statusDiv = document.getElementById('import-status');



    btnText.classList.add('hidden');

    loading.classList.remove('hidden');

    statusDiv.textContent = "Lecture du fichier...";

    statusDiv.classList.remove('hidden');

    statusDiv.className = ""; // Reset classes



    const reader = new FileReader();



    reader.onload = async function (e) {

        try {

            const backup = JSON.parse(e.target.result);

            if (!backup.data) throw new Error("Format de fichier invalide.");



            const collections = Object.keys(backup.data);

            let totalDocs = 0;

            let processedDocs = 0;



            // Compter le total

            collections.forEach(col => {

                totalDocs += Object.keys(backup.data[col]).length;

            });



            // Batch writes (limite 500 opérations par batch)

            const BATCH_SIZE = 400;

            let batch = db.batch();

            let opCount = 0;

            let batchCount = 0;



            for (const colName of collections) {

                const docs = backup.data[colName];

                for (const docId in docs) {

                    const docData = docs[docId];

                    const docRef = db.collection(colName).doc(docId);



                    // Conversion basique des dates ISO strings

                    ['createdAt', 'updatedAt', 'date', 'timestamp', 'processedAt', 'mentorRequestDate', 'resolvedAt'].forEach(field => {

                        if (docData[field] && typeof docData[field] === 'string' && docData[field].match(/^\d{4}-\d{2}-\d{2}T/)) {

                            docData[field] = firebase.firestore.Timestamp.fromDate(new Date(docData[field]));

                        }

                    });



                    batch.set(docRef, docData, { merge: true });

                    opCount++;

                    processedDocs++;



                    if (opCount >= BATCH_SIZE) {

                        await batch.commit();

                        batch = db.batch();

                        opCount = 0;

                        batchCount++;

                        statusDiv.textContent = `Progression : ${processedDocs} / ${totalDocs} documents traités...`;

                    }

                }

            }



            if (opCount > 0) {

                await batch.commit();

            }



            statusDiv.textContent = `Terminé ! ${processedDocs} documents restaurés.`;

            statusDiv.className = "text-success";

            showSuccess('admin-message', "Restauration terminée avec succès.");



            // Recharger les données de l'interface

            if (typeof initAdminDashboard === 'function') await initAdminDashboard();



        } catch (error) {

            console.error('Erreur import:', error);

            statusDiv.textContent = "Erreur : " + error.message;

            statusDiv.className = "text-error";

            showError('admin-message', 'Erreur critique lors de l\'importation.');

        } finally {

            if (btnText) btnText.classList.remove('hidden');

            if (loading) loading.classList.add('hidden');

        }

    };



    reader.readAsText(file);

}

// --- FONCTIONS DE VALIDATION DECENTRALISEE ---



// Afficher les utilisateurs en attente de validation


// Afficher les utilisateurs en attente de validation
function displayValidations() {
    const priorityContainer = document.getElementById('validation-priority-list');
    const studentsContainer = document.getElementById('validation-students-list');

    // Filtrer les utilisateurs non approuvés
    const unapproved = allUsers.filter(u => !u.isApproved);

    // Séparer en deux groupes
    // Priorité : Délégués et Lauréats
    const priorityUsers = unapproved.filter(u => u.role === 'delegate' || u.role === 'alumni' || u.niveau === 'Lauréat');

    // Étudiants (normalement gérés par Délégués, mais Admin voit tout)
    const studentUsers = unapproved.filter(u => !priorityUsers.includes(u));

    // --- RENDER PRIORITY LIST (Délégués uniquement maintenant, les Lauréats sont dans leur onglet) ---
    // On filtre à nouveau pour être sûr de ne pas afficher les Lauréats ici si on veut être strict,
    // mais la consigne dit "Validations = étudiants / délégués".
    const delegatesOnly = priorityUsers.filter(u => u.role === 'delegate');

    if (delegatesOnly.length === 0) {
        priorityContainer.innerHTML = '<div class="card text-center"><p style="color: var(--text-secondary);">Aucun délégué en attente.</p></div>';
    } else {
        let html = '';
        delegatesOnly.forEach(user => {
            const roleBadge = '<span class="badge badge-pending">Délégué</span>';
            const classeDisplay = user.classe ? `<span class="badge" style="background: var(--bg-alt); color: var(--text-secondary); border: 1px solid var(--border-color); font-size: 0.75rem;">Classe ${user.classe}</span>` : '';

            html += `
                <div class="card user-card">
                    <div class="user-card-header">
                        <div class="user-avatar">${user.fullName ? user.fullName.charAt(0).toUpperCase() : '?'}</div>
                        <div class="user-info-main">
                            <h4>${user.fullName}</h4>
                            <div class="user-meta">
                                ${roleBadge}
                                <span style="font-size: 0.85rem; color: var(--text-secondary);">${user.niveau || '-'}</span>
                                ${classeDisplay}
                            </div>
                        </div>
                    </div>
                    <div class="flex gap-1">
                        <button class="btn btn-success btn-small" onclick="approveUser('${user.uid}')">Valider</button>
                        <button class="btn btn-danger btn-small" onclick="rejectUserValidation('${user.uid}', 'delegate')">Rejeter</button>
                    </div>
                </div>
            `;
        });
        priorityContainer.innerHTML = html;
    }

    // --- RENDER STUDENT LIST ---
    // Exclure explicitement les lauréats mal classés
    const strictStudents = studentUsers.filter(u => u.niveau !== 'Lauréat' && u.role !== 'alumni');

    if (strictStudents.length === 0) {
        studentsContainer.innerHTML = '<div class="card text-center"><p style="color: var(--text-secondary);">Aucun étudiant en attente.</p></div>';
    } else {
        let html = '';
        strictStudents.forEach(user => {
            const classeDisplay = user.classe ? `<span class="badge" style="background: var(--bg-alt); color: var(--text-secondary); border: 1px solid var(--border-color); font-size: 0.75rem;">Cl. ${user.classe}</span>` : '';
            html += `
                <div class="card flex" style="justify-content: space-between; align-items: center; margin-bottom: 10px; background: var(--bg-tertiary);">
                    <div>
                        <div style="font-weight: 600;">${user.fullName}</div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary);">${user.email} • ${user.niveau} ${classeDisplay}</div>
                    </div>
                    <div class="flex gap-1">
                        <button class="btn btn-success btn-small" onclick="approveUser('${user.uid}')">Valider</button>
                        <button class="btn btn-secondary btn-small" onclick="rejectUserValidation('${user.uid}', 'student')">Refuser</button>
                    </div>
                </div>
            `;
        });
        studentsContainer.innerHTML = html;
    }

    // Charger l'historique des validations (filtré sur APPROVE_USER / REJECT_USER)
    if (typeof displayActionHistory === 'function') {
        displayActionHistory('validation-history-list', ['APPROVE_USER', 'REJECT_USER_VALIDATION']);
    }
}

// Rejeter une inscription (Nouveau)
async function rejectUserValidation(userId, type) {
    const reason = prompt("Motif du rejet (obligatoire) :");
    if (!reason) return;

    try {
        await usersRef.doc(userId).update({
            isApproved: false,
            isSuspended: true,
            rejectionReason: reason,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        await logAction('REJECT_USER_VALIDATION', userId, { reason: reason, userType: type });
        showSuccess('admin-message', 'Utilisateur rejeté avec motif.');

        // Refresh
        await loadAllUsers();
        displayValidations();
    } catch (error) {
        console.error("Erreur rejet:", error);
        showError('admin-message', "Erreur lors du rejet.");
    }
}

// Helper pour afficher l'historique des actions
async function displayActionHistory(containerId, actionTypes = []) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '<p class="text-center" style="color: var(--text-secondary); font-size: 0.85rem;">Chargement de l\'historique...</p>';

    try {
        let query = logsRef.orderBy('timestamp', 'desc').limit(20);

        if (actionTypes.length > 0) {
            query = logsRef.where('actionType', 'in', actionTypes).orderBy('timestamp', 'desc').limit(20);
        }

        const snapshot = await query.get();

        if (snapshot.empty) {
            container.innerHTML = '<p class="text-center" style="color: var(--text-secondary); font-size: 0.85rem;">Aucun historique récent.</p>';
            return;
        }

        let html = '<table class="table table-sm" style="font-size: 0.85rem;"><thead><tr><th>Action</th><th>Cible</th><th>Détails</th><th>Date</th></tr></thead><tbody>';

        snapshot.forEach(doc => {
            const log = doc.data();
            const date = log.timestamp ? new Date(log.timestamp.toDate()).toLocaleString('fr-FR') : '-';

            let detailsStr = '';
            if (log.details) {
                if (log.details.reason) detailsStr += `Motif: "${log.details.reason}" `;
                if (log.details.userType) detailsStr += `(${log.details.userType})`;
            }

            let badgeClass = 'badge-secondary';
            if (log.actionType && (log.actionType.includes('REJECT') || log.actionType.includes('SUSPEND'))) badgeClass = 'badge-rejected';
            if (log.actionType && (log.actionType.includes('APPROVE') || log.actionType.includes('PROMOTE'))) badgeClass = 'badge-approved';

            html += `
                <tr>
                    <td><span class="badge ${badgeClass}">${log.actionType}</span></td>
                    <td>${log.targetId || '?'}</td>
                    <td>${detailsStr}</td>
                    <td>${date}</td>
                </tr>
            `;
        });

        html += '</tbody></table>';
        container.innerHTML = html;

    } catch (error) {
        console.error("Error loading history:", error);
        container.innerHTML = '<p class="text-error" style="font-size: 0.85rem;">Erreur chargement historique.</p>';
    }
}

// --- AJOUTS MANQUANTS POUR LES ONGLETS ---

// Charger l'historique des messages marketing
async function loadAdminMessagesList() {
    const container = document.getElementById('admin-messages-list');
    if (!container) return;

    try {
        container.innerHTML = '<p class="text-center" style="color: var(--text-secondary);">Chargement des communications...</p>';
        const snapshot = await db.collection('messages').orderBy('createdAt', 'desc').limit(20).get();

        if (snapshot.empty) {
            container.innerHTML = '<div class="card text-center"><p style="color: var(--text-secondary);">Aucune communication envoyée.</p></div>';
            return;
        }

        let html = '<div class="grid grid-2">';
        snapshot.forEach(doc => {
            const data = doc.data();
            const date = data.createdAt ? new Date(data.createdAt.toDate()).toLocaleDateString() : 'Date inconnue';
            const priorityBadge = data.priority === 'urgent' ? '🚨' : data.priority === 'warning' ? '⚠️' : '📢';

            html += `
                <div class="card fade-in">
                    <div class="flex justify-between items-start mb-2">
                        <span class="badge" style="background: var(--bg-tertiary);">${priorityBadge} ${data.priority}</span>
                        <small style="color: var(--text-muted);">${date}</small>
                    </div>
                    <h4 style="font-weight: 600; margin-bottom: 5px;">${data.title}</h4>
                    <p style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 10px;">${data.content}</p>
                    <div style="font-size: 0.8rem; color: var(--text-muted);">
                        Cible: <strong>${data.target || 'Custom'}</strong>
                        ${data.individualUserIds ? `(${data.individualUserIds.length} utilisateurs)` : ''}
                    </div>
                    <p style="font-size: 0.75rem; color: var(--text-dim); margin-top: 5px;">Par: ${data.senderName || 'Admin'}</p>
                </div>
            `;
        });
        html += '</div>';
        container.innerHTML = html;
    } catch (e) {
        console.error("Error loading messages:", e);
        container.innerHTML = '<p class="text-error text-center">Erreur chargement messages.</p>';
    }
}

// Charger les alertes de support (Chatbot)
async function loadSupportAlerts() {
    const container = document.getElementById('support-list');
    if (!container) return;

    try {
        container.innerHTML = '<p class="text-center">Chargement des alertes...</p>';
        const snapshot = await db.collection('support_alerts')
            .where('status', '==', 'pending')
            .orderBy('createdAt', 'desc')
            .get();

        if (snapshot.empty) {
            container.innerHTML = '<div class="card text-center"><p style="color: var(--text-secondary);">Aucune alerte en attente.</p></div>';
            return;
        }

        let html = '<div class="grid grid-2">';
        snapshot.forEach(doc => {
            const data = doc.data();
            html += `
                <div class="card fade-in" style="border-left: 4px solid var(--danger);">
                    <div class="flex justify-between">
                        <h4 style="font-weight: 600;">🚨 ${data.type || 'Alerte'}</h4>
                        <button class="btn btn-small btn-primary" onclick="resolveAlert('${doc.id}')">Résoudre</button>
                    </div>
                    <p style="font-size: 0.9rem; margin: 10px 0;">${data.message}</p>
                    <small style="color: var(--text-muted);">Utilisateur: ${data.userId || 'Anonyme'}</small>
                </div>
            `;
        });
        html += '</div>';
        container.innerHTML = html;
    } catch (e) {
        console.error("Error loading alerts:", e);
        container.innerHTML = '<p class="text-error text-center">Erreur chargement alertes.</p>';
    }
}

// Résoudre une alerte
async function resolveAlert(alertId) {
    if (!confirm("Marquer cette alerte comme résolue ?")) return;
    try {
        await db.collection('support_alerts').doc(alertId).update({
            status: 'resolved',
            resolvedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        loadSupportAlerts();
        showSuccess('admin-message', 'Alerte résolue.');
    } catch (e) {
        console.error(e);
        showError('admin-message', 'Erreur.');
    }
}

// Charger les événements (Admin View)
// Charger les événements (Admin View)
async function loadAdminEvents() {
    const container = document.getElementById('admin-events-list');
    if (!container) return;

    try {
        container.innerHTML = '<p class="text-center">Chargement des événements...</p>';
        const snapshot = await db.collection('events').orderBy('date', 'desc').limit(20).get();

        if (snapshot.empty) {
            container.innerHTML = '<div class="card text-center"><p style="color: var(--text-secondary);">Aucun événement.</p></div>';
            return;
        }

        let html = '<div class="grid grid-2">';
        snapshot.forEach(doc => {
            const data = doc.data();
            let date = 'Date inconnue';
            if (data.date) {
                try {
                    // Fix: Handle Firestore Timestamp correctly
                    date = data.date.toDate ? new Date(data.date.toDate()).toLocaleDateString('fr-FR') : new Date(data.date).toLocaleDateString('fr-FR');
                } catch (e) {
                    console.error("Date error:", e);
                }
            }

            html += `
                <div class="card fade-in">
                    <div class="flex justify-between" style="align-items: start;">
                        <h4 style="font-weight: 600; margin-bottom: 5px;">📅 ${data.title}</h4>
                        <div class="flex gap-1">
                            <button class="btn btn-small btn-secondary" onclick="openEditEventModal('${doc.id}')" title="Modifier">✏️</button>
                            <button class="btn btn-small btn-danger" onclick="deleteEvent('${doc.id}')" title="Supprimer">🗑️</button>
                        </div>
                    </div>
                    <p style="font-size: 0.9rem; color: var(--text-secondary); margin: 5px 0;">
                        <span class="badge">${data.type}</span> • ${date}
                    </p>
                    <p style="font-size: 0.85rem; margin-top: 8px;">${data.description || ''}</p>
                    ${data.link ? `<a href="${data.link}" target="_blank" style="font-size: 0.8rem; display: block; margin-top: 5px; color: var(--primary);">🔗 Lien événement</a>` : ''}
                </div>
            `;
        });
        html += '</div>';
        container.innerHTML = html;
    } catch (e) {
        console.error("Error loading events:", e);
        container.innerHTML = '<p class="text-error text-center">Erreur chargement événements.</p>';
    }
}

// Supprimer un événement
async function deleteEvent(eventId) {
    if (!confirm("Supprimer cet événement ?")) return;
    try {
        await db.collection('events').doc(eventId).delete();
        loadAdminEvents();
        showSuccess('admin-message', 'Événement supprimé.');
    } catch (e) {
        console.error(e);
        showError('admin-message', 'Erreur suppression.');
    }
}

// --- GESTION ÉDITION ÉVÉNEMENT ---

let currentEditingEventId = null;

async function openEditEventModal(eventId) {
    if (!eventId) return;
    currentEditingEventId = eventId;

    const modal = document.getElementById('edit-event-modal');
    const form = document.getElementById('edit-event-form');

    // Reset form
    form.reset();

    try {
        const doc = await db.collection('events').doc(eventId).get();
        if (!doc.exists) {
            alert("L'événement n'existe plus.");
            return;
        }

        const data = doc.data();

        document.getElementById('edit-event-id').value = eventId;
        document.getElementById('edit-event-title').value = data.title || '';
        document.getElementById('edit-event-type').value = data.type || 'Conférence';
        document.getElementById('edit-event-link').value = data.link || '';
        document.getElementById('edit-event-desc').value = data.description || '';

        // Format Date for Input (YYYY-MM-DDTHH:MM)
        if (data.date) {
            const d = data.date.toDate ? data.date.toDate() : new Date(data.date);
            // Adjust for timezone offset to show correct local time in input
            const pad = (n) => n < 10 ? '0' + n : n;
            const formattedDate = d.getFullYear() + '-' +
                pad(d.getMonth() + 1) + '-' +
                pad(d.getDate()) + 'T' +
                pad(d.getHours()) + ':' +
                pad(d.getMinutes());
            document.getElementById('edit-event-date').value = formattedDate;
        }

        modal.classList.remove('hidden');
        modal.querySelector('.modal-content').classList.add('fade-in');

    } catch (e) {
        console.error("Error fetching event details:", e);
        alert("Erreur lors du chargement des détails.");
    }
}

function closeEditEventModal() {
    const modal = document.getElementById('edit-event-modal');
    modal.classList.add('hidden');
    currentEditingEventId = null;
}

async function updateEvent(e) {
    e.preventDefault();
    if (!currentEditingEventId) return;

    const title = document.getElementById('edit-event-title').value;
    const dateInput = document.getElementById('edit-event-date').value;
    const type = document.getElementById('edit-event-type').value;
    const link = document.getElementById('edit-event-link').value;
    const description = document.getElementById('edit-event-desc').value;

    try {
        await db.collection('events').doc(currentEditingEventId).update({
            title,
            date: firebase.firestore.Timestamp.fromDate(new Date(dateInput)),
            type,
            link: link || null,
            description,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Close modal and refresh list
        closeEditEventModal();
        loadAdminEvents();
        showSuccess('admin-message', 'Événement mis à jour avec succès !');

    } catch (error) {
        console.error("Error updating event:", error);
        showError('admin-message', 'Erreur lors de la mise à jour.');
    }
}
