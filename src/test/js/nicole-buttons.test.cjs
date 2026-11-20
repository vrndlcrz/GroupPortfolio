const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function setupClearBook() {
  const domListeners = new Map();
  const elements = new Map();

  class MockElement {
    constructor(tag, id = '') {
      this.tagName = tag.toUpperCase();
      this.id = id;
      this.className = '';
      this.classList = {
        _classes: new Set(),
        add(c) { this._classes.add(c); },
        remove(c) { this._classes.delete(c); },
        contains(c) { return this._classes.has(c); },
        toggle(c, force) {
          if (force === undefined) {
            if (this.contains(c)) { this.remove(c); return false; }
            else { this.add(c); return true; }
          }
          if (force) { this.add(c); return true; }
          else { this.remove(c); return false; }
        }
      };
      this.dataset = {};
      this.style = {
        _styles: new Map(),
        setProperty(k, v) { this._styles.set(k, v); },
        getPropertyValue(k) { return this._styles.get(k); },
        removeProperty(k) { this._styles.delete(k); }
      };
      this.children = [];
      this.listeners = new Map();
      this.textContent = '';
      this._html = '';
    }

    get innerHTML() { return this._html; }
    set innerHTML(html) {
      this._html = html;
      this._parseSimpleHTML(html);
    }

    _parseSimpleHTML(html) {
      // Mock parser to populate elements queried by id / class
      const idMatches = html.matchAll(/id=["']([^"']+)["']/g);
      for (const m of idMatches) {
        if (!elements.has(m[1])) {
          const el = new MockElement('div', m[1]);
          if (m[1] === 'nicoleCopyEmailBtn') {
            el.dataset.email = 'nicoleleighgdeguzman@gmail.com';
            el.className = 'nicole-copy-email-btn';
            el.textContent = 'Copy Email';
          }
          if (m[1] === 'openGuestbookFromBookBtn') {
            el.className = 'nicole-guestbook-btn';
            el.textContent = "Leave a Note on Nicole's 3D Desk";
          }
          elements.set(m[1], el);
        }
      }
    }

    addEventListener(event, fn) {
      if (!this.listeners.has(event)) this.listeners.set(event, []);
      this.listeners.get(event).push(fn);
    }

    async dispatchEvent(event) {
      const handlers = this.listeners.get(event.type) || [];
      for (const h of handlers) await h(event);
    }

    querySelector(selector) {
      if (selector.startsWith('#')) {
        const id = selector.slice(1);
        return elements.get(id) || null;
      }
      if (selector.includes('nicole-copy-email-btn')) return elements.get('nicoleCopyEmailBtn') || null;
      if (selector.includes('nicole-guestbook-btn')) return elements.get('openGuestbookFromBookBtn') || null;
      return null;
    }

    querySelectorAll(selector) {
      const results = [];
      if (selector.includes('nicoleCopyEmailBtn') || selector.includes('nicole-copy-email-btn')) {
        const el = elements.get('nicoleCopyEmailBtn');
        if (el) results.push(el);
      }
      if (selector.includes('openGuestbookFromBookBtn') || selector.includes('nicole-guestbook-btn')) {
        const el = elements.get('openGuestbookFromBookBtn');
        if (el) results.push(el);
      }
      return results;
    }

    replaceChildren(...nodes) {
      this.children = nodes;
    }

    appendChild(node) {
      this.children.push(node);
      return node;
    }

    closest(selector) {
      if (selector === 'button' && (this.tagName === 'BUTTON' || this.id.includes('Btn'))) return this;
      return null;
    }

    focus() {}
    select() {}
    removeChild(node) {
      const idx = this.children.indexOf(node);
      if (idx !== -1) this.children.splice(idx, 1);
    }
    getBoundingClientRect() {
      return { left: 0, top: 0, width: 400, height: 600 };
    }
  }

  const documentMock = {
    getElementById: id => {
      if (!elements.has(id)) {
        elements.set(id, new MockElement('div', id));
      }
      return elements.get(id);
    },
    createElement: tag => new MockElement(tag),
    head: new MockElement('head'),
    body: new MockElement('body'),
    execCommand: (cmd) => {
      copiedText = 'nicoleleighgdeguzman@gmail.com';
      return true;
    },
    querySelector: () => null,
    querySelectorAll: () => []
  };

  let copiedText = '';
  const navigatorMock = {
    clipboard: {
      writeText: text => {
        copiedText = text;
        return Promise.resolve();
      }
    }
  };

  const context = {
    document: documentMock,
    window: {
      addEventListener: () => {},
      AudioMaster: { onChange: () => {} },
      isSecureContext: true
    },
    navigator: navigatorMock,
    isSecureContext: true,
    setTimeout: (fn) => fn(),
    clearTimeout: () => {},
    console: console
  };
  context.window.window = context.window;
  context.window.document = documentMock;
  context.window.navigator = navigatorMock;

  vm.createContext(context);

  // Load sketches, handwriting, themesong mocks
  vm.runInContext(`
    class ThemeSong { constructor() { this.audio = { pause() {}, play() { return Promise.resolve(); }, muted: false }; } stop() {} start() {} }
    const Handwriting = { hash: () => 1, handwrite: t => t };
    const Sketches = { SKETCH_LAYOUT: {}, get: () => '' };
  `, context);

  const bookSrc = fs.readFileSync('src/main/resources/static/js/book.js', 'utf8');
  vm.runInContext(bookSrc + '\nglobalThis.ClearBook = window.ClearBook;', context);

  return { context, elements, getCopiedText: () => copiedText };
}

test('Nicole portfolio Contact and Notes page buttons are wired up and functioning', async () => {
  const { context, elements, getCopiedText } = setupClearBook();

  let guestbookCalledWith = null;
  let bookClosed = false;

  const book = new context.window.ClearBook({
    containerId: 'bookOverlayRoot',
    onClose: () => { bookClosed = true; },
    onOpenGuestbook: (memberId) => { guestbookCalledWith = memberId; }
  });

  const members = JSON.parse(fs.readFileSync('src/main/resources/data/members.json', 'utf8'));
  const nicole = members.find(m => m.id === 4);

  // Open Nicole's clear-book
  book.open(nicole);

  // Check Copy Email Button
  const copyBtn = elements.get('nicoleCopyEmailBtn');
  assert.ok(copyBtn, '#nicoleCopyEmailBtn must exist in DOM');
  assert.ok(copyBtn.listeners.has('click'), 'Copy Email button must have a click event listener');

  // Trigger copy email click
  let propagationStopped = false;
  await copyBtn.dispatchEvent({
    type: 'click',
    stopPropagation: () => { propagationStopped = true; },
    preventDefault: () => {}
  });

  assert.equal(propagationStopped, true, 'Copy email button click must stopPropagation');
  assert.equal(getCopiedText(), 'nicoleleighgdeguzman@gmail.com', 'Copy button must copy Nicole email');
  assert.equal(copyBtn.textContent, 'Copied! ✓', 'Button text must show Copied! ✓ confirmation');

  // Check Guestbook Desk Button
  const guestbookBtn = elements.get('openGuestbookFromBookBtn');
  assert.ok(guestbookBtn, '#openGuestbookFromBookBtn must exist in DOM');
  assert.ok(guestbookBtn.listeners.has('click'), 'Guestbook button must have a click event listener');

  // Trigger guestbook click
  let guestbookPropagationStopped = false;
  guestbookBtn.dispatchEvent({
    type: 'click',
    stopPropagation: () => { guestbookPropagationStopped = true; },
    preventDefault: () => {}
  });

  assert.equal(guestbookPropagationStopped, true, 'Guestbook button click must stopPropagation');
  assert.equal(book.isOpen(), false, 'Clicking Leave a Note must close the book');
  assert.equal(guestbookCalledWith, 4, 'Clicking Leave a Note must trigger onOpenGuestbook for Member #4');
});
