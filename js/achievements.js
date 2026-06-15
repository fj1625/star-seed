/**
 * Star Seed - Achievements & Rewards System
 *
 * Handles daily gifts, episode trophies, and long-term achievements.
 * All progress is persisted through Storage.
 *
 * Three reward layers:
 *   - Gifts:    small items Twinkle gives after each day (5 per episode)
 *   - Trophies: big award when an episode is fully completed (1 per episode)
 *   - Achievements: long-term goals that may span multiple episodes
 */
const Achievements = (() => {
  // Default gift templates used when an episode JSON does not define a reward.
  const GIFT_TEMPLATES = {
    1: { id: 'star_shard',    emoji: '⭐', name: 'Star Shard',     voiceName: 'Star Shard' },
    2: { id: 'rainbow_bottle',emoji: '🌈', name: 'Rainbow Bottle', voiceName: 'Rainbow Bottle' },
    3: { id: 'music_crystal', emoji: '🎵', name: 'Music Crystal',  voiceName: 'Music Crystal' },
    4: { id: 'star_sneakers', emoji: '👟', name: 'Star Sneakers',  voiceName: 'Star Sneakers' },
    5: { id: 'heart_gem',     emoji: '❤️', name: 'Heart Gem',      voiceName: 'Heart Gem' }
  };

  // Episode trophy definitions.
  const EPISODE_TROPHIES = {
    ep01: { id: 'trophy_home',    emoji: '🏠', name: 'Home Guardian Trophy' },
    ep02: { id: 'trophy_animals', emoji: '🐾', name: 'Animal Friend Trophy' },
    ep05: { id: 'trophy_nature',  emoji: '🌿', name: 'Nature Explorer Trophy' }
  };

  // Long-term achievement table.
  // check(state) returns true when the achievement should unlock.
  const ACHIEVEMENTS = [
    {
      id: 'first_step',
      emoji: '🚀',
      name: 'First Step',
      desc: 'Complete your first day.',
      check: s => s.completedDays.length >= 1
    },
    {
      id: 'half_way',
      emoji: '🌓',
      name: 'Half Way Hero',
      desc: 'Complete 3 days in one episode.',
      check: s => s.completedDays.length >= 3
    },
    {
      id: 'star_guardian',
      emoji: '⭐',
      name: 'Star Guardian',
      desc: 'Complete all 5 days in an episode.',
      check: s => s.completedDays.length >= 5
    },
    {
      id: 'card_collector',
      emoji: '🃏',
      name: 'Card Collector',
      desc: 'Find all hidden cards in a Light day.',
      check: s => s.day1CardsFound.length >= 4
    },
    {
      id: 'color_master',
      emoji: '🎨',
      name: 'Color Master',
      desc: 'Mix all colors in a Color day.',
      check: s => s.day2ColorsFound.length >= 3
    },
    {
      id: 'animal_whisperer',
      emoji: '🐕',
      name: 'Animal Whisperer',
      desc: 'Match all animal sounds in a Sound day.',
      check: s => s.day3AnimalsMatched.length >= 5
    },
    {
      id: 'super_dancer',
      emoji: '💃',
      name: 'Super Dancer',
      desc: 'Reach the highest round in a Motion day.',
      check: s => s.day4HighestRound >= 4
    },
    {
      id: 'world_traveler',
      emoji: '🌍',
      name: 'World Traveler',
      desc: 'Complete more than one episode.',
      check: s => s.completedEpisodes.length >= 2
    },
    {
      id: 'secret_seeker',
      emoji: '🌿',
      name: 'Secret Seeker',
      desc: 'Unlock the secret outdoor adventure.',
      check: s => s.completedEpisodes.includes('ep05-outdoor')
    }
  ];

  /**
   * Get the reward config for a given day.
   * Priority: episode JSON -> default template.
   */
  function getDayReward(day, episodeData) {
    const dayData = episodeData && episodeData.days ? episodeData.days[String(day)] : null;
    if (dayData && dayData.reward) return dayData.reward;

    const template = GIFT_TEMPLATES[day];
    if (!template) return null;

    const powerName = dayData && dayData.power ? dayData.power : 'Power';
    return {
      id: template.id,
      emoji: template.emoji,
      name: template.name,
      message: `Twinkle gives you a ${template.name}!`,
      voiceText: `You got a ${template.voiceName}! You are a ${powerName} Finder!`
    };
  }

  /**
   * Get the trophy config for an episode.
   */
  function getEpisodeTrophy(episodeId) {
    if (episodeId && EPISODE_TROPHIES[episodeId]) {
      return EPISODE_TROPHIES[episodeId];
    }
    // Fallback for unknown episodes.
    return {
      id: `trophy_${episodeId || 'unknown'}`,
      emoji: '🏆',
      name: 'Star Seed Trophy'
    };
  }

  /**
   * Grant a daily gift to the player if not already owned.
   * Returns the reward object + a flag indicating if it was newly granted.
   */
  function grantDayReward(day, episodeData) {
    const reward = getDayReward(day, episodeData);
    if (!reward) return null;

    const state = Storage.getState();
    const episodeId = (episodeData && episodeData.episodeId) || state.episodeId || 'unknown';
    const alreadyHas = state.rewards.some(r => r.id === reward.id && r.episodeId === episodeId);

    if (!alreadyHas) {
      state.rewards.push({
        id: reward.id,
        emoji: reward.emoji,
        name: reward.name,
        episodeId,
        day,
        unlockedAt: new Date().toISOString(),
        isNew: true
      });
      Storage.save();
    }

    return { ...reward, isNew: !alreadyHas };
  }

  /**
   * Check all achievements and grant any that are newly unlocked.
   * Returns an array of newly unlocked achievement objects.
   */
  function checkAchievements() {
    const state = Storage.getState();
    const unlockedIds = new Set(state.achievements.map(a => a.id));
    const newlyUnlocked = [];

    for (const ach of ACHIEVEMENTS) {
      if (unlockedIds.has(ach.id)) continue;
      if (ach.check(state)) {
        state.achievements.push({
          id: ach.id,
          emoji: ach.emoji,
          name: ach.name,
          desc: ach.desc,
          unlockedAt: new Date().toISOString(),
          isNew: true
        });
        newlyUnlocked.push(ach);
      }
    }

    if (newlyUnlocked.length > 0) Storage.save();
    return newlyUnlocked;
  }

  /**
   * Grant the episode trophy if all 5 days are completed and not already owned.
   * Returns the trophy object + isNew flag.
   */
  function grantEpisodeTrophy(episodeId) {
    const state = Storage.getState();
    const trophy = getEpisodeTrophy(episodeId);
    const alreadyHas = state.trophies.some(t => t.id === trophy.id);

    if (!alreadyHas) {
      state.trophies.push({
        id: trophy.id,
        emoji: trophy.emoji,
        name: trophy.name,
        episodeId,
        unlockedAt: new Date().toISOString(),
        isNew: true
      });
      Storage.save();
    }

    return { ...trophy, isNew: !alreadyHas };
  }

  /**
   * Main entry point called when a day is completed.
   * Returns a result object with: reward, newAchievements, trophy.
   */
  function onDayComplete(day, episodeId, episodeData) {
    const reward = grantDayReward(day, episodeData);
    const newAchievements = checkAchievements();

    let trophy = null;
    const state = Storage.getState();
    if (state.completedDays.length >= 5) {
      trophy = grantEpisodeTrophy(episodeId);
    }

    return { reward, newAchievements, trophy };
  }

  /**
   * Utility: get all reward entries from storage.
   */
  function getRewards() {
    return Storage.getState().rewards || [];
  }

  /**
   * Utility: get all achievement entries from storage.
   */
  function getAchievements() {
    return Storage.getState().achievements || [];
  }

  /**
   * Utility: get all trophy entries from storage.
   */
  function getTrophies() {
    return Storage.getState().trophies || [];
  }

  /**
   * Returns true if there is any unviewed reward/achievement/trophy.
   */
  function hasNewItems() {
    const state = Storage.getState();
    const hasNew = arr => (arr || []).some(item => item.isNew);
    return hasNew(state.rewards) || hasNew(state.achievements) || hasNew(state.trophies);
  }

  /**
   * Mark all items as viewed (clear the isNew flag).
   */
  function markAllSeen() {
    const state = Storage.getState();
    let changed = false;
    ['rewards', 'achievements', 'trophies'].forEach(key => {
      (state[key] || []).forEach(item => {
        if (item.isNew) {
          item.isNew = false;
          changed = true;
        }
      });
    });
    if (changed) Storage.save();
  }

  /**
   * Reset only achievement/reward data while keeping player name.
   * Used internally; public reset goes through Storage.resetAll().
   */
  function resetCollections() {
    const state = Storage.getState();
    state.rewards = [];
    state.achievements = [];
    state.trophies = [];
    Storage.save();
  }

  return {
    onDayComplete,
    grantDayReward,
    checkAchievements,
    grantEpisodeTrophy,
    getDayReward,
    getEpisodeTrophy,
    getRewards,
    getAchievements,
    getTrophies,
    hasNewItems,
    markAllSeen,
    resetCollections,
    ACHIEVEMENTS,
    EPISODE_TROPHIES
  };
})();
