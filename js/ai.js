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

    // 1. FILTRE DE CONTENU SENSIBLE (Priorité Absolue)
    const sensitiveKeys = ["mot de passe", "password", "note", "bulletin", "privé", "confidentiel", "argent", "pirater", "hack"];
    if (sensitiveKeys.some(key => text.includes(key))) {
        try {
            await alertAdmin(message, userProfile, 'SENSITIVE');
            return onCallback("⚠️ Je ne peux pas traiter cette demande car elle contient des informations sensibles ou confidentielles. Une alerte de sécurité a été envoyée à l'administrateur pour traitement manuel.");
        } catch (e) {
            return onCallback("Je ne peux pas répondre à cette question pour des raisons de sécurité.");
        }
    }

    // 2. RAG BACKEND (Gemini Python)
    try {
        console.log("Tentative de contact du serveur IA...");
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 secondes max

        const response = await fetch('http://127.0.0.1:5000/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: message }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        const data = await response.json();

        if (response.ok && data.response) {
            console.log("Réponse RAG reçue");
            return onCallback(data.response);
        }
    } catch (e) {
        console.warn("Serveur IA non disponible (Timeout ou Erreur), passage au mode local.", e);
    }

    // 3. Base de Connaissances Élargie (Fallback Local)
    const keywords = [
        // --- GUIDE D'UTILISATION ---
        {
            keys: ["upload", "télécharger", "fichier", "document", "envoyer"],
            response: "Pour envoyer un document : Allez dans la section 'Mes Demandes', cliquez sur 'Nouvelle Demande', et utilisez le bouton 'Joindre un fichier'. La taille limite est de 5Mo."
        },
        {
            keys: ["contact", "délégué", "joindre", "parler"],
            response: "Vous pouvez contacter votre délégué via l'onglet 'Ma Filière'. Ses coordonnées (Email/Tél) sont affichées en haut de page."
        },
        {
            keys: ["déconnexion", "quitter", "log out"],
            response: "Le bouton de déconnexion se trouve en bas de la barre latérale (menu de gauche)."
        },

        // --- ERREURS TECHNIQUES ---
        {
            keys: ["connexion", "login", "connecter", "passe oublié"],
            response: "Problème de connexion ? 1. Vérifiez votre email/mot de passe. 2. Si vous avez oublié votre mot de passe, contactez l'admin pour une réinitialisation."
        },
        {
            keys: ["crash", "bug", "écran blanc", "bloque"],
            response: "Si la plateforme bloque : Essayez de vider le cache de votre navigateur (Ctrl+F5) ou testez sur un autre appareil. Si ça persiste, dites 'Signaler un bug'."
        },
        {
            keys: ["base de données", "database", "chargement", "lent"],
            response: "Les lenteurs peuvent venir de votre connexion internet. Si le problème vient du serveur, nos équipes sont probablement déjà dessus."
        },

        // --- EXISTANT ---
        {
            keys: ["prix", "gratuit", "payant", "combien"],
            response: "La plateforme Ibn Sina est entièrement gratuite pour tous les étudiants et lauréats."
        },
        {
            keys: ["pin", "code"],
            response: "Le système de code PIN a été supprimé. Le lien WhatsApp apparaît automatiquement après approbation."
        },
        {
            keys: ["whatsapp", "groupe"],
            response: "Pour rejoindre un groupe : Faites une demande. Une fois approuvée par le délégué, le lien apparaîtra sur votre tableau de bord."
        },
        {
            keys: ["bonjour", "salut", "hello", "coucou"],
            response: "Bonjour ! 👋 Je suis l'assistant virtuel d'Ibn Sina. Je peux vous aider avec les problèmes techniques, les guides d'utilisation ou vos demandes."
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
        // 4. Demande Inconnue -> Alerte Admin silencieuse
        try {
            await alertAdmin(message, userProfile, 'UNKNOWN');
            return onCallback("Je n'ai pas la réponse à cette question spécifique. 🤔 J'ai notifié l'administrateur, mais comme mon serveur IA est hors ligne, je suis limité.");
        } catch (error) {
            return onCallback("Je ne comprends pas. Essayez de reformuler avec des mots-clés simples (ex: 'connexion', 'whatsapp', 'upload').");
        }
    }
}

/**
 * Enregistrer une alerte pour l'administrateur
 */
async function alertAdmin(message, userProfile, type = 'GENERAL') {
    const alertData = {
        userId: userProfile?.uid || 'anonyme',
        userName: userProfile?.fullName || 'Utilisateur inconnu',
        userRole: userProfile?.role || 'visiteur',
        message: message,
        alertType: type, // 'SENSITIVE', 'UNKNOWN', 'GENERAL'
        status: 'new',
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };

    return db.collection('support_alerts').add(alertData);
}

/**
 * Fonction de vérification retirée car obsolète
 */
