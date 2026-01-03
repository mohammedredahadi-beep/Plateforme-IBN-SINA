/**
 * Module de Diagnostic pour l'Administrateur
 * Utilise des heuristiques ("IA") pour détecter les anomalies de données.
 */

// -----------------------------------------------------------------------------
// Core Diagnostics Logic
// -----------------------------------------------------------------------------

async function runDiagnostics(mode = 'quick') {
    const resultsContainer = document.getElementById('diag-results');
    const statusText = document.getElementById('diag-status-text');

    // UI Reset
    resultsContainer.innerHTML = '<div class="loading" style="margin: 20px auto;"></div>';
    statusText.textContent = "Analyse en cours...";

    // Simulate thinking time for "AI" feel
    await new Promise(r => setTimeout(r, mode === 'full' ? 1500 : 500));

    const issues = [];

    // --- 1. DATA INTEGRITY CHECKS (Quick & Full) ---

    // Check 1: Filieres without delegates
    allFilieres.forEach(filiere => {
        if (!filiere.delegateId) {
            issues.push({
                severity: 'medium',
                title: `Filière sans délégué : ${filiere.name}`,
                desc: `Cette filière n'a pas de délégué assigné, ce qui peut bloquer les approbations.`,
                action: 'Assigner un délégué'
            });
        } else {
            // Check if delegate actually exists
            const delegateExists = allUsers.find(u => u.uid === filiere.delegateId || u.id === filiere.delegateId);
            if (!delegateExists) {
                issues.push({
                    severity: 'high',
                    title: `Délégué fantôme : ${filiere.name}`,
                    desc: `L'ID de délégué ${filiere.delegateId} ne correspond à aucun utilisateur actif.`,
                    action: 'Corriger le délégué'
                });
            }
        }
    });

    // Check 2: Profiles with missing data
    allUsers.forEach(user => {
        const missingFields = [];
        if (!user.email) missingFields.push('Email');
        if (!user.role) missingFields.push('Rôle');

        if (missingFields.length > 0) {
            issues.push({
                severity: 'low',
                title: `Profil incomplet : ${user.fullName || 'Utilisateur inconnu'}`,
                desc: `Champs manquants : ${missingFields.join(', ')}.`,
                action: 'Éditer l\'utilisateur'
            });
        }
    });

    // --- 2. ADVANCED HEURISTICS ("AI" Mode) ---
    if (mode === 'full') {

        // AI Check 1: Bottleneck Detection
        const pendingRequests = allRequests.filter(r => r.status === 'pending');
        if (pendingRequests.length > 5) {
            const requestsByFiliere = {};
            pendingRequests.forEach(r => {
                const fName = r.filiereName || 'Inconnue';
                requestsByFiliere[fName] = (requestsByFiliere[fName] || 0) + 1;
            });

            for (const [fName, count] of Object.entries(requestsByFiliere)) {
                if (count > 3) {
                    issues.push({
                        severity: 'high',
                        title: `Goulot d'étranglement détecté : ${fName}`,
                        desc: `L'IA a détecté une accumulation anormale de ${count} demandes pour cette filière. Le délégué est peut-être inactif.`,
                        action: 'Contacter le délégué'
                    });
                }
            }
        }

        // AI Check 2: Role Consistency
        const studentsWithAdminPriv = allUsers.filter(u => u.role === 'student' && u.isAdmin);
        if (studentsWithAdminPriv.length > 0) {
            issues.push({
                severity: 'critical',
                title: `Risque de Sécurité : Privilèges contradictoires`,
                desc: `${studentsWithAdminPriv.length} utilisateurs ont le rôle 'student' mais le flag 'isAdmin'.`,
                action: 'Révoquer les droits'
            });
        }

        // AI Check 3: Data Staleness
        // (Assuming we might have timestamps, otherwise skip)
    }

    // --- RENDER RESULTS ---
    renderDiagnosticResults(issues, mode);
}

function renderDiagnosticResults(issues, mode) {
    const container = document.getElementById('diag-results');
    const statusText = document.getElementById('diag-status-text');

    container.innerHTML = '';

    if (issues.length === 0) {
        statusText.textContent = "Système Sain";
        statusText.style.color = "var(--success-color)";
        container.innerHTML = `
            <div class="card alert-success" style="text-align: center; padding: 40px;">
                <div style="font-size: 3rem; margin-bottom: 15px;">✅</div>
                <h3>Aucune anomalie détectée</h3>
                <p>L'analyse ${mode === 'full' ? 'approfondie' : 'rapide'} n'a révélé aucun problème critique.</p>
            </div>
        `;
        return;
    }

    statusText.textContent = `${issues.length} Problème(s) Détecté(s)`;
    statusText.style.color = issues.some(i => i.severity === 'critical' || i.severity === 'high') ? "var(--danger-color)" : "var(--warning-color)";

    issues.sort((a, b) => {
        const severityScore = { critical: 4, high: 3, medium: 2, low: 1 };
        return severityScore[b.severity] - severityScore[a.severity];
    });

    issues.forEach(issue => {
        const color = {
            critical: '--danger-color',
            high: '#e74c3c',
            medium: '--warning-color',
            low: '--success-color' // greenish for low info
        }[issue.severity] || '--text-primary';

        const item = document.createElement('div');
        item.className = 'card fade-in';
        item.style.borderLeft = `4px solid var(${color})`;
        item.innerHTML = `
            <div class="flex" style="justify-content: space-between; align-items: start;">
                <div>
                    <h4 style="color: var(${color}); font-weight: 700; margin-bottom: 5px;">
                        ${getSeverityIcon(issue.severity)} ${issue.title}
                    </h4>
                    <p style="color: var(--text-secondary);">${issue.desc}</p>
                </div>
                <!-- <button class="btn btn-small btn-secondary">${issue.action}</button> -->
            </div>
        `;
        container.appendChild(item);
    });
}

function getSeverityIcon(sev) {
    if (sev === 'critical') return '🔥';
    if (sev === 'high') return '🔴';
    if (sev === 'medium') return '🟠';
    return 'ℹ️';
}

function clearDiagnostics() {
    document.getElementById('diag-results').innerHTML = '';
    document.getElementById('diag-status-text').textContent = 'En attente d\'analyse...';
    document.getElementById('diag-status-text').style.color = 'var(--text-secondary)';
}

// Make global
window.runDiagnostics = runDiagnostics;
window.clearDiagnostics = clearDiagnostics;
