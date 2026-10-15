import { SoundEngine } from './SoundEngine.js';
import { TYPE_CHART, TYPE_COLORS } from './constants.js';
import { clamp, segmentDistance, turnToward, moveProfile, typeEffectiveness } from './BattleRules.js';
import { traceGroundCircle } from './ArenaProjection.js';
import { RECALL_DURATION } from './PokemonAnimator.js';
import { shadowShape, muzzleKind } from './BattlePresentation.js';

const color = move => TYPE_COLORS[move.type]?.hex || '#facc15';
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// These methods run on GameEngine. All attacks retain their original owner,
// and each attack tracks contacts independently from the current active party slot.
export const CombatSystem = {
    canCommand(fighter = this.player) {
        return !this.paused && !this.loading && !this.matchOver && !this.spriteAnimator?.busy && fighter && !fighter.fainted;
    },

    awardBond(amount, reason, fighter = this.player) {
        if (fighter !== this.player || this.overdriveTimer > 0) return;
        this.bondSync = Math.min(100, this.bondSync + amount);
        if (reason) this.spawnFloatingText(reason, fighter.x, fighter.y - 55, '#facc15');
        this.updateHud();
    },

    resetBattlefield() {
        this.pillars = this.currentStadium === 'rocky'
            ? [{ x: -130, y: -75 }, { x: 130, y: 75 }, { x: 0, y: -155 }, { x: 0, y: 155 }]
            : [{ x: -120, y: -170 }, { x: 140, y: 170 }];
        this.pillars = this.pillars.map(p => ({ ...p, radius: 25, hp: 140, maxHp: 140, height: 38 }));
        this.hazards = [];
        if (this.currentStadium === 'magma') {
            this.addTerrain('magma', -90, 0, 48, Infinity);
            this.addTerrain('magma', 90, 0, 48, Infinity);
        } else if (this.currentStadium === 'ice_water') {
            this.addTerrain('ice', 0, 0, 90, Infinity);
            this.addTerrain('puddle', -145, 60, 65, Infinity);
            this.addTerrain('puddle', 145, -60, 65, Infinity);
        } else if (this.currentStadium === 'grassy') {
            this.addTerrain('puddle', 0, 0, 65, Infinity);
        }
    },

    addTerrain(type, x, y, radius = 55, timer = 12) {
        const same = this.hazards.find(h => h.type === type && Math.hypot(h.x - x, h.y - y) < radius * 0.6);
        if (same) { same.timer = Math.max(same.timer, timer); return same; }
        const hazard = { type, x, y, radius, timer, tick: 0.5 };
        this.hazards.push(hazard);
        if (this.hazards.length > 30) this.hazards.shift();
        return hazard;
    },

    reactTerrain(move, x, y, owner) {
        let combo = false;
        for (const h of [...this.hazards]) {
            if (Math.hypot(h.x - x, h.y - y) > h.radius + 25) continue;
            if (h.type === 'puddle' && move.type === 'electric') {
                h.type = 'electrified_puddle'; h.timer = 6; h.tick = 0.5; combo = true;
            } else if (h.type === 'puddle' && move.type === 'ice') {
                h.type = 'ice'; h.timer = 12; combo = true;
            } else if (h.type === 'ice' && move.type === 'fire') {
                h.type = 'puddle'; h.timer = 10;
                this.addTerrain('steam', h.x, h.y, h.radius, 4); combo = true;
            } else if (h.type === 'magma' && move.type === 'water') {
                h.type = 'puddle'; h.timer = 10;
                this.addTerrain('steam', h.x, h.y, h.radius, 4); combo = true;
            }
        }
        if (move.type === 'water') this.addTerrain('puddle', x, y);
        if (move.type === 'fire' && !combo) this.addTerrain('magma', x, y, 40, 7);
        if (combo) {
            this.awardBond(16, 'TERRAIN COMBO!', owner);
            this.logAnnouncer(`${owner.name} transforms the battlefield!`, 'amber');
        }
        return combo;
    },

    triggerDodgeDash(fighter = this.player, direction = null) {
        if (!this.canCommand(fighter) || fighter.dashTimer > 0 || fighter.dodgeCooldown > 0 ||
            fighter.stamina < 22 || fighter.status === 'FRZ' || fighter.guardBreakTimer > 0) return false;
        let dx = direction?.x ?? ((this.keys.d || this.keys.arrowright ? 1 : 0) - (this.keys.a || this.keys.arrowleft ? 1 : 0));
        let dy = direction?.y ?? ((this.keys.s || this.keys.arrowdown ? 1 : 0) - (this.keys.w || this.keys.arrowup ? 1 : 0));
        if (fighter === this.player && this.joyVec.active && !direction) {
            dx = this.joyVec.x; dy = this.joyVec.y;
        }
        if (!dx && !dy) dx = fighter.facing;
        const len = Math.hypot(dx, dy) || 1;
        fighter.stamina -= 22;
        fighter.dashTimer = 0.24; fighter.iFrames = 0.26;
        fighter.perfectDodgeWindow = 0.09; fighter.dodgeRewarded = false;
        fighter.dodgeCooldown = 0.65;
        fighter.dashDirX = dx / len * 520;
        fighter.dashDirY = dy / len * 520;
        fighter.guarding = false;
        // Dodging cancels a charge, but spent PP and stamina remain spent.
        fighter.action = null; fighter.blitzState = null;
        fighter.recoveryTimer = Math.max(fighter.recoveryTimer, 0.18);
        SoundEngine.playSfx('dash');
        return true;
    },

    triggerCounterShield(fighter = this.player) {
        if (!this.canCommand(fighter) || fighter.stamina < 35 || fighter.counterCooldown > 0 ||
            fighter.guardBreakTimer > 0 || fighter.status === 'FRZ' || fighter.action || fighter.blitzState) return;
        fighter.stamina -= 35;
        fighter.counterShieldTimer = 0.7; fighter.counterCooldown = 2.2;
        fighter.shieldStrength = 120; fighter.guarding = false;
        SoundEngine.playSfx('counter_shield');
        this.spawnFloatingText('COUNTER-SHIELD', fighter.x, fighter.y - 40, '#a855f7');
    },

    setGuard(active, fighter = this.player) {
        if (!fighter) return;
        fighter.guarding = Boolean(active && this.canCommand(fighter) && fighter.stamina > 0 &&
            fighter.guardBreakTimer <= 0 && fighter.status !== 'FRZ' && !fighter.action &&
            !fighter.blitzState && fighter.dashTimer <= 0 && (fighter.recoveryTimer <= 0 ||
                this.beams.some(b => b.owner === fighter && b.clash && !b.expired)));
        if (fighter === this.player) this.setKeyVisual('btnGuard', fighter.guarding);
    },

    activateOverdrive() {
        if (!this.canCommand() || this.bondSync < 100 || this.overdriveTimer > 0) return;
        this.overdriveTimer = 12; this.bondSync = 0; this.signatureReady = true;
        SoundEngine.playSfx('perfect_dodge');
        document.getElementById('speedLinesOverlay').style.opacity = '1';
        this.triggerAnimeCallout(this.playerTrainer, 'BOND OVERDRIVE! NEXT MOVE: SIGNATURE BURST!', '#facc15');
        this.logAnnouncer('Bond Overdrive: stronger attacks, faster movement, one signature burst!', 'amber');
        this.updateHud();
    },

    switchPartyOffset(offset) {
        if (!this.canCommand() || this.player.switchCooldown > 0) return;
        const idx = (this.playerActiveIdx + offset) % this.playerParty.length;
        if (!this.playerParty[idx]?.fainted) this.switchPokemon(idx);
        else {
            const alt = this.playerParty.findIndex((pk, i) => i !== this.playerActiveIdx && !pk.fainted);
            if (alt !== -1) this.switchPokemon(alt);
        }
    },

    switchPokemon(idx, forced = false) {
        const next = this.playerParty[idx];
        if (!next || next.fainted || idx === this.playerActiveIdx) return false;
        if (!forced && (!this.canCommand() || this.player.switchCooldown > 0 || this.player.action || this.player.blitzState)) {
            this.setAttackFeedback(this.player.switchCooldown > 0 ? `Switch ready in ${this.player.switchCooldown.toFixed(1)}s.` : 'Finish your current action before switching.');
            return false;
        }
        const old = this.player;
        if (!old.fainted) this.spriteAnimator?.depart(old, 'recall');
        this.clearInput();
        this.queuedMove = null;
        old.action = null; old.blitzState = null; old.guarding = false;
        this.playerActiveIdx = idx;
        next.x = old.x; next.y = old.y; next.facing = old.facing;
        next.z = 0;
        next.vx = 0; next.vy = 0; next.switchCooldown = 1.5;
        next.recoveryTimer = 0.3;
        this.spriteAnimator?.sendOut(next, RECALL_DURATION);
        this.updateHud(); this.renderMovesDeck(); this.renderPartySwitchBar();
        this.setAttackFeedback(`Go, ${next.name}! Switched in with ${Math.ceil(next.currentHp)} HP.`);
        this.logAnnouncer(`${this.playerTrainer} switched to ${next.name}!`, 'cyan');
        return true;
    },

    useMove(idx) {
        const target = this.aimMode === 'cursor' ? this.mouseWorld : this.enemy;
        const fighter = this.player;
        if (!fighter || !target) return false;
        const move = idx === -1 && fighter.moves.every(m => m.pp <= 0)
            ? this.struggleMove(fighter) : fighter.moves[idx];
        if (!move) return false;
        if (this.beginAttack(fighter, idx, target.x, target.y, false)) {
            this.queuedMove = null;
            const tooFar = move.archetype === 'BLITZ' && distance(fighter, target) > moveProfile(move).range + (target.radius || 0);
            this.setAttackFeedback(tooFar ? `${move.name}: out of reach. Move closer for contact.` : `Charging ${move.name}…`);
            return true;
        }
        const reason = this.attackBlockReason(fighter, move);
        // Buffer a deliberate press near the end of a dodge or recovery. It is
        // cancelled on menus, switching, loading, or fainting, and costs nothing
        // until the queued command is actually accepted by beginAttack.
        if (this.canCommand() && move.pp > 0 && move.cooldown <= 0 &&
            fighter.stamina >= moveProfile(move).stamina && !fighter.action && !fighter.blitzState &&
            fighter.guardBreakTimer <= 0 && fighter.status !== 'FRZ' &&
            (fighter.dashTimer > 0 || fighter.recoveryTimer > 0 && fighter.recoveryTimer <= 0.35)) {
            this.queuedMove = { idx, fighter, remaining: 0.4 };
            this.setAttackFeedback(`${move.name} queued after ${reason.toLowerCase()}.`);
        } else this.setAttackFeedback(`${move.name}: ${reason}.`);
        return false;
    },

    attackBlockReason(fighter, move) {
        if (this.loading) return 'Loading battle';
        if (this.paused) return 'Battle paused';
        if (this.spriteAnimator?.busy) return 'Poké Ball entry in progress';
        if (this.matchOver || fighter.fainted) return 'Battle finished';
        if (move.pp <= 0) return 'No PP left';
        if (move.cooldown > 0) return `Cooldown ${move.cooldown.toFixed(1)}s`;
        if (fighter.status === 'FRZ') return 'Frozen';
        if (fighter.guardBreakTimer > 0) return 'Guard broken';
        if (fighter.action) return 'Already charging';
        if (fighter.blitzState) return 'Attacking';
        if (fighter.dashTimer > 0) return 'Dodging';
        if (fighter.recoveryTimer > 0) return 'Recovery';
        const required = moveProfile(move).stamina;
        if (fighter.stamina < required) return `Need ${required} stamina (${Math.floor(fighter.stamina)} available)`;
        if (this.beams.some(b => b.owner === fighter && !b.expired)) return 'Finishing beam';
        return 'Ready';
    },

    setAttackFeedback(text) {
        this.attackFeedback = { text, until: this.matchElapsed + 2 };
        const label = document.getElementById('attackFeedback');
        if (label) label.textContent = text;
    },

    beginAttack(fighter, idx, tx, ty, isEnemy) {
        const move = idx === -1 && fighter?.moves.every(m => m.pp <= 0)
            ? this.struggleMove(fighter) : fighter?.moves[idx];
        if (!this.canCommand(fighter) || !move || move.cooldown > 0 || move.pp <= 0 ||
            fighter.action || fighter.blitzState || fighter.recoveryTimer > 0 || fighter.dashTimer > 0 ||
            fighter.guardBreakTimer > 0 || fighter.status === 'FRZ' ||
            this.beams.some(b => b.owner === fighter && !b.expired)) return false;
        const empowered = !isEnemy && this.overdriveTimer > 0 && this.signatureReady;
        const profile = moveProfile(move, empowered);
        if (fighter.stamina < profile.stamina) return false;
        fighter.stamina -= profile.stamina;
        if (idx !== -1) move.pp--;
        move.cooldown = move.cooldownMax;
        fighter.guarding = false;
        if (empowered) this.signatureReady = false;
        const payload = { ...move, profile, empowered, overdrive: !isEnemy && this.overdriveTimer > 0 };
        fighter.action = { timer: profile.charge, move: payload, tx, ty, isEnemy };
        fighter.facing = Math.sign(tx - fighter.x) || fighter.facing;
        this.triggerAnimeCallout(isEnemy ? this.enemyTrainer : this.playerTrainer,
            `${fighter.name}, ${empowered ? 'SIGNATURE BURST: ' : ''}${move.name}!`, color(move));
        SoundEngine.playSfx('beam_charge');
        if (!isEnemy) { this.updateHud(); this.renderMovesDeck(); }
        return true;
    },

    releaseAttack(fighter, action) {
        const { move, tx, ty, isEnemy } = action;
        if (move.empowered && !this.reducedMotion) this.presentation?.pulse(0.035, 0.65);
        this.spriteAnimator?.play(fighter, move.archetype === 'BLITZ' ? 'attack' : 'shoot', Math.max(0.25, Math.min(0.6, move.profile.recovery)), { x: tx, y: ty });
        const opponent = isEnemy ? this.player : this.enemy;
        if (move.archetype !== 'AOE' && move.archetype !== 'BLITZ' && move.type !== 'ground')
            move.profile.elevation = opponent.z + 14;
        if (move.archetype === 'BEAM') this.spawnBeam(fighter.x, fighter.y, tx, ty, move, isEnemy, fighter);
        else if (move.archetype === 'AOE') this.spawnAoeWave(fighter.x, fighter.y, move, isEnemy, fighter);
        else if (move.archetype === 'BLITZ') this.executeBlitz(fighter, tx, ty, move, isEnemy);
        else {
            const count = move.multiShot || 1;
            // A barrage shares the move's total damage budget rather than multiplying it.
            for (let i = 0; i < count; i++) {
                this.spawnProjectile(fighter.x, fighter.y, tx, ty,
                    { ...move, damageScale: 1 / count }, isEnemy, fighter, (i - (count - 1) / 2) * 0.07);
            }
        }
        fighter.recoveryTimer = move.profile.recovery;
        this.reactTerrain(move, fighter.x, fighter.y, fighter);
    },

    struggleMove(fighter) {
        if (!fighter.struggle) fighter.struggle = {
            slug: 'struggle', name: 'Struggle', type: 'normal', power: 40, accuracy: 100,
            damageClass: 'physical', archetype: 'BLITZ', pp: 1, maxPp: 1,
            cooldown: 0, cooldownMax: 1.6, multiShot: 1, typeless: true
        };
        return fighter.struggle;
    },

    attackEntity(sx, sy, tx, ty, move, isEnemy, owner) {
        const profile = move.profile || moveProfile(move);
        return { x: sx, y: sy, originX: sx, originY: sy,
            visualOrigin: owner ? { x: sx, y: sy, z: owner.z, id: owner.id, speciesId: owner.speciesId, height: owner.height, visualAnchor: this.spriteAnimator?.attachment(owner, muzzleKind(owner, move)) } : null,
            z: Math.max(profile.elevation, owner?.z || 0),
            angle: Math.atan2(ty - sy, tx - sx), move: { ...move, profile },
            owner: owner || (isEnemy ? this.enemy : this.player), isEnemy,
            hitTargets: new Set(), terrainTargets: new Set(), pillarTargets: new Set(), expired: false };
    },

    spawnProjectile(sx, sy, tx, ty, move, isEnemy, owner, spread = 0) {
        const shot = this.attackEntity(sx, sy, tx, ty, move, isEnemy, owner);
        shot.angle += spread;
        const { speed, range, radius } = shot.move.profile;
        Object.assign(shot, { vx: Math.cos(shot.angle) * speed, vy: Math.sin(shot.angle) * speed,
            rangeLeft: range, radius });
        this.projectiles.push(shot);
    },

    spawnBeam(sx, sy, tx, ty, move, isEnemy, owner) {
        const beam = this.attackEntity(sx, sy, tx, ty, move, isEnemy, owner);
        Object.assign(beam, { chargeTimer: 0, activeTimer: 0.35, fired: true, clash: null });
        this.beams.push(beam);
        SoundEngine.playSfx('beam_fire');
    },

    spawnAoeWave(x, y, move, isEnemy, owner) {
        const wave = this.attackEntity(x, y, x + 1, y, move, isEnemy, owner);
        Object.assign(wave, { radius: 20, previousRadius: 0, maxRadius: wave.move.profile.range, alpha: 0.95 });
        this.aoeWaves.push(wave);
    },

    executeBlitz(attacker, tx, ty, move, isEnemy) {
        const entity = this.attackEntity(attacker.x, attacker.y, tx, ty, move, isEnemy, attacker);
        const d = Math.min(Math.hypot(tx - attacker.x, ty - attacker.y), entity.move.profile.range);
        attacker.blitzState = { ...entity, startX: attacker.x, startY: attacker.y,
            targetX: attacker.x + Math.cos(entity.angle) * d,
            targetY: attacker.y + Math.sin(entity.angle) * d,
            progress: 0, duration: entity.move.profile.duration };
    },

    dodgeAttack(fighter) {
        if (fighter.iFrames <= 0) return false;
        if (!fighter.dodgeRewarded) {
            fighter.dodgeRewarded = true;
            if (fighter.perfectDodgeWindow > 0) this.triggerPerfectDodge(fighter);
            else this.awardBond(5, 'DODGE!', fighter);
        }
        return true;
    },

    triggerPerfectDodge(fighter = this.player) {
        fighter.stamina = Math.min(100, fighter.stamina + 18);
        this.awardBond(22, 'PERFECT DODGE!', fighter);
        SoundEngine.playSfx('perfect_dodge');
        if (fighter === this.player) {
            this.slowMoTimer = 0.18;
            const flash = document.getElementById('perfectDodgeFlash');
            if (flash) flash.style.opacity = '1';
            this.flashTimer = 0.18;
        }
    },

    shieldAttack(fighter, attack) {
        if (fighter.counterShieldTimer <= 0) return false;
        fighter.shieldStrength -= attack.move.power * (attack.move.damageScale || 1);
        this.spawnExplosion(fighter.x, fighter.y, '#a855f7');
        if (fighter.shieldStrength <= 0) {
            fighter.counterShieldTimer = 0;
            fighter.recoveryTimer = Math.max(fighter.recoveryTimer, 0.4);
            this.spawnFloatingText('SHIELD BROKEN', fighter.x, fighter.y - 45, '#ef4444');
            return false;
        }
        this.awardBond(12, 'COUNTER!', fighter);
        return true;
    },

    hitAttack(attack, target) {
        if (attack.hitTargets.has(target) || target.fainted) return false;
        attack.hitTargets.add(target);
        if (this.dodgeAttack(target)) {
            if (attack.owner === this.player) this.setAttackFeedback(`${target.name} dodged ${attack.move.name}.`);
            return false;
        }
        if (this.shieldAttack(target, attack)) {
            if (attack.owner === this.player) this.setAttackFeedback(`${target.name} countered ${attack.move.name}.`);
            return false;
        }
        return this.resolveHit(attack.owner, target, attack.move);
    },

    damagePillar(pillar, attack) {
        if (attack.pillarTargets.has(pillar)) return;
        attack.pillarTargets.add(pillar);
        attack.blockedByCover = true;
        pillar.hp -= attack.move.power * attack.move.profile.breakPower;
        if (attack.owner === this.player) this.setAttackFeedback(`${attack.move.name} hit rock cover${pillar.hp <= 0 ? ' — cover broken!' : '.'}`);
        this.spawnExplosion(pillar.x, pillar.y, '#a8a29e');
        if (pillar.hp <= 0) {
            SoundEngine.playSfx('rock_break');
            this.awardBond(10, 'COVER BROKEN!', attack.owner);
        }
    },

    traceTerrain(attack, ax, ay, bx, by, radius = 15) {
        for (const hazard of [...this.hazards]) {
            if (!attack.terrainTargets.has(hazard) &&
                segmentDistance(hazard.x, hazard.y, ax, ay, bx, by) < hazard.radius + radius) {
                attack.terrainTargets.add(hazard);
                this.reactTerrain(attack.move, hazard.x, hazard.y, attack.owner);
            }
        }
    },

    beamEnd(beam) {
        const range = beam.move.profile.range;
        return { x: beam.x + Math.cos(beam.angle) * range, y: beam.y + Math.sin(beam.angle) * range };
    },

    findBeamClashes() {
        for (let i = 0; i < this.beams.length; i++) for (let j = i + 1; j < this.beams.length; j++) {
            const a = this.beams[i], b = this.beams[j];
            if (a.expired || b.expired || a.clash || b.clash || a.isEnemy === b.isEnemy) continue;
            const ae = this.beamEnd(a), be = this.beamEnd(b);
            // Opposing rays must face each other and share a firing corridor.
            if (Math.cos(a.angle - b.angle) > -0.75 ||
                segmentDistance(b.x, b.y, a.x, a.y, ae.x, ae.y) > 45 ||
                segmentDistance(a.x, a.y, b.x, b.y, be.x, be.y) > 45 ||
                this.pillars.some(p => p.hp > 0 && segmentDistance(p.x, p.y, a.x, a.y, b.x, b.y) < p.radius)) continue;
            const clash = { a, b, timer: 0, meter: 0, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
            a.clash = clash; b.clash = clash;
            this.spawnFloatingText('BEAM CLASH! MOVE OR HOLD GUARD TO PUSH!', clash.x, clash.y - 40, '#facc15');
            this.logAnnouncer('Beam clash! Guard boosts pressure; moving away breaks the contest.', 'amber');
        }
    },

    updateClash(clash, dt) {
        const { a, b } = clash;
        clash.timer += dt;
        const strength = beam => beam.move.power * (beam.move.empowered ? 1.35 : 1) *
            (beam.owner.guarding ? 1.3 : 1) * (0.5 + beam.owner.stamina / 100);
        a.owner.stamina = Math.max(0, a.owner.stamina - 22 * dt);
        b.owner.stamina = Math.max(0, b.owner.stamina - 22 * dt);
        clash.meter += (strength(a) - strength(b)) * dt;
        const escapedA = distance(a.owner, a) > 80 || a.owner.fainted || a.owner !== (a.isEnemy ? this.enemy : this.player);
        const escapedB = distance(b.owner, b) > 80 || b.owner.fainted || b.owner !== (b.isEnemy ? this.enemy : this.player);
        if (!escapedA && !escapedB && Math.abs(clash.meter) < 35 && clash.timer < 1.2 &&
            a.owner.stamina > 0 && b.owner.stamina > 0) return;
        a.expired = true; b.expired = true;
        this.spawnExplosion(clash.x, clash.y, '#facc15');
        let winner = null;
        if (!escapedA && !escapedB) {
            if (a.owner.stamina <= 0) winner = b;
            else if (b.owner.stamina <= 0) winner = a;
            else if (Math.abs(clash.meter) > 8) winner = clash.meter > 0 ? a : b;
        }
        if (winner) {
            this.awardBond(20, 'CLASH WON!', winner.owner);
            const loser = winner === a ? b : a;
            const end = this.beamEnd(winner);
            if (segmentDistance(loser.owner.x, loser.owner.y, winner.x, winner.y, end.x, end.y) < 40)
                this.hitAttack({ ...winner, move: { ...winner.move, damageScale: 0.65 } }, loser.owner);
        }
    },

    updatePhysics(dt) {
        if (!this.player || !this.enemy) return;
        this.updateTransientVisuals(dt);
        // Bench timers and cooldowns advance too, but only active fighters regenerate stamina.
        for (const f of [...this.playerParty, ...this.enemyParty]) {
            for (const key of ['iFrames', 'perfectDodgeWindow', 'dodgeCooldown', 'counterShieldTimer',
                'counterCooldown', 'guardBreakTimer', 'recoveryTimer', 'switchCooldown', 'hitFlashTimer'])
                f[key] = Math.max(0, (f[key] || 0) - dt);
            f.moves.forEach(m => { m.cooldown = Math.max(0, m.cooldown - dt); });
            if (f.struggle) f.struggle.cooldown = Math.max(0, f.struggle.cooldown - dt);
        }
        this.advanceFighter(this.player, dt, false);
        this.advanceFighter(this.enemy, dt, true);
        if (this.queuedMove) {
            const queued = this.queuedMove;
            queued.remaining -= dt;
            if (queued.fighter !== this.player || this.player.fainted || queued.remaining <= 0 || !this.canCommand()) this.queuedMove = null;
            else {
                const target = this.aimMode === 'cursor' ? this.mouseWorld : this.enemy;
                if (target && this.beginAttack(this.player, queued.idx, target.x, target.y, false)) {
                    this.setAttackFeedback('Queued attack released!'); this.queuedMove = null;
                }
            }
        }
        this.updateProjectiles(dt);
        this.updateBeams(dt);
        this.updateWaves(dt);
        this.pillars = this.pillars.filter(p => p.hp > 0);
        this.updateTerrain(dt);
        if (this.overdriveTimer > 0) {
            this.overdriveTimer = Math.max(0, this.overdriveTimer - dt);
            if (!this.overdriveTimer) {
                this.signatureReady = false;
                document.getElementById('speedLinesOverlay').style.opacity = '0';
                this.updateHud();
            }
        }
    },

    updateTransientVisuals(dt) {
        this.moveAnimations?.update(dt);
        for (const pt of this.particles) {
            pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.z += pt.vz * dt; pt.vz -= 300 * dt;
            pt.life -= dt; pt.alpha = Math.max(0, pt.life / 0.6);
        }
        this.particles = this.particles.filter(pt => pt.life > 0 && pt.z >= 0);
        for (const ft of this.floatingTexts) {
            ft.y += ft.vy * dt; ft.life -= dt; ft.alpha = Math.max(0, ft.life / 0.85);
        }
        this.floatingTexts = this.floatingTexts.filter(ft => ft.life > 0);
    },

    advanceFighter(f, dt, isEnemy) {
        if (f.fainted) return;
        const target = isEnemy ? this.player : this.enemy;
        let mx = isEnemy ? this.ai.moveX : (this.keys.d || this.keys.arrowright ? 1 : 0) - (this.keys.a || this.keys.arrowleft ? 1 : 0);
        let my = isEnemy ? this.ai.moveY : (this.keys.s || this.keys.arrowdown ? 1 : 0) - (this.keys.w || this.keys.arrowup ? 1 : 0);
        if (!isEnemy && this.joyVec.active) { mx = this.joyVec.x; my = this.joyVec.y; }
        const moving = Math.hypot(mx || 0, my || 0);
        if (f.guarding) {
            f.stamina = Math.max(0, f.stamina - 13 * dt);
            if (f.stamina <= 0) this.breakGuard(f);
        } else if (!f.action && !f.blitzState && f.dashTimer <= 0 && f.counterShieldTimer <= 0)
            f.stamina = Math.min(100, f.stamina + (moving ? 6 : 14) * dt);
        const ice = this.hazards.some(h => h.type === 'ice' && distance(f, h) < h.radius && f.z < 30);
        const steam = this.hazards.some(h => h.type === 'steam' && distance(f, h) < h.radius);
        f.obscured = steam;
        if (f.status === 'FRZ' || f.guardBreakTimer > 0) { mx = 0; my = 0; }
        const speed = this.getFighterMoveSpeed(f) * (f.guarding ? 0.4 : f.action ? 0.45 : 1);
        const len = Math.hypot(mx || 0, my || 0);
        const tvx = len ? mx / Math.max(1, len) * speed : 0;
        const tvy = len ? my / Math.max(1, len) * speed : 0;
        const acceleration = (f.traits?.acceleration || 900) * (ice ? 0.2 : 1);
        const steering = 1 - Math.exp(-(f.traits?.turnRate || 7) * dt * (ice ? 0.3 : 1));
        f.vx += clamp((tvx - f.vx) * steering, -acceleration * dt, acceleration * dt);
        f.vy += clamp((tvy - f.vy) * steering, -acceleration * dt, acceleration * dt);
        const ox = f.x, oy = f.y;
        if (f.dashTimer > 0) {
            f.dashTimer = Math.max(0, f.dashTimer - dt);
            f.x += f.dashDirX * dt; f.y += f.dashDirY * dt;
        } else if (f.blitzState) {
            const b = f.blitzState;
            b.progress = Math.min(1, b.progress + dt / b.duration);
            f.x = b.startX + (b.targetX - b.startX) * b.progress;
            f.y = b.startY + (b.targetY - b.startY) * b.progress;
            if (Math.abs(f.z - target.z) < 45 &&
                segmentDistance(target.x, target.y, ox, oy, f.x, f.y) < target.radius + f.traits.reach)
                this.hitAttack(b, target);
            if (b.progress >= 1) { f.blitzState = null; f.recoveryTimer = b.move.profile.recovery; }
        } else { f.x += f.vx * dt; f.y += f.vy * dt; }
        for (const pillar of this.pillars) {
            if (pillar.hp <= 0 || f.z > pillar.height) continue;
            if (segmentDistance(pillar.x, pillar.y, ox, oy, f.x, f.y) < pillar.radius + f.radius) {
                if (f.blitzState) { this.damagePillar(pillar, f.blitzState); f.blitzState = null; f.recoveryTimer = 0.5; }
                const angle = Math.atan2(f.y - pillar.y, f.x - pillar.x);
                f.x = pillar.x + Math.cos(angle) * (pillar.radius + f.radius + 1);
                f.y = pillar.y + Math.sin(angle) * (pillar.radius + f.radius + 1);
                f.vx = 0; f.vy = 0;
            }
        }
        f.x = clamp(f.x, -this.WORLD_HALF_W + f.radius, this.WORLD_HALF_W - f.radius);
        f.y = clamp(f.y, -this.WORLD_HALF_H + f.radius, this.WORLD_HALF_H - f.radius);
        if (Math.abs(f.vx) > 20) f.facing = Math.sign(f.vx);
        const ascend = f.traits.airborne && (isEnemy ? this.ai.flying : this.keys.h || this.flyHeld);
        f.z = clamp(f.z + (ascend ? 90 : -120) * dt, 0, 85);
        if (ascend) f.stamina = Math.max(0, f.stamina - 8 * dt);
        if (f.stamina <= 0) f.z = Math.max(0, f.z - 180 * dt);
        if (f.action) {
            // Tracking stops before release, leaving a readable dodge opportunity.
            if (f.action.move.profile.tracking && f.action.timer > 0.15 && !target.obscured) {
                const a = Math.atan2(f.action.ty - f.y, f.action.tx - f.x);
                const desired = Math.atan2(target.y - f.y, target.x - f.x);
                const tracked = turnToward(a, desired, f.action.move.profile.tracking * dt);
                const range = Math.hypot(target.x - f.x, target.y - f.y);
                f.action.tx = f.x + Math.cos(tracked) * range;
                f.action.ty = f.y + Math.sin(tracked) * range;
            }
            f.action.timer -= dt;
            if (f.action.timer <= 0) {
                const action = f.action; f.action = null;
                this.releaseAttack(f, action);
            }
        }
        if (f.status) {
            f.statusTimer = Math.max(0, f.statusTimer - dt);
            f.statusTick -= dt;
            if (f.statusTick <= 0) {
                f.statusTick += 1;
                if (f.status === 'BRN' || f.status === 'PSN') this.environmentDamage(f, 3, f.status);
            }
            if (!f.statusTimer) f.status = null;
        }
    },

    updateProjectiles(dt) {
        for (const p of this.projectiles) {
            if (p.expired) continue;
            const target = p.isEnemy ? this.player : this.enemy;
            const profile = p.move.profile;
            if (profile.tracking && !target.obscured)
                p.angle = turnToward(p.angle, Math.atan2(target.y - p.y, target.x - p.x), profile.tracking * dt);
            p.vx = Math.cos(p.angle) * profile.speed; p.vy = Math.sin(p.angle) * profile.speed;
            const ox = p.x, oy = p.y;
            p.x += p.vx * dt; p.y += p.vy * dt; p.rangeLeft -= profile.speed * dt;
            this.traceTerrain(p, ox, oy, p.x, p.y, p.radius);
            // Cover is tested before fighters; swept segments prevent tunneling.
            const pillar = this.pillars.find(q => q.hp > 0 && p.z < q.height &&
                segmentDistance(q.x, q.y, ox, oy, p.x, p.y) < q.radius + p.radius);
            if (pillar) { this.damagePillar(pillar, p); p.expired = true; continue; }
            if (target.counterShieldTimer > 0 && Math.abs(target.z - p.z) < 50 &&
                segmentDistance(target.x, target.y, ox, oy, p.x, p.y) < 90 && this.shieldAttack(target, p)) {
                p.expired = true; continue;
            }
            if (Math.abs(target.z - p.z) < 40 &&
                segmentDistance(target.x, target.y, ox, oy, p.x, p.y) < target.radius + p.radius) {
                this.hitAttack(p, target); p.expired = true;
                this.spawnExplosion(p.x, p.y, color(p.move));
            }
            if (p.rangeLeft <= 0 || Math.abs(p.x) > this.WORLD_HALF_W + 50 || Math.abs(p.y) > this.WORLD_HALF_H + 50)
                p.expired = true;
        }
        for (let i = 0; i < this.projectiles.length; i++) for (let j = i + 1; j < this.projectiles.length; j++) {
            const a = this.projectiles[i], b = this.projectiles[j];
            if (a.expired || b.expired || a.isEnemy === b.isEnemy || Math.abs(a.z - b.z) > 30 || distance(a, b) > a.radius + b.radius) continue;
            const pa = a.move.power * (a.move.damageScale || 1), pb = b.move.power * (b.move.damageScale || 1);
            this.spawnExplosion((a.x + b.x) / 2, (a.y + b.y) / 2, '#facc15');
            if (pa > pb * 1.4) { b.expired = true; a.move.damageScale = (a.move.damageScale || 1) * 0.5; }
            else if (pb > pa * 1.4) { a.expired = true; b.move.damageScale = (b.move.damageScale || 1) * 0.5; }
            else { a.expired = true; b.expired = true; }
            this.awardBond(8, 'MOVE CLASH!', a.isEnemy ? b.owner : a.owner);
        }
        this.projectiles = this.projectiles.filter(p => !p.expired);
    },

    updateBeams(dt) {
        this.findBeamClashes();
        const clashes = new Set(this.beams.filter(b => b.clash && !b.expired).map(b => b.clash));
        for (const clash of clashes) this.updateClash(clash, dt);
        for (const b of this.beams) {
            if (b.expired || b.clash) continue;
            b.activeTimer -= dt;
            let end = this.beamEnd(b);
            const obstacles = this.pillars.filter(p => p.hp > 0 && b.z < p.height &&
                segmentDistance(p.x, p.y, b.x, b.y, end.x, end.y) < p.radius + b.move.profile.width / 2)
                .sort((a, c) => distance(a, b) - distance(c, b));
            if (obstacles[0]) {
                this.damagePillar(obstacles[0], b);
                end = { x: obstacles[0].x, y: obstacles[0].y };
            }
            b.endX = end.x; b.endY = end.y;
            this.traceTerrain(b, b.x, b.y, end.x, end.y, b.move.profile.width / 2);
            const target = b.isEnemy ? this.player : this.enemy;
            if (Math.abs(target.z - b.z) < 40 &&
                segmentDistance(target.x, target.y, b.x, b.y, end.x, end.y) < target.radius + b.move.profile.width / 2)
                this.hitAttack(b, target);
            for (const shot of this.projectiles) {
                if (shot.isEnemy !== b.isEnemy && Math.abs(shot.z - b.z) < 30 &&
                    segmentDistance(shot.x, shot.y, b.x, b.y, end.x, end.y) < shot.radius + b.move.profile.width / 2) {
                    shot.expired = true;
                    this.awardBond(4, null, b.owner);
                }
            }
            if (b.activeTimer <= 0) {
                b.expired = true;
                if (b.owner === this.player && b.hitTargets.size === 0 && !b.blockedByCover)
                    this.setAttackFeedback(`${b.move.name} missed. Aim ahead of a moving opponent.`);
            }
        }
        this.beams = this.beams.filter(b => !b.expired);
        this.projectiles = this.projectiles.filter(p => !p.expired);
    },

    updateWaves(dt) {
        for (const w of this.aoeWaves) {
            w.previousRadius = w.radius; w.radius += 260 * dt;
            w.alpha = Math.max(0, 1 - w.radius / w.maxRadius);
            const target = w.isEnemy ? this.player : this.enemy;
            const d = distance(w, target);
            if (d < w.radius + target.radius && d > w.previousRadius - target.radius &&
                (w.move.type !== 'ground' || target.z < 30) && Math.abs(target.z - w.z) < 50) {
                const covered = this.pillars.some(p => p.hp > 0 &&
                    segmentDistance(p.x, p.y, w.x, w.y, target.x, target.y) < p.radius && distance(p, w) < d);
                if (!covered) this.hitAttack(w, target);
            }
            for (const p of this.pillars) if (distance(p, w) < w.radius) this.damagePillar(p, w);
            for (const h of [...this.hazards]) if (!w.terrainTargets.has(h) && distance(h, w) < w.radius) {
                w.terrainTargets.add(h); this.reactTerrain(w.move, h.x, h.y, w.owner);
            }
            if (w.radius >= w.maxRadius) w.expired = true;
        }
        this.aoeWaves = this.aoeWaves.filter(w => !w.expired);
    },

    environmentDamage(f, amount, label) {
        if (f.fainted || f.iFrames > 0) return;
        f.currentHp = Math.max(0, f.currentHp - amount);
        this.spawnFloatingText(`${label} -${amount}`, f.x, f.y - 40, '#fb923c');
        if (f.currentHp <= 0) this.handleFaint(f);
        this.updateHud();
    },

    updateTerrain(dt) {
        for (const h of this.hazards) {
            h.timer -= dt; h.tick -= dt;
            if (h.tick > 0 || h.timer <= 0) continue;
            h.tick += 0.5;
            for (const f of [this.player, this.enemy]) {
                if (!f || f.z > 30 || distance(f, h) > h.radius + f.radius * 0.4) continue;
                if (h.type === 'magma' && !f.types.includes('fire')) this.environmentDamage(f, 4, 'HOT TURF');
                if (h.type === 'electrified_puddle' && !f.types.some(t => t === 'ground' || t === 'electric'))
                    this.environmentDamage(f, 5, 'CONDUCTIVE WATER');
            }
        }
        this.hazards = this.hazards.filter(h => h.timer > 0);
    },

    breakGuard(f) {
        f.guarding = false; f.guardBreakTimer = 0.85; f.recoveryTimer = 0.85;
        this.spawnFloatingText('GUARD BREAK!', f.x, f.y - 45, '#ef4444');
    },

    resolveHit(attacker, defender, move) {
        if (!attacker || defender.fainted) return false;
        const effectiveness = move.typeless ? 1 : typeEffectiveness(TYPE_CHART, move.type, defender.types);
        if (!effectiveness) {
            this.moveAnimations?.impact(move, defender.x, defender.y, defender.z, { effectiveness: 0 });
            this.spawnFloatingText('NO EFFECT', defender.x, defender.y - 40, '#94a3b8');
            if (attacker === this.player) this.setAttackFeedback(`No effect! ${defender.name} is immune to ${move.type} attacks (×0).`);
            return false;
        }
        if (Math.random() * 100 >= (move.accuracy ?? 100)) {
            this.spawnFloatingText('MISS', defender.x, defender.y - 40, '#94a3b8');
            if (attacker === this.player) this.setAttackFeedback(`${move.name} missed its accuracy check.`);
            return false;
        }
        // Status moves affect ailments instead of being converted into physical damage.
        const special = move.damageClass === 'special';
        const atk = special ? attacker.stats.spAtk : attacker.stats.attack * (attacker.status === 'BRN' ? 0.75 : 1);
        const def = special ? defender.stats.spDef : defender.stats.defense;
        const stab = !move.typeless && attacker.types.includes(move.type) ? 1.5 : 1;
        const base = ((2 * attacker.level / 5 + 2) * (move.power || 0) * atk / def) / 50 + 2;
        let damage = move.damageClass === 'status' ? 0 : Math.max(1, Math.floor(base * stab * effectiveness *
            (0.9 + Math.random() * 0.2) * (move.damageScale || 1) * (move.overdrive ? 1.2 : 1) * (move.empowered ? 1.25 : 1)));
        const wasGuarded = defender.guarding;
        if (wasGuarded) {
            defender.stamina = Math.max(0, defender.stamina - Math.max(8, damage * 0.65));
            damage = Math.floor(damage * 0.35);
            if (!defender.stamina) this.breakGuard(defender);
            else this.awardBond(4, 'GUARDED', defender);
        }
        defender.currentHp = Math.max(0, defender.currentHp - damage);
        const effectivenessText = move.damageClass === 'status' ? '' : effectiveness > 1 ? ` Super effective! (×${effectiveness})` : effectiveness < 1 ? ` Not very effective… (×${effectiveness})` : '';
        if (attacker === this.player) this.setAttackFeedback(`${move.name} hit ${defender.name} for ${damage} damage${wasGuarded ? ' (guarded)' : ''}.${effectivenessText}`);
        if (damage > 0) {
            this.moveAnimations?.impact(move, defender.x, defender.y, defender.z, {
                guarded: wasGuarded, effectiveness,
                angle: Math.atan2(defender.y - attacker.y, defender.x - attacker.x)
            });
            if (!this.reducedMotion && !wasGuarded) this.hitStopTimer = Math.max(this.hitStopTimer || 0, effectiveness > 1 ? 0.055 : 0.025);
        }
        defender.hitFlashTimer = 0.16;
        const profile = move.profile || moveProfile(move);
        const angle = Math.atan2(defender.y - attacker.y, defender.x - attacker.x);
        const force = profile.knockback / (defender.traits?.mass || 1) * (wasGuarded ? 0.25 : 1);
        defender.vx += Math.cos(angle) * force; defender.vy += Math.sin(angle) * force;
        if (damage > 0 && !wasGuarded && defender.action) {
            defender.action = null; defender.recoveryTimer = Math.max(defender.recoveryTimer, 0.25);
            this.awardBond(10, 'CHARGE INTERRUPTED!', attacker);
        }
        const counter = defender.recoveryTimer > 0 && !wasGuarded;
        this.awardBond(counter ? 8 : 3, counter ? 'OPENING PUNISHED!' : null, attacker);
        this.reactTerrain(move, defender.x, defender.y, attacker);
        if (!defender.status && move.ailment && Math.random() * 100 < (move.ailmentChance || 0) &&
            !(move.ailment === 'BRN' && defender.types.includes('fire')) &&
            !(move.ailment === 'FRZ' && defender.types.includes('ice')) &&
            !(move.ailment === 'PSN' && defender.types.some(t => t === 'poison' || t === 'steel')) &&
            !(move.ailment === 'PAR' && defender.types.includes('electric'))) {
            defender.status = move.ailment; defender.statusTimer = move.ailment === 'FRZ' ? 1.2 : 8;
            defender.statusTick = 1;
            if (defender.status === 'FRZ') { defender.action = null; defender.blitzState = null; }
        }
        if (damage > 0 && !wasGuarded && !this.reducedMotion) {
            this.camera.shakeTimer = effectiveness > 1 ? 0.14 : 0.09;
            this.camera.shakeMagnitude = Math.min(2.5, damage / 18);
        }
        SoundEngine.playSfx(effectiveness > 1 ? 'hit_super' : 'hit_normal');
        this.spawnFloatingText(`-${damage}`, defender.x, defender.y - 45, effectiveness > 1 ? '#f87171' : '#f8fafc');
        this.logAnnouncer(`${attacker.name}: ${move.name} hits ${defender.name} for ${damage}${effectiveness > 1 ? ' — super effective!' : ''}`, defender === this.player ? 'red' : 'cyan');
        if (defender.currentHp <= 0) this.handleFaint(defender);
        if (move.slug === 'struggle') this.environmentDamage(attacker, Math.ceil(attacker.maxHp * 0.04), 'RECOIL');
        this.updateHud();
        return true;
    },

    handleFaint(f) {
        if (f.fainted) return;
        if (!this.reducedMotion) this.presentation?.pulse(0.03, 0.65);
        this.spriteAnimator?.depart(f, 'faint');
        f.fainted = true; f.action = null; f.blitzState = null; f.guarding = false;
        SoundEngine.playCry(f.cry);
        this.logAnnouncer(`${f.name} has fainted!`, 'red');
        if (this.playerParty.includes(f)) {
            const idx = this.playerParty.findIndex(pk => !pk.fainted);
            if (idx < 0) this.endMatch(false);
            else this.switchPokemon(idx, true);
        } else {
            const idx = this.enemyParty.findIndex(pk => !pk.fainted);
            if (idx < 0) this.endMatch(true);
            else {
                this.enemyActiveIdx = idx;
                this.enemy.x = f.x; this.enemy.y = f.y;
                this.enemy.recoveryTimer = 0.3;
                this.enemy.z = 0; this.enemy.vx = 0; this.enemy.vy = 0;
                this.spriteAnimator?.sendOut(this.enemy, RECALL_DURATION);
                this.updateHud();
                this.logAnnouncer(`${this.enemyTrainer} sends out ${this.enemy.name}!`, 'red');
            }
        }
    },

    updateAi(dt) {
        const f = this.enemy, p = this.player;
        if (!f || !p || f.fainted || this.matchOver) return;
        const dist = distance(f, p);
        const angle = Math.atan2(p.y - f.y, p.x - f.x);
        const threat = this.beams.find(b => !b.isEnemy && !b.expired &&
            segmentDistance(f.x, f.y, b.x, b.y, this.beamEnd(b).x, this.beamEnd(b).y) < 55) ||
            (p.action && p.action.timer < 0.3 ? p.action : null) ||
            this.projectiles.find(s => !s.isEnemy && distance(s, f) < 150);
        this.ai.thinkTimer -= dt;
        this.ai.attackCooldown = Math.max(0, this.ai.attackCooldown - dt);
        if (this.ai.thinkTimer > 0) return;
        this.ai.thinkTimer = 0.16 + Math.random() * 0.12;
        this.setGuard(false, f);
        this.ai.flying = f.traits.airborne && f.stamina > 35 && (threat || p.moves.some(m => m.type === 'ground'));
        const dangerous = this.hazards.find(h => (h.type === 'magma' && !f.types.includes('fire') ||
            h.type === 'electrified_puddle' && !f.types.some(t => t === 'ground' || t === 'electric')) && distance(f, h) < h.radius + 40);
        const clash = this.beams.find(b => b.owner === f && b.clash);
        if (clash) { this.setGuard(true, f); this.ai.moveX = 0; this.ai.moveY = 0; this.ai.state = 'CLASH'; return; }
        if (dangerous) {
            const escape = Math.atan2(f.y - dangerous.y, f.x - dangerous.x);
            this.ai.moveX = Math.cos(escape); this.ai.moveY = Math.sin(escape); this.ai.state = 'ESCAPE TERRAIN';
            return;
        }
        if (threat && f.stamina > 25 && Math.random() < 0.7) {
            const dx = -Math.sin(angle), dy = Math.cos(angle);
            if (this.triggerDodgeDash(f, { x: dx, y: dy })) {
                this.ai.moveX = dx; this.ai.moveY = dy; this.ai.state = 'EVADE';
                return;
            }
        }
        if (threat && f.stamina > 35) this.triggerCounterShield(f);
        if (threat && f.counterShieldTimer <= 0 && f.stamina > 8) this.setGuard(true, f);
        const cover = f.stamina < 30 && this.pillars.find(q => q.hp > 0);
        let destination = null;
        if (cover) destination = { x: cover.x - Math.cos(angle) * 85, y: cover.y - Math.sin(angle) * 85 };
        const wet = this.hazards.find(h => h.type === 'puddle' && distance(p, h) < h.radius + 60);
        const pool = f.moves.every(m => m.pp <= 0)
            ? [{ m: this.struggleMove(f), idx: -1 }]
            : f.moves.map((m, idx) => ({ m, idx }));
        const ready = pool.map(v => ({ ...v, profile: moveProfile(v.m) }))
            .filter(({ m, profile }) => m.pp > 0 && m.cooldown <= 0 && f.stamina >= profile.stamina)
            .sort((a, b) => {
                const score = v => typeEffectiveness(TYPE_CHART, v.m.type, p.types) * v.m.power +
                    (wet && v.m.type === 'electric' ? 80 : 0) +
                    (p.recoveryTimer > 0 && v.m.archetype === 'BLITZ' ? 40 : 0) - Math.max(0, dist - v.profile.range);
                return score(b) - score(a);
            });
        const chosen = ready[0];
        const desired = chosen?.m.archetype === 'BLITZ' ? 110 : chosen?.m.archetype === 'AOE' ? 150 : 280;
        let heading = angle;
        this.ai.state = 'APPROACH';
        if (destination) { heading = Math.atan2(destination.y - f.y, destination.x - f.x); this.ai.state = 'COVER'; }
        else if (dist < desired - 50) { heading += Math.PI; this.ai.state = 'RETREAT'; }
        else if (dist < desired + 60) { heading += Math.PI / 2 * this.ai.strafeDir; this.ai.state = 'STRAFE'; }
        this.ai.moveX = Math.cos(heading); this.ai.moveY = Math.sin(heading);
        // Walk around blocking pillars rather than repeatedly charging straight into them.
        if (this.pillars.some(q => q.hp > 0 && distance(f, q) < 100 &&
            segmentDistance(q.x, q.y, f.x, f.y, f.x + this.ai.moveX * 100, f.y + this.ai.moveY * 100) < q.radius + f.radius)) {
            this.ai.moveX = -Math.sin(heading); this.ai.moveY = Math.cos(heading);
        }
        if (cover && distance(f, destination) < 30) { this.ai.moveX = 0; this.ai.moveY = 0; }
        if (chosen && !this.ai.attackCooldown && dist < chosen.profile.range + 10 && !p.obscured &&
            (chosen.m.typeless || typeEffectiveness(TYPE_CHART, chosen.m.type, p.types) > 0)) {
            const predictiveX = p.x + p.vx * chosen.profile.charge * 0.5;
            const predictiveY = p.y + p.vy * chosen.profile.charge * 0.5;
            if (this.beginAttack(f, chosen.idx, predictiveX, predictiveY, true)) {
                this.ai.attackCooldown = 0.7 + Math.random() * 0.7; this.ai.state = 'ATTACK';
            }
        }
    },

    renderCombatTelegraphs(ctx) {
        for (const f of [this.player, this.enemy]) {
            if (!f || f.fainted) continue;
            const base = this.worldToScreen(f.x, f.y);
            ctx.save();
            const shadow = shadowShape(this.getFighterSpriteSize?.(f) || 48, f.z);
            const entering = this.spriteAnimator?.events.get(f);
            const visible = !this.spriteAnimator?.hidden.has(f) && (!entering?.ball || this.spriteAnimator.time >= entering.start + 1.1);
            if (visible) {
                const gradient = ctx.createRadialGradient(base.x, base.y, 0, base.x, base.y, shadow.width);
                gradient.addColorStop(0, `rgba(4,15,24,${shadow.opacity})`); gradient.addColorStop(1, 'rgba(4,15,24,0)');
                ctx.fillStyle = gradient; ctx.beginPath(); ctx.ellipse(base.x, base.y, shadow.width, shadow.height, 0, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = `rgba(3,12,22,${shadow.opacity * 0.5})`;
                ctx.beginPath(); ctx.ellipse(base.x, base.y, shadow.width * 0.48, shadow.height * 0.55, 0, 0, Math.PI * 2); ctx.fill();
            }
            ctx.strokeStyle = f === this.player ? 'rgba(67,221,244,.6)' : 'rgba(247,112,114,.5)';
            ctx.lineWidth = 1.5;
            traceGroundCircle(ctx, this, f.x, f.y, f.radius * 1.25); ctx.stroke();
            const scr = this.worldToScreen(f.x, f.y, f.z + 28);
            if (f.counterShieldTimer > 0 || f.guarding) {
                ctx.strokeStyle = f.guarding ? '#facc15' : '#c084fc';
                ctx.lineWidth = 3;
                ctx.beginPath(); ctx.arc(scr.x, scr.y, (f.guarding ? 43 : 75) * scr.scale, 0, Math.PI * 2); ctx.stroke();
            }
            if (f.action) {
                const { move, tx, ty, timer } = f.action;
                const profile = move.profile;
                ctx.strokeStyle = f === this.enemy ? '#fb7185' : color(move);
                ctx.lineWidth = 2; ctx.setLineDash([6, 5]);
                if (move.archetype === 'AOE') {
                    traceGroundCircle(ctx, this, f.x, f.y, profile.range); ctx.stroke();
                } else {
                    const angle = Math.atan2(ty - f.y, tx - f.x);
                    const end = this.worldToScreen(f.x + Math.cos(angle) * profile.range, f.y + Math.sin(angle) * profile.range, f.z + 18);
                    ctx.beginPath(); ctx.moveTo(scr.x, scr.y); ctx.lineTo(end.x, end.y); ctx.stroke();
                }
                ctx.setLineDash([]); ctx.lineWidth = 4;
                ctx.beginPath(); ctx.arc(scr.x, scr.y, 45 * scr.scale, -Math.PI / 2,
                    -Math.PI / 2 + Math.PI * 2 * clamp(1 - timer / profile.charge, 0, 1)); ctx.stroke();
            }
            ctx.restore();
        }
        const seen = new Set();
        for (const beam of this.beams) if (beam.clash && !seen.has(beam.clash)) {
            const clash = beam.clash; seen.add(clash);
            const scr = this.worldToScreen(clash.x, clash.y, beam.z);
            ctx.save(); ctx.fillStyle = '#facc15'; ctx.shadowColor = '#facc15'; ctx.shadowBlur = 20;
            ctx.beginPath(); ctx.arc(scr.x, scr.y, 18 + Math.sin(this.matchElapsed * 30) * 4, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0; ctx.fillStyle = '#0f172a'; ctx.fillRect(scr.x - 45, scr.y - 40, 90, 7);
            ctx.fillStyle = '#38bdf8';
            const playerMeter = clash.a.isEnemy ? -clash.meter : clash.meter;
            ctx.fillRect(scr.x - 45, scr.y - 40, 90 * clamp(0.5 + playerMeter / 70, 0, 1), 7);
            ctx.restore();
        }
    },
};
