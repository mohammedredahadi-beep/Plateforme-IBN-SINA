# Guide de Déploiement GitHub

Ce guide vous explique comment mettre à jour votre code sur GitHub et déployer votre plateforme.

## ⚠️ Notes de Sécurité Importantes

Le fichier `js/config.js` est inclus dans le dépôt car il est nécessaire pour que le site fonctionne sur GitHub Pages. Assurez-vous que vos clés API Firebase sont sécurisées :
*   La clé `apiKey` (Firebase) est généralement publique.
*   **Attention** aux autres clés (comme Google AI ou Gemini) si elles ne sont pas restreintes. Idéalement, utilisez un proxy backend pour les clés secrètes, mais pour ce projet statique, assurez-vous de restreindre l'usage de la clé API dans la console Google Cloud aux domaines autorisés (ex: votre-domaine.github.io).

---

## 🚀 Étape 1 : Préparer et Envoyer les Modifications

Ouvrez votre terminal (PowerShell ou Git Bash) dans le dossier du projet et exécutez les commandes suivantes :

1.  **Vérifier le statut** (voir quels fichiers ont changé) :
    ```bash
    git status
    ```

2.  **Ajouter tous les fichiers** :
    ```bash
    git add .
    ```

3.  **Enregistrer la version (Commit)** :
    ```bash
    git commit -m "Mise à jour: Ajout fonctionnalités Admin (Durée msg, Delete All) et Alumni"
    ```

4.  **Envoyer vers GitHub (Push)** :
    ```bash
    git push origin main
    ```
    *(Si ça ne marche pas, essayez `git push origin master`)*

---

## 🌐 Étape 2 : Activer/Vérifier GitHub Pages

Une fois le code envoyé sur GitHub :

1.  Allez sur votre dépôt GitHub.
2.  Cliquez sur l'onglet **Settings** (Paramètres).
3.  Dans le menu à gauche, cliquez sur **Pages**.
4.  Sous **Build and deployment** :
    *   **Source** : Deploy from a branch
    *   **Branch** : `main` (ou `master`) / `/ (root)`
    *   Cliquez sur **Save**.

Votre site sera accessible via le lien affiché en haut de la page (ex: `https://votre-pseudo.github.io/Plateforme-IBN-SINA/`).

## 🛠️ En cas de problème de cache

Si vos changements n'apparaissent pas immédiatement :
1.  Attendez 2-3 minutes après le push.
2.  Forcez le rafraîchissement de votre navigateur (Ctrl + F5).
3.  Si vous avez modifié des fichiers JS/CSS, assurez-vous que les numéros de version dans vos `<script>` (ex: `?v=1.4`) sont mis à jour si nécessaire.

