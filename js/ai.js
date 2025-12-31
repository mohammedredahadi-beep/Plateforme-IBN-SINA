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
 * Chatbot intelligent avec Streaming et instructions système
 * @param {string} message - Message de l'étudiant
 * @param {Object} userProfile - Profil de l'utilisateur connecté
 * @param {Function} onChunk - Callback pour le streaming (reçoit chaque morceau de texte)
 */
async function getChatbotResponse(message, userProfile, onChunk) {
    if (!firebaseConfig.geminiApiKey) {
        return onChunk("Bonjour ! L'administrateur doit configurer ma clé API.");
    }

    // Gestion de la commande /verify (immédiat, pas besoin de stream IA pour ça)
    if (message.toLowerCase().startsWith('/verify ')) {
        const pin = message.split(' ')[1]?.toUpperCase();
        if (!pin) return onChunk("Veuillez fournir un code PIN. Exemple: /verify A1B2C3");
        const res = await verifyPinAndGetLink(pin);
        return onChunk(res);
    }

    try {
        const role = userProfile?.role || 'visiteur';
        const level = userProfile?.niveau || 'N/A';

        // Configuration des instructions système
        const systemInstruction = `
            Tu es l'Assistant IA expert de la plateforme "Ibn Sina".
            Profil utilisateur actuel : ${role} (Niveau: ${level}).
            
            TES MISSIONS :
            1. Guider l'utilisateur selon son rôle :
               - ÉTUDIANT : Explique comment choisir une filière, l'importance de la motivation, et comment utiliser le code PIN (/verify) une fois approuvé.
               - LAURÉAT : Explique que le compte doit être validé par l'Admin. Parle des opportunités de réseautage et du mentorat.
               - DÉLÉGUÉ : Aide-les à comprendre comment traiter les demandes et utiliser l'analyse IA.
            
            2. Résoudre les problèmes fréquents :
               - E-mails en SPAM : C'est le problème n°1. Dis-leur de vérifier et de cliquer sur "Non-spam".
               - PIN expiré : Les codes PIN ne durent que 48h. Si expiré, ils doivent re-contacter le délégué.
               - Pas de filière : Si l'étudiant ne voit pas sa filière, c'est qu'il doit vérifier son niveau dans son profil.
            
            CONSIGNES CRITIQUES :
            - Si l'utilisateur donne un code de 6 caractères, rappelle-lui d'utiliser "/verify [CODE]".
            - Ne donne JAMAIS de lien WhatsApp directement.
            - Sois chaleureux, professionnel et efficace.
        `;

        const streamingUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:streamGenerateContent?key=${firebaseConfig.geminiApiKey}`;

        const response = await fetch(streamingUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                system_instruction: { parts: [{ text: systemInstruction }] },
                contents: [{ parts: [{ text: message }] }]
            })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error?.message || "Erreur API");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            // Le streaming de Gemini renvoie des morceaux de JSON dans un tableau
            // On essaie d'extraire le texte de chaque chunk
            try {
                // Nettoyage rapide pour parser les chunks JSON successifs
                let cleanBuffer = buffer.trim();
                if (cleanBuffer.startsWith('[')) cleanBuffer = cleanBuffer.substring(1);
                if (cleanBuffer.endsWith(']')) cleanBuffer = cleanBuffer.slice(0, -1);

                const parts = cleanBuffer.split('}\n,{'); // Séparateur de chunks
                // Comme le parsing de flux JSON partiel est complexe, on utilise une approche plus simple :
                // On cherche les patterns "text": "..."
                const regex = /"text":\s*"((?:[^"\\]|\\.)*)"/g;
                let match;
                let lastIndex = 0;
                while ((match = regex.exec(buffer)) !== null) {
                    if (match.index >= lastIndex) {
                        const textChunk = match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
                        onChunk(textChunk, true); // true = append mode
                        lastIndex = regex.lastIndex;
                    }
                }
                // Note: Cette méthode regex est simple. Pour un vrai projet, un parser JSON streamé serait mieux.
            } catch (e) {
                // Attendre plus de données si le JSON est incomplet
            }
        }

    } catch (error) {
        console.error("Erreur Chatbot:", error);
        onChunk(`⚠️ Erreur : ${error.message}. Essayez de vérifier vos spams ou contactez l'admin.`);
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
