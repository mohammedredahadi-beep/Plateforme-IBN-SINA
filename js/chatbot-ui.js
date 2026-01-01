/**
 * Chatbot UI Manager
 * Génère et gère l'interface du chatbot de manière centralisée.
 */

class ChatbotUI {
    constructor() {
        this.isOpen = false;
        this.isMinimized = false;
        this.init();
    }

    init() {
        // Injecter le CSS si nécessaire (ou supposer qu'il est dans styles.css)
        this.render();
        this.attachEvents();
        this.displayWelcomeMessage();
    }

    render() {
        // Créer le bouton flottant
        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'chatbot-toggle';
        toggleBtn.className = 'chatbot-toggle';
        toggleBtn.innerHTML = '<span>🤖</span>';
        toggleBtn.title = "Besoin d'aide ?";

        // Créer la fenêtre du chatbot
        const windowDiv = document.createElement('div');
        windowDiv.id = 'chatbot-window';
        windowDiv.className = 'chatbot-window hidden';

        windowDiv.innerHTML = `
            <div class="chatbot-header">
                <div class="flex" style="align-items: center; gap: 10px;">
                    <span style="font-size: 1.2rem;">🤖</span>
                    <div style="line-height: 1.2;">
                        <strong style="display: block; font-size: 0.9rem;">Assistant IBN SINA</strong>
                        <small style="font-size: 0.7rem; opacity: 0.8;">IA Connectée</small>
                    </div>
                </div>
                <div class="flex gap-1">
                    <button class="chatbot-control" id="chatbot-minimize">−</button>
                    <button class="chatbot-control" id="chatbot-close">✕</button>
                </div>
            </div>
            <div id="chatbot-body" class="chatbot-body">
                <div id="chatbot-messages" class="chatbot-messages"></div>
                <div class="chatbot-input-container">
                    <input type="text" id="chatbot-input" placeholder="Posez une question..." autocomplete="off">
                    <button id="chatbot-send">➤</button>
                </div>
            </div>
        `;

        document.body.appendChild(toggleBtn);
        document.body.appendChild(windowDiv);

        this.elements = {
            toggle: toggleBtn,
            window: windowDiv,
            body: windowDiv.querySelector('#chatbot-body'),
            messages: windowDiv.querySelector('#chatbot-messages'),
            input: windowDiv.querySelector('#chatbot-input'),
            send: windowDiv.querySelector('#chatbot-send'),
            minimize: windowDiv.querySelector('#chatbot-minimize'),
            close: windowDiv.querySelector('#chatbot-close')
        };
    }

    attachEvents() {
        this.elements.toggle.addEventListener('click', () => this.toggle());
        this.elements.close.addEventListener('click', () => this.toggle());
        this.elements.minimize.addEventListener('click', () => this.minimize());

        this.elements.send.addEventListener('click', () => this.sendMessage());
        this.elements.input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });
    }

    toggle() {
        this.isOpen = !this.isOpen;
        this.elements.window.classList.toggle('hidden', !this.isOpen);

        if (this.isOpen && this.isMinimized) {
            this.minimize(); // Restore if was minimized
        }

        // Animation simple
        if (this.isOpen) {
            this.elements.window.classList.add('fade-in-up');
            setTimeout(() => this.elements.input.focus(), 300);
        } else {
            this.elements.window.classList.remove('fade-in-up');
        }
    }

    minimize() {
        this.isMinimized = !this.isMinimized;
        this.elements.body.classList.toggle('hidden', this.isMinimized);

        if (this.isMinimized) {
            this.elements.window.style.height = '60px'; // Hauteur du header
        } else {
            this.elements.window.style.height = ''; // Auto (défini par CSS)
        }
    }

    displayWelcomeMessage() {
        // Message différent selon le rôle si possible, sinon générique
        const userRole = this.getUserRole();
        let msg = "👋 Bonjour ! Je suis l'assistant Ibn Sina. Comment puis-je vous aider ?";

        if (userRole === 'admin') {
            msg = "👋 Bonjour Administrateur ! Je suis là pour vous assister dans la gestion de la plateforme.";
        }

        this.appendMessage('ai', msg);
    }

    getUserRole() {
        // Tentative de récupération du rôle depuis l'objet currentUser global s'il existe
        try {
            if (typeof currentUser !== 'undefined' && currentUser) {
                return currentUser.role;
            }
        } catch (e) { }
        return 'visitor';
    }

    async sendMessage() {
        const text = this.elements.input.value.trim();
        if (!text) return;

        this.appendMessage('user', text);
        this.elements.input.value = '';

        // Placeholder pour l'IA
        const aiMsgId = 'ai-msg-' + Date.now();
        this.appendMessage('ai', '<span class="loading-dots">Réflexion...</span>', aiMsgId);

        try {
            // Utiliser la fonction globale getChatbotResponse (définie dans ai.js)
            if (typeof getChatbotResponse === 'function') {
                const userProfile = (typeof currentUser !== 'undefined') ? currentUser : null;

                // Simulation du streaming pour l'expérience utilisateur
                // getChatbotResponse appelle le callback avec la réponse complète ou des chunks
                const aiContainer = document.getElementById(aiMsgId);
                let isFirst = true;

                await getChatbotResponse(text, userProfile, (response) => {
                    if (isFirst) {
                        aiContainer.innerHTML = ''; // Effacer le loading
                        isFirst = false;
                    }
                    // Pour l'instant, ai.js renvoie tout d'un coup, mais on gère comme du texte
                    aiContainer.innerHTML = this.formatResponse(response);
                    this.scrollToBottom();
                });
            } else {
                const aiContainer = document.getElementById(aiMsgId);
                aiContainer.textContent = "Erreur: Le module IA (ai.js) n'est pas chargé.";
            }
        } catch (error) {
            console.error(error);
            const aiContainer = document.getElementById(aiMsgId);
            aiContainer.textContent = "Désolé, une erreur est survenue.";
        }
    }

    appendMessage(sender, html, id = null) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message-bubble ${sender === 'user' ? 'message-user' : 'message-ai'}`;
        if (id) msgDiv.id = id;
        msgDiv.innerHTML = html;
        this.elements.messages.appendChild(msgDiv);
        this.scrollToBottom();
    }

    scrollToBottom() {
        this.elements.messages.scrollTop = this.elements.messages.scrollHeight;
    }

    formatResponse(text) {
        // Conversion simple des sauts de ligne en <br>
        return text.replace(/\n/g, '<br>');
    }
}

// Initialisation au chargement
document.addEventListener('DOMContentLoaded', () => {
    // Petit délai pour s'assurer que le reste est chargé
    setTimeout(() => {
        window.chatbotUI = new ChatbotUI();
    }, 500);
});
