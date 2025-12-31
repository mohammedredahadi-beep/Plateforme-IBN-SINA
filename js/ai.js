/**
 * Logique d'intégration de l'IA (Gemini API)
 * Permet d'analyser les motivations et d'aider les étudiants/délégués
 */

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

/**
 * Analyse la motivation d'un étudiant pour aider le délégué
 * @param {string} motivation - Le texte de motivation de l'étudiant
 * @returns {Promise<Object>} - Analyse (score, résumé, recommandation)
 */
async function analyzeMotivation(motivation) {
    if (!firebaseConfig.geminiApiKey || firebaseConfig.geminiApiKey === "VOTRE_GEMINI_API_KEY") {
        console.warn("Clé API Gemini non configurée. Analyse IA désactivée.");
        return null;
    }

    if (!motivation || motivation.length < 10) return null;

    try {
        const prompt = `
            En tant qu'assistant pour une association d'étudiants, analyse la motivation suivante pour rejoindre un groupe de filière WhatsApp.
            Donne : 
            1. Un score de sérieux sur 10.
            2. Un résumé très court (10 mots max).
            3. Une recommandation (Approuver, Demander plus d'infos, ou Méfiance).
            
            Motivation : "${motivation}"
            
            Réponds uniquement au format JSON valide :
            {"score": 8, "resume": "Étudiant motivé avec projet clair", "recommandation": "Approuver"}
        `;

        const response = await fetch(`${GEMINI_API_URL}?key=${firebaseConfig.geminiApiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        const data = await response.json();
        const textResponse = data.candidates[0].content.parts[0].text;

        // Nettoyer la réponse pour extraire le JSON si nécessaire
        const jsonMatch = textResponse.match(/\{.*\}/s);
        return jsonMatch ? JSON.parse(jsonMatch[0]) : null;

    } catch (error) {
        console.error("Erreur lors de l'analyse IA:", error);
        return null;
    }
}

/**
 * Chatbot simple pour guider les étudiants
 * @param {string} message - Message de l'étudiant
 * @param {Array} history - Historique de la conversation
 */
async function getChatbotResponse(message, history = []) {
    if (!firebaseConfig.geminiApiKey || firebaseConfig.geminiApiKey === "VOTRE_GEMINI_API_KEY") {
        return "Bonjour ! Je suis l'assistant IA d'Ibn Sina. Pour que je puisse vous aider de manière intelligente, l'administrateur doit configurer ma clé API. En attendant, n'hésitez pas à remplir le formulaire de demande !";
    }

    // Gestion de la commande /verify
    if (message.toLowerCase().startsWith('/verify ')) {
        const pin = message.split(' ')[1]?.toUpperCase();
        if (!pin) return "Veuillez fournir un code PIN. Exemple: /verify A1B2C3";

        return await verifyPinAndGetLink(pin);
    }

    try {
        const prompt = `
            Tu es l'assistant virtuel expert de la plateforme "Ibn Sina". 
            Ton but est d'aider les étudiants et lauréats.
            
            CONSIGNES DE SÉCURITÉ CRITIQUES :
            - Si l'utilisateur donne un code (ex: A1B2C3), dis-lui d'utiliser EXACTEMENT la commande "/verify [CODE]".
            - Ne donne JAMAIS de lien WhatsApp directement si tu ne passes pas par la fonction de vérification.
            
            BASE DE CONNAISSANCES (FAQ) :
            1. INSCRIPTION : L'email de vérification est obligatoire. Vérifiez vos spams.
            2. APPROBATION : Les demandes sont traitées par les délégués de filière. Le délai varie de quelques heures à 48h.
            3. CODES PIN : Une fois une demande approuvée, un PIN apparaît sur le dashboard. Ce PIN expire après 48h.
            4. ACCÈS WHATSAPP : Tapez "/verify VOTRE_CODE" ici pour obtenir le lien.
            5. LAURÉATS : Votre compte doit être validé par l'Admin. Vous avez accès à un réseau exclusif une fois validé.
            6. PROBLÈMES : Si le PIN est expiré, contactez votre délégué. Si le mail de vérification ne vient pas, essayez de vous reconnecter pour demander un renvoi.
            
            Sois professionnel, accueillant et réponds en français. 
            Question : "${message}"
        `;

        const response = await fetch(`${GEMINI_API_URL}?key=${firebaseConfig.geminiApiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        const data = await response.json();
        return data.candidates[0].content.parts[0].text;

    } catch (error) {
        console.error("Erreur Chatbot:", error);
        return "Désolé, j'ai rencontré une petite erreur technique. Essayez de remplir le formulaire directement !";
    }
}

/**
 * Logique interne de vérification du PIN
 */
async function verifyPinAndGetLink(pin) {
    try {
        // Chercher la demande avec ce PIN
        const snapshot = await requestsRef.where('verificationPin', '==', pin).get();

        if (snapshot.empty) {
            return "❌ Code PIN invalide. Veuillez vérifier le code sur votre tableau de bord.";
        }

        const requestDoc = snapshot.docs[0];
        const requestData = requestDoc.data();

        // Vérifier l'expiration
        const now = new Date();
        const expiresAt = requestData.pinExpiresAt.toDate();

        if (now > expiresAt) {
            return "⏰ Ce code PIN a expiré (validité 48h). Veuillez contacter votre délégué pour en générer un nouveau.";
        }

        // Récupérer le lien de la filière
        const filiereDoc = await filieresRef.doc(requestData.filiereId).get();
        if (!filiereDoc.exists) {
            return "❌ Erreur : Impossible de trouver les informations de la filière.";
        }

        const whatsappLink = filiereDoc.data().whatsappLink;
        if (!whatsappLink) {
            return "ℹ️ Votre code est valide ! Cependant, aucun lien n'a encore été configuré pour cette filière. Prévenez votre délégué.";
        }

        // Marquer comme vérifié (optionnel)
        await requestDoc.ref.update({ isVerified: true });

        return `✅ Félicitations ! Votre code est valide. Voici le lien pour rejoindre votre groupe : \n\n ${whatsappLink} \n\n Bienvenue parmi nous !`;

    } catch (error) {
        console.error("Erreur de vérification PIN:", error);
        return "Une erreur est survenue lors de la vérification. Réessayez plus tard.";
    }
}
