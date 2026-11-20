/**
 * main.js - Application Orchestrator
 * Connects loading screen, Three.js 3D desk, ClearBook engine,
 * REST API client, and humor features into a seamless user journey.
 */

window.AudioMaster = (() => {
  let muted = false;
  const listeners = new Set();
  try { muted = sessionStorage.getItem('gp.muted') === 'true'; } catch {}
  return {
    get muted() { return muted; },
    toggle() {
      muted = !muted;
      try { sessionStorage.setItem('gp.muted', String(muted)); } catch {}
      listeners.forEach(cb => { try { cb(muted); } catch {} });
      return muted;
    },
    onChange(cb) {
      listeners.add(cb);
      try { cb(muted); } catch {}
      return () => listeners.delete(cb);
    }
  };
})();

document.addEventListener('DOMContentLoaded', async () => {
  const classroomRequest = API.getClassroom().then(classroom => {
    Theme.configure(classroom.theme);
    return classroom;
  }).catch(() => classroomDefaults);
  const intro = window.Intro?.start(classroomRequest);
  const themeFonts = Promise.all(['Lilita One', 'Patrick Hand'].map(family =>
    document.fonts.load('16px "' + family + '"').catch(() => {})));
  let members = [];
  let notes = [];
  let currentVisitorCount = 0;
  let deskScene = null;
  let clearBook = null;
  let phone;
  let whiteboard;

  // UI Elements
  const visitorCountBadge = document.getElementById('visitorCountBadge');
  const guestbookModal = document.getElementById('guestbookModal');
  const guestbookForm = document.getElementById('guestbookForm');
  const noteTextInput = document.getElementById('noteTextInput');
  const noteAuthorInput = document.getElementById('noteAuthorInput');
  const charCounter = document.getElementById('charCounter');
  const memberSelectDropdown = document.getElementById('memberSelectDropdown');

  // CRITICAL: Setup navbar button listeners immediately
  // so buttons are clickable during and after loading — not blocked by async await
  setupHeaderControls();
  setupBackNavigation();

  // 1. Fetch Initial Data from Backend
  try {
    const [fetchedMembers, fetchedNotes, visitData] = await Promise.all([
      API.getMembers(),
      API.getAllNotes(),
      API.recordVisit()
    ]);

    members = (fetchedMembers || []).map(m => {
      if (m.id === 4) {
        m.photo = 'assets/photos/nicole-portrait.jpg';
      }
      return m;
    });
    notes = fetchedNotes;
    currentVisitorCount = visitData.count || 1;

    // Display visitor counter joke in top nav
    if (visitorCountBadge) {
      visitorCountBadge.textContent = visitData.message || `Visitor #${currentVisitorCount} • Touch Grass`;
    }

    // Populate guestbook member dropdown
    if (memberSelectDropdown) {
      memberSelectDropdown.innerHTML = '';
      members.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = `${m.name} (${m.section})`;
        memberSelectDropdown.appendChild(opt);
      });
    }

  } catch (err) {
    console.error('Initialization error:', err);
    PortfolioHumor.showToast('⚠️ Could not reach Spring Boot backend. Running in offline fallback mode.');
  }

  // 2. Initialize the optional audio once, before any desk click.
  const classroom = await classroomRequest;
  clearBook = new ClearBook({
    containerId: 'bookOverlayRoot',
    notebookTheme: classroom.audio?.notebookTheme,
    onClose: () => {
      if (deskScene) {
        deskScene.returnToDesk();
      }
    },
    onOpenGuestbook: (memberId) => {
      openGuestbookModal(memberId);
    }
  });

  const idle = window.requestIdleCallback
    ? callback => window.requestIdleCallback(callback, { timeout: 1500 })
    : callback => setTimeout(callback, 30);
  const pendingBooks = members.slice();
  function prepareNextBook() {
    if (!pendingBooks.length) return;
    clearBook.preparePages(pendingBooks.shift());
    if (pendingBooks.length) idle(prepareNextBook);
  }
  idle(prepareNextBook);
  for (const family of ['Gochi Hand', 'Caveat', 'Patrick Hand', 'Dancing Script', 'Plus Jakarta Sans']) {
    document.fonts.load('16px "' + family + '"').catch(() => {});
  }

  // 3. Initialize 3D Desk Scene
  // Resolve the bounded HEAD check before WebGL shader compilation can delay its timeout.
  // This awaits only availability, never audio download or decoding.
  await Promise.all([themeFonts, clearBook.music.prepared]);
  deskScene = new DeskScene({
    classroom,
    inputEnabled: !intro?.active,
    containerId: 'scene-container',
    members: members,
    notes: notes,
    onFolderClick: member => {
      deskScene.experiences?.stopTrack();
      deskScene.experiences?.stopTV();
      clearBook.prepareMusic(member);
    },
    onFolderSelect: member => clearBook.open(member)
  });

  whiteboard=deskScene.whiteboardFace?new WhiteboardDrawing(deskScene):null;
  phone=new PortfolioPhone({
    button:document.getElementById('phoneToggleBtn'),config:classroom.phone||{},
    canOpen:()=>!intro?.active && !deskScene.experiences?.blocking && ['seat','desk'].includes(deskScene.view),
    stopNotebook:()=>{clearBook.music.stop(true);deskScene.experiences?.stopConcert()}
  });
  new ClassroomExperiences(deskScene,{phone,book:clearBook});
  const openBook=clearBook.open.bind(clearBook);
  clearBook.open=(...args)=>{phone.close(true);deskScene.experiences?.stopConcert();return openBook(...args)};
  if(whiteboard){const openBoard=whiteboard.open.bind(whiteboard);whiteboard.open=(...args)=>{phone.close(true);deskScene.experiences?.stopConcert();return openBoard(...args)}}
  intro?.attach(deskScene);

  // 4. Connect Easy Easter Eggs (Keys 'E', 'G', 'F' or Konami) to Desk Anti-Gravity
  PortfolioHumor.initEasterEggs(() => {
    if (deskScene && typeof deskScene.toggleAntiGravity === 'function') {
      deskScene.experiences?.stopConcert();
      deskScene.toggleAntiGravity();
    }
  });

  // 5. Connect Guestbook Form & "sudo" Easter Egg
  setupGuestbook();

  // 6. Wire Note Viewer Modal close buttons
  setupNoteViewerModal();

  /* ========================================================================
     HELPER FUNCTIONS
     ======================================================================== */

  function setupBackNavigation() {
    const button=document.getElementById('deskBackBtn');
    const route=()=>{
      const experiences=deskScene?.experiences;
      const captcha=document.querySelector('.robot-captcha[open]');
      if (captcha) return ['Close robot verification',()=>captcha.close()];
      if (experiences?.dark) return ['Exit Dark mode',()=>experiences.leaveDark()];
      if (experiences?.scrapOpen) return ['Close wrapper',()=>experiences.closeScrap()];
      if (phone?.opened) return [phone.app==='home'?'Close phone':'Back to phone home',()=>phone.goBack()];
      if (guestbookModal.classList.contains('active')) return ['Close guestbook',closeGuestbookModal];
      if (document.querySelector('#laptopErrorModal.active')) return ['Close laptop',()=>PortfolioHumor.closeLaptopError()];
      if (document.querySelector('#noteViewModal.active')) return ['Close note',()=>deskScene.closeNoteViewerModal()];
      if (deskScene?.closePlacard) return ['Close placard',deskScene.closePlacard];
      if (clearBook?.isOpen()) return ['Close portfolio',()=>clearBook.close()];
      if (whiteboard?.opened) return ['Close whiteboard',()=>whiteboard.close()];
      if (experiences?.cameraFocus) {
        return ['Back from '+({labibi:'Labibi',tv:'TV'}[experiences.cameraFocus.type]||'close-up'),
          ()=>experiences.cleaning?experiences.finishCleanup():experiences.releaseFocus()];
      }
      if (experiences?.concertActive||experiences?.concertTransition) return ['Exit performance',()=>experiences.stopConcert()];
      if (deskScene?.view==='desk'&&!deskScene.interactionBlocked()) return ['Back to seat',()=>deskScene.backToSeat()];
      return null;
    };
    const refresh=()=>{
      const target=route();
      const hidden=!target;
      if (button.hidden!==hidden) button.hidden=hidden;
      const label=target?.[0]||'Back';
      if (button.title!==label) {
        button.title=label;
        button.setAttribute('aria-label',label);
      }
    };
    button.addEventListener('click',()=>{route()?.[1]();refresh();});
    button.addEventListener('keydown',event=>{if (event.key!=='Escape') event.stopPropagation();});
    window.addEventListener('keydown',event=>{
      if (event.key!=='Escape') return;
      const target=route();
      if (!target) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      target[1]();refresh();
    },true);
    window.addEventListener('portfolio-navigation',refresh);
    new MutationObserver(refresh).observe(document.body,{
      childList:true,subtree:true,attributes:true,attributeFilter:['class','hidden','open']
    });
    refresh();
  }

  function setupHeaderControls() {
    // 1-Click Easter Egg Zero-G Button
    const easterEggBtn = document.getElementById('easterEggBtn');
    if (easterEggBtn) {
      easterEggBtn.addEventListener('click', () => {
        if (deskScene) {
          deskScene.experiences?.stopConcert();
          deskScene.toggleAntiGravity();
        }
      });
    }

    // Mute Button
    const muteBtn = document.getElementById('muteToggleBtn');
    if (muteBtn) {
      muteBtn.addEventListener('click', () => window.AudioMaster.toggle());
      window.AudioMaster.onChange(muted => {
        muteBtn.setAttribute('aria-pressed', String(muted));
        muteBtn.title = muted ? 'Unmute sound' : 'Mute sound';
        muteBtn.innerHTML = '<svg class="uicon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4Z"/>' +
          (muted ? '<path d="m15 5 7 14"/>' : '<path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>') +
          '</svg><span class="hud-label">Sound</span>';
      });
    }

    const darkModeBtn=document.getElementById('darkModeBtn');
    darkModeBtn?.addEventListener('click',()=>deskScene?.experiences?.enterDark());

    // Floating Dock Guestbook Button
    const openGuestbookNavBtn = document.getElementById('openGuestbookNavBtn');
    if (openGuestbookNavBtn) {
      openGuestbookNavBtn.addEventListener('click', () => {
        openGuestbookModal();
      });
    }
  }

  function openGuestbookModal(memberId = null) {
    if (memberId && memberSelectDropdown) {
      memberSelectDropdown.value = memberId;
    }
    // Show modal: set display first, then add .active next frame for CSS transition to run
    guestbookModal.style.display = 'flex';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        guestbookModal.classList.add('active');
      });
    });
    setTimeout(() => noteTextInput && noteTextInput.focus(), 100);
    PortfolioHumor.playSound('pop');
  }

  function setupNoteViewerModal() {
    const modal = document.getElementById('noteViewModal');
    const closeBtn = document.getElementById('noteViewCloseBtn');
    const returnBtn = document.getElementById('noteViewReturnBtn');

    function closeNote() {
      if (deskScene && typeof deskScene.closeNoteViewerModal === 'function') {
        deskScene.closeNoteViewerModal();
      }
    }

    if (closeBtn) closeBtn.addEventListener('click', closeNote);
    if (returnBtn) returnBtn.addEventListener('click', closeNote);
    document.getElementById('noteViewThrowBtn')?.addEventListener('click', () => {
      deskScene.experiences?.throwNote(deskScene.activeStickyMesh);
    });

    // Click on backdrop (outside card) closes modal
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeNote();
      });
    }

  }

  function closeGuestbookModal() {
    guestbookModal.classList.remove('active');
    // After transition, set display:none to fully remove from layout/accessibility
    guestbookModal.addEventListener('transitionend', () => {
      guestbookModal.style.display = 'none';
    }, { once: true });
    guestbookForm.reset();
    charCounter.textContent = '0 / 120';
  }

  function setupGuestbook() {
    const closeBtn = document.getElementById('guestbookCloseBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', closeGuestbookModal);
    }

    // Character counter
    if (noteTextInput) {
      noteTextInput.addEventListener('input', () => {
        const len = noteTextInput.value.length;
        charCounter.textContent = `${len} / 120`;
        if (len > 120) {
          charCounter.style.color = '#EF4444';
        } else {
          charCounter.style.color = '#6B7280';
        }
      });
    }

    // Form submission
    if (guestbookForm) {
      guestbookForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const rawText = noteTextInput.value.trim();
        const rawAuthor = noteAuthorInput.value.trim() || 'Anonymous';
        const memberId = parseInt(memberSelectDropdown.value) || 1;

        // Easter Egg: Check for "sudo"
        if (rawText.toLowerCase().startsWith('sudo') || rawAuthor.toLowerCase() === 'sudo') {
          PortfolioHumor.playSound('error');
          PortfolioHumor.showToast('🔒 Nice try. You do not have sudo privileges on this portfolio.');
          return;
        }

        if (!rawText) {
          PortfolioHumor.showToast('⚠️ Note cannot be empty!');
          return;
        }

        if (rawText.length > 120) {
          PortfolioHumor.showToast('⚠️ Note exceeds 120 characters limit!');
          return;
        }

        try {
          const createdNote = await API.postNote(memberId, rawText, rawAuthor);
          PortfolioHumor.playSound('pop');
          closeGuestbookModal();
          PortfolioHumor.showToast('✨ Sticky note posted! It landed on the 3D desk.');

          // Instantly place sticky note on 3D desk without page reload!
          if (deskScene && typeof deskScene.addStickyNoteToDesk === 'function') {
            const slot = Math.floor(Math.random() * 5);
            deskScene.addStickyNoteToDesk(createdNote, slot);
          }
        } catch (err) {
          PortfolioHumor.showToast(`⚠️ ${err.message}`);
        }
      });
    }
  }
});
