// Script de diagnostic pour le delegate dashboard
// À exécuter dans la console du navigateur (F12)

console.log('=== DIAGNOSTIC DELEGATE DASHBOARD ===\n');

// 1. Vérifier que les éléments existent
console.log('1. VÉRIFICATION DES ÉLÉMENTS:');
const views = ['pending-view', 'validations-view', 'announcements-view', 'settings-view', 'history-view', 'notifications-view'];
views.forEach(viewId => {
    const el = document.getElementById(viewId);
    console.log(`  ${viewId}:`, el ? '✅ EXISTE' : '❌ MANQUANT');
    if (el) {
        console.log(`    - Classes:`, el.className);
        console.log(`    - Display:`, window.getComputedStyle(el).display);
        console.log(`    - Visibility:`, window.getComputedStyle(el).visibility);
        console.log(`    - Opacity:`, window.getComputedStyle(el).opacity);
        console.log(`    - Children:`, el.children.length);
    }
});

// 2. Vérifier les fonctions
console.log('\n2. VÉRIFICATION DES FONCTIONS:');
console.log('  showView:', typeof showView);
console.log('  handleDelegateView:', typeof handleDelegateView);

// 3. Vérifier le header qui pourrait cacher tout
console.log('\n3. VÉRIFICATION DU HEADER:');
const header = document.getElementById('requests-header');
if (header) {
    console.log('  requests-header EXISTE');
    console.log('    - Classes:', header.className);
    console.log('    - Display:', window.getComputedStyle(header).display);
    console.log('    - Height:', window.getComputedStyle(header).height);
    console.log('    - Position:', window.getComputedStyle(header).position);
} else {
    console.log('  requests-header: ❌ MANQUANT');
}

// 4. Vérifier la classe .hidden
console.log('\n4. VÉRIFICATION DE LA CLASSE .hidden:');
const testDiv = document.createElement('div');
testDiv.className = 'hidden';
document.body.appendChild(testDiv);
console.log('  Display de .hidden:', window.getComputedStyle(testDiv).display);
document.body.removeChild(testDiv);

// 5. Tester showView manuellement
console.log('\n5. TEST DE showView():');
if (typeof showView === 'function') {
    console.log('  Appel de showView("validations")...');
    showView('validations');
    setTimeout(() => {
        const validationsView = document.getElementById('validations-view');
        if (validationsView) {
            console.log('  Résultat - Classes:', validationsView.className);
            console.log('  Résultat - Display:', window.getComputedStyle(validationsView).display);
        }
    }, 100);
} else {
    console.log('  ❌ showView n\'existe pas!');
}

// 6. Vérifier la main-content
console.log('\n6. VÉRIFICATION DU CONTENEUR PRINCIPAL:');
const mainContent = document.querySelector('.main-content') || document.querySelector('main');
if (mainContent) {
    console.log('  main-content EXISTE');
    console.log('    - Display:', window.getComputedStyle(mainContent).display);
    console.log('    - Width:', window.getComputedStyle(mainContent).width);
    console.log('    - Height:', window.getComputedStyle(mainContent).height);
    console.log('    - Children visibles:', Array.from(mainContent.children).filter(c => window.getComputedStyle(c).display !== 'none').length);
} else {
    console.log('  ❌ main-content MANQUANT');
}

console.log('\n=== FIN DU DIAGNOSTIC ===');
console.log('Copiez ce résultat et partagez-le pour analyse.');
