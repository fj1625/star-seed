/**
 * Star Seed - Day 5 Engine: Heart Power (Collaborative Finale)
 * Child finds parent, assembles puzzle, plants real seed, gets certificate
 */
const EngineHeart = (() => {
  let data = null;
  let isActive = false;

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
    bindDay5Events();
    await speakIntro();
  }

  function renderDay5() {
    const container = document.getElementById('day5');
    if (!container) return;

    container.innerHTML = `
      <div class="day-header">
        <span class="day-badge">Day 5</span>
        <h2>❤️ Heart Power</h2>
        <p class="day-subtitle">Heart of the Star</p>
      </div>
      <div class="twinkle-speech" id="day5-speech"></div>
      <div class="heart-phase-intro" id="heart-phase-intro">
        <div class="heart-twinkle-display">
          <div class="twinkle-needs-help">✨💔✨</div>
        </div>
        <p class="heart-message" id="heart-message">Twinkle needs someone who loves you...</p>
        <button class="btn btn-heart" id="btn-find-helper">🔍 Find My Earth Helper!</button>
      </div>
      <div class="heart-phase-puzzle" id="heart-phase-puzzle" style="display:none">
        <p class="puzzle-instruction">Let's put Twinkle's heart back together!</p>
        <div class="puzzle-grid" id="puzzle-grid">
          <!-- 5 puzzle pieces: 4 auto-placed, 1 missing -->
        </div>
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
      <div class="heart-success" id="day5-success" style="display:none"></div>
    `;
  }

  async function speakIntro() {
    const speechEl = document.getElementById('day5-speech');
    if (speechEl) {
      speechEl.innerHTML = `<div class="speech-bubble">${data.days['5'].storyIntro}</div>`;
    }
    await Audio.speak(data.days['5'].storyIntro, { rate: 0.85, cancelPrevious: true });
  }

  function bindDay5Events() {
    const findBtn = document.getElementById('btn-find-helper');
    if (!findBtn) return;

    findBtn.addEventListener('click', () => {
      // Child goes to find parent
      const introPhase = document.getElementById('heart-phase-intro');
      const puzzlePhase = document.getElementById('heart-phase-puzzle');
      const speechEl = document.getElementById('day5-speech');
      const msgEl = document.getElementById('heart-message');

      if (introPhase) introPhase.style.display = 'none';
      if (msgEl) msgEl.textContent = 'Go find your Earth Helper! Someone who loves you! 💕';

      Audio.speak('Go find your Earth Helper! Find someone who loves you! Bring them here!', { rate: 0.85 });

      // After a delay, show the puzzle (simulating child returning with parent)
      setTimeout(() => {
        if (puzzlePhase) puzzlePhase.style.display = 'block';
        if (speechEl) {
          speechEl.innerHTML = `<div class="speech-bubble">You found your Earth Helper! Now let's complete the puzzle!</div>`;
        }
        Audio.speak('You found your Earth Helper! Now, the puzzle is almost complete. One piece is missing...', { rate: 0.85 });
        buildPuzzle();
        setupHeartCodeEntry();
      }, 4000);
    });
  }

  function buildPuzzle() {
    const grid = document.getElementById('puzzle-grid');
    if (!grid) return;

    const powers = ['light', 'color', 'sound', 'motion'];
    const pieces = [
      { power: 'light', emoji: '🔆', color: '#FFD700', label: 'Light' },
      { power: 'color', emoji: '🌈', color: '#FF6B9D', label: 'Color' },
      { power: 'sound', emoji: '🎵', color: '#4ECDC4', label: 'Sound' },
      { power: 'motion', emoji: '💫', color: '#A78BFA', label: 'Motion' },
      { power: 'heart', emoji: '❤️', color: '#EF4444', label: 'Heart', missing: true }
    ];

    // Shuffle pieces for layout
    const shuffled = [...pieces].sort(() => Math.random() - 0.5);

    grid.innerHTML = shuffled.map(p => {
      if (p.missing) {
        return `
          <div class="puzzle-piece missing" id="piece-heart">
            <div class="piece-inner">
              <span class="piece-question">❓</span>
              <span class="piece-label">Missing!</span>
            </div>
          </div>
        `;
      }
      return `
        <div class="puzzle-piece placed animate-pop" style="--piece-color:${p.color}">
          <div class="piece-inner">
            <span class="piece-emoji">${p.emoji}</span>
            <span class="piece-label">${p.label}</span>
          </div>
        </div>
      `;
    }).join('');
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
      input.addEventListener('input', (e) => {
        const val = e.target.value.replace(/[^0-9]/g, '');
        e.target.value = val.slice(0, 1);
        if (val && i < 2) {
          const next = [d1, d2, d3][i + 1];
          if (next) next.focus();
        }
        if (val && i === 2) {
          setTimeout(() => checkBtn?.click(), 300);
        }
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !input.value && i > 0) {
          const prev = [d1, d2, d3][i - 1];
          if (prev) prev.focus();
        }
      });
    });

    if (checkBtn) {
      checkBtn.onclick = async () => {
        const entered = `${d1?.value || ''}${d2?.value || ''}${d3?.value || ''}`;
        const heartCode = data.days['5'].heartPieceCode; // "999"

        if (entered === heartCode) {
          // Heart piece found!
          onHeartPiecePlaced();
        } else {
          if (errorEl) {
            errorEl.textContent = 'Not quite... Check the back of the Heart Piece card!';
            errorEl.style.display = 'block';
            setTimeout(() => { errorEl.style.display = 'none'; }, 3000);
          }
          Audio.speak('Not quite right. Check the back of the Heart Piece card!', { rate: 0.9 });
        }
      };
    }
  }

  async function onHeartPiecePlaced() {
    // Update puzzle
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

    // Hide code entry
    const codeEntry = document.getElementById('heart-piece-entry');
    if (codeEntry) codeEntry.style.display = 'none';

    const speechEl = document.getElementById('day5-speech');
    if (speechEl) {
      speechEl.innerHTML = `<div class="speech-bubble happy">The heart is complete! Now... Twinkle wants to stay with you. In YOUR world!</div>`;
    }
    await Audio.speak('The heart is complete! Now Twinkle wants to stay with you. Will you plant a seed for me?', { rate: 0.85 });

    // Move to plant phase
    setTimeout(() => {
      showPlantPhase();
    }, 2000);
  }

  function showPlantPhase() {
    const puzzlePhase = document.getElementById('heart-phase-puzzle');
    const plantPhase = document.getElementById('heart-phase-plant');
    const plantMsg = document.getElementById('plant-message-text');
    const speechEl = document.getElementById('day5-speech');

    if (puzzlePhase) puzzlePhase.style.display = 'none';
    if (plantPhase) plantPhase.style.display = 'flex';

    if (plantMsg) plantMsg.textContent = data.days['5'].plantMessage;

    if (speechEl) {
      speechEl.innerHTML = `<div class="speech-bubble">Earth Helper: give your child a real seed! I want to grow in your world!</div>`;
    }
    Audio.speak('Earth Helper! Give your Star Guardian a real seed and a little pot with soil!', { rate: 0.85 });

    // Countdown button
    const plantBtn = document.getElementById('btn-plant-done');
    const countdownEl = document.getElementById('plant-countdown');
    const countNum = document.getElementById('countdown-number');

    if (plantBtn) {
      plantBtn.onclick = async () => {
        // Start countdown
        plantBtn.style.display = 'none';
        if (countdownEl) countdownEl.style.display = 'block';

        for (let i = 5; i >= 1; i--) {
          if (countNum) countNum.textContent = i;
          await Audio.speak(String(i), { rate: 0.7 });
          await sleep(1000);
        }

        if (countNum) countNum.textContent = '🌱';
        await Audio.speak('Plant the seed now!', { rate: 0.8 });

        setTimeout(() => {
          onPlantComplete();
        }, 1500);
      };
    }
  }

  async function onPlantComplete() {
    const plantPhase = document.getElementById('heart-phase-plant');
    const successEl = document.getElementById('day5-success');
    const speechEl = document.getElementById('day5-speech');

    if (plantPhase) plantPhase.style.display = 'none';

    if (successEl) {
      successEl.style.display = 'flex';
      successEl.innerHTML = `
        <div class="success-card animate-pop">
          <div class="plant-celebration">🌰 → 🌱 → 🌿 → 🌻</div>
          <p class="success-text">${data.days['5'].completionText}</p>
        </div>
      `;
    }

    if (speechEl) {
      speechEl.innerHTML = `<div class="speech-bubble happy">${data.days['5'].completionText}</div>`;
    }
    await Audio.speak(data.days['5'].completionText, { rate: 0.85 });
    App.onDayComplete(5);
  }

  function showCertificate() {
    const container = document.getElementById('complete');
    if (!container) return;

    const day5Data = data.days['5'];
    const playerName = Storage.getState().playerName || 'Star Guardian';

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
            <p class="certificate-subtext">${day5Data.certificateSubtext}</p>
            <div class="certificate-date">${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
            <div class="certificate-signature">
              <span class="sig-star">⭐</span>
              <span class="sig-text">Twinkle</span>
            </div>
          </div>
        </div>
        <div class="episode-preview">
          <h3>More Adventures Coming Soon!</h3>
          <div class="preview-weeks">
            <div class="preview-week locked">
              <span class="preview-icon">🐾</span>
              <span class="preview-label">Week 2: Animals</span>
              <span class="preview-lock">🔒</span>
            </div>
            <div class="preview-week locked">
              <span class="preview-icon">🍎</span>
              <span class="preview-label">Week 3: Body & Food</span>
              <span class="preview-lock">🔒</span>
            </div>
            <div class="preview-week locked">
              <span class="preview-icon">🌿</span>
              <span class="preview-label">Week 4: Nature</span>
              <span class="preview-lock">🔒</span>
            </div>
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

    // Bind restart
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

  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  return { init, start, showCertificate };
})();
