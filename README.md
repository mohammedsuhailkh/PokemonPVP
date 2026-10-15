# PokéAnime stadium simulator

React 18 and Vite host a custom Canvas 2.5D battle simulation. React owns menus;
`GameEngine` owns match state, controls, the fixed 120 Hz update loop, and HUD updates.
`CombatSystem.js` owns attacks, defense, terrain, and tactical AI. `BattleRules.js`
contains pure geometry, move profiles, and fighter traits.

## Run and verify

```sh
npm install
npm run dev
npm test
npm run test:browser
npm run build
```

Browser checks use installed Google Chrome. On a machine without Chrome, install it
or change the Playwright configuration to an installed browser. Browser screenshots
and failure traces are written to `test-results/`. Most checks mock PokéAPI responses
to isolate gameplay; a separate live check requires PokéAPI and sprite availability.

## Play

Choose three fighters and an arena, or select **Pikachu vs Blastoise · Training Duel**
for a one-on-one grass-arena match with three moves each.

| Action | Control |
| --- | --- |
| Move | WASD, arrows, or joystick |
| Moves | 1–4 or J/K/L/U |
| Dodge | Space or Shift |
| Counter-shield | E or I |
| Hold guard | Q, right-click, or guard button |
| Ascend with flying types | Hold H or FLY; release to land |
| Switch fighter | Z/X/C or Tab |
| Toggle aiming | F |
| Bond Overdrive | R at 100% bond |

All menus pause combat and clear held inputs. Reset and rematch restore the same
selected teams. Loading a new match is atomic: a failed load preserves the old
battle, and older requests cannot overwrite newer ones.

## Combat rules

- Moves charge, spend stamina and PP, then enter recovery. Warning lines/rings show
  direction or range. Contact, altitude, cover, immunity, and accuracy determine hits.
- Melee rushes travel a limited distance and must touch their target. Beam and wave
  attacks hit each target at most once. Barrage shots share a damage budget.
- Dodges grant 260 ms of invulnerability, including a 90 ms perfect-dodge window.
  One dodge grants bond once. Guard drains stamina and reduces damage by 65%;
  exhausting it creates a recovery opening. Counter-shield intercepts attacks
  throughout its 700 ms duration, but powerful attacks can break it.
- Opposing projectiles cancel or weaken each other. Opposing beams in a common
  corridor enter a short stamina contest. Holding guard boosts pressure; moving
  away disengages. Pillars block attacks and movement and can be destroyed.
- Water conducts electric attacks, ice freezes water, and fire melts ice into water
  and steam. Water cools burning ground. Hazard damage affects both teams, with
  appropriate type resistance. Steam disrupts tracking; ice changes traction.
- Pokémon weight, height, speed, and flying type affect acceleration, steering,
  melee reach, knockback resistance, and flight. Flight spends stamina and clears
  ground hazards; airborne fighters can still be targeted by ranged attacks.
- Hits, timed defense, interrupted charges, punished recovery, clashes, terrain
  combinations, and cover destruction earn bond. Casting alone does not. Overdrive
  lasts 12 seconds and enhances the next attack's geometry as a signature burst.
- Burn, poison, paralysis, and freeze have temporary combat effects. When every
  move is out of PP, a contact-based Struggle attack remains available with recoil.
- AI uses the same charge, PP, defense, and collision rules. It chooses moves by
  range and effectiveness, evades threats, uses cover to recover, escapes dangerous
  ground, and exploits conductive water.

The rules are anime-inspired game design, with explicit values for balancing;
they are not a claim that the anime has a single formal combat ruleset.

## Assets and data

The approved arena images live in `public/grounds/high-angle`. See
`docs/stadium-art-prompts.md` for the images, reference and generation prompts.
PokéAPI provides live Pokémon metadata,
weight/height, sprites and cries. Curated move data and signature sets live in
`constants.js`. Local species fallback data covers the default teams and training
duel; other species require PokéAPI. Failed lookups report an error instead of
silently turning an unknown Pokémon into an Electric-type fallback.

Styling currently uses the existing Tailwind CDN, Google Fonts, and Font Awesome
links. Sprites, cries, fonts, icons, and CDN styling still require a connection.
The original standalone HTML file is retained as an older reference; changes are
implemented in the React application under `src/`.

## Showmotion moves

All moves use actual motion frames rendered from
[shogun-drei/Showmotion](https://github.com/shogun-drei/Showmotion), pinned to
revision `76aaa0b2ae4f3fbe49a4024ae2b6521038cf6d50`. Native matches use their
original effect colors. Other moves select a native effect by type and attack
archetype, then adjust hue, saturation, scale, rotation, and timing. There is no
generic orb/line fallback for unmapped moves.

`ShowmotionAnimations.js` maps every move and draws the local WebP animation
sheets on a separate effects canvas. Charging, traveling attacks, melee rushes,
area attacks, and successful impacts use the same source motions. Collision and
damage remain in the real-time simulation, so a visual effect never forces a hit.
Animations pause with menus and clear on rematch. Playing them requires Canvas
2D; WebGPU and a browser extension are not required.

The original effects/runtime and source notice are in `public/showmotion/`.
To regenerate the sheets, start Vite on port 4173 and run `npm run bake:showmotion`.
This offline baking step uses Google Chrome with WebGPU. The bake samples actual
`.efkwgd` effects with the upstream camera and packs cropped, transparent frames.
`public/showmotion/NOTICE.md` records source attribution and modifications.

Move cards keep their DOM nodes during HUD refreshes, so pressing and releasing
a button cannot lose its click. A short input buffer accepts attacks near the
end of recovery/dodging. The feedback line explains charging, cooldown, stamina,
range, immunity, cover, and hit results instead of silently ignoring a command.

## High-angle arena presentation

The battlefield fills the game viewport, with compact corner health displays,
a centered clock, a gold/navy move tray and collapsible commentary. Four generated
stadium themes share one composition and runtime Pokémon battle markings.

`ArenaProjection.js` maps simulation coordinates onto a shallow trapezoid and
provides its exact inverse for cursor aiming. Pokémon retain upright 2D animated
sprites; species height controls their drawn size independently of projection.
Visible sprite bounds are measured to remove padding differences between sources.
Flight raises the sprite above its grounded shadow. Rocks and fighters share a
depth-sorted DOM layer for correct occlusion when moving behind cover.

The simulation still owns range, collision, cooldowns and terrain reactions.
Portrait mode reserves lower space for touch controls and two rows of move cards.
Wide screens use the approved panoramic composition.

## Pokémon character animations

Directional SpriteCollab sheets now drive walking, idle, anticipation, attacks,
recovery, hurt, defense, dodge, faint, recall and send-out states. The 27 preset
and quick-pick species are bundled; additional species load on demand. Missing
poses use available sheets and procedural motion, with the original battle sprite
as a fallback. See [animation coverage and credits](docs/pokemon-animations.md).

The [battle visual pass](docs/battle-visuals.md) adds court contrast, altitude-aware
shadows, movement effects, source attachment markers, type accents, small camera
responses and stadium ambience, including reduced-motion behavior.
