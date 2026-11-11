// Dala — animações da página (GSAP 3 + ScrollTrigger), com os valores do site original.
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const G = window.gsap;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isTouch = matchMedia('(hover: none)').matches;
  if (G && window.ScrollTrigger) G.registerPlugin(ScrollTrigger);

  /* ---------------------------------------------------------
     Conteúdo gerado (paletas, escalas, curvas, tokens)
     --------------------------------------------------------- */
  const colors = {
    base: [['Background', '#000000', '--color-bg'], ['Surface', '#070707', '--color-surface'], ['Surface 2', '#2F2F2F', '--color-surface-2'], ['Surface 3', '#3D424E', '--color-surface-3'], ['Text', '#FFFFFF', '--color-text'], ['Text muted', '#9A9A9A', '--color-text-muted'], ['Text subtle', '#BDBDBD', '--color-text-subtle'], ['Light', '#E9E9E9', '--color-light'], ['Border', 'rgba(255,255,255,.1)', '--color-border']],
    brand: [['Accent', '#FF6B00', '--color-accent'], ['Accent light', '#FFE1CC', '--color-accent-light'], ['Highlight', '#FFB829', '--color-highlight'], ['Green', '#189B81', '--color-green'], ['Hover', '#D95B00', '--color-hover'], ['Twitter', '#1DA1F2', '--color-twitter'], ['LinkedIn', '#2867B2', '--color-linkedin']],
    particles: [['Amber', '#C08000', '--particle-amber'], ['Orange', '#B04900', '--particle-violet'], ['Green', '#007040', '--particle-green'], ['Teal', '#006070', '--particle-teal'], ['Dust', '#B0A0B0', '--particle-dust']],
    front: [['Orange', '#B8500F', '--front-violet'], ['Amber', '#BA882B', '--front-amber'], ['Green', '#287464', '--front-green'], ['Sand', '#C9A58C', '--front-lilac']],
  };
  $$('[data-swatches]').forEach(el => {
    el.innerHTML = colors[el.dataset.swatches].map(([n, h, t]) =>
      `<button class="swatch" data-copy="${h}"><div class="swatch__chip" style="background:${h}"></div><div class="swatch__info"><span class="swatch__name">${n}</span><span class="swatch__hex">${h}</span><span class="swatch__token">${t}</span></div></button>`).join('');
  });

  const sizes = [[150, 'Display', .9, -.04], [104, 'Display S', .9, -.04], [80, 'H1', 1, -.03], [64, 'H2', 1.1, -.03], [48, 'H3', 1.1, -.02], [36, 'H4', 1.2, -.01], [24, 'Lead', 1.3, 0], [18, 'Body L', 1.5, 0], [16, 'Body / Label', 1.5, 0], [14, 'Small', 1.4, 0], [12, 'Micro', 1.4, 0]];
  const ts = $('#typescale');
  if (ts) ts.innerHTML = sizes.map(([px, n, lh, ls]) => {
    const label = n.includes('Label');
    return `<div class="type-row"><div class="type-row__meta">${n}<br>${px}px · ${px / 16}rem<br>lh ${lh}</div><div class="type-row__sample" style="font-size:min(${px}px, ${px / 9.6}vw + 12px);line-height:${lh};letter-spacing:${ls}em${label ? ';text-transform:uppercase;font-weight:600;letter-spacing:.025em' : ''}">${label ? 'Request access' : 'Unlock collective wisdom'}</div></div>`;
  }).join('');

  const spaces = [['--space-1', .375], ['--space-2', .75], ['--space-3', 1], ['--space-4', 1.5], ['--space-5', 2], ['--space-6', 3], ['--space-7', 4.5], ['--space-8', 7.5]];
  const ss = $('#spacescale');
  if (ss) ss.innerHTML = spaces.map(([t, r]) => `<div class="space-row"><code>${t}</code><span class="muted">${r}rem · ${r * 16}px</span><div class="space-bar" style="width:${r * 16}px;max-width:100%"></div></div>`).join('');

  const curves = {
    css: [['Out quart', '--ease-out-quart', 'cubic-bezier(.25,1,.5,1)', .3], ['Out soft', '--ease-out-soft', 'cubic-bezier(.5,1,.89,1)', .5], ['Out expo', '--ease-out-expo', 'cubic-bezier(.19,1,.22,1)', .6], ['Out cubic', '--ease-out-cubic', 'cubic-bezier(.215,.61,.355,1)', 1.1], ['In-out', '--ease-in-out', 'cubic-bezier(.76,0,.24,1)', .6]],
    gsap: [['expo.out', 'assinatura do site', 'expo.out', 1], ['expo.in', 'máscara entrando', 'expo.in', .5], ['expo.inOut', 'pulso do botão (toque)', 'expo.inOut', .6], ['power3.out', 'títulos em linhas', 'power3.out', 1.5], ['power1.out', 'letras do menu', 'power1.out', .5], ['quad.out', 'foto do slider', 'quad.out', .5], ['quad.inOut', 'ícone girando', 'quad.inOut', 1], ['power2.out', 'rotação do cérebro', 'power2.out', 3]],
  };
  $$('[data-motion]').forEach(grid => {
    const kind = grid.dataset.motion;
    grid.innerHTML = curves[kind].map(([n, t, c, d]) =>
      `<div class="motion" role="button" tabindex="0" data-ease="${c}" data-dur="${d}" data-kind="${kind}"><div class="motion__track"><span class="motion__dot"${kind === 'css' ? ` style="transition:left ${d}s ${c}"` : ''}></span></div><b>${n} · ${d}s</b><code>${kind === 'css' ? `${t}: ${c}` : `ease: "${c}" · ${t}`}</code></div>`).join('');
  });
  $$('.motion').forEach(m => {
    const go = () => {
      if (m.dataset.kind === 'gsap' && G) {
        const dot = $('.motion__dot', m), track = $('.motion__track', m);
        const on = !m.classList.contains('is-on'); m.classList.toggle('is-on', on);
        G.to(dot, { x: on ? track.clientWidth - 14 : 0, duration: +m.dataset.dur, ease: m.dataset.ease });
      } else m.classList.toggle('is-run');
    };
    m.addEventListener('click', go);
    m.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
  });

  const styleText = $('style').textContent;
  const start = styleText.indexOf(':root{');
  const rootBlock = styleText.slice(start, styleText.indexOf('}', start) + 1);
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const all = $('#all-tokens');
  if (all) all.innerHTML = esc(rootBlock.replace(':root{', ':root {'))
    .replace(/(\/\*[^*]*\*\/)/g, '<span class="c">$1</span>')
    .replace(/(--[\w-]+)(:)/g, '<span class="k">$1</span>$2 ');

  /* ---------------------------------------------------------
     Copiar
     --------------------------------------------------------- */
  const toast = $('.toast'), tt = $('#toast-text'); let tId;
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); }
    catch (e) { const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (_) {} ta.remove(); }
  }
  function flash(msg) { tt.textContent = msg; toast.classList.add('is-show'); clearTimeout(tId); tId = setTimeout(() => toast.classList.remove('is-show'), 1600); }
  $$('.copy').forEach(b => b.addEventListener('click', async () => {
    await copy(b.nextElementSibling.innerText);
    b.textContent = 'Copied'; b.classList.add('is-done'); flash('Código copiado');
    setTimeout(() => { b.textContent = 'Copy'; b.classList.remove('is-done'); }, 1600);
  }));
  document.addEventListener('click', async e => {
    const s = e.target.closest('[data-copy]'); if (!s) return;
    await copy(s.dataset.copy); flash(s.dataset.copy + ' copiado');
  });

  /* ---------------------------------------------------------
     Sidebar ativa
     --------------------------------------------------------- */
  const links = $$('.sidebar a');
  const io = new IntersectionObserver(es => es.forEach(en => {
    if (en.isIntersecting) links.forEach(l => l.classList.toggle('is-active', l.getAttribute('href') === '#' + en.target.id));
  }), { rootMargin: '-40% 0px -55% 0px' });
  $$('section.ds').forEach(s => io.observe(s));

  /* ---------------------------------------------------------
     Divisão de texto em linhas e letras
     --------------------------------------------------------- */
  const isPlain = el => [...el.childNodes].every(n => n.nodeType === 3 || n.nodeName === 'BR');
  function restore(el) { if (el._orig !== undefined) el.innerHTML = el._orig; }
  function splitLines(el) {
    if (el._orig === undefined) el._orig = el.innerHTML; else el.innerHTML = el._orig;
    if (!isPlain(el)) {
      const inner = document.createElement('span'); inner.className = 'split-inner';
      while (el.firstChild) inner.appendChild(el.firstChild);
      const wrap = document.createElement('span'); wrap.className = 'split-line';
      wrap.appendChild(inner); el.appendChild(wrap);
      return [inner];
    }
    el.innerHTML = el.innerHTML.split(/<br\s*\/?>/i)
      .map(seg => seg.trim().split(/\s+/).filter(Boolean).map(w => `<span class="sw" style="display:inline-block">${w}</span>`).join(' '))
      .join('<br>');
    const lines = []; let top = null;
    $$('.sw', el).forEach(w => {
      if (top === null || Math.abs(w.offsetTop - top) > 2) { lines.push([]); top = w.offsetTop; }
      lines[lines.length - 1].push(w.innerHTML);
    });
    el.innerHTML = lines.map(l => `<span class="split-line"><span class="split-inner">${l.join(' ')}</span></span>`).join('');
    return $$('.split-inner', el);
  }

  // preset splitTextRotateIn: y 120%, rotate, origin 0 0, stagger .1 (power1.in), power3.out
  function rotateIn(el, { rotate = 7, duration = .8, delay = 0, scroll = true } = {}) {
    if (!G) return;
    const lines = splitLines(el);
    const vars = { y: '120%', rotate, transformOrigin: '0 0', duration, delay, ease: 'power3.out', stagger: { each: .1, ease: 'power1.in' }, onComplete: () => restore(el) };
    if (scroll) vars.scrollTrigger = { trigger: el, start: 'top bottom' };
    return G.from(lines, vars);
  }

  // preset splitCharsWipeUpIn: y 100%, expo.out, 1.5s, atraso .035 × linha + .025 × letra
  function charsIn(el, { delay = 0, duration = 1.5, scroll = false } = {}) {
    if (!G) return;
    const lines = splitLines(el);
    const chars = [], delays = [];
    lines.forEach((line, li) => {
      line.innerHTML = [...line.textContent].map(c => `<span class="split-ch">${c === ' ' ? ' ' : c.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</span>`).join('');
      $$('.split-ch', line).forEach(ch => { delays.push(.035 * li + .025 * chars.length + delay); chars.push(ch); });
    });
    const vars = { y: '100%', ease: 'expo.out', duration, stagger: (i) => delays[i] - delay, delay, onComplete: () => restore(el) };
    if (scroll) vars.scrollTrigger = { trigger: el, start: 'top bottom' };
    return G.from(chars, vars);
  }

  // blocos: yPercent 100, autoAlpha 0, rotate 14, expo.out, 1s
  function blockIn(targets, { delay = 0, stagger = .1, scroll = false, yPercent = 100, rotate = 14 } = {}) {
    if (!G) return;
    const vars = { yPercent, autoAlpha: 0, rotate, ease: 'expo.out', duration: 1, delay, stagger, transformOrigin: '0 0' };
    if (scroll) vars.scrollTrigger = { trigger: Array.isArray(targets) ? targets[0] : targets, start: 'top bottom' };
    return G.from(targets, vars);
  }

  /* ---------------------------------------------------------
     Rolagem suave (lerp .075)
     --------------------------------------------------------- */
  const smooth = { on: !isTouch && !reduce, target: scrollY, current: scrollY, active: false };
  const maxScroll = () => document.documentElement.scrollHeight - innerHeight;
  addEventListener('wheel', e => {
    if (!smooth.on || e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    e.preventDefault();
    const d = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaMode === 2 ? e.deltaY * innerHeight : e.deltaY;
    if (!smooth.active) smooth.current = smooth.target = scrollY;
    smooth.target = clamp(smooth.target + d, 0, maxScroll());
    smooth.active = true;
  }, { passive: false });
  addEventListener('scroll', () => { if (!smooth.active) smooth.current = smooth.target = scrollY; }, { passive: true });
  let last = performance.now();
  (function tick(now) {
    const k = Math.min((now - last) / 16.67, 3); last = now;
    if (smooth.active) {
      smooth.current += (smooth.target - smooth.current) * 0.075 * k;
      if (Math.abs(smooth.target - smooth.current) < 0.5) { smooth.current = smooth.target; smooth.active = false; }
      window.scrollTo(0, smooth.current);
    }
    requestAnimationFrame(tick);
  })(last);
  function jumpTo(y) { smooth.active = false; smooth.current = smooth.target = y; window.scrollTo(0, y); }
  const toggle = $('#smooth-toggle');
  if (toggle) {
    const sync = () => { toggle.setAttribute('aria-pressed', String(smooth.on)); toggle.lastChild.textContent = smooth.on ? 'Ligada' : 'Desligada'; };
    sync();
    toggle.addEventListener('click', () => { smooth.on = !smooth.on; smooth.active = false; sync(); });
  }

  /* ---------------------------------------------------------
     Header: logo encolhe ao rolar
     --------------------------------------------------------- */
  const header = { bg: $('.topnav__bg'), letters: $$('.logo__text span'), small: $('.logo small'), hidden: false };
  function updateHeader() {
    if (!G) return;
    const shouldHide = scrollY > 60;
    if (shouldHide === header.hidden) return;
    header.hidden = shouldHide;
    G.killTweensOf([header.bg, ...header.letters, header.small]);
    if (shouldHide) {
      G.timeline()
        .to(header.bg, { scaleY: 1, duration: 1, ease: 'expo.out' }, 0)
        .to(header.letters, { yPercent: -110, duration: 1, ease: 'expo.out', stagger: .05 }, 0)
        .to(header.small, { autoAlpha: 0, duration: .5, ease: 'expo.out' }, 0);
    } else {
      G.timeline()
        .to(header.bg, { scaleY: 0, duration: 1, ease: 'expo.out' }, 0)
        .fromTo(header.letters, { yPercent: 110 }, { yPercent: 0, duration: 1, ease: 'expo.out', stagger: .05 }, 0)
        .to(header.small, { autoAlpha: 1, duration: .5, ease: 'expo.out' }, .2);
    }
  }
  addEventListener('scroll', updateHeader, { passive: true });

  /* ---------------------------------------------------------
     Menu: letras rolam no hover
     --------------------------------------------------------- */
  $$('.nav-link').forEach(link => {
    const text = link.textContent;
    link.setAttribute('aria-label', text);
    link.innerHTML = [...text].map(c => `<span class="ch" aria-hidden="true">${c}</span>`).join('');
    if (!G || isTouch) return;
    const chars = $$('.ch', link);
    const tl = G.timeline({ paused: true })
      .set(chars, { textShadow: '0 1.4em' }, 0)
      .to(chars, { yPercent: -100, duration: .5, ease: 'power1.out', stagger: .035 }, 0)
      .set(chars, { yPercent: 0, textShadow: 'none' });
    link.addEventListener('mouseenter', () => { if (!tl.isActive()) tl.restart(); });
  });

  /* ---------------------------------------------------------
     Máscara de navegação
     --------------------------------------------------------- */
  const mask = { el: $('#mask'), bg: $('#mask .mask__bg'), icon: $('#mask svg'), busy: false };
  function targetY(hash) {
    if (hash === '#top' || hash === '#') return 0;
    const t = $(hash); if (!t) return null;
    return t.getBoundingClientRect().top + scrollY - 80;
  }
  $$('[data-mask]').forEach(a => a.addEventListener('click', e => {
    const hash = a.getAttribute('href');
    if (!hash || !hash.startsWith('#')) return;
    e.preventDefault();
    if (!G || reduce) { const y = targetY(hash); if (y !== null) jumpTo(y); return; }
    if (mask.busy) return; mask.busy = true;
    G.timeline({ onComplete: () => { mask.busy = false; } })
      .set(mask.icon, { scale: 0, rotation: 0 })
      .set(mask.el, { pointerEvents: 'auto' })
      .to(mask.bg, { autoAlpha: 1, duration: .5, ease: 'expo.in' }, 0)
      .to(mask.icon, { autoAlpha: 1, scale: 1, duration: .5, ease: 'expo.in' }, .2)
      .to(mask.icon, { rotate: 90, repeat: 2, duration: 1, ease: 'quad.inOut' }, .2)
      .call(() => { const y = targetY(hash); if (y !== null) jumpTo(y); history.replaceState(null, '', hash); }, null, 1)
      .to(mask.icon, { autoAlpha: 0, scale: 0, duration: .5, ease: 'expo.in' }, 2)
      .to(mask.bg, { autoAlpha: 0, duration: .5, ease: 'expo.out' }, 2.3)
      .set(mask.el, { pointerEvents: 'none' });
  }));
  $$('.sidebar a').forEach(a => a.addEventListener('click', e => {
    const y = targetY(a.getAttribute('href')); if (y === null) return;
    e.preventDefault();
    if (smooth.on) { smooth.current = scrollY; smooth.target = clamp(y, 0, maxScroll()); smooth.active = true; } else jumpTo(y);
  }));

  /* ---------------------------------------------------------
     Slider da equipe
     --------------------------------------------------------- */
  const team = $('#team');
  if (team && G) {
    const cards = $$('.team-card', team).map(el => ({ el, img: $('.team-card__image', el), text: $('.team-card__text', el), icons: $$('.team-card__social a', el) }));
    let active = 0, allow = true;
    const step = () => cards[0].el.offsetWidth + 24;
    const slot = (i) => ((i - active + 1) % 3 + 3) % 3 - 1;
    function place(animate) {
      cards.forEach((c, i) => {
        const s = slot(i), x = s * step();
        const prev = c.slot; c.slot = s;
        if (!animate || prev === undefined || Math.abs(prev - s) > 1) {
          G.set(c.el, { x });
          if (animate) G.fromTo(c.el, { autoAlpha: 0 }, { autoAlpha: .9, duration: .5, ease: 'quad.out' });
          else G.set(c.el, { autoAlpha: s === 0 ? 1 : .9 });
        } else G.to(c.el, { x, autoAlpha: s === 0 ? 1 : .9, duration: .5, ease: 'power1.out' });
      });
    }
    function setActive(next, first) {
      const old = cards[active], cur = cards[next];
      active = next; allow = false;
      place(!first);
      const d = first ? 0 : .5;
      if (!first && old !== cur) {
        G.to(old.img, { scale: 1, filter: 'grayscale(1) brightness(0.1)', duration: .5, ease: 'quad.out' });
        G.to(old.text, { y: '-110%', ease: 'expo.out', duration: .7 });
        G.to(old.icons, { scale: 0, stagger: .1, duration: .7, ease: 'expo.out' });
      }
      G.to(cur.img, { scale: 1.2, filter: 'grayscale(0) brightness(1)', duration: d || .01, ease: 'quad.out' });
      G.fromTo(cur.text, { y: '110%' }, { y: 0, duration: .7, ease: 'expo.out', delay: d });
      G.fromTo(cur.icons, { scale: 0 }, { scale: 1, duration: .7, stagger: .2, ease: 'expo.out', delay: first ? .2 : 1 });
      setTimeout(() => { allow = true; }, 500);
    }
    cards.forEach((c, i) => { if (i !== 0) { G.set(c.text, { y: '110%' }); G.set(c.icons, { scale: 0 }); } });
    setActive(0, true);
    const pulse = (btn) => {
      if (!isTouch) return;
      G.timeline({ yoyo: true, repeat: 1 })
        .fromTo($('.round-btn__bg', btn), { scale: 1 }, { scale: 1.1, ease: 'expo.inOut', duration: .6 }, 0)
        .fromTo($('.round-btn__hover', btn), { scale: 0 }, { scale: 1.1, ease: 'expo.inOut', duration: .6 }, 0);
    };
    $('#team-next').addEventListener('click', e => { if (!allow) return; pulse(e.currentTarget); setActive((active + 1) % 3); });
    $('#team-prev').addEventListener('click', e => { if (!allow) return; pulse(e.currentTarget); setActive((active + 2) % 3); });
    addEventListener('resize', () => place(false));
  }

  /* ---------------------------------------------------------
     Entradas por rolagem
     --------------------------------------------------------- */
  function setupScrollAnimations() {
    if (!G) return;
    $$('[data-split]').forEach(el => rotateIn(el, { rotate: 7, duration: 1 }));
    $$('[data-reveal]').forEach(el => rotateIn(el, { rotate: 7, duration: .8, delay: .2 }));
    $$('[data-block]').forEach(el => blockIn(el, { scroll: true, yPercent: 30, rotate: 4 }));
    $$('.story__card').forEach(el => blockIn(el, { scroll: true, yPercent: 40, rotate: 6 }));
    if ($('#px-a')) {
      G.from('#px-a', { y: '-5vw', ease: 'none', scrollTrigger: { trigger: '#px-a', scrub: .5, start: 'top bottom' } });
      G.from('#px-b', { y: '2vw', ease: 'none', scrollTrigger: { trigger: '#px-b', scrub: .5, start: 'top bottom' } });
    }
    const dl = $('#demo-lines'); if (dl) rotateIn(dl, { rotate: 7, duration: 1.5, scroll: true });
    const dc = $('#demo-chars'); if (dc) charsIn(dc, { scroll: true });
    const db = $('#demo-blocks'); if (db) blockIn($$('.mini-card', db), { scroll: true });
  }

  /* ---------------------------------------------------------
     Loader + entrada do hero
     --------------------------------------------------------- */
  const loader = { el: $('#loader'), spinner: $('#loader .loader__spinner'), lines: $$('#loader .loader__line > span'), loading: $('#loader .loader__loading > span') };
  let brain = null, spinTween = null;

  function heroIntro() {
    if (!G) return;
    rotateIn($('#hero-title'), { rotate: 7, duration: 1, scroll: false });
    charsIn($('#hero-eyebrow'), { delay: .4 });
    rotateIn($('#hero-lead'), { rotate: 7, duration: .8, delay: .5, scroll: false });
    blockIn($$('#hero-cta > *'), { delay: .7 });
  }

  function loaderIn() {
    G.set(loader.el, { autoAlpha: 1 });
    G.set(loader.spinner, { autoAlpha: 1, scale: 1, rotation: 0 });
    G.set(loader.loading, { yPercent: 0, rotate: 0 });
    G.fromTo(loader.lines, { yPercent: 120, rotate: 2 }, { yPercent: 0, rotate: 0, duration: 1.5, ease: 'expo.out', stagger: .1 });
    spinTween = G.to(loader.spinner, { rotate: '+=90', duration: 1, ease: 'quad.inOut', repeat: -1 });
  }
  function loaderOut(onReveal) {
    return G.timeline({ onComplete: () => { spinTween && spinTween.kill(); } })
      .to(loader.loading, { yPercent: -110, rotate: 5, ease: 'expo.out', duration: 2 }, 0)
      .to(loader.lines, { yPercent: -120, rotate: 2, ease: 'expo.out', duration: 2, stagger: .1 }, 0)
      .to(loader.spinner, { autoAlpha: 0, scale: 0, duration: .5, ease: 'expo.in' }, 0)
      .call(onReveal, null, .7)
      .to(loader.el, { autoAlpha: 0, duration: .6, ease: 'none' }, .8);
  }

  async function boot() {
    if (!G) { loader.el.style.display = 'none'; startBrain(); return; }
    loaderIn();
    const brainPromise = startBrain();
    await Promise.all([Promise.race([brainPromise, wait(9000)]), wait(1600)]);
    setupScrollAnimations();
    loaderOut(() => { heroIntro(); brain && brain.activate(G); updateScene(); });
  }

  $$('[data-replay]').forEach(b => b.addEventListener('click', () => {
    if (!G) return;
    const kind = b.dataset.replay;
    if (kind === 'loader') { loaderIn(); wait(1600).then(() => loaderOut(() => heroIntro())); }
    if (kind === 'lines') rotateIn($('#demo-lines'), { rotate: 7, duration: 1.5, scroll: false });
    if (kind === 'chars') charsIn($('#demo-chars'));
    if (kind === 'blocks') blockIn($$('#demo-blocks .mini-card'));
    if (kind === 'logo') {
      G.timeline()
        .to(header.letters, { yPercent: -110, duration: 1, ease: 'expo.out', stagger: .05 })
        .fromTo(header.letters, { yPercent: 110 }, { yPercent: 0, duration: 1, ease: 'expo.out', stagger: .05 }, 1.2);
    }
  }));

  /* ---------------------------------------------------------
     Cena 3D: progresso de seção, visibilidade e fallback 2D
     --------------------------------------------------------- */
  const canvas = $('#webgl'), hero = $('#top'), story = $('#story'), hud = $('#hud'), hudValue = $('#hud-value');
  // pontos de controle: [posição da rolagem na história (em telas), progresso da cena]
  const storyMap = [[-1, 1], [0, 2.2], [1, 3.05], [2, 3.6], [3, 5.05], [4, 6.1]];
  function storyProgress(s) {
    if (s <= storyMap[0][0]) return storyMap[0][1];
    for (let i = 1; i < storyMap.length; i++) {
      const [s0, p0] = storyMap[i - 1], [s1, p1] = storyMap[i];
      if (s <= s1) return p0 + (s - s0) / (s1 - s0) * (p1 - p0);
    }
    return storyMap[storyMap.length - 1][1];
  }
  function updateScene() {
    const vh = innerHeight;
    const heroH = hero.offsetHeight;
    const inHero = scrollY < heroH * 0.7;
    const sr = story.getBoundingClientRect();
    const firstStep = story.firstElementChild.getBoundingClientRect();
    const inStory = sr.top < vh && sr.bottom > 0;
    let p;
    if (scrollY < heroH) p = scrollY / heroH;
    else p = storyProgress(-firstStep.top / vh);
    const visible = inHero || inStory;
    canvas.classList.toggle('is-visible', visible);
    canvas.classList.toggle('is-hero', inHero);
    hud.classList.toggle('is-visible', inStory && !!brain);
    hudValue.textContent = p.toFixed(2);
    if (brain) { brain.setProgress(p); brain.setVisible(visible); }
  }
  addEventListener('scroll', updateScene, { passive: true });
  addEventListener('resize', updateScene);

  function startFallback() {
    document.documentElement.classList.add('no-webgl');
    const note = document.createElement('p');
    note.className = 'p'; note.style.cssText = 'margin:24px 0;color:var(--color-highlight)';
    note.textContent = 'A cena 3D não carregou aqui. Abra a página pelo arquivo abrir-design-system.bat (ela precisa de um servidor local e de internet para baixar o three.js).';
    story.parentNode.insertBefore(note, story);
    const cv = $('#fallback'), ctx = cv.getContext('2d');
    const pal = ['#FFB829', '#FFB829', '#E0A020', '#FF6B00', '#FF9A4D', '#189B81', '#2FC0B0', '#FFE1CC', '#FFFFFF'];
    let W, H, pts = []; const dpr = Math.min(devicePixelRatio || 1, 2);
    function init() {
      W = cv.clientWidth; H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.min(2400, Math.floor(W * H / 420)); pts = [];
      const cx = W * (W > 900 ? .66 : .5), cy = H * .48, rx = Math.min(W * .3, 460), ry = Math.min(H * .36, 300);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()), inBrain = Math.random() < .82;
        pts.push({ x: inBrain ? cx + Math.cos(a) * rx * r : Math.random() * W, y: inBrain ? cy + Math.sin(a) * ry * r * (Math.sin(a) > 0 ? .75 : 1) : Math.random() * H,
          s: inBrain ? 2.5 + Math.random() * 3.5 : 4 + Math.random() * 7, c: pal[(Math.random() * pal.length) | 0], rot: Math.random() * 6.28, v: (Math.random() - .5) * .01,
          ph: Math.random() * 6.28, o: inBrain ? .75 + Math.random() * .25 : .45 + Math.random() * .4, stroke: !inBrain || Math.random() < .3 });
      }
    }
    function draw(t) {
      ctx.clearRect(0, 0, W, H);
      for (const p of pts) {
        const s = p.s, dx = Math.sin(t * .0006 + p.ph) * 3, dy = Math.cos(t * .0005 + p.ph) * 3;
        ctx.save(); ctx.translate(p.x + dx, p.y + dy); ctx.rotate(p.rot + t * p.v * .05); ctx.globalAlpha = p.o;
        ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * .87, s * .5); ctx.lineTo(-s * .87, s * .5); ctx.closePath();
        if (p.stroke) { ctx.strokeStyle = p.c; ctx.lineWidth = 1; ctx.stroke(); } else { ctx.fillStyle = p.c; ctx.fill(); }
        ctx.restore();
      }
      if (!reduce) requestAnimationFrame(draw);
    }
    init(); requestAnimationFrame(draw);
    addEventListener('resize', () => { init(); if (reduce) draw(0); });
  }

  async function startBrain() {
    // o módulo da cena roda depois deste script; espera ele aparecer
    for (let i = 0; i < 50 && !window.DalaBrainReady; i++) await wait(100);
    try {
      if (!window.DalaBrainReady) throw new Error('módulo não carregou');
      brain = await window.DalaBrainReady;
      if (!G) brain.activate(null);
      updateScene();
    } catch (err) {
      console.warn('Dala: cena 3D indisponível, usando partículas 2D.', err);
      brain = null; startFallback();
    }
  }

  boot();
})();
