// Afficher le lien WhatsApp directement
async function displayWhatsAppAccess() {
    const container = document.getElementById('whatsapp-link-display');

    if (!currentUser.filiere) {
        container.innerHTML = `
            <div style="padding: 2rem; text-align: center;">
                <p style="color: var(--text-secondary);">❌ Aucune filière associée à votre compte.</p>
                <p style="color: var(--text-dim); font-size: 0.9rem; margin-top: 0.5rem;">Contactez l'administration.</p>
            </div>
        `;
        return;
    }

    try {
        // Récupérer la filière de l'étudiant
        const snapshot = await filieresRef
            .where('name', '==', currentUser.filiere)
            .limit(1)
            .get();

        if (snapshot.empty) {
            container.innerHTML = `
                <div style="padding: 2rem; text-align: center;">
                    <p style="color: var(--text-secondary);">⚠️ Filière "${currentUser.filiere}" non trouvée.</p>
                </div>
            `;
            return;
        }

        const filiereData = snapshot.docs[0].data();
        const whatsappLink = filiereData.whatsappLink;

        if (!whatsappLink) {
            container.innerHTML = `
                <div style="padding: 2rem; text-align: center;">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">⏳</div>
                    <h4 style="font-weight: 600; margin-bottom: 0.5rem;">Lien en cours de configuration</h4>
                    <p style="color: var(--text-secondary); font-size: 0.9rem;">
                        Le lien WhatsApp n'a pas encore été configuré par votre délégué.<br>
                        Veuillez patienter, il sera disponible bientôt.
                    </p>
                </div>
            `;
            return;
        }

        // Afficher le lien WhatsApp
        container.innerHTML = `
            <div style="padding: 2rem; text-align: center;">
                <div style="font-size: 4rem; margin-bottom: 1rem;">💬</div>
                <h3 style="font-weight: 700; margin-bottom: 0.5rem; color: var(--primary);">Groupe ${filiereData.name}</h3>
                <p style="color: var(--text-secondary); margin-bottom: 2rem;">
                    Rejoignez le groupe WhatsApp de votre classe
                </p>
                
                <a href="${whatsappLink}" target="_blank" class="btn btn-success" 
                   style="width: 100%; max-width: 400px; margin: 0 auto; display: flex; align-items: center; justify-content: center; gap: 10px; padding: 1rem; font-size: 1.1rem;">
                    <span>📱</span>
                    <span>Rejoindre le Groupe WhatsApp</span>
                </a>
                
                <div style="margin-top: 2rem; padding: 1rem; background: var(--bg-alt); border-radius: var(--rad-md);">
                    <p style="font-size: 0.85rem; color: var(--text-dim); line-height: 1.6;">
                        💡 <strong>Astuce :</strong> Cliquez sur le bouton ci-dessus pour être automatiquement redirigé vers WhatsApp.
                    </p>
                </div>
            </div>
        `;

    } catch (error) {
        console.error('Erreur chargement WhatsApp:', error);
        container.innerHTML = `
            <div style="padding: 2rem; text-align: center;">
                <p style="color: var(--danger);">❌ Erreur de chargement</p>
                <button class="btn btn-secondary" onclick="displayWhatsAppAccess()" style="margin-top: 1rem;">
                    Réessayer
                </button>
            </div>
        `;
    }
}
