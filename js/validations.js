/**
 * Validation Service
 * Centralise la logique d'approbation et de rejet des utilisateurs.
 */

const ValidationService = {
    /**
     * Valide un utilisateur
     * @param {string} userId - ID Firebase de l'utilisateur
     * @param {string} role - 'student', 'delegate', 'alumni'
     * @param {Object} options - { approvedBy: uid, isSystem: boolean }
     * @returns {Promise<void>}
     */
    async approveUser(userId, role, options = {}) {
        if (!userId) throw new Error("UserID manquant pour validation");

        const updateData = {
            isApproved: true,
            approvedAt: firebase.firestore.FieldValue.serverTimestamp(),
            approvedBy: options.approvedBy || 'SYSTEM',
            status: 'active'
        };

        // Si c'est un étudiant, on peut aussi valider sa demande d'accès
        if (role === 'student' || role === 'delegate') {
            // Rechercher si une demande correspondante existe et l'approuver
            try {
                const requestsRef = db.collection('requests');
                const snapshot = await requestsRef.where('userId', '==', userId).where('status', '==', 'pending').get();

                const batch = db.batch();

                snapshot.forEach(doc => {
                    batch.update(doc.ref, {
                        status: 'approved',
                        approvedAt: firebase.firestore.FieldValue.serverTimestamp(),
                        processedBy: options.approvedBy || 'SYSTEM'
                    });
                });

                if (!snapshot.empty) await batch.commit();
            } catch (e) {
                console.warn("Erreur lors de la validation automatique de la demande associée:", e);
            }
        }

        // Mise à jour de l'utilisateur
        await db.collection('users').doc(userId).update(updateData);

        // Log de l'action si la fonction logAction est disponible (Admin context)
        if (typeof logAction === 'function') {
            logAction('USER_APPROVED', userId, { role, approvedBy: options.approvedBy });
        }
    },

    /**
     * Rejette ou suspend un utilisateur
     * @param {string} userId 
     * @param {string} reason 
     * @param {Object} options 
     */
    async rejectUser(userId, reason = 'Non spécifié', options = {}) {
        if (!userId) throw new Error("UserID manquant pour rejet");

        await db.collection('users').doc(userId).update({
            isApproved: false,
            status: 'suspended',
            suspensionReason: reason,
            suspendedAt: firebase.firestore.FieldValue.serverTimestamp(),
            suspendedBy: options.rejectedBy || 'SYSTEM'
        });

        // Log de l'action
        if (typeof logAction === 'function') {
            logAction('USER_SUSPENDED', userId, { reason, suspendedBy: options.rejectedBy });
        }
    }
};
