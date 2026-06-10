/**
 * Star Seed - Storage Manager
 * localStorage wrapper for game progress persistence
 */
const Storage = (() => {
  const KEY = 'starSeed_progress';

  const defaultState = () => ({
    currentDay: 1,
    completedDays: [],
    completedEpisodes: [],
    twinklePowers: [],
    day1CardsFound: [],
    day1Letters: [],
    day2ColorsFound: [],
    day2ItemsFound: [],
    day3AnimalsMatched: [],
    day4HighestRound: 0,
    day5GoodbyeMessage: null,
    day1WordsSpoken: [],
    day3SoundsImitated: [],
    day4MovesNamed: [],
    playerName: '',
    episodeId: 'ep01',
    lastPlayed: null
  });

  let state = defaultState();

  /** Load state from localStorage, merge with defaults */
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        state = { ...defaultState(), ...saved };
      } else {
        state = defaultState();
      }
    } catch (e) {
      console.warn('Storage load failed, using defaults', e);
      state = defaultState();
    }
    return state;
  }

  /** Persist current state */
  function save() {
    state.lastPlayed = new Date().toISOString();
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('Storage save failed', e);
    }
  }

  /** Get full state */
  function getState() { return state; }

  /** Complete a day — returns true if it was newly completed */
  function completeDay(day) {
    if (!state.completedDays.includes(day)) {
      state.completedDays.push(day);
      state.currentDay = Math.min(day + 1, 5);
      save();
      return true;
    }
    save();
    return false;
  }

  /** Add a collected Twinkle power */
  function addPower(power) {
    if (!state.twinklePowers.includes(power)) {
      state.twinklePowers.push(power);
      save();
    }
  }

  /** Day 1: record found card */
  function addDay1Card(cardId, letter) {
    if (!state.day1CardsFound.includes(cardId)) {
      state.day1CardsFound.push(cardId);
      state.day1Letters.push(letter);
      save();
    }
  }

  /** Day 2: record found color */
  function addDay2Color(colorId) {
    if (!state.day2ColorsFound.includes(colorId)) {
      state.day2ColorsFound.push(colorId);
      save();
    }
  }

  /** Day 3: record matched animal */
  function addDay3Animal(animalId) {
    if (!state.day3AnimalsMatched.includes(animalId)) {
      state.day3AnimalsMatched.push(animalId);
      save();
    }
  }

  /** Day 4: record highest round */
  function setDay4Round(round) {
    if (round > state.day4HighestRound) {
      state.day4HighestRound = round;
      save();
    }
  }

  /** Set player name for certificate */
  function setPlayerName(name) {
    state.playerName = name;
    save();
  }

  /** Reset all progress (hold-to-reset) */
  function resetAll() {
    state = defaultState();
    try {
      localStorage.removeItem(KEY);
    } catch (e) { /* ignore */ }
  }

  /** Reset day-specific progress when switching episodes */
  function resetEpisodeProgress() {
    state.currentDay = 1;
    state.completedDays = [];
    state.twinklePowers = [];
    state.day1CardsFound = [];
    state.day1Letters = [];
    state.day2ColorsFound = [];
    state.day2ItemsFound = [];
    state.day3AnimalsMatched = [];
    state.day4HighestRound = 0;
    state.day5GoodbyeMessage = null;
    state.day1WordsSpoken = [];
    state.day3SoundsImitated = [];
    state.day4MovesNamed = [];
    save();
  }

  /** Mark an episode as completed */
  function markEpisodeComplete(episodeId) {
    if (!state.completedEpisodes.includes(episodeId)) {
      state.completedEpisodes.push(episodeId);
      save();
    }
  }

  /** Check if a specific day is unlocked */
  function isDayUnlocked(day) {
    if (day === 1) return true;
    return state.completedDays.includes(day - 1);
  }

  /** Check if a specific day is completed */
  function isDayCompleted(day) {
    return state.completedDays.includes(day);
  }

  return {
    load, save, getState,
    completeDay, addPower,
    addDay1Card, addDay2Color, addDay3Animal, setDay4Round,
    setPlayerName,
    resetAll, resetEpisodeProgress, markEpisodeComplete,
    isDayUnlocked, isDayCompleted
  };
})();
