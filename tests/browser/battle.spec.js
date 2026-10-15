import { test, expect } from '@playwright/test';

// API fixtures isolate game behavior from remote availability. Sprite/font assets
// still use the application's real URLs in the rendered screenshots.
const species = [
    [25, 'pikachu', ['electric'], 60, 4], [6, 'charizard', ['fire', 'flying'], 905, 17],
    [658, 'greninja', ['water', 'dark'], 400, 15], [9, 'blastoise', ['water'], 855, 16],
    [466, 'electivire', ['electric'], 1386, 18], [212, 'scizor', ['bug', 'steel'], 1180, 18],
    [448, 'lucario', ['fighting', 'steel'], 540, 12], [445, 'garchomp', ['dragon', 'ground'], 950, 19]
];

async function boot(page) {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/pokeapi.co/api/v2/pokemon/*', async route => {
        const query = route.request().url().split('/').pop();
        const found = species.find(([id, name]) => String(id) === query || name === query);
        if (!found) { await route.fulfill({ status: 404, body: '{}' }); return; }
        const [id, name, types, weight, height] = found;
        await route.fulfill({ json: {
            id, name, weight, height,
            types: types.map(type => ({ type: { name: type } })),
            stats: ['hp', 'attack', 'defense', 'special-attack', 'special-defense', 'speed'].map(stat => ({ stat: { name: stat }, base_stat: 85 })),
            sprites: { front_default: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png` },
            cries: {}, moves: []
        } });
    });
    await page.goto('/');
    await expect(page.locator('#startMenuModal')).toBeVisible();
    await page.waitForFunction(() => window.GameEngine && !window.GameEngine.loading);
    return errors;
}

async function duel(page) {
    await page.getByRole('button', { name: /TRAINING DUEL/ }).click();
    await page.waitForFunction(() => !window.GameEngine.loading && !window.GameEngine.spriteAnimator.busy && window.GameEngine.playerParty.length === 1);
    await expect(page.locator('#startMenuModal')).toHaveCount(0);
}

test('all bundled Pokemon animate across combat states and walking directions', async ({ page }) => {
    const errors = await boot(page); await duel(page);
    const result = await page.evaluate(async () => {
        const g = window.GameEngine; g.paused = true;
        const manifest = await fetch('/pokemon-motion/bundled.json').then(r => r.json());
        await g.spriteAnimator.prepare(manifest.species.map(id => ({ id: Number(id) })));
        const actor = document.createElement('div'), image = document.createElement('img'); actor.append(image);
        const failures = [];
        for (const id of manifest.species) {
            const f = { ...g.player, id: Number(id), speciesId: Number(id), fainted: false, hitFlashTimer: 0, dashTimer: 0, guarding: false, counterShieldTimer: 0, recoveryTimer: 0, action: null, blitzState: null, vx: 0, vy: 0 };
            for (const state of ['idle', 'walk', 'charge', 'attack', 'shoot', 'recovery', 'hurt', 'dodge', 'guard', 'faint', 'sendout']) {
                g.spriteAnimator.events.delete(f);
                Object.assign(f, { fainted: state === 'faint', vx: state === 'walk' ? 50 : 0, vy: 0, action: state === 'charge' ? { tx: f.x + 100, ty: f.y } : null,
                    hitFlashTimer: state === 'hurt' ? 0.1 : 0, dashTimer: state === 'dodge' ? 0.2 : 0, guarding: state === 'guard', recoveryTimer: state === 'recovery' ? 0.2 : 0 });
                if (['attack', 'shoot', 'sendout'].includes(state)) g.spriteAnimator.play(f, state);
                g.spriteAnimator.render(f, actor, image, g);
                if (actor.dataset.animation !== state || actor.dataset.spriteSource !== 'spritecollab') failures.push(`${id}:${state}`);
                const canvas = actor.querySelector('canvas');
                if (!canvas?.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data.some((n, i) => i % 4 === 3 && n > 0)) failures.push(`${id}:${state}:blank`);
            }
        }
        g.spriteAnimator.events.delete(g.player); g.player.action = null; g.player.vx = 60; g.player.vy = 0;
        g.updateActors(); const before = document.getElementById('playerActor').dataset.animationFrame;
        g.spriteAnimator.tick(0.2, g); g.updateActors();
        const after = document.getElementById('playerActor').dataset.animationFrame;
        return { count: manifest.species.length, failures, before, after, direction: document.getElementById('playerActor').dataset.direction };
    });
    expect(result.count).toBe(27); expect(result.failures).toEqual([]);
    expect(result.direction).toBe('2'); expect(result.before).not.toBe(result.after);
    await page.screenshot({ path: 'test-results/directional-pokemon-battle.png' });
    expect(errors).toEqual([]);
});

test('missing character sheets retain animated fallback and switches clean departing actors', async ({ page }) => {
    const errors = await boot(page);
    await page.getByRole('button', { name: 'ENTER STADIUM & BATTLE!' }).click();
    await page.waitForFunction(() => !window.GameEngine.loading && !window.GameEngine.paused && !window.GameEngine.spriteAnimator.busy);
    await page.evaluate(() => { const g = window.GameEngine; g.updateAi = () => {}; g.spriteAnimator.packs.delete(g.player.id); });
    await expect(page.locator('#playerActor')).toHaveAttribute('data-sprite-source', 'fallback');
    await page.keyboard.down('d');
    await expect(page.locator('#playerActor')).toHaveAttribute('data-animation', 'walk');
    await page.keyboard.up('d');
    await page.getByRole('button', { name: /^Switch to charizard$/i }).click();
    await expect(page.locator('.departing-pokemon')).toHaveCount(1);
    await expect(page.locator('#playerActor')).toHaveAttribute('data-animation', 'sendout');
    await expect(page.locator('.departing-pokemon')).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => window.GameEngine.player.switchCooldown)).toBe(0);
    await page.evaluate(() => { const g = window.GameEngine; g.player.currentHp = 0; g.handleFaint(g.player); });
    await expect(page.locator('.departing-pokemon')).toHaveCount(1);
    await expect(page.locator('.departing-pokemon')).toHaveCount(0);
    expect(await page.evaluate(() => window.GameEngine.player.fainted)).toBe(false);
    await page.evaluate(() => window.GameEngine.rematch());
    await page.waitForFunction(() => !window.GameEngine.loading);
    await expect(page.locator('.departing-pokemon')).toHaveCount(0);
    expect(errors).toEqual([]);
});

test('retreat backpedals toward the opponent without reversing movement controls', async ({ page }) => {
    const errors = await boot(page); await duel(page);
    await page.evaluate(() => {
        const g = window.GameEngine; g.updateAi = () => {};
        g.player.x = -100; g.player.y = 0; g.enemy.x = 200; g.enemy.y = 0;
        g.enemy.vx = 0; g.enemy.vy = 0;
    });
    await page.keyboard.down('a');
    await expect(page.locator('#playerActor')).toHaveAttribute('data-backpedaling', 'true');
    await expect(page.locator('#playerActor')).toHaveAttribute('data-direction', '2');
    expect(await page.evaluate(() => window.GameEngine.player.x)).toBeLessThan(-100);
    await page.screenshot({ path: 'test-results/backpedaling.png' });
    await page.keyboard.up('a');
    await page.keyboard.down('d');
    await expect.poll(() => page.evaluate(() => window.GameEngine.player.vx)).toBeGreaterThan(12);
    await expect(page.locator('#playerActor')).toHaveAttribute('data-backpedaling', 'false');
    await expect(page.locator('#playerActor')).toHaveAttribute('data-direction', '2');
    await page.keyboard.up('d');
    expect(errors).toEqual([]);
});

test('Pokeballs throw, land and release; faint recall finishes before the next throw', async ({ page }) => {
    const errors = await boot(page);
    await page.getByRole('button', { name: 'ENTER STADIUM & BATTLE!' }).click();
    await page.waitForFunction(() => !window.GameEngine.loading && window.GameEngine.playerParty.length === 3);
    const locked = await page.evaluate(() => {
        const g = window.GameEngine;
        const pp = g.player.moves[0].pp;
        const accepted = g.useMove(0);
        g.paused = true; g.updateAi = () => {};
        return { busy: g.spriteAnimator.busy, accepted, ppUnchanged: pp === g.player.moves[0].pp };
    });
    expect(locked).toEqual({ busy: true, accepted: false, ppUnchanged: true });
    const phases = [];
    for (const targetTime of [0.4, 0.83, 1, 1.4]) {
        phases.push(await page.evaluate(time => {
            const g = window.GameEngine, a = g.spriteAnimator;
            a.tick(Math.max(0, time - a.time), g); g.updateActors(); g.renderFrame();
            return { phase: document.querySelector('.pokeball-sequence[data-kind="sendout"]').dataset.phase, opacity: Number(document.getElementById('playerActor').style.opacity) };
        }, targetTime));
        if (targetTime === 1.4) await page.screenshot({ path: 'test-results/pokeball-release.png' });
    }
    expect(phases.map(p => p.phase)).toEqual(['throw', 'landing', 'opening', 'release']);
    expect(phases[0].opacity).toBe(0); expect(phases[2].opacity).toBe(0); expect(phases[3].opacity).toBe(1);
    const recall = await page.evaluate(() => {
        const g = window.GameEngine, a = g.spriteAnimator;
        a.tick(0.4, g); g.paused = false;
        const outgoing = g.player;
        outgoing.currentHp = 0; g.handleFaint(outgoing); g.paused = true;
        a.tick(0.55, g); g.updateActors(); g.renderFrame();
        return { phase: document.querySelector('.pokeball-sequence').dataset.phase,
            throws: document.querySelectorAll('.pokeball-sequence[data-kind="sendout"]').length,
            nextHidden: Number(document.getElementById('playerActor').style.opacity) === 0,
            replacementAlive: !g.player.fainted };
    });
    expect(recall).toEqual({ phase: 'recalling', throws: 0, nextHidden: true, replacementAlive: true });
    await page.screenshot({ path: 'test-results/pokeball-recall.png' });
    await page.evaluate(() => { const g = window.GameEngine; g.spriteAnimator.tick(0.8, g); g.updateActors(); g.renderFrame(); });
    await expect(page.locator('.pokeball-sequence[data-kind="recall"]')).toHaveCount(0);
    await expect(page.locator('.pokeball-sequence[data-kind="sendout"]')).toHaveAttribute('data-phase', 'throw');
    await page.evaluate(() => { const g = window.GameEngine; g.paused = false; g.rematch(); });
    await page.waitForFunction(() => !window.GameEngine.loading);
    await expect(page.locator('.departing-pokemon')).toHaveCount(0);
    expect(await page.evaluate(() => window.GameEngine.spriteAnimator.balls.length)).toBe(2);
    expect(errors).toEqual([]);
});

test('the final recall pauses with menus and completes before the result screen', async ({ page }) => {
    const errors = await boot(page); await duel(page);
    await page.evaluate(() => {
        const g = window.GameEngine;
        g.moveAnimations.impact(g.player.moves[0], g.enemy.x, g.enemy.y, 0);
        g.enemy.currentHp = 0; g.handleFaint(g.enemy);
    });
    await expect(page.locator('#resultModal')).toBeHidden();
    await page.getByRole('button', { name: 'SELECT SQUAD', exact: true }).click();
    const time = await page.evaluate(() => window.GameEngine.spriteAnimator.time);
    await page.waitForTimeout(350);
    expect(await page.evaluate(() => window.GameEngine.spriteAnimator.time)).toBe(time);
    await expect(page.locator('#resultModal')).toBeHidden();
    await page.getByRole('button', { name: 'CLOSE', exact: true }).click();
    await expect(page.locator('#resultModal')).toBeVisible();
    await expect(page.locator('.departing-pokemon')).toHaveCount(0);
    await expect(page.locator('.pokeball-sequence')).toHaveCount(0);
    expect(await page.evaluate(() => window.GameEngine.moveAnimations.impacts.length)).toBe(0);
    expect(errors).toEqual([]);
});

test('movement effects, sprite attachments and type accents render with camera-safe aim', async ({ page }) => {
    const errors = await boot(page); await duel(page);
    await page.evaluate(() => { window.GameEngine.updateAi = () => {}; });
    await page.keyboard.down('d');
    await expect.poll(() => page.evaluate(() => window.GameEngine.presentation.particles.length)).toBeGreaterThan(0);
    await page.keyboard.up('d'); await page.keyboard.press('Space');
    await expect.poll(() => page.evaluate(() => window.GameEngine.presentation.trails.length)).toBeGreaterThan(0);
    const state = await page.evaluate(async () => {
        const g = window.GameEngine; g.paused = true;
        const { attackMuzzle, renderTypeAccent } = await import('/src/game/BattlePresentation.js');
        g.player.z = 60; g.presentation.update(0.01, g);
        g.player.z = 0; g.presentation.update(0.01, g);
        const head = g.spriteAnimator.attachment(g.player, 'head');
        const cannon = attackMuzzle(g, g.enemy, { type: 'water', slug: 'hydro-pump' });
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
        const ctx = canvas.getContext('2d');
        const signatures = ['electric', 'water', 'fire', 'ice'].map(type => {
            ctx.clearRect(0, 0, 128, 128); renderTypeAccent(ctx, type, 64, 64, 40, 0.4);
            const pixels = ctx.getImageData(0, 0, 128, 128).data;
            return pixels.reduce((sum, n, i) => sum + n * (i % 7 + 1), 0);
        });
        g.presentation.pulse(0.035, 0.65); g.presentation.update(0.325, g);
        const p = g.worldToScreen(120, -80), inverse = g.screenToWorld(p.x, p.y);
        g.updateActors(); g.renderFrame();
        return { landing: g.presentation.particles.some(p => p.kind === 'landing'), head,
            cannon: cannon.kind, signatures, zoom: g.camera.zoom, error: Math.hypot(inverse.x - 120, inverse.y + 80), softened: !!g.softenedArena };
    });
    expect(state.landing).toBe(true); expect(state.head).not.toBeNull();
    expect(Number.isFinite(state.head.x) && Number.isFinite(state.head.y)).toBe(true);
    expect(state.cannon).toBe('cannon'); expect(new Set(state.signatures).size).toBe(4);
    expect(state.signatures.every(n => n > 0)).toBe(true);
    expect(state.zoom).toBeCloseTo(1.035); expect(state.error).toBeLessThan(1e-6); expect(state.softened).toBe(true);
    await page.screenshot({ path: 'test-results/visual-upgrade-desktop.png' });
    expect(errors).toEqual([]);
});

test('reduced motion disables camera kicks and animated ambient accents', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const errors = await boot(page); await duel(page);
    const result = await page.evaluate(() => {
        const g = window.GameEngine; g.paused = true;
        g.presentation.pulse(); g.camera.shakeTimer = 0.2; g.camera.shakeMagnitude = 3;
        g.presentation.update(0.1, g);
        const canvas = document.createElement('canvas'); canvas.width = g.width; canvas.height = g.height;
        const ctx = canvas.getContext('2d');
        const snapshot = () => { ctx.clearRect(0, 0, canvas.width, canvas.height); g.presentation.renderAmbient(ctx, g); return ctx.getImageData(0, 0, canvas.width, canvas.height).data.reduce((sum, n) => sum + n, 0); };
        const before = snapshot(); g.presentation.update(1, g); const after = snapshot();
        return { zoom: g.camera.zoom, x: g.camera.x, y: g.camera.y, before, after, trails: g.presentation.trails.length };
    });
    expect(result.zoom).toBe(1); expect(result.x).toBe(0); expect(result.y).toBe(0);
    // Canvas antialiasing may round a few channel values differently on redraw.
    expect(Math.abs(result.before - result.after)).toBeLessThan(16);
    expect(result.trails).toBe(0); expect(errors).toEqual([]);
});

test('custom squad previews follow typed names and IDs and report invalid names', async ({ page }) => {
    const errors = await boot(page);
    const input = page.locator('#startMenuModal input[type="text"]').first();
    const slot = page.getByRole('button').filter({ hasText: 'Slot 1' }).first();
    await input.fill('blastoise');
    await expect(slot.locator('img')).toHaveAttribute('alt', 'blastoise');
    await expect(slot.locator('img')).toHaveAttribute('src', /\/9\.png$/);
    await input.fill('212');
    await expect(slot.locator('img')).toHaveAttribute('alt', 'scizor');
    await input.fill('not-a-real-pokemon');
    await expect(slot).toContainText('Pokémon not found');
    await expect(slot.locator('img')).toHaveCount(0);
    await input.fill('');
    await expect(slot).toContainText('Enter a name or ID');
    await input.fill('pikachu');
    await input.fill('blastoise');
    await expect(slot.locator('img')).toHaveAttribute('alt', 'blastoise');
    expect(errors).toEqual([]);
});

test('boot, training duel, guard, movement, dodge, menus, sound and rematch', async ({ page }) => {
    const errors = await boot(page);
    await expect.poll(() => page.evaluate(() => window.GameEngine.paused)).toBe(true);
    await page.screenshot({ path: 'test-results/start-menu.png', fullPage: true });
    await duel(page);
    // Control checks isolate input from random enemy attacks.
    await page.evaluate(() => { window.GameEngine.ai.attackCooldown = 999; });
    await expect(page.locator('#movesGrid button')).toHaveCount(3);
    await page.locator('#soundToggleBtn').click();
    expect(await page.evaluate(() => window.SoundEngine.enabled)).toBe(false);
    await expect(page.locator('#soundIcon')).toHaveClass(/volume-xmark/);
    await page.keyboard.down('q');
    await expect.poll(() => page.evaluate(() => window.GameEngine.player.guarding)).toBe(true);
    await page.keyboard.up('q');
    await expect.poll(() => page.evaluate(() => window.GameEngine.player.guarding)).toBe(false);
    const x = await page.evaluate(() => window.GameEngine.player.x);
    await page.keyboard.down('d');
    await expect.poll(() => page.evaluate(() => window.GameEngine.player.x)).toBeGreaterThan(x + 10);
    await page.keyboard.up('d');
    await page.keyboard.press('Space');
    await expect.poll(() => page.evaluate(() => window.GameEngine.player.dodgeCooldown)).toBeGreaterThan(0);
    await page.keyboard.press('f');
    await expect(page.locator('#aimModeText')).toHaveText('AIM: CURSOR [F]');
    await page.locator('#aimModeBtn').click();
    await expect(page.locator('#aimModeText')).toHaveText('AIM: AUTO-LOCK [F]');
    await page.waitForFunction(() => window.GameEngine.player.dashTimer === 0 && window.GameEngine.player.recoveryTimer === 0);
    await page.keyboard.press('1');
    await expect.poll(() => page.evaluate(() => window.GameEngine.player.moves[0].pp)).toBe(14);
    await page.screenshot({ path: 'test-results/desktop-battle.png', fullPage: true });
    await page.locator('#mechanicsHelpBtn').click();
    await expect(page.locator('#helpModal')).toBeVisible();
    expect(await page.evaluate(() => window.GameEngine.paused)).toBe(true);
    const hp = await page.evaluate(() => window.GameEngine.player.currentHp);
    await page.keyboard.press('1');
    expect(await page.evaluate(() => window.GameEngine.player.currentHp)).toBe(hp);
    await page.getByRole('button', { name: 'RESUME STADIUM BATTLE!' }).click();
    await page.locator('#restartBtn').click();
    await page.waitForFunction(() => !window.GameEngine.loading && window.GameEngine.player.moves[0].pp === 15);
    expect(await page.evaluate(() => window.GameEngine.playerParty.length)).toBe(1);
    await page.evaluate(() => window.GameEngine.endMatch(true));
    await expect(page.locator('#resultModal')).toBeVisible();
    await page.locator('#rematchBtn').click();
    await page.waitForFunction(() => !window.GameEngine.loading && !window.GameEngine.matchOver);
    expect(await page.evaluate(() => window.GameEngine.enemyParty.length)).toBe(1);
    expect(errors).toEqual([]);
});

test('three-fighter switching, flight and text input do not trigger attacks', async ({ page }) => {
    const errors = await boot(page);
    await page.getByRole('button', { name: 'ENTER STADIUM & BATTLE!' }).click();
    await page.waitForFunction(() => !window.GameEngine.loading && !window.GameEngine.paused && !window.GameEngine.spriteAnimator.busy);
    await page.keyboard.press('z');
    await expect(page.locator('#playerNameHud')).toHaveText('CHARIZARD');
    await page.waitForFunction(() => !window.GameEngine.spriteAnimator.busy);
    await page.keyboard.down('h');
    await expect.poll(() => page.evaluate(() => window.GameEngine.player.z)).toBeGreaterThan(35);
    await page.keyboard.up('h');
    await expect.poll(() => page.evaluate(() => window.GameEngine.player.z)).toBe(0);
    await page.getByRole('button', { name: 'SELECT SQUAD', exact: true }).click();
    await expect(page.locator('#startMenuModal')).toBeVisible();
    const input = page.locator('#startMenuModal input').first();
    await input.fill('pikachu');
    await input.press('1');
    expect(await page.evaluate(() => window.GameEngine.player.action)).toBeNull();
    await page.getByRole('button', { name: 'CLOSE', exact: true }).click();
    expect(await page.evaluate(() => window.GameEngine.paused)).toBe(false);
    expect(errors).toEqual([]);
});

test('squad buttons switch mid battle and impacts carry guard and effectiveness feedback', async ({ page }) => {
    const errors = await boot(page);
    await page.getByRole('button', { name: 'ENTER STADIUM & BATTLE!' }).click();
    await page.waitForFunction(() => !window.GameEngine.loading && !window.GameEngine.paused && !window.GameEngine.spriteAnimator.busy);
    await page.evaluate(() => { window.GameEngine.updateAi = () => {}; });
    await page.getByRole('button', { name: /^Switch to charizard$/i }).click();
    await expect(page.locator('#playerNameHud')).toHaveText('CHARIZARD');
    await expect(page.getByRole('button', { name: /^Active charizard$/i })).toBeDisabled();
    await page.getByRole('button', { name: /^Switch to lucario$/i }).click();
    await expect(page.locator('#attackFeedback')).toContainText('Switch ready in');
    await page.waitForFunction(() => !window.GameEngine.spriteAnimator.busy);
    await expect.poll(() => page.evaluate(() => window.GameEngine.player.switchCooldown)).toBe(0);
    await page.getByRole('button', { name: /^Switch to lucario$/i }).click();
    await expect(page.locator('#playerNameHud')).toHaveText('LUCARIO');
    const feedback = await page.evaluate(() => {
        const g = window.GameEngine;
        g.moveAnimations.clear();
        const move = { ...g.player.moves[0], type: 'electric', accuracy: 100, power: 35, damageClass: 'special' };
        g.enemy.types = ['water']; g.enemy.currentHp = g.enemy.maxHp;
        g.hitAttack({ owner: g.player, move, hitTargets: new Set() }, g.enemy);
        const strong = g.moveAnimations.impacts.at(-1);
        const pause = g.hitStopTimer;
        g.enemy.guarding = true; g.enemy.stamina = 100;
        g.hitAttack({ owner: g.player, move, hitTargets: new Set() }, g.enemy);
        const guarded = g.moveAnimations.impacts.at(-1);
        g.paused = true; g.moveAnimations.update(0.12); g.renderFrame();
        return { strong: strong.effectiveness, guarded: guarded.guarded, pause };
    });
    expect(feedback.strong).toBe(2);
    expect(feedback.guarded).toBe(true);
    expect(feedback.pause).toBeGreaterThan(0);
    await page.screenshot({ path: 'test-results/impact-and-squad.png' });
    expect(errors).toEqual([]);
});

test('type effectiveness reports dual weaknesses, resistance and immunity without immunity damage', async ({ page }) => {
    const errors = await boot(page); await duel(page);
    const outcomes = await page.evaluate(() => {
        const g = window.GameEngine; g.paused = true;
        const move = { ...g.player.moves[0], type: 'electric', accuracy: 100, power: 30, damageClass: 'special' };
        return [['water', 'flying'], ['grass', 'electric'], ['ground']].map(types => {
            g.moveAnimations.clear(); g.enemy.types = types;
            g.enemy.currentHp = g.enemy.maxHp; g.enemy.guarding = false;
            const hp = g.enemy.currentHp;
            g.resolveHit(g.player, g.enemy, move);
            const impact = g.moveAnimations.impacts.at(-1);
            g.moveAnimations.update(0.6); g.renderFrame();
            return { multiplier: impact.effectiveness, feedback: document.getElementById('attackFeedback').textContent, damage: hp - g.enemy.currentHp, visibleAfterMotion: g.moveAnimations.impacts.length };
        });
    });
    expect(outcomes.map(o => o.multiplier)).toEqual([4, 0.25, 0]);
    expect(outcomes[0].feedback).toContain('Super effective! (×4)');
    expect(outcomes[1].feedback).toContain('Not very effective… (×0.25)');
    expect(outcomes[2].feedback).toContain('No effect!');
    expect(outcomes[2].damage).toBe(0);
    expect(outcomes.every(o => o.visibleAfterMotion === 1)).toBe(true);
    await page.screenshot({ path: 'test-results/type-immunity-indicator.png' });
    expect(errors).toEqual([]);
});

test('mobile arena fits both fighters and supports touch defense', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const errors = await boot(page);
    await duel(page);
    const geometry = await page.evaluate(() => {
        const vp = document.getElementById('arenaViewport').getBoundingClientRect();
        return ['playerActor', 'enemyActor'].map(id => {
            const r = document.getElementById(id).getBoundingClientRect();
            return { x: r.x, right: r.right, leftBound: vp.x, rightBound: vp.right };
        });
    });
    for (const r of geometry) { expect(r.x).toBeGreaterThanOrEqual(r.leftBound); expect(r.right).toBeLessThanOrEqual(r.rightBound); }
    await page.locator('#btnCounterShield').click();
    await expect.poll(() => page.evaluate(() => window.GameEngine.player.counterCooldown)).toBeGreaterThan(0);
    await page.locator('#btnDodgeDash').click();
    await expect.poll(() => page.evaluate(() => window.GameEngine.player.dodgeCooldown)).toBeGreaterThan(0);
    await page.screenshot({ path: 'test-results/mobile-battle.png', fullPage: true });
    expect(errors).toEqual([]);
});

test('terrain and beam clash render without browser errors', async ({ page }) => {
    const errors = await boot(page); await duel(page);
    await page.evaluate(() => {
        const g = window.GameEngine;
        g.paused = true; g.player.x = -160; g.player.y = 0; g.enemy.x = 160; g.enemy.y = 0;
        g.hazards = []; g.addTerrain('puddle', 0, 0);
        g.reactTerrain({ type: 'electric', power: 90 }, 0, 0, g.player);
        g.addTerrain('ice', -180, 100); g.addTerrain('steam', 180, -100);
        g.spawnBeam(-160, 0, 160, 0, g.player.moves[0], false);
        g.spawnBeam(160, 0, -160, 0, g.enemy.moves[0], true);
        g.findBeamClashes(); g.updateActors();
    });
    await page.screenshot({ path: 'test-results/terrain-clash.png', fullPage: true });
    expect(await page.evaluate(() => window.GameEngine.beams[0].clash !== null)).toBe(true);
    expect(errors).toEqual([]);
});

test('opening a menu during an async load preserves pause and invalid teams show an error', async ({ page }) => {
    const errors = await boot(page); await duel(page);
    await page.evaluate(async () => {
        const g = window.GameEngine;
        const { PokeApiService } = await import('/src/game/PokeApiService.js');
        const original = PokeApiService.fetchPokemon;
        PokeApiService.fetchPokemon = async entry => {
            await new Promise(resolve => setTimeout(resolve, 400));
            return original.call(PokeApiService, entry);
        };
        window.restorePokemonFetcher = () => { PokeApiService.fetchPokemon = original; };
        g.rematch();
    });
    await page.getByRole('button', { name: 'SELECT SQUAD', exact: true }).click();
    await page.waitForFunction(() => !window.GameEngine.loading);
    expect(await page.evaluate(() => window.GameEngine.paused)).toBe(true);
    await page.evaluate(() => window.restorePokemonFetcher());
    await page.getByRole('button', { name: 'CLOSE', exact: true }).click();
    const success = await page.evaluate(async () => window.GameEngine.initMatch('custom', {
        playerTrainer: 'INVALID', enemyTrainer: 'RIVAL', playerTeam: [{ name: 'totally-invalid' }], enemyTeam: [{ name: 'blastoise' }]
    }));
    expect(success).toBe(false);
    await expect(page.getByRole('alert')).toContainText('Cannot load');
    expect(await page.evaluate(() => window.GameEngine.player.name)).toBe('PIKACHU');
    expect(errors).toEqual([]);
});

test('live PokéAPI initial roster and sprites load', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    await page.waitForFunction(() => window.GameEngine && !window.GameEngine.loading);
    const state = await page.evaluate(() => ({
        players: window.GameEngine.playerParty.length, enemies: window.GameEngine.enemyParty.length,
        name: window.GameEngine.player?.name, offline: window.GameEngine.player?.offline
    }));
    expect(state.players).toBe(3); expect(state.enemies).toBe(3); expect(state.name).toBe('PIKACHU');
    expect(state.offline).toBe(false);
    await page.getByRole('button', { name: 'CLOSE', exact: true }).click();
    await expect.poll(() => page.locator('#playerSpriteImg').evaluate(img => img.naturalWidth)).toBeGreaterThan(0);
    await expect.poll(() => page.locator('#enemySpriteImg').evaluate(img => img.naturalWidth)).toBeGreaterThan(0);
    await page.screenshot({ path: 'test-results/live-battle.png', fullPage: true });
    expect(errors).toEqual([]);
});

test('a held mouse click on a move survives HUD refreshes and releases an attack', async ({ page }) => {
    const errors = await boot(page); await duel(page);
    await page.evaluate(() => { window.GameEngine.ai.attackCooldown = 999; });
    const button = page.locator('#movesGrid button').first();
    await button.click({ delay: 250 });
    await expect.poll(() => page.evaluate(() => window.GameEngine.player.moves[0].pp)).toBe(14);
    await expect.poll(() => page.evaluate(() => window.GameEngine.beams.length)).toBeGreaterThan(0);
    expect(errors).toEqual([]);
});

test('Showmotion originals and variants render in the arena without WebGPU', async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined, configurable: true }));
    const errors = await boot(page); await duel(page);
    const result = await page.evaluate(async () => {
        const g = window.GameEngine;
        g.paused = true; g.player.x = -220; g.player.y = 0; g.enemy.x = 220; g.enemy.y = 0;
        g.projectiles = []; g.beams = []; g.aoeWaves = []; g.hazards = []; g.pillars = [];
        const { PokeApiService } = await import('/src/game/PokeApiService.js');
        const hydro = await PokeApiService.fetchMove('hydro-pump');
        const electric = await PokeApiService.fetchMove('thunderbolt');
        g.spawnBeam(-220, -60, 220, -60, hydro, false);
        g.spawnBeam(220, 80, -220, 80, electric, true);
        g.beams.forEach(b => { b.activeTimer = 0.2; });
        g.updateActors(); g.renderFrame();
        const ctx = document.getElementById('moveEffectsCanvas').getContext('2d');
        const pixels = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height).data;
        let visible = 0, blue = 0, warm = 0;
        for (let i = 0; i < pixels.length; i += 4) if (pixels[i + 3] > 20) {
            visible++;
            if (pixels[i + 2] > pixels[i] * 1.2) blue++;
            if (pixels[i] > pixels[i + 2] * 1.2) warm++;
        }
        return { gpu: !!navigator.gpu, ready: g.moveAnimations.ready, visible, blue, warm,
            draws: g.moveAnimations.lastFrameDraws, effects: [...g.moveAnimations.drawnEffects] };
    });
    expect(result.gpu).toBe(false); expect(result.ready).toBe(true);
    expect(result.draws).toBe(2); expect(result.visible).toBeGreaterThan(100);
    expect(result.blue).toBeGreaterThan(20); expect(result.warm).toBeGreaterThan(20);
    expect(result.effects).toContain('hydropump');
    await page.screenshot({ path: 'test-results/showmotion-hydro-electric.png', fullPage: true });
    expect(errors).toEqual([]);
});

test('all Showmotion source sheets contain visible animation and rematch clears stale effects', async ({ page }) => {
    const errors = await boot(page); await duel(page);
    const results = await page.evaluate(async () => {
        const g = window.GameEngine; g.paused = true;
        const { default: assets } = await import('/src/game/ShowmotionAssets.js');
        const slugs = { hydropump: 'hydro-pump', shadowball: 'shadow-ball', moonblast: 'moonblast',
            mysticalfire: 'mystical-fire', psychic: 'psychic', gunkshot: 'gunk-shot',
            flowertrick: 'flower-trick', swordsdance: 'swords-dance', willowisp: 'will-o-wisp', land: 'rock-slide' };
        const results = [];
        for (const [id, meta] of Object.entries(assets)) {
            const canvas = document.getElementById('moveEffectsCanvas'), ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, g.width, g.height);
            const best = meta.bounds.reduce((a, b, i) => b.visible > meta.bounds[a].visible ? i : a, 0);
            g.moveAnimations.drawFrame(ctx, { slug: slugs[id], type: id === 'land' ? 'rock' : 'normal', archetype: 'AOE' },
                (best + 0.1) / meta.frames, g.width / 2, g.height / 2, 180, 160);
            const rgba = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
            results.push({ id, visible: rgba.some((value, i) => i % 4 === 3 && value > 20) });
        }
        g.moveAnimations.impact(g.player.moves[0], 0, 0);
        return results;
    });
    for (const result of results) expect(result.visible, result.id).toBe(true);
    await page.locator('#restartBtn').click();
    await page.waitForFunction(() => !window.GameEngine.loading);
    expect(await page.evaluate(() => window.GameEngine.moveAnimations.impacts.length)).toBe(0);
    expect(errors).toEqual([]);
});

test('touch move cards launch animated attacks on mobile', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    try {
        const page = await context.newPage();
        const errors = await boot(page); await duel(page);
        await page.evaluate(() => { window.GameEngine.ai.attackCooldown = 999; });
        await page.locator('#movesGrid button').first().tap();
        await expect.poll(() => page.evaluate(() => window.GameEngine.player.moves[0].pp)).toBe(14);
        await expect.poll(() => page.evaluate(() => window.GameEngine.moveAnimations.lastFrameDraws)).toBeGreaterThan(0);
        await page.evaluate(() => { window.GameEngine.paused = true; });
        await page.screenshot({ path: 'test-results/showmotion-mobile-attack.png', fullPage: true });
        expect(errors).toEqual([]);
    } finally { await context.close(); }
});

test('all four generated stadiums share the approved camera and species scale', async ({ page }) => {
    const errors = await boot(page); await duel(page);
    await expect.poll(() => page.locator('#playerActor').getAttribute('data-animation')).not.toBe('sendout');
    await page.waitForFunction(() => ['playerSpriteImg', 'enemySpriteImg'].every(id => {
        const image = document.getElementById(id); return image.complete && image.naturalWidth > 0;
    }));
    await page.evaluate(() => { window.GameEngine.paused = true; });
    for (const stadium of ['grassy', 'rocky', 'magma', 'ice_water']) {
        await page.getByLabel('Stadium', { exact: true }).selectOption(stadium);
        await page.waitForFunction(id => {
            const g = window.GameEngine, img = g.stadiumImages[id];
            return g.currentStadium === id && img.complete && img.naturalWidth > 0;
        }, stadium);
        const state = await page.evaluate(() => {
            const g = window.GameEngine;
            g.updateActors(); g.renderFrame();
            const p = document.getElementById('playerActor').getBoundingClientRect();
            const e = document.getElementById('enemyActor').getBoundingClientRect();
            const vp = document.getElementById('arenaViewport').getBoundingClientRect();
            const ground = g.worldToScreen(g.player.x, g.player.y);
            const inverse = g.screenToWorld(ground.x, ground.y);
            const image = document.getElementById('playerSpriteImg');
            const imageBox = image.getBoundingClientRect();
            const sourceBounds = g.spriteBoundsCache.get(g.player.sprite);
            return { sizeRatio: e.height / p.height, arenaArea: vp.width * vp.height / (innerWidth * innerHeight),
                error: Math.hypot(inverse.x - g.player.x, inverse.y - g.player.y),
                normalizedWidthError: Math.abs(imageBox.width / sourceBounds.imageWidth - p.height / sourceBounds.height),
                normalizedHeightError: Math.abs(imageBox.height / sourceBounds.imageHeight - p.height / sourceBounds.height),
                src: g.stadiumImages[g.currentStadium].src,
                logOpen: document.querySelector('.battle-log').open };
        });
        expect(state.sizeRatio).toBeGreaterThan(2);
        expect(state.arenaArea).toBeGreaterThan(0.85);
        expect(state.error).toBeLessThan(1e-6);
        expect(state.normalizedWidthError).toBeLessThan(0.02);
        expect(state.normalizedHeightError).toBeLessThan(0.02);
        expect(state.src).toContain('/grounds/high-angle/' + stadium + '.png');
        expect(state.logOpen).toBe(false);
        await page.screenshot({ path: 'test-results/arena-' + stadium + '.png', fullPage: true });
    }
    expect(errors).toEqual([]);
});

test('fighters sort behind and in front of rock cover with grounded sprite feet', async ({ page }) => {
    const errors = await boot(page); await duel(page);
    await expect.poll(() => page.locator('#playerActor').getAttribute('data-animation')).not.toBe('sendout');
    const result = await page.evaluate(() => {
        const g = window.GameEngine; g.paused = true;
        const rock = g.pillars[0]; g.player.x = rock.x; g.player.y = rock.y - 20;
        g.updateActors();
        const actor = document.getElementById('playerActor');
        const rockNode = g.rockActors.get(rock);
        const behind = Number(actor.style.zIndex) < Number(rockNode.style.zIndex);
        g.player.y = rock.y + 20; g.updateActors();
        const front = Number(actor.style.zIndex) > Number(rockNode.style.zIndex);
        const vp = document.getElementById('arenaViewport').getBoundingClientRect();
        const bounds = actor.getBoundingClientRect();
        const ground = g.worldToScreen(g.player.x, g.player.y);
        return { behind, front, footError: Math.abs(bounds.bottom - vp.top - ground.y) / bounds.height };
    });
    expect(result.behind).toBe(true); expect(result.front).toBe(true); expect(result.footError).toBeLessThan(0.1);
    expect(errors).toEqual([]);
});

test('the compact health bar turns red when a fighter is low on health', async ({ page }) => {
    const errors = await boot(page); await duel(page);
    const fill = await page.evaluate(() => {
        const g = window.GameEngine; g.paused = true;
        g.player.currentHp = Math.ceil(g.player.maxHp * 0.15); g.updateHud();
        return getComputedStyle(document.getElementById('playerHpBar')).backgroundImage;
    });
    const channels = fill.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    expect(channels).not.toBeNull();
    expect(Number(channels[1])).toBeGreaterThan(Number(channels[2]));
    expect(Number(channels[1])).toBeGreaterThan(Number(channels[3]));
    expect(errors).toEqual([]);
});
