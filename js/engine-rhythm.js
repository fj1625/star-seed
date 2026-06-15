/**
 * Star Seed - Day 3 Engine: Rhythm Power (Animal Choir)
 * Listen to the animal choir, then repeat the sequence by tapping animals in rhythm
 */
const EngineRhythm = (() => {
  let data = null;
  let animals = [];
  let rounds = [];
  let currentRound = 0;
  let sequence = [];
  let playerSequence = [];
  let isPlaying = false;
  let isActive = false;
  let pendingTimers = new Set();
  let lastStartTime = 0;

  function init(episodeData) {
    data = episodeData;
    const dayData = episodeData.days?.['3'] || {};
    animals = dayData.choirAnimals || dayData.animals || [];
    rounds = dayData.rounds || [2, 3, 4, 5];
  }

  async function start() {
    const now = Date.now();
    if (now - lastStartTime < 500) {
      console.warn('[Day3] start() debounced');
      return;
    }
    lastStartTime = now;

    isActive = true;
    clearPendingTimers();

    const state = Storage.getState();
    currentRound = state.day3RhythmRound || 0;

    if (currentRound >= rounds.length) {
      App.onDayComplete(3);
      return;
    }

    renderDay3();
    await Utils.speakIntro(3, data, { cancelPrevious: false });
    startRound(currentRound);
  }

  function renderDay3() {
    const container = document.getElementById('day3');
    if (!container) return;

    const dayLabel = data.days?.['3']?.tabLabel || 'Day 3';
    const dayTitle = data.days?.['3']?.title || 'Animal Choir';

    container.innerHTML = `
      <div class="day-header">
        <span class="day-badge">${dayLabel}</span>
        <h2>🎵 Rhythm Power</h2>
        <p class="day-subtitle">${dayTitle}</p>
      </div>
      <div class="twinkle-speech" id="day3-speech" aria-live="polite" aria-atomic="true"></div>

      <div class="rhythm-stage" id="day3-rhythm-stage">
        <div class="rhythm-conductor">
          <div class="rhythm-beat-bar" id="rhythm-bar"></div>
          <div class="rhythm-conductor-emoji">🪄</div>
        </div>
        <p class="rhythm-instruction" id="rhythm-instruction">Listen to the choir, then tap the animals in the same order!</p>
        <div class="choir-grid" id="choir-grid"></div>
        <div class="rhythm-sequence-display" id="rhythm-sequence"></div>
        <div class="rhythm-controls">
          <button class="btn btn-primary" id="btn-play-choir" disabled>⏳ Listen...</button>
          <button class="btn btn-secondary" id="btn-replay-choir" style="display:none">🔁 Replay</button>
        </div>
      </div>

      <div class="rhythm-success" id="day3-success" style="display:none"></div>
    `;
  }

  async function startRound(roundIndex) {
    if (roundIndex >= rounds.length) {
      onAllRoundsComplete();
      return;
    }

    currentRound = roundIndex;
    Storage.setDay3RhythmRound && Storage.setDay3RhythmRound(roundIndex);

    const roundLength = rounds[roundIndex];
    sequence = generateSequence(roundLength);
    playerSequence = [];
    isPlaying = false;

    renderChoirGrid();
    updateSequenceDisplay();

    const instructionEl = document.getElementById('rhythm-instruction');
    if (instructionEl) {
      instructionEl.textContent = `Round ${roundIndex + 1}: Listen to ${roundLength} animals, then repeat!`;
    }

    const speechEl = document.getElementById('day3-speech');
    if (speechEl) {
      speechEl.innerHTML = `<div class="speech-bubble">Round ${roundIndex + 1}! Listen to ${roundLength} animals, then repeat!</div>`;
    }
    await Audio.speak(`Round ${roundIndex + 1}! Listen to ${roundLength} animals, then repeat!`, { rate: 0.85 });

    setupPlayButton();
  }

  function generateSequence(length) {
    const pool = [...animals].sort(() => Math.random() - 0.5);
    return pool.slice(0, Math.min(length, pool.length)).map(a => a.id);
  }

  function renderChoirGrid() {
    const grid = document.getElementById('choir-grid');
    if (!grid) return;

    grid.innerHTML = animals.map(a => `
      <button class="choir-animal" data-id="${a.id}" id="choir-animal-${a.id}" disabled>
        <span class="choir-animal-emoji">${a.emoji}</span>
        <span class="choir-animal-name">${a.animal}</span>
      </button>
    `).join('');

    grid.querySelectorAll('.choir-animal').forEach(btn => {
      btn.addEventListener('click', () => onAnimalTap(btn.dataset.id));
    });
  }

  function setupPlayButton() {
    const playBtn = document.getElementById('btn-play-choir');
    const replayBtn = document.getElementById('btn-replay-choir');

    if (playBtn) {
      playBtn.disabled = false;
      playBtn.textContent = '🔊 Play the Choir';
      playBtn.onclick = () => playSequence();
    }

    if (replayBtn) {
      replayBtn.style.display = 'none';
      replayBtn.onclick = () => playSequence();
    }
  }

  async function playSequence() {
    if (isPlaying || sequence.length === 0) return;
    isPlaying = true;

    const playBtn = document.getElementById('btn-play-choir');
    const replayBtn = document.getElementById('btn-replay-choir');
    const bar = document.getElementById('rhythm-bar');

    if (playBtn) {
      playBtn.disabled = true;
      playBtn.textContent = '⏳ Listening...';
    }
    if (replayBtn) replayBtn.style.display = 'none';

    // Disable animal buttons during playback
    setChoirButtonsDisabled(true);

    const beatInterval = data.days?.['3']?.beatInterval || 700;

    // Pulse the rhythm bar
    for (let i = 0; i < sequence.length; i++) {
      if (!isActive) return;

      const animalId = sequence[i];
      const animal = animals.find(a => a.id === animalId);
      if (!animal) continue;

      if (bar) {
        bar.style.width = `${((i + 1) / sequence.length) * 100}%`;
      }

      highlightAnimal(animalId);
      await Audio.speak(animal.onomatopoeia, {
        rate: animal.speechRate,
        pitch: animal.speechPitch,
        cancelPrevious: true
      });
      await sleep(beatInterval);
    }

    if (bar) bar.style.width = '0%';

    if (playBtn) {
      playBtn.disabled = false;
      playBtn.textContent = '🔁 Replay if needed';
    }
    if (replayBtn) replayBtn.style.display = 'inline-block';

    // Enable animal buttons for player turn
    setChoirButtonsDisabled(false);

    const instructionEl = document.getElementById('rhythm-instruction');
    if (instructionEl) {
      instructionEl.textContent = 'Your turn! Tap the animals in the same order.';
    }

    const speechEl = document.getElementById('day3-speech');
    if (speechEl) {
      speechEl.innerHTML = `<div class="speech-bubble">Your turn! Tap the animals in the same order.</div>`;
    }
    await Audio.speak('Your turn! Tap the animals in the same order.', { rate: 0.85 });

    isPlaying = false;
  }

  function setChoirButtonsDisabled(disabled) {
    document.querySelectorAll('.choir-animal').forEach(btn => {
      btn.disabled = disabled;
    });
  }

  function highlightAnimal(animalId) {
    const btn = document.getElementById(`choir-animal-${animalId}`);
    if (!btn) return;

    btn.classList.add('highlight');
    setTimeout(() => btn.classList.remove('highlight'), 400);
  }

  async function onAnimalTap(animalId) {
    if (isPlaying || playerSequence.length >= sequence.length) return;

    const animal = animals.find(a => a.id === animalId);
    if (!animal) return;

    playerSequence.push(animalId);
    highlightAnimal(animalId);

    // Play the animal's sound when tapped
    await Audio.speak(animal.onomatopoeia, {
      rate: animal.speechRate,
      pitch: animal.speechPitch,
      cancelPrevious: true
    });

    updateSequenceDisplay();

    if (playerSequence.length >= sequence.length) {
      setTimeout(() => checkRound(), 500);
    }
  }

  function updateSequenceDisplay() {
    const display = document.getElementById('rhythm-sequence');
    if (!display) return;

    const slots = sequence.map((id, i) => {
      const a = animals.find(an => an.id === id);
      const filled = i < playerSequence.length;
      return `<span class="rhythm-dot ${filled ? 'filled' : ''}">${filled ? (a ? a.emoji : '✓') : '•'}</span>`;
    }).join('');

    display.innerHTML = slots;
  }

  async function checkRound() {
    const correct = playerSequence.every((id, i) => id === sequence[i]);

    if (correct) {
      await onRoundSuccess();
    } else {
      onRoundFailure();
    }
  }

  async function onRoundSuccess() {
    const speechEl = document.getElementById('day3-speech');
    if (speechEl) {
      speechEl.innerHTML = `<div class="speech-bubble happy">Great job! You kept the rhythm!</div>`;
    }
    await Audio.speak('Great job! You kept the rhythm!', { rate: 0.85 });

    await sleep(1000);

    currentRound++;
    Storage.setDay3RhythmRound && Storage.setDay3RhythmRound(currentRound);

    if (currentRound >= rounds.length) {
      onAllRoundsComplete();
    } else {
      startRound(currentRound);
    }
  }

  async function onRoundFailure() {
    const speechEl = document.getElementById('day3-speech');
    if (speechEl) {
      speechEl.innerHTML = `<div class="speech-bubble">Not quite! Listen again and try once more.</div>`;
    }
    await Audio.speak('Not quite! Listen again and try once more.', { rate: 0.9 });

    playerSequence = [];
    updateSequenceDisplay();

    // Let them replay the sequence
    const playBtn = document.getElementById('btn-play-choir');
    if (playBtn) {
      playBtn.disabled = false;
      playBtn.textContent = '🔊 Play the Choir';
    }
  }

  async function onAllRoundsComplete() {
    const successEl = document.getElementById('day3-success');
    const stageEl = document.getElementById('day3-rhythm-stage');
    const speechEl = document.getElementById('day3-speech');

    if (stageEl) stageEl.style.display = 'none';

    if (successEl) {
      successEl.style.display = 'flex';
      successEl.innerHTML = `
        <div class="success-card animate-pop">
          <div class="success-animals">
            ${animals.map(a => `<span class="dancing-animal">${a.emoji}</span>`).join('')}
          </div>
          <p class="success-text">${data.days['3'].completionText}</p>
        </div>
      `;
    }

    if (speechEl) {
      speechEl.innerHTML = `<div class="speech-bubble happy">${data.days['3'].completionText}</div>`;
    }
    await Audio.speak(data.days['3'].completionText, { rate: 0.85 });

    Storage.setDay3RhythmRound && Storage.setDay3RhythmRound(rounds.length);
    App.onDayComplete(3);
  }

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

  function stop() {
    isActive = false;
    isPlaying = false;
    clearPendingTimers();
    Audio.cancel();
  }

  return { init, start, stop };
})();
