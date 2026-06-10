/**
 * Star Seed - Day 2 Engine: Color Power (Color Detective)
 * Drag-to-mix colors → find real objects → voice input → camera snap
 */
const EngineColor = (() => {
  let data = null;
  let colors = [];
  let foundColors = [];
  let currentColorIndex = 0;
  let isActive = false;
  // Drag state
  let dragState = null;      // { el, startX, startY, originX, originY }
  let dragTarget = null;    // current color draggable being dragged

  function init(episodeData) {
    data = episodeData;
    colors = episodeData.days['2'].colors;
  }

  async function start() {
    isActive = true;
    clearPendingTimers();
    foundColors = Storage.getState().day2ColorsFound;
    currentColorIndex = foundColors.length;

    if (currentColorIndex >= colors.length) {
      App.onDayComplete(2);
      return;
    }

    renderDay2();
    await speakIntro();
    startColorChallenge(currentColorIndex);
  }

  function renderDay2() {
    const container = document.getElementById('day2');
    if (!container) return;

    container.innerHTML = `
      <div class="day-header">
        <span class="day-badge">Day 2</span>
        <h2>🌈 Color Power</h2>
        <p class="day-subtitle">Color Detective</p>
      </div>
      <div class="twinkle-speech" id="day2-speech"></div>

      <!-- Drag-to-mix stage -->
      <div class="color-drag-stage" id="day2-drag">
        <p class="drag-hint">Drag the colors together!</p>
        <div class="drag-playground" id="drag-playground">
          <div class="color-draggable" id="drag-color1"></div>
          <div class="drag-plus">+</div>
          <div class="color-draggable" id="drag-color2"></div>
        </div>
        <div class="drag-equals">=</div>
        <div class="color-mix-target" id="drag-target">?</div>
        <div class="drag-celebration" id="drag-celebration" style="display:none">
          <span class="drag-sparkles">✨</span>
          <p class="drag-result-text" id="drag-result-text"></p>
        </div>
      </div>

      <!-- Find object phase -->
      <div class="find-object-phase" id="day2-find" style="display:none">
        <div class="target-color-display" id="day2-target-color"></div>
        <p class="find-prompt" id="day2-find-prompt"></p>
      </div>

      <!-- Voice input phase -->
      <div class="voice-input-phase" id="day2-voice" style="display:none">
        <p class="voice-prompt">🎤 Tell Twinkle what you found!</p>
        <p class="voice-hint">Say: "I found a ________!" <br><small>(You can say it in Chinese too!)</small></p>
        <div class="voice-mic-area" id="day2-mic-area">
          <button class="btn btn-mic" id="btn-day2-mic">
            <span class="mic-icon">🎤</span>
            <span class="mic-label">Tap to Speak</span>
          </button>
          <p class="voice-status" id="day2-voice-status"></p>
        </div>
        <div class="voice-or-divider"><span>or type it:</span></div>
        <div class="voice-fallback-container" id="day2-fallback"></div>
        <button class="btn btn-skip" id="btn-day2-skip-voice">Skip →</button>
      </div>

      <!-- Camera phase -->
      <div class="camera-overlay" id="day2-camera" style="display:none">
        <div class="camera-view">
          <video id="day2-cam-video" autoplay playsinline muted></video>
          <canvas id="day2-cam-canvas" style="display:none"></canvas>
          <div class="camera-filter" id="cam-color-filter"></div>
          <div class="camera-frame-hint">📸 Frame the object!</div>
        </div>
        <div class="camera-controls">
          <button class="btn btn-capture" id="btn-capture">📸 Capture!</button>
          <button class="btn btn-skip" id="btn-day2-skip-camera">Skip →</button>
        </div>
        <div class="camera-snap-flash" id="cam-flash" style="display:none"></div>
      </div>

      <!-- Confirm phase -->
      <div class="confirm-phase" id="day2-confirm" style="display:none">
        <div class="confirm-found-item" id="day2-confirm-item"></div>
        <p class="confirm-question">Did it look like one of these?</p>
        <div class="confirm-examples" id="day2-examples"></div>
        <div class="confirm-buttons">
          <button class="btn btn-primary" id="btn-yes">Yes! 😊</button>
          <button class="btn btn-secondary" id="btn-no">Not yet...</button>
        </div>
      </div>

      <!-- Success card -->
      <div class="color-success" id="day2-success" style="display:none"></div>
    `;

    // Bind camera overlay click delegation once — survives innerHTML replacements
    setTimeout(() => {
      const cameraOverlay = document.getElementById('day2-camera');
      if (cameraOverlay && !cameraOverlay.dataset.delegated) {
        cameraOverlay.dataset.delegated = '1';
        cameraOverlay.addEventListener('click', (e) => {
          const btn = e.target.closest('button');
          if (!btn) return;
          if (btn.id === 'btn-capture') {
            capturePhoto(pendingColor);
          } else if (btn.id === 'btn-cam-done' || btn.id === 'btn-cam-continue') {
            goToConfirmPhase(pendingColor);
          } else if (btn.id === 'btn-day2-skip-camera') {
            goToConfirmPhase(pendingColor);
          }
        });
      }
    }, 0);
  }

  async function speakIntro() {
    const speechEl = document.getElementById('day2-speech');
    if (speechEl) {
      speechEl.innerHTML = `<div class="speech-bubble">${data.days['2'].storyIntro}</div>`;
    }
    await Audio.speak(data.days['2'].storyIntro, { rate: 0.85, cancelPrevious: true });
  }

  // ==================== DRAG-TO-MIX ====================

  function startColorChallenge(index) {
    if (index >= colors.length) {
      completeAllColors();
      return;
    }

    const color = colors[index];
    currentColorIndex = index;

    // Show drag stage, hide everything else
    showOnly('day2-drag');

    const c1 = document.getElementById('drag-color1');
    const c2 = document.getElementById('drag-color2');
    const target = document.getElementById('drag-target');
    const playground = document.getElementById('drag-playground');
    const celeb = document.getElementById('drag-celebration');
    const resultText = document.getElementById('drag-result-text');

    // Reset state
    if (target) { target.textContent = '?'; target.classList.remove('revealed'); target.style.backgroundColor = 'transparent'; }
    if (celeb) celeb.style.display = 'none';

    // Set up circles
    const mixFrom = color.mixFrom;
    [c1, c2].forEach((circle, i) => {
      if (!circle) return;
      const c = mixFrom[i];
      circle.style.backgroundColor = c;
      circle.textContent = c;
      circle.className = 'color-draggable';
      circle.style.transform = '';
      circle.dataset.color = c;
    });

    // Bind drag events
    bindDragEvents(c1, c2, color);

    // Update speech
    const speechEl = document.getElementById('day2-speech');
    if (speechEl) {
      speechEl.innerHTML = `<div class="speech-bubble">Drag ${mixFrom[0]} and ${mixFrom[1]} together! What color do they make?</div>`;
    }
    Audio.speak(`Drag ${mixFrom[0]} and ${mixFrom[1]} together! What do they make?`, { rate: 0.85 });
  }

  function bindDragEvents(c1, c2, color) {
    if (!c1 || !c2) return;

    [c1, c2].forEach(circle => {
      // Remove old listeners by cloning
      const clone = circle.cloneNode(true);
      circle.parentNode.replaceChild(clone, circle);

      clone.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        clone.setPointerCapture(e.pointerId);

        const rect = clone.getBoundingClientRect();
        dragState = {
          el: clone,
          startX: e.clientX,
          startY: e.clientY,
          originX: rect.left + rect.width / 2,
          originY: rect.top + rect.height / 2
        };

        clone.classList.add('dragging');
      });

      clone.addEventListener('pointermove', (e) => {
        if (!dragState || dragState.el !== clone) return;
        e.preventDefault();

        const dx = e.clientX - dragState.startX;
        const dy = e.clientY - dragState.startY;
        clone.style.transform = `translate(${dx}px, ${dy}px)`;

        // NOTE: collision check moved to pointerup for performance.
        // getBoundingClientRect() in pointermove forces sync layout every frame.
      });

      clone.addEventListener('pointerup', (e) => {
        if (!dragState || dragState.el !== clone) return;
        clone.classList.remove('dragging');

        // Check collision on release
        const didMix = checkCollision(color);
        if (!didMix) {
          // Snap back
          clone.style.transform = '';
        }
        dragState = null;
      });

      clone.addEventListener('pointercancel', () => {
        if (dragState && dragState.el === clone) {
          clone.classList.remove('dragging');
          clone.style.transform = '';
          dragState = null;
        }
      });
    });
  }

  function checkCollision(color) {
    const c1 = document.getElementById('drag-color1');
    const c2 = document.getElementById('drag-color2');
    if (!c1 || !c2) return false;

    const r1 = c1.getBoundingClientRect();
    const r2 = c2.getBoundingClientRect();

    // AABB overlap
    const overlapX = Math.max(0, Math.min(r1.right, r2.right) - Math.max(r1.left, r2.left));
    const overlapY = Math.max(0, Math.min(r1.bottom, r2.bottom) - Math.max(r1.top, r2.top));
    const overlapArea = overlapX * overlapY;
    const minArea = Math.min(r1.width * r1.height, r2.width * r2.height);

    // Collision when overlap > 25% of smaller circle
    if (overlapArea > minArea * 0.25) {
      onMixSuccess(color);
      return true;
    }
    return false;
  }

  async function onMixSuccess(color) {
    // Prevent double-fire
    if (dragState) {
      dragState.el.classList.remove('dragging');
      dragState.el.style.transform = '';
      dragState = null;
    }

    const c1 = document.getElementById('drag-color1');
    const c2 = document.getElementById('drag-color2');
    const target = document.getElementById('drag-target');
    const celeb = document.getElementById('drag-celebration');
    const resultText = document.getElementById('drag-result-text');
    const playground = document.getElementById('drag-playground');

    // Animate: circles shrink, target reveals
    if (c1) c1.classList.add('mixed');
    if (c2) c2.classList.add('mixed');

    // Short delay then reveal
    await sleep(400);

    if (target) {
      target.style.backgroundColor = color.targetColor;
      target.textContent = color.targetEmoji;
      target.classList.add('revealed');
    }

    if (playground) playground.style.display = 'none';

    if (celeb) {
      celeb.style.display = 'flex';
      if (resultText) {
        resultText.textContent = `${color.mixFrom[0]} + ${color.mixFrom[1]} = ${color.targetColor}!`;
      }
    }

    const speechEl = document.getElementById('day2-speech');
    if (speechEl) {
      speechEl.innerHTML = `<div class="speech-bubble happy">Yes! ${color.mixFrom[0]} and ${color.mixFrom[1]} make ${color.targetColor}!</div>`;
    }
    await Audio.speak(`Yes! ${color.mixFrom[0]} and ${color.mixFrom[1]} make ${color.targetColor}!`, { rate: 0.85 });

    // Wait a beat then transition to find-object phase
    await sleep(1500);

    // Reset circles for next color
    if (c1) { c1.classList.remove('mixed'); c1.style.transform = ''; }
    if (c2) { c2.classList.remove('mixed'); c2.style.transform = ''; }
    if (target) { target.classList.remove('revealed'); target.style.backgroundColor = 'transparent'; target.textContent = '?'; }
    if (celeb) celeb.style.display = 'none';
    if (playground) playground.style.display = '';

    showFindObjectPhase(color);
  }

  // ==================== FIND OBJECT PHASE ====================

  function showFindObjectPhase(color) {
    showOnly('day2-find');

    const targetDisplay = document.getElementById('day2-target-color');
    const promptEl = document.getElementById('day2-find-prompt');
    const findPhase = document.getElementById('day2-find');

    if (targetDisplay) {
      targetDisplay.innerHTML = `
        <div class="target-color-circle" style="background:${color.targetColor}">
          <span class="target-color-emoji">${color.targetEmoji}</span>
        </div>
        <p class="target-color-name">${color.targetColor.toUpperCase()}</p>
      `;
    }
    if (promptEl) promptEl.textContent = color.promptText;

    // Always recreate the button so its closure captures the CURRENT color
    const oldBtnWrap = findPhase.querySelector('.btn-find-wrap');
    if (oldBtnWrap) oldBtnWrap.remove();

    const btnWrap = document.createElement('div');
    btnWrap.className = 'btn-find-wrap';
    btnWrap.innerHTML = `<button class="btn btn-find" id="btn-found-it">✨ I FOUND IT! ✨</button>`;
    findPhase.appendChild(btnWrap);

    const foundBtn = btnWrap.querySelector('#btn-found-it');
    if (foundBtn) {
      foundBtn.addEventListener('click', () => {
        showVoiceInputPhase(color);
      });
    }

    const speechEl = document.getElementById('day2-speech');
    if (speechEl) {
      speechEl.innerHTML = `<div class="speech-bubble">${color.speechText}</div>`;
    }
    Audio.speak(color.speechText, { rate: 0.85 });
  }

  // ==================== VOICE INPUT PHASE ====================

  function showVoiceInputPhase(color) {
    showOnly('day2-voice');

    // Set up mic button
    const micBtn = document.getElementById('btn-day2-mic');
    const voiceStatus = document.getElementById('day2-voice-status');
    const fallbackContainer = document.getElementById('day2-fallback');
    const skipBtn = document.getElementById('btn-day2-skip-voice');

    // Clear previous
    if (voiceStatus) voiceStatus.innerHTML = '';
    if (fallbackContainer) fallbackContainer.innerHTML = '';

    // Speak the voice prompt
    const speechEl = document.getElementById('day2-speech');
    if (speechEl) {
      speechEl.innerHTML = `<div class="speech-bubble">Tell Twinkle what you found! Say "I found a..."</div>`;
    }
    Audio.speak('Tell me what you found! Say: I found a ' + color.exampleItems[0], { rate: 0.85 });

    // Current color context for callbacks
    const currentColor = color;

    if (micBtn && micBtn.parentNode) {
      const newMicBtn = micBtn.cloneNode(true);
      micBtn.parentNode.replaceChild(newMicBtn, micBtn);

      newMicBtn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        try {
          if (VoiceInput.isActive()) {
            VoiceInput.stop();
            newMicBtn.classList.remove('listening');
            if (voiceStatus) voiceStatus.innerHTML = '';
            return;
          }

          if (voiceStatus) voiceStatus.innerHTML = '<span class="voice-hearing">🎤 Listening...</span>';
          newMicBtn.classList.add('listening');

          const started = VoiceInput.listen({
            lang: 'en-US',
            onInterim: (text) => {
              if (voiceStatus) {
                voiceStatus.innerHTML = `<span class="voice-hearing">👂 Hearing: "${text}"</span>`;
              }
              newMicBtn.classList.add('listening');
            },
            onResult: (text) => {
              newMicBtn.classList.remove('listening');
              if (voiceStatus) {
                voiceStatus.innerHTML = `<span class="voice-heard">✅ Heard: "${text}"</span>`;
              }
              processVoiceResult(text, currentColor);
            },
            onError: (errorType) => {
              newMicBtn.classList.remove('listening');
              if (errorType === 'not-allowed') {
                if (voiceStatus) voiceStatus.innerHTML = '<span class="voice-error">🔒 Microphone blocked. Use the keyboard below!</span>';
              } else if (errorType === 'no-speech') {
                if (voiceStatus) voiceStatus.innerHTML = '<span class="voice-error">🤷 Didn\'t hear anything. Try again or type below!</span>';
              } else if (errorType === 'not-supported') {
                if (voiceStatus) voiceStatus.innerHTML = '<span class="voice-error">🎤 Voice not supported here. Type below!</span>';
              } else {
                if (voiceStatus) voiceStatus.innerHTML = '<span class="voice-error">⚠️ Hmm, that didn\'t work. Type it below!</span>';
              }
            }
          });

          if (!started) {
            newMicBtn.classList.remove('listening');
            if (voiceStatus) voiceStatus.innerHTML = '<span class="voice-error">🎤 Voice not supported on this device. Type below!</span>';
          }
        } catch (err) {
          console.error('Mic button error:', err);
          newMicBtn.classList.remove('listening');
          if (voiceStatus) voiceStatus.innerHTML = '<span class="voice-error">⚠️ Something went wrong. Type below!</span>';
        }
      });
    }

    // Skip button
    if (skipBtn) {
      const newSkip = skipBtn.cloneNode(true);
      skipBtn.parentNode.replaceChild(newSkip, skipBtn);
      newSkip.addEventListener('click', () => goToCameraPhase(currentColor));
    }

    // Render text fallback input
    if (fallbackContainer) {
      VoiceInput.renderFallbackInput(fallbackContainer, {
        placeholder: 'e.g. carrot, 胡萝卜...',
        buttonText: 'Send →',
        onSubmit: (text) => {
          processVoiceResult(text, currentColor);
        }
      });
    }
  }

  function processVoiceResult(text, color) {
    // Store the item found
    const storedItem = { colorId: color.id, itemName: text, language: 'en' };

    // Check if it contains Chinese characters
    if (/[一-鿿]/.test(text)) {
      storedItem.language = 'zh';
    }

    // Save to storage
    const state = Storage.getState();
    if (!state.day2ItemsFound) state.day2ItemsFound = [];
    state.day2ItemsFound.push(storedItem);
    Storage.save();

    // Respond based on language
    respondToFoundItem(text, color, storedItem.language);
  }

  async function respondToFoundItem(text, color, lang) {
    const speechEl = document.getElementById('day2-speech');

    if (lang === 'zh') {
      // Chinese detected — teach English word
      const englishHint = color.exampleItems[0]; // Use first example item as the English hint
      if (speechEl) {
        speechEl.innerHTML = `<div class="speech-bubble happy">${text}! In English we say... <strong>${englishHint}</strong>! Can you say ${englishHint}?</div>`;
      }
      await Audio.speak(`${text}! In English we say... ${englishHint}! Can you say ${englishHint}?`, { rate: 0.8 });
    } else {
      // English detected — celebrate
      if (speechEl) {
        speechEl.innerHTML = `<div class="speech-bubble happy">Wow! You found a ${text}! That's amazing!</div>`;
      }
      await Audio.speak(`Wow! You found a ${text}! That's amazing!`, { rate: 0.85 });
    }

    // Proceed to camera
    await sleep(800);
    goToCameraPhase(color);
  }

  // ==================== CAMERA PHASE ====================

  let cameraStream = null;

  function goToCameraPhase(color) {
    // Save color for later phases (fix: Continue button was silently failing)
    pendingColor = color;

    // Try to open camera
    showOnly('day2-camera');

    const video = document.getElementById('day2-cam-video');
    const filter = document.getElementById('cam-color-filter');
    const controls = document.querySelector('#day2-camera .camera-controls');
    const flash = document.getElementById('cam-flash');

    // Reset controls to original state (in case a previous round called showCameraUnavailable)
    if (controls) {
      controls.innerHTML = `
        <button class="btn btn-capture" id="btn-capture">📸 Capture!</button>
        <button class="btn btn-skip" id="btn-day2-skip-camera">Skip →</button>
      `;
    }

    // Apply color filter
    if (filter) {
      filter.style.backgroundColor = color.targetColor;
    }

    // Try to access camera
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false
      }).then(stream => {
        cameraStream = stream;
        if (video) {
          video.srcObject = stream;
          video.style.display = 'block';
        }

        // Capture button click is handled by camera overlay event delegation
      }).catch(() => {
        // Camera not available — skip gracefully
        showCameraUnavailable();
      });
    } else {
      showCameraUnavailable();
    }
  }

  function showCameraUnavailable() {
    const video = document.getElementById('day2-cam-video');
    const cameraOverlay = document.getElementById('day2-camera');
    const controls = cameraOverlay ? cameraOverlay.querySelector('.camera-controls') : null;
    if (video) {
      video.style.display = 'none';
    }
    const hint = cameraOverlay ? cameraOverlay.querySelector('.camera-frame-hint') : null;
    if (hint) {
      hint.innerHTML = '📱 Camera not available.<br>That\'s okay! You found it!';
      hint.classList.add('camera-unavailable');
    }
    // Replace capture button with "Continue" button — event delegation handles it
    if (controls) {
      controls.innerHTML = `<button class="btn btn-primary" id="btn-cam-continue">Continue →</button>`;
    }
  }

  function capturePhoto(color) {
    try {
      const video = document.getElementById('day2-cam-video');
      const canvas = document.getElementById('day2-cam-canvas');
      const flash = document.getElementById('cam-flash');

      if (!video || !canvas) {
        console.warn('capturePhoto: video or canvas not found');
        goToConfirmPhase(color);
        return;
      }

      // Show flash
      if (flash) {
        flash.style.display = 'block';
        setTimeout(() => { flash.style.display = 'none'; }, 300);
      }

      // Capture frame — wrap in try/catch because drawImage can throw
      // if the video element is not in a ready state
      try {
        canvas.width = video.videoWidth || 320;
        canvas.height = video.videoHeight || 240;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      } catch (drawErr) {
        console.warn('capturePhoto: drawImage failed (video may not be ready)', drawErr);
        // Don't block the user — continue anyway
      }

      // Stop camera
      stopCamera();

      // Show success and advance — event delegation handles the Continue button
      const controls = document.querySelector('#day2-camera .camera-controls');
      if (controls) {
        controls.innerHTML = `
          <div class="camera-success-msg animate-pop">✨ Match! ✨</div>
          <button class="btn btn-primary" id="btn-cam-done">Continue →</button>
        `;
      } else {
        goToConfirmPhase(color);
      }
    } catch (err) {
      console.error('capturePhoto error:', err);
      // Don't leave user stuck — proceed to confirm
      stopCamera();
      goToConfirmPhase(color);
    }
  }

  function stopCamera() {
    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop());
      cameraStream = null;
    }
    const video = document.getElementById('day2-cam-video');
    if (video && video.srcObject) {
      video.srcObject = null;
    }
  }

  // ==================== CONFIRM PHASE ====================

  let pendingColor = null;
  let pendingSpokenItem = null;

  function goToConfirmPhase(colorOverride) {
    try {
      if (colorOverride) pendingColor = colorOverride;
      const color = pendingColor;
      if (!color) {
        console.warn('goToConfirmPhase: no color available');
        // Show a fallback so the user isn't stuck
        const speechEl = document.getElementById('day2-speech');
        if (speechEl) {
          speechEl.innerHTML = `<div class="speech-bubble">Oops! Let's try that again.</div>`;
        }
        Audio.speak("Oops! Let's try that again.", { rate: 0.9 });
        // Reset to find phase so user can retry
        showOnly('day2-find');
        return;
      }

      showOnly('day2-confirm');

      // Show what the child found
      const state = Storage.getState();
      const itemsFound = state.day2ItemsFound || [];
      const lastItem = itemsFound[itemsFound.length - 1];

      const confirmItem = document.getElementById('day2-confirm-item');
      if (confirmItem && lastItem) {
        confirmItem.innerHTML = `
          <div class="confirm-you-found">
            <span class="confirm-you-found-label">You found:</span>
            <span class="confirm-you-found-item">${lastItem.itemName}</span>
          </div>
        `;
      }

      const examplesEl = document.getElementById('day2-examples');
      if (examplesEl) {
        const examples = color.exampleItems || [];
        examplesEl.innerHTML = examples.map(item =>
          `<div class="example-item">
            <span class="example-emoji">${getEmojiForItem(item)}</span>
            <span class="example-name">${item}</span>
          </div>`
        ).join('');
      }

      const yesBtn = document.getElementById('btn-yes');
      const noBtn = document.getElementById('btn-no');

      if (yesBtn) {
        const newYes = yesBtn.cloneNode(true);
        yesBtn.parentNode.replaceChild(newYes, yesBtn);
        newYes.addEventListener('click', () => onColorFound(color));
      }

      if (noBtn) {
        const newNo = noBtn.cloneNode(true);
        noBtn.parentNode.replaceChild(newNo, noBtn);
        newNo.addEventListener('click', () => {
          showOnly('day2-find');
          Audio.speak('Keep looking! You can do it!', { rate: 0.9 });
        });
      }

      Audio.speak('Did it look like one of these?', { rate: 0.85 });
    } catch (err) {
      console.error('goToConfirmPhase error:', err);
    }
  }

  // ==================== COMPLETION ====================

  async function onColorFound(color) {
    foundColors.push(color.id);
    Storage.addDay2Color(color.id);
    App.updateStatusBar();
    pendingColor = null;

    showOnly('day2-success');

    const successEl = document.getElementById('day2-success');
    const speechEl = document.getElementById('day2-speech');

    if (successEl) {
      successEl.style.display = 'flex';
      successEl.innerHTML = `
        <div class="color-success-card animate-pop">
          <div class="target-color-circle" style="background:${color.targetColor}">
            <span>${color.targetEmoji}</span>
          </div>
          <p>${color.targetColor.toUpperCase()} — Found!</p>
          <button class="btn btn-primary" id="btn-next-color">Next Color →</button>
        </div>
      `;

      const nextBtn = document.getElementById('btn-next-color');
      if (nextBtn) {
        nextBtn.addEventListener('click', () => {
          successEl.style.display = 'none';
          currentColorIndex++;
          startColorChallenge(currentColorIndex);
        });
      }
    }

    if (speechEl) {
      speechEl.innerHTML = `<div class="speech-bubble happy">You found something ${color.targetColor}! Amazing!</div>`;
    }
    await Audio.speak(`You found something ${color.targetColor}! Amazing!`, { rate: 0.85 });
  }

  async function completeAllColors() {
    const speechEl = document.getElementById('day2-speech');
    if (speechEl) {
      speechEl.innerHTML = `<div class="speech-bubble happy">${data.days['2'].completionText}</div>`;
    }
    await Audio.speak(data.days['2'].completionText, { rate: 0.85 });
    App.onDayComplete(2);
  }

  // ==================== HELPERS ====================

  function showOnly(showId) {
    const phases = ['day2-drag', 'day2-find', 'day2-voice', 'day2-camera', 'day2-confirm', 'day2-success'];
    phases.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = (id === showId) ? '' : 'none';
    });
  }

  function getEmojiForItem(item) {
    const map = {
      // Week 1
      carrot: '🥕', orange: '🍊', pumpkin: '🎃',
      leaf: '🍃', cucumber: '🥒', grass: '🌿',
      grape: '🍇', eggplant: '🍆', flower: '🌸',
      // Week 2
      pig: '🐖', flamingo: '🦩', flower2: '🌺',
      sky: '☁️', egg: '🥚', fish: '🐟',
      bear: '🐻', chocolate: '🍫', wood: '🪵'
    };
    return map[item] || '🔍';
  }

  let pendingTimers = new Set();

  function sleep(ms) {
    return new Promise(resolve => {
      const timer = setTimeout(() => {
        pendingTimers.delete(timer);
        resolve();
      }, ms);
      pendingTimers.add(timer);
    });
  }

  function clearPendingTimers() {
    pendingTimers.forEach(t => clearTimeout(t));
    pendingTimers.clear();
  }

  return { init, start };
})();
