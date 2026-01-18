/**
 * Structure officielle du Lycée Technique Ibn Sina
 * Module de validation des Niveaux, Filières et Classes
 */

const SchoolStructure = {
    // Niveaux disponibles
    Levels: {
        TC: "Tronc Commun",
        BAC1: "1ère Année Bac",
        BAC2: "2ème Année Bac",
        BTS1: "BTS 1ère Année",
        BTS2: "BTS 2ème Année"
    },

    // Filières par Niveau
    Majors: {
        TC: ["TCT"], // Tronc Commun Technologique
        BAC: ["STE", "STM", "AA", "ECO"], // Pour 1ère et 2ème année Bac
        BTS: ["EII", "ELT", "DAI", "CPI", "MI", "PME_PMI"] // Pour BTS
    },

    // Libellés des filières
    MajorLabels: {
        "TCT": "Tronc Commun Technologique",
        "STE": "Sciences et Technologies Électriques",
        "STM": "Sciences et Technologies Mécaniques",
        "AA": "Arts Appliqués",
        "ECO": "Économie",
        "EII": "Électronique et Informatique Industrielle",
        "ELT": "Électrotechnique",
        "DAI": "Développement des Applications Informatiques",
        "CPI": "Conception du Produit Industriel",
        "MI": "Maintenance Industrielle",
        "PME_PMI": "Gestion PME/PMI"
    },

    /**
     * Retourne les filières valides pour un niveau donné
     * @param {string} levelId - L'identifiant du niveau (ex: 'TC', 'BAC1', 'BTS1')
     * @returns {Array} Liste des codes de filières
     */
    getMajorsForLevel: function (levelId) {
        if (levelId === 'TC') return this.Majors.TC;
        if (['BAC1', 'BAC2'].includes(levelId)) return this.Majors.BAC;
        if (['BTS1', 'BTS2'].includes(levelId)) return this.Majors.BTS;
        return [];
    },

    /**
     * Retourne toutes les filières existantes (pour les lauréats par exemple)
     */
    getAllMajors: function () {
        return [...this.Majors.TC, ...this.Majors.BAC, ...this.Majors.BTS];
    },

    /**
     * Valide une combinaison Niveau / Filière / Classe
     * @param {string} levelId - Niveau (ex: 'TC', 'BAC1')
     * @param {string} majorCode - Code filière (ex: 'TCT', 'STE')
     * @param {number} classNum - Numéro de classe
     * @returns {object} { isValid: boolean, error: string|null }
     */
    validate: function (levelId, majorCode, classNum) {
        // 1. Validation du Niveau
        if (!Object.keys(this.Levels).includes(levelId)) {
            return { isValid: false, error: "Niveau invalide." };
        }

        // 2. Validation de la Filière pour le Niveau
        const validMajors = this.getMajorsForLevel(levelId);
        if (!validMajors.includes(majorCode)) {
            return {
                isValid: false,
                error: `La filière ${majorCode} n'est pas disponible pour le niveau ${this.Levels[levelId]}.`
            };
        }

        // 3. Validation du Numéro de Classe
        classNum = parseInt(classNum);
        if (isNaN(classNum)) {
            return { isValid: false, error: "Le numéro de classe doit être un nombre." };
        }

        // Règles spécifiques de classes
        if (majorCode === 'TCT') {
            // Règle: TCT max 6 classes
            if (classNum < 1 || classNum > 6) {
                return { isValid: false, error: `Pour TCT, la classe doit être entre 1 et 6.` };
            }
        } else if (this.Majors.BAC.includes(majorCode)) {
            // Règle: STE, STM, AA, ECO max 2 classes
            if (classNum < 1 || classNum > 2) {
                return { isValid: false, error: `Pour la filière ${majorCode}, la classe doit être 1 ou 2.` };
            }
        } else if (this.Majors.BTS.includes(majorCode)) {
            // Règle: BTS max 1 classe
            if (classNum !== 1) {
                return { isValid: false, error: `Pour les filières BTS, il n'y a qu'une seule classe (classe 1).` };
            }
        }

        return { isValid: true, error: null };
    },

    /**
     * Formate le nom complet de la classe
     */
    formatClassName: function (levelId, majorCode, classNum) {
        const levelName = this.Levels[levelId];
        return `${levelName} - ${majorCode} - ${classNum}`;
    }
};

// Export globalement pour l'utilisation dans les scripts non-modulaires
window.SchoolStructure = SchoolStructure;
