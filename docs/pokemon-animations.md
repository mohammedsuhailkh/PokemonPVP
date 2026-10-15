# Pokémon character animations

The game now uses SpriteCollab directional sprite sheets for character animation, alongside the existing Showmotion move effects.

## Coverage

27 species used by the preset rivalries and quick picks are bundled in `public/pokemon-motion/`. All have Idle, Walk, Attack, Charge, Hurt, and Hop entries. 26 have Shoot; a missing ranged pose uses Attack. Only 5 have a dedicated Cringe entry and 6 have Faint: guard uses Cringe or Idle with a defensive crouch; faint uses Faint, Sleep, Hurt, or Idle with a fade and collapse. These are deliberate fallbacks, not claims of dedicated art for every action.

Any other selected species loads the same animation metadata and sheets on demand from the pinned SpriteCollab revision. Pokémon with missing/unavailable assets retain the original PokéAPI sprite, with procedural walk bob, wind-up, attack lean, hurt recoil, guard crouch, dodge hop, send-out growth, recall shrink, and faint fade. Base-species sheets are used for alternate forms when PokéAPI supplies a species ID; form-specific art is not currently mapped.

## Behavior

- Eight-direction walking and facing; stationary fighters face their opponent, and attacks face their actual aim point.
- Retreating away from the opponent keeps facing the opponent and reverses the walking cycle for backpedaling. Forward and sideways movement retain directional walking. This applies to both teams without changing movement speed or controls; fallback sprites retain opponent-facing horizontal orientation while retreating.
- Charging, attack release, recovery, hurt, guard/shield, dodge, send-out, recall, and faint states.
- Visual animation follows combat state without changing hitboxes, resource use, or attack timings.
- Frame durations and animation aliases are read from `AnimData.xml`.
- One species scale and center origin are shared across sheets; larger action frames do not resize the character.
- Send-out takes 1.7 seconds: a visible Poké Ball arcs from the trainer side, lands with a bounce, opens, and releases the Pokémon in a light beam. The cry plays at release. Reduced motion removes spin and the large throw arc.
- Recall takes 1.25 seconds: defeated Pokémon briefly slump, turn into red light, shrink into the ball, and the ball closes. Manual switches use the same recall without the defeated pose. The next throw starts after recall finishes.
- Both fighters' combat simulation and command inputs pause during entry/recall. Presentation uses a separate clock, freezes in menus, and clears on rematch. The final result appears after the last recall, including when menus interrupt the sequence.
- Menus freeze the animation clock; rematches clear temporary actors; reduced-motion preferences remove procedural bob/tilt and freeze idle/walk frames.
- Remote metadata and image loads time out and fall back without preventing battle startup. Failed species loads are cached for the page session; reload to retry.

## Sources and credits

Source: https://github.com/PMDCollab/SpriteCollab

Pinned revision: `e7868e9a7f6b931d1fb826756a490d4633879d03`

Original license, contributor names, and per-species credit records ship with the assets. The Help panel links to `/pokemon-motion/credits.html`, which includes the bundled records and links for additional species loaded during the session. The collection includes official Chunsoft assets and community contributions; preserve the supplied terms and noncommercial/attribution requirements.

Reimport bundled sheets with `python scripts/import-pokemon-sprites.py`.
