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

  // Optional standalone config set by sibling pages (e.g. week2.html)
  const standalone = window.STAR_SEED_STANDALONE || null;

  // Scene sections in DOM
  const scenes = [
    'intro', 'day1', 'day2', 'day3', 'day4', 'day5', 'complete'
  ];

  /** Available episodes (discovered at init time) */
  async function discoverEpisodes() {
    // Try to load episode list — in production, scan known episodes
    const known = [
      { id: 'ep01', title: 'My Home', emoji: '🏠', dataUrl: 'data/ep01-home.json' },
      { id: 'ep02', title: 'Animals', emoji: '🐾', dataUrl: 'data/episodes/ep02-animals.json' },
      { id: 'week1-outdoor', title: 'Week 1 Outdoor', emoji: '🌿', dataUrl: 'data/week1-outdoor.json', hidden: true }
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

    let state = Storage.getState();

    if (standalone) {
      // Standalone page: load the configured episode directly
      currentEpisodeId = standalone.episodeId;
    } else {
      // Discover available episodes
      episodeList = await discoverEpisodes();

      // Determine which episode to load
      currentEpisodeId = state.episodeId || 'ep01';

      // If saved episode not in list, use first available
      const found = episodeList.find(ep => ep.id === currentEpisodeId);
      if (!found) currentEpisodeId = episodeList[0].id;
    }

    // Load episode data
    await loadEpisode(currentEpisodeId);

    // Reload state in case loadEpisode updated episodeId
    state = Storage.getState();

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
    bindTreasureButton();
    updateTreasureButton();
    if (!standalone) bindEpisodeSelector();

    // Bind outdoor entry (secret button in footer)
    if (!standalone) bindOutdoorEntry();

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
    let url;
    const ep = episodeList.find(e => e.id === episodeId);
    if (ep) {
      url = ep.dataUrl;
    } else if (standalone && standalone.episodeId === episodeId) {
      url = standalone.dataUrl;
    } else {
      url = `data/episodes/${episodeId}.json`;
    }

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
      // Fallback: try ep01 (skip fallback in standalone mode to surface errors clearly)
      if (!standalone && episodeId !== 'ep01') {
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
    bindEpisodeSelector();

    const continueEl = document.getElementById('intro-continue');
    if (continueEl) continueEl.style.display = 'none';
    const resetNote = document.getElementById('intro-reset-note');
    if (resetNote) resetNote.style.display = 'none';

    Twinkle.syncFromStorage();
    updateStatusBar();

    const welcomeText = episodeData.week
      ? `Welcome to Week ${episodeData.week}: ${episodeData.title}!`
      : `Welcome to ${episodeData.title}!`;
    Audio.speak(welcomeText, { rate: 0.9 });
  }

  /** Initialize all engines with current episode data */
  function initAllEngines() {
    const engines = [
      { name: 'EngineLight', fn: typeof EngineLight !== 'undefined' ? EngineLight.init : null },
      { name: 'EnginePattern', fn: typeof EnginePattern !== 'undefined' ? EnginePattern.init : null },
      { name: 'EngineRhythm', fn: typeof EngineRhythm !== 'undefined' ? EngineRhythm.init : null },
      { name: 'EngineMotion', fn: typeof EngineMotion !== 'undefined' ? EngineMotion.init : null },
      { name: 'EngineHeart', fn: typeof EngineHeart !== 'undefined' ? EngineHeart.init : null },
      { name: 'EngineColor', fn: typeof EngineColor !== 'undefined' ? EngineColor.init : null },
      { name: 'EngineSound', fn: typeof EngineSound !== 'undefined' ? EngineSound.init : null }
    ];

    for (const engine of engines) {
      if (!engine.fn) continue;
      try {
        engine.fn(episodeData);
      } catch (e) {
        console.error(`[App] Engine ${engine.name} init failed:`, e);
      }
    }
  }

  /** Update intro scene for current episode */
  function updateIntroForEpisode() {
    if (!episodeData) return;

    // Update title and subtitle
    const subtitle = document.querySelector('.intro-subtitle');
    if (subtitle) {
      subtitle.textContent = episodeData.week
        ? `Week ${episodeData.week}: ${episodeData.title}`
        : episodeData.title;
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
        `,
        0: `
          <p>Twinkle is ready for the <strong>Week 1 Outdoor</strong> adventure!</p>
          <p>Let's explore <strong>nature</strong> together!</p>
          <p>Find treasures, mix colors, hear wild sounds,</p>
          <p>and move like animals in the wild!</p>
        `
      };
      story.innerHTML = weekStories[episodeData.week] || weekStories[1];
    }

    // Update parent note link
    const parentNote = document.querySelector('.intro-parent-note a');
    if (parentNote) {
      const epMatch = episodeData.episodeId.match(/^ep(\d+)$/);
      const printableName = epMatch ? `ep${epMatch[1]}-printable` : `${episodeData.episodeId}-printable`;
      parentNote.href = `printable/${printableName}.html`;
    }

    // Update footer
    const footer = document.querySelector('.footer-text');
    if (footer) {
      footer.textContent = episodeData.week
        ? `The Star Seed · Week ${episodeData.week}: ${episodeData.title}`
        : `The Star Seed · ${episodeData.title}`;
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
        const label = dayData.tabLabel || `Day ${d}`;
        tab.textContent = `${label} ${dayData.powerEmoji}`;
        tab.title = `${dayData.power} Power: ${dayData.title}`;
      }
    }
  }

  /** Bind episode selector buttons */
  function bindEpisodeSelector() {
    const selector = document.getElementById('episode-selector');
    if (!selector) return;

    // Show non-hidden episodes, plus current if hidden
    let displayEpisodes = episodeList.filter(ep => !ep.hidden);
    if (currentEpisodeId && !displayEpisodes.find(ep => ep.id === currentEpisodeId)) {
      const current = episodeList.find(ep => ep.id === currentEpisodeId);
      if (current) displayEpisodes.push(current);
    }

    selector.innerHTML = displayEpisodes.map(ep => {
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

  /** Bind outdoor entry button + password modal */
  function bindOutdoorEntry() {
    const modal = document.getElementById('outdoor-modal');
    const codeInput = document.getElementById('outdoor-code-input');
    const unlockBtn = document.getElementById('btn-outdoor-unlock');
    const cancelBtn = document.getElementById('btn-outdoor-cancel');
    const hintEl = document.getElementById('outdoor-unlock-hint');

    if (!modal) return;

    const showModal = () => {
      modal.style.display = 'flex';
      modal.setAttribute('aria-hidden', 'false');
      if (codeInput) { codeInput.value = ''; codeInput.focus(); }
      if (hintEl) hintEl.style.display = 'none';
    };

    // Footer button
    const footerBtn = document.getElementById('btn-outdoor-entry');
    if (footerBtn) {
      footerBtn.addEventListener('click', showModal);
    }

    // Intro page button
    const introBtn = document.getElementById('btn-outdoor-intro');
    if (introBtn) {
      introBtn.addEventListener('click', showModal);
    }

    // Close modal
    const closeModal = () => {
      modal.style.display = 'none';
      modal.setAttribute('aria-hidden', 'true');
    };

    // Escape to close
    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });

    if (cancelBtn) {
      cancelBtn.addEventListener('click', closeModal);
    }

    // Unlock logic
    const tryUnlock = async () => {
      const val = codeInput ? codeInput.value.trim() : '';
      if (val === '1801') {
        closeModal();
        // Switch to outdoor episode
        // Make sure it's in the episode list for loading
        const found = episodeList.find(ep => ep.id === 'week1-outdoor');
        if (!found) {
          episodeList.push({ id: 'week1-outdoor', title: 'Week 1 Outdoor', emoji: '🌿', dataUrl: 'data/week1-outdoor.json', hidden: true });
        }
        await switchEpisode('week1-outdoor');
      } else {
        if (hintEl) hintEl.style.display = 'block';
        if (codeInput) { codeInput.value = ''; codeInput.focus(); }
      }
    };

    if (unlockBtn) {
      unlockBtn.addEventListener('click', tryUnlock);
    }
    if (codeInput) {
      codeInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') tryUnlock();
      });
    }
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

  /** Pick the right engine for a day based on the loaded episode data */
  function getEngineForDay(day) {
    const dayData = episodeData && episodeData.days && episodeData.days[String(day)];
    if (!dayData) return null;
    switch (day) {
      case 1: return EngineLight;
      case 2:
        if (dayData.colors) return EngineColor;
        if (dayData.patternAnimals || dayData.patterns) return EnginePattern;
        return EngineColor;
      case 3:
        if (dayData.choirAnimals && dayData.rounds) return EngineRhythm;
        return EngineSound;
      case 4: return EngineMotion;
      case 5: return EngineHeart;
      default: return null;
    }
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
        activeEngine = getEngineForDay(day);
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

    // Grant daily gift, check achievements, possibly grant episode trophy
    const rewardResult = typeof Achievements !== 'undefined'
      ? Achievements.onDayComplete(day, currentEpisodeId, episodeData)
      : { reward: null, newAchievements: [], trophy: null };

    if (rewardResult.reward) {
      Twinkle.giveGift(rewardResult.reward.emoji);
    }
    updateTreasureButton();

    // Show completion overlay
    const dayData = episodeData.days[String(day)];
    showDayCompleteOverlay(day, dayData, isNew, rewardResult);
  }

  /** Show the "Day Complete" overlay */
  function showDayCompleteOverlay(day, dayData, isNew, rewardResult) {
    const overlay = document.getElementById('day-complete-overlay');
    const powerEl = document.getElementById('complete-power');
    const titleEl = document.getElementById('complete-title');
    const textEl = document.getElementById('complete-text');
    const rewardEl = document.getElementById('day-reward');
    const nextBtn = document.getElementById('btn-next-day');
    const homeBtn = document.getElementById('btn-go-home');

    if (!overlay) return;

    const dayLabel = dayData.tabLabel || `Day ${day}`;
    powerEl.textContent = dayData.powerEmoji + ' ' + dayData.power + ' Power!';
    titleEl.textContent = `${dayLabel} Complete!`;
    textEl.textContent = dayData.completionText;

    // Render the daily gift and any new achievements/trophy
    if (rewardEl) {
      const summaryHtml = renderRewardSummary(rewardResult);
      rewardEl.innerHTML = summaryHtml;
      rewardEl.style.display = summaryHtml ? 'block' : 'none';
    }

    Audio.cancel();
    setTimeout(async () => {
      // Speak completion text first, then queue reward announcements after it finishes
      await Audio.speak(dayData.completionText, { rate: 0.9 });

      if (rewardResult && rewardResult.reward && rewardResult.reward.isNew) {
        await new Promise(r => setTimeout(r, 400));
        await Audio.speak(rewardResult.reward.voiceText, { rate: 0.9 });
      }

      if (rewardResult && rewardResult.newAchievements && rewardResult.newAchievements.length > 0) {
        for (const ach of rewardResult.newAchievements) {
          await new Promise(r => setTimeout(r, 400));
          await Audio.speak(`Achievement unlocked: ${ach.name}!`, { rate: 0.9 });
        }
      }

      if (rewardResult && rewardResult.trophy && rewardResult.trophy.isNew) {
        await new Promise(r => setTimeout(r, 400));
        await Audio.speak(`You earned the ${rewardResult.trophy.name}!`, { rate: 0.9 });
      }
    }, 300);

    // Parent unlock section (hidden by default, shown for days 1-4)
    const unlockSection = document.getElementById('parent-unlock');
    const codeInput = document.getElementById('parent-code-input');
    const unlockBtn = document.getElementById('btn-unlock-day');
    const unlockHint = document.getElementById('parent-unlock-hint');

    // Reset unlock UI
    if (unlockSection) unlockSection.style.display = 'none';
    if (codeInput) { codeInput.value = ''; codeInput.disabled = false; }
    if (unlockHint) unlockHint.style.display = 'none';

    // Outdoor: only lock after Day 1B (app day 2). Normal: lock after days 1-4.
    const isOutdoor = currentEpisodeId === 'week1-outdoor';
    const needsParentLock = isOutdoor ? (day === 2) : (day < 5);

    const goToNextDay = () => {
      overlay.style.display = 'none';
      overlay.setAttribute('aria-hidden', 'true');
      showScene(`day${day + 1}`);
      activeEngine = getEngineForDay(day + 1);
      if (activeEngine && activeEngine.start) activeEngine.start();
    };

    if (needsParentLock) {
      nextBtn.style.display = 'none'; // hidden by default, shown after password
      const nextDay = day + 1;
      const nextLabel = episodeData.days[String(nextDay)]?.tabLabel || `Day ${nextDay}`;
      nextBtn.textContent = `${nextLabel} →`;
      nextBtn.onclick = goToNextDay;

      // Show parent unlock section
      if (unlockSection) unlockSection.style.display = 'block';

      // Handle unlock button
      const tryUnlock = () => {
        const val = codeInput ? codeInput.value.trim() : '';
        if (val === '1801') {
          if (unlockSection) unlockSection.style.display = 'none';
          nextBtn.style.display = 'block';
          nextBtn.focus();
          Audio.speak('Unlocked! Ready for the next day!', { rate: 0.9 });
        } else {
          if (unlockHint) unlockHint.style.display = 'block';
          codeInput.value = '';
          codeInput.focus();
        }
      };

      if (unlockBtn) {
        unlockBtn.onclick = tryUnlock;
        // Also allow Enter key
        if (codeInput) {
          codeInput.onkeydown = (e) => {
            if (e.key === 'Enter') tryUnlock();
          };
        }
      }
    } else if (day < 5) {
      // No lock needed — show next button directly
      nextBtn.style.display = 'block';
      const nextDay = day + 1;
      const nextLabel = episodeData.days[String(nextDay)]?.tabLabel || `Day ${nextDay}`;
      nextBtn.textContent = `${nextLabel} →`;
      nextBtn.onclick = goToNextDay;
      if (unlockSection) unlockSection.style.display = 'none';
    } else {
      // Day 5 — no lock, direct certificate
      nextBtn.style.display = 'block';
      nextBtn.textContent = 'See Your Certificate! 🏆';
      nextBtn.onclick = () => {
        overlay.style.display = 'none';
        overlay.setAttribute('aria-hidden', 'true');
        showScene('complete');
        EngineHeart && EngineHeart.showCertificate();
      };
    }

    homeBtn.onclick = () => {
      overlay.style.display = 'none';
      overlay.setAttribute('aria-hidden', 'true');
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

  /** Render the reward/achievement/trophy summary HTML for the overlay */
  function renderRewardSummary(result) {
    if (!result) return '';
    const parts = [];

    if (result.reward) {
      const r = result.reward;
      parts.push(`
        <div class="day-reward-gift animate-pop">
          <div class="day-reward-emoji">${r.emoji}</div>
          <div class="day-reward-label">${r.isNew ? '<span class="new-badge">New!</span> ' : ''}${r.name}</div>
          <div class="day-reward-msg">${r.message || `Twinkle gives you a ${r.name}!`}</div>
        </div>
      `);
    }

    if (result.newAchievements && result.newAchievements.length > 0) {
      for (const ach of result.newAchievements) {
        parts.push(`
          <div class="day-reward-achievement animate-pop">
            <span class="day-reward-ach-emoji">${ach.emoji}</span>
            <span class="day-reward-ach-text"><span class="new-badge">New!</span> Achievement: <strong>${ach.name}</strong></span>
          </div>
        `);
      }
    }

    if (result.trophy && result.trophy.isNew) {
      parts.push(`
        <div class="day-reward-trophy animate-pop">
          <div class="day-reward-emoji">${result.trophy.emoji}</div>
          <div class="day-reward-label"><span class="new-badge">New!</span> ${result.trophy.name}</div>
          <div class="day-reward-msg">You completed the whole week!</div>
        </div>
      `);
    }

    return parts.join('');
  }

  /** Update the treasure chest button visibility and "new" badge */
  function updateTreasureButton() {
    const btn = document.getElementById('treasure-chest-btn');
    if (!btn) return;
    const hasNew = typeof Achievements !== 'undefined' && Achievements.hasNewItems();
    btn.classList.toggle('has-new', hasNew);
  }

  /** Bind the treasure chest button to open the treasure modal */
  function bindTreasureButton() {
    const btn = document.getElementById('treasure-chest-btn');
    if (btn) {
      btn.addEventListener('click', () => {
        showTreasureModal();
      });
    }

    // Bind tab switching inside the modal
    const modal = document.getElementById('treasure-modal');
    if (modal) {
      modal.querySelectorAll('.treasure-tab').forEach(tabBtn => {
        tabBtn.addEventListener('click', () => {
          switchTreasureTab(tabBtn.dataset.tab);
        });
      });

      const closeBtn = modal.querySelector('.treasure-close');
      if (closeBtn) {
        closeBtn.addEventListener('click', hideTreasureModal);
      }

      // Close when clicking the backdrop (outside the card)
      modal.addEventListener('click', (e) => {
        if (e.target === modal) hideTreasureModal();
      });
    }
  }

  /** Show the treasure chest modal */
  function showTreasureModal() {
    const modal = document.getElementById('treasure-modal');
    if (!modal) return;
    try {
      renderTreasureModal();
      if (typeof Achievements !== 'undefined') {
        Achievements.markAllSeen();
      }
    } catch (e) {
      console.error('Failed to render treasure modal:', e);
    }
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    updateTreasureButton();

    // Close on Escape
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        hideTreasureModal();
        document.removeEventListener('keydown', escHandler);
      }
    };
    modal._escHandler = escHandler;
    document.addEventListener('keydown', escHandler);
  }

  /** Hide the treasure chest modal */
  function hideTreasureModal() {
    const modal = document.getElementById('treasure-modal');
    if (!modal) return;
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    if (modal._escHandler) {
      document.removeEventListener('keydown', modal._escHandler);
      modal._escHandler = null;
    }
  }

  /** Render the contents of the treasure chest modal */
  function renderTreasureModal() {
    const modal = document.getElementById('treasure-modal');
    if (!modal) return;

    const rewards = (typeof Achievements !== 'undefined' ? Achievements.getRewards() : []);
    const achievements = (typeof Achievements !== 'undefined' ? Achievements.getAchievements() : []);
    const trophies = (typeof Achievements !== 'undefined' ? Achievements.getTrophies() : []);

    const rewardsHtml = rewards.length > 0
      ? rewards.map(r => `
          <div class="treasure-item${r.isNew ? ' is-new' : ''}">
            <div class="treasure-item-emoji">${r.emoji}</div>
            <div class="treasure-item-name">${r.name}</div>
            <div class="treasure-item-meta">${r.episodeId || ''} · Day ${r.day || '?'}</div>
          </div>
        `).join('')
      : '<p class="treasure-empty">No gifts yet. Finish a day to get one!</p>';

    const achievementsHtml = achievements.length > 0
      ? achievements.map(a => `
          <div class="treasure-item treasure-achievement${a.isNew ? ' is-new' : ''}">
            <div class="treasure-item-emoji">${a.emoji}</div>
            <div class="treasure-item-name">${a.name}</div>
            <div class="treasure-item-meta">${a.desc || ''}</div>
          </div>
        `).join('')
      : '<p class="treasure-empty">No achievements yet. Keep exploring!</p>';

    const trophiesHtml = trophies.length > 0
      ? trophies.map(t => `
          <div class="treasure-item treasure-trophy${t.isNew ? ' is-new' : ''}">
            <div class="treasure-item-emoji">${t.emoji}</div>
            <div class="treasure-item-name">${t.name}</div>
            <div class="treasure-item-meta">${t.episodeId || ''}</div>
          </div>
        `).join('')
      : '<p class="treasure-empty">No trophies yet. Complete a whole week!</p>';

    const rewardsPanel = modal.querySelector('.treasure-panel[data-panel="gifts"]');
    const achievementsPanel = modal.querySelector('.treasure-panel[data-panel="achievements"]');
    const trophiesPanel = modal.querySelector('.treasure-panel[data-panel="trophies"]');

    if (rewardsPanel) rewardsPanel.innerHTML = rewardsHtml;
    if (achievementsPanel) achievementsPanel.innerHTML = achievementsHtml;
    if (trophiesPanel) trophiesPanel.innerHTML = trophiesHtml;
  }

  /** Switch active tab inside the treasure modal */
  function switchTreasureTab(tabName) {
    const modal = document.getElementById('treasure-modal');
    if (!modal) return;
    modal.querySelectorAll('.treasure-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    modal.querySelectorAll('.treasure-panel').forEach(panel => {
      panel.classList.toggle('active', panel.dataset.panel === tabName);
    });
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
        const titleEl = document.querySelector('.intro-title');
        const subtitleEl = document.querySelector('.intro-subtitle');
        const storyEl = document.querySelector('.intro-story');
        const parts = [];
        if (titleEl) parts.push(titleEl.textContent.trim());
        if (subtitleEl) parts.push(subtitleEl.textContent.trim());
        if (storyEl) parts.push(storyEl.textContent.replace(/\s+/g, ' ').trim());
        const storyText = parts.join('. ') || 'Welcome to The Star Seed!';
        Audio.speak(storyText, { rate: 0.85, cancelPrevious: true });
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
            // Parent override: allow unlocking a locked day with the parent code
            const code = window.prompt(`${btn.textContent} is locked. Enter parent code to unlock:`);
            if (code && code.trim() === '1801') {
              const powerMap = { 1: 'light', 2: 'color', 3: 'sound', 4: 'motion', 5: 'heart' };
              for (let d = 1; d < day; d++) {
                Storage.completeDay(d);
                if (powerMap[d]) Storage.addPower(powerMap[d]);
              }
              updateStatusBar();
              updateIntroDaySelect(Storage.getState());
              goToDay(day);
              Audio.speak(`${btn.textContent} unlocked!`, { rate: 0.9 });
            } else if (code !== null) {
              btn.classList.add('shake');
              setTimeout(() => btn.classList.remove('shake'), 500);
              Audio.speak('Not quite right. Ask your Earth Helper!', { rate: 0.9 });
            }
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
    if (daySpan) {
      const dayLabel = episodeData.days[String(state.currentDay)]?.tabLabel || `Day ${state.currentDay}`;
      daySpan.textContent = dayLabel;
    }
  }

  /** Update day selector buttons on intro based on progress */
  function updateIntroDaySelect(state) {
    const dayGrid = document.getElementById('intro-day-grid');
    if (!dayGrid) return;

    // Custom labels for Week 1 Outdoor episode
    const isOutdoor = currentEpisodeId === 'week1-outdoor';
    const outdoorLabels = { 1: '🔦 Day 1A', 2: '🌈 Day 1B', 3: '🎵 Day 2A', 4: '🤸 Day 2B', 5: '❤️ Day 2C' };

    const buttons = dayGrid.querySelectorAll('.intro-day-btn');
    buttons.forEach(btn => {
      const day = parseInt(btn.dataset.day);
      btn.classList.remove('locked', 'completed', 'unlocked');

      // Update label for outdoor mode
      if (isOutdoor && outdoorLabels[day]) {
        btn.textContent = outdoorLabels[day];
      }

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
    switchEpisode, getCurrentEpisodeId: () => currentEpisodeId,
    showTreasureModal, hideTreasureModal, switchTreasureTab
  };
})();

// Boot when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
