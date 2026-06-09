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
    bindRestartButton();

    // Determine starting scene
    const state = Storage.getState();
    if (state.completedDays.length === 0) {
      showScene('intro');
      setTimeout(() => {
        Audio.speak('Hello, Star Guardian! I am Twinkle. I need your help!', { rate: 0.9 });
      }, 500);
    } else if (state.completedDays.length >= 5) {
      showScene('complete');
      setTimeout(() => EngineHeart && EngineHeart.showCertificate(), 300);
    } else {
      // Resume from current day — use goToDay to init the engine
      goToDay(state.currentDay);
    }
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
    updateStatusBar, getEpisodeData
  };
})();

// Boot when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
