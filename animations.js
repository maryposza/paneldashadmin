// ============================================================
// animations.js — AnimeJS · La Maison Sucrée
// Detecta la página via data-page en <body> y aplica
// las animaciones correspondientes.
// ============================================================

(function () {
  'use strict';

  const page = document.body.dataset.page;
  const EASE = 'easeOutCubic';

  document.addEventListener('DOMContentLoaded', () => {
    initScrollReveal();
    if (page === 'store')  initStore();
    if (page === 'admin')  initAdmin();
    if (page === 'pedido') initPedido();
  });

  // ── Scroll reveal genérico (elementos con data-reveal) ───────
  function initScrollReveal() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        anime({
          targets: entry.target,
          opacity: [0, 1],
          translateY: [32, 0],
          duration: 650,
          easing: EASE,
        });
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12 });

    document.querySelectorAll('[data-reveal]').forEach(el => {
      el.style.opacity = '0';
      observer.observe(el);
    });
  }

  // ══════════════════════════════════════════════════════════════
  // TIENDA (index.html)
  // ══════════════════════════════════════════════════════════════
  function initStore() {
    heroEntrance();
    watchProductGrid();
    filterButtonRipple();
    carritoButtonPulse();
  }

  function heroEntrance() {
    const tl = anime.timeline({ easing: EASE });

    tl.add({
      targets: '[data-anim="hero-eye"]',
      opacity: [0, 1],
      translateY: [-12, 0],
      duration: 600,
    })
    .add({
      targets: '[data-anim="hero-title"]',
      opacity: [0, 1],
      translateY: [24, 0],
      duration: 700,
    }, '-=350')
    .add({
      targets: '[data-anim="hero-sub"]',
      opacity: [0, 1],
      translateY: [16, 0],
      duration: 600,
    }, '-=400')
    .add({
      targets: '[data-anim="hero-cta"] > *',
      opacity: [0, 1],
      translateY: [12, 0],
      delay: anime.stagger(120),
      duration: 500,
    }, '-=350')
    .add({
      targets: '[data-anim="hero-scroll"]',
      opacity: [0, 1],
      duration: 400,
    }, '-=200');
  }

  function watchProductGrid() {
    const grid = document.getElementById('productos-grid');
    if (!grid) return;

    new MutationObserver(() => {
      const cards = grid.querySelectorAll('.product-card');
      if (!cards.length) return;
      anime({
        targets: [...cards],
        opacity: [0, 1],
        translateY: [20, 0],
        duration: 420,
        delay: anime.stagger(55),
        easing: EASE,
      });
    }).observe(grid, { childList: true });
  }

  function filterButtonRipple() {
    document.querySelectorAll('[data-filtro]').forEach(btn => {
      btn.addEventListener('click', () => {
        anime({
          targets: btn,
          scale: [1, 0.93, 1],
          duration: 220,
          easing: 'easeInOutQuad',
        });
      });
    });
  }

  function carritoButtonPulse() {
    const btn = document.getElementById('btn-carrito');
    if (!btn) return;
    btn.addEventListener('click', () => {
      anime({
        targets: btn,
        scale: [1, 1.18, 1],
        duration: 280,
        easing: 'easeInOutBack',
      });
    });
  }

  // ══════════════════════════════════════════════════════════════
  // ADMIN (admin.html)
  // ══════════════════════════════════════════════════════════════
  function initAdmin() {
    loginEntrance();
    watchAdminPanel();
    watchTabPanels();
  }

  function loginEntrance() {
    const card = document.querySelector('#pantalla-login .bg-white');
    if (!card) return;
    card.style.opacity = '0';
    anime({
      targets: card,
      opacity: [0, 1],
      translateY: [36, 0],
      duration: 650,
      easing: EASE,
    });
  }

  function watchAdminPanel() {
    const panel = document.getElementById('pantalla-admin');
    if (!panel) return;

    new MutationObserver(() => {
      if (panel.classList.contains('hidden')) return;

      // Stats cards stagger
      anime({
        targets: '#stats-cards > div',
        opacity: [0, 1],
        translateY: [18, 0],
        delay: anime.stagger(65),
        duration: 420,
        easing: EASE,
      });

      // Header + main fade
      anime({
        targets: [panel.querySelector('header'), panel.querySelector('main')],
        opacity: [0, 1],
        duration: 500,
        delay: anime.stagger(80),
        easing: EASE,
      });
    }).observe(panel, { attributes: true, attributeFilter: ['class'] });
  }

  function watchTabPanels() {
    document.querySelectorAll('[data-panel]').forEach(panelEl => {
      new MutationObserver(() => {
        if (!panelEl.classList.contains('hidden')) {
          anime({
            targets: panelEl,
            opacity: [0, 1],
            translateY: [8, 0],
            duration: 300,
            easing: 'easeOutQuad',
          });
        }
      }).observe(panelEl, { attributes: true, attributeFilter: ['class'] });
    });
  }

  // ══════════════════════════════════════════════════════════════
  // PEDIDO (pedido.html)
  // ══════════════════════════════════════════════════════════════
  function initPedido() {
    pageEntrance();
    watchResultados();
  }

  function pageEntrance() {
    anime({
      targets: 'main > *',
      opacity: [0, 1],
      translateY: [20, 0],
      delay: anime.stagger(90),
      duration: 550,
      easing: EASE,
    });
  }

  function watchResultados() {
    const cont = document.getElementById('resultado');
    if (!cont) return;

    new MutationObserver(() => {
      const cards = cont.querySelectorAll(':scope > div');
      if (!cards.length) return;
      anime({
        targets: [...cards],
        opacity: [0, 1],
        translateY: [20, 0],
        delay: anime.stagger(100),
        duration: 500,
        easing: EASE,
      });
    }).observe(cont, { childList: true });
  }

})();
