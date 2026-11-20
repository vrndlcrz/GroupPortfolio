const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

function setupThemeSong({ status = 200, source = '/assets/audio/notebook-theme.mp3' } = {}) {
  const instances = [], tweens = [], storage = new Map(), requests = [];
  class FakeAudio {
    constructor() {
      instances.push(this);
      this.src = '';
      this.paused = true;
      this.currentTime = 0;
      this.events = {};
      this.calls = 0;
      this.volume = 1;
      this.muted = false;
    }
    addEventListener(name, fn) { this.events[name] = fn; }
    load() { this.loaded = true; }
    play() {
      this.calls++;
      this.paused = false;
      return Promise.resolve();
    }
    pause() { this.paused = true; }
  }

  const button = { hidden: true, addEventListener(name, fn) { this.click = fn; }, setAttribute() { }, textContent: '' };
  const credit = { hidden: true, textContent: '' };
  const context = {
    Audio: FakeAudio,
    navigator: { userActivation: { isActive: true } },
    AbortSignal,
    sessionStorage: { getItem: k => storage.get(k), setItem: (k, v) => storage.set(k, v) },
    fetch: (url, options) => {
      requests.push({ url, options });
      return Promise.resolve({ ok: status < 400, status, headers: new Map() });
    },
    gsap: { killTweensOf() { }, to: (target, options) => { tweens.push(options); return {}; } }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('src/main/resources/static/js/themesong.js', 'utf8') + '\nglobalThis.Song = ThemeSong;', context);
  const song = new context.Song(button, credit, source);
  return { song, button, credit, context, instances, tweens };
}

const settle = () => new Promise(resolve => setImmediate(resolve));

test('Nicole theme plays with correct source, title and credit without colons or dashes', async () => {
  const x = setupThemeSong();
  await x.song.prepared;

  const nicoleSong = {
    provider: 'file',
    src: 'assets/audio/nicole-theme.opus',
    title: 'Awit ng Paghahangad (Piano Instrumental)',
    credit: ''
  };

  x.song.start(nicoleSong);
  await settle();

  assert.equal(x.song.audio.paused, false);
  assert.equal(x.song.audio.calls, 1);
  assert.ok(x.song.audio.src.includes('nicole-theme.opus'));
  assert.equal(x.button.title, 'Awit ng Paghahangad (Piano Instrumental)');
  assert.equal(x.credit.textContent, '');
  assert.equal(x.credit.hidden, true);

  // Validate no colons, semi-colons, em-dashes
  assert.ok(!x.credit.textContent.includes(':'), 'Credit must not contain colon');
  assert.ok(!x.credit.textContent.includes(';'), 'Credit must not contain semi-colon');
  assert.ok(!x.credit.textContent.includes('—'), 'Credit must not contain em-dash');

  // Test stop
  x.song.stop(false);
  assert.equal(x.song.audio.paused, true);
  assert.equal(x.button.hidden, true);
  assert.equal(x.credit.hidden, true);

  // Switch back to Riam
  const riamSong = {
    provider: 'file',
    src: 'assets/audio/notebook-theme.mp3',
    title: 'Notebook theme',
    credit: ''
  };
  x.song.start(riamSong);
  await settle();

  assert.equal(x.song.audio.paused, false);
  assert.equal(x.song.audio.calls, 2);
  assert.ok(x.song.audio.src.includes('notebook-theme.mp3'));
  assert.equal(x.button.title, 'Notebook theme');
  assert.equal(x.credit.hidden, true);
});

test('members.json contains valid Nicole themeSong metadata', () => {
  const members = JSON.parse(fs.readFileSync('src/main/resources/data/members.json', 'utf8'));
  const nicole = members.find(m => m.id === 4);
  assert.ok(nicole, 'Nicole member must exist');
  assert.ok(nicole.themeSong, 'Nicole must have themeSong');
  assert.equal(nicole.themeSong.src, 'assets/audio/nicole-theme.opus');
  assert.equal(nicole.themeSong.title, 'Awit ng Paghahangad (Piano Instrumental)');
  assert.equal(nicole.themeSong.credit, '');
  assert.equal(nicole.tagline, 'Powered by careful planning and a fear of redoing work.');

  // Content guidelines check on Nicole's visible strings
  for (const page of nicole.pages) {
    assert.ok(!page.content.includes(':'), `Page "${page.title}" content contains colon`);
    assert.ok(!page.content.includes(';'), `Page "${page.title}" content contains semi-colon`);
    assert.ok(!page.content.includes('—'), `Page "${page.title}" content contains em-dash`);
  }
});
