// Configuration Firebase
// IMPORTANT: Remplacez ces valeurs par celles de votre projet Firebase
const firebaseConfig = {
    apiKey: "AIzaSyC2wP4QWOIa7qED447mktfA4sRzUygomeU",
    authDomain: "plateforme-ibn-sina.firebaseapp.com",
    projectId: "plateforme-ibn-sina",
    storageBucket: "plateforme-ibn-sina.firebasestorage.app",
    messagingSenderId: "641483904328",
    appId: "1:641483904328:web:58c80275463a9cb73e0f7d",
    geminiApiKey: "AIzaSyD82wR282DAdXI4DznwYa6t25o0GGpU--g" // Optionnel pour les fonctionnalités IA
};

// Initialiser Firebase
firebase.initializeApp(firebaseConfig);

// Références Firebase
const auth = firebase.auth();
const db = firebase.firestore();

// Collections Firestore
const usersRef = db.collection('users');
const filieresRef = db.collection('filieres');
const requestsRef = db.collection('requests');
