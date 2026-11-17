/* One timeline per load. No persistence and no camera animation. */
window.Intro = (() => {
  const defaults = { enabled:true, title:'What if Sir Sean was a highschool teacher?', subtitle:'A Group 1 production', soundEnabled:true };
  function start(classroomRequest) {
    let overlay = document.getElementById('intro'), timeline, fade, scene, done = false, skipping = false, watchdog;
    const heldKeys = new Set();
    const events = ['pointerdown','pointerup','mousedown','mouseup','touchstart','touchend','click','keydown','keyup','wheel'];
    const controller = { get active() { return !done; }, attach(value) { scene = value; scene.setInputEnabled(done); } };
    function removeListeners() { events.forEach(type => window.removeEventListener(type, capture, true)); }
    function finish() {
      if (done) return;
      done = true;
      clearTimeout(watchdog);
      timeline?.kill(); fade?.kill();
      if (overlay) {
        overlay.querySelectorAll('.intro-title,.intro-controls').forEach(el => el.style.removeProperty('will-change'));
        overlay.remove();
      }
      document.documentElement.classList.remove('intro-playing');
      scene?.setInputEnabled(true);
      removeListeners();
      // Consume autorepeat from a skip key still held after the fade.
      if (heldKeys.size) {
        const release = event => {
          if (!heldKeys.has(event.code)) return;
          event.preventDefault(); event.stopImmediatePropagation();
          if (event.type === 'keyup') heldKeys.delete(event.code);
          if (!heldKeys.size) clearHeld();
        };
        const clearHeld = () => { heldKeys.clear(); window.removeEventListener('keydown',release,true); window.removeEventListener('keyup',release,true); window.removeEventListener('blur',clearHeld); };
        window.addEventListener('keydown',release,true); window.addEventListener('keyup',release,true); window.addEventListener('blur',clearHeld,{once:true});
      }
    }
    function skip() {
      if (done || skipping) return;
      skipping = true;
      timeline?.kill();
      try {
        window.IntroSound?.play('reveal');
        fade = gsap.to(overlay,{opacity:0,duration:.4,ease:'power2.in',onComplete:finish});
      } catch { finish(); }
    }
    function capture(event) {
      if (done) return;
      event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
      if (event.type === 'keydown') heldKeys.add(event.code);
      if (event.type === 'keyup') heldKeys.delete(event.code);
      if (event.type === 'pointerdown' || event.type === 'keydown') window.IntroSound?.resume();
      // Complete pointer gestures on release so a held press cannot click through.
      if (event.type === 'click' || event.type === 'touchend' || event.type === 'keydown') skip();
    }
    try {
      watchdog = setTimeout(finish,12000);
      if (!overlay || new URLSearchParams(location.search).get('intro') === 'off') { finish(); return controller; }
      document.documentElement.classList.add('intro-playing');
      events.forEach(type => window.addEventListener(type,capture,{capture:true,passive:false}));
      const coarse = matchMedia('(pointer: coarse)').matches;
      overlay.classList.toggle('intro-touch',coarse);
      if (coarse) overlay.querySelector('.intro-drag').textContent = 'Drag to look';
      Promise.resolve(classroomRequest).catch(() => ({})).then(classroom => {
        if (done || skipping) return;
        try {
          const input = classroom?.intro || {};
          const config = { ...defaults };
          for (const key of ['enabled','soundEnabled']) if (typeof input[key] === 'boolean') config[key] = input[key];
          for (const key of ['title','subtitle']) if (typeof input[key] === 'string' && input[key].trim()) config[key] = input[key];
          if (!config.enabled) { finish(); return; }
          const title = overlay.querySelector('.intro-title'), subtitle = overlay.querySelector('.intro-subtitle'), controls = overlay.querySelector('.intro-controls');
          title.querySelector('h1').textContent = config.title; subtitle.textContent = config.subtitle;
          window.IntroSound?.configure(config.soundEnabled); window.IntroSound?.resume();
          const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches, scale = reduced ? .5 : 1;
          const enter = duration => ({opacity:1,...(reduced ? {} : {y:0}),duration:duration*scale,ease:'power2.out'});
          const initial = {opacity:0,...(reduced ? {} : {y:8})};
          // Subtitle finishes at 1.0; hold until 3.2. Total: 8.4 seconds.
          const titleOut = 1*scale+2.2, controlsIn = titleOut+.8*scale;
          const reveal = controlsIn+.6*scale+3;
          timeline = gsap.timeline({onComplete:finish});
          timeline.call(() => window.IntroSound?.play('title'),[],0)
            .fromTo(title,initial,enter(.8),0)
            .fromTo(subtitle,initial,enter(.6),.4*scale)
            .to(title,{opacity:0,duration:.8*scale,ease:'power2.in'},titleOut)
            .call(() => { title.setAttribute('aria-hidden','true'); controls.removeAttribute('aria-hidden'); window.IntroSound?.play('controls'); },[],controlsIn)
            .fromTo(controls,initial,enter(.6),controlsIn)
            .call(() => window.IntroSound?.play('reveal'),[],reveal)
            .to(controls,{opacity:0,duration:.8*scale,ease:'power2.in'},reveal)
            .to(overlay,{opacity:0,duration:.8*scale,ease:'power2.in'},reveal);
        } catch { finish(); }
      }).catch(finish);
    } catch { finish(); }
    return controller;
  }
  return { start };
})();
