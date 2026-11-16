(() => {
  function hash(value) {
    let state = 2166136261;
    for (const char of String(value)) state = Math.imul(state ^ char.charCodeAt(0), 16777619);
    return state >>> 0;
  }

  function handwrite(text, { seed = 0 } = {}) {
    let state = seed >>> 0;
    function jitter(range) {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return ((state / 4294967296 * 2 - 1) * range).toFixed(2);
    }
    return String(text ?? '').replace(/\S+/gu, word => {
      const safe = word.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `<span class="ink-word" style="--turn:${jitter(2)}deg;--rise:${jitter(3)}px;--spacing:${jitter(0.35)}px">${safe}</span>`;
    });
  }
  window.Handwriting = { hash, handwrite };
})();
