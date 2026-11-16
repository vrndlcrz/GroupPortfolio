class ThemeSong {
  constructor(button, credit) {
    this.button = button;
    this.credit = credit;
    this.generation = 0;
    this.reported = false;
    try { this.muted = sessionStorage.getItem('notebook.music.muted') === 'true'; }
    catch { this.muted = false; }
    button.addEventListener('click', () => {
      this.muted = !this.muted;
      try { sessionStorage.setItem('notebook.music.muted', String(this.muted)); } catch {}
      this.audio.muted = this.muted;
      this.updateButton();
    });
  }

  updateButton() {
    this.button.textContent = this.muted ? 'Unmute' : 'Mute';
    this.button.setAttribute('aria-label', this.button.textContent + ' notebook music');
  }

  start(song) {
    if (song?.provider !== 'file' || !song.src) {
      this.stop(false);
      return;
    }
    if (this.active === song.src) return;
    this.stop(false);
    this.active = song.src;
    const generation = this.generation;
    const audio = this.audio || (this.audio = new Audio());
    audio.preload = 'none';
    audio.loop = true;
    audio.muted = this.muted;
    audio.volume = 0;
    const failed = () => {
      if (generation !== this.generation) return;
      this.stop(false);
      if (!this.reported) console.info('Notebook music is unavailable.');
      this.reported = true;
    };
    audio.onerror = failed;
    if (audio.getAttribute('src') !== song.src || audio.error) {
      audio.src = song.src;
    }
    this.button.title = song.title;
    try {
      audio.play().then(() => {
        if (generation !== this.generation) return;
        this.updateButton();
        this.button.hidden = false;
        this.credit.textContent = song.credit ? 'Music: ' + song.credit : '';
        this.credit.hidden = !song.credit;
        gsap.to(audio, { volume: 0.3, duration: 1.5, ease: 'sine.inOut' });
      }).catch(failed);
    } catch { failed(); }
  }

  stop(fade = true) {
    this.generation++;
    this.active = null;
    this.button.hidden = this.credit.hidden = true;
    const audio = this.audio;
    if (!audio) return;
    audio.onerror = null;
    gsap.killTweensOf(audio);
    if (fade && !audio.paused && audio.volume > 0) {
      gsap.to(audio, { volume: 0, duration: 0.45, onComplete: () => audio.pause() });
    } else audio.pause();
  }
}
