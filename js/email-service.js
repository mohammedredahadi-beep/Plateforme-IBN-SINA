/**
 * EmailJS Service Wrapper
 * Handles initialization and sending of emails via EmailJS
 */

const EmailService = {
    isInitialized: false,
    config: {
        serviceId: 'service_ibnsina', // Placeholder default
        templateId: 'template_ibnsina', // Placeholder default
        publicKey: '' // User must provide this
    },

    /**
     * Initialize EmailJS with Public Key
     */
    init: function () {
        if (this.isInitialized) return;

        // Try to load from localStorage first
        const savedConfig = localStorage.getItem('emailjs_config');
        if (savedConfig) {
            this.config = JSON.parse(savedConfig);
        }

        if (this.config.publicKey && window.emailjs) {
            emailjs.init(this.config.publicKey);
            this.isInitialized = true;
            console.log("EmailJS Initialized");
        } else {
            console.warn("EmailJS not initialized: Missing Public Key or SDK");
        }
    },

    /**
     * Save configuration and initialize
     */
    saveConfig: function (serviceId, templateId, publicKey) {
        this.config = { serviceId, templateId, publicKey };
        localStorage.setItem('emailjs_config', JSON.stringify(this.config));
        this.init();
        return true;
    },

    /**
     * Send an email
     * @param {Object} params - The template parameters (to_name, message, etc.)
     */
    send: async function (params) {
        if (!this.isInitialized) {
            console.error("EmailJS not initialized. Please configure API Keys.");
            return { success: false, error: "Service non configuré (Clé Publique manquante)" };
        }

        if (!this.config.serviceId || !this.config.templateId) {
            return { success: false, error: "Service ID ou Template ID manquant" };
        }

        try {
            const response = await emailjs.send(
                this.config.serviceId,
                this.config.templateId,
                params
            );
            console.log("Email sent successfully", response);
            return { success: true, response };
        } catch (error) {
            console.error("Email send failed", error);
            return { success: false, error: error };
        }
    }
};

// Auto-init on load
document.addEventListener('DOMContentLoaded', () => {
    // Wait slightly for SDK to load
    setTimeout(() => {
        EmailService.init();
    }, 1000);
});
