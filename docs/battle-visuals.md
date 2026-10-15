# Battle visual presentation

The high-angle arena, species scale, battle simulation and original Showmotion motion sheets are preserved.

- Court-only softening uses a cached half-resolution background with mild desaturation, reduced contrast, darkening and blur. Stadium architecture stays crisp.
- Contact shadows expand and fade with altitude. Moving fighters emit dust or frost; dashes leave short translucent trails; flight landings emit ground puffs.
- SpriteCollab Offsets sheets provide head and hand attachment markers, normalized using each species' shared scale. Ranged attacks use those markers when available. Blastoise uses an approximate shoulder-cannon anchor; absent markers use proportional head/hand anchors. These are visual origins; collision and damage remain in world coordinates.
- Projectile launch offsets blend back to the simulation path. Beams start at the visual emitter. Anticipation and recoil supplement character animation, and impact size responds to move power, guard, effectiveness and empowerment.
- All types receive colored accents over the original Showmotion frames. Electric uses branching sparks; Water uses spray and ripples; Fire uses rising embers; Ice uses angular shards. Other types use matching color families and particles or fragments.
- Camera shake is bounded to a few pixels; knockout and empowered moves briefly zoom by at most 3.5%. Sprites, terrain and background share the transform, and cursor aiming uses the inverse transform.
- Spectator-rail pennants sway, sparse crowd flashes appear, and stadium-specific ambient motes drift across the field.
- Presentation pauses with menus and resets on rematch. Reduced-motion mode disables camera movement, dash trails, moving ambience and type accents, while retaining essential action and hit feedback.

The presentation controller has bounded transient particle counts and does not change attack range, hitboxes, damage, cooldowns, or movement speed. The generated stadium images are unchanged.
