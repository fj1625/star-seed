/**
 * Star Seed - Day 3 Engine: Sound Power (Sound Password)
 * Child listens to sounds, matches to animals, then remembers the sequence
 */
const EngineSound = (() => {
  let data = null;
  let animals = [];
  let matchedAnimals = [];
  let currentPhase = 'match'; // 'match' | 'sequence'
  let sequenceOrder = [];
  let playerSequence = [];
  let sequenceAttempts = 0;
  const MAX_ATTEMPTS = 3;

  function init(episodeData) {
    data = episodeData;
    animals = episodeData.days['3'].animals;
  }

  async function start() {
    currentPhase = 'match';
    matchedAnimals = Storage.getState().day3AnimalsMatched;
    sequenceOrder = [];
    playerSequence = [];
    sequenceAttempts = 0;

    if (matchedAnimals.length >= animals.length) {
      // All matched, check if sequence was also done
      const state = Storage.getState();
      if (state.completedDays.includes(3)) {
        App.onDayComplete(3);
        return;
      }
      // Matched but not completed — go to sequence
      currentPhase = 'sequence';
      renderDay3();
      await speakIntro();
      await startSequencePhase();
      return;
    }

    renderDay3();
    await speakIntro();
    showMatchPhase();
  }

  function renderDay3() {
    const container = document.getElementById('day3');
    if (!container) return;

    container.innerHTML = `
      <div class="day-header">
        <span class="day-badge">Day 3</span>
        <h2>🎵 Sound Power</h2>
        <p class="day-subtitle">Sound Password</p>
      </div>
      <div class="twinkle-speech" id="day3-speech"></div>
      <div class="sound-phase-match" id="day3-match">
        <p class="phase-instruction">Tap a jar to hear a sound. Which animal is it?</p>
        <div class="jars-grid" id="jars-grid"></div>
        <div class="animal-choices" id="animal-choices" style="display:none"></div>
      </div>
      <div class="sound-phase-sequence" id="day3-sequence" style="display:none">
        <p class="phase-instruction">Now the jars will sing in order. Can you remember the pattern?</p>
        <div class="sequence-jars" id="sequence-jars-display"></div>
        <div class="sequence-status" id="sequence-status"></div>
        <button class="btn btn-primary" id="btn-play-sequence">🔊 Play the sequence</button>
        <button class="btn btn-secondary" id="btn-submit-sequence" style="display:none">✓ I'm done! Check my answer</button>
        <p class="sequence-attempts" id="sequence-attempts-display"></p>
      </div>
      <div class="sound-success" id="day3-success" style="display:none"></div>
    `;
  }

  async function speakIntro() {
    const speechEl = document.getElementById('day3-speech');
    if (speechEl) {
      speechEl.innerHTML = `<div class="speech-bubble">${data.days['3'].storyIntro}</div>`;
    }
    // No cancelPrevious here — it's the first speech on Day 3, nothing to cancel
    await Audio.speak(data.days['3'].storyIntro, { rate: 0.85 });
  }

  function showMatchPhase() {
    const matchPhase = document.getElementById('day3-match');
    const seqPhase = document.getElementById('day3-sequence');
    const jarsGrid = document.getElementById('jars-grid');

    if (matchPhase) matchPhase.style.display = 'block';
    if (seqPhase) seqPhase.style.display = 'none';

    // Create jar buttons
    const unmatchedAnimals = animals.filter(a => !matchedAnimals.includes(a.id));

    if (unmatchedAnimals.length === 0) {
      // All matched, go to sequence
      currentPhase = 'sequence';
      startSequencePhase();
      return;
    }

    if (jarsGrid) {
      jarsGrid.innerHTML = unmatchedAnimals.map((a, i) => `
        <div class="sound-jar" data-index="${i}" id="jar-${i}">
          <div class="jar-icon">🫙</div>
          <div class="jar-label">Jar ${matchedAnimals.length + i + 1}</div>
          <div class="jar-status" id="jar-status-${i}">?</div>
        </div>
      `).join('');

      jarsGrid.querySelectorAll('.sound-jar').forEach(jar => {
        jar.addEventListener('click', () => {
          const idx = parseInt(jar.dataset.index);
          const animal = unmatchedAnimals[idx];

          // Play the sound
          Audio.speak(animal.onomatopoeia, {
            rate: animal.speechRate,
            pitch: animal.speechPitch,
            cancelPrevious: true
          });

          // Highlight jar
          jar.classList.add('playing');
          setTimeout(() => jar.classList.remove('playing'), 600);

          // Show choices
          showAnimalChoices(idx, animal, unmatchedAnimals);
        });
      });
    }
  }

  function showAnimalChoices(jarIdx, correctAnimal, _unmatchedAnimals) {
    const choicesEl = document.getElementById('animal-choices');
    if (!choicesEl) {
      console.warn('showAnimalChoices: #animal-choices not found in DOM');
      return;
    }

    // Get 3 options: correct + 2 distractors
    const distractors = animals.filter(a =>
      correctAnimal.distractors.includes(a.id)
    ).slice(0, 2);

    const options = [correctAnimal, ...distractors].sort(() => Math.random() - 0.5);

    choicesEl.style.display = 'flex';
    choicesEl.innerHTML = `
      <p class="choices-question">Which animal was in Jar ${matchedAnimals.length + jarIdx + 1}?</p>
      <div class="choices-grid">
        ${options.map(a => `
          <button class="btn btn-animal-choice" data-id="${a.id}">
            <span class="animal-emoji">${a.emoji}</span>
            <span class="animal-name">${a.animal}</span>
          </button>
        `).join('')}
      </div>
    `;

    // Scroll into view so choices are visible on mobile
    choicesEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

    choicesEl.querySelectorAll('.btn-animal-choice').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (btn.dataset.id === correctAnimal.id) {
          onAnimalMatched(jarIdx, correctAnimal);
        } else {
          btn.classList.add('shake');
          setTimeout(() => btn.classList.remove('shake'), 500);
          Audio.speak('Try again! Listen carefully!', { rate: 0.9 });
        }
      });
    });
  }

  async function onAnimalMatched(jarIdx, animal) {
    matchedAnimals.push(animal.id);
    Storage.addDay3Animal(animal.id);
    App.updateStatusBar();

    // Update jar status
    const jarStatus = document.getElementById(`jar-status-${jarIdx}`);
    if (jarStatus) {
      jarStatus.textContent = animal.emoji;
      jarStatus.classList.add('matched');
    }

    // Hide choices
    const choicesEl = document.getElementById('animal-choices');
    if (choicesEl) choicesEl.style.display = 'none';

    const speechEl = document.getElementById('day3-speech');
    if (speechEl) {
      speechEl.innerHTML = `<div class="speech-bubble happy">${animal.onomatopoeia} — It's a ${animal.animal}! ${animal.emoji}</div>`;
    }
    await Audio.speak(`Yes! It's a ${animal.animal}! ${animal.onomatopoeia}`, { rate: 0.85 });

    // Check if all matched
    if (matchedAnimals.length >= animals.length) {
      // All matched! Move to sound imitation then sequence
      const matchPhase = document.getElementById('day3-match');
      if (matchPhase) matchPhase.style.display = 'none';

      currentPhase = 'sequence';
      setTimeout(() => showSoundImitation(), 1000);
    }
  }

  async function showSoundImitation() {
    const speechEl = document.getElementById('day3-speech');
    const container = document.getElementById('day3');

    // Create a quick imitation UI before sequence
    const imitationDiv = document.createElement('div');
    imitationDiv.className = 'voice-prompt-inline sound-imitation';
    imitationDiv.innerHTML = `
      <p>You know all the animals! Can you make their sounds?</p>
      <div class="imitation-animals">
        ${animals.map(a => `
          <button class="btn btn-tiny btn-imitate" data-animal="${a.id}">
            ${a.emoji} ${a.animal}
          </button>
        `).join('')}
      </div>
      <div class="mini-voice-result" id="imitate-result"></div>
    `;
    container.appendChild(imitationDiv);

    if (speechEl) {
      speechEl.innerHTML = `<div class="speech-bubble">Let's hear YOUR animal sounds!</div>`;
    }
    await Audio.speak('You know all the animals! Can you make their sounds?', { rate: 0.85 });

    // Bind imitation buttons
    imitationDiv.querySelectorAll('.btn-imitate').forEach(btn => {
      btn.addEventListener('click', () => {
        const animalId = btn.dataset.animal;
        const a = animals.find(an => an.id === animalId);
        const resultEl = document.getElementById('imitate-result');

        VoiceInput.listen({
          lang: 'en-US',
          onResult: (text) => {
            if (resultEl) resultEl.textContent = `🎉 Heard: "${text}"!`;
            Audio.speak(`That sounded like a ${a.animal}!`, { rate: 0.85 });
            // Mark as imitated
            const state = Storage.getState();
            if (!state.day3SoundsImitated) state.day3SoundsImitated = [];
            if (!state.day3SoundsImitated.includes(animalId)) {
              state.day3SoundsImitated.push(animalId);
              Storage.save();
            }
          },
          onError: () => {
            if (resultEl) resultEl.textContent = 'Try tapping again!';
          }
        });
      });
    });

    // Auto-advance to sequence after 6s or when all buttons clicked
    setTimeout(() => {
      if (imitationDiv.parentNode) imitationDiv.remove();
      startSequencePhase();
    }, 8000);
  }

  async function startSequencePhase() {
    const seqPhase = document.getElementById('day3-sequence');
    const matchPhase = document.getElementById('day3-match');
    const seqJars = document.getElementById('sequence-jars-display');
    const playBtn = document.getElementById('btn-play-sequence');
    const submitBtn = document.getElementById('btn-submit-sequence');
    const attemptsDisplay = document.getElementById('sequence-attempts-display');
    const speechEl = document.getElementById('day3-speech');

    if (matchPhase) matchPhase.style.display = 'none';
    if (seqPhase) seqPhase.style.display = 'block';

    // Generate sequence (4 animal IDs from the matched set, random order)
    sequenceOrder = [...animals].sort(() => Math.random() - 0.5).slice(0, 4).map(a => a.id);
    playerSequence = [];
    sequenceAttempts = 0;

    // Show animal jars for tapping (in fixed order, not sequence order)
    if (seqJars) {
      seqJars.innerHTML = animals.map(a => `
        <div class="seq-jar" data-id="${a.id}" id="seq-jar-${a.id}">
          <div class="seq-jar-emoji">${a.emoji}</div>
          <div class="seq-jar-name">${a.animal}</div>
        </div>
      `).join('');

      seqJars.querySelectorAll('.seq-jar').forEach(jar => {
        jar.addEventListener('click', () => {
          if (playerSequence.length >= sequenceOrder.length) return;
          const animalId = jar.dataset.id;
          playerSequence.push(animalId);
          jar.classList.add('selected');

          // Visual feedback
          const seqStatus = document.getElementById('sequence-status');
          if (seqStatus) {
            seqStatus.innerHTML = playerSequence.map((id, i) => {
              const a = animals.find(an => an.id === id);
              return `<span class="seq-dot">${a ? a.emoji : '?'}</span>`;
            }).join(' ') + ' _ '.repeat(sequenceOrder.length - playerSequence.length);
          }

          // Show submit button if at least one selected
          if (submitBtn && playerSequence.length > 0) {
            submitBtn.style.display = 'inline-block';
          }

          // Auto-check when full sequence entered
          if (playerSequence.length >= sequenceOrder.length) {
            setTimeout(() => {
              if (submitBtn) submitBtn.click();
            }, 500);
          }
        });
      });
    }

    // Play button — disabled during instruction speech to prevent race with Edge TTS
    if (playBtn) {
      playBtn.disabled = true;
      playBtn.textContent = '⏳ Listen...';
      playBtn.onclick = null;
      playBtn.onclick = async function() {
        console.log('[Day3] Play clicked. sequenceOrder:', sequenceOrder);
        if (!sequenceOrder || !sequenceOrder.length) {
          console.warn('[Day3] sequenceOrder empty, regenerating');
          sequenceOrder = [...animals].sort(() => Math.random() - 0.5).slice(0, 4).map(a => a.id);
        }

        try {
          const btn = this;
          btn.disabled = true;

          // Highlight all jars with "listening" glow during playback
          document.querySelectorAll('.seq-jar').forEach(function(j) {
            j.classList.add('highlight');
          });

          for (let i = 0; i < sequenceOrder.length; i++) {
            const animalId = sequenceOrder[i];
            const a = animals.find(an => an.id === animalId);
            if (!a) { console.warn('[Day3] no animal for id:', animalId); continue; }

            btn.textContent = a.emoji + ' ' + a.animal;
            console.log('[Day3] speaking:', a.onomatopoeia, 'rate:', a.speechRate, 'pitch:', a.speechPitch);

            await Audio.speak(a.onomatopoeia, {
              rate: a.speechRate,
              pitch: a.speechPitch
            });
            await sleep(500);
          }

          // Done playing — remove glow and show prompt
          document.querySelectorAll('.seq-jar').forEach(function(j) {
            j.classList.remove('highlight');
          });

          console.log('[Day3] sequence done');

          // Show the prompt: now it's the player's turn
          const status = document.getElementById('sequence-status');
          if (status) {
            status.innerHTML = '<span class="seq-hint">👆 Now you try! Tap the animals in order!</span>';
          }

          // Reactivate the play button as a hint
          btn.disabled = false;
          btn.textContent = '🔁 Replay if needed';

        } catch (e) {
          console.warn('[Day3] error:', e);
          const restored = document.getElementById('btn-play-sequence');
          if (restored) { restored.disabled = false; restored.textContent = '🔊 Play the sequence'; }
        }
      };
    }

    // Submit button
    if (submitBtn) {
      submitBtn.onclick = async () => {
        const correct = playerSequence.every(
          (id, i) => id === sequenceOrder[i]
        ) && playerSequence.length === sequenceOrder.length;

        if (correct) {
          // Success!
          onSequenceSuccess();
        } else {
          sequenceAttempts++;
          if (attemptsDisplay) {
            attemptsDisplay.textContent = `Attempts: ${sequenceAttempts} of ${MAX_ATTEMPTS}`;
          }
          if (sequenceAttempts >= MAX_ATTEMPTS) {
            // Too many attempts — let them try again with same sequence
            if (attemptsDisplay) {
              attemptsDisplay.textContent = `Let's listen again!`;
            }
            sequenceAttempts = 0;
            playerSequence = [];
            resetSequenceJars();
            if (submitBtn) submitBtn.style.display = 'none';
            Audio.speak("Let's listen again! Pay close attention!", { rate: 0.9 });
          } else {
            // Wrong, try again
            playerSequence = [];
            resetSequenceJars();
            if (submitBtn) submitBtn.style.display = 'none';
            Audio.speak('Not quite! Listen again and try once more!', { rate: 0.9 });
          }
        }
      };
    }

    // Show instruction text + speak it, THEN enable the play button
    const instructionText = 'Now listen to the sound password... then repeat it!';
    if (speechEl) {
      speechEl.innerHTML = `<div class="speech-bubble">${instructionText}</div>`;
    }

    // Speak instruction with play button disabled to avoid Edge TTS race
    await Audio.speak(instructionText, { rate: 0.85, cancelPrevious: true });

    // Now safe to enable — speech is done, no race possible
    if (playBtn) {
      playBtn.disabled = false;
      playBtn.textContent = '🔊 Play the sequence';
    }
  }

  function resetSequenceJars() {
    document.querySelectorAll('.seq-jar').forEach(j => j.classList.remove('selected'));
    const seqStatus = document.getElementById('sequence-status');
    if (seqStatus) {
      seqStatus.innerHTML = '';
    }
  }

  async function onSequenceSuccess() {
    const successEl = document.getElementById('day3-success');
    const seqPhase = document.getElementById('day3-sequence');
    const speechEl = document.getElementById('day3-speech');

    if (seqPhase) seqPhase.style.display = 'none';

    if (successEl) {
      successEl.style.display = 'flex';
      successEl.innerHTML = `
        <div class="success-card animate-pop">
          <div class="success-animals">
            ${sequenceOrder.map(id => {
              const a = animals.find(an => an.id === id);
              return `<span class="dancing-animal">${a ? a.emoji : '❓'}</span>`;
            }).join('')}
          </div>
          <p class="success-text">${data.days['3'].completionText}</p>
        </div>
      `;
    }

    if (speechEl) {
      speechEl.innerHTML = `<div class="speech-bubble happy">${data.days['3'].completionText}</div>`;
    }
    await Audio.speak(data.days['3'].completionText, { rate: 0.85 });
    App.onDayComplete(3);
  }

  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  return { init, start };
})();
