import { SoundEngine } from './SoundEngine.js';

export class PvpClient extends EventTarget {
    constructor() { super(); this.active = false; this.status = 'offline'; this.room = null; this.fighters = new Map(); this.lastEvent = 0; this.ping = 0; this.revision = 0; }
    changed() { this.dispatchEvent(new Event('change')); }
    send(message) { if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message)); }
    connect(message) {
        if (this.socket) { this.socket.onclose = null; this.socket.close(); }
        this.intent = message; this.status = 'connecting'; this.error = ''; this.active = true; this.changed();
        const socket = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`);
        this.socket = socket;
        socket.onopen = () => { if (this.socket === socket) this.send(this.intent); };
        socket.onmessage = async event => {
            if (this.socket !== socket) return;
            try {
                const m = JSON.parse(event.data);
                if (m.type === 'error') {
                    this.error = m.message; this.status = 'error';
                    if (this.intent.type === 'resume') { this.credentials = null; this.room = null; sessionStorage.removeItem('pvp-session'); window.dispatchEvent(new Event('pvp:lobby')); }
                    this.changed(); return;
                }
                if (m.type === 'joined') { this.credentials = { code: m.code, token: m.token }; this.side = m.side; sessionStorage.setItem('pvp-session', JSON.stringify(this.credentials)); this.game.online = this; }
                if (m.type === 'room') {
                    this.room = m; this.status = m.phase;
                    if (m.phase === 'lobby') { document.getElementById('resultModal')?.classList.add('hidden'); window.dispatchEvent(new Event('pvp:lobby')); }
                    this.changed();
                }
                if (m.type === 'init') await this.initialize(m);
                if (m.type === 'state' && !this.initializing) { this.disconnected = m.disconnected; this.receive(m.state); }
                if (m.type === 'pong') { this.ping = Math.round(performance.now() - m.time); this.changed(); }
            } catch (error) { this.error = `Online battle could not load: ${error.message}`; this.status = 'error'; this.changed(); }
        };
        socket.onclose = () => {
            if (this.socket !== socket || !this.active) return;
            this.disconnected = true; this.status = 'reconnecting'; this.game?.clearInput(); this.changed();
            if (this.credentials && this.status !== 'error') this.retry = setTimeout(() => this.connect({ type: 'resume', ...this.credentials }), 1200);
            else { this.status = 'error'; this.error = 'Cannot reach the PvP server. Please try again.'; this.changed(); }
        };
        socket.onerror = () => {};
    }
    restore(game) {
        this.game = game;
        try { const credentials = JSON.parse(sessionStorage.getItem('pvp-session')); if (credentials) { this.credentials = credentials; this.connect({ type: 'resume', ...credentials }); } } catch {}
    }
    async initialize(message) {
        const revision = ++this.revision; this.initializing = true; this.side = message.side;
        const g = this.game; g.online = this; g.loading = true; ++g.matchRequestId;
        document.getElementById('loadingOverlay')?.classList.remove('hidden');
        this.fighters.clear(); this.lastEvent = message.resume ? message.state.eventId : 0;
        const fighters = message.state.teams.flat();
        await Promise.all([g.prepareCombatantSprites(fighters), g.spriteAnimator.prepare(fighters), g.moveAnimations.preload()]);
        if (!this.active || revision !== this.revision) return;
        g.spriteAnimator.clear(); g.presentation.clear(); g.moveAnimations.clear(); g.clearInput();
        g.projectiles = []; g.beams = []; g.aoeWaves = []; g.particles = []; g.floatingTexts = []; g.pendingResult = null;
        g.playerTrainer = message.names[this.side]; g.enemyTrainer = message.names[1 - this.side];
        document.getElementById('playerTrainerLabel').textContent = `${g.playerTrainer} (YOU)`;
        document.getElementById('enemyTrainerLabel').textContent = g.enemyTrainer;
        this.applying = true; g.setStadium(message.state.stadium); this.applying = false;
        window.dispatchEvent(new CustomEvent('stadiumchange', { detail: message.state.stadium }));
        g.matchOver = false; g.loading = false; g.paused = false; g.moveDeckOwner = null;
        document.getElementById('resultModal')?.classList.add('hidden'); document.getElementById('announcerLog')?.replaceChildren();
        this.initializing = false; this.receive(message.state, true);
        document.getElementById('loadingOverlay')?.classList.add('hidden');
        window.dispatchEvent(new Event('pvp:start')); this.send({ type: 'loaded' }); this.changed();
    }
    receive(state, initial = false) {
        if (!this.active) return;
        const g = this.game; this.state = state; this.receivedAt = performance.now();
        const teams = state.teams.map(team => team.map(wire => {
            let fighter = this.fighters.get(wire.uid);
            if (!fighter) { fighter = { ...wire }; this.fighters.set(wire.uid, fighter); }
            const position = { x: fighter.x, y: fighter.y, z: fighter.z };
            const moves = wire.moves.map((move, i) => ({ ...fighter.moves[i], ...move }));
            Object.assign(fighter, wire, { moves });
            fighter.presentationSide = wire.side === this.side ? 'player' : 'enemy';
            fighter.targetPosition = { x: wire.x, y: wire.y, z: wire.z };
            if (!initial) Object.assign(fighter, position);
            return fighter;
        }));
        const attack = wire => wire ? { ...wire, owner: this.fighters.get(wire.ownerId), isEnemy: !!wire.isEnemy !== !!this.side,
            clash: wire.clash ? { ...wire.clash, a: { isEnemy: !!wire.clash.a?.isEnemy !== !!this.side } } : null } : null;
        teams.flat().forEach(f => { f.blitzState = attack(f.blitzState); });
        g.playerParty = teams[this.side]; g.enemyParty = teams[1 - this.side];
        g.playerActiveIdx = state.active[this.side]; g.enemyActiveIdx = state.active[1 - this.side];
        g.projectiles = state.projectiles.map(attack); g.beams = state.beams.map(attack); g.aoeWaves = state.aoeWaves.map(attack);
        g.hazards = state.hazards.map(h => ({ ...h, timer: h.timer === -1 ? Infinity : h.timer })); g.pillars = state.pillars;
        g.matchElapsed = state.elapsed; g.bondSync = state.bonds[this.side]; g.overdriveTimer = state.bursts[this.side];
        for (const event of state.events) {
            if (event.seq <= this.lastEvent) continue;
            this.lastEvent = event.seq;
            const f = this.fighters.get(event.id);
            if (event.type === 'recall' && f) g.spriteAnimator.depart(f, event.defeated ? 'faint' : 'recall');
            if (event.type === 'sendout' && f) g.spriteAnimator.sendOut(f, event.delay);
            if (event.type === 'pose' && f) g.spriteAnimator.play(f, event.state, event.duration, event.target);
            if (event.type === 'impact') {
                g.moveAnimations.impact(event.move, event.x, event.y, event.z, event.feedback);
                if (!g.reducedMotion && event.feedback?.effectiveness !== 0 && !event.feedback?.guarded) { g.camera.shakeTimer = 0.1; g.camera.shakeMagnitude = Math.min(2.5, (event.move.power || 0) / 50); }
            }
            if (event.type === 'camera' && !g.reducedMotion) g.presentation.pulse(event.strength, event.duration);
            if (event.type === 'callout') g.triggerAnimeCallout(event.trainer, event.message, event.color);
            if (event.type === 'sound') SoundEngine.playSfx(event.sound);
            if (event.type === 'text') g.spawnFloatingText(event.text, event.x, event.y, event.color);
            if (event.type === 'log') g.logAnnouncer(event.text, event.color);
        }
        if (state.matchOver && !g.matchOver) g.endMatch(state.winner === this.side);
        g.updateHud(); g.renderMovesDeck(); g.renderPartySwitchBar(); g.updateActors();
    }
    command(action, extra = {}) { if (this.status === 'battle' && !this.disconnected) this.send({ type: 'command', action, ...extra }); return true; }
    tick(dt) {
        const g = this.game; if (!this.active || this.initializing || !this.state) return;
        this.inputClock = (this.inputClock || 0) + dt; this.pingClock = (this.pingClock || 0) + dt;
        const keys = g.keys, joy = g.joyVec;
        const enabled = !g.paused && !g.matchOver && !g.spriteAnimator.busy && !this.state.locked && !this.disconnected;
        const input = { type: 'input', x: enabled ? joy.active ? joy.x : (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0) : 0,
            y: enabled ? joy.active ? joy.y : (keys.s || keys.arrowdown ? 1 : 0) - (keys.w || keys.arrowup ? 1 : 0) : 0,
            guard: enabled && !!(this.guardHeld || keys.q), fly: enabled && !!(keys.h || g.flyHeld) };
        if (this.inputClock >= 0.05) { this.inputClock = 0; this.send(input); }
        if (this.pingClock >= 3) { this.pingClock = 0; this.send({ type: 'ping', time: performance.now() }); }
        const age = Math.min(0.1, (performance.now() - this.receivedAt) / 1000);
        for (const f of [g.player, g.enemy]) {
            if (!f?.targetPosition) continue;
            const local = f === g.player && enabled;
            const speed = g.getFighterMoveSpeed(f), len = Math.max(1, Math.hypot(input.x, input.y));
            const leadX = local ? input.x / len * speed * Math.min(0.1, age + 0.04) : (this.state.locked || this.disconnected ? 0 : f.vx * age);
            const leadY = local ? input.y / len * speed * Math.min(0.1, age + 0.04) : (this.state.locked || this.disconnected ? 0 : f.vy * age);
            const smooth = 1 - Math.exp(-22 * dt);
            f.x += (Math.max(-470 + f.radius, Math.min(470 - f.radius, f.targetPosition.x + leadX)) - f.x) * smooth;
            f.y += (Math.max(-255 + f.radius, Math.min(255 - f.radius, f.targetPosition.y + leadY)) - f.y) * smooth;
            f.z += (f.targetPosition.z - f.z) * smooth;
        }
        g.updateTransientVisuals(dt); g.updateActors();
    }
    leave() {
        this.active = false; ++this.revision; clearTimeout(this.retry); this.send({ type: 'leave' }); this.socket?.close();
        this.credentials = null; this.state = null; this.room = null; this.status = 'offline'; sessionStorage.removeItem('pvp-session');
        this.game.online = null; this.game.loading = false; this.game.spriteAnimator.clear();
        document.getElementById('loadingOverlay')?.classList.add('hidden'); document.getElementById('resultModal')?.classList.add('hidden');
        this.game.initMatch(); window.dispatchEvent(new Event('pvp:leave')); this.changed();
    }
}
export const pvpClient = new PvpClient();
