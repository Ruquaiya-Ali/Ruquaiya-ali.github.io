(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* a reload always starts at the top: no restored scroll, no leftover #section */
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  const toTop = () => window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  toTop();
  addEventListener('load', toTop);

  /* scroll progress bar: eases toward scrollY / scrollable height every frame,
     so the rings changing the page height never make the bar jump */
  const bar = document.querySelector('.progress');
  let shown = 0;
  const drawBar = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    const target = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
    shown = reduce || Math.abs(target - shown) < 0.0005 ? target : shown + (target - shown) * 0.2;
    bar.style.transform = `scaleX(${shown.toFixed(4)})`;
    requestAnimationFrame(drawBar);
  };
  requestAnimationFrame(drawBar);

  /* hero spotlight follows the cursor */
  const hero = document.querySelector('.hero');
  if (finePointer && !reduce) {
    let raf = 0;
    hero.addEventListener('pointermove', (e) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = hero.getBoundingClientRect();
        hero.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        hero.style.setProperty('--my', (e.clientY - r.top) + 'px');
      });
    });
  }

  /* rotating ticker: highlight one discipline at a time */
  const words = [...document.querySelectorAll('.tw')];
  if (!reduce && words.length) {
    let t = 0;
    setInterval(() => {
      words[t].classList.remove('on');
      t = (t + 1) % words.length;
      words[t].classList.add('on');
    }, 2200);
  }

  /* count-up stats, once, when the band is on screen */
  const fmt = (n) => Math.round(n).toLocaleString('en-US');
  const stats = [...document.querySelectorAll('[data-count]')];
  const paint = (el, k) => { el.textContent = (el.dataset.prefix || '') + fmt(+el.dataset.count * k) + el.dataset.suffix; };
  if (!reduce && 'IntersectionObserver' in window) {
    stats.forEach((el) => paint(el, 0));
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      const start = performance.now(), dur = 1800;
      const step = (now) => {
        const k = Math.min(1, (now - start) / dur);
        const eased = 1 - Math.pow(1 - k, 4);
        stats.forEach((el) => paint(el, eased));
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }, { threshold: 0.35 });
    io.observe(document.getElementById('stats'));
  }

  /* nav: active section + sliding indicator */
  const ind = document.querySelector('.nav-ind');
  const deskLinks = [...document.querySelectorAll('.nav-links a')];
  const menuLinks = [...document.querySelectorAll('.menu a')];
  const here = document.querySelector('.nav-here');
  const setActive = (id) => {
    let hit = null;
    deskLinks.forEach((a) => { const on = a.hash === '#' + id; a.classList.toggle('on', on); if (on) hit = a; });
    menuLinks.forEach((a) => a.classList.toggle('on', a.hash === '#' + id));
    here.textContent = '// ' + (hit ? hit.textContent.toLowerCase() : 'home');
    if (hit) {
      ind.style.width = hit.offsetWidth + 'px';
      ind.style.transform = `translateX(${hit.offsetLeft}px)`;
      ind.style.opacity = 1;
    } else ind.style.opacity = 0;
  };
  let current = 'home';
  const secIo = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { current = e.target.id; setActive(current); } });
  }, { rootMargin: '-45% 0px -50% 0px' });
  document.querySelectorAll('main section[id]').forEach((s) => secIo.observe(s));
  addEventListener('resize', () => setActive(current));
  document.fonts && document.fonts.ready.then(() => setActive(current));

  /* phone menu */
  const btn = document.querySelector('.menu-btn');
  const menu = document.getElementById('menu');
  const setMenu = (open) => {
    menu.hidden = !open;
    btn.setAttribute('aria-expanded', open);
    btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  };
  btn.addEventListener('click', () => setMenu(menu.hidden));
  menuLinks.forEach((a) => a.addEventListener('click', () => setMenu(false)));
  addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
  document.addEventListener('click', (e) => { if (!menu.hidden && !e.target.closest('.nav, .menu')) setMenu(false); });
  matchMedia('(min-width: 881px)').addEventListener('change', (e) => { if (e.matches) setMenu(false); });

  /* revolving rings (experience, skills): cards orbit a vertical axis, auto-advancing */
  const makeRing = (root) => {
    const orbit = root.querySelector('.orbit');
    const ring = orbit.querySelector('.orbit-ring');
    const cards = [...ring.children];
    const tabs = [...root.querySelectorAll('[role="tab"]')];
    const tabList = root.querySelector('[role="tablist"]');
    const dots = [...root.querySelectorAll('.xp-dots i')];
    const n = cards.length, STEP = (Math.PI * 2) / n, DWELL = 5500;
    let pos = 0, anim = 0, animating = false, elapsed = 0;
    let hover = false, focusIn = false, inView = false, dragging = false, paused = true;
    const wrapD = (d) => { d = ((d % n) + n) % n; return d > n / 2 ? d - n : d; };
    const radii = () => { const w = orbit.clientWidth; return [Math.min(w * 0.4, 600), Math.min(w * 0.45, 520)]; };

    // natural card heights; the stage blends between the two cards nearest the front
    let heights = [];
    const measure = () => { heights = cards.map((c) => c.offsetHeight); };

    const layout = () => {
      const [rx, rz] = radii();
      cards.forEach((c, i) => {
        const phi = wrapD(i - pos) * STEP, depth = (Math.cos(phi) + 1) / 2; // 1 = front, 0 = back
        // each card gets its own perspective and is stacked by depth, so cards never slice through each other
        c.style.transform = `perspective(2200px) translate3d(${(Math.sin(phi) * rx).toFixed(1)}px,0,${((Math.cos(phi) - 1) * rz).toFixed(1)}px) rotateY(${(phi * 0.62).toFixed(4)}rad)`;
        c.style.zIndex = String(Math.round(depth * 100));
        c.style.opacity = (0.15 + 0.85 * depth ** 1.6).toFixed(3);
        c.style.filter = depth > 0.995 ? 'none' : `brightness(${(0.45 + 0.55 * depth).toFixed(2)}) blur(${((1 - depth) * 2.5).toFixed(1)}px)`;
      });
      if (heights.length) {
        const i0 = Math.floor(pos), f = pos - i0, a = ((i0 % n) + n) % n, b = (a + 1) % n;
        ring.style.height = (heights[a] * (1 - f) + heights[b] * f).toFixed(1) + 'px';
      }
    };

    const setFront = (k) => {
      cards.forEach((c, i) => { const on = i === k; c.classList.toggle('front', on); c.inert = !on; c.setAttribute('aria-hidden', String(!on)); });
      tabs.forEach((t, i) => { const on = i === k; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; });
      dots.forEach((d) => d.classList.remove('on'));
      void tabList.offsetWidth; // restart the progress fill
      dots[k].classList.add('on');
      const t = tabs[k];
      tabList.scrollTo({ left: t.offsetLeft - (tabList.clientWidth - t.offsetWidth) / 2, behavior: reduce ? 'auto' : 'smooth' });
    };

    // flip cards: front summary <-> scrollable back; only the front card of the ring can flip
    const flipCard = (card, on = !card.classList.contains('flipped'), focusFace = false) => {
      card.classList.toggle('flipped', on);
      const [face, back] = card.querySelectorAll('.face');
      face.inert = on; face.setAttribute('aria-hidden', String(on));
      back.inert = !on; back.setAttribute('aria-hidden', String(!on));
      if (focusFace) (on ? back : face).querySelector('.flip-btn').focus();
      updatePaused();
    };
    cards.filter((c) => c.classList.contains('flipcard')).forEach((card) => {
      // keyboard activation (pointer taps are handled by the drag/tap logic below)
      card.querySelectorAll('.flip-btn').forEach((b) => b.addEventListener('click', (e) => { if (e.detail === 0) flipCard(card, undefined, true); }));
    });

    const goTo = (target) => {
      const from = pos, delta = target - from, t0 = performance.now(), dur = reduce ? 0 : 1100;
      cancelAnimationFrame(anim);
      animating = true; elapsed = 0;
      cards.forEach((c) => { if (c.classList.contains('flipped')) flipCard(c, false); });
      setFront(((Math.round(target) % n) + n) % n);
      const step = (now) => {
        const k = dur ? Math.min(1, (now - t0) / dur) : 1;
        const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        pos = from + delta * e;
        layout();
        if (k < 1) anim = requestAnimationFrame(step); else animating = false;
      };
      anim = requestAnimationFrame(step);
    };
    const goIndex = (k) => { const r = Math.round(pos); goTo(r + wrapD(k - r)); };

    const updatePaused = () => {
      paused = reduce || hover || focusIn || dragging || !inView || document.hidden || cards.some((c) => c.classList.contains('flipped'));
      orbit.classList.toggle('paused', paused);
    };
    let last = performance.now();
    const tick = (now) => {
      const dt = now - last; last = now;
      if (!paused && !animating) { elapsed += dt; if (elapsed >= DWELL) goTo(Math.round(pos) + 1); }
      requestAnimationFrame(tick);
    };

    orbit.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { hover = true; updatePaused(); } });
    orbit.addEventListener('pointerleave', () => { hover = false; updatePaused(); });
    root.addEventListener('focusin', () => { focusIn = true; updatePaused(); });
    root.addEventListener('focusout', (e) => { if (!root.contains(e.relatedTarget)) { focusIn = false; updatePaused(); } });
    document.addEventListener('visibilitychange', updatePaused);
    new IntersectionObserver(([en]) => { inView = en.isIntersecting; updatePaused(); }, { threshold: 0.3 }).observe(orbit);

    // drag / swipe to spin; a tap on a side card brings it to the front.
    // Touch waits until the finger picks a direction: sideways spins, up/down is left to the page scroll.
    let downX = 0, downY = 0, downPos = 0, moved = false, pending = false, downTarget = null;
    const begin = (e) => {
      dragging = true; downPos = pos;
      cancelAnimationFrame(anim); animating = false;
      orbit.setPointerCapture(e.pointerId);
      orbit.classList.add('dragging'); updatePaused();
    };
    orbit.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      if (e.pointerType === 'mouse' && e.target.closest('.face-scroll')) return; // let the mouse scroll/select the back face
      downTarget = e.target;
      moved = false; downX = e.clientX; downY = e.clientY; downPos = pos;
      if (e.pointerType === 'mouse') begin(e); else pending = true;
    });
    orbit.addEventListener('pointermove', (e) => {
      if (pending) {
        const ax = Math.abs(e.clientX - downX), ay = Math.abs(e.clientY - downY);
        if (Math.max(ax, ay) < 8) return;
        pending = false;
        if (ax <= ay) return; // vertical: let the page scroll
        begin(e);
      }
      if (!dragging) return;
      const dx = e.clientX - downX;
      if (Math.abs(dx) > 6) moved = true;
      pos = downPos - dx / (radii()[0] * 0.9);
      layout();
    });
    const release = (e) => {
      if (pending) { // touch that never moved: a tap
        pending = false;
        if (e.type !== 'pointerup') return;
        cancelAnimationFrame(anim); animating = false; dragging = true;
      }
      if (!dragging) return;
      dragging = false; orbit.classList.remove('dragging'); updatePaused();
      if (e.type === 'pointercancel') return goTo(Math.round(pos)); // browser took over: settle, don't navigate
      if (!moved && e.type === 'pointerup') {
        const card = downTarget && downTarget.closest('.flipcard');
        if (card && card.classList.contains('front')) { pos = downPos; layout(); flipCard(card); return; }
      }
      if (!moved) {
        const r = cards.find((c) => c.classList.contains('front')).getBoundingClientRect();
        if (e.clientX < r.left) return goTo(Math.round(pos) - 1);
        if (e.clientX > r.right) return goTo(Math.round(pos) + 1);
      }
      const dx = e.clientX - downX;
      goTo(Math.abs(dx) > 40 ? (dx < 0 ? Math.max(Math.ceil(pos - 1e-6), Math.round(downPos) + 1) : Math.min(Math.floor(pos + 1e-6), Math.round(downPos) - 1)) : Math.round(pos));
    };
    orbit.addEventListener('pointerup', release);
    orbit.addEventListener('pointercancel', release);

    root.querySelectorAll('.arrow-btn').forEach((b) => b.addEventListener('click', () => goTo(Math.round(pos) + +b.dataset.step)));
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => goIndex(i));
      t.addEventListener('keydown', (e) => {
        const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
        if (d) { e.preventDefault(); const k = (i + d + n) % n; goIndex(k); tabs[k].focus(); }
      });
    });
    addEventListener('resize', layout);
    cards.forEach((c) => new ResizeObserver(() => { measure(); layout(); }).observe(c));
    measure(); layout(); setFront(0); updatePaused(); requestAnimationFrame(tick);
  };
  document.querySelectorAll('[data-ring]').forEach(makeRing);

  /* project flip cards: tap anywhere (except links) to flip; keyboard moves focus to the visible face */
  document.querySelectorAll('.pc.flipcard').forEach((card) => {
    const [face, back] = card.querySelectorAll('.face');
    card.addEventListener('click', (e) => {
      if (e.target.closest('a')) return;
      if (e.target.closest('.face-scroll') && getSelection().toString()) return; // selecting text, not flipping
      const on = !card.classList.contains('flipped');
      card.classList.toggle('flipped', on);
      face.inert = on; face.setAttribute('aria-hidden', String(on));
      back.inert = !on; back.setAttribute('aria-hidden', String(!on));
      if (e.detail === 0 && e.target.closest('.flip-btn')) (on ? back : face).querySelector('.flip-btn').focus();
    });
  });

  /* project cards: 3D tilt + spotlight; skills: spotlight */
  if (finePointer && !reduce) {
    document.querySelectorAll('[data-tilt]').forEach((card) => {
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        card.classList.add('tracking');
        card.style.setProperty('--ry', ((x - 0.5) * 7).toFixed(2) + 'deg');
        card.style.setProperty('--rx', ((0.5 - y) * 6).toFixed(2) + 'deg');
        card.style.setProperty('--px', (x * 100).toFixed(1) + '%');
        card.style.setProperty('--py', (y * 100).toFixed(1) + '%');
      });
      card.addEventListener('pointerleave', () => {
        card.classList.remove('tracking');
        card.style.setProperty('--rx', '0deg');
        card.style.setProperty('--ry', '0deg');
      });
    });
  }
  if (finePointer) {
    document.querySelectorAll('[data-glow]').forEach((box) => {
      box.addEventListener('pointermove', (e) => {
        const r = box.getBoundingClientRect();
        box.style.setProperty('--px', (e.clientX - r.left) + 'px');
        box.style.setProperty('--py', (e.clientY - r.top) + 'px');
      });
    });
  }

  /* skills: a soft wave lights the chips when the bento scrolls into view */
  if (!reduce && 'IntersectionObserver' in window) {
    const chipIo = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        chipIo.unobserve(en.target);
        en.target.querySelectorAll('.chip').forEach((c, i) => {
          setTimeout(() => c.classList.add('lit'), 300 + i * 90);
          setTimeout(() => c.classList.remove('lit'), 900 + i * 90);
        });
      });
    }, { threshold: 0.6 });
    document.querySelectorAll('.bx').forEach((b) => chipIo.observe(b));
  }

  /* contact form: post to Formspree without leaving the page */
  const toast = document.querySelector('.toast');
  const showToast = (msg) => {
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3200);
  };
  const form = document.querySelector('.form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      const res = await fetch(form.action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(res.status);
      form.reset();
      showToast('// Message sent successfully');
    } catch (_) {
      showToast('// Something went wrong — please try again');
    } finally {
      btn.disabled = false;
    }
  });
})();
