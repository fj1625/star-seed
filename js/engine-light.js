/**
 * Star Seed - Day 1 Engine: Light Power (Hidden Object Hunt)
 * Child finds 4 physical cards hidden at home, enters codes, collects letters, spells STAR
 */
const EngineLight = (() => {
  let data = null;
  let cards = [];
  let foundCards = [];
  let collectedLetters = [];
  let currentCardIndex = 0;
  let isActive = false;

  function init(episodeData) {
    data = episodeData;
    cards = episodeData.days?.['1']?.cards || [];
    if (!cards.length) {
      console.error('[EngineLight] Day 1 data missing or empty');
    }
  }

  async function start() {
    isActive = true;
    foundCards = Storage.getState().day1CardsFound;
    collectedLetters = Storage.getState().day1Letters;

    // Restore progress if resuming
    if (foundCards.length >= cards.length) {
      // All cards found, go to spelling phase
      showSpellingPhase();
      return;
    }

    currentCardIndex = foundCards.length;
    renderDay1();
    await Utils.speakIntro(1, data);
    await showCardHunt(currentCardIndex);
  }

  function renderDay1() {
    const container = document.getElementById('day1');
    if (!container) return;

    container.innerHTML = `
      <div class="day-header">
        <span class="day-badge">Day 1</span>
        <h2>🔦 Light Power</h2>
        <p class="day-subtitle">Hidden Star Fragments</p>
      </div>
      <div class="twinkle-speech" id="day1-speech" aria-live="polite" aria-atomic="true"></div>
      <div class="silhouette-display" id="day1-silhouette"></div>
      <div class="code-entry" id="day1-code-entry" style="display:none">
        <p class="code-prompt">Enter the secret code from the card!</p>
        <div class="code-inputs">
          <input type="number" id="code-digit-1" min="0" max="9" maxlength="1" inputmode="numeric" pattern="[0-9]">
          <input type="number" id="code-digit-2" min="0" max="9" maxlength="1" inputmode="numeric" pattern="[0-9]">
          <input type="number" id="code-digit-3" min="0" max="9" maxlength="1" inputmode="numeric" pattern="[0-9]">
        </div>
        <button class="btn btn-primary" id="btn-submit-code">Check!</button>
        <p class="code-error" id="day1-code-error"></p>
        <p class="code-hint">Can't find the card? <button class="btn-link" id="btn-another-hint">Give me a hint!</button></p>
      </div>
      <div class="card-found-display" id="day1-found" style="display:none"></div>
      <div class="letter-display" id="day1-letters" style="display:none">
        <h3>Letters you've collected:</h3>
        <div class="letter-tiles" id="letter-tiles"></div>
      </div>
      <div class="spelling-phase" id="day1-spelling" style="display:none">
        <h3>Now... spell the secret word!</h3>
        <p class="spelling-hint">Arrange the letters to make a word. Hint: It's something in the night sky ✨</p>
        <div class="spelling-slots" id="spelling-slots"></div>
        <div class="spelling-letters" id="spelling-letters-pool"></div>
        <button class="btn btn-primary" id="btn-check-spelling" style="display:none">Check my word!</button>
        <p class="spelling-feedback" id="spelling-feedback"></p>
      </div>
      <div class="next-card-area" id="day1-next" style="display:none">
        <button class="btn btn-primary" id="btn-next-card">Next Card →</button>
      </div>
    `;

    // Update letter display if resuming
    if (collectedLetters.length > 0) {
      updateLetterDisplay();
    }
  }


  async function showCardHunt(index) {
    if (index >= cards.length) {
      // All cards found
      showSpellingPhase();
      return;
    }

    const card = cards[index];
    const silhouetteEl = document.getElementById('day1-silhouette');
    const codeEntryEl = document.getElementById('day1-code-entry');
    const foundEl = document.getElementById('day1-found');
    const nextEl = document.getElementById('day1-next');
    const speechEl = document.getElementById('day1-speech');

    // Re-render code entry to destroy old event listeners from previous cards
    if (codeEntryEl) {
      codeEntryEl.innerHTML = `
        <p class="code-prompt">Enter the secret code from the card!</p>
        <div class="code-inputs">
          <input type="number" id="code-digit-1" min="0" max="9" maxlength="1" inputmode="numeric" pattern="[0-9]">
          <input type="number" id="code-digit-2" min="0" max="9" maxlength="1" inputmode="numeric" pattern="[0-9]">
          <input type="number" id="code-digit-3" min="0" max="9" maxlength="1" inputmode="numeric" pattern="[0-9]">
        </div>
        <button class="btn btn-primary" id="btn-submit-code">Check!</button>
        <p class="code-error" id="day1-code-error"></p>
        <p class="code-hint">Can't find the card? <button class="btn-link" id="btn-another-hint">Give me a hint!</button></p>
      `;
      codeEntryEl.style.display = 'none';
    }

    // Show silhouette
    if (silhouetteEl) {
      silhouetteEl.style.display = 'flex';
      silhouetteEl.innerHTML = `
        <div class="silhouette-card">
          <div class="silhouette-icon">${card.silhouetteEmoji}</div>
          <p class="silhouette-label">Card ${index + 1} of ${cards.length}</p>
          <p class="silhouette-hint">${card.hintText}</p>
        </div>
        <button class="btn btn-secondary" id="btn-show-code">I found it! Enter code →</button>
      `;

      document.getElementById('btn-show-code').addEventListener('click', () => {
        if (codeEntryEl) codeEntryEl.style.display = 'block';
        document.getElementById('code-digit-1')?.focus();
        document.getElementById('btn-show-code').style.display = 'none';
      });
    }

    // Speak hint
    if (speechEl) {
      speechEl.innerHTML = `<div class="speech-bubble">${card.hintText}</div>`;
    }
    await Audio.speak(card.hintText, { rate: 0.85 });

    // Set up code entry
    setupCodeEntry(index);
  }

  function setupCodeEntry(index) {
    const card = cards[index];
    const btn = document.getElementById('btn-submit-code');
    const errorEl = document.getElementById('day1-code-error');
    const hintBtn = document.getElementById('btn-another-hint');

    // Auto-advance between code digits
    const d1 = document.getElementById('code-digit-1');
    const d2 = document.getElementById('code-digit-2');
    const d3 = document.getElementById('code-digit-3');

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
        // If last digit entered, auto-submit
        if (val && i === 2) {
          setTimeout(() => btn?.click(), 300);
        }
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !input.value && i > 0) {
          const prev = [d1, d2, d3][i - 1];
          if (prev) prev.focus();
        }
      });
    });

    if (btn) {
      btn.onclick = async () => {
        const entered = `${d1?.value || ''}${d2?.value || ''}${d3?.value || ''}`;
        if (entered === card.code) {
          // Correct!
          onCardFound(index, card);
        } else {
          if (errorEl) {
            errorEl.textContent = 'Not quite right... Try again!';
            errorEl.style.display = 'block';
            setTimeout(() => { errorEl.style.display = 'none'; }, 2000);
          }
          Audio.speak('Not quite right. Try again!', { rate: 0.9 });
        }
      };
    }

    if (hintBtn) {
      hintBtn.onclick = () => {
        Audio.speak(card.hintText, { rate: 0.8 });
      };
    }
  }

  async function onCardFound(index, card) {
    // Prevent duplicate processing (safety net)
    if (foundCards.includes(card.id)) return;

    foundCards.push(card.id);
    collectedLetters.push(card.letter);
    Storage.addDay1Card(card.id, card.letter);
    App.updateStatusBar();

    // Hide code entry, show found
    const codeEntryEl = document.getElementById('day1-code-entry');
    const foundEl = document.getElementById('day1-found');
    const nextEl = document.getElementById('day1-next');
    const silhouetteEl = document.getElementById('day1-silhouette');
    const speechEl = document.getElementById('day1-speech');

    if (codeEntryEl) codeEntryEl.style.display = 'none';
    if (silhouetteEl) silhouetteEl.style.display = 'none';

    if (foundEl) {
      foundEl.style.display = 'flex';
      foundEl.innerHTML = `
        <div class="found-card animate-pop">
          <div class="found-icon">${card.emoji}</div>
          <div class="found-word">${card.word}</div>
          <div class="found-letter">${card.letter}</div>
          <div class="found-glow"></div>
        </div>
        <p class="found-text">${card.foundText}</p>
      `;
    }

    if (speechEl) {
      speechEl.innerHTML = `<div class="speech-bubble happy">${card.foundText}</div>`;
    }
    await Audio.speak(card.foundText, { rate: 0.85 });

    // Voice prompt: say the word
    const voiceWrap = document.createElement('div');
    voiceWrap.className = 'mini-voice-prompt';
    voiceWrap.innerHTML = `
      <p class="mini-voice-hint">Say it: <strong>${Utils.capitalize(card.word)}!</strong></p>
      <button class="btn btn-tiny btn-mini-mic" id="btn-day1-voice">🎤 Speak</button>
      <span class="mini-voice-result" id="day1-voice-result"></span>
    `;
    if (foundEl) foundEl.appendChild(voiceWrap);

    const micBtn = voiceWrap.querySelector('#btn-day1-voice');
    const resultSpan = voiceWrap.querySelector('#day1-voice-result');
    micBtn.addEventListener('click', () => {
      VoiceInput.listen({
        lang: 'en-US',
        onInterim: (text) => { resultSpan.textContent = '👂 ' + text; },
        onResult: (text) => {
          if (text.toLowerCase().includes(card.word.toLowerCase())) {
            resultSpan.textContent = '✅ Perfect!';
            Audio.speak('Perfect! ' + Utils.capitalize(card.word) + '!', { rate: 0.85 });
          } else {
            resultSpan.textContent = '💬 Good try!';
            Audio.speak('Good try! ' + Utils.capitalize(card.word) + '!', { rate: 0.85 });
          }
        },
        onError: () => { resultSpan.textContent = 'That\'s okay!'; }
      });
    });

    updateLetterDisplay();

    // Show next button
    if (nextEl) {
      nextEl.style.display = 'block';
      nextEl.querySelector('#btn-next-card').onclick = async () => {
        // Remove voice prompt
        const vp = document.querySelector('.mini-voice-prompt');
        if (vp) vp.remove();
        // Reset UI for next card
        if (foundEl) foundEl.style.display = 'none';
        if (nextEl) nextEl.style.display = 'none';
        currentCardIndex = index + 1;
        await showCardHunt(currentCardIndex);
      };
    }
  }

  function updateLetterDisplay() {
    const container = document.getElementById('day1-letters');
    const tilesEl = document.getElementById('letter-tiles');
    if (!container || !tilesEl) return;

    if (collectedLetters.length > 0) {
      container.style.display = 'block';
      tilesEl.innerHTML = collectedLetters.map(l =>
        `<span class="letter-tile collected animate-pop">${l}</span>`
      ).join('');
    }
  }

  function showSpellingPhase() {
    const spellingEl = document.getElementById('day1-spelling');
    const silhouetteEl = document.getElementById('day1-silhouette');
    const codeEntryEl = document.getElementById('day1-code-entry');
    const foundEl = document.getElementById('day1-found');
    const nextEl = document.getElementById('day1-next');
    const lettersEl = document.getElementById('day1-letters');
    const speechEl = document.getElementById('day1-speech');

    // Hide other elements
    if (silhouetteEl) silhouetteEl.style.display = 'none';
    if (codeEntryEl) codeEntryEl.style.display = 'none';
    if (foundEl) foundEl.style.display = 'none';
    if (nextEl) nextEl.style.display = 'none';

    // Show spelling phase
    if (spellingEl) spellingEl.style.display = 'block';
    if (lettersEl) lettersEl.style.display = 'block';

    // Build spelling UI
    const slotsEl = document.getElementById('spelling-slots');
    const poolEl = document.getElementById('spelling-letters-pool');
    const checkBtn = document.getElementById('btn-check-spelling');
    const feedbackEl = document.getElementById('spelling-feedback');

    const targetWord = data.days['1'].targetWord; // "STAR"
    let placedLetters = new Array(targetWord.length).fill(null);

    // Create drop slots
    if (slotsEl) {
      slotsEl.innerHTML = targetWord.split('').map((_, i) =>
        `<div class="spelling-slot" role="button" tabindex="0" data-slot="${i}" id="slot-${i}"></div>`
      ).join('');
    }

    // Create letter pool (shuffled)
    if (poolEl) {
      const shuffled = [...collectedLetters].sort(() => Math.random() - 0.5);
      poolEl.innerHTML = shuffled.map((letter, i) =>
        `<div class="spelling-letter" role="button" tabindex="0" data-letter="${letter}" data-pool-index="${i}" id="pool-${i}">
          ${letter}
        </div>`
      ).join('');
    }

    // Tap letter → place in first empty slot
    if (poolEl) {
      poolEl.querySelectorAll('.spelling-letter').forEach(letterEl => {
        letterEl.addEventListener('click', () => {
          if (letterEl.classList.contains('placed')) return;

          // Find first empty slot
          const emptySlot = placedLetters.findIndex(l => l === null);
          if (emptySlot === -1) return;

          placedLetters[emptySlot] = letterEl.dataset.letter;
          const slotEl = document.getElementById(`slot-${emptySlot}`);
          if (slotEl) {
            slotEl.textContent = letterEl.dataset.letter;
            slotEl.classList.add('filled');
            slotEl.dataset.poolIndex = letterEl.dataset.poolIndex;
          }

          letterEl.classList.add('placed');

          // Show check button when all slots filled
          if (placedLetters.every(l => l !== null)) {
            if (checkBtn) checkBtn.style.display = 'block';
          }
        });
      });
    }

    // Tap slot → remove letter back to pool
    if (slotsEl) {
      slotsEl.querySelectorAll('.spelling-slot').forEach(slotEl => {
        slotEl.addEventListener('click', () => {
          const slotIdx = parseInt(slotEl.dataset.slot);
          if (placedLetters[slotIdx] === null) return;

          const poolIdx = slotEl.dataset.poolIndex;
          const poolLetter = document.getElementById(`pool-${poolIdx}`);
          if (poolLetter) poolLetter.classList.remove('placed');

          placedLetters[slotIdx] = null;
          slotEl.textContent = '';
          slotEl.classList.remove('filled');
          slotEl.dataset.poolIndex = '';

          if (checkBtn) checkBtn.style.display = 'none';
        });
      });
    }

    // Check spelling
    if (checkBtn) {
      checkBtn.onclick = async () => {
        const word = placedLetters.join('');
        if (word === targetWord) {
          if (feedbackEl) {
            feedbackEl.textContent = '✨ S-T-A-R! That spells STAR! ✨';
            feedbackEl.className = 'spelling-feedback success';
          }
          if (speechEl) {
            speechEl.innerHTML = `<div class="speech-bubble happy">${data.days['1'].completionText}</div>`;
          }
          await Audio.speak(data.days['1'].completionText, { rate: 0.85 });
          App.onDayComplete(1);
        } else {
          if (feedbackEl) {
            feedbackEl.textContent = `"${word}" — not quite! Try a different order!`;
            feedbackEl.className = 'spelling-feedback error';
          }
          Audio.speak('Not quite! Try a different order.', { rate: 0.9 });
        }
      };
    }

    // Speak instruction
    if (speechEl) {
      speechEl.innerHTML = `<div class="speech-bubble">Great! You found all the cards. Now... can you spell the secret word?</div>`;
    }
    Audio.speak('Great! You found all the cards. Now, can you spell the secret word with your letters?', { rate: 0.85 });
  }

  function stop() {
    isActive = false;
    Audio.cancel();
  }

  return { init, start, stop };
})();
