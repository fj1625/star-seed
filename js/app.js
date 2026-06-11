/**
 * Star Seed - Main App Controller
 * Scene management, initialization, and coordination
 */
const App = (() => {
  let episodeData = null;
  let currentScene = 'intro';
  let currentEpisodeId = 'ep01';
  let episodeList = [];
  let activeEngine = null;

  // Scene sections in DOM
  const scenes = [
    'intro', 'day1', 'day2', 'day3', 'day4', 'day5', 'complete'
  ];

  /** Available episodes (discovered at init time) */
  async function discoverEpisodes() {
    // Try to load episode list — in production, scan known episodes
    const known = [
      { id: 'ep01', title: 'My Home', emoji: '🏠', dataUrl: 'data/ep01-home.json' },
      { id: 'ep02', title: 'Animals', emoji: '🐾', dataUrl: 'data/episodes/ep02-animals.json' }
    ];
    // Verify which ones exist
    const available = [];
    for (const ep of known) {
      try {
        const resp = await fetch(ep.dataUrl, { method: 'HEAD' });
        if (resp.ok || resp.status === 0) {
          available.push(ep);
        }
      } catch (e) {
        // If HEAD fails, assume it exists (CORS/static server may not support HEAD)
        available.push(ep);
      }
    }
    return available.length > 0 ? available : known;
  }

  /** Initialize the entire app */
  async function init() {
    // Init core systems
    Storage.load();
    Audio.init();
    VoiceInput.init();

    // Discover available episodes
    episodeList = await discoverEpisodes();

    // Determine which episode to load
    const state = Storage.getState();
    currentEpisodeId = state.episodeId || 'ep01';

    // If saved episode not in list, use first available
    const found = episodeList.find(ep => ep.id === currentEpisodeId);
    if (!found) currentEpisodeId = episodeList[0].id;

    // Load episode data
    await loadEpisode(currentEpisodeId);

    // Migration: if all 5 days completed but episode not marked complete, fix it
    const stAfterLoad = Storage.getState();
    if (stAfterLoad.completedDays.length >= 5
        && !stAfterLoad.completedEpisodes.includes(stAfterLoad.episodeId || 'ep01')) {
      Storage.markEpisodeComplete(stAfterLoad.episodeId || 'ep01');
    }

    // Init Twinkle
    const twinkleEl = document.getElementById('twinkle-character');
    Twinkle.init(twinkleEl);

    // Update status bar
    updateStatusBar();

    // Init engines
    initAllEngines();

    // Bind UI
    bindNavigation();
    bindIntroButtons();
    bindRestartButton();
    bindEpisodeSelector();

    // Always show intro first
    showScene('intro');
    updateIntroForEpisode();

    // If there's saved progress, show continue button
    if (state.completedDays.length > 0 && state.episodeId === currentEpisodeId) {
      showContinueOption(state);
    }

    // Show/hide reset link
    const resetNote = document.getElementById('intro-reset-note');
    if (resetNote) {
      resetNote.style.display = state.completedDays.length > 0 ? 'block' : 'none';
    }

    // Update day selector grid
    updateIntroDaySelect(state);

    // Greeting is now triggered by the "Listen to the Story" button
    // (iOS Safari requires user gesture before Web Speech API can play)
  }

  /** Load episode data from JSON */
  async function loadEpisode(episodeId) {
    const ep = episodeList.find(e => e.id === episodeId);
    const url = ep ? ep.dataUrl : `data/episodes/${episodeId}.json`;

    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      episodeData = await resp.json();
      currentEpisodeId = episodeId;

      // Store in state
      const state = Storage.getState();
      state.episodeId = episodeId;
      Storage.save();

      return true;
    } catch (e) {
      console.error('Failed to load episode data:', url, e);
      // Fallback: try ep01
      if (episodeId !== 'ep01') {
        console.warn('Falling back to ep01');
        return loadEpisode('ep01');
      }
      showError('Could not load game data. Please check your connection.');
      return false;
    }
  }

  /** Switch to a different episode */
  async function switchEpisode(episodeId) {
    if (episodeId === currentEpisodeId) return;

    Audio.cancel();

    const loaded = await loadEpisode(episodeId);
    if (!loaded) return;

    // Reset day progress for the new episode (but keep playerName)
    const state = Storage.getState();
    const playerName = state.playerName;
    Storage.resetEpisodeProgress();
    if (playerName) {
      state.playerName = playerName;
      Storage.save();
    }

    initAllEngines();
    showScene('intro');
    updateIntroForEpisode();
    updateIntroDaySelect(Storage.getState());

    const continueEl = document.getElementById('intro-continue');
    if (continueEl) continueEl.style.display = 'none';
    const resetNote = document.getElementById('intro-reset-note');
    if (resetNote) resetNote.style.display = 'none';

    Twinkle.syncFromStorage();
    updateStatusBar();

    Audio.speak(`Welcome to Week ${episodeData.week}: ${episodeData.title}!`, { rate: 0.9 });
  }

  /** Initialize all engines with current episode data */
  function initAllEngines() {
    if (typeof EngineLight !== 'undefined') EngineLight.init(episodeData);
    if (typeof EngineColor !== 'undefined') EngineColor.init(episodeData);
    if (typeof EngineSound !== 'undefined') EngineSound.init(episodeData);
    if (typeof EngineMotion !== 'undefined') EngineMotion.init(episodeData);
    if (typeof EngineHeart !== 'undefined') EngineHeart.init(episodeData);
  }

  /** Update intro scene for current episode */
  function updateIntroForEpisode() {
    if (!episodeData) return;

    // Update title and subtitle
    const subtitle = document.querySelector('.intro-subtitle');
    if (subtitle) {
      subtitle.textContent = `Week ${episodeData.week}: ${episodeData.title}`;
    }

    // Update story text based on episode
    const story = document.querySelector('.intro-story');
    if (story) {
      const weekStories = {
        1: `
          <p>A tiny star seed fell from the sky...</p>
          <p>Its name is <strong>Twinkle</strong>.</p>
          <p>Twinkle lost its 5 magic powers!</p>
          <p>Can you find them all?</p>
        `,
        2: `
          <p>Twinkle needs your help again!</p>
          <p>The <strong>zoo animals</strong> are missing!</p>
          <p>Can you find them and bring them home?</p>
          <p>New animal friends are waiting for you!</p>
        `
      };
      story.innerHTML = weekStories[episodeData.week] || weekStories[1];
    }

    // Update parent note link
    const parentNote = document.querySelector('.intro-parent-note a');
    if (parentNote) {
      parentNote.href = `printable/ep${episodeData.episodeId.replace('ep', '')}-printable.html`;
    }

    // Update footer
    const footer = document.querySelector('.footer-text');
    if (footer) {
      footer.textContent = `The Star Seed · Week ${episodeData.week}: ${episodeData.title}`;
    }

    // Update day tabs with episode-specific emojis
    updateDayTabsForEpisode();

    // Intro story speech is triggered by user click (iOS requires user gesture for audio)
    // bindIntroButtons() wires up the #btn-listen-story button
  }

  /** Update day navigation tabs with current episode info */
  function updateDayTabsForEpisode() {
    if (!episodeData) return;
    for (let d = 1; d <= 5; d++) {
      const dayData = episodeData.days[String(d)];
      if (!dayData) continue;
      const tab = document.getElementById(`day-tab-${d}`);
      if (tab) {
        const shortTitle = dayData.title.length > 14
          ? dayData.title.substring(0, 12) + '…'
          : dayData.title;
        tab.textContent = `Day ${d} ${dayData.powerEmoji}`;
        tab.title = `${dayData.power} Power: ${dayData.title}`;
      }
    }
  }

  /** Bind episode selector buttons */
  function bindEpisodeSelector() {
    const selector = document.getElementById('episode-selector');
    if (!selector) return;

    selector.innerHTML = episodeList.map(ep => {
      const isActive = ep.id === currentEpisodeId;
      const isEp01 = ep.id === 'ep01';
      // ep01 is always unlocked; ep02 requires ep01 completion or secret unlock
      const epState = Storage.getState();
      const unlocked = isEp01
        || epState.completedEpisodes.includes('ep01')
        || epState.completedEpisodes.includes(ep.id);
      const lockedClass = (!unlocked && !isEp01) ? 'locked' : '';
      const activeClass = isActive ? 'active' : '';

      return `
        <button class="episode-btn ${activeClass} ${lockedClass}"
                data-episode="${ep.id}"
                ${(!unlocked && !isEp01) ? 'disabled' : ''}>
          <span class="episode-btn-emoji">${ep.emoji}</span>
          <span class="episode-btn-label">${ep.title}</span>
          ${isActive ? '<span class="episode-btn-check">●</span>' : ''}
        </button>
      `;
    }).join('');

    // Bind click handlers
    selector.querySelectorAll('.episode-btn:not([disabled])').forEach(btn => {
      btn.addEventListener('click', async () => {
        const epId = btn.dataset.episode;
        if (epId !== currentEpisodeId) {
          await switchEpisode(epId);
        }
      });
    });

    // Locked episodes show shake on tap
    selector.querySelectorAll('.episode-btn[disabled]').forEach(btn => {
      btn.addEventListener('click', () => {
        btn.classList.add('shake');
        setTimeout(() => btn.classList.remove('shake'), 500);
        Audio.speak('Complete Week 1 first to unlock!', { rate: 0.9 });
      });
    });
  }

  /** Show a specific scene, hide others */
  function showScene(name) {
    // Stop active engine when leaving a day scene
    if (activeEngine && activeEngine.stop && currentScene !== name && currentScene.startsWith('day')) {
      activeEngine.stop();
      activeEngine = null;
    }
    scenes.forEach(s => {
      const el = document.getElementById(s);
      if (el) el.style.display = 'none';
    });
    const target = document.getElementById(name);
    if (target) {
      target.style.display = 'flex';
      currentScene = name;
    }

    // Scroll to top
    window.scrollTo(0, 0);

    // Update day indicators
    updateDayIndicator(name);
  }

  /** Navigate to a day scene */
  function goToDay(day) {
    if (day >= 1 && day <= 5) {
      if (Storage.isDayUnlocked(day) || Storage.isDayCompleted(day)) {
        // Stop any running engine before switching
        if (activeEngine && activeEngine.stop) {
          activeEngine.stop();
        }
        showScene(`day${day}`);
        // Init the engine for this day
        const engineMap = {
          1: EngineLight,
          2: EngineColor,
          3: EngineSound,
          4: EngineMotion,
          5: EngineHeart
        };
        activeEngine = engineMap[day] || null;
        if (activeEngine && activeEngine.start) {
          activeEngine.start();
        }
      }
    }
  }

  /** Called by engines when a day is completed */
  function onDayComplete(day) {
    const isNew = Storage.completeDay(day);

    // Add power
    const powerMap = { 1: 'light', 2: 'color', 3: 'sound', 4: 'motion', 5: 'heart' };
    if (powerMap[day]) {
      Twinkle.addPower(powerMap[day]);
    }

    updateStatusBar();

    // Check if all days complete → mark episode complete
    const state = Storage.getState();
    if (state.completedDays.length >= 5) {
      Storage.markEpisodeComplete(currentEpisodeId);
      // Unlock next episode
      bindEpisodeSelector();
    }

    // Show completion overlay
    const dayData = episodeData.days[String(day)];
    showDayCompleteOverlay(day, dayData, isNew);
  }

  /** Show the "Day Complete" overlay */
  function showDayCompleteOverlay(day, dayData, isNew) {
    const overlay = document.getElementById('day-complete-overlay');
    const powerEl = document.getElementById('complete-power');
    const titleEl = document.getElementById('complete-title');
    const textEl = document.getElementById('complete-text');
    const nextBtn = document.getElementById('btn-next-day');
    const homeBtn = document.getElementById('btn-go-home');

    if (!overlay) return;

    powerEl.textContent = dayData.powerEmoji + ' ' + dayData.power + ' Power!';
    titleEl.textContent = `Day ${day} Complete!`;
    textEl.textContent = dayData.completionText;

    Audio.cancel();
    setTimeout(() => {
      Audio.speak(dayData.completionText, { rate: 0.9 });
    }, 300);

    // Next day button
    if (day < 5) {
      nextBtn.style.display = 'block';
      nextBtn.textContent = `Day ${day + 1} →`;
      nextBtn.onclick = () => {
        overlay.style.display = 'none';
        showScene(`day${day + 1}`);
        const nextEngineMap = {
          2: EngineColor,
          3: EngineSound,
          4: EngineMotion,
          5: EngineHeart
        };
        activeEngine = nextEngineMap[day + 1] || null;
        if (activeEngine && activeEngine.start) activeEngine.start();
      };
    } else {
      nextBtn.style.display = 'block';
      nextBtn.textContent = 'See Your Certificate! 🏆';
      nextBtn.onclick = () => {
        overlay.style.display = 'none';
        showScene('complete');
        EngineHeart && EngineHeart.showCertificate();
      };
    }

    homeBtn.onclick = () => {
      overlay.style.display = 'none';
    };

    overlay.style.display = 'flex';
    overlay.setAttribute('aria-hidden', 'false');
    // Focus the primary button for keyboard users
    if (nextBtn && nextBtn.style.display !== 'none') nextBtn.focus();

    // Escape to close
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        overlay.style.display = 'none';
        overlay.setAttribute('aria-hidden', 'true');
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);

    // Clean up handler when buttons are clicked
    const cleanupEsc = () => document.removeEventListener('keydown', escHandler);
    const origNext = nextBtn.onclick;
    nextBtn.onclick = () => { cleanupEsc(); overlay.setAttribute('aria-hidden', 'true'); if (origNext) origNext(); };
    const origHome = homeBtn.onclick;
    homeBtn.onclick = () => { cleanupEsc(); overlay.setAttribute('aria-hidden', 'true'); if (origHome) origHome(); };
  }

  /** Update the top status bar */
  function updateStatusBar() {
    const state = Storage.getState();
    const powers = state.twinklePowers;

    // Update 5 power dots
    for (let i = 0; i < 5; i++) {
      const dot = document.getElementById(`power-dot-${i + 1}`);
      if (dot) {
        if (i < powers.length) {
          dot.classList.add('active');
          const icons = ['🔆', '🌈', '🎵', '💫', '❤️'];
          dot.textContent = icons[i];
        } else {
          dot.classList.remove('active');
          dot.textContent = '○';
        }
      }
    }

    // Update Twinkle status text
    const statusEl = document.getElementById('twinkle-status');
    if (statusEl) {
      statusEl.textContent = Twinkle.getStatusText();
    }
  }

  /** Update day navigation indicator */
  function updateDayIndicator(scene) {
    const dayMatch = scene.match(/day(\d)/);
    const activeDay = dayMatch ? parseInt(dayMatch[1]) : null;

    for (let i = 1; i <= 5; i++) {
      const tab = document.getElementById(`day-tab-${i}`);
      if (!tab) continue;

      tab.classList.remove('active', 'completed', 'locked');

      if (Storage.isDayCompleted(i)) {
        tab.classList.add('completed');
      } else if (i === activeDay) {
        tab.classList.add('active');
      } else if (!Storage.isDayUnlocked(i)) {
        tab.classList.add('locked');
      }
    }
  }

  /** Bind day tab navigation */
  function bindNavigation() {
    for (let i = 1; i <= 5; i++) {
      const tab = document.getElementById(`day-tab-${i}`);
      if (tab) {
        tab.addEventListener('click', () => {
          if (Storage.isDayUnlocked(i) || Storage.isDayCompleted(i)) {
            goToDay(i);
          } else {
            // Wiggle locked tab
            tab.classList.add('shake');
            setTimeout(() => tab.classList.remove('shake'), 500);
            Audio.speak('Finish the current day first!', { rate: 0.9 });
          }
        });
      }
    }

    // Start button on intro
    const startBtn = document.getElementById('btn-start');
    if (startBtn) {
      startBtn.addEventListener('click', () => {
        goToDay(1);
      });
    }
  }

  /** Bind restart button (hold 3 seconds) */
  function bindRestartButton() {
    const btn = document.getElementById('btn-restart');
    if (!btn) return;

    let holdTimer = null;

    btn.addEventListener('pointerdown', () => {
      holdTimer = setTimeout(() => {
        if (confirm('Reset ALL progress? This cannot be undone!')) {
          Storage.resetAll();
          Twinkle.syncFromStorage();
          updateStatusBar();
          // Hide continue & reset link
          const cont = document.getElementById('intro-continue');
          const rn = document.getElementById('intro-reset-note');
          if (cont) cont.style.display = 'none';
          if (rn) rn.style.display = 'none';
          updateIntroDaySelect(Storage.getState());
          showScene('intro');
          Audio.speak('Welcome back, Star Guardian!', { rate: 0.9 });
        }
      }, 3000);
    });

    btn.addEventListener('pointerup', () => {
      clearTimeout(holdTimer);
    });
    btn.addEventListener('pointerleave', () => {
      clearTimeout(holdTimer);
    });
  }

  /** Bind intro scene buttons: continue, day select, reset link, secret unlock */
  function bindIntroButtons() {
    // Continue button
    const continueBtn = document.getElementById('btn-continue');
    if (continueBtn) {
      continueBtn.addEventListener('click', () => {
        const state = Storage.getState();
        goToDay(state.currentDay);
      });
    }

    // Listen to story button (iOS requires user gesture for speech)
    const listenBtn = document.getElementById('btn-listen-story');
    if (listenBtn) {
      listenBtn.addEventListener('click', () => {
        const week = episodeData?.week || 1;
        const storyText = week === 2
          ? 'Twinkle needs your help again! The zoo animals are missing! Can you find them and bring them home?'
          : 'A tiny star seed fell from the sky. Its name is Twinkle. Twinkle lost its 5 magic powers! Can you find them all?';
        Audio.speak('The Star Seed. ' + storyText, { rate: 0.85, cancelPrevious: true });
      });
    }

    // Day selector buttons in intro
    const dayGrid = document.getElementById('intro-day-grid');
    if (dayGrid) {
      dayGrid.querySelectorAll('.intro-day-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const day = parseInt(btn.dataset.day);
          if (Storage.isDayUnlocked(day) || Storage.isDayCompleted(day)) {
            goToDay(day);
          } else {
            btn.classList.add('shake');
            setTimeout(() => btn.classList.remove('shake'), 500);
            Audio.speak('Finish the previous days first!', { rate: 0.9 });
          }
        });
      });
    }

    // Reset link on intro page
    const resetLink = document.getElementById('intro-reset-link');
    if (resetLink) {
      resetLink.addEventListener('click', (e) => {
        e.preventDefault();
        if (confirm('Reset ALL progress? This cannot be undone!')) {
          Storage.resetAll();
          Twinkle.syncFromStorage();
          updateStatusBar();
          // Hide continue, reset link, update day selector
          const cont = document.getElementById('intro-continue');
          const rn = document.getElementById('intro-reset-note');
          if (cont) cont.style.display = 'none';
          if (rn) rn.style.display = 'none';
          updateIntroDaySelect(Storage.getState());
          Audio.speak('All progress reset. Let\'s start again!', { rate: 0.9 });
        }
      });
    }

    // Secret unlock: 5 rapid taps on big Twinkle unlocks ALL days
    const bigTwinkle = document.querySelector('.intro-twinkle-big');
    if (bigTwinkle) {
      let tapCount = 0;
      let tapTimer = null;
      bigTwinkle.addEventListener('click', () => {
        tapCount++;
        if (tapTimer) clearTimeout(tapTimer);
        if (tapCount >= 5) {
          tapCount = 0;
          // Unlock all days by simulating completion
          const st = Storage.getState();
          for (let d = 1; d <= 5; d++) {
            if (!st.completedDays.includes(d)) {
              st.completedDays.push(d);
            }
          }
          st.currentDay = 5;
          // Also unlock all episodes
          if (!st.completedEpisodes.includes('ep01')) {
            st.completedEpisodes.push('ep01');
          }
          if (!st.completedEpisodes.includes('ep02')) {
            st.completedEpisodes.push('ep02');
          }
          Storage.save();
          Twinkle.syncFromStorage();
          updateStatusBar();
          updateIntroDaySelect(Storage.getState());
          bindEpisodeSelector();
          // Show continue button too
          showContinueOption(Storage.getState());
          const rn = document.getElementById('intro-reset-note');
          if (rn) rn.style.display = 'block';
          Audio.speak('All days and episodes unlocked! You can play anything now.', { rate: 0.9 });
        } else {
          tapTimer = setTimeout(() => { tapCount = 0; }, 800);
        }
      });
    }
  }

  /** Show the "Continue from Day X" option on intro */
  function showContinueOption(state) {
    const cont = document.getElementById('intro-continue');
    const daySpan = document.getElementById('continue-day');
    if (cont) cont.style.display = 'block';
    if (daySpan) daySpan.textContent = state.currentDay;
  }

  /** Update day selector buttons on intro based on progress */
  function updateIntroDaySelect(state) {
    const dayGrid = document.getElementById('intro-day-grid');
    if (!dayGrid) return;

    const buttons = dayGrid.querySelectorAll('.intro-day-btn');
    buttons.forEach(btn => {
      const day = parseInt(btn.dataset.day);
      btn.classList.remove('locked', 'completed', 'unlocked');

      if (state.completedDays.includes(day)) {
        btn.classList.add('completed');
        btn.disabled = false;
      } else if (Storage.isDayUnlocked(day)) {
        btn.classList.add('unlocked');
        btn.disabled = false;
      } else {
        btn.classList.add('locked');
        btn.disabled = true;
      }
    });
  }

  /** Show error state */
  function showError(msg) {
    const el = document.getElementById('app-error');
    if (el) {
      el.textContent = msg;
      el.style.display = 'block';
    }
  }

  /** Get episode data */
  function getEpisodeData() {
    return episodeData;
  }

  return {
    init, showScene, goToDay, onDayComplete,
    updateStatusBar, getEpisodeData,
    updateIntroDaySelect, showContinueOption,
    switchEpisode, getCurrentEpisodeId: () => currentEpisodeId
  };
})();

// Boot when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
