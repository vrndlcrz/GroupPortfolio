/**
 * humor.js - Humor Engine & Easter Eggs
 * Handles synthesized web audio, interactive jokes, coffee spills,
 * laptop crash dialog, floating desk Konami code & single-key triggers, and guestbook jokes.
 */

const PortfolioHumor = (function() {
  let isMuted = false;
  let audioCtx = null;

  // Konami code tracker
  const konamiSequence = [
    'ArrowUp', 'ArrowUp',
    'ArrowDown', 'ArrowDown',
    'ArrowLeft', 'ArrowRight',
    'ArrowLeft', 'ArrowRight',
    'KeyB', 'KeyA'
  ];
  let konamiIndex = 0;

  // Friendly Roasts list
  const roasts = [
    "Has 47 browser tabs open and uses none of them.",
    "Says 'quick 5 minute break' and returns 3 business days later.",
    "Believes 'git push --force' is a valid problem-solving strategy.",
    "Debugs with console.log('test 1'), console.log('here'), console.log('WHY PLEASE').",
    "Spends 2 hours searching for a Spotify playlist before writing 1 line of HTML.",
    "Can explain the theory of quantum computing, but forgets the semicolon on line 4.",
    "Owns a reusable water bottle that has seen more iced coffee than water.",
    "Reads StackOverflow answers from 2013 with blind religious faith.",
    "Uses dark mode so the bugs can't see them coming.",
    "Calls a missing semicolon 'an unexpected design pause'."
  ];

  function getAudioContext() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        audioCtx = new AudioContext();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playSound(type) {
    if (isMuted) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;

      if (type === 'pageFlipSlow' || type === 'pageFlip') {
        // Slow, realistic, soothing paper & plastic sleeve glide sound (1.1s)
        const dur = 1.1;
        const bufferSize = Math.floor(ctx.sampleRate * dur);
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          const envelope = Math.sin((i / bufferSize) * Math.PI);
          data[i] = (Math.random() * 2 - 1) * envelope * 0.7;
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(650, now);
        filter.frequency.exponentialRampToValueAtTime(220, now + dur);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.01, now);
        gain.gain.linearRampToValueAtTime(0.18, now + 0.3);
        gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        noise.start(now);

      } else if (type === 'spill') {
        // Liquid splash + low drip
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(260, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.35);

        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.35);

      } else if (type === 'pop') {
        // Playful bubble pop
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(450, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);

        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.1);

      } else if (type === 'error') {
        // Retro classic error buzz
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.setValueAtTime(110, now + 0.12);

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.3);

      } else if (type === 'fanfare') {
        // Easter egg victory fanfare
        const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50];
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + idx * 0.08);

          gain.gain.setValueAtTime(0.14, now + idx * 0.08);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.25);

          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.08);
          osc.stop(now + idx * 0.08 + 0.25);
        });

      } else if (type === 'spin') {
        // Ascending whoosh
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.4);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.4);
      }
    } catch (e) {
      console.warn('Audio playback error:', e);
    }
  }

  function toggleMute() {
    isMuted = !isMuted;
    const btn = document.getElementById('muteToggleBtn');
    if (btn) {
      if (isMuted) {
        btn.innerHTML = `<svg class="uicon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg><span class="hud-label">Muted</span>`;
        btn.title = 'Sound is Muted (Click to Unmute)';
      } else {
        btn.innerHTML = `<svg class="uicon sound-icon-on" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg><span class="hud-label">Sound</span>`;
        btn.title = 'Sound is Enabled (Click to Mute)';
      }
    }
    return isMuted;
  }

  /**
   * Initializes both single-key ('E', 'G', 'F') and classic Konami easter eggs
   */
  function initEasterEggs(onTrigger) {
    window.addEventListener('keydown', (e) => {
      // Allow typing in text inputs without triggering
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      const key = e.key.toLowerCase();

      // Easy 1-Key Triggers: 'e' (Easter Egg), 'g' (Gravity), 'f' (Float)
      if (key === 'e' || key === 'g' || key === 'f') {
        e.preventDefault();
        if (typeof onTrigger === 'function') {
          onTrigger();
        }
        return;
      }

      // Classic Konami code sequence
      const expectedKey = konamiSequence[konamiIndex];
      if (e.code === expectedKey || e.key === expectedKey) {
        konamiIndex++;
        if (konamiIndex === konamiSequence.length) {
          konamiIndex = 0;
          if (typeof onTrigger === 'function') {
            onTrigger();
          }
        }
      } else {
        konamiIndex = 0;
      }
    });
  }

  function showToast(message, duration = 3500) {
    let toast = document.getElementById('portfolioToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'portfolioToast';
      toast.className = 'humor-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
      toast.classList.remove('show');
    }, duration);
  }

  function showLaptopErrorDialog() {
    playSound('error');
    let dialog = document.getElementById('laptopErrorModal');
    if (!dialog) {
      dialog = document.createElement('div');
      dialog.id = 'laptopErrorModal';
      dialog.className = 'error-modal-overlay';
      dialog.innerHTML = `
        <div class="retro-error-window">
          <div class="retro-window-header">
            <span style="display:flex; align-items:center; gap:6px;"><svg class="uicon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg> System Warning: Motivation.exe</span>
            <button class="retro-close-x" onclick="PortfolioHumor.closeLaptopError()">✕</button>
          </div>
          <div class="retro-window-body">
            <div class="retro-error-icon" style="display:flex;align-items:center;justify-content:center;">
              <svg viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:36px;height:36px;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            </div>
            <div class="retro-error-details">
              <h4>Motivation.exe has stopped working.</h4>
              <p>A fatal exception 0xDEADBEEF occurred at memory address 4:00_AM_DEADLINE.</p>
              <p>Windows is checking for solutions to the problem: <em>"Too much code, insufficient coffee."</em></p>
            </div>
          </div>
          <div class="retro-window-footer">
            <button class="retro-btn" onclick="PortfolioHumor.restartMotivation()">Drink Coffee &amp; Restart</button>
            <button class="retro-btn secondary" onclick="PortfolioHumor.closeLaptopError()">Ignore &amp; Cry</button>
          </div>
        </div>
      `;
      document.body.appendChild(dialog);
    }
    dialog.classList.add('active');
  }

  function closeLaptopError() {
    const dialog = document.getElementById('laptopErrorModal');
    if (dialog) dialog.classList.remove('active');
  }

  function restartMotivation() {
    closeLaptopError();
    playSound('spill');
    showToast('Motivation rebooted! Coffee levels at 100%.');
  }

  function showTermsJokeModal() {
    let dialog = document.getElementById('termsModal');
    if (!dialog) {
      dialog = document.createElement('div');
      dialog.id = 'termsModal';
      dialog.className = 'error-modal-overlay';
      dialog.innerHTML = `
        <div class="retro-error-window terms-window">
          <div class="retro-window-header">
            <span style="display:flex; align-items:center; gap:6px;"><svg class="uicon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg> Terms &amp; Conditions (Nobody Reads This)</span>
            <button class="retro-close-x" onclick="document.getElementById('termsModal').classList.remove('active')">✕</button>
          </div>
          <div class="retro-window-body terms-body">
            <p style="font-size:0.75rem; color:#64748B; margin-bottom:12px;">By looking at this website for more than 3 seconds, you agree to the following legally unenforceable clauses:</p>
            <div class="terms-scroll-box">
              <p>1. <strong>Clause of Universal Div Centering:</strong> The user acknowledges that centering a div in CSS is an art form comparable to classical renaissance sculpting.</p>
              <p>2. <strong>Caffeine Conversion Rate:</strong> The developers maintain a 1:1 ratio between dark roast espresso and working REST endpoints.</p>
              <p>3. <strong>The "It Worked On My Machine" Immunity:</strong> If any feature fails during grading, Article 42 establishes that it worked perfectly on the presenter's laptop at 10:33 PM.</p>
              <p>4. <strong>Rubber Duck Arbitration:</strong> Any disputes regarding algorithms shall be submitted in writing to a yellow rubber duck sitting on the desk.</p>
              <p style="background:#FEF3C7; padding:8px; border-radius:4px; color:#B45309; font-weight:bold;">
                🎉 JOKE FOUND: You actually scrolled down here! You have been awarded 100 bonus imaginary credits. Please tell the professor our team deserves an A+!
              </p>
            </div>
          </div>
          <div class="retro-window-footer">
            <button class="retro-btn" onclick="document.getElementById('termsModal').classList.remove('active'); PortfolioHumor.playSound('pop');">I Accept (Give Me An A+)</button>
          </div>
        </div>
      `;
      document.body.appendChild(dialog);
    }
    dialog.classList.add('active');
  }

  function showHobbyNotFoundJoke() {
    playSound('error');
    showToast('⚠️ 404: Hobby Not Found! Sleeping is classified as a survival necessity, not a hobby.');
  }

  return {
    playSound,
    toggleMute,
    initKonamiCode: initEasterEggs,
    initEasterEggs,
    showToast,
    showLaptopErrorDialog,
    closeLaptopError,
    restartMotivation,
    showTermsJokeModal,
    showHobbyNotFoundJoke,
    roasts
  };
})();

window.PortfolioHumor = PortfolioHumor;
