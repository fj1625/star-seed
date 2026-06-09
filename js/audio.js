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

    return new Promise((resolve) => {
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = rate;
      utter.pitch = pitch;
      utter.volume = 1.0;
      if (voice || preferredVoice) {
        utter.voice = voice || preferredVoice;
      }

      utter.onend = () => {
        isSpeaking = false;
        resolve();
        processQueue();
      };

      utter.onerror = (e) => {
        if (e.error !== 'canceled' && e.error !== 'interrupted') {
          console.warn('Speech error:', e.error);
        }
        isSpeaking = false;
        resolve();
        processQueue();
      };

      isSpeaking = true;
      synth.speak(utter);
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

  return {
    init, speak, speakQueued, onDone, cancel, isSpeakingNow,
    isSupported: () => isSupported
  };
})();
