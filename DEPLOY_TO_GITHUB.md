# Guide de Mise en Ligne sur GitHub Pages

Puisque vous utilisez déjà Git, voici les étapes pour mettre à jour votre dépôt et activer le site en ligne.

## Étape 1 : Sauvegarder les changements

Ouvrez votre terminal dans le dossier du projet et lancez ces commandes :

```bash
# 1. Ajouter tous les fichiers (le .gitignore va exclure les backups automatiquement)
git add .

# 2. Enregistrer les modifications avec un message
git commit -m "feat: Redesign authentification, dashboard admin et préparation déploiement"

# 3. Envoyer vers GitHub
git push origin main
```
*(Si votre branche s'appelle `master`, remplacez `main` par `master`)*

## Étape 2 : Activer GitHub Pages

1. Allez sur la page de votre dépôt sur **GitHub.com**.
2. Cliquez sur l'onglet **Settings** (Paramètres) en haut.
3. Dans la barre latérale gauche, cliquez sur **Pages**.
4. Sous "Build and deployment" > **Branch** :
   - Sélectionnez `main` (ou `master`).
   - Laissez le dossier sur `/ (root)`.
   - Cliquez sur **Save**.

## Étape 3 : Voir le site

Attendez environ 1 à 2 minutes. GitHub va vous afficher un lien en haut de la page (ex: `https://votre-pseudo.github.io/votre-repo/`).

Cliquez dessus, votre plateforme est en ligne ! 🚀
