/**
 * book.js - Clear-Book Portfolio Component
 * Handles the display of the 3D clear-book binder, cover, 6 inside pages with SVG borders,
 * back cover, realistic slow & smooth double-sided page flips, and easy easter eggs.
 */

class ClearBook {
  constructor(options = {}) {
    this.options = Object.assign({
      containerId: 'book-overlay-container',
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

        <div class="book-key-hints">Tip: Use [←] [→] arrow keys to flip smoothly • [Esc] to return to desk</div>
      </div>
    `;

    this.overlayElement = document.getElementById('bookOverlay');
    this.deckElement = document.getElementById('pagesDeck');
    this.dotsContainer = document.getElementById('bookPageDots');
    this.prevBtn = document.getElementById('prevPageBtn');
    this.nextBtn = document.getElementById('nextPageBtn');
    this.closeBtn = document.getElementById('bookCloseBtn');
    this.memberPillName = document.getElementById('memberPillName');
    this.memberColorDot = document.getElementById('memberColorDot');

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

  open(memberData) {
    this.currentMember = memberData;
    this.currentPageIndex = 0;
    this.photoClickCount = 0;
    this.isFlipping = false;

    // Header info
    this.memberPillName.textContent = memberData.name + " (" + memberData.section + ")";
    this.memberColorDot.style.backgroundColor = memberData.coverColor || '#FF7A00';

    this.renderPages();
    this.overlayElement.classList.add('active');
    this.updatePageStates();
  }

  close() {
    if (!this.isOpen()) return;
    this.overlayElement.classList.remove('active');
    if (typeof this.options.onClose === 'function') {
      this.options.onClose();
    }
  }

  renderPages() {
    const member = this.currentMember;
    const coverColor = member.coverColor || '#FF7A00';
    this.deckElement.innerHTML = '';
    this.dotsContainer.innerHTML = '';
    this.pagesElements = [];
    this.dotsElements = [];

    const pageConfigs = [];

    // Page 0: Cover
    pageConfigs.push({
      type: 'cover',
      title: 'Cover'
    });

    // Pages 1 to 6 from JSON
    const titles = ['About Me', 'Hobbies', 'Skills', 'Projects', 'Fun Facts', 'Contact/Goals'];
    for (let i = 0; i < 6; i++) {
      const pageData = (member.pages && member.pages[i]) ? member.pages[i] : {
        title: titles[i],
        content: `Content for ${titles[i]} will be added soon.`,
        border: 'wavy-pink.svg'
      };
      pageConfigs.push({
        type: 'inside',
        index: i + 1,
        pageData: pageData,
        skills: (i === 2) ? member.skills : null
      });
    }

    // Page 7: Back Cover
    pageConfigs.push({
      type: 'back-cover',
      title: 'Back Cover'
    });

    this.totalPages = pageConfigs.length;

    pageConfigs.forEach((cfg, idx) => {
      const pageEl = document.createElement('div');
      pageEl.className = 'book-page';
      pageEl.dataset.pageIndex = idx;

      let frontHTML = '';
      let backHTML = `
        <div class="backside-pocket-decor">
          <div class="backside-sleeve-seal">📁</div>
          <h4>Clear-Book Sleeve #${idx + 1}</h4>
          <p>Official student submission for <em>Advanced Emerging Technologies</em>.</p>
          <div style="font-size:0.75rem; color:#94A3B8; margin-top:8px;">Turn backward or forward with arrows</div>
        </div>
      `;

      if (cfg.type === 'cover') {
        frontHTML = `
          <div class="book-cover" style="background: linear-gradient(145deg, ${coverColor} 0%, ${this.adjustColorBrightness(coverColor, -35)} 100%);">
            <div class="cover-header">
              <span class="cover-badge">Student Portfolio</span>
              <h1 class="cover-title">PORTFOLIO</h1>
              <div class="cover-subject">${member.subject || 'Advanced Emerging Technologies'}</div>
            </div>

            <div class="cover-photo-wrap" id="coverPhotoWrap">
              <img class="cover-photo-circle" id="coverPhotoImg" src="${member.photo || 'assets/photos/member1.svg'}" alt="${member.name}">
              <span class="photo-easter-hint">✨ Double-click to spin!</span>
            </div>

            <div class="cover-footer">
              <h2 class="cover-name">${member.name}</h2>
              <div class="cover-section">${member.section}</div>
              <div class="cover-tagline">“${member.tagline || 'Emerging technologies, emerging deadlines'}”</div>
            </div>
          </div>
        `;

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
                  window.PortfolioHumor.showToast('🌀 Wheee! Avatar spin easter egg unlocked!');
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

      } else if (cfg.type === 'inside') {
        const borderFile = cfg.pageData.border || 'wavy-pink.svg';
        const borderSrc = `assets/borders/${borderFile}`;

        let extraHTML = '';
        if (cfg.skills && cfg.skills.length > 0) {
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
              <button class="page-action-btn" id="roastMeBtn">
                🔥 Roast Me!
              </button>
              <div class="roast-result-box" id="roastResultBox" style="display:none;"></div>
            </div>
          `;
        }

        if (cfg.index === 6) {
          extraHTML += `
            <div style="margin-top: 14px; text-align: center;">
              <button class="book-guestbook-trigger" id="openGuestbookFromBookBtn">
                ✍️ Leave a Sticky Note for ${member.name.split(' ')[0]}
              </button>
            </div>
          `;
        }

        frontHTML = `
          <div class="page-inner">
            <img class="page-svg-border" src="${borderSrc}" alt="Page Border">
            <div class="page-body-content">
              <span class="page-category-tag">Page ${cfg.index} of 6</span>
              <h3 class="page-title">${cfg.pageData.title}</h3>
              <div class="page-text">${cfg.pageData.content}</div>
              ${extraHTML}
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
              <p class="back-cover-subtitle">(Please Clap 👏)</p>
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

      // Assemble double-sided page with dynamic bending shadow
      pageEl.innerHTML = `
        <div class="page-face page-front">${frontHTML}</div>
        <div class="page-face page-back">${backHTML}</div>
        <div class="page-bend-shadow"></div>
      `;

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

      this.deckElement.appendChild(pageEl);
      this.pagesElements.push(pageEl);

      const dot = document.createElement('div');
      dot.className = 'page-dot';
      dot.title = (idx === 0) ? 'Cover' : (idx === this.totalPages - 1) ? 'Back Cover' : `Page ${idx}`;
      dot.addEventListener('click', () => {
        if (!this.isFlipping) this.goToPage(idx);
      });
      this.dotsContainer.appendChild(dot);
      this.dotsElements.push(dot);
    });
  }

  updatePageStates() {
    this.pagesElements.forEach((pageEl, idx) => {
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

    this.isFlipping = true;
    const flippingPage = this.pagesElements[this.currentPageIndex];
    flippingPage.classList.add('turning');

    if (window.PortfolioHumor && typeof window.PortfolioHumor.playSound === 'function') {
      window.PortfolioHumor.playSound('pageFlipSlow');
    }

    this.currentPageIndex++;
    this.updatePageStates();

    setTimeout(() => {
      flippingPage.classList.remove('turning');
      this.isFlipping = false;
      this.updatePageStates();
    }, 1350); // Matches slow realistic CSS duration
  }

  prevPage() {
    if (this.isFlipping || this.currentPageIndex <= 0) return;

    this.isFlipping = true;
    this.currentPageIndex--;
    const returningPage = this.pagesElements[this.currentPageIndex];
    returningPage.classList.add('turning');

    if (window.PortfolioHumor && typeof window.PortfolioHumor.playSound === 'function') {
      window.PortfolioHumor.playSound('pageFlipSlow');
    }

    this.updatePageStates();

    setTimeout(() => {
      returningPage.classList.remove('turning');
      this.isFlipping = false;
      this.updatePageStates();
    }, 1350);
  }

  goToPage(idx) {
    if (this.isFlipping || idx === this.currentPageIndex || idx < 0 || idx >= this.totalPages) return;
    this.currentPageIndex = idx;
    this.updatePageStates();
    if (window.PortfolioHumor && typeof window.PortfolioHumor.playSound === 'function') {
      window.PortfolioHumor.playSound('pageFlipSlow');
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
