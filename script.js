// FORM — intercept submit, send via fetch, then clear inputs
const contactForm = document.querySelector('.contact-form');
if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = new FormData(contactForm);
        try {
            const res = await fetch(contactForm.action, {
                method: 'POST',
                body: data,
                headers: { 'Accept': 'application/json' }
            });
            if (res.ok) {
                contactForm.reset();
                const toast = document.createElement('div');
                toast.className = 'toast';
                toast.textContent = '// Message sent successfully';
                document.body.appendChild(toast);
                setTimeout(() => toast.classList.add('show'), 10);
                setTimeout(() => {
                    toast.classList.remove('show');
                    setTimeout(() => toast.remove(), 400);
                }, 3000);
            }
        } catch (_) {
            // silently fail — form still attempted
        }
    });
}

// FLIP CARDS — click / Enter / Space to flip; links inside don't flip
document.querySelectorAll('.flip-card').forEach(card => {
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'button');
    card.setAttribute('aria-pressed', 'false');
    const flip = () => {
        card.classList.toggle('flipped');
        card.setAttribute('aria-pressed', card.classList.contains('flipped'));
    };
    card.addEventListener('click', (e) => {
        if (e.target.closest('a')) return;
        flip();
    });
    card.addEventListener('keydown', (e) => {
        if (e.target !== card) return;
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            flip();
        }
    });
});

// HAMBURGER MENU
const navToggle = document.querySelector('.nav-toggle');
const navMenu = document.querySelector('.nav-links');

const setMenu = (open) => {
    navToggle.classList.toggle('open', open);
    navMenu.classList.toggle('open', open);
    navToggle.setAttribute('aria-expanded', open);
};

navToggle.addEventListener('click', () => {
    setMenu(!navMenu.classList.contains('open'));
});

navMenu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => setMenu(false));
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setMenu(false);
});

document.addEventListener('click', (e) => {
    if (navMenu.classList.contains('open') && !e.target.closest('nav')) setMenu(false);
});

// Close the mobile menu if the viewport grows past the phone breakpoint
window.matchMedia('(min-width: 768px)').addEventListener('change', (e) => {
    if (e.matches) setMenu(false);
});

// SCROLL REVEAL — repeats every time you enter/leave a section
const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
            setTimeout(() => {
                entry.target.classList.add('visible');
            }, i * 100);
        } else {
            entry.target.classList.remove('visible');
        }
    });
}, { threshold: 0.1 });

setTimeout(() => {
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
}, 100);

// ACTIVE NAV LINK ON SCROLL
const sections = document.querySelectorAll('section');
const navLinks = document.querySelectorAll('.nav-links a');

const navObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            navLinks.forEach(link => link.classList.remove('active'));
            const id = entry.target.getAttribute('id');
            const activeLink = document.querySelector(`.nav-links a[href="#${id}"]`);
            if (activeLink) activeLink.classList.add('active');
        }
    });
}, { threshold: 0.5 });

sections.forEach(section => navObserver.observe(section));
