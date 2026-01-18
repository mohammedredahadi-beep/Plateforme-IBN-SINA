/**
 * premium-ui.js
 * Handles premium UI interactive elements like auto-scroll, number counters, and scroll-triggered animations.
 */

document.addEventListener('DOMContentLoaded', () => {
    initPremiumUI();
});

function initPremiumUI() {
    initAutoScroll();
    initNumberCounters();
    initScrollReveal();
    applyRevealToExistingElements();
}

/**
 * Initialize auto-scroll for containers with .auto-scroll-container
 */
function initAutoScroll() {
    const containers = document.querySelectorAll('.auto-scroll-container');

    containers.forEach(container => {
        let scrollInterval;
        let isPaused = false;

        const startScroll = () => {
            scrollInterval = setInterval(() => {
                if (isPaused) return;

                if (container.scrollLeft + container.clientWidth >= container.scrollWidth - 1) {
                    container.scrollTo({ left: 0, behavior: 'smooth' });
                } else {
                    container.scrollBy({ left: 2, behavior: 'auto' });
                }
            }, 30);
        };

        container.addEventListener('mouseenter', () => isPaused = true);
        container.addEventListener('mouseleave', () => isPaused = false);

        startScroll();
    });
}

/**
 * Animate numbers in elements with .stat-value
 */
function initNumberCounters() {
    const stats = document.querySelectorAll('.stat-value');

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const target = entry.target;
                const value = parseInt(target.textContent.replace(/\D/g, '')) || 0;
                if (value > 0) animateValue(target, 0, value, 1500);
                observer.unobserve(target);
            }
        });
    }, { threshold: 0.5 });

    stats.forEach(stat => observer.observe(stat));
}

function animateValue(obj, start, end, duration) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.innerHTML = Math.floor(progress * (end - start) + start);
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}

/**
 * Trigger .reveal-anim on scroll
 */
function initScrollReveal() {
    const revealElements = document.querySelectorAll('.reveal-on-scroll');

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('reveal-anim');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });

    revealElements.forEach(el => observer.observe(el));
}

/**
 * Automatically set reveal delay for grid children
 */
function applyRevealToExistingElements() {
    const grids = document.querySelectorAll('.grid, .stats-grid');
    grids.forEach(grid => {
        const children = grid.children;
        Array.from(children).forEach((child, index) => {
            child.style.animationDelay = `${index * 0.1}s`;
            child.classList.add('reveal-anim');
        });
    });
}

// Global helper to add a premium toast notification
window.premiumAlert = (message, type = 'info') => {
    const toast = document.createElement('div');
    toast.className = `glass-premium reveal-anim`
    toast.style.cssText = `
        position: fixed;
        bottom: 2rem;
        left: 50%;
        transform: translateX(-50%);
        padding: 1rem 2rem;
        border-radius: var(--rad-md);
        z-index: 10000;
        display: flex;
        align-items: center;
        gap: 1rem;
        font-weight: 600;
        color: var(--text-main);
        border-left: 4px solid var(--${type});
    `;

    const icon = type === 'success' ? '✅' : type === 'danger' ? '❌' : 'ℹ️';
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;

    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(20px)';
        toast.style.transition = 'all 0.5s ease';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
};
