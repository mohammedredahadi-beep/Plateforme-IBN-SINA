/**
 * Logique de réponse automatisée (Remplacement de Gemini)
 * Basée sur la détection de mots-clés
 */

/**
 * Analyse la motivation d'un étudiant (Version simplifiée sans IA)
 */
async function analyzeMotivation(motivation) {
    if (!motivation || motivation.length < 5) return null;

    // Analyse basique basée sur la longueur et quelques mots-clés
    const length = motivation.length;
    let score = 5;
    let resume = "Analyse manuelle requise.";
    let recommandation = "À vérifier";

    if (length > 50) {
        score = 8;
        resume = "Motivation détaillée.";
        recommandation = "Approuver";
    }

    return {
        score: score,
        resume: resume,
        recommandation: recommandation
    };
}

/**
 * Chatbot par mots-clés (Remplacement du streaming IA)
 */
async function getChatbotResponse(message, userProfile, onCallback) {
    const text = message.toLowerCase();

    // 1. Commande spéciale /verify
    if (text.startsWith('/verify ')) {
        const pin = message.split(' ')[1]?.toUpperCase();
        if (!pin) return onCallback("Veuillez fournir un code PIN. Exemple: /verify A1B2C3");
        const res = await verifyPinAndGetLink(pin);
        return onCallback(res);
    }

    // 2. Dictionnaire de mots-clés
    const keywords = [
        {
            keys: ["prix", "gratuit", "payant", "argent", "combien"],
            response: "La plateforme Ibn Sina est entièrement gratuite pour tous les étudiants et lauréats. Aucun paiement ne vous sera jamais demandé."
        },
        {
            keys: ["erreur", "bug", "problème", "marche pas", "bloqué"],
            response: "Si vous rencontrez un problème technique, essayez de rafraîchir la page ou de vous reconnecter. Si le souci persiste, cela a été signalé à l'équipe technique."
        },
        {
            keys: ["panne", "maintenance", "accès"],
            response: "Aucune panne majeure n'est signalée. Vérifiez votre connexion internet si vous ne parvenez pas à accéder aux services."
        },
        {
            keys: ["pin", "code", "quand", "reçu"],
            response: "Votre code PIN est généré automatiquement dès qu'un délégué approuve votre demande. Il s'affichera sur votre tableau de bord et sera valable 48h."
        },
        {
            keys: ["whatsapp", "groupe", "rejoindre", "lien"],
            response: "Pour rejoindre un groupe, suivez ces étapes : 1. Faites une demande. 2. Attendez l'approbation. 3. Utilisez le PIN avec la commande /verify ici-même."
        },
        {
            keys: ["spam", "email", "mail", "vérification"],
            response: "L'email de vérification peut mettre quelques minutes à arriver. Pensez à vérifier votre dossier 'Courriers indésirables' (SPAM)."
        },
        {
            keys: ["bonjour", "salut", "hello"],
            response: "Bonjour ! Comment puis-je vous aider aujourd'hui ? Je peux répondre à vos questions sur les PIN, les groupes WhatsApp ou les problèmes techniques."
        }
    ];

    // Rechercher un match
    let foundResponse = null;
    for (const item of keywords) {
        if (item.keys.some(key => text.includes(key))) {
            foundResponse = item.response;
            break;
        }
    }

    if (foundResponse) {
        return onCallback(foundResponse);
    } else {
        // 3. Demande complexe : Alerter l'administrateur
        try {
            await alertAdmin(message, userProfile);
            return onCallback("Désolé, je ne connais pas la réponse à cette question complexe. J'ai alerté l'administrateur qui reviendra vers vous dès que possible.");
        } catch (error) {
            console.error("Erreur alerte admin:", error);
            return onCallback("Désolé, je ne comprends pas votre demande. Veuillez essayer avec des mots plus simples (ex: 'prix', 'code PIN', 'erreur').");
        }
    }
}

/**
 * Enregistrer une alerte pour l'administrateur
 */
async function alertAdmin(message, userProfile) {
    const alertData = {
        userId: userProfile?.uid || 'anonyme',
        userName: userProfile?.fullName || 'Utilisateur inconnu',
        userRole: userProfile?.role || 'visiteur',
        message: message,
        status: 'new',
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };

    return db.collection('support_alerts').add(alertData);
}

/**
 * Logique interne de vérification du PIN (Conservée telle quelle)
 */
async function verifyPinAndGetLink(pin) {
    try {
        const snapshot = await requestsRef.where('verificationPin', '==', pin).get();
        if (snapshot.empty) return "❌ Code PIN invalide. Vérifiez le code sur votre tableau de bord.";

        const requestDoc = snapshot.docs[0];
        const requestData = requestDoc.data();
        const now = new Date();
        const expiresAt = requestData.pinExpiresAt.toDate();

        if (now > expiresAt) return "⏰ Ce code PIN a expiré (validité 48h). Contactez votre délégué.";

        const filiereDoc = await filieresRef.doc(requestData.filiereId).get();
        if (!filiereDoc.exists) return "❌ Erreur : Filière introuvable.";

        const whatsappLink = filiereDoc.data().whatsappLink;
        if (!whatsappLink) return "ℹ️ PIN valide ! Mais le délégué n'a pas encore configuré le lien WhatsApp de ce groupe.";

        await requestDoc.ref.update({ isVerified: true });
        return `✅ Code valide ! Voici votre lien : \n\n ${whatsappLink}`;
    } catch (error) {
        console.error("Erreur PIN:", error);
        return "Une erreur est survenue lors de la vérification.";
    }
}
