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
    await speakIntro();
    startDanceRound(currentRound);
  }

  function renderDay4() {
    const container = document.getElementById('day4');
    if (!container) return;

    container.innerHTML = `
      <div class="day-header">
        <span class="day-badge">Day 4</span>
        <h2>🤸 Motion Power</h2>
        <p class="day-subtitle">Star Dance</p>
      </div>
      <div class="twinkle-speech" id="day4-speech"></div>
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
      roundDots.innerHTML = rounds.map((r, i) =>
        `<span class="round-dot ${i < currentRound ? 'done' : ''} ${i === currentRound ? 'active' : ''}" id="rdot-${i}">
          ${i < currentRound ? '⭐' : i + 1}
        </span>`
      ).join('');
    }

    document.getElementById('round-num').textContent = currentRound + 1;
  }

  async function speakIntro() {
    const speechEl = document.getElementById('day4-speech');
    if (speechEl) {
      speechEl.innerHTML = `<div class="speech-bubble">${data.days['4'].storyIntro}</div>`;
    }
    await Audio.speak(data.days['4'].storyIntro, { rate: 0.85, cancelPrevious: true });
  }

  async function startDanceRound(roundIdx) {
    if (roundIdx >= rounds.length) {
      // All rounds complete
      onAllRoundsComplete();
      return;
    }

    const numActions = rounds[roundIdx];
    // Pick random actions (or cycling through to ensure variety)
    const shuffled = [...actions].sort(() => Math.random() - 0.5);
    roundActions = shuffled.slice(0, numActions);
    currentActionIndex = 0;

    const actionDisplay = document.getElementById('dance-action-display');
    const actionEmoji = document.getElementById('action-emoji');
    const actionText = document.getElementById('action-text');
    const startBtn = document.getElementById('btn-start-dance');
    const doneBtn = document.getElementById('btn-action-done');
    const speechEl = document.getElementById('day4-speech');
    const dancerEl = document.getElementById('twinkle-dancer');

    // Update round display
    const roundNumEl = document.getElementById('round-num');
    if (roundNumEl) roundNumEl.textContent = roundIdx + 1;

    // Update round dots: mark completed, set active on current
    for (let i = 0; i < rounds.length; i++) {
      const dot = document.getElementById('rdot-' + i);
      if (!dot) continue;
      dot.classList.remove('active');
      if (i < roundIdx) {
        dot.classList.add('done');
        dot.textContent = '⭐';
      } else if (i === roundIdx) {
        dot.classList.add('active');
      }
    }

    // Show start button
    if (startBtn) {
      startBtn.style.display = 'block';
      startBtn.textContent = `Round ${roundIdx + 1}: ${numActions} moves! 🎯`;
      startBtn.onclick = async () => {
        startBtn.style.display = 'none';
        if (doneBtn) doneBtn.style.display = 'block';

        if (speechEl) {
          speechEl.innerHTML = `<div class="speech-bubble">Watch me, then YOU do it!</div>`;
        }
        await Audio.speak(`Round ${roundIdx + 1}! ${numActions} moves. Watch me first!`, { rate: 0.9 });

        // Show each action
        await performActionSequence(0);
      };
    }

    if (doneBtn) doneBtn.style.display = 'none';
    if (actionDisplay) actionDisplay.style.display = 'none';
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
    await sleep(1200);
    await performActionSequence(index + 1);
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

    // Set up DONE button BEFORE speaking — otherwise the button is
    // visible but still disabled from the previous round's click,
    // and the user sees no response when tapping it.
    if (doneBtn) {
      doneBtn.disabled = false;
      doneBtn.style.display = 'block';
      doneBtn.textContent = '✓ DONE! I did all the moves!';
      doneBtn.onclick = async () => {
        doneBtn.disabled = true;

        // Celebrate this round
        currentRound++;
        Storage.setDay4Round(currentRound);
        App.updateStatusBar();

        // Update round dots
        const dot = document.getElementById(`rdot-${currentRound - 1}`);
        if (dot) { dot.classList.add('done'); dot.textContent = '⭐'; }

        if (actionDisplay) actionDisplay.classList.remove('your-turn');
        if (counterEl) counterEl.innerHTML = '';
        if (doneBtn) doneBtn.style.display = 'none';

        if (speechEl) {
          speechEl.innerHTML = `<div class="speech-bubble happy">Amazing! You're a great dancer!</div>`;
        }
        await Audio.speak('Amazing! You are a great dancer!', { rate: 0.85 });

        if (currentRound >= rounds.length) {
          onAllRoundsComplete();
        } else {
          await startDanceRound(currentRound);
        }
      };
    }

    // Speak after button is ready — child can tap DONE immediately
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

  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  return { init, start };
})();
