class ThemeSong {
  constructor(button, credit, source) {
    this.button = button;
    this.credit = credit;
    this.generation = 0;
    this.disabled = false;
    this.ready = false;
    this.active = false;
    this.audio = new Audio();
    this.audio.preload = 'auto';
    this.audio.loop = true;
    this.audio.volume = 0.5;
    try { this.muted = sessionStorage.getItem('notebook.music.muted') === 'true'; }
    catch { this.muted = false; }
    this.audio.muted = this.muted;
    this.audio.addEventListener('error', () => this.disable());
    this.button.addEventListener('click', () => {
      if (this.disabled || !this.active) return;
      this.muted = !this.muted;
      try { sessionStorage.setItem('notebook.music.muted', String(this.muted)); } catch {}
      this.audio.muted = this.muted;
      this.updateButton();
    });
    this.src = typeof source === 'string' && source.trim() ? source.trim() : '/assets/audio/notebook-theme.mp3';
    // Check once at startup. Never wait for a request, create an audio object, or
    // schedule deferred play() in the click path. The canonical endpoint returns
    // 204 for an absent optional asset, avoiding browser HTTP error messages.
    this.prepared = this.prepare();
  }

  async prepare() {
    try {
      const response = await fetch(this.src, { method: 'HEAD' });
      if (!response.ok || response.status === 204 || response.headers.get('content-length') === '0') {
        this.disable();
        return;
      }
      this.audio.src = this.src;
      this.audio.load();
      this.ready = true;
    } catch { this.disable(); }
  }

  updateButton() {
    this.button.textContent = this.muted ? 'Unmute' : 'Mute';
    this.button.setAttribute('aria-label', this.button.textContent + ' notebook music');
    this.button.setAttribute('aria-pressed', String(this.muted));
  }

  disable() {
    this.disabled = true;
    this.ready = false;
    this.stop(false);
  }

  start(song) {
    if (this.disabled || !this.ready || !navigator.userActivation?.isActive) return;

    const source = typeof song === 'string'
      ? song
      : song?.src || song?.url;

    if (source && source !== this.src) {
      this.src = source;
      this.ready = false;
      this.audio.src = source;
      this.audio.load();
      this.ready = true;
    }

    this.stop(false);
    this.active = true;

    const generation = this.generation;
    const audio = this.audio;

    audio.volume = 0.5;
    audio.muted = this.muted;
    this.button.title = song?.title || 'Notebook theme';

    try {
      audio.currentTime = 0;
      audio.play().then(() => {
        if (generation !== this.generation || this.disabled) return;
        this.updateButton();
        this.button.hidden = false;
        this.credit.textContent =
          typeof song === 'object' && song?.credit
            ? 'Music: ' + song.credit
            : '';
        this.credit.hidden = !song?.credit;
      }).catch(() => {
        if (generation === this.generation) this.stop(false);
      });
    } catch {
      this.disable();
    }
  }

  stop(fade = true) {
    const generation = ++this.generation;
    this.active = false;
    this.button.hidden = this.credit.hidden = true;
    const audio = this.audio;
    window.gsap?.killTweensOf(audio);
    const finish = () => {
      if (generation !== this.generation) return;
      audio.pause();
      try { audio.currentTime = 0; } catch {}
    };
    if (fade && !audio.paused && audio.volume > 0 && window.gsap) {
      gsap.to(audio, { volume: 0, duration: 0.4, onComplete: finish });
    } else finish();
  }
}
