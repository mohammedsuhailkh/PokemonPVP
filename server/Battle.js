import { BattleSimulation } from '../src/game/BattleSimulation.js';
import { SENDOUT_DURATION, RECALL_DURATION } from '../src/game/BattleTimings.js';
import { readFileSync } from 'node:fs';
export const catalog = JSON.parse(readFileSync(new URL('./data/catalog.json', import.meta.url)));

export function validateTeam(team) {
    if (!Array.isArray(team) || team.length !== 3 || team.some(id => !Number.isInteger(id) || !catalog[id])) throw new Error('Choose three Pokémon from the PvP roster.');
    if (new Set(team).size !== 3) throw new Error('Choose three different Pokémon.');
    return [...team];
}

function wireAttack(a) {
    if (!a) return null;
    const out = {};
    for (const [key, value] of Object.entries(a)) if (value === null || ['number', 'string', 'boolean'].includes(typeof value)) out[key] = value;
    out.move = a.move; out.ownerId = a.owner?.uid;
    if (a.visualOrigin) out.visualOrigin = a.visualOrigin;
    if (a.clash) out.clash = { x: a.clash.x, y: a.clash.y, meter: a.clash.meter || 0, a: { isEnemy: !!a.clash.a?.isEnemy } };
    return out;
}

export class Battle {
    constructor(teams, stadium = 'grassy', names = ['Trainer 1', 'Trainer 2']) {
        this.teams = teams.map((team, side) => validateTeam(team).map((id, index) => ({ ...structuredClone(catalog[id]), uid: `${side}:${index}`, side })));
        this.active = [0, 0]; this.inputs = [{}, {}]; this.bonds = [0, 0]; this.bursts = [0, 0]; this.signatures = [false, false];
        this.currentStadium = stadium; this.playerTrainer = names[0]; this.enemyTrainer = names[1];
        this.WORLD_HALF_W = 470; this.WORLD_HALF_H = 255;
        this.keys = {}; this.joyVec = { active: false }; this.ai = {}; this.camera = {};
        this.projectiles = []; this.beams = []; this.aoeWaves = []; this.hazards = []; this.pillars = [];
        this.particles = []; this.floatingTexts = []; this.bondSync = 0; this.overdriveTimer = 0;
        this.matchElapsed = 0; this.time = 0; this.pauseUntil = 0; this.loading = true; this.paused = false; this.matchOver = false;
        this.eventId = 0; this.events = [];
        const self = this;
        this.spriteAnimator = {
            get busy() { return self.time < self.pauseUntil; },
            depart(f, state) { self.emit('recall', { id: f.uid, defeated: state === 'faint' }); self.pauseUntil = Math.max(self.pauseUntil, self.time + RECALL_DURATION); },
            sendOut(f, delay = 0) { self.emit('sendout', { id: f.uid, delay }); self.pauseUntil = Math.max(self.pauseUntil, self.time + delay + SENDOUT_DURATION); },
            play(f, state, duration, target) { self.emit('pose', { id: f.uid, state, duration, target }); }
        };
        this.moveAnimations = { update() {}, impact: (move, x, y, z, feedback) => this.emit('impact', { move, x, y, z, feedback }) };
        this.audio = { playSfx: sound => this.emit('sound', { sound }), playCry() {} };
        this.presentation = { pulse: (strength, duration) => this.emit('camera', { strength, duration }) };
        this.player.x = -240; this.player.y = 30; this.player.facing = 1;
        this.enemy.x = 240; this.enemy.y = -30; this.enemy.facing = -1;
        this.resetBattlefield();
    }
    get playerParty() { return this.teams[0]; } get enemyParty() { return this.teams[1]; }
    get playerActiveIdx() { return this.active[0]; } get enemyActiveIdx() { return this.active[1]; }
    get player() { return this.teams[0][this.active[0]]; } get enemy() { return this.teams[1][this.active[1]]; }
    emit(type, payload) { this.events.push({ seq: ++this.eventId, type, ...payload }); if (this.events.length > 120) this.events.shift(); }
    start() { this.loading = false; this.spriteAnimator.sendOut(this.player); this.spriteAnimator.sendOut(this.enemy); }
    updateHud() {} renderMovesDeck() {} renderPartySwitchBar() {} setKeyVisual() {} clearInput() { this.inputs[0] = {}; this.inputs[1] = {}; this.queuedMove = null; }
    triggerAnimeCallout(trainer, message, color) { this.emit('callout', { trainer, message, color }); }
    captureVisualOrigin(f, x, y) { return f ? { x, y, z: f.z, id: f.id, speciesId: f.speciesId, height: f.height } : null; }
    setAttackFeedback() {} spawnExplosion() {}
    spawnFloatingText(text, x, y, color) { this.emit('text', { text, x, y, color }); }
    logAnnouncer(text, color) { this.emit('log', { text, color }); }
    awardBond(amount, reason, fighter = this.player) {
        if (!this.bursts[fighter.side]) this.bonds[fighter.side] = Math.min(100, this.bonds[fighter.side] + amount);
        if (reason) this.spawnFloatingText(reason, fighter.x, fighter.y - 55, '#facc15');
    }
    fighterOverdrive(f) { return this.bursts[f.side] > 0; }
    fighterEmpowered(f) { return this.fighterOverdrive(f) && this.signatures[f.side]; }
    consumeSignature(f) { this.signatures[f.side] = false; }
    getFighterMoveSpeed(f) { return (160 + f.stats.speed * 0.9) * (f.status === 'PAR' ? 0.5 : 1) * (this.bursts[f.side] > 0 ? 1.25 : 1); }
    command(side, message) {
        const f = this.teams[side][this.active[side]], target = side ? this.player : this.enemy;
        if (!this.canCommand(f)) return false;
        if (message.action === 'move' && Number.isInteger(message.index) && ((message.index >= 0 && message.index < 4) || (message.index === -1 && f.moves.every(m => m.pp <= 0)))) {
            const aim = message.aim && Number.isFinite(message.aim.x) && Number.isFinite(message.aim.y) ? { x: Math.max(-470, Math.min(470, message.aim.x)), y: Math.max(-255, Math.min(255, message.aim.y)) } : target;
            return this.beginAttack(f, message.index, aim.x, aim.y, side === 1);
        }
        if (message.action === 'dodge') return this.triggerDodgeDash(f, { x: this.inputs[side].x || 0, y: this.inputs[side].y || 0 });
        if (message.action === 'shield') return this.triggerCounterShield(f);
        if (message.action === 'switch') return this.switchSide(side, message.index);
        if (message.action === 'overdrive' && this.bonds[side] >= 100 && !this.bursts[side]) { this.bonds[side] = 0; this.bursts[side] = 12; this.signatures[side] = true; }
        return false;
    }
    switchSide(side, index, forced = false) {
        const old = this.teams[side][this.active[side]], next = this.teams[side][index];
        if (!Number.isInteger(index) || !next || next.fainted || next === old || (!forced && (!this.canCommand(old) || old.action || old.blitzState || old.switchCooldown > 0))) return false;
        if (!old.fainted) this.spriteAnimator.depart(old, 'recall');
        this.active[side] = index; this.clearInput();
        old.action = null; old.blitzState = null; old.guarding = false;
        Object.assign(next, { x: old.x, y: old.y, z: 0, vx: 0, vy: 0, facing: side ? -1 : 1, switchCooldown: 1.5, recoveryTimer: 0.3 });
        this.spriteAnimator.sendOut(next, RECALL_DURATION); return true;
    }
    handleFaint(f) {
        if (f.fainted) return;
        this.spriteAnimator.depart(f, 'faint'); f.fainted = true; f.action = null; f.blitzState = null; f.guarding = false;
        this.presentation.pulse(0.03, 0.65);
        const next = this.teams[f.side].findIndex(pk => !pk.fainted);
        if (next < 0) this.finish(1 - f.side); else this.switchSide(f.side, next, true);
    }
    finish(winner, reason = 'knockout') { if (this.matchOver) return; this.matchOver = true; this.winner = winner; this.emit('result', { winner, reason }); }
    step(dt) {
        if (this.paused || this.loading) return;
        this.time += dt;
        if (this.matchOver || this.spriteAnimator.busy) return;
        const a = this.inputs[0], b = this.inputs[1];
        this.keys = { d: a.x > 0, a: a.x < 0, s: a.y > 0, w: a.y < 0, h: a.fly };
        this.joyVec = { active: true, x: a.x || 0, y: a.y || 0 };
        this.ai = { moveX: b.x || 0, moveY: b.y || 0, flying: b.fly };
        this.setGuard(a.guard, this.player); this.setGuard(b.guard, this.enemy);
        this.updatePhysics(dt); this.matchElapsed += dt;
        this.bursts = this.bursts.map(n => Math.max(0, n - dt));
    }
    snapshot(compact = false) {
        return { time: this.time, elapsed: this.matchElapsed, loading: this.loading, locked: this.spriteAnimator.busy,
            active: this.active, bonds: this.bonds, bursts: this.bursts, stadium: this.currentStadium, matchOver: this.matchOver, winner: this.winner,
            teams: this.teams.map(team => team.map(f => compact ? {
                ...Object.fromEntries(['uid', 'side', 'currentHp', 'status', 'statusTimer', 'stamina', 'fainted', 'x', 'y', 'z', 'vx', 'vy', 'vz', 'facing', 'iFrames', 'dashTimer', 'guarding', 'guardBreakTimer', 'counterShieldTimer', 'counterCooldown', 'dodgeCooldown', 'recoveryTimer', 'switchCooldown', 'hitFlashTimer', 'action'].map(key => [key, f[key]])),
                moves: f.moves.map(m => ({ pp: m.pp, cooldown: m.cooldown })), struggle: f.struggle || null, blitzState: wireAttack(f.blitzState)
            } : { ...f, blitzState: wireAttack(f.blitzState) })),
            projectiles: this.projectiles.map(wireAttack), beams: this.beams.map(wireAttack), aoeWaves: this.aoeWaves.map(wireAttack),
            hazards: this.hazards.map(h => ({ ...h, timer: Number.isFinite(h.timer) ? h.timer : -1 })), pillars: this.pillars, eventId: this.eventId, events: this.events };
    }
}
// Keep the exact offline collision, damage, cooldown, terrain and movement rules.
for (const [name, method] of Object.entries(BattleSimulation)) if (!(name in Battle.prototype)) Battle.prototype[name] = method;
