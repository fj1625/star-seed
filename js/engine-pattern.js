/**
 * Star Seed - Day 2 Engine: Pattern Power (Animal Pattern Puzzle)
 * Drag skin patterns (stripes, spots, scales) onto the correct animal silhouettes
 */
const EnginePattern = (() => {
  let data = null;
  let patterns = [];
  let animals = [];
  let matchedAnimals = [];
  let currentAnimalIndex = 0;
  let isActive = false;
  let dragState = null;
  let pendingTimers = new Set();

  function init(episodeData) {
    data = episodeData;
    const dayData = episodeData.days?.['2'] || {};
    patterns = dayData.patterns || [];
    animals = dayData.patternAnimals || [];
  }

  async function start() {
    isActive = true;
    clearPendingTimers();
    matchedAnimals = Storage.getState().day2PatternsMatched || [];
    currentAnimalIndex = Math.min(matchedAnimals.length, animals.length - 1);

    if (matchedAnimals.length >= animals.length) {
      App.onDayComplete(2);
      return;
    }

    renderDay2();
    await Utils.speakIntro(2, data);
    startPatternChallenge(currentAnimalIndex);
  }

  function renderDay2() {
    const container = document.getElementById('day2');
    if (!container) return;

    const dayLabel = data.days?.['2']?.tabLabel || 'Day 2';
    const dayTitle = data.days?.['2']?.title || 'Pattern Puzzle';

    container.innerHTML = `
      <div class="day-header">
        <span class="day-badge">${dayLabel}</span>
        <h2>🌈 Pattern Power</h2>
        <p class="day-subtitle">${dayTitle}</p>
      </div>
      <div class="twinkle-speech" id="day2-speech" aria-live="polite" aria-atomic="true"></div>

      <div class="pattern-stage" id="day2-pattern-stage">
        <p class="pattern-instruction">Drag the pattern onto the right animal!</p>
        <div class="pattern-animal-targets" id="pattern-targets"></div>
        <div class="pattern-swatch-pool" id="pattern-pool"></div>
      </div>

      <div class="pattern-find-phase" id="day2-find" style="display:none">
        <div class="pattern-find-emoji">🔍</div>
        <p class="pattern-find-prompt" id="day2-find-prompt"></p>
        <button class="btn btn-find" id="btn-pattern-found">✨ I FOUND IT! ✨</button>
      </div>

      <div class="pattern-success" id="day2-success" style="display:none"></div>
    `;
  }

  function startPatternChallenge(index) {
    if (index >= animals.length) {
      completeAllPatterns();
      return;
    }

    currentAnimalIndex = index;
    showOnly('day2-pattern-stage');

    const targetsEl = document.getElementById('pattern-targets');
    const poolEl = document.getElementById('pattern-pool');
    const speechEl = document.getElementById('day2-speech');
    const currentAnimal = animals[index];

    if (!targetsEl || !poolEl) return;

    // Show the current animal silhouette as the drop target
    targetsEl.innerHTML = `
      <div class="pattern-animal-card" id="pattern-target-${currentAnimal.id}" data-animal="${currentAnimal.id}">
        <div class="pattern-animal-silhouette">${currentAnimal.silhouetteEmoji}</div>
        <div class="pattern-animal-name">${currentAnimal.animal}</div>
        <div class="pattern-drop-zone" id="drop-zone-${currentAnimal.id}">?</div>
      </div>
    `;

    // Show all pattern swatches in random order
    const shuffledPatterns = [...patterns].sort(() => Math.random() - 0.5);
    poolEl.innerHTML = shuffledPatterns.map(p => `
      <div class="pattern-swatch" id="pattern-swatch-${p.id}" data-pattern="${p.id}" draggable="false">
        <div class="pattern-swatch-preview ${p.patternClass}"></div>
        <div class="pattern-swatch-label">${p.label}</div>
      </div>
    `).join('');

    bindDragEvents();

    if (speechEl) {
      speechEl.innerHTML = `<div class="speech-bubble">What pattern does a ${currentAnimal.animal} have? Drag the right pattern!</div>`;
    }
    Audio.speak(`What pattern does a ${currentAnimal.animal} have? Drag the right pattern!`, { rate: 0.85 });
  }

  function bindDragEvents() {
    const swatches = document.querySelectorAll('.pattern-swatch');
    swatches.forEach(swatch => {
      const cleanSwatch = Utils.replaceWithClone(swatch);

      cleanSwatch.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        cleanSwatch.setPointerCapture(e.pointerId);

        const rect = cleanSwatch.getBoundingClientRect();
        dragState = {
          el: cleanSwatch,
          startX: e.clientX,
          startY: e.clientY,
          originX: rect.left + rect.width / 2,
          originY: rect.top + rect.height / 2,
          patternId: cleanSwatch.dataset.pattern
        };

        cleanSwatch.classList.add('dragging');
      });

      cleanSwatch.addEventListener('pointermove', (e) => {
        if (!dragState || dragState.el !== cleanSwatch) return;
        e.preventDefault();

        const dx = e.clientX - dragState.startX;
        const dy = e.clientY - dragState.startY;
        cleanSwatch.style.transform = `translate(${dx}px, ${dy}px)`;
      });

      cleanSwatch.addEventListener('pointerup', (e) => {
        if (!dragState || dragState.el !== cleanSwatch) return;
        cleanSwatch.classList.remove('dragging');

        const target = getDropTarget(e.clientX, e.clientY);
        if (target) {
          checkPatternMatch(dragState.patternId, target);
        } else {
          cleanSwatch.style.transform = '';
        }
        dragState = null;
      });

      cleanSwatch.addEventListener('pointercancel', () => {
        if (dragState && dragState.el === cleanSwatch) {
          cleanSwatch.classList.remove('dragging');
          cleanSwatch.style.transform = '';
          dragState = null;
        }
      });
    });
  }

  function getDropTarget(x, y) {
    const targetCard = document.querySelector('.pattern-animal-card');
    if (!targetCard) return null;

    const rect = targetCard.getBoundingClientRect();
    const padding = 40;
    if (
      x >= rect.left - padding &&
      x <= rect.right + padding &&
      y >= rect.top - padding &&
      y <= rect.bottom + padding
    ) {
      return targetCard.dataset.animal;
    }
    return null;
  }

  async function checkPatternMatch(patternId, animalId) {
    const currentAnimal = animals[currentAnimalIndex];
    if (animalId !== currentAnimal.id) return;

    if (patternId === currentAnimal.patternId) {
      // Correct!
      await onPatternMatched(currentAnimal, patternId);
    } else {
      // Wrong pattern — shake the target and reset swatch
      const targetCard = document.getElementById(`pattern-target-${animalId}`);
      if (targetCard) {
        targetCard.classList.add('shake');
        setTimeout(() => targetCard.classList.remove('shake'), 500);
      }
      const swatch = document.getElementById(`pattern-swatch-${patternId}`);
      if (swatch) swatch.style.transform = '';
      Audio.speak('Not that one. Try another pattern!', { rate: 0.9 });
    }
  }

  async function onPatternMatched(animal, patternId) {
    if (matchedAnimals.includes(animal.id)) return;

    matchedAnimals.push(animal.id);
    Storage.addDay2Pattern && Storage.addDay2Pattern(animal.id);
    App.updateStatusBar();

    const pattern = patterns.find(p => p.id === patternId);
    const targetCard = document.getElementById(`pattern-target-${animal.id}`);
    const dropZone = document.getElementById(`drop-zone-${animal.id}`);
    const speechEl = document.getElementById('day2-speech');

    // Reveal the real animal
    if (dropZone && pattern) {
      dropZone.innerHTML = `<div class="pattern-reveal-animal">${animal.emoji}</div>`;
      dropZone.classList.add('matched');
    }
    if (targetCard) {
      targetCard.classList.add('matched');
    }

    if (speechEl) {
      speechEl.innerHTML = `<div class="speech-bubble happy">${animal.speechText}</div>`;
    }
    await Audio.speak(animal.speechText, { rate: 0.85 });

    await sleep(1500);

    currentAnimalIndex++;
    if (currentAnimalIndex >= animals.length) {
      showFindPhase();
    } else {
      startPatternChallenge(currentAnimalIndex);
    }
  }

  function showFindPhase() {
    showOnly('day2-find');

    const promptEl = document.getElementById('day2-find-prompt');
    const foundBtn = document.getElementById('btn-pattern-found');
    const speechEl = document.getElementById('day2-speech');
    const findPrompt = data.days?.['2']?.findPrompt || 'Find something at home with stripes, spots, or scales!';

    if (promptEl) promptEl.textContent = findPrompt;

    if (foundBtn) {
      const cleanBtn = Utils.replaceWithClone(foundBtn);
      cleanBtn.addEventListener('click', () => completeAllPatterns());
    }

    if (speechEl) {
      speechEl.innerHTML = `<div class="speech-bubble">${findPrompt}</div>`;
    }
    Audio.speak(findPrompt, { rate: 0.85 });
  }

  async function completeAllPatterns() {
    const speechEl = document.getElementById('day2-speech');
    if (speechEl) {
      speechEl.innerHTML = `<div class="speech-bubble happy">${data.days['2'].completionText}</div>`;
    }
    await Audio.speak(data.days['2'].completionText, { rate: 0.85 });
    App.onDayComplete(2);
  }

  function showOnly(showId) {
    Utils.showOnly(['day2-pattern-stage', 'day2-find', 'day2-success'], showId);
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
    clearPendingTimers();
    Audio.cancel();
  }

  return { init, start, stop };
})();
