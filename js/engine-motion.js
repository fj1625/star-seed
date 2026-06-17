/**
 * Star Seed - Day 4 Engine: Motion Power (Star Dance)
 * TPR action sequences — child follows dance moves, building from 2 to 5 actions
 */
const EngineMotion = (() => {
  let data = null;
  let actions = [];
  let rounds = [];
  let currentRound = 0;
  let currentActionIndex = 0;
  let roundActions = [];
  let isActive = false;

  function init(episodeData) {
    data = episodeData;
    actions = episodeData.days['4'].actions;
    rounds = episodeData.days['4'].rounds; // [2, 3, 4, 5]
  }

  async function start() {
    isActive = true;
    const savedRound = Storage.getState().day4HighestRound;
    currentRound = savedRound > 0 ? savedRound : 0;

    if (currentRound >= rounds.length) {
      App.onDayComplete(4);
      return;
    }

    renderDay4();
    await Utils.speakIntro(4, data);
    startDanceRound(currentRound);
  }

  function renderDay4() {
    const container = document.getElementById('day4');
    if (!container) return;

    const dayLabel = data.days?.['4']?.tabLabel || 'Day 4';
    const dayTitle = data.days?.['4']?.title || 'Star Dance';

    container.innerHTML = `
      <div class="day-header">
        <span class="day-badge">${dayLabel}</span>
        <h2>🤸 Motion Power</h2>
        <p class="day-subtitle">${dayTitle}</p>
      </div>
      <div class="twinkle-speech" id="day4-speech" aria-live="polite" aria-atomic="true"></div>
      <div class="dance-stage" id="dance-stage">
        <div class="twinkle-dancer" id="twinkle-dancer">
          <div class="twinkle-body">✨</div>
        </div>
        <div class="dance-action-display" id="dance-action-display">
          <div class="action-emoji" id="action-emoji">👀</div>
          <div class="action-text" id="action-text">Get ready...</div>
        </div>
        <div class="dance-counter" id="dance-counter"></div>
      </div>
      <div class="dance-controls">
        <button class="btn btn-primary btn-large" id="btn-start-dance">Start Dancing! 💃</button>
        <button class="btn btn-done" id="btn-action-done" style="display:none">✓ DONE!</button>
      </div>
      <div class="dance-progress" id="dance-progress">
        <p>Round <span id="round-num">1</span> of ${rounds.length}</p>
        <div class="round-dots" id="round-dots"></div>
      </div>
      <div class="dance-success" id="day4-success" style="display:none"></div>
    `;

    // Round dots
    const roundDots = document.getElementById('round-dots');
    if (roundDots) {
      roundDots.innerHTML = rounds.map((r, i) => {
        const rDef = typeof r === 'number' ? { count: r } : r;
        const icon = i < currentRound ? '⭐' : (rDef.dotEmoji || (i + 1));
        return `<span class="round-dot ${i < currentRound ? 'done' : ''} ${i === currentRound ? 'active' : ''}" id="rdot-${i}">
          ${icon}
        </span>`;
      }).join('');
    }

    document.getElementById('round-num').textContent = currentRound + 1;
  }


  async function startDanceRound(roundIdx) {
    if (roundIdx >= rounds.length) {
      onAllRoundsComplete();
      return;
    }

    const roundDef = rounds[roundIdx];
    const numActions = typeof roundDef === 'number' ? roundDef : (roundDef.count || 2);
    const mode = typeof roundDef === 'number' ? 'watch' : (roundDef.mode || 'watch');

    // Pick random actions for non-freeze modes
    if (mode !== 'freeze') {
      const shuffled = [...actions].sort(() => Math.random() - 0.5);
      roundActions = shuffled.slice(0, numActions);
    } else {
      roundActions = [];
    }
    currentActionIndex = 0;

    const actionDisplay = document.getElementById('dance-action-display');
    const startBtn = document.getElementById('btn-start-dance');
    const doneBtn = document.getElementById('btn-action-done');
    const speechEl = document.getElementById('day4-speech');

    // Update round display
    const roundNumEl = document.getElementById('round-num');
    if (roundNumEl) roundNumEl.textContent = roundIdx + 1;

    // Update round dots: mark completed, set active on current
    for (let i = 0; i < rounds.length; i++) {
      const dot = document.getElementById('rdot-' + i);
      if (!dot) continue;
      dot.classList.remove('active');
      const rDef = typeof rounds[i] === 'number' ? { count: rounds[i] } : rounds[i];
      if (i < roundIdx) {
        dot.classList.add('done');
        dot.textContent = '⭐';
      } else if (i === roundIdx) {
        dot.classList.add('active');
        dot.textContent = rDef.dotEmoji || (i + 1);
      } else {
        dot.textContent = rDef.dotEmoji || (i + 1);
      }
    }

    // Show start button with mode-appropriate text
    if (startBtn) {
      startBtn.style.display = 'block';
      if (mode === 'freeze') {
        startBtn.textContent = `Round ${roundIdx + 1}: Freeze Dance! 🧊`;
      } else if (mode === 'create') {
        startBtn.textContent = `Round ${roundIdx + 1}: Learn & Create! 🎨`;
      } else {
        startBtn.textContent = `Round ${roundIdx + 1}: ${numActions} moves! 🎯`;
      }
    }
    if (doneBtn) doneBtn.style.display = 'none';
    if (actionDisplay) actionDisplay.style.display = 'none';

    // Dispatch to mode-specific setup
    if (mode === 'freeze') {
      setupFreezeRound(roundIdx, roundDef, startBtn, speechEl);
    } else if (mode === 'create') {
      setupCreateRound(roundIdx, roundDef, startBtn, speechEl);
    } else {
      setupWatchRound(roundIdx, numActions, startBtn, doneBtn, speechEl);
    }
  }

  async function performActionSequence(index) {
    if (index >= roundActions.length) {
      // All actions shown, now it's the child's turn
      await showChildTurn();
      return;
    }

    const action = roundActions[index];
    const actionDisplay = document.getElementById('dance-action-display');
    const actionEmoji = document.getElementById('action-emoji');
    const actionText = document.getElementById('action-text');
    const dancerEl = document.getElementById('twinkle-dancer');
    const speechEl = document.getElementById('day4-speech');

    if (actionDisplay) actionDisplay.style.display = 'flex';
    if (actionEmoji) actionEmoji.textContent = action.emoji;
    if (actionText) actionText.textContent = action.instruction;

    // Animate Twinkle
    if (dancerEl) {
      dancerEl.className = 'twinkle-dancer';
      dancerEl.classList.add(`twinkle-${action.twinkleAnimation}`);
    }

    if (speechEl) {
      speechEl.innerHTML = `<div class="speech-bubble">${action.instruction}</div>`;
    }
    await Audio.speak(action.instruction, { rate: 0.85 });

    // Pause, then next
    await Utils.sleep(1200);
    await performActionSequence(index + 1);
  }

  async function performShadowSequence(index) {
    if (index >= roundActions.length) {
      await onShadowRoundComplete();
      return;
    }

    const action = roundActions[index];
    currentActionIndex = index;

    const actionDisplay = document.getElementById('dance-action-display');
    const actionEmoji = document.getElementById('action-emoji');
    const actionText = document.getElementById('action-text');
    const doneBtn = document.getElementById('btn-action-done');
    const dancerEl = document.getElementById('twinkle-dancer');
    const speechEl = document.getElementById('day4-speech');
    const counterEl = document.getElementById('dance-counter');

    if (actionDisplay) {
      actionDisplay.style.display = 'flex';
      actionDisplay.classList.remove('your-turn');
    }

    // Show silhouette instead of emoji
    if (actionEmoji) actionEmoji.textContent = action.silhouetteEmoji || action.emoji;
    if (actionText) actionText.textContent = action.instruction;

    // Animate Twinkle
    if (dancerEl) {
      dancerEl.className = 'twinkle-dancer';
      dancerEl.classList.add(`twinkle-${action.twinkleAnimation}`);
    }

    if (speechEl) {
      speechEl.innerHTML = `<div class="speech-bubble">${action.instruction} Copy the shadow!</div>`;
    }
    await Audio.speak(`${action.instruction} Copy the shadow!`, { rate: 0.85 });

    // Show progress checklist
    if (counterEl) {
      counterEl.innerHTML = `
        <div class="action-checklist">
          ${roundActions.map((a, i) => `
            <div class="checklist-item ${i < index ? 'done' : ''} ${i === index ? 'current' : ''}" id="check-${i}">
              <span class="check-emoji">${i < index ? '✅' : (a.silhouetteEmoji || a.emoji)}</span>
              <span class="check-text">${a.instruction}</span>
            </div>
          `).join('')}
        </div>
      `;
    }

    // Set up parent confirmation button
    if (doneBtn) {
      doneBtn.disabled = false;
      doneBtn.style.display = 'block';
      doneBtn.textContent = `✓ ${action.verb} done!`;

      // Replace listener by cloning
      const newDone = Utils.replaceWithClone(doneBtn);
      newDone.addEventListener('click', async () => {
        newDone.disabled = true;

        // Mark checklist item done
        const checkItem = document.getElementById(`check-${index}`);
        if (checkItem) {
          checkItem.classList.add('done');
          checkItem.querySelector('.check-emoji').textContent = '✅';
        }

        if (speechEl) {
          speechEl.innerHTML = `<div class="speech-bubble happy">Great ${action.verb}ing!</div>`;
        }
        await Audio.speak(`Great ${action.verb}ing!`, { rate: 0.85 });

        await Utils.sleep(600);
        await performShadowSequence(index + 1);
      });
    }
  }

  async function onShadowRoundComplete() {
    const actionDisplay = document.getElementById('dance-action-display');
    const doneBtn = document.getElementById('btn-action-done');
    const counterEl = document.getElementById('dance-counter');
    const speechEl = document.getElementById('day4-speech');

    if (doneBtn) doneBtn.style.display = 'none';
    if (counterEl) counterEl.innerHTML = '';

    if (speechEl) {
      speechEl.innerHTML = `<div class="speech-bubble happy">Amazing! You copied all the shadows!</div>`;
    }
    await Audio.speak('Amazing! You copied all the shadows!', { rate: 0.85 });

    const completedRound = currentRound;
    await Utils.sleep(800);
    await advanceToNextRound(completedRound);
  }

  async function showChildTurn() {
    const actionDisplay = document.getElementById('dance-action-display');
    const actionEmoji = document.getElementById('action-emoji');
    const actionText = document.getElementById('action-text');
    const doneBtn = document.getElementById('btn-action-done');
    const dancerEl = document.getElementById('twinkle-dancer');
    const speechEl = document.getElementById('day4-speech');

    if (actionDisplay) {
      actionDisplay.style.display = 'flex';
      actionDisplay.classList.add('your-turn');
    }
    if (actionEmoji) actionEmoji.textContent = '🙋';
    if (actionText) actionText.textContent = 'YOUR TURN! Do all the moves!';

    if (dancerEl) {
      dancerEl.className = 'twinkle-dancer twinkle-watching';
    }

    // Show all actions as a list for reference
    const counterEl = document.getElementById('dance-counter');
    if (counterEl) {
      counterEl.innerHTML = `
        <div class="action-checklist">
          ${roundActions.map((a, i) => `
            <div class="checklist-item" id="check-${i}">
              <span class="check-emoji">${a.emoji}</span>
              <span class="check-text">${a.instruction}</span>
            </div>
          `).join('')}
        </div>
      `;
    }

    if (speechEl) {
      speechEl.innerHTML = `<div class="speech-bubble">Your turn! Show me the moves!</div>`;
    }

    const completedRound = currentRound;

    // Set up DONE button BEFORE speaking
    if (doneBtn) {
      doneBtn.disabled = false;
      doneBtn.style.display = 'block';
      doneBtn.textContent = '✓ DONE! I did all the moves!';
      doneBtn.onclick = async () => {
        doneBtn.disabled = true;
        if (actionDisplay) actionDisplay.classList.remove('your-turn');
        if (counterEl) counterEl.innerHTML = '';
        if (doneBtn) doneBtn.style.display = 'none';

        if (speechEl) {
          speechEl.innerHTML = `<div class="speech-bubble happy">Amazing! You're a great dancer!</div>`;
        }
        await Audio.speak('Amazing! You are a great dancer!', { rate: 0.85 });

        // Voice prompt: name that move!
        const randomAction = roundActions[Math.floor(Math.random() * roundActions.length)];
        const voiceDiv = document.createElement('div');
        voiceDiv.className = 'mini-voice-prompt';
        voiceDiv.innerHTML = `
          <span class="mini-voice-hint">${randomAction.emoji} What move was that? Say it!</span>
          <button class="btn btn-tiny btn-mini-mic">🎤 Speak</button>
          <span class="mini-voice-result"></span>
        `;
        const danceStage = document.getElementById('dance-stage');
        if (danceStage) danceStage.appendChild(voiceDiv);

        const micBtn = voiceDiv.querySelector('.btn-mini-mic');
        const resultEl = voiceDiv.querySelector('.mini-voice-result');
        micBtn.addEventListener('click', () => {
          VoiceInput.listen({
            lang: 'en-US',
            onResult: (text) => {
              if (text.toLowerCase().includes(randomAction.verb.toLowerCase())) {
                resultEl.textContent = '✅ Yes! ' + randomAction.emoji;
                Audio.speak('Yes! ' + randomAction.instruction, { rate: 0.85 });
                const state = Storage.getState();
                if (!state.day4MovesNamed) state.day4MovesNamed = [];
                if (!state.day4MovesNamed.includes(randomAction.id)) {
                  state.day4MovesNamed.push(randomAction.id);
                  Storage.save();
                }
              } else {
                resultEl.textContent = '💬 ' + randomAction.verb + '!';
                Audio.speak('It\'s ' + randomAction.verb + '! Good try!', { rate: 0.85 });
              }
            },
            onError: () => { resultEl.textContent = 'That\'s okay!'; }
          });
        });

        // Add Next Round button — uses shared advance function
        const nextBtn = document.createElement('button');
        nextBtn.className = 'btn btn-tiny';
        nextBtn.textContent = (completedRound + 1) >= rounds.length ? 'Finish! 🎉' : 'Next Round →';
        nextBtn.style.marginTop = '12px';
        voiceDiv.appendChild(nextBtn);

        nextBtn.addEventListener('click', async () => {
          if (voiceDiv.parentNode) voiceDiv.remove();
          await advanceToNextRound(completedRound);
        });
      };
    }

    await Audio.speak('Your turn! Do all the moves!', { rate: 0.9 });
  }

  async function onAllRoundsComplete() {
    const successEl = document.getElementById('day4-success');
    const danceStage = document.getElementById('dance-stage');
    const controls = document.querySelector('.dance-controls');
    const speechEl = document.getElementById('day4-speech');

    if (danceStage) danceStage.style.display = 'none';
    if (controls) controls.style.display = 'none';

    if (successEl) {
      successEl.style.display = 'flex';
      successEl.innerHTML = `
        <div class="success-card animate-pop">
          <div class="dancing-twinkle-final">💃✨💫</div>
          <p class="success-text">${data.days['4'].completionText}</p>
        </div>
      `;
    }

    if (speechEl) {
      speechEl.innerHTML = `<div class="speech-bubble happy">${data.days['4'].completionText}</div>`;
    }
    await Audio.speak(data.days['4'].completionText, { rate: 0.85 });
    App.onDayComplete(4);
  }

  // ==================== SHARED HELPERS ====================

  /** Advance to next round or complete all rounds */
  async function advanceToNextRound(completedRoundIdx) {
    currentRound = completedRoundIdx + 1;
    Storage.setDay4Round(currentRound);
    App.updateStatusBar();

    // Update round dot to done
    const dot = document.getElementById(`rdot-${completedRoundIdx}`);
    if (dot) { dot.classList.add('done'); dot.textContent = '⭐'; }

    if (currentRound >= rounds.length) {
      onAllRoundsComplete();
      return;
    }

    // Reset dance stage for next round
    const danceStage = document.getElementById('dance-stage');
    if (danceStage) {
      danceStage.innerHTML = `
        <div class="twinkle-dancer" id="twinkle-dancer">
          <div class="twinkle-body">✨</div>
        </div>
        <div class="dance-action-display" id="dance-action-display">
          <div class="action-emoji" id="action-emoji">👀</div>
          <div class="action-text" id="action-text">Get ready...</div>
        </div>
        <div class="dance-counter" id="dance-counter"></div>
      `;
    }

    const speechEl = document.getElementById('day4-speech');
    if (speechEl) {
      speechEl.innerHTML = `<div class="speech-bubble happy">Round complete! Next one...</div>`;
    }
    await Audio.speak('Amazing! Get ready for the next round!', { rate: 0.85 });
    await Utils.sleep(800);
    await startDanceRound(currentRound);
  }

  // ==================== WATCH MODE ====================

  function setupWatchRound(roundIdx, numActions, startBtn, doneBtn, speechEl) {
    if (!startBtn) return;
    startBtn.onclick = async () => {
      startBtn.style.display = 'none';
      if (doneBtn) doneBtn.style.display = 'block';

      const isMimicMode = roundActions.some(a => a.requiresMimic);

      if (speechEl) {
        speechEl.innerHTML = `<div class="speech-bubble">${isMimicMode ? 'Copy the shadow!' : 'Watch me, then YOU do it!'}</div>`;
      }

      if (isMimicMode) {
        await Audio.speak(`Round ${roundIdx + 1}! Copy the animal shadows!`, { rate: 0.9 });
        await performShadowSequence(0);
      } else {
        await Audio.speak(`Round ${roundIdx + 1}! ${numActions} moves. Watch me first!`, { rate: 0.9 });
        await performActionSequence(0);
      }
    };
  }

  // ==================== FREEZE DANCE MODE ====================

  let freezeBeatActive = false;

  function setupFreezeRound(roundIdx, roundDef, startBtn, speechEl) {
    const freezeCycles = roundDef.freezeCycles || 3;
    if (!startBtn) return;

    startBtn.onclick = async () => {
      startBtn.style.display = 'none';

      // Transform dance stage for freeze game
      const danceStage = document.getElementById('dance-stage');
      if (danceStage) {
        danceStage.innerHTML = `
          <div class="freeze-stage" id="freeze-stage">
            <div class="freeze-twinkle dancing" id="freeze-twinkle">✨</div>
            <div class="freeze-status" id="freeze-status">🕺 Get ready...</div>
            <div class="freeze-beat-indicator" id="freeze-beat-indicator" style="display:none">
              <span class="beat-dot"></span><span class="beat-dot"></span><span class="beat-dot"></span>
            </div>
          </div>
        `;
      }

      const doneBtn = document.getElementById('btn-action-done');
      if (doneBtn) doneBtn.style.display = 'none';

      if (speechEl) {
        speechEl.innerHTML = `<div class="speech-bubble">🕺 Dance when you hear the beat! When it stops... FREEZE like a statue! 🧊</div>`;
      }
      await Audio.speak('Dance when you hear the beat! When the music stops... FREEZE!', { rate: 0.85 });
      await Utils.sleep(600);

      // Run freeze cycles
      let completed = 0;
      while (completed < freezeCycles) {
        const result = await runFreezeCycle(completed + 1, freezeCycles);
        if (result === 'froze') completed++;
      }

      // All cycles done — advance
      const freezeStage = document.getElementById('freeze-stage');
      if (freezeStage) {
        freezeStage.innerHTML = `
          <div class="freeze-stage">
            <div class="freeze-twinkle celebrate">❄️→✨</div>
            <div class="freeze-status">🎉 Amazing freezing! You're a statue master! 🗿</div>
          </div>
        `;
      }
      if (speechEl) {
        speechEl.innerHTML = `<div class="speech-bubble happy">You're the Freeze Dance champion! 🧊👑</div>`;
      }
      await Audio.speak('You are the Freeze Dance champion!', { rate: 0.85 });
      await Utils.sleep(1000);
      await advanceToNextRound(roundIdx);
    };
  }

  async function runFreezeCycle(cycleNum, totalCycles) {
    const freezeTwinkle = document.getElementById('freeze-twinkle');
    const freezeStatus = document.getElementById('freeze-status');
    const beatIndicator = document.getElementById('freeze-beat-indicator');
    const speechEl = document.getElementById('day4-speech');

    // Show cycle status
    if (freezeStatus) {
      freezeStatus.innerHTML = `🕺 Dance! <span class="cycle-count">(${cycleNum}/${totalCycles})</span>`;
    }
    if (beatIndicator) beatIndicator.style.display = 'flex';
    if (freezeTwinkle) freezeTwinkle.className = 'freeze-twinkle dancing';

    if (speechEl) {
      speechEl.innerHTML = `<div class="speech-bubble">Dance dance dance! 🕺</div>`;
    }

    // Start beat loop
    freezeBeatActive = true;
    runFreezeBeatLoop();

    // Random freeze moment: 2.5–5.5 seconds
    const freezeDelay = 2500 + Math.random() * 3000;
    await Utils.sleep(freezeDelay);

    // FREEZE!
    freezeBeatActive = false;
    Audio.cancel();

    if (freezeTwinkle) freezeTwinkle.className = 'freeze-twinkle watching';
    if (freezeStatus) freezeStatus.innerHTML = '🧊 FREEZE!! Don\'t move a muscle!';
    if (beatIndicator) beatIndicator.style.display = 'none';

    if (speechEl) {
      speechEl.innerHTML = `<div class="speech-bubble">FREEZE! I'm watching you... 👀</div>`;
    }
    await Audio.speak('FREEZE!', { rate: 0.5, pitch: 0.7 });

    // Watch for 2.5 seconds
    await Utils.sleep(2500);

    // Ask parent to judge
    if (freezeStatus) {
      freezeStatus.innerHTML = `
        <p style="margin-bottom:10px;font-size:0.9rem;">Earth Helper: did Star Guardian freeze in time?</p>
        <div class="freeze-buttons">
          <button class="btn btn-primary btn-freeze-good" id="btn-freeze-good">✅ Perfect freeze!</button>
          <button class="btn btn-ghost btn-freeze-moved" id="btn-freeze-moved">😅 They moved!</button>
        </div>
      `;
    }

    return new Promise((resolve) => {
      // Use setTimeout to ensure DOM is ready
      setTimeout(() => {
        const goodBtn = document.getElementById('btn-freeze-good');
        const movedBtn = document.getElementById('btn-freeze-moved');

        goodBtn?.addEventListener('click', async () => {
          if (freezeStatus) freezeStatus.innerHTML = '🗿 Like a statue! Amazing!';
          if (speechEl) {
            speechEl.innerHTML = `<div class="speech-bubble happy">Wow! You didn't move at all! 🧊</div>`;
          }
          await Audio.speak('Wow! You are a statue!', { rate: 0.85 });
          resolve('froze');
        });

        movedBtn?.addEventListener('click', async () => {
          if (freezeStatus) freezeStatus.innerHTML = '😄 I saw you move! Let\'s try again!';
          if (speechEl) {
            speechEl.innerHTML = `<div class="speech-bubble">Haha! I saw you! Let's try that one again! 😄</div>`;
          }
          await Audio.speak('Haha! I saw you move! Let\'s try again!', { rate: 0.9 });
          resolve('moved');
        });
      }, 150);
    });
  }

  async function runFreezeBeatLoop() {
    while (freezeBeatActive) {
      try {
        await Audio.speak('dum', { rate: 2.5, pitch: 1.0 });
        await Utils.sleep(130);
      } catch (e) {
        // Speech cancelled — expected when freeze triggers
        break;
      }
    }
  }

  // ==================== CREATE YOUR MOVE MODE ====================

  function setupCreateRound(roundIdx, roundDef, startBtn, speechEl) {
    const watchCount = roundDef.watchCount || (Math.max(1, (roundDef.count || 3) - 1));
    // Pick watch actions + a create placeholder
    const shuffled = [...actions].sort(() => Math.random() - 0.5);
    const watchActions = shuffled.slice(0, watchCount);
    roundActions = [...watchActions, {
      id: '__create__', verb: 'create', emoji: '❓',
      instruction: 'YOUR NEW MOVE!', twinkleAnimation: 'bounce', isCreateSlot: true
    }];

    if (!startBtn) return;
    startBtn.onclick = async () => {
      startBtn.style.display = 'none';

      if (speechEl) {
        speechEl.innerHTML = `<div class="speech-bubble">Watch ${watchCount} moves... then YOU teach ME a brand new move! 🎨</div>`;
      }
      await Audio.speak(`Watch ${watchCount} moves first. Then YOU create a new one!`, { rate: 0.9 });

      // Show only the watch actions, skipping the create slot
      await performWatchOnlyActions(watchActions);

      // Then show the create UI
      await showCreateMoveUI(roundIdx);
      // Advance to next round
      await advanceToNextRound(roundIdx);
    };
  }

  async function performWatchOnlyActions(watchActions) {
    for (let i = 0; i < watchActions.length; i++) {
      const action = watchActions[i];
      const actionDisplay = document.getElementById('dance-action-display');
      const actionEmoji = document.getElementById('action-emoji');
      const actionText = document.getElementById('action-text');
      const dancerEl = document.getElementById('twinkle-dancer');
      const speechEl = document.getElementById('day4-speech');

      if (actionDisplay) actionDisplay.style.display = 'flex';
      if (actionEmoji) actionEmoji.textContent = action.emoji;
      if (actionText) actionText.textContent = action.instruction;

      if (dancerEl) {
        dancerEl.className = 'twinkle-dancer';
        dancerEl.classList.add(`twinkle-${action.twinkleAnimation}`);
      }

      if (speechEl) {
        speechEl.innerHTML = `<div class="speech-bubble">${action.instruction}</div>`;
      }
      await Audio.speak(action.instruction, { rate: 0.85 });
      await Utils.sleep(1200);
    }
  }

  async function showCreateMoveUI(roundIdx) {
    const actionDisplay = document.getElementById('dance-action-display');
    const doneBtn = document.getElementById('btn-action-done');
    const danceStage = document.getElementById('dance-stage');
    const speechEl = document.getElementById('day4-speech');

    if (actionDisplay) actionDisplay.style.display = 'none';
    if (doneBtn) doneBtn.style.display = 'none';

    const emojiOptions = ['🦖','🦄','🐲','🤖','👻','🦸','🧙','🦋','🐉','🦅','🦊','🐸','🐵','🦁','🐯','🦒'];

    if (danceStage) {
      danceStage.innerHTML = `
        <div class="create-move-stage" id="create-move-stage">
          <div class="create-move-header">
            <span class="create-move-icon">🎨</span>
            <h3>Create a New Move!</h3>
            <p>Star Guardian: show us YOUR move!<br>Earth Helper: pick an emoji and name it!</p>
          </div>
          <div class="create-move-picker" id="create-move-picker">
            ${emojiOptions.map(e =>
              `<button class="btn-emoji-pick" data-emoji="${e}">${e}</button>`
            ).join('')}
          </div>
          <div class="create-move-input-row">
            <input type="text" class="create-move-input" id="create-move-name"
              placeholder="Name this move!" maxlength="20" autocomplete="off">
          </div>
          <button class="btn btn-primary" id="btn-teach-twinkle">✨ Teach Twinkle!</button>
          <p class="create-move-status" id="create-move-status"></p>
        </div>
      `;
    }

    if (speechEl) {
      speechEl.innerHTML = `<div class="speech-bubble">Wow! Teach me a brand new move! What should we call it? 🎨</div>`;
    }
    await Audio.speak('Teach me a new move! Earth Helper, pick an emoji and give it a name!', { rate: 0.85 });

    return new Promise((resolve) => {
      let selectedEmoji = '🦖';

      setTimeout(() => {
        const picker = document.getElementById('create-move-picker');
        if (picker) {
          // Highlight first by default
          const firstBtn = picker.querySelector('.btn-emoji-pick');
          if (firstBtn) firstBtn.classList.add('selected');

          picker.querySelectorAll('.btn-emoji-pick').forEach(btn => {
            btn.addEventListener('click', () => {
              picker.querySelectorAll('.btn-emoji-pick').forEach(b => b.classList.remove('selected'));
              btn.classList.add('selected');
              selectedEmoji = btn.dataset.emoji;
            });
          });
        }

        const teachBtn = document.getElementById('btn-teach-twinkle');
        teachBtn?.addEventListener('click', async () => {
          const nameInput = document.getElementById('create-move-name');
          const moveName = (nameInput && nameInput.value.trim()) ? nameInput.value.trim() : 'Super Move';
          const statusEl = document.getElementById('create-move-status');

          if (statusEl) statusEl.innerHTML = `🧐 Twinkle is learning "${moveName}"...`;
          if (speechEl) {
            speechEl.innerHTML = `<div class="speech-bubble">${selectedEmoji} ${moveName}? Let me try!</div>`;
          }
          await Audio.speak(`${moveName}? Let me try!`, { rate: 0.85 });

          // Twinkle wobbles to "learn" the move
          const twinkleDancer = document.getElementById('twinkle-dancer');
          const freezeTwinkle = document.getElementById('freeze-twinkle');
          if (twinkleDancer) {
            twinkleDancer.className = 'twinkle-dancer twinkle-wobble';
          }
          if (freezeTwinkle) {
            freezeTwinkle.className = 'freeze-twinkle wobble';
          }

          await Utils.sleep(2200);

          if (twinkleDancer) twinkleDancer.className = 'twinkle-dancer';
          if (freezeTwinkle) freezeTwinkle.className = 'freeze-twinkle';

          // Ask for approval
          if (statusEl) {
            statusEl.innerHTML = `
              <p style="margin-bottom:10px">How was that?</p>
              <div class="freeze-buttons">
                <button class="btn btn-primary" id="btn-approve-move">👍 Great job!</button>
                <button class="btn btn-ghost" id="btn-retry-move">🔄 Try again!</button>
              </div>
            `;
          }

          const approveBtn = document.getElementById('btn-approve-move');
          const retryBtn = document.getElementById('btn-retry-move');

          approveBtn?.addEventListener('click', async () => {
            // Save the created move
            const state = Storage.getState();
            if (!state.day4CreatedMoves) state.day4CreatedMoves = [];
            state.day4CreatedMoves.push({ name: moveName, emoji: selectedEmoji });
            Storage.save();

            if (speechEl) {
              speechEl.innerHTML = `<div class="speech-bubble happy">Yay! I learned "${moveName}"! ${selectedEmoji} You're the best teacher!</div>`;
            }
            await Audio.speak(`Yay! I learned ${moveName}! You are the best teacher!`, { rate: 0.85 });
            resolve();
          });

          retryBtn?.addEventListener('click', async () => {
            if (speechEl) {
              speechEl.innerHTML = `<div class="speech-bubble">Let me try again! ${selectedEmoji} ${moveName}!</div>`;
            }
            await Audio.speak('Let me try again!', { rate: 0.85 });
            resolve(); // Count it anyway, it's about fun
          });
        });
      }, 200);
    });
  }

  function stop() {
    isActive = false;
    Audio.cancel();
  }

  return { init, start, stop };
})();
