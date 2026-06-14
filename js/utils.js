/**
 * Star Seed — Shared utilities used across all game engines
 */
const Utils = (() => {
  /**
   * Promise-based sleep. Engines that need timer cleanup should use
   * their own TimerManager; this is the simple version.
   */
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Show only one element among a list of IDs, hide the rest.
   */
  function showOnly(phaseIds, showId) {
    phaseIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = (id === showId) ? '' : 'none';
    });
  }

  /**
   * Speak the story intro for a given day.
   * Updates the speech bubble and waits for actual speech to finish.
   */
  async function speakIntro(dayNum, data, options = {}) {
    const speechEl = document.getElementById(`day${dayNum}-speech`);
    const intro = data.days?.[String(dayNum)]?.storyIntro;
    if (!intro) {
      console.warn(`[Utils] No storyIntro for day ${dayNum}`);
      return;
    }
    if (speechEl) {
      speechEl.innerHTML = `<div class="speech-bubble">${intro}</div>`;
    }
    await Audio.speak(intro, { rate: 0.85, cancelPrevious: true, ...options });
    // Extra guard: don't return until the browser is truly silent,
    // so long intros are not cut off before the game continues.
    await Audio.waitForSilence(30000);
  }

  /**
   * Replace an element with a clone to remove all event listeners.
   * Returns the new clone, or null if el is invalid.
   */
  function replaceWithClone(el) {
    if (!el || !el.parentNode) return null;
    const clone = el.cloneNode(true);
    el.parentNode.replaceChild(clone, el);
    return clone;
  }

  /**
   * Capitalize the first letter of a string.
   */
  function capitalize(str) {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  return { sleep, showOnly, speakIntro, replaceWithClone, capitalize };
})();
