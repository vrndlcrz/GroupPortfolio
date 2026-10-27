/**
 * main.js - Application Orchestrator
 * Connects loading screen, Three.js 3D desk, ClearBook engine,
 * REST API client, and humor features into a seamless user journey.
 */

document.addEventListener('DOMContentLoaded', async () => {
  let members = [];
  let notes = [];
  let currentVisitorCount = 0;
  let deskScene = null;
  let clearBook = null;
  let activeMemberIdForNote = 1;

  // UI Elements
  const loadingScreen = document.getElementById('loadingScreen');
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

  // 1. Fetch Initial Data from Backend
  try {
    const [fetchedMembers, fetchedNotes, visitData] = await Promise.all([
      API.getMembers(),
      API.getAllNotes(),
      API.recordVisit()
    ]);

    members = fetchedMembers;
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

  // 2. Initialize ClearBook Engine
  clearBook = new ClearBook({
    containerId: 'bookOverlayRoot',
    onClose: () => {
      if (deskScene) {
        deskScene.returnToDesk();
      }
    },
    onOpenGuestbook: (memberId) => {
      openGuestbookModal(memberId);
    }
  });

  // 3. Initialize 3D Desk Scene
  deskScene = new DeskScene({
    containerId: 'scene-container',
    members: members,
    notes: notes,
    onFolderSelect: async (member) => {
      try {
        // Fetch fresh member details from /api/members/{id}
        const fullMember = await API.getMember(member.id);
        clearBook.open(fullMember);
      } catch (e) {
        clearBook.open(member);
      }
    }
  });

  // 4. Connect Easy Easter Eggs (Keys 'E', 'G', 'F' or Konami) to Desk Anti-Gravity
  PortfolioHumor.initEasterEggs(() => {
    if (deskScene && typeof deskScene.toggleAntiGravity === 'function') {
      deskScene.toggleAntiGravity();
    }
  });

  // 5. Connect Guestbook Form & "sudo" Easter Egg
  setupGuestbook();

  // 6. Wire Note Viewer Modal close buttons
  setupNoteViewerModal();

  // 7. Complete Eye-Blink Loading Screen after 3 blinks (2100ms)
  setTimeout(() => {
    finishLoading();
  }, 2100);

  /* ========================================================================
     HELPER FUNCTIONS
     ======================================================================== */

  function finishLoading() {
    if (loadingScreen) {
      loadingScreen.classList.add('done');
      loadingScreen.style.display = 'none';
      loadingScreen.style.pointerEvents = 'none';
    }
    PortfolioHumor.playSound('pop');
  }

  function setupHeaderControls() {
    // 1-Click Easter Egg Zero-G Button
    const easterEggBtn = document.getElementById('easterEggBtn');
    if (easterEggBtn) {
      easterEggBtn.addEventListener('click', () => {
        if (deskScene) {
          deskScene.toggleAntiGravity();
        }
      });
    }

    // Mute Button
    const muteBtn = document.getElementById('muteToggleBtn');
    if (muteBtn) {
      muteBtn.addEventListener('click', () => {
        PortfolioHumor.toggleMute();
      });
    }

    // Terms & Conditions button
    const termsBtn = document.getElementById('termsBtn');
    if (termsBtn) {
      termsBtn.addEventListener('click', () => {
        PortfolioHumor.showTermsJokeModal();
      });
    }

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
      activeMemberIdForNote = memberId;
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

    // Click on backdrop (outside card) closes modal
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeNote();
      });
    }

    // Escape key closes modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal && modal.classList.contains('active')) {
        closeNote();
      }
    });
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
