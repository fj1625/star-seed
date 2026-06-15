/**
 * Star Seed - Day 5 Engine: Heart Power (Collaborative Finale)
 * Dual-touch collaboration → puzzle → plant → goodbye recording → certificate
 */
const EngineHeart = (() => {
  let data = null;
  let isActive = false;
  // Dual-touch state
  let zone1Active = false;
  let zone2Active = false;
  let holdTimer = null;
  let holdProgress = 0;

  function init(episodeData) {
    data = episodeData;
  }

  async function start() {
    isActive = true;
    const state = Storage.getState();
    if (state.completedDays.includes(5)) {
      showCertificate();
      return;
    }

    renderDay5();
    await Utils.speakIntro(5, data);
    startDualTouchPhase();
  }

  function renderDay5() {
    const container = document.getElementById('day5');
    if (!container) return;

    const dayLabel = data.days?.['5']?.tabLabel || 'Day 5';
    const dayTitle = data.days?.['5']?.title || 'Heart of the Star';

    container.innerHTML = `
      <div class="day-header">
        <span class="day-badge">${dayLabel}</span>
        <h2>❤️ Heart Power</h2>
        <p class="day-subtitle">${dayTitle}</p>
      </div>
      <div class="twinkle-speech" id="day5-speech" aria-live="polite" aria-atomic="true"></div>

      <!-- Dual-touch phase -->
      <div class="heart-phase-dual" id="heart-phase-dual">
        <div class="heart-twinkle-display">
          <div class="twinkle-needs-help">✨💔✨</div>
        </div>
        <p class="heart-message" id="heart-message">Twinkle needs BOTH of you!</p>
        <div class="dual-touch-container" id="dual-touch-container">
          <div class="dual-touch-zone" id="dual-zone-1">
            <span class="dual-zone-icon">⭐</span>
            <span class="dual-zone-label">Star<br>Guardian</span>
            <span class="dual-zone-hint">HOLD</span>
          </div>
          <div class="dual-touch-zone" id="dual-zone-2">
            <span class="dual-zone-icon">💕</span>
            <span class="dual-zone-label">Earth<br>Helper</span>
            <span class="dual-zone-hint">HOLD</span>
          </div>
        </div>
        <div class="dual-progress-bar" id="dual-progress-bar">
          <div class="dual-progress-fill" id="dual-progress-fill"></div>
        </div>
        <p class="dual-status" id="dual-status">Both hold your zones together for 3 seconds!</p>
      </div>

      <!-- Puzzle phase -->
      <div class="heart-phase-puzzle" id="heart-phase-puzzle" style="display:none">
        <p class="puzzle-instruction">Let's put Twinkle's heart back together!</p>
        <div class="puzzle-grid" id="puzzle-grid"></div>
        <div class="heart-piece-entry" id="heart-piece-entry">
          <p>Earth Helper: give the Heart Piece to your Star Guardian!</p>
          <div class="code-inputs">
            <input type="number" id="heart-code-1" min="0" max="9" maxlength="1" inputmode="numeric">
            <input type="number" id="heart-code-2" min="0" max="9" maxlength="1" inputmode="numeric">
            <input type="number" id="heart-code-3" min="0" max="9" maxlength="1" inputmode="numeric">
          </div>
          <button class="btn btn-primary" id="btn-heart-code">Check!</button>
          <p class="code-error" id="heart-code-error"></p>
        </div>
      </div>

      <!-- Plant phase -->
      <div class="heart-phase-plant" id="heart-phase-plant" style="display:none">
        <div class="plant-animation" id="plant-animation">
          <div class="seed-planting">🌰 → 🌱</div>
        </div>
        <p class="plant-message" id="plant-message-text"></p>
        <div class="countdown" id="plant-countdown" style="display:none">
          <span id="countdown-number">5</span>
        </div>
        <button class="btn btn-primary btn-large" id="btn-plant-done">🌱 It's planted!</button>
      </div>

      <!-- Goodbye recording phase -->
      <div class="heart-phase-goodbye" id="heart-phase-goodbye" style="display:none">
        <div class="goodbye-card">
          <h3>🌟 Say Goodbye to Twinkle!</h3>
          <div class="goodbye-script">
            <div class="goodbye-line parent-line">
              <span class="goodbye-role">💕 Earth Helper:</span>
              <span class="goodbye-text">"We are so proud of you!"</span>
            </div>
            <div class="goodbye-line child-line">
              <span class="goodbye-role">⭐ Star Guardian:</span>
              <span class="goodbye-text">"Bye Twinkle! Grow well!"</span>
            </div>
          </div>
          <div class="goodbye-mic-area" id="goodbye-mic-area">
            <button class="btn btn-mic" id="btn-goodbye-mic">
              <span class="mic-icon">🎤</span>
              <span class="mic-label">Record your message</span>
            </button>
            <p class="voice-status" id="goodbye-voice-status"></p>
          </div>
          <div class="voice-or-divider"><span>or type your message:</span></div>
          <div class="voice-fallback-container" id="goodbye-fallback"></div>
          <button class="btn btn-primary" id="btn-goodbye-done">✓ Done! See my certificate!</button>
        </div>
      </div>

      <!-- Success -->
      <div class="heart-success" id="day5-success" style="display:none"></div>
    `;
  }


  // ==================== DUAL-TOUCH PHASE ====================

  function startDualTouchPhase() {
    const zone1 = document.getElementById('dual-zone-1');
    const zone2 = document.getElementById('dual-zone-2');
    const progressFill = document.getElementById('dual-progress-fill');
    const status = document.getElementById('dual-status');

    zone1Active = false;
    zone2Active = false;
    holdProgress = 0;
    if (progressFill) progressFill.style.width = '0%';

    // Use pointer events for both touch and mouse
    [zone1, zone2].forEach((zone, idx) => {
      if (!zone) return;
      const zoneNum = idx + 1;

      // Remove old listeners by cloning
      const newZone = Utils.replaceWithClone(zone);
      if (idx === 0) { /* zone1 replaced */ }

      newZone.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        newZone.setPointerCapture(e.pointerId);
        newZone.classList.add('active');
        if (zoneNum === 1) zone1Active = true;
        else zone2Active = true;
        checkBothZones();
      });

      newZone.addEventListener('pointerup', (e) => {
        newZone.classList.remove('active');
        if (zoneNum === 1) zone1Active = false;
        else zone2Active = false;
        resetHold();
      });

      newZone.addEventListener('pointerleave', () => {
        newZone.classList.remove('active');
        if (zoneNum === 1) zone1Active = false;
        else zone2Active = false;
        resetHold();
      });

      newZone.addEventListener('pointercancel', () => {
        newZone.classList.remove('active');
        if (zoneNum === 1) zone1Active = false;
        else zone2Active = false;
        resetHold();
      });
    });
  }

  function checkBothZones() {
    if (zone1Active && zone2Active) {
      // Both held — start fill
      if (status) status.textContent = 'Keep holding... ❤️';
      startHoldFill();
    }
  }

  function startHoldFill() {
    if (holdTimer) return; // already counting
    const fill = document.getElementById('dual-progress-fill');
    const status = document.getElementById('dual-status');

    holdProgress = 0;
    if (fill) fill.style.transition = 'none';
    if (fill) fill.style.width = '0%';

    const duration = 3000; // 3 seconds
    const interval = 50;
    const step = (interval / duration) * 100;

    holdTimer = setInterval(() => {
      if (!zone1Active || !zone2Active) {
        resetHold();
        return;
      }

      holdProgress += step;
      if (holdProgress >= 100) {
        holdProgress = 100;
        clearInterval(holdTimer);
        holdTimer = null;
        onDualTouchComplete();
      }

      if (fill) {
        fill.style.transition = 'width 0.05s linear';
        fill.style.width = holdProgress + '%';
      }

      if (status && holdProgress > 0 && holdProgress < 100) {
        const remaining = Math.ceil((100 - holdProgress) / 33);
        status.textContent = `Keep holding... ${remaining}`;
      }
    }, interval);
  }

  function resetHold() {
    if (holdTimer) {
      clearInterval(holdTimer);
      holdTimer = null;
    }
    holdProgress = 0;
    const fill = document.getElementById('dual-progress-fill');
    const status = document.getElementById('dual-status');
    if (fill) { fill.style.transition = 'width 0.2s ease-out'; fill.style.width = '0%'; }
    if (status) { status.textContent = 'Both hold your zones together for 3 seconds!'; }
  }

  async function onDualTouchComplete() {
    const dualPhase = document.getElementById('heart-phase-dual');
    const speechEl = document.getElementById('day5-speech');

    // Celebration
    if (dualPhase) {
      dualPhase.querySelector('.dual-touch-container').innerHTML = `
        <div class="dual-celebration animate-pop">❤️✨❤️</div>
      `;
    }

    if (speechEl) {
      speechEl.innerHTML = `<div class="speech-bubble happy">You did it together! Now let's finish the mission!</div>`;
    }
    await Audio.speak('You did it together! Now let\'s finish the mission!', { rate: 0.85 });

    const buildSteps = data.days?.['5']?.buildSteps;

    setTimeout(() => {
      if (dualPhase) dualPhase.style.display = 'none';

      if (buildSteps && buildSteps.length > 0) {
        showBuildPhase();
      } else {
        const puzzlePhase = document.getElementById('heart-phase-puzzle');
        if (puzzlePhase) puzzlePhase.style.display = 'block';
        buildPuzzle([]);
        startRecallChallenge();
      }
    }, 2000);
  }

  // ==================== PUZZLE PHASE ====================

  function buildPuzzle(unlockedPieces = []) {
    const grid = document.getElementById('puzzle-grid');
    if (!grid) return;

    const pieces = [
      { power: 'light', emoji: '🔆', color: '#FFD700', label: 'Light' },
      { power: 'color', emoji: '🌈', color: '#FF6B9D', label: 'Color' },
      { power: 'sound', emoji: '🎵', color: '#4ECDC4', label: 'Sound' },
      { power: 'motion', emoji: '💫', color: '#A78BFA', label: 'Motion' },
      { power: 'heart', emoji: '❤️', color: '#EF4444', label: 'Heart', missing: true }
    ];

    grid.innerHTML = pieces.map(p => {
      const isUnlocked = unlockedPieces.includes(p.power);
      if (!isUnlocked) {
        return `
          <div class="puzzle-piece missing" id="piece-${p.power}">
            <div class="piece-inner">
              <span class="piece-question">❓</span>
              <span class="piece-label">?</span>
            </div>
          </div>
        `;
      }
      return `
        <div class="puzzle-piece placed animate-pop" id="piece-${p.power}" style="--piece-color:${p.color}">
          <div class="piece-inner">
            <span class="piece-emoji">${p.emoji}</span>
            <span class="piece-label">${p.label}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  function unlockPuzzlePiece(power) {
    const piece = document.getElementById(`piece-${power}`);
    if (!piece) return;

    const pieceData = {
      light: { emoji: '🔆', color: '#FFD700', label: 'Light' },
      color: { emoji: '🌈', color: '#FF6B9D', label: 'Color' },
      sound: { emoji: '🎵', color: '#4ECDC4', label: 'Sound' },
      motion: { emoji: '💫', color: '#A78BFA', label: 'Motion' }
    };

    const p = pieceData[power];
    if (!p) return;

    piece.classList.remove('missing');
    piece.classList.add('placed', 'animate-pop');
    piece.style.setProperty('--piece-color', p.color);
    piece.querySelector('.piece-inner').innerHTML = `
      <span class="piece-emoji">${p.emoji}</span>
      <span class="piece-label">${p.label}</span>
    `;
  }

  async function startRecallChallenge() {
    const speechEl = document.getElementById('day5-speech');
    const codeEntry = document.getElementById('heart-piece-entry');

    // Hide code entry initially
    if (codeEntry) codeEntry.style.display = 'none';

    const questions = data.days?.['5']?.recallQuestions || [];
    if (!questions.length) {
      console.warn('[EngineHeart] no recallQuestions, skipping recall challenge');
      showCodeEntry();
      return;
    }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const success = await askRecallQuestion(q, i + 1, questions.length);
      if (success) {
        unlockPuzzlePiece(q.puzzlePiecePower);
        await Audio.speak(`Yes! ${q.hint}`, { rate: 0.85 });
        await Utils.sleep(800);
      }
    }

    // All questions answered
    if (speechEl) {
      speechEl.innerHTML = `<div class="speech-bubble happy">All pieces are back! Now complete the heart!</div>`;
    }
    await Audio.speak('All pieces are back! Earth Helper, give the Heart Piece card to your Star Guardian!', { rate: 0.85 });

    // Show code entry
    if (codeEntry) codeEntry.style.display = 'block';
    setupHeartCodeEntry();
  }

  async function askRecallQuestion(q, current, total) {
    const puzzlePhase = document.getElementById('heart-phase-puzzle');
    const speechEl = document.getElementById('day5-speech');

    // Create or update recall UI
    let recallArea = document.getElementById('recall-challenge-area');
    if (!recallArea) {
      recallArea = document.createElement('div');
      recallArea.id = 'recall-challenge-area';
      recallArea.className = 'recall-challenge';
      puzzlePhase.appendChild(recallArea);
    }

    recallArea.innerHTML = `
      <div class="recall-progress">Question ${current} of ${total}</div>
      <div class="recall-day-badge">Day ${q.day} ${q.emoji}</div>
      <p class="recall-prompt">${q.prompt}</p>
      <div class="voice-mic-area">
        <button class="btn btn-mic" id="recall-mic-btn">🎤 Tap to Answer</button>
        <p class="voice-status" id="recall-voice-status"></p>
      </div>
      <div class="voice-fallback-container" id="recall-fallback"></div>
      <button class="btn btn-skip" id="recall-skip-btn" style="margin-top:8px;">Skip →</button>
    `;

    if (speechEl) {
      speechEl.innerHTML = `<div class="speech-bubble">${q.prompt}</div>`;
    }
    await Audio.speak(q.prompt, { rate: 0.85, cancelPrevious: true });

    return new Promise((resolve) => {
      const micBtn = document.getElementById('recall-mic-btn');
      const statusEl = document.getElementById('recall-voice-status');
      const skipBtn = document.getElementById('recall-skip-btn');
      const fallbackContainer = document.getElementById('recall-fallback');

      let resolved = false;

      const checkAnswer = (text) => {
        const lowerText = text.toLowerCase().trim();

        // Day 4 open-ended: any action verb accepted
        if (q.isOpenEnded) {
          const day4Actions = data.days['4'].actions;
          return day4Actions.some(a => lowerText.includes(a.verb.toLowerCase()));
        }

        // Standard: check accepted answers
        return q.acceptedAnswers.some(ans => lowerText.includes(ans.toLowerCase()));
      };

      const onAnswer = (text) => {
        if (resolved) return;
        if (checkAnswer(text)) {
          resolved = true;
          if (statusEl) statusEl.innerHTML = '<span class="voice-heard">✅ Correct!</span>';
          resolve(true);
        } else {
          if (statusEl) statusEl.innerHTML = `<span class="voice-error">💡 ${q.hint}</span>`;
          Audio.speak(`Not quite. ${q.hint}`, { rate: 0.9 });
        }
      };

      const onSkip = () => {
        if (resolved) return;
        resolved = true;
        resolve(true);
      };

      if (micBtn) {
        micBtn.addEventListener('click', () => {
          VoiceInput.listen({
            lang: 'en-US',
            onResult: onAnswer,
            onError: () => {
              if (statusEl) statusEl.innerHTML = '<span class="voice-error">Try again or type below!</span>';
            }
          });
        });
      }

      if (skipBtn) {
        skipBtn.addEventListener('click', onSkip);
      }

      if (fallbackContainer) {
        VoiceInput.renderFallbackInput(fallbackContainer, {
          placeholder: 'Type your answer...',
          buttonText: 'Check',
          onSubmit: onAnswer
        });
      }
    });
  }

  function setupHeartCodeEntry() {
    const d1 = document.getElementById('heart-code-1');
    const d2 = document.getElementById('heart-code-2');
    const d3 = document.getElementById('heart-code-3');
    const checkBtn = document.getElementById('btn-heart-code');
    const errorEl = document.getElementById('heart-code-error');

    [d1, d2, d3].forEach((input, i) => {
      if (!input) return;
      input.value = '';
      const newInput = Utils.replaceWithClone(input);
      newInput.addEventListener('input', (e) => {
        const val = e.target.value.replace(/[^0-9]/g, '');
        e.target.value = val.slice(0, 1);
        if (val && i < 2) {
          const next = document.getElementById('heart-code-' + (i + 2));
          if (next) next.focus();
        }
        if (val && i === 2) {
          setTimeout(() => {
            const btn = document.getElementById('btn-heart-code');
            if (btn) btn.click();
          }, 300);
        }
      });
      newInput.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !newInput.value && i > 0) {
          const prev = document.getElementById('heart-code-' + i);
          if (prev) prev.focus();
        }
      });
    });

    if (checkBtn) {
      const newCheck = Utils.replaceWithClone(checkBtn);
      newCheck.addEventListener('click', async () => {
        const v1 = document.getElementById('heart-code-1');
        const v2 = document.getElementById('heart-code-2');
        const v3 = document.getElementById('heart-code-3');
        const entered = (v1?.value || '') + (v2?.value || '') + (v3?.value || '');
        const heartCode = data.days['5'].heartPieceCode;

        if (entered === heartCode) {
          onHeartPiecePlaced();
        } else {
          const err = document.getElementById('heart-code-error');
          if (err) {
            err.textContent = 'Not quite... Check the back of the Heart Piece card!';
            err.style.display = 'block';
            setTimeout(() => { err.style.display = 'none'; }, 3000);
          }
          Audio.speak('Not quite right. Check the back of the Heart Piece card!', { rate: 0.9 });
        }
      });
    }
  }

  async function onHeartPiecePlaced() {
    const heartPiece = document.getElementById('piece-heart');
    if (heartPiece) {
      heartPiece.classList.remove('missing');
      heartPiece.classList.add('placed', 'animate-pop');
      heartPiece.style.setProperty('--piece-color', '#EF4444');
      heartPiece.querySelector('.piece-inner').innerHTML = `
        <span class="piece-emoji">❤️</span>
        <span class="piece-label">Heart</span>
      `;
    }

    const codeEntry = document.getElementById('heart-piece-entry');
    if (codeEntry) codeEntry.style.display = 'none';

    const speechEl = document.getElementById('day5-speech');
    if (speechEl) {
      speechEl.innerHTML = `<div class="speech-bubble happy">The heart is complete! Now Twinkle wants to stay with you!</div>`;
    }
    await Audio.speak('The heart is complete! Now Twinkle wants to stay with you. Will you plant a seed?', { rate: 0.85 });

    setTimeout(() => showPlantPhase(), 2000);
  }

  // ==================== BUILD SHELTER PHASE ====================

  function showBuildPhase() {
    const container = document.getElementById('day5');
    if (!container) return;

    // Insert build phase UI if not present
    let buildPhase = document.getElementById('heart-phase-build');
    if (!buildPhase) {
      buildPhase = document.createElement('div');
      buildPhase.id = 'heart-phase-build';
      buildPhase.className = 'heart-phase-build';
      container.appendChild(buildPhase);
    }

    buildPhase.style.display = 'flex';
    buildPhase.innerHTML = `
      <div class="build-stage" id="build-stage"></div>
      <div class="build-progress-bar">
        <div class="build-progress-fill" id="build-progress-fill"></div>
      </div>
    `;

    renderBuildStep(0);
  }

  function renderBuildStep(stepIndex) {
    const buildSteps = data.days?.['5']?.buildSteps || [];
    if (stepIndex >= buildSteps.length) {
      onBuildComplete();
      return;
    }

    const step = buildSteps[stepIndex];
    const stage = document.getElementById('build-stage');
    const progressFill = document.getElementById('build-progress-fill');
    const speechEl = document.getElementById('day5-speech');

    if (progressFill) {
      progressFill.style.width = `${((stepIndex) / buildSteps.length) * 100}%`;
    }

    if (stage) {
      stage.innerHTML = `
        <div class="build-step-card animate-pop">
          <div class="build-step-emoji">${step.emoji}</div>
          <h3 class="build-step-title">${step.title}</h3>
          <p class="build-step-instruction">${step.instruction}</p>
          <p class="build-step-english">🗣️ Say it: "${step.english}"</p>
        </div>
        <button class="btn btn-primary btn-large" id="btn-build-step-done">✓ Done! Next →</button>
      `;

      const nextBtn = document.getElementById('btn-build-step-done');
      if (nextBtn) {
        nextBtn.addEventListener('click', async () => {
          if (speechEl) {
            speechEl.innerHTML = `<div class="speech-bubble happy">${step.english}</div>`;
          }
          await Audio.speak(step.english, { rate: 0.85 });
          renderBuildStep(stepIndex + 1);
        });
      }
    }

    if (speechEl) {
      speechEl.innerHTML = `<div class="speech-bubble">${step.title}. ${step.instruction}</div>`;
    }
    Audio.speak(`${step.title}. ${step.instruction}. Say: ${step.english}`, { rate: 0.85 });
  }

  async function onBuildComplete() {
    const buildPhase = document.getElementById('heart-phase-build');
    const progressFill = document.getElementById('build-progress-fill');
    const speechEl = document.getElementById('day5-speech');

    if (progressFill) progressFill.style.width = '100%';

    if (speechEl) {
      speechEl.innerHTML = `<div class="speech-bubble happy">The shelter is built! Now tell Twinkle about it!</div>`;
    }
    await Audio.speak('The shelter is built! Now tell Twinkle about it!', { rate: 0.85 });

    if (buildPhase) buildPhase.style.display = 'none';

    showDescriptionPhase();
  }

  // ==================== DESCRIPTION PHASE ====================

  function showDescriptionPhase() {
    const container = document.getElementById('day5');
    if (!container) return;

    let descPhase = document.getElementById('heart-phase-description');
    if (!descPhase) {
      descPhase = document.createElement('div');
      descPhase.id = 'heart-phase-description';
      descPhase.className = 'heart-phase-description';
      container.appendChild(descPhase);
    }

    descPhase.style.display = 'flex';
    descPhase.innerHTML = `
      <div class="description-stage" id="description-stage"></div>
    `;

    renderDescriptionPrompt(0);
  }

  function renderDescriptionPrompt(promptIndex) {
    const prompts = data.days?.['5']?.descriptionPrompts || [];
    if (promptIndex >= prompts.length) {
      onDescriptionComplete();
      return;
    }

    const prompt = prompts[promptIndex];
    const stage = document.getElementById('description-stage');
    const speechEl = document.getElementById('day5-speech');

    if (stage) {
      stage.innerHTML = `
        <div class="description-card animate-pop">
          <div class="description-emoji">🎤</div>
          <p class="description-question">${prompt.question}</p>
          <p class="description-hint">${prompt.hint}</p>
          <div class="description-mic-area">
            <button class="btn btn-mic" id="btn-desc-mic">🎤 Tap to Answer</button>
            <p class="voice-status" id="desc-voice-status"></p>
          </div>
          <div class="voice-fallback-container" id="desc-fallback"></div>
        </div>
        <button class="btn btn-skip" id="btn-desc-skip">Skip →</button>
      `;

      const micBtn = document.getElementById('btn-desc-mic');
      const statusEl = document.getElementById('desc-voice-status');
      const fallbackContainer = document.getElementById('desc-fallback');
      const skipBtn = document.getElementById('btn-desc-skip');

      const onAnswer = async (text) => {
        if (statusEl) statusEl.innerHTML = `<span class="voice-heard">✅ "${text}"</span>`;
        if (speechEl) {
          speechEl.innerHTML = `<div class="speech-bubble happy">Good job! You said: ${text}</div>`;
        }
        await Audio.speak(`Good job! You said: ${text}`, { rate: 0.85 });

        // Save answer
        const state = Storage.getState();
        if (!state.day5ShelterAnswers) state.day5ShelterAnswers = [];
        state.day5ShelterAnswers.push({ question: prompt.question, answer: text });
        Storage.save();

        await Utils.sleep(800);
        renderDescriptionPrompt(promptIndex + 1);
      };

      if (micBtn) {
        const newMic = Utils.replaceWithClone(micBtn);
        newMic.addEventListener('click', () => {
          VoiceInput.listen({
            lang: 'en-US',
            onInterim: (text) => {
              if (statusEl) statusEl.innerHTML = `<span class="voice-hearing">👂 "${text}"</span>`;
            },
            onResult: onAnswer,
            onError: () => {
              if (statusEl) statusEl.innerHTML = '<span class="voice-error">Try typing below!</span>';
            }
          });
        });
      }

      if (fallbackContainer) {
        VoiceInput.renderFallbackInput(fallbackContainer, {
          placeholder: 'Type your answer...',
          buttonText: 'Send',
          onSubmit: onAnswer
        });
      }

      if (skipBtn) {
        skipBtn.addEventListener('click', () => renderDescriptionPrompt(promptIndex + 1));
      }
    }

    if (speechEl) {
      speechEl.innerHTML = `<div class="speech-bubble">${prompt.question}</div>`;
    }
    Audio.speak(prompt.question, { rate: 0.85 });
  }

  async function onDescriptionComplete() {
    const descPhase = document.getElementById('heart-phase-description');
    const speechEl = document.getElementById('day5-speech');

    if (descPhase) descPhase.style.display = 'none';

    if (speechEl) {
      speechEl.innerHTML = `<div class="speech-bubble happy">${data.days['5'].completionText}</div>`;
    }
    await Audio.speak(data.days['5'].completionText, { rate: 0.85 });

    App.onDayComplete(5);
  }

  // ==================== PLANT PHASE ====================

  function showPlantPhase() {
    const puzzlePhase = document.getElementById('heart-phase-puzzle');
    const plantPhase = document.getElementById('heart-phase-plant');
    const plantMsg = document.getElementById('plant-message-text');
    const speechEl = document.getElementById('day5-speech');

    if (puzzlePhase) puzzlePhase.style.display = 'none';
    if (plantPhase) plantPhase.style.display = 'flex';

    if (plantMsg) plantMsg.textContent = data.days['5'].plantMessage;

    if (speechEl) {
      speechEl.innerHTML = `<div class="speech-bubble">Earth Helper: give your child a real seed!</div>`;
    }
    Audio.speak('Earth Helper! Give your Star Guardian a real seed and a little pot with soil!', { rate: 0.85 });

    const plantBtn = document.getElementById('btn-plant-done');
    const countdownEl = document.getElementById('plant-countdown');
    const countNum = document.getElementById('countdown-number');

    if (plantBtn) {
      const newPlant = Utils.replaceWithClone(plantBtn);
      newPlant.addEventListener('click', async () => {
        newPlant.style.display = 'none';
        if (countdownEl) countdownEl.style.display = 'block';

        for (let i = 5; i >= 1; i--) {
          if (countNum) countNum.textContent = i;
          await Audio.speak(String(i), { rate: 0.7 });
          await Utils.sleep(1000);
        }

        if (countNum) countNum.textContent = '🌱';
        await Audio.speak('Plant the seed now!', { rate: 0.8 });

        setTimeout(() => onPlantComplete(), 1500);
      });
    }
  }

  async function onPlantComplete() {
    const plantPhase = document.getElementById('heart-phase-plant');
    if (plantPhase) plantPhase.style.display = 'none';

    const speechEl = document.getElementById('day5-speech');
    if (speechEl) {
      speechEl.innerHTML = `<div class="speech-bubble happy">It's planted! Now let's say goodbye to Twinkle...</div>`;
    }
    await Audio.speak('It\'s planted! Now let\'s say goodbye to Twinkle together!', { rate: 0.85 });

    showGoodbyeRecording();
  }

  // ==================== GOODBYE RECORDING ====================

  function showGoodbyeRecording() {
    const goodbyePhase = document.getElementById('heart-phase-goodbye');
    if (goodbyePhase) goodbyePhase.style.display = 'flex';

    const micBtn = document.getElementById('btn-goodbye-mic');
    const voiceStatus = document.getElementById('goodbye-voice-status');
    const fallbackContainer = document.getElementById('goodbye-fallback');
    let goodbyeTranscript = '';

    if (micBtn) {
      const newMic = Utils.replaceWithClone(micBtn);

      newMic.addEventListener('click', () => {
        if (VoiceInput.isActive()) {
          VoiceInput.stop();
          newMic.classList.remove('listening');
          return;
        }

        VoiceInput.listen({
          lang: 'en-US',
          onInterim: (text) => {
            if (voiceStatus) voiceStatus.innerHTML = `<span class="voice-hearing">👂 "${text}"</span>`;
            newMic.classList.add('listening');
          },
          onResult: (text) => {
            newMic.classList.remove('listening');
            goodbyeTranscript = text;
            if (voiceStatus) voiceStatus.innerHTML = `<span class="voice-heard">✅ "${text}"</span>`;
          },
          onError: (errorType) => {
            newMic.classList.remove('listening');
            if (voiceStatus) voiceStatus.innerHTML = '<span class="voice-error">Try typing below!</span>';
          }
        });
      });
    }

    // Text fallback
    if (fallbackContainer) {
      VoiceInput.renderFallbackInput(fallbackContainer, {
        placeholder: 'Write your goodbye message...',
        buttonText: 'Save',
        onSubmit: (text) => {
          goodbyeTranscript = text;
          if (voiceStatus) voiceStatus.innerHTML = `<span class="voice-heard">✅ "${text}"</span>`;
        }
      });
    }

    // Done button
    const doneBtn = document.getElementById('btn-goodbye-done');
    if (doneBtn) {
      const newDone = Utils.replaceWithClone(doneBtn);
      newDone.addEventListener('click', async () => {
        // Save to storage
        const playerName = Storage.getState().playerName || 'Star Guardian';
        const twinkleResponse = `Thank you ${playerName}! I'll grow big and strong, just like you! Goodbye for now...`;

        const state = Storage.getState();
        state.day5GoodbyeMessage = {
          transcript: goodbyeTranscript || '(silent hug)',
          twinkleResponse: twinkleResponse,
          timestamp: new Date().toISOString()
        };
        Storage.save();

        // Twinkle's final response
        const speechEl = document.getElementById('day5-speech');
        if (speechEl) {
          speechEl.innerHTML = `<div class="speech-bubble happy">${twinkleResponse} 🌱✨</div>`;
        }
        await Audio.speak(twinkleResponse, { rate: 0.85 });

        if (goodbyePhase) goodbyePhase.style.display = 'none';
        App.onDayComplete(5);
      });
    }
  }

  // ==================== CERTIFICATE ====================

  function showCertificate() {
    const container = document.getElementById('complete');
    if (!container) return;

    const day5Data = data.days?.['5'] || {};
    const playerName = Storage.getState().playerName || 'Star Guardian';
    const goodbyeMsg = Storage.getState().day5GoodbyeMessage;

    container.innerHTML = `
      <div class="certificate-page">
        <div class="certificate animate-pop">
          <div class="certificate-border">
            <div class="certificate-stars-top">⭐ ✨ ⭐ ✨ ⭐</div>
            <h2 class="certificate-title">${day5Data.certificateTitle}</h2>
            <div class="certificate-twinkle">🌟</div>
            <p class="certificate-text">${day5Data.certificateText}</p>
            <div class="certificate-name-area">
              <label for="cert-name">Your name:</label>
              <input type="text" id="cert-name" placeholder="Enter your name..." value="${playerName !== 'Star Guardian' ? playerName : ''}">
              <button class="btn btn-small" id="btn-save-name">Save</button>
            </div>
            ${goodbyeMsg ? `
            <div class="certificate-goodbye">
              <p class="goodbye-quote-label">Your goodbye to Twinkle:</p>
              <div class="goodbye-quote-card">
                <p class="goodbye-quote-text">"${goodbyeMsg.transcript}"</p>
                <button class="btn btn-tiny" id="btn-replay-goodbye">🔊 Replay</button>
              </div>
            </div>
            ` : ''}
            <p class="certificate-subtext">${day5Data.certificateSubtext}</p>
            <div class="certificate-date">${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
            <div class="certificate-signature">
              <span class="sig-star">⭐</span>
              <span class="sig-text">Twinkle</span>
            </div>
          </div>
        </div>

        <!-- Week 2 Unlock / More Episodes -->
        <div class="episode-preview" id="cert-episode-preview">
          <h3 id="preview-heading">More Adventures!</h3>
          <div class="preview-weeks" id="preview-weeks">
            <!-- Populated dynamically based on unlocked episodes -->
          </div>
        </div>
        <button class="btn btn-primary" id="btn-restart-game">Play Again? 🔄</button>
      </div>
    `;

    // Bind name save
    document.getElementById('btn-save-name')?.addEventListener('click', () => {
      const name = document.getElementById('cert-name')?.value || 'Star Guardian';
      Storage.setPlayerName(name);
      Audio.speak(`Congratulations, ${name}! You are a true Star Guardian!`, { rate: 0.85 });
    });

    // Replay goodbye
    document.getElementById('btn-replay-goodbye')?.addEventListener('click', () => {
      if (goodbyeMsg && goodbyeMsg.twinkleResponse) {
        Audio.speak(goodbyeMsg.twinkleResponse, { rate: 0.85 });
      }
    });

    // Build dynamic episode preview
    buildEpisodePreview();

    // Preview sound — delegate to dynamic button
    document.getElementById('btn-preview-sound')?.addEventListener('click', () => {
      Audio.speak('Ooh ooh! Ah ah! Let\'s go on a new adventure!', { rate: 0.8, pitch: 1.5 });
    });

    // Go to Week 2 button
    document.getElementById('btn-go-ep02')?.addEventListener('click', async () => {
      await App.switchEpisode('ep02');
      App.showScene('intro');
    });

    // Restart
    document.getElementById('btn-restart-game')?.addEventListener('click', () => {
      if (confirm('Start over? All progress will be reset.')) {
        Storage.resetAll();
        window.location.reload();
      }
    });

    // Speak
    const name = playerName !== 'Star Guardian' ? playerName : '';
    Audio.speak(`Congratulations${name ? ', ' + name : ''}! You completed all 5 Star Seed challenges!`, { rate: 0.85 });
  }

  /** Build episode preview cards on certificate */
  function buildEpisodePreview() {
    const container = document.getElementById('preview-weeks');
    const heading = document.getElementById('preview-heading');
    if (!container) return;

    const state = Storage.getState();
    const isOutdoor = state.episodeId === 'ep05-outdoor';
    const ep01Completed = state.completedEpisodes.includes('ep01');
    const ep02Completed = state.completedEpisodes.includes('ep02');

    // Outdoor certificate: show "Back to Main Game" link
    if (isOutdoor) {
      if (heading) heading.textContent = 'You are a Nature Explorer! 🌿';
      container.innerHTML = `
        <div class="preview-week completed" style="justify-content:center">
          <span class="preview-icon">🌿</span>
          <span class="preview-label">Nature Explorer — Complete!</span>
          <span class="preview-status">✅</span>
        </div>
        <div class="preview-week unlocked" style="justify-content:center">
          <button class="btn btn-tiny btn-go-episode" id="btn-back-home">🏠 Back to Main Game</button>
        </div>
      `;
      // Bind back-to-home button
      const backBtn = container.querySelector('#btn-back-home');
      if (backBtn) {
        backBtn.addEventListener('click', async () => {
          await App.switchEpisode('ep01');
          App.showScene('intro');
        });
      }
      return;
    }

    const episodes = [
      {
        id: 'ep01', icon: '🏠', label: 'Week 1: My Home',
        completed: ep01Completed,
        unlocked: true,
        teaser: null
      },
      {
        id: 'ep02', icon: '🐾', label: 'Week 2: Animals',
        completed: ep02Completed,
        unlocked: ep01Completed || ep02Completed,
        teaser: ep01Completed ? null : '🔜 Complete Week 1 to unlock!',
        action: ep01Completed ? 'go' : 'preview',
        animal: '🐵', sound: 'Ooh ooh! Ah ah!'
      },
      {
        id: 'ep03', icon: '🍎', label: 'Week 3: Body & Food',
        completed: false,
        unlocked: false,
        teaser: '🔒 Coming soon!'
      },
      {
        id: 'ep04', icon: '🌿', label: 'Week 4: Nature',
        completed: false,
        unlocked: false,
        teaser: '🔒 Coming soon!'
      }
    ];

    if (heading) {
      heading.textContent = ep02Completed
        ? 'All Adventures Complete! 🎉'
        : 'More Adventures!';
    }

    container.innerHTML = episodes.map(ep => {
      let statusHtml = '';
      let extraClass = '';
      let actionHtml = '';

      if (ep.completed) {
        extraClass = 'completed';
        statusHtml = '<span class="preview-status">✅ Done!</span>';
      } else if (ep.unlocked && ep.action === 'go') {
        extraClass = 'unlocked';
        actionHtml = `<button class="btn btn-tiny btn-go-episode" id="btn-go-${ep.id}">▶ Play!</button>`;
      } else if (!ep.unlocked) {
        extraClass = 'locked';
        statusHtml = `<span class="preview-lock">🔒</span>`;
        if (ep.teaser) {
          statusHtml += `<span class="preview-teaser-text">${ep.teaser}</span>`;
        }
      } else {
        // ep01 unlocked but not completed
        extraClass = 'unlocked';
      }

      // Animal sound preview for ep02 when not yet unlocked
      if (ep.id === 'ep02' && !ep.unlocked && ep.animal) {
        actionHtml = `<button class="btn btn-tiny btn-preview-sound" id="btn-preview-sound">🎵 Hear a friend</button>
          <div class="preview-teaser-animal"><span class="peek-animal">${ep.animal}</span></div>`;
      }

      return `
        <div class="preview-week ${extraClass}">
          <span class="preview-icon">${ep.icon}</span>
          <span class="preview-label">${ep.label}</span>
          ${statusHtml}
          ${actionHtml}
        </div>
      `;
    }).join('');

    // Bind episode go buttons
    container.querySelectorAll('.btn-go-episode').forEach(btn => {
      btn.addEventListener('click', async () => {
        const epId = btn.id.replace('btn-go-', '');
        if (epId === 'ep02') {
          await App.switchEpisode('ep02');
        }
      });
    });

    // Bind preview sound
    const previewSoundBtn = container.querySelector('#btn-preview-sound');
    if (previewSoundBtn) {
      previewSoundBtn.addEventListener('click', () => {
        Audio.speak('Ooh ooh! Ah ah! I\'ll see you soon!', { rate: 0.8, pitch: 1.5 });
      });
    }
  }

  function stop() {
    isActive = false;
    if (holdTimer) { clearInterval(holdTimer); holdTimer = null; }
    resetHold();
    Audio.cancel();
  }

  return { init, start, stop, showCertificate };
})();
