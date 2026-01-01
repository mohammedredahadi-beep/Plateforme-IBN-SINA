// Logic for Forum IBN SINA
const forumPostsRef = db.collection('forum_posts');
let currentCategory = 'all';

// Initialize Forum Module
async function initForum() {
    console.log("Initializing Forum Module...");
    await loadForumPosts();
}

/**
 * Load forum posts from Firestore
 */
async function loadForumPosts(category = 'all') {
    currentCategory = category;
    const container = document.getElementById('forum-feed');
    if (!container) return;

    // Update active filter UI
    document.querySelectorAll('.filter-btn').forEach(btn => {
        if (btn.dataset.category === category) {
            btn.classList.add('active');
            btn.style.background = 'var(--primary-color)';
            btn.style.color = 'white';
        } else {
            btn.classList.remove('active');
            btn.style.background = 'var(--bg-secondary)';
            btn.style.color = 'var(--text-secondary)';
        }
    });

    container.innerHTML = `
        <div class="card text-center" style="padding: 40px;">
            <div class="loading"></div>
            <p style="margin-top: 10px; color: var(--text-secondary);">Chargement des discussions...</p>
        </div>
    `;

    try {
        let query = forumPostsRef.orderBy('createdAt', 'desc');

        if (category !== 'all') {
            query = query.where('category', '==', category);
        }

        const snapshot = await query.limit(20).get();

        if (snapshot.empty) {
            container.innerHTML = `
                <div class="card text-center" style="padding: 40px;">
                    <div style="font-size: 3rem; margin-bottom: 15px; opacity: 0.5;">💬</div>
                    <h3 style="margin-bottom: 10px;">Aucune discussion</h3>
                    <p style="color: var(--text-secondary);">Soyez le premier à poser une question dans cette catégorie !</p>
                </div>
            `;
            return;
        }

        let html = '';
        snapshot.forEach(doc => {
            const post = doc.data();
            const date = post.createdAt ? new Date(post.createdAt.toDate()).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : 'À l\'instant';
            const initials = post.authorName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

            // Badge color based on category
            let catColor = 'var(--primary-color)';
            if (post.category === 'Orientation') catColor = '#8b5cf6'; // Purple
            if (post.category === 'Stage') catColor = '#10b981'; // Green
            if (post.category === 'Campus') catColor = '#f59e0b'; // Orange

            html += `
                <div class="card forum-card fade-in" onclick="viewPost('${doc.id}')" style="cursor: pointer; transition: 0.2s;">
                    <div class="forum-header">
                        <div class="forum-avatar">${initials}</div>
                        <div>
                            <div class="forum-author">${post.authorName} <span class="badge" style="font-size: 0.7em; margin-left: 5px; opacity: 0.7;">${post.authorRole === 'student' ? 'Étudiant' : (post.authorRole === 'alumni' ? 'Lauréat' : 'Délégué')}</span></div>
                            <div class="forum-meta">${date}</div>
                        </div>
                        <span class="badge" style="margin-left: auto; background: ${catColor}; color: white;">${post.category}</span>
                    </div>
                    
                    <h3 class="forum-title">${post.title}</h3>
                    <p class="forum-preview">${post.content.substring(0, 150)}${post.content.length > 150 ? '...' : ''}</p>
                    
                    <div class="forum-footer">
                        <span class="action-btn">💬 ${post.commentCount || 0} réponses</span>
                        <span class="action-btn">❤️ ${post.likes || 0}</span>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;

    } catch (error) {
        console.error("Error loading forum posts:", error);
        // Fallback for missing index error
        if (error.code === 'failed-precondition') {
            container.innerHTML = `
                <div class="card text-center">
                    <p class="text-error">Index Firestore manquant pour le tri par date.</p>
                    <p>Veuillez contacter l'administrateur.</p>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="card text-center">
                    <p class="text-error">Erreur de chargement.</p>
                </div>
            `;
        }
    }
}

/**
 * Open Post Creation Modal
 */
function openNewPostModal() {
    // Create modal HTMl dynamically if not exists
    if (!document.getElementById('new-post-modal')) {
        const modal = document.createElement('div');
        modal.id = 'new-post-modal';
        modal.className = 'modal hidden';
        modal.innerHTML = `
            <div class="modal-content card" style="max-width: 600px;">
                <div class="card-header">
                    <h3 class="card-title">✍️ Nouvelle Discussion</h3>
                    <button class="btn btn-secondary btn-small" onclick="closeNewPostModal()">Fermer</button>
                </div>
                <form id="new-post-form" onsubmit="submitNewPost(event)">
                    <div class="form-group">
                        <label class="form-label">Titre</label>
                        <input type="text" id="post-title" class="form-input" required placeholder="Ex: Question sur les stages PFE...">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Catégorie</label>
                        <select id="post-category" class="form-select" required>
                            <option value="Orientation">Orientation</option>
                            <option value="Stage">Stage & Emploi</option>
                            <option value="Campus">Vie du Campus</option>
                            <option value="Autre">Autre</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Contenu</label>
                        <textarea id="post-content" class="form-textarea" rows="5" required placeholder="Détaillez votre question ou partagez une information..."></textarea>
                    </div>
                    <button type="submit" class="btn btn-primary" style="width: 100%;">Publier</button>
                </form>
            </div>
        `;
        // Add basic modal styles if needed, but assuming styles.css has .modal
        // We might need to add modal styles if they don't exist
        document.body.appendChild(modal);
    }

    document.getElementById('new-post-modal').classList.remove('hidden');
    document.getElementById('new-post-modal').style.display = 'flex'; // Ensure flex for centering
}

function closeNewPostModal() {
    const modal = document.getElementById('new-post-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }
}

/**
 * Submit New Post
 */
async function submitNewPost(e) {
    e.preventDefault();

    const title = document.getElementById('post-title').value;
    const category = document.getElementById('post-category').value;
    const content = document.getElementById('post-content').value;

    // Disable button
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.textContent;
    btn.textContent = 'Publication...';
    btn.disabled = true;

    try {
        await forumPostsRef.add({
            title: title,
            content: content,
            category: category,
            authorId: auth.currentUser.uid,
            authorName: currentUser.fullName || 'Utilisateur',
            authorRole: currentUser.role || 'student',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            likes: 0,
            commentCount: 0
        });

        alert('Message publié avec succès !');
        closeNewPostModal();
        e.target.reset();
        loadForumPosts(currentCategory); // Reload feed

    } catch (error) {
        console.error("Error creating post:", error);
        alert('Erreur lors de la publication.');
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

function viewPost(postId) {
    alert("La vue détaillée des posts sera disponible dans la prochaine mise à jour !");
}

// Global exports
window.initForum = initForum;
window.loadForumPosts = loadForumPosts;
window.openNewPostModal = openNewPostModal;
window.closeNewPostModal = closeNewPostModal;
window.submitNewPost = submitNewPost;
window.viewPost = viewPost;
