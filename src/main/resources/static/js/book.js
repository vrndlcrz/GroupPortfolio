/**
 * book.js - Clear-Book Portfolio Component
 * Handles the display of the 3D clear-book binder, cover, 6 inside pages with SVG borders,
 * back cover, realistic slow & smooth double-sided page flips, and easy easter eggs.
 */

const CLEARBOOK_BUILD = 'spiral-cover-v2';

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
    this.dotsContainer.replaceChildren(...pages.dotsElements);
    this.pagesElements = pages.pagesElements;
    this.dotsElements = pages.dotsElements;
    this.totalPages = pages.totalPages;
    this.overlayElement.classList.add('active');
    document.getElementById('deskBackBtn')?.setAttribute('aria-hidden', 'true');
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
    document.getElementById('deskBackBtn')?.removeAttribute('aria-hidden');
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

  johnProfile(member) {
    const spread=document.createElement('div');spread.className='john-profile-spread';
    const blank=document.createElement('div');blank.className='john-blank-page';blank.setAttribute('aria-label','Blank left page');
    const page=document.createElement('section');page.className='john-profile-page';
    const pin=document.createElement('i');pin.className='john-pushpin';pin.setAttribute('aria-hidden','true');
    const photo=document.createElement('figure');photo.className='john-photo';photo.setAttribute('aria-label','Photo placeholder');
    const silhouette=document.createElement('span');silhouette.className='john-silhouette';silhouette.setAttribute('aria-hidden','true');
    const label=document.createElement('figcaption');label.textContent='Photo';photo.append(silhouette,label);
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
    const titles = ['About Me', 'Hobbies', 'Skills', 'Projects', 'Fun Facts', 'Contact/Goals'];
    for (let i = 0; i < 6; i++) {
      const pageData = (member.pages && member.pages[i]) ? member.pages[i] : {
        title: titles[i],
        content: `Content for ${titles[i]} will be added soon.`,
        border: 'wavy-pink.svg'
      };
      pageConfigs.push({
        type: isJohn && i===0 ? 'john-profile' : 'inside',
        title: isJohn && i===0 ? 'Profile' : undefined,
        index: i + 1,
        pageData: pageData,
        skills: (i === 2) ? member.skills : null
      });
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
          <p>Official student submission for <em>Advanced Emerging Technologies</em>.</p>
          <div style="font-size:0.75rem; color:#94A3B8; margin-top:8px;">Turn backward or forward with arrows</div>
        </div>
      `;

      if (isJohn && (cfg.type==='cover' || cfg.type==='john-profile')) {
        frontHTML='';
      } else if (cfg.type === 'cover') {
        frontHTML = `
          <div class="book-cover" style="background: linear-gradient(145deg, ${coverColor} 0%, ${this.adjustColorBrightness(coverColor, -35)} 100%);">
            <div class="cover-header">
              <span class="cover-badge">Student Portfolio</span>
              <h1 class="cover-title">PORTFOLIO</h1>
              <div class="cover-subject">${member.subject || 'Advanced Emerging Technologies'}</div>
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
          <span class="page-category-tag">Page 1 of 7</span><h3 class="page-title">${write('Profile')}</h3>
          <figure class="snapshot"><img src="${member.photo}" alt="Portrait of ${member.name}"><figcaption>${member.subject}</figcaption></figure>
          <h4 class="signed-name">${write(member.name)}<svg aria-hidden="true" viewBox="0 0 150 10" preserveAspectRatio="none"><path d="M2 7Q28 3 50 5T94 4T148 3" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg></h4>
          <span class="section-callout">${write(member.section)}</span>
          <p class="page-text">${write(member.tagline)}</p></div></div>`;
      } else if (cfg.type === 'inside') {
        const borderFile = cfg.pageData.border || 'wavy-pink.svg';
        const borderSrc = `assets/borders/${borderFile}`;

        let extraHTML = '';
        if (cfg.skills?.length && isSpiral) {
          extraHTML = '<ul class="spiral-skills">' + cfg.skills.map(skill =>
            `<li><strong>${skill.name}</strong> — ${skill.funnyLabel}</li>`
          ).join('') + '</ul>';
        } else if (cfg.skills?.length && (theme === 'themebook' || theme === 'theme-book')) {
          extraHTML = '<ol class="themebook-skills">' + cfg.skills.map(skill =>
            `<li>${skill.name}</li>`
          ).join('') + '</ol>';
        } else if (cfg.skills && cfg.skills.length > 0) {
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

        if (cfg.index === 5) {
          extraHTML += `
            <div style="margin-top: 14px; text-align: center;">
              <button class="page-action-btn" id="roastMeBtn" style="display:inline-flex; align-items:center; justify-content:center; gap:6px;">
                <svg class="uicon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path></svg>
                Roast Me!
              </button>
              <div class="roast-result-box" id="roastResultBox" style="display:none;"></div>
            </div>
          `;
        }

        if (cfg.index === 6) {
          extraHTML += `
            <div style="margin-top: 14px; text-align: center;">
              <button class="book-guestbook-trigger" id="openGuestbookFromBookBtn" style="display:inline-flex; align-items:center; justify-content:center; gap:6px;">
                <svg class="uicon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                Leave a Sticky Note for ${member.name.split(' ')[0]}
              </button>
            </div>
          `;
        }

        frontHTML = `
          <div class="page-inner">
            <img class="page-svg-border" src="${borderSrc}" alt="Page Border">
            <div class="page-body-content">
              ${folderSheets ? `<header class="folder-letterhead"><span>${member.name}</span><span>${member.section}</span></header>` : ''}
              <span class="page-category-tag">Page ${isSpiral ? cfg.index + 1 : cfg.index} of ${isSpiral ? 7 : 6}</span>
              <h3 class="page-title">${isSpiral ? write(cfg.pageData.title) : cfg.pageData.title}</h3>
              <div class="page-text">${isSpiral ? cfg.pageData.content.split(/\n\s*\n/).map(paragraph => `<p>${write(paragraph)}</p>`).join('') : cfg.pageData.content}</div>
              ${extraHTML}
              ${folderSheets && cfg.index === 6 ? '<span class="folder-stamp">APPROVED</span>' : ''}
            </div>
          </div>
        `;

        setTimeout(() => {
          const roastBtn = pageEl.querySelector('#roastMeBtn');
          const roastBox = pageEl.querySelector('#roastResultBox');
          if (roastBtn && roastBox) {
            roastBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              const roasts = [
                "Has 47 browser tabs open and uses none of them.",
                "Says 'quick 5 minute break' and returns 3 business days later.",
                "Believes 'git push --force' is a valid problem-solving strategy.",
                "Debugs with console.log('test 1'), console.log('here'), console.log('WHY PLEASE').",
                "Spends 2 hours searching for a Spotify playlist before writing 1 line of HTML.",
                "Can explain the theory of quantum computing, but forgets the semicolon on line 4.",
                "Owns a reusable water bottle that has seen more iced coffee than water.",
                "Reads StackOverflow answers from 2013 with blind religious faith."
              ];
              const randomRoast = roasts[Math.floor(Math.random() * roasts.length)];
              roastBox.textContent = `"${randomRoast}"`;
              roastBox.style.display = 'block';
              if (window.PortfolioHumor && typeof window.PortfolioHumor.playSound === 'function') {
                window.PortfolioHumor.playSound('pop');
              }
            });
          }

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
        frontHTML = `
          <div class="book-back-cover" style="background: linear-gradient(145deg, ${this.adjustColorBrightness(coverColor, -20)} 0%, ${this.adjustColorBrightness(coverColor, -55)} 100%);">
            <div>
              <span class="cover-badge">Course Finale</span>
              <h2 class="back-cover-title">The End</h2>
              <p class="back-cover-subtitle">(Please Clap)</p>
            </div>

            <div class="team-credits-card">
              <h4>AET Group Portfolio</h4>
              <p>Subject: <strong>Advanced Emerging Technologies</strong></p>
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
      }
      if (looseSheets) backHTML = '<div class="folder-sheet-back"></div>';

      // Assemble double-sided page with dynamic bending shadow
      pageEl.innerHTML = `
        <div class="page-face page-front">${frontHTML}</div>
        <div class="page-face page-back">${backHTML}</div>
        <div class="page-bend-shadow"></div>
      `;

      if(isJohn && cfg.type==='cover') {
        const front=pageEl.querySelector('.page-front');front.classList.add('john-collage-cover');
        front.replaceChildren(JohnFolderArt.get(member).canvas);
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
      dot.title = isSpiral ? (cfg.title || cfg.pageData.title) : isJohn ? (cfg.title || cfg.pageData?.title || 'Profile') : looseSheets ? cfg.pageData.title : (idx === 0) ? 'Cover' : (idx === totalPages - 1) ? 'Back Cover' : `Page ${idx}`;
      dot.addEventListener('click', () => {
        if (!this.isFlipping) this.goToPage(idx);
      });
      dotsContainer.appendChild(dot);
      dotsElements.push(dot);
    });
    return { pagesElements, dotsElements, deck: Array.from(deckElement.children), totalPages };
  }

  updatePageStates() {
    this.bookContainer.classList.toggle('john-first-spread',this.currentMember?.id===2 && this.currentPageIndex===1 && this.overlayElement.classList.contains('theme-folder'));
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
