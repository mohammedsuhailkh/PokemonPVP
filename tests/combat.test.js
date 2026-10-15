import test from 'node:test';
import assert from 'node:assert/strict';
import { GameEngine } from '../src/game/GameEngine.js';
import { PokeApiService } from '../src/game/PokeApiService.js';
import { SoundEngine } from '../src/game/SoundEngine.js';
import { segmentDistance, moveProfile, fighterTraits } from '../src/game/BattleRules.js';
import { animationForMove } from '../src/game/ShowmotionAnimations.js';
import { FALLBACK_MOVES, SIGNATURE_MOVESETS, classifyMoveSpatialArchetype, TYPE_COLORS } from '../src/game/constants.js';
import { existsSync, readFileSync } from 'node:fs';
import { projectGround, unprojectGround, fighterSpriteSize } from '../src/game/ArenaProjection.js';
import { directionRow, frameAt, animationState, walkingFacing } from '../src/game/PokemonAnimator.js';
import { impactSize, shadowShape, muzzleKind, BattlePresentation } from '../src/game/BattlePresentation.js';

test('visual impact strength and airborne shadows remain bounded and readable', () => {
    assert.ok(impactSize({ power: 120 }) > impactSize({ power: 20 }));
    assert.ok(impactSize({ power: 100 }, true) < impactSize({ power: 100 }));
    assert.ok(impactSize({ power: 100 }, false, 2) > impactSize({ power: 100 }));
    assert.ok(impactSize({ power: 999999, empowered: true }, false, 4) < 130);
    const grounded = shadowShape(60, 0), airborne = shadowShape(60, 120);
    assert.ok(airborne.width > grounded.width); assert.ok(airborne.opacity < grounded.opacity);
    assert.equal(muzzleKind({ id: 9 }, { type: 'water', slug: 'hydro-pump' }), 'cannon');
    assert.equal(muzzleKind({ id: 448 }, { type: 'fighting', slug: 'aura-sphere' }), 'hand');
    assert.equal(muzzleKind({ id: 6 }, { type: 'fire', slug: 'flamethrower' }), 'head');
});

test('cursor projection inverts camera zoom and shake, and reduced motion resets camera', () => {
    const game = { width: 1440, height: 810, WORLD_HALF_W: 470, WORLD_HALF_H: 255, camera: { x: 2.3, y: -1.4, zoom: 1.035 } };
    for (const [x, y] of [[0, 0], [-420, -220], [330, 175]]) {
        const p = GameEngine.worldToScreen.call(game, x, y);
        const inverse = GameEngine.screenToWorld.call(game, p.x, p.y);
        assert.ok(Math.hypot(x - inverse.x, y - inverse.y) < 1e-8);
    }
    const presentation = new BattlePresentation(); presentation.pulse();
    presentation.update(0.1, { ...game, reducedMotion: true });
    assert.equal(game.camera.zoom, 1); assert.equal(game.camera.x, 0); assert.equal(game.camera.y, 0);
});

test('retreat faces the opponent in all eight directions while forward movement faces travel', () => {
    for (const [x, y] of [[0, 1], [1, 1], [1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1]]) {
        const target = { x: x * 100, y: y * 100 };
        const retreat = walkingFacing({ x: 0, y: 0, vx: -x * 50, vy: -y * 50 }, target);
        assert.equal(retreat.backpedaling, true);
        assert.equal(retreat.direction, directionRow(x, y));
        const forward = walkingFacing({ x: 0, y: 0, vx: x * 50, vy: y * 50 }, target);
        assert.equal(forward.backpedaling, false);
        assert.equal(forward.direction, directionRow(x, y));
    }
    assert.equal(walkingFacing({ x: 0, y: 0, vx: 0, vy: 50 }, { x: 100, y: 0 }).backpedaling, false);
    assert.equal(frameAt([6, 12, 6], 0.05, true, true), 2);
    assert.equal(frameAt([6, 12, 6], 0.05), 0);
});

test('directional animation covers eight directions and preserves stationary facing', () => {
    const vectors = [[0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1], [1, 0], [1, 1]];
    assert.deepEqual(vectors.map(([x, y]) => directionRow(x, y)), [0, 7, 6, 5, 4, 3, 2, 1]);
    assert.equal(directionRow(0, 0, 5), 5);
});

test('animation frame timing loops locomotion and clamps one-shot poses', () => {
    assert.equal(frameAt([6, 12, 6], 0.15), 1);
    assert.equal(frameAt([6, 12, 6], 0.45), 0);
    assert.equal(frameAt([6, 12, 6], 3, false), 2);
});

test('combat animation priority distinguishes hit, defense, anticipation and recovery', () => {
    assert.equal(animationState({ vx: 20, vy: 0 }), 'walk');
    assert.equal(animationState({ vx: 0, vy: 0 }), 'idle');
    assert.equal(animationState({ action: {}, vx: 20 }), 'charge');
    assert.equal(animationState({ guarding: true, action: {} }), 'guard');
    assert.equal(animationState({ dashTimer: 0.2, guarding: true }), 'dodge');
    assert.equal(animationState({ hitFlashTimer: 0.1, action: {} }), 'hurt');
    assert.equal(animationState({ fainted: true, hitFlashTimer: 0.1 }), 'faint');
    assert.equal(animationState({ recoveryTimer: 0.2 }), 'recovery');
    assert.equal(animationState({}, { state: 'shoot' }), 'shoot');
});

SoundEngine.enabled = false;
const elements = new Map();
globalThis.document = { getElementById(id) {
    if (!elements.has(id)) elements.set(id, { style: {}, classList: { add() {}, remove() {} }, replaceChildren() {} });
    return elements.get(id);
} };
const move = (slug = 'test-shot', type = 'normal', archetype = 'PROJECTILE', power = 70) => ({
    slug, name: slug, type, archetype, power, accuracy: 100, damageClass: 'special',
    pp: 15, maxPp: 15, cooldown: 0, cooldownMax: 2, multiShot: 1
});
function fighter(name = 'A', types = ['normal'], moves = [move()]) {
    return PokeApiService.buildCombatant({ id: 1, name, types, baseStats: {}, weight: 600, height: 10, moves });
}
function engine() {
    const g = Object.defineProperties({}, Object.getOwnPropertyDescriptors(GameEngine));
    Object.assign(g, { playerParty: [fighter()], enemyParty: [fighter('B')],
        playerActiveIdx: 0, enemyActiveIdx: 0, paused: false, loading: false, matchOver: false,
        projectiles: [], beams: [], aoeWaves: [], hazards: [], pillars: [], particles: [], floatingTexts: [],
        keys: {}, joyVec: { active: false }, camera: { zoom: 1 }, bondSync: 0, overdriveTimer: 0,
        ai: { moveX: 0, moveY: 0, thinkTimer: 0, attackCooldown: 1.2, strafeDir: 1 },
        updateHud() {}, updateActors() {}, renderMovesDeck() {}, renderPartySwitchBar() {},
        spawnFloatingText() {}, spawnExplosion() {}, triggerAnimeCallout() {}, logAnnouncer() {},
        setKeyVisual() {}, endMatch(won) { this.matchOver = true; this.won = won; }
    });
    g.player.x = -150; g.player.y = 0; g.enemy.x = 150; g.enemy.y = 0;
    return g;
}

test('cached combatants do not share PP, cooldowns or type arrays', () => {
    const raw = { id: 25, name: 'PIKACHU', types: ['electric'], baseStats: {}, moves: [move()] };
    const a = PokeApiService.buildCombatant(raw), b = PokeApiService.buildCombatant(raw);
    a.moves[0].cooldown = 2; a.moves[0].pp = 0; a.types.push('water');
    assert.equal(b.moves[0].cooldown, 0); assert.equal(b.moves[0].pp, 15);
    assert.deepEqual(b.types, ['electric']);
});

test('type immunity does zero damage and creates no hazard', () => {
    const g = engine(); g.enemy.types = ['ground'];
    const hp = g.enemy.currentHp;
    assert.equal(g.resolveHit(g.player, g.enemy, move('thunderbolt', 'electric', 'BEAM')), false);
    assert.equal(g.enemy.currentHp, hp); assert.equal(g.hazards.length, 0);
});

test('zero accuracy always misses', () => {
    const g = engine(), hp = g.enemy.currentHp;
    g.resolveHit(g.player, g.enemy, { ...move(), accuracy: 0 });
    assert.equal(g.enemy.currentHp, hp);
});

test('charging spends PP and stamina but casting alone awards no bond', () => {
    const g = engine(); const m = g.player.moves[0];
    assert.equal(g.beginAttack(g.player, 0, 150, 0, false), true);
    assert.equal(m.pp, 14); assert.equal(g.projectiles.length, 0); assert.equal(g.bondSync, 0);
    assert.equal(g.beginAttack(g.player, 0, 150, 0, false), false);
    for (let i = 0; i < 30; i++) g.advanceFighter(g.player, 1 / 120, false);
    assert.equal(g.projectiles.length, 1); assert.ok(g.player.recoveryTimer > 0);
});

test('paused, loading and defeated matches reject defensive commands and attacks', () => {
    for (const flag of ['paused', 'loading', 'matchOver']) {
        const g = engine(); g[flag] = true;
        g.triggerCounterShield(); g.triggerDodgeDash(); g.setGuard(true); g.useMove(0);
        assert.equal(g.player.stamina, 100); assert.equal(g.player.guarding, false);
        assert.equal(g.player.action, null);
    }
});

test('out-of-range blitz cannot damage a stationary distant target', () => {
    const g = engine(); const hp = g.enemy.currentHp;
    g.executeBlitz(g.player, g.enemy.x, g.enemy.y, move('iron-tail', 'steel', 'BLITZ'), false);
    for (let i = 0; i < 40; i++) g.advanceFighter(g.player, 1 / 120, false);
    assert.equal(g.enemy.currentHp, hp); assert.ok(g.player.x < g.enemy.x - 100);
});

test('moving away from a melee rush avoids contact', () => {
    const g = engine(); g.enemy.x = 0;
    g.executeBlitz(g.player, 0, 0, move('quick-attack', 'normal', 'BLITZ'), false);
    g.enemy.y = 130;
    const hp = g.enemy.currentHp;
    for (let i = 0; i < 40; i++) g.advanceFighter(g.player, 1 / 120, false);
    assert.equal(g.enemy.currentHp, hp);
});

test('beams and expanding waves damage each target once at different step sizes', () => {
    for (const dt of [1 / 30, 1 / 60, 1 / 120]) {
        const g = engine(); let hits = 0;
        g.resolveHit = () => { hits++; return true; };
        g.spawnBeam(-150, 0, 150, 0, move('test-beam', 'normal', 'BEAM'), false);
        for (let i = 0; i < Math.ceil(0.4 / dt); i++) g.updateBeams(dt);
        assert.equal(hits, 1);
        g.enemy.x = -50; hits = 0;
        g.spawnAoeWave(-150, 0, move('test-wave', 'normal', 'AOE'), false);
        for (let i = 0; i < Math.ceil(1 / dt); i++) g.updateWaves(dt);
        assert.equal(hits, 1);
    }
});

test('perfect dodge reward happens once per dash and only within its short window', () => {
    const g = engine(); g.triggerDodgeDash();
    g.dodgeAttack(g.player); g.dodgeAttack(g.player);
    assert.equal(g.bondSync, 22);
    const late = engine(); late.triggerDodgeDash(); late.player.perfectDodgeWindow = 0;
    late.dodgeAttack(late.player); assert.equal(late.bondSync, 5);
});

test('counter shield intercepts later projectiles and powerful moves can break it', () => {
    const g = engine(); g.triggerCounterShield();
    g.spawnProjectile(g.player.x + 75, 0, g.player.x, 0, move(), true);
    g.updateProjectiles(1 / 120);
    assert.equal(g.projectiles.length, 0); assert.equal(g.bondSync, 12);
    const attack = g.attackEntity(0, 0, 0, 0, move('heavy', 'normal', 'BEAM', 150), true);
    assert.equal(g.shieldAttack(g.player, attack), false);
    assert.equal(g.player.counterShieldTimer, 0);
});

test('guard stamina drain and incoming impact cause a guard break', () => {
    const g = engine(); g.player.stamina = 1; g.setGuard(true);
    g.resolveHit(g.enemy, g.player, move());
    assert.ok(g.player.guardBreakTimer > 0); assert.equal(g.player.guarding, false);
    const hold = engine(); hold.player.stamina = 1; hold.setGuard(true);
    hold.advanceFighter(hold.player, 0.1, false);
    assert.ok(hold.player.guardBreakTimer > 0);
});

test('terrain transforms into conductive water, ice, and melting steam for either team', () => {
    const g = engine(); const water = g.addTerrain('puddle', 0, 0);
    g.reactTerrain(move('electric', 'electric'), 0, 0, g.player);
    assert.equal(water.type, 'electrified_puddle');
    g.hazards = []; const frozen = g.addTerrain('puddle', 0, 0);
    g.reactTerrain(move('ice', 'ice'), 0, 0, g.enemy); assert.equal(frozen.type, 'ice');
    g.reactTerrain(move('fire', 'fire'), 0, 0, g.player);
    assert.equal(frozen.type, 'puddle'); assert.ok(g.hazards.some(h => h.type === 'steam'));
});

test('conductive hazard harms both teams but respects ground immunity and altitude', () => {
    const g = engine(); g.player.x = 0; g.enemy.x = 10;
    g.addTerrain('electrified_puddle', 0, 0);
    const hp = g.player.currentHp; g.updateTerrain(0.5);
    assert.equal(g.player.currentHp, hp - 5); assert.equal(g.enemy.currentHp, hp - 5);
    g.player.types = ['ground']; g.enemy.z = 80; g.updateTerrain(0.5);
    assert.equal(g.player.currentHp, hp - 5); assert.equal(g.enemy.currentHp, hp - 5);
});

test('rock cover blocks beams and heavy melee can destroy it', () => {
    const g = engine(); let hits = 0; g.resolveHit = () => { hits++; };
    const pillar = { x: 0, y: 0, radius: 30, hp: 140, height: 65 };
    g.pillars = [pillar];
    g.spawnBeam(-150, 0, 150, 0, move('beam', 'normal', 'BEAM', 20), false);
    g.updateBeams(0.01); assert.equal(hits, 0); assert.equal(pillar.hp, 120);
    g.updateBeams(0.01); assert.equal(pillar.hp, 120);
    const attack = g.attackEntity(-50, 0, 0, 0, move('iron-tail', 'steel', 'BLITZ', 100), false);
    g.damagePillar(pillar, attack); assert.ok(pillar.hp <= 0);
});

test('projectiles clash and opposing beams enter a stamina contest before damage', () => {
    const g = engine();
    g.spawnProjectile(-5, 0, 100, 0, move(), false);
    g.spawnProjectile(5, 0, -100, 0, move(), true);
    g.updateProjectiles(1 / 120); assert.equal(g.projectiles.length, 0);
    g.spawnBeam(-150, 0, 150, 0, move('beam', 'normal', 'BEAM'), false);
    g.spawnBeam(150, 0, -150, 0, move('beam', 'normal', 'BEAM'), true);
    const hp = g.player.currentHp; g.updateBeams(0.1);
    assert.ok(g.beams[0].clash); assert.equal(g.player.currentHp, hp);
    assert.ok(g.player.stamina < 100);
    g.player.y = 100; g.updateBeams(0.1); assert.equal(g.beams.length, 0);
});

test('flying fighters ascend and land; heavy fighters have lower steering and acceleration', () => {
    const g = engine(); g.player.traits.airborne = true; g.keys.h = true;
    for (let i = 0; i < 120; i++) g.advanceFighter(g.player, 1 / 120, false);
    assert.equal(g.player.z, 85); assert.ok(g.player.stamina < 100);
    g.keys.h = false;
    for (let i = 0; i < 120; i++) g.advanceFighter(g.player, 1 / 120, false);
    assert.equal(g.player.z, 0);
    const light = fighterTraits({ types: [], weight: 60 }), heavy = fighterTraits({ types: [], weight: 4600 });
    assert.ok(light.acceleration > heavy.acceleration); assert.ok(light.turnRate > heavy.turnRate);
});

test('overdrive empowers one move geometry without skipping charge', () => {
    const g = engine(); g.bondSync = 100; g.activateOverdrive();
    g.useMove(0); assert.ok(g.player.action.move.empowered);
    assert.equal(g.signatureReady, false); assert.equal(g.projectiles.length, 0);
    assert.ok(g.player.action.move.profile.range > moveProfile(g.player.moves[0]).range);
});

test('status ailment applies and expires, with burn damage tick', () => {
    const g = engine(); const attack = { ...move('burn', 'fire'), ailment: 'BRN', ailmentChance: 100 };
    g.resolveHit(g.player, g.enemy, attack); assert.equal(g.enemy.status, 'BRN');
    const hp = g.enemy.currentHp;
    for (let i = 0; i < 121; i++) g.advanceFighter(g.enemy, 1 / 120, true);
    assert.equal(g.enemy.currentHp, hp - 3);
    g.enemy.statusTimer = 0.01; g.advanceFighter(g.enemy, 0.02, true); assert.equal(g.enemy.status, null);
});

test('latest async match request wins and rematch preserves custom teams', async () => {
    const g = engine(); const original = PokeApiService.fetchPokemon;
    const deferred = [];
    PokeApiService.fetchPokemon = entry => new Promise(resolve => deferred.push({ entry, resolve }));
    const config = name => ({ playerTrainer: name, enemyTrainer: 'RIVAL', playerTeam: [{ name }], enemyTeam: [{ name: 'B' }] });
    try {
        const old = g.initMatch('custom', config('OLD'));
        const latest = g.initMatch('custom', config('NEW'));
        deferred[2].resolve(fighter('NEW')); deferred[3].resolve(fighter('B'));
        assert.equal(await latest, true);
        deferred[0].resolve(fighter('OLD')); deferred[1].resolve(fighter('B'));
        assert.equal(await old, false); assert.equal(g.player.name, 'NEW');
        PokeApiService.fetchPokemon = async entry => fighter(entry.name);
        await g.rematch(); assert.equal(g.player.name, 'NEW'); assert.equal(g.loading, false);
    } finally { PokeApiService.fetchPokemon = original; }
});

test('failed loading leaves the previous match usable and clears loading', async () => {
    const g = engine(); const old = g.player; const original = PokeApiService.fetchPokemon;
    PokeApiService.fetchPokemon = async () => { throw new Error('offline'); };
    try { assert.equal(await g.initMatch(), false); assert.equal(g.player, old); assert.equal(g.loading, false); }
    finally { PokeApiService.fetchPokemon = original; }
});

test('geometry detects swept contact and clamps rays to their actual range', () => {
    assert.equal(segmentDistance(0, 0, -100, 0, 100, 0), 0);
    assert.equal(segmentDistance(200, 0, -100, 0, 100, 0), 100);
});

test('exhausted fighters can use Struggle against an immune type with recoil', () => {
    const g = engine(); g.player.moves.forEach(m => { m.pp = 0; }); g.enemy.types = ['ghost'];
    assert.equal(g.beginAttack(g.player, -1, g.enemy.x, g.enemy.y, false), true);
    const hp = g.player.currentHp, enemyHp = g.enemy.currentHp;
    assert.equal(g.resolveHit(g.player, g.enemy, { ...g.struggleMove(g.player), accuracy: 100 }), true);
    assert.ok(g.enemy.currentHp < enemyHp); assert.ok(g.player.currentHp < hp);
});

test('enemy uses the same charged melee and PP rules', () => {
    const g = engine(); g.enemy.moves = [move('iron-tail', 'steel', 'BLITZ')];
    g.player.x = 100; g.ai.attackCooldown = 0;
    g.updateAi(1 / 120);
    assert.equal(g.enemy.action.move.archetype, 'BLITZ'); assert.equal(g.enemy.moves[0].pp, 14);
    for (let i = 0; i < 25; i++) g.advanceFighter(g.enemy, 1 / 120, true);
    assert.ok(g.enemy.blitzState); assert.equal(g.projectiles.length, 0);
});

test('an extended battle remains finite through switches, hazards and AI defense', () => {
    const g = engine();
    g.playerParty.push(fighter('BENCH')); g.enemyParty.push(fighter('RIVAL BENCH'));
    g.player.moves = [move('thunderbolt', 'electric', 'BEAM'), move('quick-attack', 'normal', 'BLITZ')];
    g.enemy.moves = [move('hydro-pump', 'water', 'BEAM'), move('surf', 'water', 'AOE')];
    g.resetBattlefield();
    for (let i = 0; i < 120 * 60 && !g.matchOver; i++) {
        if (i % 180 === 0) g.useMove((i / 180) % 2);
        if (i % 300 === 0) g.triggerDodgeDash();
        if (i % 480 === 0) g.switchPartyOffset(1);
        g.updateAi(1 / 120); g.updatePhysics(1 / 120); g.matchElapsed += 1 / 120;
        for (const f of [...g.playerParty, ...g.enemyParty]) {
            for (const key of ['x', 'y', 'z', 'currentHp', 'stamina', 'vx', 'vy']) assert.ok(Number.isFinite(f[key]), key);
            assert.ok(f.stamina >= 0 && f.stamina <= 100);
            assert.ok(f.currentHp >= 0);
        }
        assert.ok(g.hazards.length <= 30);
    }
});

test('every curated/signature move and every type/archetype resolves to a real Showmotion sheet', () => {
    const slugs = new Set([...Object.keys(FALLBACK_MOVES), ...Object.values(SIGNATURE_MOVESETS).flat(), 'struggle']);
    for (const slug of slugs) {
        const source = FALLBACK_MOVES[slug] || { type: 'normal', power: 75, damageClass: 'physical' };
        const mapping = animationForMove({ ...source, slug,
            archetype: classifyMoveSpatialArchetype(slug, source.damageClass, source.type, source.power) });
        assert.ok(mapping.asset.visible > 0, slug);
        assert.equal(mapping.asset.bounds.length, mapping.asset.frames);
        assert.ok(existsSync(`public${mapping.asset.src}`), mapping.asset.src);
        const file = readFileSync(`public${mapping.asset.src}`);
        assert.equal(file.toString('ascii', 0, 4), 'RIFF'); assert.equal(file.toString('ascii', 8, 12), 'WEBP');
    }
    for (const type of Object.keys(TYPE_COLORS)) for (const archetype of ['BEAM', 'PROJECTILE', 'AOE', 'BLITZ'])
        assert.ok(animationForMove({ slug: 'missing-from-upstream', type, archetype }).asset.frames > 0);
});

test('native moves keep original colors; variants reuse a native motion with a filter', () => {
    const native = animationForMove({ slug: 'hydro-pump', type: 'water', archetype: 'BEAM' });
    assert.equal(native.effect, 'hydropump'); assert.equal(native.exact, true); assert.equal(native.filter, 'none');
    const variant = animationForMove({ slug: 'thunderbolt', type: 'electric', archetype: 'BEAM' });
    assert.equal(variant.effect, native.effect); assert.equal(variant.exact, false); assert.match(variant.filter, /hue-rotate/);
    assert.equal(animationForMove({ slug: 'iron-tail', type: 'steel', archetype: 'BLITZ' }).effect, 'swordsdance');
});

test('a move pressed near recovery is buffered once and spends resources only on release', () => {
    const g = engine(); g.player.recoveryTimer = 0.2;
    g.useMove(0); assert.ok(g.queuedMove); assert.equal(g.player.moves[0].pp, 15);
    for (let i = 0; i < 30; i++) g.updatePhysics(1 / 120);
    assert.equal(g.queuedMove, null); assert.equal(g.player.moves[0].pp, 14);
    assert.match(g.attackFeedback.text, /released/);
});

test('input buffer is cancelled by menu input clearing and does not leak to the next fighter', () => {
    const g = engine(); g.player.recoveryTimer = 0.2; g.useMove(0); g.clearInput();
    assert.equal(g.queuedMove, null);
    for (let i = 0; i < 30; i++) g.updatePhysics(1 / 120);
    assert.equal(g.player.moves[0].pp, 15);
});

test('stamina refusals explain why the attack did not start', () => {
    const g = engine(); g.player.stamina = 0;
    g.useMove(0); assert.equal(g.player.action, null); assert.equal(g.player.moves[0].pp, 15);
    assert.match(g.attackFeedback.text, /Need 18 stamina/);
});

test('high-angle projection and cursor unprojection agree across screen sizes and field depths', () => {
    for (const [width, height] of [[1920, 1038], [1440, 958], [1024, 680], [390, 806], [844, 350]]) {
        for (const x of [-470, -235, 0, 235, 470]) for (const y of [-255, -120, 0, 120, 255]) {
            const screen = projectGround(x, y, 0, width, height);
            const world = unprojectGround(screen.x, screen.y, width, height);
            assert.ok(Math.abs(world.x - x) < 1e-7);
            assert.ok(Math.abs(world.y - y) < 1e-7);
            assert.ok(screen.x >= 0 && screen.x <= width);
            assert.ok(screen.y >= 0 && screen.y <= height);
        }
    }
});

test('species size is independent of hitbox projection, and flight raises sprites above their ground position', () => {
    const small = { height: 4, y: 0 }, large = { height: 16, y: 0 };
    for (const [width, height] of [[1920, 1038], [1440, 958], [390, 806]]) {
        const a = fighterSpriteSize(small, width, height), b = fighterSpriteSize(large, width, height);
        assert.ok(b > a * 2); assert.ok(a >= 18); assert.ok(b < height * 0.15);
        const ground = projectGround(100, 100, 0, width, height);
        const flying = projectGround(100, 100, 85, width, height);
        assert.equal(ground.x, flying.x); assert.ok(flying.y < ground.y);
        assert.ok(projectGround(0, 255, 0, width, height).scale > projectGround(0, -255, 0, width, height).scale);
    }
});
