/**
 * Star Seed - Voice Input Manager
 * Wraps Web Speech API SpeechRecognition for child voice input.
 * Falls back to text input when speech is not supported.
 */
const VoiceInput = (() => {
  let recognition = null;
  let isListening = false;
  let activeCallbacks = null;
  let silenceTimer = null;
  let isSupported = false;

  /** Initialize speech recognition */
  function init() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('SpeechRecognition not supported');
      isSupported = false;
      return;
    }
    isSupported = true;
  }

  /**
   * Check if speech recognition is available
   */
  function isRecognitionSupported() {
    return isSupported;
  }

  /**
   * Start listening for speech
   * @param {Object} options
   * @param {string} [options.lang='en-US'] - recognition language
   * @param {function(string)} [options.onResult] - final transcript
   * @param {function(string)} [options.onInterim] - interim (live) transcript
   * @param {function(string)} [options.onError] - error type: 'not-allowed','no-speech','network','aborted','unknown'
   * @param {number} [options.timeout=8000] - auto-stop after ms of silence
   * @returns {boolean} true if started, false if not supported
   */
  function listen(options = {}) {
    if (!isSupported) {
      if (options.onError) options.onError('not-supported');
      return false;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      if (options.onError) options.onError('not-supported');
      return false;
    }

    // Stop any existing recognition
    stop();

    const {
      lang = 'en-US',
      onResult = null,
      onInterim = null,
      onError = null,
      timeout = 8000
    } = options;

    activeCallbacks = { onResult, onInterim, onError };

    try {
      recognition = new SpeechRecognition();
      recognition.lang = lang;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      // continuous=false means auto-stop after one utterance — better for kids
      recognition.continuous = false;

      let audioStarted = false;
      let startCheckTimer = null;

      recognition.onaudiostart = () => {
        audioStarted = true;
        clearTimeout(startCheckTimer);
      };

      recognition.onresult = (event) => {
        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript.trim();
          if (event.results[i].isFinal) {
            final += transcript + ' ';
          } else {
            interim += transcript + ' ';
          }
        }

        if (interim && activeCallbacks && activeCallbacks.onInterim) {
          activeCallbacks.onInterim(interim.trim());
          resetSilenceTimeout();
        }

        if (final && activeCallbacks && activeCallbacks.onResult) {
          const cleanFinal = final.trim();
          if (cleanFinal) {
            clearSilenceTimer();
            clearTimeout(startCheckTimer);
            isListening = false;
            activeCallbacks.onResult(cleanFinal);
            activeCallbacks = null;
            // Don't call stop() here — recognition already ended (continuous=false)
            return;
          }
        }
      };

      recognition.onerror = (event) => {
        clearSilenceTimer();
        clearTimeout(startCheckTimer);
        isListening = false;
        const cb = activeCallbacks;
        activeCallbacks = null;

        let errorType = 'unknown';
        switch (event.error) {
          case 'not-allowed': errorType = 'not-allowed'; break;
          case 'no-speech': errorType = 'no-speech'; break;
          case 'network': errorType = 'network'; break;
          case 'aborted': errorType = 'aborted'; break;
          default: errorType = 'unknown'; break;
        }

        if (cb && cb.onError) cb.onError(errorType);
      };

      recognition.onend = () => {
        clearSilenceTimer();
        clearTimeout(startCheckTimer);
        isListening = false;
        // If onResult wasn't called but we had callbacks, it was no-speech or aborted
        if (activeCallbacks) {
          const cb = activeCallbacks;
          activeCallbacks = null;
          // Don't fire onError here — onerror already handled it if needed
        }
      };

      recognition.start();
      isListening = true;
      resetSilenceTimeout();

      // Guard: some browsers (iOS Safari) claim to support SpeechRecognition
      // but never actually start capturing audio. If onaudiostart doesn't fire
      // within 3s, treat it as a permission/blocking error.
      startCheckTimer = setTimeout(() => {
        if (!audioStarted && activeCallbacks) {
          try { recognition.stop(); } catch (e) { /* ignore */ }
          isListening = false;
          if (activeCallbacks && activeCallbacks.onError) {
            activeCallbacks.onError('not-allowed');
          }
          activeCallbacks = null;
        }
      }, 3000);

      return true;

    } catch (e) {
      console.warn('VoiceInput: recognition start failed', e);
      isListening = false;
      if (onError) onError('unknown');
      return false;
    }
  }

  function resetSilenceTimeout() {
    clearTimeout(silenceTimer);
    // Auto-stop after timeout of silence
    silenceTimer = setTimeout(() => {
      if (isListening && recognition) {
        try { recognition.stop(); } catch (e) { /* ignore */ }
      }
      isListening = false;
      if (activeCallbacks && activeCallbacks.onError) {
        activeCallbacks.onError('no-speech');
      }
      activeCallbacks = null;
    }, 8000);
  }

  function clearSilenceTimer() {
    clearTimeout(silenceTimer);
    silenceTimer = null;
  }

  /** Stop active recognition */
  function stop() {
    clearSilenceTimer();
    if (recognition && isListening) {
      try {
        recognition.stop();
      } catch (e) {
        // May already be stopped
      }
    }
    isListening = false;
    activeCallbacks = null;
    recognition = null;
  }

  /**
   * Check if currently listening
   */
  function isActive() {
    return isListening;
  }

  /**
   * Render a text-input fallback for when speech is not available.
   * @param {HTMLElement} container - DOM element to render into
   * @param {Object} options
   * @param {function(string)} options.onSubmit - called with typed text
   * @param {string} [options.placeholder='Type here...']
   * @param {string} [options.buttonText='Send →']
   * @returns {HTMLElement} the input element for focus
   */
  function renderFallbackInput(container, options = {}) {
    if (!container) return null;

    const {
      onSubmit = () => {},
      placeholder = 'Type here...',
      buttonText = 'Send →'
    } = options;

    container.innerHTML = `
      <div class="voice-fallback">
        <input type="text" class="voice-fallback-input" placeholder="${placeholder}" maxlength="100">
        <button class="btn btn-small voice-fallback-btn">${buttonText}</button>
      </div>
    `;

    const input = container.querySelector('.voice-fallback-input');
    const btn = container.querySelector('.voice-fallback-btn');

    const submit = () => {
      const text = input.value.trim();
      if (text) {
        input.disabled = true;
        if (btn) btn.disabled = true;
        onSubmit(text);
      }
    };

    btn.addEventListener('click', submit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submit();
    });

    // Auto-focus
    setTimeout(() => input.focus(), 100);
    return input;
  }

  return {
    init, listen, stop, isActive, isRecognitionSupported, renderFallbackInput
  };
})();
