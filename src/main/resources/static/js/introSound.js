/* Original, optional intro-only synthesis; never touches notebook audio. */
window.IntroSound = (() => {
  let ctx, enabled = false; // Wait for configuration before allowing a gesture to synthesize sound.
  function muted() {
    return window.AudioMaster?.muted === true;
  }
  function resume() {
    try {
      if (!enabled || muted()) return;
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!ctx && Audio) {
        ctx = new Audio();
        window.AudioMaster?.onChange(muted => {
          try { (muted ? ctx.suspend() : ctx.resume())?.catch(() => {}); } catch {}
        });
      }
      ctx?.resume().catch(() => {});
    } catch { /* Autoplay and unavailable audio are intentionally silent. */ }
  }
  function play(kind) {
    try {
      if (!enabled || muted() || ctx?.state !== 'running' || document.querySelector('#bookOverlay.active')) return;
      const now = ctx.currentTime;
      const envelope = (start, duration, peak) => {
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(.0001, start);
        gain.gain.linearRampToValueAtTime(peak, start + .01);
        gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
        gain.connect(ctx.destination);
        return gain;
      };
      const note = (frequency, start, duration, type, peak, endFrequency) => {
        const osc = ctx.createOscillator(), gain = envelope(start, duration, peak);
        osc.type = type; osc.frequency.setValueAtTime(frequency, start);
        if (endFrequency) osc.frequency.exponentialRampToValueAtTime(endFrequency, start + .09);
        osc.connect(gain); osc.start(start); osc.stop(start + duration);
        osc.onended = () => { osc.disconnect(); gain.disconnect(); };
      };
      if (kind === 'title') {
        note(523, now, .5, 'sine', .12);
        note(659, now + .12, .5, 'sine', .12);
      } else if (kind === 'controls') {
        note(440, now, .14, 'triangle', .2, 660);
      } else if (kind === 'reveal') {
        const noise = ctx.createBufferSource(), filter = ctx.createBiquadFilter();
        const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * .5), ctx.sampleRate);
        const samples = buffer.getChannelData(0);
        for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
        noise.buffer = buffer; filter.type = 'bandpass'; filter.Q.value = .7;
        filter.frequency.setValueAtTime(400, now);
        filter.frequency.exponentialRampToValueAtTime(2400, now + .5);
        const gain = envelope(now, .5, .2);
        noise.connect(filter).connect(gain); noise.start(now); noise.stop(now + .5);
        noise.onended = () => { noise.disconnect(); filter.disconnect(); gain.disconnect(); };
      }
    } catch { /* Sound must never interrupt the intro. */ }
  }
  return { resume, play, configure(value) { enabled = value !== false; }, get state() { return ctx?.state || 'uninitialized'; } };
})();
