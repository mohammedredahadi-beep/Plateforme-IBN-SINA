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

    // 1. Commande spéciale désactivée (Le PIN n'est plus requis)
    if (text.startsWith('/verify ')) {
        return onCallback("Le système de code PIN a été désactivé. Si votre demande est approuvée, le lien WhatsApp s'affiche directement sur votre tableau de bord.");
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
            response: "Le système de code PIN a été supprimé. Désormais, dès qu'un délégué approuve votre demande, le lien vers le groupe WhatsApp apparaîtra directement sur votre tableau de bord."
        },
        {
            keys: ["whatsapp", "groupe", "rejoindre", "lien"],
            response: "Pour rejoindre un groupe : 1. Faites une demande dans l'onglet 'Groupes WhatsApp'. 2. Attendez l'approbation d'un délégué. 3. Le lien apparaîtra automatiquement sur votre tableau de bord une fois approuvé."
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
 * Fonction de vérification retirée car obsolète
 */
