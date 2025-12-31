// Gestion de l'authentification

// Fonction d'inscription
async function signup(email, password, fullName, phone, role = 'student', niveau = null, promo = null) {
    try {
        // Créer l'utilisateur avec Firebase Auth
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        // Envoyer l'email de vérification
        await user.sendEmailVerification();

        // Par défaut, un étudiant est "approuvé" immédiatement pour accéder au dashboard
        // Mais un LAURÉAT doit attendre l'approbation de l'admin
        const isApproved = (niveau === 'Lauréat') ? false : true;
        const finalRole = (niveau === 'Lauréat') ? 'alumni' : role;

        // Créer le profil utilisateur dans Firestore
        await usersRef.doc(user.uid).set({
            uid: user.uid,
            email: email,
            fullName: fullName,
            phone: phone,
            role: finalRole,
            niveau: niveau,
            promo: promo, // Année de promotion
            isApproved: isApproved, // Flag d'approbation
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Déconnexion immédiate après inscription pour forcer la vérification
        await auth.signOut();

        let message = "Un email de vérification a été envoyé. Veuillez vérifier votre boîte de réception avant de vous connecter.";
        if (niveau === 'Lauréat') {
            message += " En tant que Lauréat, votre compte devra aussi être validé par un administrateur.";
        }

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
