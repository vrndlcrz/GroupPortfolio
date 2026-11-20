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
      else music.audio.play().catch(() => {});
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
    for (const item of ['spiral-notebook', 'long-folder', 'theme-book', 'intermediate-pad']) {
      this.overlayElement.classList.toggle('theme-' + item, item === theme);
    }
    this.spiralTurn?.kill();
    this.journalTurn?.kill();
    this.bookContainer.style.removeProperty('--book-offset');
    this.bookContainer.style.removeProperty('--left-opacity');
    this.isSpiral = this.overlayElement.classList.contains('theme-spiral');
    this.isCharellaJournal = memberData.id === 3 && (theme === 'themebook' || theme === 'theme-book');
    // The standalone book tester loads GSAP when a portfolio needs the page-turn animation.
    if ((this.isSpiral || this.isCharellaJournal) && !window.gsap && !document.querySelector('script[src$="/gsap.min.js"]')) {
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
    return (
      (member.id === 1 && (!theme || theme === 'spiral-notebook' || theme === 'spiral')) ||
      (member.id === 3 && (theme === 'themebook' || theme === 'theme-book'))
    );
  }

  prepareMusic(member) {
    this.musicPrepared = member.id;

    if (member.id === 3) {
      this.music.start('/assets/audio/SC-KalimutanKa.mp3');
    } else if (this.isNotebook(member)) {
      this.music.start(member.themeSong);
    } else {
      this.music.stop();
    }
  }

  close() {
    if (!this.isOpen()) return;
    this.spiralTurn?.kill();
    this.journalTurn?.kill();
    this.bookContainer.style.removeProperty('--book-offset');
    this.bookContainer.style.removeProperty('--left-opacity');
    this.isDragging = false;
    this.musicPrepared = null;
    clearTimeout(this.flipTimer);
    for (const leaf of this.pagesElements) {
      leaf.classList.remove('turning', 'spiral-turning', 'journal-turning');
      leaf.style.removeProperty('transform');
      leaf.style.removeProperty('z-index');
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
        ctx.font='130px "Jolly Lodger", monospace';ctx.strokeStyle='#4B1FA8';ctx.lineWidth=14;ctx.strokeText(titleCanvas.textContent,300,120,560);
        ctx.strokeStyle='#E4D2FF';ctx.lineWidth=5;ctx.strokeText(titleCanvas.textContent,300,120,560);ctx.fillStyle='#9B6BEA';ctx.fillText(titleCanvas.textContent,300,120,560)};
      if(window.requestIdleCallback)requestIdleCallback(draw,{timeout:500});else setTimeout(draw,0);
    });
    heading.replaceChildren(titleCanvas);heading.setAttribute('aria-label',titleCanvas.textContent);
    const details=document.createElement('div');details.className='john-profile-details';
    const name=document.createElement('p'),prefix=document.createElement('span'),strong=document.createElement('strong');prefix.textContent='Name: ';strong.textContent=member.name||'John Vernie Dela Cruz';name.append(prefix,strong);
    const age=document.createElement('p');age.textContent='Age: '+(member.ageLine||'TODO years of existence');
    const objective=document.createElement('p');objective.textContent='Objective: '+(member.objective||'TODO');
    details.append(name,age,objective);page.append(pin,photo,heading,details);spread.append(blank,page);return spread;
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
    const isJohn=member.id===2 && folderSheets;
    const looseSheets = folderSheets || (theme === 'pad' || theme === 'intermediate-pad');

    // Page 0: Cover
    if (!looseSheets || isJohn) pageConfigs.push({
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

    const isCharellaJournal =
      member.id === 3 &&
      (theme === 'themebook' || theme === 'theme-book');

    const insideCount = isSpiral ? (member.pages?.length || 6) : 6;
    const numberedPages = isSpiral ? insideCount + 1 : insideCount;

    if (isCharellaJournal) {
      const journalImages = [
        '/assets/textures/CM_1.png',
        '/assets/textures/CM_2.png',
        '/assets/textures/CM_3.png'
      ];

      journalImages.forEach((imageSrc, index) => {
        pageConfigs.push({
          type: 'inside-image',
          index: index + 1,
          imageSrc: imageSrc
        });
      });
    } else {
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
    }

    // Page 7: Back Cover
    if (!looseSheets) pageConfigs.push({
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

      if (isCharellaJournal) {
        backHTML = '';
      }

      if (isJohn && (cfg.type==='cover' || cfg.type==='john-profile')) {
        frontHTML='';
      } else if (
        cfg.type === 'cover' &&
        isCharellaJournal
      ) {
        frontHTML = `
          <div class="cm-journal-cover">
            <img src="/assets/textures/CM_cover.png" alt="Journal cover">
          </div>
        `;
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
            <span><strong>PORTFOLIO</strong><b>${member.name}</b><small>★ SECTION &nbsp; ${member.section}</small></span>
          </div>
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
      } else if (cfg.type === 'inside-image') {
        frontHTML = `
          <div class="cm-journal-page">
            <img
              src="${cfg.imageSrc}"
              alt="Journal page ${cfg.index}"
            >
          </div>
        `;


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
        }, 0);

      } else if (cfg.type === 'back-cover') {
        if (isCharellaJournal) {
          frontHTML = `
            <div class="cm-journal-page">
              <img
                src="/assets/textures/CM-back.jfif"
                alt=""
              >
            </div>
          `;
        } else {
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
      if (looseSheets && !isJohn) backHTML = '<div class="folder-sheet-back"></div>';
      else if (isJohn) {
        const leftPageDoodles = (Sketches.SKETCH_LAYOUT[idx + 1] || []).map(({ name, x, y, size, rot }) =>
          `<div class="leaf-doodle" aria-hidden="true" style="left:${x}%;top:${y}%;width:${size}%;--tilt:${rot}deg">${Sketches.get(name, '#93C5FD')}</div>`
        ).join('');
        backHTML = `<div class="john-sheet-back lined-notebook-left">${leftPageDoodles}</div>`;
      }

      // Assemble double-sided page with dynamic bending shadow
      pageEl.innerHTML = `
        <div class="page-face page-front">${frontHTML}</div>
        <div class="page-face page-back">${backHTML}</div>
        <div class="page-bend-shadow"></div>
      `;

      if(isJohn && cfg.type==='cover') {
        const front=pageEl.querySelector('.page-front');front.classList.add('john-collage-cover');
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
      dot.title = (isJohn && cfg.type === 'john-divider') ? 'Welcome' : isSpiral ? (cfg.title || cfg.pageData.title) : isJohn ? (cfg.title || cfg.pageData?.title || 'Profile') : looseSheets ? cfg.pageData.title : (idx === 0) ? 'Cover' : (idx === totalPages - 1) ? 'Back Cover' : `Page ${idx}`;
      dot.addEventListener('click', () => {
        if (!this.isFlipping) this.goToPage(idx);
      });
      dotsContainer.appendChild(dot);
      dotsElements.push(dot);
    });
    return { pagesElements, dotsElements, deck: Array.from(deckElement.children), totalPages };
  }

  updatePageStates() {
    this.bookContainer.classList.toggle('john-first-spread', false);
    this.bookContainer.classList.toggle('is-cover', this.isSpiral && this.currentPageIndex === 0);
    this.bookContainer.classList.toggle('is-back', this.isSpiral && this.currentPageIndex === this.totalPages - 1);
    this.pagesElements.forEach((pageEl, idx) => {
      if (this.isSpiral) pageEl.classList.toggle('visible-verso', idx === this.currentPageIndex - 1);
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
    if (this.isCharellaJournal) return this.turnJournal(this.currentPageIndex + 1);
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
    if (this.isCharellaJournal) return this.turnJournal(this.currentPageIndex - 1);
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
    if (this.isCharellaJournal) return this.turnJournal(idx);
    this.currentPageIndex = idx;
    this.updatePageStates();
    if (window.PortfolioHumor && typeof window.PortfolioHumor.playSound === 'function') {
      window.PortfolioHumor.playSound('pageFlipSlow');
    }
  }

  turnJournal(destination) {
    const forward = destination > this.currentPageIndex;
    const leaf = this.pagesElements[forward ? this.currentPageIndex : destination];
    if (!leaf) return;

    this.currentPageIndex = destination;
    this.isFlipping = true;
    this.updatePageStates();
    leaf.classList.add('journal-turning');
    leaf.style.zIndex = '90';

    const finish = () => {
      leaf.classList.remove('journal-turning');
      leaf.style.removeProperty('transform');
      leaf.style.removeProperty('z-index');
      this.isFlipping = false;
      this.journalTurn = null;
      this.updatePageStates();
    };

    if (window.PortfolioHumor?.playSound) window.PortfolioHumor.playSound('pageFlipSlow');
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !window.gsap) {
      finish();
      return;
    }

    this.journalTurn = window.gsap.timeline({ onComplete: finish });
    this.journalTurn.fromTo(leaf,
      { rotationY: forward ? 0 : -180, z: 0 },
      { rotationY: forward ? -180 : 0, z: 8, duration: 1.35, ease: 'power2.inOut', force3D: true }
    );
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
