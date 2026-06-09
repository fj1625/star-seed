/**
 * Star Seed - Twinkle Character Controller
 * Manages the CSS state classes for Twinkle's visual evolution
 */
const Twinkle = (() => {
  const POWER_ORDER = ['light', 'color', 'sound', 'motion', 'heart'];
  let el = null;

  /** Initialize with the Twinkle DOM element */
  function init(element) {
    el = element;
    syncFromStorage();
  }

  /** Apply states based on collected powers */
  function syncFromStorage() {
    const state = Storage.getState();
    if (!el) return;

    // Remove all power classes
    el.classList.remove(
      'twinkle-dim',
      'twinkle-light',
      'twinkle-color',
      'twinkle-sound',
      'twinkle-motion',
      'twinkle-full'
    );

    const powers = state.twinklePowers;
    if (powers.length === 0) {
      el.classList.add('twinkle-dim');
    } else if (powers.length >= 5) {
      el.classList.add('twinkle-full');
    } else {
      // Apply the latest power class
      const latest = powers[powers.length - 1];
      el.classList.add(`twinkle-${latest}`);
    }
  }

  /** Add a power and animate the transition */
  function addPower(power) {
    Storage.addPower(power);
    syncFromStorage();

    // Trigger a celebration animation on the Twinkle element
    if (el) {
      el.classList.add('twinkle-celebrate');
      setTimeout(() => el.classList.remove('twinkle-celebrate'), 1500);
    }
  }

  /** Get the emoji/visual for current state */
  function getCurrentEmoji() {
    const powers = Storage.getState().twinklePowers;
    if (powers.length === 0) return '🫥';
    if (powers.length >= 5) return '⭐';
    const map = {
      light: '🔆',
      color: '🌈',
      sound: '🎵',
      motion: '💫',
      heart: '❤️'
    };
    return map[powers[powers.length - 1]] || '✨';
  }

  /** Get a human-readable status */
  function getStatusText() {
    const powers = Storage.getState().twinklePowers;
    if (powers.length === 0) return 'Twinkle is sleeping...';
    if (powers.length >= 5) return 'Twinkle is a real star! ⭐';
    return `Twinkle has ${powers.length} of 5 powers`;
  }

  /** Get number of collected powers */
  function getPowerCount() {
    return Storage.getState().twinklePowers.length;
  }

  return {
    init, syncFromStorage, addPower,
    getCurrentEmoji, getStatusText, getPowerCount
  };
})();
