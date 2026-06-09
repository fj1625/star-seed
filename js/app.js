/**
 * Star Seed - Main App Controller
 * Scene management, initialization, and coordination
 */
const App = (() => {
  let episodeData = null;
  let currentScene = 'intro';

  // Scene sections in DOM
  const scenes = [
    'intro', 'day1', 'day2', 'day3', 'day4', 'day5', 'complete'
  ];

  /** Initialize the entire app */
  async function init() {
    // Init core systems
    Storage.load();
    Audio.init();
    VoiceInput.init();

    // Load episode data
    try {
      const resp = await fetch('data/ep01-home.json');
      episodeData = await resp.json();
    } catch (e) {
      console.error('Failed to load episode data', e);
      showError('Could not load game data. Please check your connection.');
      return;
    }

    // Init Twinkle
    const twinkleEl = document.getElementById('twinkle-character');
    Twinkle.init(twinkleEl);

    // Update status bar
    updateStatusBar();

    // Init engines
    if (typeof EngineLight !== 'undefined') EngineLight.init(episodeData);
    if (typeof EngineColor !== 'undefined') EngineColor.init(episodeData);
    if (typeof EngineSound !== 'undefined') EngineSound.init(episodeData);
    if (typeof EngineMotion !== 'undefined') EngineMotion.init(episodeData);
    if (typeof EngineHeart !== 'undefined') EngineHeart.init(episodeData);

    // Bind UI
    bindNavigation();
    bindIntroButtons();
    bindRestartButton();

    // Determine starting scene
    // ALWAYS show intro first — let user choose to continue or start fresh
    showScene('intro');

    const state = Storage.getState();

    // If there's saved progress, show continue button
    if (state.completedDays.length > 0) {
      showContinueOption(state);
    }

    // Show/hide reset link
    const resetNote = document.getElementById('intro-reset-note');
    if (resetNote) {
      resetNote.style.display = state.completedDays.length > 0 ? 'block' : 'none';
    }

    // Update day selector grid
    updateIntroDaySelect(state);

    // Speak greeting
    setTimeout(() => {
      if (state.completedDays.length >= 5) {
        Audio.speak('Welcome back, Star Guardian! You have collected all powers!', { rate: 0.9 });
      } else if (state.completedDays.length > 0) {
        Audio.speak('Welcome back! Ready to continue?', { rate: 0.9 });
      } else {
        Audio.speak('Hello, Star Guardian! I am Twinkle. I need your help!', { rate: 0.9 });
      }
    }, 500);
  }

  /** Show a specific scene, hide others */
  function showScene(name) {
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
        showScene(`day${day}`);
        // Init the engine for this day
        const engineMap = {
          1: () => EngineLight && EngineLight.start(),
          2: () => EngineColor && EngineColor.start(),
          3: () => EngineSound && EngineSound.start(),
          4: () => EngineMotion && EngineMotion.start(),
          5: () => EngineHeart && EngineHeart.start()
        };
        if (engineMap[day]) engineMap[day]();
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
          2: () => EngineColor && EngineColor.start(),
          3: () => EngineSound && EngineSound.start(),
          4: () => EngineMotion && EngineMotion.start(),
          5: () => EngineHeart && EngineHeart.start()
        };
        if (nextEngineMap[day + 1]) nextEngineMap[day + 1]();
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
          Storage.save();
          Twinkle.syncFromStorage();
          updateStatusBar();
          updateIntroDaySelect(Storage.getState());
          // Show continue button too
          showContinueOption(Storage.getState());
          const rn = document.getElementById('intro-reset-note');
          if (rn) rn.style.display = 'block';
          Audio.speak('All days unlocked! You can play any day now.', { rate: 0.9 });
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
    updateIntroDaySelect, showContinueOption
  };
})();

// Boot when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
