/**
 * book.js - Clear-Book Portfolio Component
 * Handles the display of the 3D clear-book binder, cover, 6 inside pages with SVG borders,
 * back cover, realistic slow & smooth double-sided page flips, and easy easter eggs.
 */

const CLEARBOOK_BUILD = 'spiral-cover-v3-john-vernie';

class ClearBook {
  constructor(options = {}) {
    console.info('ClearBook', CLEARBOOK_BUILD);
    this.options = Object.assign({
      containerId: 'book-overlay-container',
      theme: null,
      onClose: null,
      onOpenGuestbook: null
    }, options);

    this.currentMember = null;
    this.currentPageIndex = 0;
    this.totalPages = 8;
    this.overlayElement = null;
    this.pagesElements = [];
    this.dotsElements = [];
    this.photoClickCount = 0;
    this.isDragging = false;
    this.dragStartX = 0;
    this.isFlipping = false; // Prevents animation overlap during slow turn

    this.pageCache = new WeakMap();
    this.initDOM();
    this.bindGlobalKeys();
  }

  initDOM() {
    let container = document.getElementById(this.options.containerId);
    if (!container) {
      container = document.createElement('div');
      container.id = this.options.containerId;
      document.body.appendChild(container);
    }

    container.innerHTML = `
      <div class="book-overlay" id="bookOverlay" role="dialog" aria-modal="true" aria-label="Clear Book Portfolio">
        <div class="book-header-controls">
          <div class="book-member-pill" id="bookMemberPill">
            <span class="member-color-indicator" id="memberColorDot"></span>
            <span id="memberPillName">Member Portfolio</span>
          </div>
          <button class="book-close-btn" id="bookCloseBtn" title="Close Portfolio (Esc)" aria-label="Close">✕</button>
        </div>

        <div class="book-container" id="bookContainer">
          <div class="book-spine">
            <div class="book-spine-stitching"></div>
          </div>
          <div id="pagesDeck" style="position:relative; width:100%; height:100%;"></div>
        </div>

        <div class="book-bottom-nav">
          <button class="book-nav-btn" id="prevPageBtn" title="Previous Page (←)">‹ Prev Page</button>
          <div class="book-page-dots" id="bookPageDots"></div>
          <button class="book-nav-btn" id="nextPageBtn" title="Next Page (→)">Next Page ›</button>
        </div>

        <small hidden class="music-credit"></small>
        <div class="book-key-hints">Tip: Use [←] [→] arrow keys to flip smoothly • [Esc] to return to desk</div>
      </div>
    `;

    this.overlayElement = document.getElementById('bookOverlay');
    this.bookContainer = document.getElementById('bookContainer');
    this.deckElement = document.getElementById('pagesDeck');
    this.dotsContainer = document.getElementById('bookPageDots');
    this.prevBtn = document.getElementById('prevPageBtn');
    this.nextBtn = document.getElementById('nextPageBtn');
    this.closeBtn = document.getElementById('bookCloseBtn');
    this.memberPillName = document.getElementById('memberPillName');
    this.memberColorDot = document.getElementById('memberColorDot');

    // ThemeSong keeps its existing audio and private control; the toolbar is the only DOM sound control.
    this.music = new ThemeSong(document.createElement('button'), container.querySelector('.music-credit'), this.options.notebookTheme);
    const music = this.music;
    window.AudioMaster?.onChange(muted => {
      music.muted = muted;
      music.audio.muted = muted;
      if (!music.active || music.disabled) return;
      if (muted) music.audio.pause();
      else music.audio.play().catch(() => { });
    });
    this.closeBtn.addEventListener('click', () => this.close());
    this.prevBtn.addEventListener('click', () => this.prevPage());
    this.nextBtn.addEventListener('click', () => this.nextPage());

    // Drag / Swipe support
    this.deckElement.addEventListener('mousedown', (e) => this.handleDragStart(e));
    window.addEventListener('mouseup', (e) => this.handleDragEnd(e));
    this.deckElement.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: true });
    this.deckElement.addEventListener('touchend', (e) => this.handleTouchEnd(e));
  }

  bindGlobalKeys() {
    window.addEventListener('keydown', (e) => {
      if (!this.isOpen()) return;

      if (e.key === 'Escape') {
        this.close();
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        this.nextPage();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        this.prevPage();
      }
    });
  }

  handleDragStart(e) {
    if (this.isFlipping || e.target.closest('button') || e.target.closest('input') || e.target.closest('a')) return;
    this.isDragging = true;
    this.dragStartX = e.clientX;
  }

  handleDragEnd(e) {
    if (!this.isDragging) return;
    this.isDragging = false;
    const diff = e.clientX - this.dragStartX;
    if (diff < -50) {
      this.nextPage();
    } else if (diff > 50) {
      this.prevPage();
    }
  }

  handleTouchStart(e) {
    if (this.isFlipping || (e.touches && e.touches.length === 0)) return;
    this.isDragging = true;
    this.dragStartX = e.touches[0].clientX;
  }

  handleTouchEnd(e) {
    if (!this.isDragging) return;
    this.isDragging = false;
    if (e.changedTouches && e.changedTouches.length > 0) {
      const diff = e.changedTouches[0].clientX - this.dragStartX;
      if (diff < -50) {
        this.nextPage();
      } else if (diff > 50) {
        this.prevPage();
      }
    }
  }

  isOpen() {
    return this.overlayElement && this.overlayElement.classList.contains('active');
  }

  open(memberData, { theme = this.options.theme || memberData.deskItem } = {}) {
    // Playback was requested synchronously by the opening click, before camera animation.
    // Programmatic opens never attempt autoplay or attach delayed playback listeners.
    if (this.musicPrepared !== memberData.id || !this.isNotebook(memberData, theme)) this.music.stop();
    this.musicPrepared = null;
    this.bookContainer.dataset.build = CLEARBOOK_BUILD;
    this.overlayElement.classList.toggle('theme-pad', theme === 'pad' || theme === 'intermediate-pad');
    this.overlayElement.classList.toggle('theme-folder', theme === 'folder' || theme === 'long-folder');
    this.overlayElement.classList.toggle('theme-themebook', theme === 'themebook' || theme === 'theme-book');
    this.overlayElement.classList.toggle('theme-spiral', theme === 'spiral' || theme === 'spiral-notebook');
    this.overlayElement.classList.toggle('theme-nicole', memberData.id === 4);
    this.bookContainer.classList.toggle('is-nicole', memberData.id === 4);
    this.isNicole = memberData.id === 4;
    for (const item of ['spiral-notebook', 'long-folder', 'theme-book', 'intermediate-pad']) {
      this.overlayElement.classList.toggle('theme-' + item, item === theme);
    }
    this.spiralTurn?.kill();
    this.bookContainer.style.removeProperty('--book-offset');
    this.bookContainer.style.removeProperty('--left-opacity');
    this.isSpiral = this.overlayElement.classList.contains('theme-spiral');
    // The standalone book tester loads ClearBook without the classroom's GSAP script.
    if (this.isSpiral && !window.gsap && !document.querySelector('script[src$="/gsap.min.js"]')) {
      const script = document.createElement('script');
      script.src = 'js/lib/gsap.min.js';
      document.head.appendChild(script);
    }
    this.currentMember = memberData;
    this.currentPageIndex = 0;
    this.photoClickCount = 0;
    this.isFlipping = false;

    // Header info
    this.memberPillName.textContent = memberData.name + " (" + memberData.section + ")";
    this.memberColorDot.style.backgroundColor = memberData.coverColor || '#FF7A00';

    const pages = this.preparePages(memberData, theme);
    this.deckElement.replaceChildren(...pages.deck);
    const photos = this.deckElement.querySelectorAll('[data-notebook-photo]');
    if (photos.length && typeof API !== 'undefined') API.getClassroom().then(({ notebookPhotos = [] }) => {
      for (const img of photos) {
        const file = img.dataset.notebookPhoto;
        if (!notebookPhotos.includes(file)) continue;
        img.addEventListener('load', () => { img.closest('figure').hidden = false; }, { once: true });
        img.src = 'assets/photos/' + file;
        delete img.dataset.notebookPhoto;
      }
    });
    this.dotsContainer.replaceChildren(...pages.dotsElements);
    this.pagesElements = pages.pagesElements;
    this.dotsElements = pages.dotsElements;
    this.totalPages = pages.totalPages;
    this.overlayElement.classList.add('active');
    this.updatePageStates();
  }

  isNotebook(member, theme = member.deskItem) {
    return member.id === 1 && (!theme || theme === 'spiral-notebook' || theme === 'spiral');
  }

  prepareMusic(member) {
    this.musicPrepared = member.id;
    if (this.isNotebook(member)) this.music.start(member.themeSong);
    else this.music.stop();
  }

  close() {
    if (!this.isOpen()) return;
    this.spiralTurn?.kill();
    this.bookContainer.style.removeProperty('--book-offset');
    this.bookContainer.style.removeProperty('--left-opacity');
    this.isDragging = false;
    this.musicPrepared = null;
    clearTimeout(this.flipTimer);
    for (const leaf of this.pagesElements) {
      leaf.classList.remove('turning', 'spiral-turning');
      leaf.style.removeProperty('transform');
    }
    this.deckElement.querySelector('.spiral-shadow')?.removeAttribute('style');
    this.music.stop();
    this.overlayElement.classList.remove('active');
    if (typeof this.options.onClose === 'function') {
      this.options.onClose();
    }
  }

  preparePages(member, theme = member.deskItem) {
    let entry = this.pageCache.get(member);
    if (!entry || entry.theme !== theme) {
      entry = { theme, pages: this.renderPages(member, theme) };
      this.pageCache.set(member, entry);
    }
    return entry.pages;
  }

  johnDivider() {
    const dividerEl = document.createElement('div');
    dividerEl.className = 'john-cloud-divider';
    dividerEl.innerHTML = `
      <div class="cloud-binder-top">
        <div class="binder-rings-row">
          ${'<i></i>'.repeat(16)}
        </div>
      </div>
      <div class="cloud-header-banner">
        <div class="clouds-backdrop">
          <svg viewBox="0 0 500 180" preserveAspectRatio="none" class="clouds-svg">
            <!-- Sky fluffy clouds with blue outline and shadows -->
            <path d="M 30,120 Q 30,70 80,70 Q 110,30 160,50 Q 210,15 270,45 Q 330,10 390,40 Q 440,25 470,75 Q 490,110 470,140 Q 430,170 380,160 Q 310,175 250,155 Q 180,175 110,155 Q 40,165 30,120 Z" fill="#EFF6FF" stroke="#1E40AF" stroke-width="4"/>
            <path d="M 60,110 Q 90,65 140,75 Q 190,45 240,65 Q 300,35 360,60 Q 420,50 440,100" fill="none" stroke="#93C5FD" stroke-width="3"/>
            <!-- Cute doodle stars like in 3rd attached photo -->
            <polygon points="120,40 124,48 132,49 126,55 128,63 120,59 112,63 114,55 108,49 116,48" fill="#FBBF24" stroke="#1E40AF" stroke-width="2"/>
            <polygon points="380,30 383,37 391,38 385,43 387,51 380,47 373,51 375,43 369,38 377,37" fill="#FBBF24" stroke="#1E40AF" stroke-width="2"/>
            <polygon points="70,130 73,137 81,138 75,143 77,151 70,147 63,151 65,143 59,138 67,137" fill="#FBBF24" stroke="#1E40AF" stroke-width="2"/>
            <polygon points="420,135 423,141 430,142 425,147 427,154 420,150 413,154 415,147 410,142 417,141" fill="#FBBF24" stroke="#1E40AF" stroke-width="2"/>
            <polygon points="260,25 262,30 268,31 264,35 265,41 260,38 255,41 256,35 252,31 258,30" fill="#FBBF24" stroke="#1E40AF" stroke-width="2"/>
          </svg>
        </div>
        <h2 class="cloud-banner-title">Welcome to my Portfolio!</h2>
        <div class="cloud-author-watermark">JOHN VERNIE DELA CRUZ</div>
      </div>
      <div class="cloud-lined-notepad">
        <div class="notepad-lines">
          ${'<div class="notepad-line"></div>'.repeat(10)}
        </div>
      </div>
    `;
    return dividerEl;
  }

  johnProfile(member) {
    const spread=document.createElement('div');spread.className='john-profile-spread';
    const blank=document.createElement('div');blank.className='john-blank-page';blank.setAttribute('aria-label','Blank left page');
    const page=document.createElement('section');page.className='john-profile-page';
    const pin=document.createElement('i');pin.className='john-pushpin';pin.setAttribute('aria-hidden','true');
    const photo=document.createElement('figure');photo.className='john-photo';
    const portrait=document.createElement('img');portrait.className='john-portrait';portrait.src=member.photo;
    portrait.alt='Portrait of '+member.name;
    photo.append(portrait);
    const heading=document.createElement('h2');heading.className='john-angular-title';heading.textContent=member.titleText||'John Vernie';
    const titleCanvas=document.createElement('canvas');titleCanvas.width=600;titleCanvas.height=240;titleCanvas.textContent=heading.textContent;
    const ctx=titleCanvas.getContext('2d');
    document.fonts.load('130px "Jolly Lodger"').catch(()=>{}).then(()=>{
      const draw=()=>{ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='miter';ctx.miterLimit=2;
        if(!document.fonts.check('130px "Jolly Lodger"')) {
          const glyphs={J:[[4,0,4,5,3,6,1,6,0,5]],O:[[1,0,3,0,4,1,4,5,3,6,1,6,0,5,0,1,1,0]],H:[[0,0,0,6],[4,0,4,6],[0,3,4,3]],N:[[0,6,0,0,4,6,4,0]],V:[[0,0,2,6,4,0]],E:[[4,0,0,0,0,6,4,6],[0,3,3,3]],R:[[0,6,0,0,3,0,4,1,4,2,3,3,0,3],[2,3,4,6]],I:[[0,0,4,0],[2,0,2,6],[0,6,4,6]]};
          ctx.beginPath();const text=titleCanvas.textContent.toUpperCase(),step=Math.min(48,540/text.length),start=(600-step*text.length)/2;
          for(let i=0;i<text.length;i++)for(const path of glyphs[text[i]]||[]){ctx.moveTo(start+i*step+path[0]*step/5,65+path[1]*17);for(let n=2;n<path.length;n+=2)ctx.lineTo(start+i*step+path[n]*step/5,65+path[n+1]*17)}
          ctx.strokeStyle='#4B1FA8';ctx.lineWidth=20;ctx.stroke();ctx.strokeStyle='#E4D2FF';ctx.lineWidth=13;ctx.stroke();ctx.strokeStyle='#9B6BEA';ctx.lineWidth=9;ctx.stroke();return;
        }
        ctx.font = '130px "Jolly Lodger", monospace'; ctx.strokeStyle = '#4B1FA8'; ctx.lineWidth = 14; ctx.strokeText(titleCanvas.textContent, 300, 120, 560);
        ctx.strokeStyle = '#E4D2FF'; ctx.lineWidth = 5; ctx.strokeText(titleCanvas.textContent, 300, 120, 560); ctx.fillStyle = '#9B6BEA'; ctx.fillText(titleCanvas.textContent, 300, 120, 560)
      };
      if (window.requestIdleCallback) requestIdleCallback(draw, { timeout: 500 }); else setTimeout(draw, 0);
    });
    heading.replaceChildren(titleCanvas); heading.setAttribute('aria-label', titleCanvas.textContent);
    const details = document.createElement('div'); details.className = 'john-profile-details';
    const name = document.createElement('p'), prefix = document.createElement('span'), strong = document.createElement('strong'); prefix.textContent = 'Name: '; strong.textContent = member.name || 'John Vernie Dela Cruz'; name.append(prefix, strong);
    const age = document.createElement('p'); age.textContent = 'Age: ' + (member.ageLine || 'TODO years of existence');
    const objective = document.createElement('p'); objective.textContent = 'Objective: ' + (member.objective || 'TODO');
    details.append(name, age, objective); page.append(pin, photo, heading, details); spread.append(blank, page); return spread;
  }

  notebookPhotos(files, label, arrow = false) {
    return '<div class="notebook-photos">' + files.map((file, index) =>
      '<figure class="notebook-print' + (arrow ? ' notebook-arrow' : '') + '" hidden>' +
        '<img data-notebook-photo="' + file + '" alt="' + label + (arrow ? '' : ' ' + (index + 1)) + '">' +
        (arrow ? '<figcaption>Zhang Linghe</figcaption>' : '') + '</figure>'
    ).join('') + '</div>';
  }

  coolSDoodles() {
    const path = 'M31 13V31L45 44V56L31 69 17 56V44L24 37M38 37L45 31V19L31 6 17 19V31L31 44V58';
    return '<div class="cool-s-doodles" role="img" aria-label="Three hand-drawn Cool S graffiti doodles">' +
      ['#344671', '#D85776', '#2D796D'].map(color => '<svg aria-hidden="true" viewBox="0 0 62 75"><path d="' + path +
        '" fill="none" stroke="' + color + '" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>').join('') +
      '</div>';
  }

  renderPages(member, theme) {
    const isSpiral = theme === 'spiral' || theme === 'spiral-notebook';
    const deckElement = document.createElement('div');
    const dotsContainer = document.createElement('div');
    const pagesElements = [], dotsElements = [];
    const coverColor = member.coverColor || '#FF7A00';

    const pageConfigs = [];
    const folderSheets = (theme === 'folder' || theme === 'long-folder');
    const isJohn = member.id === 2 && folderSheets;
    const isNicole = member.id === 4;
    const looseSheets = folderSheets || (theme === 'pad' || theme === 'intermediate-pad');

    // Page 0: Cover
    if (!looseSheets || isJohn || isNicole) pageConfigs.push({
      type: 'cover',
      title: 'Cover'
    });

    if (isSpiral) {
      pageConfigs.push({ type: 'divider', title: '1st Semester' }, { type: 'profile', title: 'Profile' });
      const rings = '<i></i>'.repeat(18);
      deckElement.innerHTML = `<div class="spiral-left" aria-hidden="true"></div>
        <div class="spiral-shadow" aria-hidden="true"></div>
        <div class="spiral-coil" aria-hidden="true">${rings}</div>`;
    }

    // Pages 1 to 6 from JSON
    const titles = ['Profile', 'About Me', 'Hobbies', 'Skills', 'Projects', 'F.L.A.M.E.S Game'];
    if (isJohn) {
      // 3rd attached photo: divider sheet inserted right before John's inner pages
      pageConfigs.push({
        type: 'john-divider',
        title: 'Welcome'
      });
    }
    const insideCount = (isSpiral || isNicole) ? (member.pages?.length || 5) : 6;
    const numberedPages = isSpiral ? insideCount + 1 : insideCount;
    for (let i = 0; i < insideCount; i++) {
      const pageData = (member.pages && member.pages[i]) ? member.pages[i] : {
        title: titles[i] || `Section ${i + 1}`,
        content: `Content for ${titles[i] || 'section'} will be added soon.`,
        border: 'wavy-pink.svg'
      };
      pageConfigs.push({
        type: 'inside',
        index: i + 1,
        pageData: pageData,
        skills: (!isSpiral && i === 3) ? member.skills : null
      });
    }

    // Page 7: Back Cover
    if (!looseSheets || isNicole) pageConfigs.push({
      type: 'back-cover',
      title: 'Back Cover'
    });

    const totalPages = pageConfigs.length;

    pageConfigs.forEach((cfg, idx) => {
      const pageEl = document.createElement('div');
      pageEl.className = 'book-page';
      pageEl.dataset.pageIndex = idx;

      const seed = isSpiral ? Handwriting.hash(member.id + ':' + idx) : 0;
      const write = text => Handwriting.handwrite(text, { seed });
      let frontHTML = '';
      let backHTML = isSpiral ? (Sketches.SKETCH_LAYOUT[idx + 1] || []).map(({ name, x, y, size, rot }) =>
        `<div class="leaf-doodle" aria-hidden="true" style="left:${x}%;top:${y}%;width:${size}%;--tilt:${rot}deg">${Sketches.get(name)}</div>`
      ).join('') : `
        <div class="backside-pocket-decor">
          <span>
            <svg class="uicon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:28px;height:28px;"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
          </span>
          <h4>Clear-Book Sleeve #${idx + 1}</h4>
          <p>Official student submission for <em>Application and Emerging Technologies</em>.</p>
          <div style="font-size:0.75rem; color:#94A3B8; margin-top:8px;">Turn backward or forward with arrows</div>
        </div>
      `;

      if (isNicole && cfg.type === 'cover') {
        frontHTML = this.nicoleCoverHTML(member);
      } else if (isNicole && cfg.type === 'inside') {
        frontHTML = this.nicoleInsideHTML(member, cfg);
      } else if (isNicole && cfg.type === 'back-cover') {
        frontHTML = this.nicoleBackCoverHTML(member);
      } else if (isJohn && (cfg.type === 'cover' || cfg.type === 'john-profile')) {
        frontHTML = '';
      } else if (cfg.type === 'cover') {
        frontHTML = `
          <div class="book-cover" style="background: linear-gradient(145deg, ${coverColor} 0%, ${this.adjustColorBrightness(coverColor, -35)} 100%);">
            <div class="cover-header">
              <span class="cover-badge">Student Portfolio</span>
              <h1 class="cover-title">PORTFOLIO</h1>
              <div class="cover-subject">${member.subject || 'Application and Emerging Technologies'}</div>
            </div>

            <div class="cover-photo-wrap" id="coverPhotoWrap">
              <img class="cover-photo-circle" id="coverPhotoImg" src="${member.photo || 'assets/photos/member1.svg'}" alt="${member.name}">
              <span class="photo-easter-hint">Double-click to spin</span>
            </div>

            <div class="cover-footer">
              <h2 class="cover-name">${member.name}</h2>
              <div class="cover-section">${member.section}</div>
              <div class="cover-tagline">“${member.tagline || 'Emerging technologies, emerging deadlines'}”</div>
            </div>
          </div>
        `;

        if (isSpiral) {
          frontHTML = `<div class="riam-collage-cover">
            <div class="riam-collage-tag"><img src="${member.photo}" alt="">
            <span><strong>PORTFOLIO</strong><b>${member.name}</b><small>★ SECTION &nbsp; ${member.section}</small></span></div>
          </div>`;
        }

        // Easy Easter Egg: Only 2 clicks (double click) to spin!
        setTimeout(() => {
          const photoWrap = pageEl.querySelector('#coverPhotoWrap');
          const photoImg = pageEl.querySelector('#coverPhotoImg');
          if (photoWrap && photoImg) {
            photoWrap.addEventListener('click', (e) => {
              e.stopPropagation();
              this.photoClickCount++;
              if (this.photoClickCount >= 2) {
                this.photoClickCount = 0;
                photoImg.style.transition = 'transform 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)';
                photoImg.style.transform = 'rotate(720deg) scale(1.18)';
                setTimeout(() => {
                  photoImg.style.transform = 'rotate(0deg) scale(1)';
                }, 1200);
                if (window.PortfolioHumor && typeof window.PortfolioHumor.playSound === 'function') {
                  window.PortfolioHumor.playSound('spin');
                  window.PortfolioHumor.showToast('Avatar spin easter egg unlocked!');
                }
              } else {
                photoImg.style.transition = 'transform 0.15s ease';
                photoImg.style.transform = 'scale(0.94) rotate(15deg)';
                setTimeout(() => {
                  photoImg.style.transform = 'scale(1) rotate(0deg)';
                }, 150);
              }
            });
          }
        }, 0);

      } else if (cfg.type === 'divider') {
        pageEl.classList.add('spiral-divider');
        frontHTML = '<div class="semester-sheet"><div class="semester-flap"><h2>1st Semester</h2></div></div><span class="semester-tab">1st Sem</span>';
      } else if (cfg.type === 'profile') {
        frontHTML = `<div class="page-inner"><div class="page-body-content spiral-profile">
          <span class="page-category-tag">Page 1 of ${numberedPages}</span><h3 class="page-title">${write('Profile')}</h3>
          <figure class="snapshot"><img src="${member.photo}" alt="Portrait of ${member.name}"><figcaption>${member.subject}</figcaption></figure>
          <h4 class="signed-name">${write(member.name)}<svg aria-hidden="true" viewBox="0 0 150 10" preserveAspectRatio="none"><path d="M2 7Q28 3 50 5T94 4T148 3" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg></h4>
          <span class="section-callout">${write(member.section)}</span>
          <p class="page-text">${write(member.id === 1 ? "HUSH HUSH HUSH" : member.tagline)}</p></div></div>`;
      } else if (cfg.type === 'inside') {
        const borderFile = cfg.pageData.border || 'wavy-pink.svg';
        const borderSrc = `assets/borders/${borderFile}`;

        let extraHTML = '';
        if (isSpiral && member.id === 1) {
          if (cfg.index === 1) extraHTML = this.notebookPhotos(['zhang-linghe.jpg'], 'Zhang Linghe', true);
          if (cfg.index === 7) extraHTML = this.notebookPhotos(
            ['riam-album-1.jpg', 'riam-album-2.jpg', 'riam-album-3.jpg', 'riam-album-4.jpg', 'riam-album-5.jpg'], 'Riam’s notebook photo');
        }
        if (cfg.skills?.length && isSpiral) {
          extraHTML = '<ul class="spiral-skills">' + cfg.skills.map(skill =>
            `<li><strong>${skill.name}</strong> — ${skill.funnyLabel}</li>`
          ).join('') + '</ul>';
        } else if (cfg.skills?.length && (theme === 'themebook' || theme === 'theme-book')) {
          extraHTML = '<ol class="themebook-skills">' + cfg.skills.map(skill =>
            `<li>${skill.name}</li>`
          ).join('') + '</ol>';
        } else if (cfg.skills && cfg.skills.length > 0 && !isJohn) {
          extraHTML += `<div class="skills-container">`;
          cfg.skills.forEach(s => {
            extraHTML += `
              <div class="skill-row">
                <div class="skill-header">
                  <span class="skill-name">${s.name}</span>
                  <span class="skill-funny-label">${s.funnyLabel}</span>
                </div>
                <div class="skill-bar-bg">
                  <div class="skill-bar-fill" style="width: ${s.level}%;"></div>
                </div>
              </div>
            `;
          });
          extraHTML += `</div>`;
        }

        if (cfg.index === 5 && !isJohn) {
          extraHTML += `
            <div style="margin-top: 14px; text-align: center;">
              <button class="page-action-btn" id="roastMeBtn" style="display:inline-flex; align-items:center; justify-content:center; gap:6px;">
                <svg class="uicon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path></svg>
                Roast Me!
              </button>
            </div>
          `;
        }

        if (cfg.index === 6 && !isJohn) {
          extraHTML += `
            <div style="margin-top: 14px; text-align: center;">
              <button class="book-guestbook-trigger" id="openGuestbookFromBookBtn" style="display:inline-flex; align-items:center; justify-content:center; gap:6px;">
                <svg class="uicon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                Leave a Sticky Note for ${member.name.split(' ')[0]}
              </button>
            </div>
          `;
        } else if (cfg.index === 6 && isJohn) {
          extraHTML += `
            <div class="john-flames-notebook">
              <div class="flames-header-word">
                <span class="flames-letter crossed">F<svg class="strike-x" viewBox="0 0 30 30"><path d="M5 5 L25 25 M25 5 L5 25" stroke="#1E3A8A" stroke-width="3.5" stroke-linecap="round"/></svg></span>
                <span class="flames-letter crossed">L<svg class="strike-x" viewBox="0 0 30 30"><path d="M5 5 L25 25 M25 5 L5 25" stroke="#1E3A8A" stroke-width="3.5" stroke-linecap="round"/></svg></span>
                <span class="flames-letter active-a">
                  A
                  <svg class="circle-scribble" viewBox="0 0 70 70">
                    <circle cx="35" cy="35" r="28" fill="none" stroke="#1E3A8A" stroke-width="2.5" stroke-dasharray="160" transform="rotate(-15 35 35)"/>
                    <circle cx="34" cy="36" r="25" fill="none" stroke="#2563EB" stroke-width="2" stroke-dasharray="150" transform="rotate(25 34 36)"/>
                  </svg>
                  <svg class="affection-pointer-arrow" viewBox="0 0 60 50">
                    <path d="M10 40 Q 25 15, 50 10 M40 8 L52 10 L48 22" fill="none" stroke="#1E3A8A" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                  <span class="affection-label">Affection ♡</span>
                </span>
                <span class="flames-letter crossed">M<svg class="strike-x" viewBox="0 0 30 30"><path d="M5 5 L25 25 M25 5 L5 25" stroke="#1E3A8A" stroke-width="3.5" stroke-linecap="round"/></svg></span>
                <span class="flames-letter crossed">E<svg class="strike-x" viewBox="0 0 30 30"><path d="M5 5 L25 25 M25 5 L5 25" stroke="#1E3A8A" stroke-width="3.5" stroke-linecap="round"/></svg></span>
                <span class="flames-letter crossed">S<svg class="strike-x" viewBox="0 0 30 30"><path d="M5 5 L25 25 M25 5 L5 25" stroke="#1E3A8A" stroke-width="3.5" stroke-linecap="round"/></svg></span>
              </div>

              <div class="flames-match-section">
                <div class="flames-names-tally">
                  <div class="name-row bongbong-row">
                    <span class="char crossed-char">B<svg class="char-cross" viewBox="0 0 20 20"><path d="M4 4 L16 16 M16 4 L4 16" stroke="#1E3A8A" stroke-width="2.5" stroke-linecap="round"/></svg></span>
                    <span class="char crossed-char">O<svg class="char-cross" viewBox="0 0 20 20"><path d="M4 4 L16 16 M16 4 L4 16" stroke="#1E3A8A" stroke-width="2.5" stroke-linecap="round"/></svg></span>
                    <span class="char crossed-char">N<svg class="char-cross" viewBox="0 0 20 20"><path d="M4 4 L16 16 M16 4 L4 16" stroke="#1E3A8A" stroke-width="2.5" stroke-linecap="round"/></svg></span>
                    <span class="char crossed-char">G<svg class="char-cross" viewBox="0 0 20 20"><path d="M4 4 L16 16 M16 4 L4 16" stroke="#1E3A8A" stroke-width="2.5" stroke-linecap="round"/></svg></span>
                    <span class="char">B</span>
                    <span class="char">O</span>
                    <span class="char">N</span>
                    <span class="char">G</span>
                  </div>
                  <div class="name-row sarah-row">
                    <span class="char">S</span>
                    <span class="char">A</span>
                    <span class="char">R</span>
                    <span class="char">A</span>
                    <span class="char">H</span>
                  </div>
                </div>

                <div class="flames-tally-side">
                  <div class="remaining-badge">13 remaining</div>
                  <div class="count-circle">
                    <span>(13)</span>
                    <svg class="strike-tally" viewBox="0 0 50 30">
                      <line x1="5" y1="25" x2="45" y2="5" stroke="#1E3A8A" stroke-width="2.5" stroke-linecap="round"/>
                    </svg>
                  </div>
                </div>
              </div>

              <div class="flames-bottom-result">
                <p class="flames-ballpen-text">Result: <strong>"A"</strong> — <em>Affection</em></p>
                <p class="flames-ballpen-desc">Bongbong and Sarah share a genuine bond of mutual respect and quiet affection.</p>
              </div>

              <div style="margin-top: 14px; text-align: center;">
                <button class="book-guestbook-trigger" id="openGuestbookFromBookBtn" style="display:inline-flex; align-items:center; justify-content:center; gap:6px;">
                  <svg class="uicon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                  Leave a Sticky Note for John Vernie
                </button>
              </div>
            </div>
          `;
        }

        if (isJohn && cfg.index === 1) {
          frontHTML = `
            <div class="page-inner">
              <div class="page-body-content spiral-profile john-profile-riam-style">
                <span class="page-category-tag">Page 1 of 6</span>
                <h3 class="page-title">Profile</h3>
                <figure class="snapshot">
                  <img src="${member.photo}" alt="Portrait of ${member.name}">
                  <figcaption>${member.subject || 'Application and Emerging Technologies'}</figcaption>
                </figure>
                <h4 class="signed-name">
                  ${member.name}
                  <svg aria-hidden="true" viewBox="0 0 150 10" preserveAspectRatio="none">
                    <path d="M2 7Q28 3 50 5T94 4T148 3" fill="none" stroke="#1E40AF" stroke-width="3" stroke-linecap="round"/>
                  </svg>
                </h4>
                <span class="section-callout">${member.section}</span>
                <p class="page-text john-plain-quote">“You only fail when you stop trying” — Albert Einstein</p>
              </div>
            </div>
          `;
        } else {
          frontHTML = `
            <div class="page-inner">
              <img class="page-svg-border" src="${borderSrc}" alt="Page Border">
              <div class="page-body-content">
                ${folderSheets ? `<header class="folder-letterhead"><span>${member.name}</span><span>${member.section}</span></header>` : ''}
                <span class="page-category-tag">Page ${isSpiral ? cfg.index + 1 : cfg.index} of ${numberedPages}</span>
                <h3 class="page-title">${isSpiral ? write(cfg.pageData.title) : cfg.pageData.title}</h3>
                <div class="page-text">${isSpiral ? cfg.pageData.content.split(/\n\s*\n/).map(paragraph => `<p>${paragraph.split("\n").map(write).join("<br>")}</p>`).join('') : cfg.pageData.content}</div>
                ${extraHTML}
                ${folderSheets && cfg.index === 6 ? '<span class="folder-stamp">APPROVED</span>' : ''}
              </div>
            </div>
          `;
        }

        setTimeout(() => {
          const roastBtn = pageEl.querySelector('#roastMeBtn');
          roastBtn?.addEventListener('click', event => {
            event.stopPropagation();
            document.querySelector('.classroom-fire')?.remove();
            const fire = document.createElement('div');
            fire.className = 'classroom-fire';
            fire.setAttribute('aria-hidden', 'true');
            fire.addEventListener('animationend', () => fire.remove(), { once: true });
            document.body.append(fire);
            window.PortfolioHumor?.playSound('spill');
          });

          const guestbookBtn = pageEl.querySelector('#openGuestbookFromBookBtn');
          if (guestbookBtn) {
            guestbookBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              this.close();
              if (typeof this.options.onOpenGuestbook === 'function') {
                this.options.onOpenGuestbook(member.id);
              }
            });
          }
          if (isNicole) {
            this.initNicoleInteractions(pageEl);
          }
        }, 0);

      } else if (cfg.type === 'back-cover') {
        frontHTML = `
          <div class="book-back-cover" style="background: linear-gradient(145deg, ${this.adjustColorBrightness(coverColor, -20)} 0%, ${this.adjustColorBrightness(coverColor, -55)} 100%);">
            <div>
              <span class="cover-badge">Course Finale</span>
              <h2 class="back-cover-title">The End</h2>
              <p class="back-cover-subtitle">(Please Clap)</p>
            </div>

            <div class="team-credits-card">
              <h4>AET Group Portfolio</h4>
              <p>Subject: <strong>Application and Emerging Technologies</strong></p>
              <p>Tech: Three.js • GSAP • Spring Boot 3</p>
              <p style="margin-top: 6px; font-size: 0.75rem; opacity: 0.8;">Zero databases were harmed in the making of this portfolio.</p>
            </div>

            <div style="font-size: 0.85rem; opacity: 0.9;">
              Thank you for reviewing our clear-book!
            </div>
          </div>
        `;
      }

      if (isSpiral) {
        pageEl.style.setProperty('--tint', (seed % 45) / 1000);
        pageEl.style.setProperty('--pen', ['#252422', '#244787', '#a64812'][(idx + 1) % 3]);
        pageEl.style.setProperty('--ink-opacity', 0.88 + (seed % 13) / 100);
        if (cfg.type === 'profile' || cfg.type === 'inside') {
          const mark = cfg.type === 'profile' ? 'stars' : ['stars', 'hearts', 'music'][idx % 3];
          frontHTML += `<div class="margin-doodle" aria-hidden="true">${Sketches.get(mark)}</div>`;
          if (cfg.type === 'profile') frontHTML += '<svg class="profile-arrow" aria-hidden="true" viewBox="0 0 40 48"><path d="M32 3Q44 28 8 37m8-9-9 10 13 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
        }
      } else if (isJohn) {
        pageEl.style.setProperty('--pen', '#1E3A8A');
        pageEl.style.setProperty('--ink-opacity', 0.95);
        if (cfg.type === 'inside') {
          const blueDoodles = ['laptop', 'stars', 'controller', 'keyboard', 'rocket', 'hearts'];
          const mark = (cfg.index === 1) ? 'stars' : blueDoodles[(idx - 1) % blueDoodles.length] || 'stars';
          frontHTML += `<div class="margin-doodle john-blue-doodle" aria-hidden="true">${Sketches.get(mark, '#93C5FD')}</div>`;
          if (cfg.index === 1) {
            frontHTML += '<svg class="profile-arrow john-profile-arrow" aria-hidden="true" viewBox="0 0 40 48"><path d="M32 3Q44 28 8 37m8-9-9 10 13 2" fill="none" stroke="#2563EB" stroke-width="2.5" stroke-linecap="round"/></svg>';
          }
        }
      }
      // The previous leaf's reverse is the left side of the photo spread.
      if (isSpiral && member.id === 1 && cfg.type === 'inside' && cfg.index === 6) backHTML = this.coolSDoodles();
      if (looseSheets && !isJohn && !isNicole) backHTML = '<div class="folder-sheet-back"></div>';
      else if (isJohn) {
        const leftPageDoodles = (Sketches.SKETCH_LAYOUT[idx + 1] || []).map(({ name, x, y, size, rot }) =>
          `<div class="leaf-doodle" aria-hidden="true" style="left:${x}%;top:${y}%;width:${size}%;--tilt:${rot}deg">${Sketches.get(name, '#93C5FD')}</div>`
        ).join('');
        backHTML = `<div class="john-sheet-back lined-notebook-left">${leftPageDoodles}</div>`;
      } else if (isNicole) {
        backHTML = this.nicoleVersoHTML(member, idx, cfg);
      }

      // Assemble double-sided page with dynamic bending shadow
      pageEl.innerHTML = `
        <div class="page-face page-front">${frontHTML}</div>
        <div class="page-face page-back">${backHTML}</div>
        <div class="page-bend-shadow"></div>
      `;

      if (isJohn && cfg.type === 'cover') {
        const front = pageEl.querySelector('.page-front'); front.classList.add('john-collage-cover');
        front.replaceChildren(JohnFolderArt.get(member).canvas);
      } else if(cfg.type==='john-divider') {
        const front=pageEl.querySelector('.page-front');front.classList.add('john-divider-cover');
        front.replaceChildren(this.johnDivider());
      } else if(cfg.type==='john-profile') {
        pageEl.querySelector('.page-front').replaceChildren(this.johnProfile(member));
      }

      pageEl.addEventListener('click', (e) => {
        if (this.isFlipping) return;
        if (e.target.closest('button') || e.target.closest('input') || e.target.closest('a') || e.target.closest('.cover-photo-wrap')) return;

        const rect = pageEl.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        if (clickX > rect.width * 0.55) {
          this.nextPage();
        } else if (clickX < rect.width * 0.45) {
          this.prevPage();
        }
      });

      deckElement.appendChild(pageEl);
      pagesElements.push(pageEl);

      const dot = document.createElement('div');
      dot.className = 'page-dot';
      dot.title = (isJohn && cfg.type === 'john-divider') ? 'Welcome' : isSpiral ? (cfg.title || cfg.pageData.title) : isJohn ? (cfg.title || cfg.pageData?.title || 'Profile') : (isNicole && cfg.type === 'cover') ? 'Cover' : (isNicole && cfg.type === 'back-cover') ? 'Back Cover' : (isNicole && cfg.pageData) ? cfg.pageData.title : looseSheets ? cfg.pageData.title : (idx === 0) ? 'Cover' : (idx === totalPages - 1) ? 'Back Cover' : `Page ${idx}`;
      dot.addEventListener('click', () => {
        if (!this.isFlipping) this.goToPage(idx);
      });
      dotsContainer.appendChild(dot);
      dotsElements.push(dot);
    });
    return { pagesElements, dotsElements, deck: Array.from(deckElement.children), totalPages };
  }

  updatePageStates() {
    const isCover = this.currentPageIndex === 0;
    const isBack = this.currentPageIndex === this.totalPages - 1;
    const isOpenSpread = !isCover && !isBack;

    this.bookContainer.classList.toggle('john-first-spread', false);
    this.bookContainer.classList.toggle('is-cover', isCover);
    this.bookContainer.classList.toggle('is-back', isBack);
    this.bookContainer.classList.toggle('is-open-spread', isOpenSpread);
    this.pagesElements.forEach((pageEl, idx) => {
      pageEl.classList.toggle('visible-verso', (this.isSpiral || this.isNicole) && idx === this.currentPageIndex - 1);
      pageEl.classList.remove('flipped', 'active-page', 'next-page');

      if (idx < this.currentPageIndex) {
        pageEl.classList.add('flipped');
        pageEl.style.zIndex = idx + 10;
      } else if (idx === this.currentPageIndex) {
        pageEl.classList.add('active-page');
        pageEl.style.zIndex = 50;
      } else if (idx === this.currentPageIndex + 1) {
        pageEl.classList.add('next-page');
        pageEl.style.zIndex = 40;
      } else {
        pageEl.style.zIndex = 30 - idx;
      }
    });

    this.dotsElements.forEach((dot, idx) => {
      dot.classList.toggle('active', idx === this.currentPageIndex);
    });

    this.prevBtn.disabled = (this.currentPageIndex === 0 || this.isFlipping);
    this.nextBtn.disabled = (this.currentPageIndex >= this.totalPages - 1 || this.isFlipping);
  }

  nextPage() {
    if (this.isFlipping || this.currentPageIndex >= this.totalPages - 1) return;

    if (this.isSpiral) return this.turnSpiral(this.currentPageIndex + 1);
    this.isFlipping = true;
    const flippingPage = this.pagesElements[this.currentPageIndex];
    flippingPage.classList.add('turning');

    if (window.PortfolioHumor && typeof window.PortfolioHumor.playSound === 'function') {
      window.PortfolioHumor.playSound('pageFlipSlow');
    }

    this.currentPageIndex++;
    this.updatePageStates();

    this.flipTimer = setTimeout(() => {
      flippingPage.classList.remove('turning');
      this.isFlipping = false;
      this.updatePageStates();
    }, 1350); // Matches slow realistic CSS duration
  }

  prevPage() {
    if (this.isFlipping || this.currentPageIndex <= 0) return;

    if (this.isSpiral) return this.turnSpiral(this.currentPageIndex - 1);
    this.isFlipping = true;
    this.currentPageIndex--;
    const returningPage = this.pagesElements[this.currentPageIndex];
    returningPage.classList.add('turning');

    if (window.PortfolioHumor && typeof window.PortfolioHumor.playSound === 'function') {
      window.PortfolioHumor.playSound('pageFlipSlow');
    }

    this.updatePageStates();

    this.flipTimer = setTimeout(() => {
      returningPage.classList.remove('turning');
      this.isFlipping = false;
      this.updatePageStates();
    }, 1350);
  }

  goToPage(idx) {
    if (this.isFlipping || idx === this.currentPageIndex || idx < 0 || idx >= this.totalPages) return;
    if (this.isSpiral) return this.turnSpiral(idx);
    this.currentPageIndex = idx;
    this.updatePageStates();
    if (window.PortfolioHumor && typeof window.PortfolioHumor.playSound === 'function') {
      window.PortfolioHumor.playSound('pageFlipSlow');
    }
  }

  turnSpiral(destination) {
    const wasClosed = this.currentPageIndex === 0 || this.currentPageIndex === this.totalPages - 1;
    const willClose = destination === 0 || destination === this.totalPages - 1;
    const forward = destination > this.currentPageIndex;
    const leaf = this.pagesElements[forward ? this.currentPageIndex : destination];
    const shadow = this.deckElement.querySelector('.spiral-shadow');
    this.currentPageIndex = destination;
    this.isFlipping = true;
    this.updatePageStates();
    const finish = () => {
      leaf.classList.remove('spiral-turning');
      leaf.style.removeProperty('transform');
      this.bookContainer.style.removeProperty('--book-offset');
      this.bookContainer.style.removeProperty('--left-opacity');
      shadow.style.removeProperty('opacity');
      shadow.style.removeProperty('transform');
      this.isFlipping = false;
      this.spiralTurn = null;
      this.updatePageStates();
    };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !window.gsap) {
      finish();
      return;
    }
    window.PortfolioHumor?.playSound('spiralPaper');
    leaf.classList.add('spiral-turning');
    leaf.style.zIndex = 90;
    const start = forward ? 0 : -180;
    this.spiralTurn = gsap.timeline({ onComplete: finish });
    if (wasClosed !== willClose) {
      this.spiralTurn.fromTo(this.bookContainer,
        { '--book-offset': wasClosed ? '-25%' : '0%' },
        { '--book-offset': willClose ? '-25%' : '0%', duration: 0.9, ease: 'power2.inOut' }, 0)
        .fromTo(this.bookContainer, { '--left-opacity': wasClosed ? 0 : 1 },
          { '--left-opacity': willClose ? 0 : 1, duration: 0.27, ease: 'power2.inOut' }, willClose ? 0.63 : 0);
    }
    this.spiralTurn.fromTo(leaf, { rotationY: start, z: 0, skewY: 0 },
      { rotationY: -180 - start, duration: 0.9, ease: 'power2.inOut' }, 0)
      .to(leaf, { z: 12, skewY: forward ? -1.4 : 1.4, duration: 0.45, repeat: 1, yoyo: true, ease: 'sine.inOut' }, 0)
      .fromTo(shadow, { xPercent: forward ? 100 : -100 }, { xPercent: forward ? -100 : 100, duration: 0.9, ease: 'power2.inOut' }, 0)
      .fromTo(shadow, { opacity: 0 }, { opacity: 0.32, duration: 0.45, repeat: 1, yoyo: true }, 0);
  }

  nicoleCoverHTML(member) {
    const fullName = member.name || "Nicole De Guzman";
    const teacherName = member.teacher || "Sir Sean Dyogi";
    return `
      <div class="nicole-page-container nicole-school-cover">
        <div class="school-spine-band" aria-hidden="true">
          <div class="school-spine-stitch"></div>
          <div class="school-spine-eyelet"></div>
          <div class="school-spine-eyelet"></div>
          <div class="school-spine-eyelet"></div>
          <div class="school-spine-eyelet"></div>
          <div class="school-spine-eyelet"></div>
        </div>
        <div class="school-cover-face school-cover-body">
          <header class="school-cover-header school-header-row">
            <div class="school-emblem-badge school-crest-wrap">
              <svg class="school-seal-svg school-crest-svg" viewBox="0 0 100 100" width="48" height="48" aria-label="Sta. John Gi Academy Crest">
                <!-- Outer Laurel Wreath in Institutional Green -->
                <g fill="none" stroke="#1E6532" stroke-width="2.2" stroke-linecap="round">
                  <path d="M50 88 C32 88 18 74 18 50 C18 36 26 22 38 14" />
                  <path d="M22 65 Q14 60 18 52 Q24 58 22 65 Z" fill="#1E6532" />
                  <path d="M20 48 Q12 42 18 36 Q23 42 20 48 Z" fill="#1E6532" />
                  <path d="M26 33 Q18 26 26 22 Q29 29 26 33 Z" fill="#1E6532" />
                  <path d="M36 21 Q30 14 38 12 Q40 19 36 21 Z" fill="#1E6532" />
                  <path d="M50 88 C68 88 82 74 82 50 C82 36 74 22 62 14" />
                  <path d="M78 65 Q86 60 82 52 Q76 58 78 65 Z" fill="#1E6532" />
                  <path d="M80 48 Q88 42 82 36 Q77 42 80 48 Z" fill="#1E6532" />
                  <path d="M74 33 Q82 26 74 22 Q71 29 74 33 Z" fill="#1E6532" />
                  <path d="M64 21 Q70 14 62 12 Q60 19 64 21 Z" fill="#1E6532" />
                </g>
                <!-- Central Academic Shield -->
                <path d="M34 26 L66 26 C66 52 50 68 50 68 C50 68 34 52 34 26 Z" fill="#E8F4EA" stroke="#1E6532" stroke-width="2.4" />
                <!-- Open Book & Torch inside shield -->
                <path d="M40 38 Q50 35 50 42 Q50 35 60 38 L60 48 Q50 45 50 52 Q50 45 40 48 Z" fill="#FFFFFF" stroke="#1E6532" stroke-width="1.4" />
                <line x1="50" y1="36" x2="50" y2="52" stroke="#1E6532" stroke-width="1.4" />
                <circle cx="50" cy="30" r="3" fill="#D9822B" />
                <!-- Star on top -->
                <polygon points="50,6 52,11 57,11 53,14 55,19 50,16 45,19 47,14 43,11 48,11" fill="#1E6532" />
                <!-- Ribbon at bottom -->
                <path d="M24 84 Q50 92 76 84 L73 78 Q50 84 27 78 Z" fill="#1E6532" />
                <text x="50" y="83" font-family="'Plus Jakarta Sans', sans-serif" font-size="4.6" font-weight="800" fill="#FFF" text-anchor="middle" letter-spacing="0.5">EST. 2026</text>
              </svg>
            </div>
            <div class="school-title-text-wrap">
              <h1 class="school-institution-name">STA. JOHN GI ACADEMY</h1>
              <div class="school-institution-sub">OFFICIAL STUDENT NOTEBOOK</div>
            </div>
          </header>

          <div class="school-portrait-centerpiece" id="coverPhotoWrap">
            <div class="school-portrait-frame">
              <svg class="school-portrait-svg" id="coverPhotoImg" viewBox="0 0 240 280" aria-label="Patron San John Gi">
                <defs>
                  <radialGradient id="patronHaloGlow" cx="50%" cy="38%" r="44%">
                    <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.95" />
                    <stop offset="65%" stop-color="#C2DEC8" stop-opacity="0.5" />
                    <stop offset="100%" stop-color="#B2D8BD" stop-opacity="0" />
                  </radialGradient>
                </defs>
                <!-- Sage green tinted background just like the Benildian notebook -->
                <rect width="240" height="280" fill="#BDD9C3" />
                <rect x="5" y="5" width="230" height="270" fill="none" stroke="#1E6532" stroke-width="1.5" stroke-dasharray="4 2" />

                <!-- Holy Halo Circle -->
                <circle cx="120" cy="115" r="76" fill="url(#patronHaloGlow)" stroke="#1E6532" stroke-width="2.2" />
                <circle cx="120" cy="115" r="71" fill="none" stroke="#1E6532" stroke-width="0.8" stroke-dasharray="3 3" />

                <!-- Habit / Clerical Robe in dark green monochrome -->
                <path d="M42 278 C46 220 78 190 102 184 L102 165 L138 165 L138 184 C162 190 194 220 198 278 Z" fill="#1E6532" />
                <!-- Robe folds -->
                <path d="M85 200 C80 230 75 260 70 278" stroke="#134720" stroke-width="3" stroke-linecap="round" />
                <path d="M155 200 C160 230 165 260 170 278" stroke="#134720" stroke-width="3" stroke-linecap="round" />

                <!-- White Clerical Rabat Collar (exact match to Benildian patron photo) -->
                <rect x="108" y="165" width="24" height="42" fill="#FFFFFF" stroke="#1E6532" stroke-width="1.8" />
                <line x1="120" y1="165" x2="120" y2="207" stroke="#1E6532" stroke-width="1.5" />
                <path d="M102 165 L138 165 L134 158 L106 158 Z" fill="#FFFFFF" stroke="#1E6532" stroke-width="1.5" />

                <!-- Head & Face -->
                <ellipse cx="120" cy="120" rx="38" ry="46" fill="#E8F4EB" stroke="#1E6532" stroke-width="2" />
                <!-- Tonsure / Brother Hair -->
                <path d="M84 104 C84 76 156 76 156 104 C156 86 142 80 120 80 C98 80 84 86 84 104 Z" fill="#1E6532" />
                <ellipse cx="120" cy="80" rx="28" ry="10" fill="#1E6532" />
                <path d="M83 104 C81 122 84 136 86 142 C89 132 88 116 86 104 Z" fill="#1E6532" />
                <path d="M157 104 C159 122 156 136 154 142 C151 132 152 116 154 104 Z" fill="#1E6532" />

                <!-- Facial Features in Green Engraving Stippling -->
                <path d="M96 108 Q107 105 114 108" fill="none" stroke="#1E6532" stroke-width="2.5" stroke-linecap="round" />
                <path d="M126 108 Q133 105 144 108" fill="none" stroke="#1E6532" stroke-width="2.5" stroke-linecap="round" />
                <ellipse cx="106" cy="115" rx="5" ry="3.5" fill="#1E6532" />
                <ellipse cx="134" cy="115" rx="5" ry="3.5" fill="#1E6532" />
                <path d="M100 112 Q106 110 112 113" fill="none" stroke="#1E6532" stroke-width="1.6" />
                <path d="M128 113 Q134 110 140 112" fill="none" stroke="#1E6532" stroke-width="1.6" />
                <path d="M120 110 L118 132 L124 133" fill="none" stroke="#1E6532" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                <path d="M110 145 Q120 148 130 145" fill="none" stroke="#1E6532" stroke-width="2.2" stroke-linecap="round" />
                <path d="M114 154 Q120 156 126 154" fill="none" stroke="#1E6532" stroke-width="1.5" />
                <path d="M96 125 Q99 135 102 142" fill="none" stroke="#1E6532" stroke-width="1" stroke-dasharray="1 2" />
                <path d="M144 125 Q141 135 138 142" fill="none" stroke="#1E6532" stroke-width="1" stroke-dasharray="1 2" />
              </svg>
            </div>
          </div>

          <div class="school-notebook-form">
            <div class="school-form-row">
              <span class="school-field-label">NAME</span>
              <span class="school-field-line"><span class="student-handwriting">${fullName}</span></span>
            </div>
            <div class="school-form-row">
              <span class="school-field-label">SUBJECT</span>
              <span class="school-field-line"><span class="student-handwriting">${member.subject || 'Advanced Emerging Technologies'}</span></span>
            </div>
            <div class="school-form-row">
              <span class="school-field-label">GRADE / LEVEL</span>
              <span class="school-field-line"><span class="student-handwriting">${member.section || 'BSIT 3-1'}</span></span>
            </div>
            <div class="school-form-row">
              <span class="school-field-label">TEACHER</span>
              <span class="school-field-line"><span class="student-handwriting">${teacherName}</span></span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  nicoleVersoHTML(member, idx, cfg) {
    const fullName = member.titleText || member.name || "Nicole Leigh G. De Guzman";

    // Spread 1 Left Page (Sheet 0 Verso - Inside Cover Profile)
    if (idx === 0) {
      return `
        <div class="nicole-verso-container nicole-dossier-page">
          <div class="nicole-washi-strip washi-matcha">STA. JOHN GI ACADEMY</div>
          <div class="nicole-page-header">
            <span class="nicole-page-num">PROFILE</span>
            <h2 class="nicole-section-title">Student Profile</h2>
          </div>
          <div class="nicole-dossier-card">
            <div class="dossier-photo-row">
              <div class="nicole-mini-polaroid">
                <div class="nicole-brass-clip" aria-hidden="true"></div>
                <img src="${member.photo}" alt="${member.name}">
                <span class="mini-caption">${fullName}</span>
              </div>
              <div class="dossier-id-badge">
                <div class="id-badge-header">
                  <span class="id-badge-title">OFFICIAL RECORD</span>
                  <span class="id-badge-code">AET-2026-04</span>
                </div>
                <div class="id-badge-fields">
                  <div class="id-field"><span class="id-label">STUDENT</span><span class="id-value">${fullName}</span></div>
                  <div class="id-field"><span class="id-label">SECTION</span><span class="id-value">${member.section || 'BSIT 3-1'}</span></div>
                  <div class="id-field"><span class="id-label">DEGREE</span><span class="id-value">BS Information Technology</span></div>
                  <div class="id-field"><span class="id-label">YEAR LEVEL</span><span class="id-value">3rd Year</span></div>
                  <div class="id-field"><span class="id-label">FAVORITE TOPIC</span><span class="id-value">Java OOP Basics</span></div>
                </div>
              </div>
            </div>
            <div class="dossier-seal-row">
              <div class="dossier-seal-badge">
                <svg class="dossier-seal-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="m9 12 2 2 4-4"/>
                </svg>
                <span>SEAN DYOGI TRUTHERS</span>
              </div>
              <span class="dossier-stamp-date">NOV 2026</span>
            </div>
          </div>
        </div>
      `;
    }

    // Spread 2 Left Page (Sheet 1 Verso - Design Tools: Figma, Affinity, Canva)
    if (idx === 1) {
      return `
        <div class="nicole-verso-container nicole-tools-page">
          <div class="nicole-washi-strip washi-matcha">DESIGN TOOLS</div>
          <div class="nicole-page-header">
            <span class="nicole-page-num">DESIGN</span>
            <h2 class="nicole-section-title">Software and Tools</h2>
          </div>
          <div class="nicole-tools-stack">
            <div class="tool-card tool-figma">
              <div class="tool-card-top">
                <div class="tool-logo-box">
                  <svg class="software-logo-svg logo-figma" viewBox="0 0 38 57" width="16" height="24" aria-label="Figma">
                    <path d="M19 0H9.5C4.25329 0 0 4.25329 0 9.5C0 14.7467 4.25329 19 9.5 19H19V0Z" fill="#F24E1E"/>
                    <path d="M19 0H28.5C33.7467 0 38 4.25329 38 9.5C38 14.7467 33.7467 19 28.5 19H19V0Z" fill="#FF7262"/>
                    <path d="M19 19H9.5C4.25329 19 0 23.2533 0 28.5C0 33.7467 4.25329 38 9.5 38H19V19Z" fill="#A259FF"/>
                    <path d="M19 19H28.5C33.7467 19 38 23.2533 38 28.5C38 33.7467 33.7467 38 28.5 38H19V19Z" fill="#1ABCFE"/>
                    <path d="M19 38H9.5C4.25329 38 0 42.2533 0 47.5C0 52.7467 4.25329 57 9.5 57C14.7467 57 19 52.7467 19 47.5V38Z" fill="#0ACF83"/>
                  </svg>
                </div>
                <div class="tool-title-wrap">
                  <h3>Figma</h3>
                  <span class="tool-role">UI and Wireframes</span>
                </div>
              </div>
              <p class="tool-desc">Screen layouts, buttons, and clickable prototypes for class projects.</p>
            </div>

            <div class="tool-card tool-affinity">
              <div class="tool-card-top">
                <div class="tool-logo-box">
                  <svg class="software-logo-svg logo-affinity" viewBox="0 0 1024 1024" width="22" height="22" aria-label="Affinity Designer">
                    <defs>
                      <radialGradient id="affGradVerso" cx="0" cy="0" r="1" gradientTransform="translate(2271.03 -89.26) scale(1038.26)" gradientUnits="userSpaceOnUse">
                        <stop offset="0" stop-color="#6be1fb"/>
                        <stop offset="1" stop-color="#00A4E4"/>
                      </radialGradient>
                    </defs>
                    <path fill="#134881" d="M1024 100c0-55.192-44.808-100-100-100H100C44.808 0 0 4.25329 0 100v824c0 55.192 44.808 100 100 100h824c55.192 0 100-44.808 100-100V100Z"/>
                    <path fill="url(#affGradVerso)" d="M2477 909.311c-.17 21.934-18.03 39.689-40 39.689h-403.69l-172.55-298.876H2477v259.187ZM1603 909V733.513L1983.19 75h148.58l-321.19 556.33L1993.98 949H1643c-22.08 0-40-17.923-40-40Zm487.17-292.956h-150.22c-16.77 0-32.27-8.8-40.65-23.327-8.38-14.502-8.38-32.433 0-46.935l75.15-130.17 115.72 200.432ZM2437 75c21.97 0 39.83 17.755 40 39.689v501.355h-347.48l-135.41-234.495L2171.1 75H2437Z" transform="translate(-1528)"/>
                  </svg>
                </div>
                <div class="tool-title-wrap">
                  <h3>Affinity Designer</h3>
                  <span class="tool-role">Vector Graphics</span>
                </div>
              </div>
              <p class="tool-desc">Drawing icons, illustrations, and clean vector shapes.</p>
            </div>

            <div class="tool-card tool-canva">
              <div class="tool-card-top">
                <div class="tool-logo-box">
                  <svg class="software-logo-svg logo-canva" viewBox="0 0 80 80" width="22" height="22" aria-label="Canva">
                    <defs>
                      <radialGradient id="canvaRadVerso0" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(15.45 70.9) rotate(-49.4) scale(61.87)">
                        <stop stop-color="#6420FF"/>
                        <stop offset="1" stop-color="#6420FF" stop-opacity="0"/>
                      </radialGradient>
                      <radialGradient id="canvaRadVerso1" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(21.18 9.09) rotate(54.7) scale(69.77)">
                        <stop stop-color="#00C4CC"/>
                        <stop offset="1" stop-color="#00C4CC" stop-opacity="0"/>
                      </radialGradient>
                    </defs>
                    <circle cx="40" cy="40" r="40" fill="#7D2AE7"/>
                    <circle cx="40" cy="40" r="40" fill="url(#canvaRadVerso0)"/>
                    <circle cx="40" cy="40" r="40" fill="url(#canvaRadVerso1)"/>
                    <path d="M57.27 48.21C56.94 48.21 56.65 48.48 56.35 49.09C52.93 56.02 47.04 60.91 40.21 60.91C32.32 60.91 27.44 53.79 27.44 43.95C27.44 27.29 36.72 17.65 44.88 17.65C48.69 17.65 51.02 20.04 51.02 23.86C51.02 28.38 48.45 30.77 48.45 32.37C48.45 33.09 48.89 33.52 49.78 33.52C53.33 33.52 57.49 29.44 57.49 23.68C57.49 18.09 52.63 13.99 44.47 13.99C30.99 13.99 19.01 26.49 19.01 43.78C19.01 57.16 26.66 66.01 38.45 66.01C50.97 66.01 58.2 53.55 58.2 49.51C58.2 48.62 57.75 48.21 57.27 48.21Z" fill="white"/>
                  </svg>
                </div>
                <div class="tool-title-wrap">
                  <h3>Canva</h3>
                  <span class="tool-role">Presentation Design</span>
                </div>
              </div>
              <p class="tool-desc">Slide decks, project reports, and visual summaries.</p>
            </div>
          </div>
        </div>
      `;
    }

    // Spread 3 Left Page (Sheet 2 Verso - Stationery and Pens)
    if (idx === 2) {
      return `
        <div class="nicole-verso-container nicole-stationery-page">
          <div class="nicole-washi-strip washi-matcha">STATIONERY</div>
          <div class="nicole-page-header">
            <span class="nicole-page-num">NOTES</span>
            <h2 class="nicole-section-title">Pens and Paper</h2>
          </div>
          <div class="stationery-feature-card">
            <div class="stationery-lead">
              <p>Writing by hand helps me organize ideas before writing code. I prefer smooth gel pens and clean grid paper for everyday planning.</p>
            </div>
            <div class="nib-diagram-box">
              <div class="nib-diagram-header">
                <div class="nib-icon-badge">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="m12 19 7-7 3 3-7 7-3-3z"/><path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18"/><circle cx="11.5" cy="11.5" r="1.5"/>
                  </svg>
                </div>
                <div>
                  <h4>0.38mm Fine Pen</h4>
                  <span class="nib-sub">Clean Lines and Quick Drying</span>
                </div>
              </div>
              <div class="nib-spec-grid">
                <div class="nib-spec-item"><span class="spec-label">PEN TYPE</span><span class="spec-val">Japanese Gel Pen (0.38mm)</span></div>
                <div class="nib-spec-item"><span class="spec-label">PAPER TYPE</span><span class="spec-val">Smooth Cream Grid Paper</span></div>
                <div class="nib-spec-item"><span class="spec-label">INK COLOR</span><span class="spec-val">Dark Green and Black</span></div>
                <div class="nib-spec-item"><span class="spec-label">BEST FOR</span><span class="spec-val">Class Notes and Planning</span></div>
              </div>
            </div>
            <div class="stationery-quote-tape">
              <span class="quote-tape-pin" aria-hidden="true"></span>
              <p>&ldquo;Good stationery keeps my notes neat and readable.&rdquo;</p>
            </div>
          </div>
        </div>
      `;
    }

    // Spread 4 Left Page (Sheet 3 Verso - Core Values: Replaces Career Goal)
    if (idx === 3) {
      return `
        <div class="nicole-verso-container nicole-manifesto-page">
          <div class="nicole-washi-strip washi-matcha">CORE VALUES</div>
          <div class="nicole-page-header">
            <span class="nicole-page-num">VALUES</span>
            <h2 class="nicole-section-title">Quality Over Quantity</h2>
          </div>
          <div class="manifesto-card">
            <div class="manifesto-quote-badge">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
              <span>FUN FACT &bull; WORK HABIT</span>
            </div>
            <blockquote class="manifesto-pullquote">
              &ldquo;I always choose quality over quantity, and it genuinely bothers me if I leave something unfinished or slightly off.&rdquo;
            </blockquote>
            <p class="manifesto-body">Whether I am adjusting spacing in Figma or writing a Java class, I prefer spending extra time to make sure things look right and run without errors.</p>
            <div class="manifesto-seal">
              <div class="seal-ring">
                <span class="seal-inner-text">DOING WORK PROPERLY</span>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    // Spread 5 Left Page (Sheet 4 Verso - Course Summary: Official Memorandum)
    if (idx === 4) {
      return `
        <div class="nicole-verso-container nicole-memo-page">
          <div class="nicole-washi-strip washi-matcha">STA. JOHN GI ACADEMY</div>
          <div class="nicole-page-header">
            <span class="nicole-page-num">SUMMARY</span>
            <h2 class="nicole-section-title">Course Summary</h2>
          </div>
          <div class="academy-memo-card">
            <div class="memo-header-grid">
              <div class="memo-row"><span class="memo-label">STUDENT</span><span class="memo-val">${fullName}</span></div>
              <div class="memo-row"><span class="memo-label">SECTION</span><span class="memo-val">${member.section || 'BSIT 3-1'}</span></div>
              <div class="memo-row"><span class="memo-label">COURSE</span><span class="memo-val">${member.subject || 'Advanced Emerging Technologies'}</span></div>
              <div class="memo-row"><span class="memo-label">GROUP</span><span class="memo-val">Sean Dyogi Truthers (Group 1)</span></div>
            </div>
            <div class="memo-divider"></div>
            <p class="memo-body">This notebook collects my coursework, design samples, and notes for Advanced Emerging Technologies. Building these pages gave me practice in interface design, basic Java OOP concepts, and clear documentation.</p>
            <div class="memo-sign-row">
              <div class="sign-line">
                <span class="student-handwriting-sig">${fullName}</span>
                <span class="sign-caption">Nicole Leigh G. De Guzman</span>
              </div>
              <div class="memo-verified-stamp">RECORD ARCHIVED</div>
            </div>
          </div>
        </div>
      `;
    }

    // Spread 6 Left Page / Inside Back Cover (Sheet 5 Verso)
    if (idx === 5) {
      return `
        <div class="nicole-verso-container nicole-endpaper-page">
          <div class="academy-circulation-pocket">
            <div class="pocket-top-label">STA. JOHN GI ACADEMY LIBRARY</div>
            <div class="pocket-card">
              <div class="pocket-card-title">CIRCULATION RECORD</div>
              <div class="pocket-card-meta">
                <div><strong>NOTEBOOK</strong> Student Portfolio</div>
                <div><strong>STUDENT</strong> ${fullName}</div>
                <div><strong>SECTION</strong> ${member.section || 'BSIT 3-1'}</div>
              </div>
              <div class="pocket-table">
                <div class="pocket-row pocket-head"><span>DATE ISSUED</span><span>STATUS</span></div>
                <div class="pocket-row"><span>NOV 2026</span><span class="stamp-approved">ARCHIVED</span></div>
                <div class="pocket-row"><span>SEMESTER 1</span><span class="stamp-truthers">SEAN DYOGI TRUTHERS</span></div>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    return `
      <div class="nicole-sheet-back">
        <div class="nicole-back-grid"></div>
        <div class="nicole-back-stamp">
          <span class="back-brand">STA. JOHN GI ACADEMY</span>
          <span class="back-author">${fullName}</span>
        </div>
      </div>
    `;
  }

  nicoleInsideHTML(member, cfg) {
    const idx = cfg.index;
    const fullName = member.titleText || member.name || "Nicole Leigh G. De Guzman";

    // Spread 1 Right Page (Sheet 1 Recto)
    if (idx === 1) {
      return `
        <div class="nicole-page-container nicole-meet-page">
          <div class="nicole-washi-strip washi-cream">ABOUT ME</div>
          <div class="nicole-page-header">
            <span class="nicole-page-num">01 / 05</span>
            <h2 class="nicole-section-title">Hello, I'm Nicole!</h2>
          </div>
          <div class="nicole-meet-editorial">
            <div class="nicole-intro-note">
              <p>Hi! I am Nicole Leigh G. De Guzman, a third year IT student. I enjoy working on user interfaces and writing clean code.</p>
              <p>I like connecting good visual design with working programs, from prototypes in Figma to basic object-oriented classes in Java.</p>
            </div>
            <div class="nicole-highlight-card">
              <div class="highlight-label">MY APPROACH</div>
              <p>&ldquo;I want to build simple, useful software that helps people with everyday tasks.&rdquo;</p>
            </div>
            <div class="nicole-sticky-objective">
              <div class="sticky-pushpin" aria-hidden="true"></div>
              <span class="sticky-label">MY OBJECTIVE</span>
              <p class="objective-text">${member.objective || 'To be able to contribute and work on practical, yet meaningful projects where I can grow and continuously improve my skills in both design and development, while genuinely helping people.'}</p>
            </div>
          </div>
        </div>
      `;
    }

    // Spread 2 Right Page (Sheet 2 Recto)
    if (idx === 2) {
      return `
        <div class="nicole-page-container nicole-skills-page">
          <div class="nicole-washi-strip washi-cream">COURSEWORK</div>
          <div class="nicole-page-header">
            <span class="nicole-page-num">02 / 05</span>
            <h2 class="nicole-section-title">Software and Skills</h2>
          </div>
          <div class="nicole-engineering-stack">
            <div class="nicole-eng-card">
              <div class="eng-card-header">
                <div class="eng-icon-box">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
                  </svg>
                </div>
                <h3>Object-Oriented Programming</h3>
              </div>
              <div class="software-pills">
                <span class="pill pill-java">Java</span>
                <span class="pill pill-oop">Classes</span>
                <span class="pill pill-arch">Methods</span>
              </div>
              <p class="eng-desc">Writing clean classes, objects, and methods for coursework and practical programs.</p>
            </div>

            <div class="nicole-eng-card">
              <div class="eng-card-header">
                <div class="eng-icon-box">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                  </svg>
                </div>
                <h3>Visual Presentation and Docs</h3>
              </div>
              <div class="software-pills">
                <span class="pill pill-docs">Figma</span>
                <span class="pill pill-spec">Canva</span>
                <span class="pill pill-layout">Documentation</span>
              </div>
              <p class="eng-desc">Designing clear slide decks, wireframes, and project guides for class assignments.</p>
            </div>
          </div>

          <div class="nicole-skill-meters">
            ${(member.skills || []).map(s => `
              <div class="nicole-meter-row">
                <div class="meter-info">
                  <span class="meter-name">${s.name}</span>
                  <span class="meter-funny">${s.funnyLabel || ''}</span>
                  <span class="meter-percent">${s.level}%</span>
                </div>
                <div class="meter-track">
                  <div class="meter-fill" style="width: ${s.level}%;"></div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    // Spread 3 Right Page (Sheet 3 Recto)
    if (idx === 3) {
      return `
        <div class="nicole-page-container nicole-sensory-page">
          <div class="nicole-washi-strip washi-cream">INTERESTS</div>
          <div class="nicole-page-header">
            <span class="nicole-page-num">03 / 05</span>
            <h2 class="nicole-section-title">Skincare and Fragrance</h2>
          </div>
          <div class="sensory-stack">
            <div class="sensory-card skincare-card">
              <div class="sensory-card-header">
                <div class="sensory-icon-box">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M10 2v7.31L4.69 18.5A2 2 0 0 0 6.44 21.5h11.12a2 2 0 0 0 1.75-3L14 9.31V2"/><line x1="8.5" y1="2" x2="15.5" y2="2"/><line x1="7" y1="16" x2="17" y2="16"/>
                  </svg>
                </div>
                <div>
                  <h3>Skincare Ingredients</h3>
                  <span class="sensory-sub">Research and Routine</span>
                </div>
              </div>
              <p class="sensory-desc">I like learning about ingredients such as ceramides, niacinamide, and hyaluronic acid. Understanding how different products work helps me pick gentle and effective skincare.</p>
              <div class="sensory-tags">
                <span class="tag-pill">Ceramides</span>
                <span class="tag-pill">Hydration</span>
                <span class="tag-pill">Gentle Care</span>
              </div>
            </div>

            <div class="sensory-card fragrance-card">
              <div class="sensory-card-header">
                <div class="sensory-icon-box">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>
                  </svg>
                </div>
                <div>
                  <h3>Favorite Scents</h3>
                  <span class="sensory-sub">Notes and Blends</span>
                </div>
              </div>
              <p class="sensory-desc">I enjoy light and fresh fragrances with green tea, soft florals, and woody notes.</p>
              <div class="olfactory-pyramid">
                <div class="pyr-tier top"><span class="tier-label">FRESH</span><span class="tier-notes">Green tea, bergamot, fresh linen</span></div>
                <div class="pyr-tier heart"><span class="tier-label">FLORAL</span><span class="tier-notes">Soft iris, jasmine</span></div>
                <div class="pyr-tier base"><span class="tier-label">WARM</span><span class="tier-notes">Cedarwood, amber</span></div>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    // Spread 4 Right Page (Sheet 4 Recto)
    if (idx === 4) {
      return `
        <div class="nicole-page-container nicole-vision-page">
          <div class="nicole-washi-strip washi-cream">CORE VALUES</div>
          <div class="nicole-page-header">
            <span class="nicole-page-num">04 / 05</span>
            <h2 class="nicole-section-title">Quality in Practice</h2>
          </div>
          <div class="nicole-vision-content">
            <div class="vision-banner">
              <div class="vision-icon-duo">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="tech-svg" aria-hidden="true">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
              </div>
              <div class="vision-headline">
                <h3>Work Standards</h3>
                <p>Taking the time to do things properly from the start.</p>
              </div>
            </div>
            <div class="vision-col">
              <div class="col-ribbon">PRACTICAL STANDARDS</div>
              <h4>Doing Things Thoroughly</h4>
              <p>Whether sketching layouts or organizing code, I prefer working patiently to ensure every detail is in place. Rushing often creates mistakes that take longer to fix later.</p>
            </div>
            <div class="vision-quote-card">
              <p>&ldquo;Every detail matters, from the first sketch to the final line of code.&rdquo;</p>
            </div>
          </div>
        </div>
      `;
    }

    // Spread 5 Right Page (Sheet 5 Recto)
    if (idx === 5) {
      return `
        <div class="nicole-page-container nicole-contact-page">
          <div class="nicole-washi-strip washi-cream">CONTACT</div>
          <div class="nicole-page-header">
            <span class="nicole-page-num">05 / 05</span>
            <h2 class="nicole-section-title">Contact and Notes</h2>
          </div>
          <div class="nicole-letterhead-card">
            <div class="letterhead-top">
              <div class="letterhead-brand">
                <h3>${fullName}</h3>
                <span class="letterhead-sub">BSIT 3-1 &bull; Advanced Emerging Technologies</span>
              </div>
              <div class="letterhead-seal">BSIT 3-1</div>
            </div>
            <div class="letterhead-divider"></div>
            <div class="letterhead-body">
              <p>Thank you for looking through my Sta. John Gi Academy student notebook.</p>
              <p>Feel free to reach out about design, class projects, or stationery recommendations.</p>
              <div class="email-action-box">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="email-svg-icon" aria-hidden="true">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                </svg>
                <span class="email-address">nicoleleighgdeguzman@gmail.com</span>
                <button class="nicole-copy-email-btn" id="nicoleCopyEmailBtn" data-email="nicoleleighgdeguzman@gmail.com" aria-label="Copy Nicole's email address">
                  Copy Email
                </button>
              </div>
            </div>
            <div class="letterhead-desk-prompt">
              <p>Have feedback, greetings, or a favorite stationery recommendation to share?</p>
              <button class="nicole-guestbook-btn" id="openGuestbookFromBookBtn" aria-label="Leave a note on Nicole's 3D desk">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle; margin-right:4px;">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                Leave a Note on Nicole's 3D Desk
              </button>
            </div>
          </div>
        </div>
      `;
    }

    return `<div class="nicole-page-container"><p>${cfg.pageData?.content || ''}</p></div>`;
  }

  nicoleBackCoverHTML(member) {
    const fullName = member.titleText || member.name || "Nicole Leigh G. De Guzman";
    return `
      <div class="nicole-page-container nicole-back-cover">
        <div class="nicole-washi-tape washi-bottom-left" aria-hidden="true"></div>
        <div class="nicole-washi-tape washi-bottom-right" aria-hidden="true"></div>
        <div class="back-cover-emblem">NL</div>
        <h2 class="back-cover-title">THE END</h2>
        <div class="back-cover-subtitle">Thank you for visiting my Sta. John Gi Academy notebook.</div>
        <div class="nicole-credits-card">
          <h4>Sean Dyogi Truthers &bull; Group 1</h4>
          <p>Advanced Emerging Technologies</p>
          <p class="craft-note">Sta. John Gi Academy Official Student Notebook</p>
        </div>
        <div class="back-cover-motto">&ldquo;Always choose quality over quantity.&rdquo;</div>
      </div>
    `;
  }

  initNicoleInteractions(pageEl) {
    const copyBtn = pageEl.querySelector('#nicoleCopyEmailBtn');
    if (copyBtn) {
      copyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const email = copyBtn.dataset.email || 'nicoleleighgdeguzman@gmail.com';
        navigator.clipboard?.writeText(email).then(() => {
          const original = copyBtn.textContent;
          copyBtn.textContent = 'Copied! ✓';
          copyBtn.style.background = '#4F6D54';
          copyBtn.style.color = '#FFFDF7';
          if (window.PortfolioHumor && typeof window.PortfolioHumor.showToast === 'function') {
            window.PortfolioHumor.showToast('Copied email to clipboard!');
          }
          setTimeout(() => {
            copyBtn.textContent = original;
            copyBtn.style.background = '';
            copyBtn.style.color = '';
          }, 2000);
        }).catch(() => {
          copyBtn.textContent = 'Copied! ✓';
        });
      });
    }

    const guestbookBtn = pageEl.querySelector('#openGuestbookFromBookBtn');
    if (guestbookBtn && !guestbookBtn._hasNicoleDeskHandler) {
      guestbookBtn._hasNicoleDeskHandler = true;
      guestbookBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (typeof this.options.onOpenGuestbook === 'function') {
          this.options.onOpenGuestbook(4);
        }
      });
    }
  }

  adjustColorBrightness(hex, percent) {
    let num = parseInt(hex.replace('#', ''), 16);
    let r = (num >> 16) + percent;
    let b = ((num >> 8) & 0x00FF) + percent;
    let g = (num & 0x0000FF) + percent;
    return "#" + (
      0x1000000 +
      (r < 255 ? (r < 1 ? 0 : r) : 255) * 0x10000 +
      (b < 255 ? (b < 1 ? 0 : b) : 255) * 0x100 +
      (g < 255 ? (g < 1 ? 0 : g) : 255)
    ).toString(16).slice(1);
  }
}

window.ClearBook = ClearBook;
