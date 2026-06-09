/**
 * Star Seed - Audio Manager
 * Wraps Web Speech API for voice synthesis
 */
const Audio = (() => {
  let synth = null;
  let preferredVoice = null;
  let isSupported = false;
  let isSpeaking = false;
  let speakQueue = [];
  let onQueueEmpty = null;

  /** Initialize speech synthesis */
  function init() {
    if (typeof window === 'undefined') return;
    synth = window.speechSynthesis;
    if (!synth) {
      console.warn('Web Speech API not supported');
      isSupported = false;
      return;
    }
    isSupported = true;

    // Voice loading is async on some browsers (Chrome)
    const loadVoices = () => {
      const voices = synth.getVoices();
      // Prefer en-US female voice
      preferredVoice = voices.find(v =>
        v.lang.startsWith('en-US') && v.name.includes('Female')
      ) || voices.find(v =>
        v.lang.startsWith('en-US')
      ) || voices.find(v =>
        v.lang.startsWith('en')
      ) || voices[0];
    };

    loadVoices();
    synth.onvoiceschanged = loadVoices;
  }

  /**
   * Speak text with options
   * @param {string} text - Text to speak
   * @param {Object} options
   * @param {number} [options.rate=1.0] - Speech rate (0.1-10)
   * @param {number} [options.pitch=1.0] - Speech pitch (0-2)
   * @param {SpeechSynthesisVoice} [options.voice] - Override voice
   * @param {boolean} [options.cancelPrevious=false] - Cancel any ongoing speech
   * @returns {Promise} Resolves when speech ends
   */
  /**
   * Strip emoji characters from text so they don't get read aloud.
   * Uses Unicode property escapes for broad emoji coverage.
   */
  function stripEmoji(text) {
    if (!text) return text;
    return text
      .replace(/\p{Extended_Pictographic}/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function speak(text, options = {}) {
    if (!isSupported) {
      console.warn('Speech not supported, text:', text);
      return Promise.resolve();
    }

    const {
      rate = 1.0,
      pitch = 1.0,
      voice = null,
      cancelPrevious = false
    } = options;

    if (cancelPrevious) {
      cancel();
    }

    // Strip emojis — Web Speech API reads their Unicode names aloud
    const cleanText = stripEmoji(text);
    if (!cleanText) return Promise.resolve(); // nothing left to speak

    return new Promise((resolve) => {
      const utter = new SpeechSynthesisUtterance(cleanText);
      utter.rate = rate;
      utter.pitch = pitch;
      utter.volume = 1.0;
      if (voice || preferredVoice) {
        utter.voice = voice || preferredVoice;
      }

      let done = false;

      // Safety net: Chrome sometimes silently ignores synth.speak()
      // and neither onend nor onerror fires. Timeout after 8s.
      const safetyTimer = setTimeout(() => {
        if (!done) {
          done = true;
          isSpeaking = false;
          resolve();
        }
      }, 8000);

      utter.onend = () => {
        if (done) return;
        done = true;
        clearTimeout(safetyTimer);
        isSpeaking = false;
        resolve();
        processQueue();
      };

      utter.onerror = (e) => {
        if (done) return;
        done = true;
        clearTimeout(safetyTimer);
        if (e.error !== 'canceled' && e.error !== 'interrupted') {
          console.warn('Speech error:', e.error);
        }
        isSpeaking = false;
        resolve();
        processQueue();
      };

      isSpeaking = true;
      // Chrome workaround: resume if Chrome paused the synth (e.g. tab background)
      if (synth.paused) synth.resume();

      // Chrome/Edge: synth.speaking may still report true from a stale
      // utterance whose onend already fired. New synth.speak() is silently
      // ignored in that state. Poll until free, then force-cancel if stuck.
      (function trySpeak(attempts) {
        if (synth.speaking && attempts < 30) {
          setTimeout(function() { trySpeak(attempts + 1); }, 100);
        } else {
          if (synth.speaking) synth.cancel(); // stuck — force clear
          synth.speak(utter);
        }
      })(0);
    });
  }

  /** Queue speech after current finishes */
  function speakQueued(text, options = {}) {
    speakQueue.push({ text, options });
    if (!isSpeaking) {
      processQueue();
    }
  }

  function processQueue() {
    if (speakQueue.length === 0) {
      if (onQueueEmpty) {
        const cb = onQueueEmpty;
        onQueueEmpty = null;
        cb();
      }
      return;
    }
    const { text, options } = speakQueue.shift();
    speak(text, options).then(processQueue);
  }

  /** Set callback when queue is fully drained */
  function onDone(callback) {
    if (speakQueue.length === 0 && !isSpeaking) {
      callback();
    } else {
      onQueueEmpty = callback;
    }
  }

  /** Cancel all speech */
  function cancel() {
    if (synth) {
      synth.cancel();
    }
    speakQueue = [];
    isSpeaking = false;
  }

  /** Check if currently speaking */
  function isSpeakingNow() {
    return isSpeaking || speakQueue.length > 0;
  }

  /**
   * Wait for all pending speech to finish (without cancelling).
   * Checks both our isSpeaking flag AND Chrome's internal synth.speaking.
   * @param {number} [timeout=5000] - Max wait in ms
   */
  async function waitForSilence(timeout = 5000) {
    const start = Date.now();
    while (isSpeaking || speakQueue.length > 0 || (synth && synth.speaking)) {
      if (Date.now() - start > timeout) {
        // If Chrome's synth is genuinely stuck, force-reset
        if (synth && synth.speaking) {
          synth.cancel();
        }
        // If only our flag was stuck (Chrome silently ignored a speak),
        // just reset our flag — do NOT call synth.cancel()
        isSpeaking = false;
        speakQueue = [];
        break;
      }
      await new Promise(r => setTimeout(r, 80));
    }
  }

  return {
    init, speak, speakQueued, onDone, cancel, isSpeakingNow, waitForSilence,
    isSupported: () => isSupported
  };
})();
