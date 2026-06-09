/**
 * Star Seed - Day 2 Engine: Color Power (Color Detective)
 * Child mixes primary colors, then finds matching real-world objects at home
 */
const EngineColor = (() => {
  let data = null;
  let colors = [];
  let foundColors = [];
  let currentColorIndex = 0;
  let isActive = false;

  function init(episodeData) {
    data = episodeData;
    colors = episodeData.days['2'].colors;
  }

  async function start() {
    isActive = true;
    foundColors = Storage.getState().day2ColorsFound;
    currentColorIndex = foundColors.length;

    if (currentColorIndex >= colors.length) {
      // All done, complete
      App.onDayComplete(2);
      return;
    }

    renderDay2();
    await speakIntro();
    await showColorChallenge(currentColorIndex);
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
      <div class="color-stage" id="day2-stage"></div>
      <div class="color-mix-area" id="day2-mix">
        <div class="mix-display" id="mix-display">
          <div class="mix-color1" id="mix-color1"></div>
          <span class="mix-plus">+</span>
          <div class="mix-color2" id="mix-color2"></div>
          <span class="mix-equals">=</span>
          <div class="mix-result" id="mix-result">?</div>
        </div>
        <div class="mix-buttons" id="mix-buttons"></div>
        <p class="mix-question" id="mix-question"></p>
      </div>
      <div class="find-object-phase" id="day2-find" style="display:none">
        <div class="target-color-display" id="day2-target-color"></div>
        <p class="find-prompt" id="day2-find-prompt"></p>
        <button class="btn btn-find" id="btn-found-it">✨ I FOUND IT! ✨</button>
      </div>
      <div class="confirm-phase" id="day2-confirm" style="display:none">
        <p class="confirm-question">Did it look like one of these?</p>
        <div class="confirm-examples" id="day2-examples"></div>
        <div class="confirm-buttons">
          <button class="btn btn-primary" id="btn-yes">Yes! 😊</button>
          <button class="btn btn-secondary" id="btn-no">Not yet...</button>
        </div>
      </div>
      <div class="color-success" id="day2-success" style="display:none"></div>
    `;
  }

  async function speakIntro() {
    const speechEl = document.getElementById('day2-speech');
    if (speechEl) {
      speechEl.innerHTML = `<div class="speech-bubble">${data.days['2'].storyIntro}</div>`;
    }
    await Audio.speak(data.days['2'].storyIntro, { rate: 0.85, cancelPrevious: true });
  }

  async function showColorChallenge(index) {
    if (index >= colors.length) {
      // All colors done
      const speechEl = document.getElementById('day2-speech');
      if (speechEl) {
        speechEl.innerHTML = `<div class="speech-bubble happy">${data.days['2'].completionText}</div>`;
      }
      await Audio.speak(data.days['2'].completionText, { rate: 0.85 });
      App.onDayComplete(2);
      return;
    }

    const color = colors[index];
    const mixDisplay = document.getElementById('mix-display');
    const mixBtns = document.getElementById('mix-buttons');
    const questionEl = document.getElementById('mix-question');
    const findPhase = document.getElementById('day2-find');
    const speechEl = document.getElementById('day2-speech');

    // Reset display
    if (mixDisplay) mixDisplay.style.display = 'flex';
    if (findPhase) findPhase.style.display = 'none';
    if (questionEl) questionEl.style.display = 'block';

    // Set up color display
    const c1 = document.getElementById('mix-color1');
    const c2 = document.getElementById('mix-color2');
    if (c1) { c1.style.backgroundColor = color.mixFrom[0]; c1.textContent = color.mixFrom[0]; }
    if (c2) { c2.style.backgroundColor = color.mixFrom[1]; c2.textContent = color.mixFrom[1]; }

    // Result shows "?"
    const result = document.getElementById('mix-result');
    if (result) {
      result.style.backgroundColor = 'transparent';
      result.textContent = '?';
      result.style.color = '#666';
    }

    if (questionEl) {
      questionEl.textContent = `What do ${color.mixFrom[0]} and ${color.mixFrom[1]} make?`;
    }

    // Create answer buttons with wrong + right answers
    if (mixBtns) {
      const allColors = ['red', 'blue', 'yellow', 'orange', 'green', 'purple'];
      const wrongColors = allColors.filter(c => c !== color.targetColor).slice(0, 2);
      const options = [color.targetColor, ...wrongColors].sort(() => Math.random() - 0.5);

      mixBtns.innerHTML = options.map(c =>
        `<button class="btn btn-color-option" data-color="${c}">
          <span class="color-dot" style="background:${c}"></span> ${c}
        </button>`
      ).join('');

      mixBtns.querySelectorAll('.btn-color-option').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (btn.dataset.color === color.targetColor) {
            // Correct!
            if (result) {
              result.style.backgroundColor = color.targetColor;
              result.textContent = '✓';
              result.style.color = '#fff';
            }
            if (questionEl) questionEl.style.display = 'none';
            mixBtns.style.display = 'none';

            await Audio.speak(`Yes! ${color.mixFrom[0]} and ${color.mixFrom[1]} make ${color.targetColor}!`, { rate: 0.85 });

            // Show find-object phase
            showFindObjectPhase(color);
          } else {
            btn.classList.add('shake');
            setTimeout(() => btn.classList.remove('shake'), 500);
            Audio.speak('Try again!', { rate: 0.9 });
          }
        });
      });
    }

    if (speechEl) {
      speechEl.innerHTML = `<div class="speech-bubble">What do ${color.mixFrom[0]} and ${color.mixFrom[1]} make?</div>`;
    }
    await Audio.speak(`What do ${color.mixFrom[0]} and ${color.mixFrom[1]} make?`, { rate: 0.85 });
  }

  function showFindObjectPhase(color) {
    const findPhase = document.getElementById('day2-find');
    const targetDisplay = document.getElementById('day2-target-color');
    const promptEl = document.getElementById('day2-find-prompt');
    const foundBtn = document.getElementById('btn-found-it');
    const speechEl = document.getElementById('day2-speech');

    if (findPhase) findPhase.style.display = 'flex';
    if (targetDisplay) {
      targetDisplay.innerHTML = `
        <div class="target-color-circle" style="background:${color.targetColor}">
          <span class="target-color-emoji">${color.targetEmoji}</span>
        </div>
        <p class="target-color-name">${color.targetColor.toUpperCase()}</p>
      `;
    }
    if (promptEl) promptEl.textContent = color.promptText;

    if (foundBtn) {
      foundBtn.onclick = () => {
        showConfirmPhase(color);
      };
    }

    if (speechEl) {
      speechEl.innerHTML = `<div class="speech-bubble">${color.speechText}</div>`;
    }
    Audio.speak(color.speechText, { rate: 0.85 });
  }

  function showConfirmPhase(color) {
    const findPhase = document.getElementById('day2-find');
    const confirmPhase = document.getElementById('day2-confirm');
    const examplesEl = document.getElementById('day2-examples');
    const yesBtn = document.getElementById('btn-yes');
    const noBtn = document.getElementById('btn-no');

    if (findPhase) findPhase.style.display = 'none';
    if (confirmPhase) confirmPhase.style.display = 'flex';

    if (examplesEl) {
      examplesEl.innerHTML = color.exampleItems.map(item =>
        `<div class="example-item">
          <span class="example-emoji">${getEmojiForItem(item)}</span>
          <span class="example-name">${item}</span>
        </div>`
      ).join('');
    }

    if (yesBtn) {
      yesBtn.onclick = async () => {
        onColorFound(color);
      };
    }

    if (noBtn) {
      noBtn.onclick = () => {
        confirmPhase.style.display = 'none';
        findPhase.style.display = 'flex';
        Audio.speak('Keep looking! You can do it!', { rate: 0.9 });
      };
    }

    Audio.speak('Did it look like one of these?', { rate: 0.85 });
  }

  async function onColorFound(color) {
    foundColors.push(color.id);
    Storage.addDay2Color(color.id);
    App.updateStatusBar();

    const confirmPhase = document.getElementById('day2-confirm');
    const successEl = document.getElementById('day2-success');
    const speechEl = document.getElementById('day2-speech');

    if (confirmPhase) confirmPhase.style.display = 'none';

    // Show success for this color
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

      document.getElementById('btn-next-color').addEventListener('click', () => {
        successEl.style.display = 'none';
        currentColorIndex++;
        showColorChallenge(currentColorIndex);
      });
    }

    if (speechEl) {
      speechEl.innerHTML = `<div class="speech-bubble happy">You found something ${color.targetColor}! Amazing!</div>`;
    }
    await Audio.speak(`You found something ${color.targetColor}! Amazing!`, { rate: 0.85 });
  }

  function getEmojiForItem(item) {
    const map = {
      carrot: '🥕', orange: '🍊', pumpkin: '🎃',
      leaf: '🍃', cucumber: '🥒', grass: '🌿',
      grape: '🍇', eggplant: '🍆', flower: '🌸'
    };
    return map[item] || '🔍';
  }

  return { init, start };
})();
