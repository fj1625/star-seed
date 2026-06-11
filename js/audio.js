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

  // ==== Volcano Engine TTS via Cloudflare Workers ====
  // Set this to your Worker URL after deploying tts-proxy/cloudflare-worker.js
  // e.g. 'https://star-seed-tts.yourname.workers.dev'
  const VOLCANO_WORKER_URL = ''; // Back to Web Speech API — install high-quality voice pack on your phone for better quality
  let currentVolcanoAudio = null; // for cancellation

  /** Show debug info on page for mobile users who can't open DevTools */
  function showDebug(msg) {
    var el = document.getElementById('audio-debug');
    if (el) el.textContent = msg;
    console.log('[Audio]', msg);
  }

  /** Initialize speech synthesis */
  function init() {
    if (typeof window === 'undefined') return;
    synth = window.speechSynthesis;
    if (!synth) {
      showDebug('❌ 设备不支持语音播放');
      isSupported = false;
      return;
    }
    isSupported = true;
    showDebug('✅ 语音引擎已就绪，正在加载语音列表...');

    // Voice loading is async on some browsers (Chrome, iOS)
    const loadVoices = () => {
      const voices = synth.getVoices();
      if (!voices || voices.length === 0) {
        showDebug('⏳ 语音列表加载中... (如果卡住，请刷新页面)');
        return;
      }

      // Log all voices for debugging — open DevTools to see what your device offers
      console.log('[Audio] Available voices:');
      voices.forEach((v, i) => {
        console.log(`  ${i + 1}. ${v.name} [${v.lang}] ${v.default ? '(default)' : ''}`);
      });

      // Score-based selection: prioritize high-quality voices
      const HIGH_QUALITY = ['Siri', 'Premium', 'Enhanced', 'Natural', 'Wavenet', 'Neural', 'Aaron', 'Nicky', 'Samantha', 'Catherine'];
      const LOW_QUALITY  = ['Compact', 'Google US English'];
      const MALE_NAMES   = ['male', 'david', 'daniel', 'paul', 'tom', 'mark', 'alex', 'james', 'john', 'michael', 'george', 'fred', 'ryan', 'tony'];
      const FEMALE_NAMES = ['female', 'samantha', 'karen', 'moira', 'tessa', 'veena', 'victoria', 'lisa', 'catherine', 'emma', 'jenny', 'aria', 'nicky', 'siri'];

      let bestVoice = null;
      let bestScore = -Infinity;

      for (const v of voices) {
        if (!v.lang || !v.lang.toLowerCase().startsWith('en')) continue;

        let score = 0;
        const nameLower = v.name.toLowerCase();
        const langLower = v.lang.toLowerCase();

        // Language match
        if (langLower === 'en-us') score += 10;
        else if (langLower.startsWith('en')) score += 5;

        // High-quality keywords
        for (const kw of HIGH_QUALITY) {
          if (nameLower.includes(kw.toLowerCase())) score += 20;
        }

        // Microsoft Natural voices are excellent on Windows/Edge
        if (nameLower.includes('microsoft') && nameLower.includes('natural')) score += 25;

        // Low-quality / robotic keywords
        for (const kw of LOW_QUALITY) {
          if (nameLower.includes(kw.toLowerCase())) score -= 15;
        }

        // Female voice — strong bonus
        for (const kw of FEMALE_NAMES) {
          if (nameLower.includes(kw.toLowerCase())) score += 20;
        }

        // Male voice — strong penalty
        for (const kw of MALE_NAMES) {
          if (nameLower.includes(kw.toLowerCase())) score -= 30;
        }

        // Default voice reflects system TTS setting — use it if it's English
        if (v.default) score += 15;

        if (score > bestScore) {
          bestScore = score;
          bestVoice = v;
        }
      }

      preferredVoice = bestVoice || voices.find(v => v.lang?.startsWith('en')) || voices[0];
      showDebug('🎤 当前语音: ' + (preferredVoice?.name || '默认'));
      console.log('[Audio] Selected voice:', preferredVoice?.name, '(score:', bestScore + ')');
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
    const {
      rate = 1.0,
      pitch = 1.0,
      voice = null,
      cancelPrevious = false
    } = options;

    if (cancelPrevious) {
      cancel();
    }

    // Strip emojis — TTS engines read their Unicode names aloud
    const cleanText = stripEmoji(text);
    if (!cleanText) return Promise.resolve(); // nothing left to speak

    console.log('[Audio] speak() called:', cleanText.slice(0, 40));

    // Use Volcano Engine TTS if configured, else fall back to Web Speech API
    const speakPromise = VOLCANO_WORKER_URL
      ? speakVolcano(cleanText, rate)
      : speakWebSpeech(cleanText, options);

    // Global safety: no matter what happens inside, force-resolve after 10s
    // so the game NEVER hangs waiting for speech
    const timeoutPromise = new Promise((resolve) => {
      setTimeout(() => {
        console.warn('[Audio] speak() global 10s timeout — forcing resolve');
        isSpeaking = false;
        resolve();
      }, 10000);
    });

    return Promise.race([speakPromise, timeoutPromise]);
  }

  /**
   * Volcano Engine TTS via Cloudflare Workers proxy.
   * Returns Promise that resolves when audio finishes playing.
   */
  async function speakVolcano(text, rate) {
    console.log('[Audio] speakVolcano start:', text.slice(0, 40));
    isSpeaking = true;
    try {
      const resp = await fetch(VOLCANO_WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, rate }),
      });

      const result = await resp.json();
      console.log('[Audio] Volcano result code:', result.code, 'data length:', result.data ? result.data.length : 0);

      if (result.code !== 3000 || !result.data) {
        console.warn('[Audio] Volcano TTS API error:', result);
        isSpeaking = false;
        return speakWebSpeech(text, { rate });
      }

      // Play base64 audio (Google Translate TTS returns audio/mpeg)
      const audio = new Audio('data:audio/mpeg;base64,' + result.data);
      audio.volume = 1.0;
      currentVolcanoAudio = audio;
      console.log('[Audio] Audio element created, src length:', result.data.length, 'bytes');

      return new Promise((resolve) => {
        // Safety: if audio never starts/finishes, force-resolve after 10s
        const timeoutGuard = setTimeout(() => {
          console.warn('[Audio] Volcano audio timeout — forcing resolve');
          currentVolcanoAudio = null;
          isSpeaking = false;
          resolve();
          processQueue();
        }, 10000);

        audio.onended = () => {
          clearTimeout(timeoutGuard);
          currentVolcanoAudio = null;
          isSpeaking = false;
          resolve();
          processQueue();
        };
        audio.onerror = (e) => {
          clearTimeout(timeoutGuard);
          console.warn('[Audio] Volcano audio playback error:', e);
          currentVolcanoAudio = null;
          isSpeaking = false;
          resolve();
          processQueue();
        };
        // Mobile browsers block autoplay without user gesture — catch and fallback
        audio.play().catch(err => {
          clearTimeout(timeoutGuard);
          console.warn('[Audio] audio.play() blocked by browser autoplay policy:', err.message);
          currentVolcanoAudio = null;
          isSpeaking = false;
          // Critical fallback: when autoplay is blocked, use Web Speech API so
          // the game never hangs and the user still hears something
          speakWebSpeech(text, { rate }).then(resolve);
        });
      });

    } catch (err) {
      console.warn('[Audio] Volcano TTS fetch failed:', err);
      isSpeaking = false;
      return speakWebSpeech(text, { rate });
    }
  }

  /** Original Web Speech API implementation */
  function speakWebSpeech(text, options = {}) {
    console.log('[Audio] speakWebSpeech called, isSupported:', isSupported, 'text:', text.slice(0, 40));
    if (!isSupported) {
      console.warn('[Audio] Web Speech not supported, skipping:', text);
      return Promise.resolve();
    }

    const {
      rate = 1.0,
      pitch = 1.0,
      voice = null,
    } = options;

    return new Promise((resolve) => {
      const utter = new SpeechSynthesisUtterance(text);

      // Detect if we're stuck with a male/mechanical voice and boost pitch
      const voiceName = (voice || preferredVoice)?.name || '';
      const nameLower = voiceName.toLowerCase();
      const MALE_KEYWORDS = ['male', 'david', 'daniel', 'paul', 'tom', 'mark', 'alex', 'james', 'john'];
      const isMaleVoice = MALE_KEYWORDS.some(kw => nameLower.includes(kw));
      const isLowQuality = nameLower.includes('google') && !nameLower.includes('premium') && !nameLower.includes('natural');

      // If caller explicitly set pitch, respect it. Otherwise auto-adjust.
      const autoPitch = (isMaleVoice || isLowQuality) ? 1.3 : 1.0;
      utter.rate = rate;
      utter.pitch = (pitch === 1.0) ? autoPitch : pitch; // only auto-adjust if caller didn't override
      utter.volume = 1.0;

      // Use the voice selected during init (respects user settings + female preference)
      // Allow caller override via options.voice
      if (voice || preferredVoice) {
        utter.voice = voice || preferredVoice;
        console.log('[Audio] Using voice:', utter.voice ? utter.voice.name : 'none');
      } else {
        // Voices not loaded yet — try one more time
        const voices = synth.getVoices ? synth.getVoices() : [];
        const fallback = voices.find(v => v.lang && v.lang.startsWith('en')) || voices[0];
        if (fallback) {
          utter.voice = fallback;
          console.log('[Audio] Fallback voice:', fallback.name);
        } else {
          console.log('[Audio] No voice available, using browser default');
        }
      }

      let done = false;

      // Safety net: Chrome sometimes silently ignores synth.speak()
      const safetyTimer = setTimeout(() => {
        if (!done) {
          console.warn('[Audio] Web Speech safety timeout — forcing resolve');
          done = true;
          isSpeaking = false;
          resolve();
        }
      }, 8000);

      utter.onstart = () => {
        console.log('[Audio] Web Speech onstart fired');
      };

      utter.onend = () => {
        if (done) return;
        console.log('[Audio] Web Speech onend fired');
        done = true;
        clearTimeout(safetyTimer);
        isSpeaking = false;
        resolve();
        processQueue();
      };

      utter.onerror = (e) => {
        if (done) return;
        console.warn('[Audio] Web Speech onerror:', e.error, e.message);
        done = true;
        clearTimeout(safetyTimer);
        isSpeaking = false;
        resolve();
        processQueue();
      };

      isSpeaking = true;

      // Force reset if synth is stuck
      if (synth.paused) {
        console.log('[Audio] Resuming paused synth');
        synth.resume();
      }

      // Always cancel before speaking to clear any stuck state
      try { synth.cancel(); } catch (e) {}

      console.log('[Audio] Calling synth.speak()');
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
    if (currentVolcanoAudio) {
      currentVolcanoAudio.pause();
      currentVolcanoAudio = null;
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
