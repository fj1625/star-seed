# The Star Seed — Project CLAUDE.md

## What This Is

A web-based ARG (Alternate Reality Game) for an 8-year-old Chinese child learning English. Blends physical-world interactions (printed cards, real objects, body movement, parent collaboration) with a mobile/tablet web app. Each "week" is 5 days × 5 game mechanics, teaching ~15 English listening words per week.

**Week 1: My Home** — fully implemented. Weeks 2-4 planned but not coded.

## Tech Stack

- Pure HTML/CSS/JS — no frameworks, no build step, no server
- Web Speech API for voice (synthesized English)
- localStorage for progress persistence
- Deploy to GitHub Pages (just open index.html)

## File Structure

```
index.html              ← SPA entry point, 7 scene sections
css/style.css           ← All styles, animations, responsive
js/app.js               ← Scene router, state coordination, init
js/storage.js           ← localStorage wrapper
js/audio.js             ← Web Speech API wrapper
js/twinkle.js           ← Twinkle character state machine
js/engine-light.js      ← Day 1: Hidden object hunt + letter spelling
js/engine-color.js      ← Day 2: Color mixing + real-object matching
js/engine-sound.js      ← Day 3: Sound identification + sequence memory
js/engine-motion.js     ← Day 4: TPR action dance sequence
js/engine-heart.js      ← Day 5: Collaborative puzzle + certificate
data/ep01-home.json     ← Week 1 episode data (vocabulary, clues, codes)
printable/ep01-printable.html ← Parent materials (cards, instructions)
```

## How to Run

1. Open `index.html` in Chrome (mobile viewport recommended: 375×812)
2. Or serve with any static server: `python -m http.server` / `npx serve .`
3. For real use: deploy to GitHub Pages, child accesses via QR code on phone/tablet

## Key Architecture Decisions

- **Data-driven engines**: `engine-*.js` reads all content from `ep01-home.json`. Swap the JSON → new episode. No engine code changes needed for Weeks 2-4.
- **CSS-only visuals**: Twinkle is pure CSS art (no images). All animations via CSS keyframes.
- **Speech-only audio**: All animal "sounds" are synthesized onomatopoeia via Web Speech API with pitch/rate variation. No audio files.
- **localStorage progress**: Survives page refresh. Reset = hold restart button 3 seconds.

## Week 1: My Home — Complete Episode Data

See `data/ep01-home.json` for full vocabulary, clues, codes.

- Day 1 cards: sun(371→S), tree(528→T), apple(416→A), rabbit(693→R)
- Day 2 colors: orange(red+yellow), green(blue+yellow), purple(red+blue)
- Day 3 animals: dog, cat, bird, duck, frog (with onomatopoeia + pitch/rate settings)
- Day 4 actions: 8 TPR verbs, 4 rounds (2→3→4→5 actions)
- Day 5: heart code "999", certificate with player name

---

## Weeks 2-4 Plans (NOT YET IMPLEMENTED)

### Week 2: Animals 🐾
| Day | Mechanic | Theme | Key Vocabulary |
|-----|----------|-------|---------------|
| Mon | Light (cards) | Zoo Animals | lion, monkey, panda, tiger → spell WILD |
| Tue | Color | Animal Colors | black/white(zebra), brown(bear), green(frog), orange(fish) |
| Wed | Sound | Farm Sounds | cow(moo), sheep(baa), horse(neigh), pig(oink), frog(ribbit) |
| Thu | Motion | Animal Moves | hop(rabbit), stomp(elephant), swim(fish), fly(bird), crawl(crab) |
| Fri | Heart | Animal Rescue | Help baby animal find mommy (parent + story) |

**New data needed**: `data/episodes/ep02-animals.json` + `printable/ep02-printable.html`

### Week 3: Body & Food 🍎
| Day | Mechanic | Theme | Key Vocabulary |
|-----|----------|-------|---------------|
| Mon | Light (cards) | Fruits | apple, banana, orange, grape → spell FOOD |
| Tue | Color | Food Colors | carrot(orange), cucumber(green), tomato(red), egg(white+yellow) |
| Wed | Sound | Kitchen Sounds | water, sizzle, crunch, pour, mix (needs real audio files) |
| Thu | Motion | Body Parts Dance | head, hands, knees, toes, arms (TPR sequence) |
| Fri | Heart | Kitchen Fun | Make a simple snack together (yogurt + fruit), English counting |

**New data needed**: `data/episodes/ep03-body-food.json` + `printable/ep03-printable.html`

### Week 4: Outdoor & Nature 🌿
| Day | Mechanic | Theme | Key Vocabulary |
|-----|----------|-------|---------------|
| Mon | Light (cards) | Nature Finds | leaf, stone, flower, stick → spell GROW (outdoor hunt) |
| Tue | Color | Sky & Weather | blue(sky), gray(cloud), gold(sun), white(snow), rainbow |
| Wed | Sound | Weather Sounds | rain(pitter-patter), wind(whoosh), thunder(boom) |
| Thu | Motion | Weather Dance | float(cloud), spin(wind), fall(rain), freeze(snow), bloom(flower) |
| Fri | Heart | Graduation | 4-week review, Twinkle full star animation, 4 plants photo |

**New data needed**: `data/episodes/ep04-nature.json` + `printable/ep04-printable.html`

### Vocabulary Spiral Design

```
Week 1 → Week 2: dog/cat/bird reappear + farm animals added
Week 1 → Week 2: red/blue/yellow → purple/green/orange
Week 2 → Week 3: animal body parts → human body parts
Week 1-2 → Week 4: sun reappears from Week 1, weather sounds build on Week 3
```

### How to Add a New Episode

1. Create `data/episodes/epXX-name.json` following `ep01-home.json` schema
2. Create `printable/epXX-printable.html` for parent materials
3. Update `Storage.defaultState().episodeId` for multiple episode support
4. Update `index.html` intro scene to show episode selector
5. Each episode reuses the same 5 engines — only data changes

---

## Remaining TODOs (for future)

- [ ] Multiple episode support (episode selector in intro)
- [ ] Week 2-4 data files + printables
- [ ] Sound effects for Week 3 kitchen sounds (real audio, not synthesized)
- [ ] Offline/PWA support (service worker)
- [ ] QR code generation for card codes (instead of manual entry)
- [ ] Parent dashboard to see child's progress / vocabulary learned
- [ ] Voice recording for child to say words back (optional speech practice)
