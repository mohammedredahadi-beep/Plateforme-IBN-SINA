// Gestion de l'authentification

// Configuration de l'environnement : Détermine si le mode dev est autorisé
const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
// Si vous devez absolument tester le mode dev en ligne, passez ceci à true temporairement
const forceDevMode = false;
const canUseDevMode = isLocalhost || forceDevMode;

// --- DEV MODE MOCK ---
function getDevMockProfile() {
    // Sécurité : On ignore le mode dev si on n'est pas en local (et pas forcé)
    if (!canUseDevMode) return null;

    if (localStorage.getItem('dev_mode_enabled') !== 'true') return null;
    const role = localStorage.getItem('dev_mode_role');
    let niveau = 'TC';
    if (['alumni', 'mentor'].includes(role)) niveau = 'Lauréat';
    if (role === 'admin') niveau = 'Administration';

    return {
        uid: 'mock-' + role,
        fullName: 'Mode Dev (' + role.toUpperCase() + ')',
        email: 'dev@ibnsina.test',
        role: role === 'mentor' ? 'alumni' : role,
        mentorStatus: role === 'mentor' ? 'approved' : 'none',
        isApproved: true,
        isSuspended: false,
        niveau: niveau,
        filiere: 'DEV'
    };
}
// ----------------------

// --- MONKEY PATCH FIREBASE AUTH FOR DEV MODE ---
// Sécurité : même vérification ici
if (canUseDevMode && localStorage.getItem('dev_mode_enabled') === 'true') {
    const mockRole = localStorage.getItem('dev_mode_role');
    const mockUid = 'mock-' + mockRole;

    try {
        const mockUser = {
            uid: mockUid,
            email: 'dev@ibnsina.test',
            emailVerified: true,
            displayName: 'Mode Dev (' + mockRole.toUpperCase() + ')',
            getIdToken: async () => 'mock-token',
            sendEmailVerification: async () => console.log("Mock: Email verification sent")
        };

        Object.defineProperty(auth, 'currentUser', {
            get: () => mockUser,
            configurable: true
        });

        console.log("Dev Mode: Simulated Auth active for role " + mockRole);
    } catch (e) {
        console.warn("Dev Mode: Could not redefine auth.currentUser directly.", e);
    }
}
// -----------------------------------------------

// Fonction d'inscription
async function signup(email, password, fullName, phone, role = 'student', niveau = null, promo = null, filiere = null, classe = null) {
    try {
        // Créer l'utilisateur avec Firebase Auth
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        // Envoyer l'email de vérification
        await user.sendEmailVerification();

        // Initialisation de la sécurité : Personne n'est approuvé par défaut
        // L'Administration ou le Délégué doit valider l'inscription
        const isApproved = false;
        const finalRole = (niveau === 'Lauréat') ? 'alumni' : role;

        // Créer le profil utilisateur dans Firestore
        const userData = {
            uid: user.uid,
            email: email,
            fullName: fullName,
            phone: phone,
            role: finalRole,
            niveau: niveau,
            promo: promo, // Année de promotion
            filiere: filiere, // Filière (STE, STM, etc.)
            isApproved: isApproved, // Flag d'approbation
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        // Ajouter la classe si elle existe (pas pour les lauréats par ex)
        if (classe) {
            userData.classe = parseInt(classe);
        }

        await usersRef.doc(user.uid).set(userData);

        // Déconnexion immédiate après inscription pour forcer la vérification
        await auth.signOut();

        let message = "Un email de vérification a été envoyé.";
        message += " Votre compte est actuellement en attente de validation par l'administration ou votre délégué.";

        return { success: true, user: user, message: message };
    } catch (error) {
        console.error('Erreur lors de l\'inscription:', error);
        return { success: false, error: error.message };
    }
}

// Fonction de connexion
async function login(email, password) {
    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const user = userCredential.user;

        if (!user.emailVerified) {
            // Optionnel : renvoyer l'email si non vérifié
            // await user.sendEmailVerification(); 
            await auth.signOut();
            return { success: false, error: 'email-not-verified', message: 'Votre adresse email n\'est pas encore vérifiée. Veuillez consulter vos emails.' };
        }

        return { success: true, user: user };
    } catch (error) {
        console.error('Erreur lors de la connexion:', error);
        return { success: false, error: error.code || error.message };
    }
}

// Fonction de réinitialisation du mot de passe
async function resetPassword(email) {
    try {
        await auth.sendPasswordResetEmail(email);
        return {
            success: true,
            message: 'Un email de réinitialisation a été envoyé à votre adresse. Vérifiez votre boîte de réception et vos spams.'
        };
    } catch (error) {
        console.error('Erreur lors de la réinitialisation:', error);
        return { success: false, error: error.code || error.message };
    }
}

// Fonction de déconnexion
async function logout() {
    try {
        await auth.signOut();
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Erreur lors de la déconnexion:', error);
    }
}

// Obtenir le profil utilisateur actuel
async function getCurrentUserProfile() {
    // Check Dev Mode first
    const mockProfile = getDevMockProfile();
    if (mockProfile) return mockProfile;

    const user = auth.currentUser;
    if (!user) return null;

    try {
        const doc = await usersRef.doc(user.uid).get();
        if (doc.exists) {
            return doc.data();
        }
        return null;
    } catch (error) {
        console.error('Erreur lors de la récupération du profil:', error);
        return null;
    }
}

// Vérifier l'authentification et rediriger
async function checkAuthAndRedirect() {
    // Check Dev Mode first
    const mockProfile = getDevMockProfile();
    if (mockProfile) {
        return mockProfile;
    }

    return new Promise((resolve) => {
        auth.onAuthStateChanged(async (user) => {
            if (!user) {
                window.location.href = 'index.html';
                resolve(null);
                return;
            }

            // Si l'email n'est pas vérifié, on déconnecte et redirige
            if (!user.emailVerified) {
                await auth.signOut();
                window.location.href = 'index.html?error=unverified';
                resolve(null);
                return;
            }

            const profile = await getCurrentUserProfile();

            // Si le compte est suspendu
            if (profile && profile.isSuspended) {
                await auth.signOut();
                window.location.href = 'index.html?error=suspended';
                resolve(null);
                return;
            }

            // Si le compte n'est pas approuvé (valable pour TOUS les rôles)
            if (profile && !profile.isApproved) {
                await auth.signOut();
                window.location.href = 'index.html?error=unapproved';
                resolve(null);
                return;
            }

            resolve(profile);
        });
    });
}

// Rediriger selon le rôle
function redirectByRole(role) {
    switch (role) {
        case 'student':
            window.location.href = 'student-dashboard.html';
            break;
        case 'alumni':
            window.location.href = 'alumni-dashboard.html';
            break;
        case 'delegate':
            window.location.href = 'delegate-dashboard.html';
            break;
        case 'admin':
            window.location.href = 'admin-dashboard.html';
            break;
        default:
            window.location.href = 'index.html';
    }
}

// Afficher un message d'erreur
function showError(elementId, message) {
    const errorDiv = document.getElementById(elementId);
    if (errorDiv) {
        errorDiv.innerHTML = `
            <div class="alert alert-error">
                <span>⚠️</span>
                <span>${message}</span>
            </div>
        `;
        errorDiv.classList.remove('hidden');
        setTimeout(() => {
            errorDiv.classList.add('hidden');
        }, 5000);
    }
}

// Afficher un message de succès
function showSuccess(elementId, message) {
    const successDiv = document.getElementById(elementId);
    if (successDiv) {
        successDiv.innerHTML = `
            <div class="alert alert-success">
                <span>✓</span>
                <span>${message}</span>
            </div>
        `;
        successDiv.classList.remove('hidden');
        setTimeout(() => {
            successDiv.classList.add('hidden');
        }, 5000);
    }
}

// Formater l'erreur Firebase en français
function formatFirebaseError(errorCode) {
    const errors = {
        'auth/email-already-in-use': 'Cette adresse email est déjà utilisée.',
        'auth/invalid-email': 'L\'adresse email est invalide.',
        'auth/operation-not-allowed': 'Cette opération n\'est pas autorisée.',
        'auth/weak-password': 'Le mot de passe doit contenir au moins 6 caractères.',
        'auth/user-disabled': 'Ce compte a été désactivé.',
        'auth/user-not-found': 'Aucun compte trouvé avec cette adresse email.',
        'auth/wrong-password': 'Mot de passe incorrect.',
        'auth/too-many-requests': 'Trop de tentatives. Veuillez réessayer plus tard.',
        'auth/network-request-failed': 'Erreur de connexion. Vérifiez votre connexion internet.'
    };

    return errors[errorCode] || 'Une erreur est survenue. Veuillez réessayer.';
}
