import { clamp } from './BattleRules.js';

export function impactSize(move, guarded = false, effectiveness = 1) {
    return clamp(44 + Math.sqrt(Math.max(0, move.power || 0)) * 3.2, 48, 94) *
        (guarded ? 0.7 : effectiveness > 1 ? 1.15 : 1) * (move.empowered ? 1.15 : 1);
}

export function shadowShape(size, altitude) {
    const lift = clamp(altitude / 160, 0, 1);
    return { width: size * (0.34 + lift * 0.13), height: size * (0.095 + lift * 0.035), opacity: 0.34 - lift * 0.21 };
}

export function muzzleKind(fighter, move) {
    const slug = String(move.slug || move.name || '').toLowerCase();
    if ((fighter.speciesId || fighter.id) === 9 && (move.type === 'water' || /cannon/.test(slug))) return 'cannon';
    if (/punch|palm|sphere|shuriken|ball|bullet|flash-cannon/.test(slug) || [448, 150, 658].includes(fighter.speciesId || fighter.id)) return 'hand';
    return 'head';
}

export function attackMuzzle(game, fighter, move, angle = 0) {
    const foot = game.worldToScreen(fighter.x, fighter.y, fighter.z);
    const size = game.getFighterSpriteSize(fighter);
    const kind = muzzleKind(fighter, move);
    const attachment = fighter.visualAnchor || game.spriteAnimator?.attachment?.(fighter, kind);
    const dx = Math.cos(angle), dy = Math.sin(angle);
    if (attachment) return { x: foot.x + (attachment.x + dx * (kind === 'head' ? 0.1 : 0.03)) * size, y: foot.y + (attachment.y + dy * 0.04) * size, kind };
    const height = kind === 'cannon' ? 0.78 : kind === 'head' ? 0.7 : 0.48;
    return { x: foot.x + dx * size * (kind === 'hand' ? 0.28 : 0.2), y: foot.y - size * height + dy * size * 0.12, kind };
}

export class BattlePresentation {
    constructor() { this.clear(); }
    clear() { this.time = 0; this.particles = []; this.trails = []; this.motion = new WeakMap(); this.cameraPulse = 0; this.pulseDuration = 1; this.zoomStrength = 0; }

    pulse(strength = 0.025, duration = 0.5) {
        this.zoomStrength = Math.max(this.zoomStrength, strength); this.cameraPulse = duration; this.pulseDuration = duration;
    }

    emit(x, y, kind, count = 5) {
        for (let i = 0; i < count; i++) this.particles.push({ x, y, kind, age: 0, duration: kind === 'landing' ? 0.5 : 0.42,
            angle: i / count * Math.PI * 2, speed: 12 + (i % 3) * 7 });
        if (this.particles.length > 100) this.particles.splice(0, this.particles.length - 100);
    }

    update(dt, game) {
        this.time += dt;
        this.cameraPulse = Math.max(0, this.cameraPulse - dt);
        const camera = game.camera;
        if (game.reducedMotion) { camera.x = camera.y = 0; camera.zoom = 1; this.cameraPulse = 0; this.zoomStrength = 0; }
        else {
            const envelope = this.cameraPulse > 0 ? Math.sin(Math.PI * (1 - this.cameraPulse / this.pulseDuration)) : 0;
            camera.zoom = 1 + this.zoomStrength * envelope;
            const kick = camera.shakeTimer > 0 ? Math.min(3, camera.shakeMagnitude) * Math.min(1, camera.shakeTimer / 0.12) : 0;
            camera.x = Math.sin(this.time * 91) * kick; camera.y = Math.cos(this.time * 77) * kick * 0.65;
            if (!this.cameraPulse) this.zoomStrength = 0;
        }
        for (const p of this.particles) p.age += dt;
        this.particles = this.particles.filter(p => p.age < p.duration);
        for (const t of this.trails) t.age += dt;
        this.trails = this.trails.filter(t => t.age < 0.18);
        for (const f of [game.player, game.enemy]) {
            if (!f) continue;
            const previous = this.motion.get(f) || { z: f.z, x: f.x, y: f.y, dust: 0, trail: 0 };
            if (f.z <= 1 && previous.z > 1 && !f.fainted && !game.spriteAnimator.busy) this.emit(f.x, f.y, 'landing', game.reducedMotion ? 3 : 10);
            previous.dust += dt; previous.trail += dt;
            const visible = !f.fainted && !game.spriteAnimator.busy;
            const moved = Math.hypot(f.x - previous.x, f.y - previous.y);
            if (visible && f.z < 5 && moved > 0.2 && previous.dust > 0.13 && !game.reducedMotion) {
                this.emit(f.x, f.y, game.currentStadium === 'ice_water' ? 'frost' : 'dust', 3); previous.dust = 0;
            }
            if (visible && (f.dashTimer > 0 || f.blitzState) && previous.trail > 0.035 && !game.reducedMotion) {
                this.trails.push({ x: f.x, y: f.y, z: f.z, size: game.getFighterSpriteSize(f) / game.camera.zoom, age: 0, facing: f.facing });
                previous.trail = 0;
            }
            Object.assign(previous, { z: f.z, x: f.x, y: f.y }); this.motion.set(f, previous);
        }
    }

    renderGround(ctx, game) {
        for (const p of this.particles) {
            const t = p.age / p.duration, point = game.worldToScreen(p.x, p.y);
            const radius = (2 + t * p.speed) * game.camera.zoom;
            ctx.save(); ctx.globalAlpha = (1 - t) * 0.35;
            ctx.strokeStyle = p.kind === 'frost' ? '#ddf6ff' : game.currentStadium === 'magma' ? '#b8a394' : '#e3d2a9';
            ctx.lineWidth = 2;
            if (p.kind === 'landing') {
                ctx.beginPath(); ctx.ellipse(point.x, point.y, radius * 1.4, radius * 0.45, 0, p.angle, p.angle + 0.45); ctx.stroke();
            } else {
                ctx.fillStyle = ctx.strokeStyle; ctx.beginPath();
                ctx.arc(point.x + Math.cos(p.angle) * radius, point.y + Math.sin(p.angle) * radius * 0.4 - t * 4, 1.5 + t * 2, 0, Math.PI * 2); ctx.fill();
            }
            ctx.restore();
        }
        for (const trail of this.trails) {
            const point = game.worldToScreen(trail.x, trail.y, trail.z);
            ctx.save(); ctx.globalAlpha = (1 - trail.age / 0.18) * 0.2; ctx.fillStyle = '#b9f6ff';
            ctx.beginPath(); ctx.ellipse(point.x, point.y - trail.size * 0.45, trail.size * 0.22, trail.size * 0.45, -trail.facing * 0.25, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        }
    }

    renderAmbient(ctx, game) {
        const t = game.reducedMotion ? 0 : this.time;
        const palette = { grassy: '#e8ca76', rocky: '#dcac74', magma: '#f17b65', ice_water: '#8cdbea' };
        ctx.save();
        ctx.translate(game.width / 2 + game.camera.x, game.height / 2 + game.camera.y);
        ctx.scale(game.camera.zoom, game.camera.zoom); ctx.translate(-game.width / 2, -game.height / 2);
        // Small pennants sit along the spectator rail, outside the playable field.
        for (let i = 0; i < 8; i++) {
            const x = game.width * (0.2 + i * 0.085), y = game.height * 0.085;
            const wave = Math.sin(t * 2.2 + i) * 2;
            ctx.fillStyle = palette[game.currentStadium]; ctx.globalAlpha = 0.55;
            ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 13, y + wave); ctx.lineTo(x + 9, y + 13 + wave); ctx.lineTo(x, y + 10); ctx.closePath(); ctx.fill();
        }
        if (!game.reducedMotion) {
            for (let i = 0; i < 12; i++) {
                const pulse = Math.pow(Math.max(0, Math.sin(t * 0.65 + i * 2.7)), 45);
                if (pulse < 0.1) continue;
                const x = game.width * (0.06 + (i * 0.173 % 0.88)), y = game.height * (0.025 + (i % 3) * 0.025);
                ctx.globalAlpha = pulse * 0.65; ctx.fillStyle = '#eef7ff'; ctx.fillRect(x - 1, y - 3, 2, 6); ctx.fillRect(x - 3, y - 1, 6, 2);
            }
            // Sparse motes complement each surface without covering fighters or HUD.
            for (let i = 0; i < 16; i++) {
                const x = (i * 137.3 + t * (game.currentStadium === 'ice_water' ? 7 : 12)) % game.width;
                const y = game.height * (0.16 + ((i * 0.173 + t * (game.currentStadium === 'magma' ? -0.015 : 0.009)) % 0.57 + 0.57) % 0.57);
                ctx.globalAlpha = 0.17; ctx.fillStyle = game.currentStadium === 'magma' ? '#ffbe73' : game.currentStadium === 'ice_water' ? '#ecfbff' : '#eee2b4';
                ctx.beginPath(); ctx.arc(x, y, game.currentStadium === 'ice_water' ? 1.8 : 1.1, 0, Math.PI * 2); ctx.fill();
            }
        }
        ctx.restore();
    }
}

export function renderTypeAccent(ctx, type, x, y, radius, progress, angle = 0, reduced = false) {
    progress = clamp(progress, 0, 1);
    if (reduced || progress >= 1) return;
    ctx.save(); ctx.translate(x, y); ctx.globalAlpha = (1 - progress) * 0.8; ctx.lineWidth = 1.5;
    const count = type === 'electric' ? 5 : 8;
    const colors = { electric: '#fff1a4', water: '#a6eaff', fire: '#ffc28c', ice: '#dcfaff', grass: '#b5eea1', psychic: '#e9b9ff', ghost: '#d7baff', dark: '#ada7e8', dragon: '#babaff', steel: '#e2f2ff', rock: '#dfc8a7', ground: '#dcc59f', fighting: '#ffc4a5', poison: '#dfafff', fairy: '#ffd0ee', flying: '#deefff', bug: '#d9ec95', normal: '#fff1d6' };
    ctx.strokeStyle = ctx.fillStyle = colors[type] || colors.normal;
    for (let i = 0; i < count; i++) {
        const a = angle + i / count * Math.PI * 2;
        const r = radius * (0.25 + progress * 0.65);
        const px = Math.cos(a) * r, py = Math.sin(a) * r * 0.75;
        if (type === 'electric') {
            ctx.beginPath(); ctx.moveTo(Math.cos(a) * 3, Math.sin(a) * 3);
            ctx.lineTo(px * 0.5 - 4, py * 0.5 + 3); ctx.lineTo(px * 0.65 + 3, py * 0.65 - 2); ctx.lineTo(px, py); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(px * 0.65 + 3, py * 0.65 - 2); ctx.lineTo(px * 0.8 + 7, py * 0.8 - 6); ctx.stroke();
        } else if (type === 'ice' || ['rock', 'ground', 'steel'].includes(type)) {
            ctx.save(); ctx.translate(px, py); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(3, 0); ctx.lineTo(0, 6); ctx.lineTo(-2, 0); ctx.closePath(); ctx.fill(); ctx.restore();
        } else {
            ctx.beginPath(); ctx.ellipse(px, py - (type === 'fire' ? progress * 15 : 0), type === 'water' ? 2 : 1.8, type === 'water' ? 4 : 2.5, a, 0, Math.PI * 2); ctx.fill();
        }
    }
    if (type === 'water') { ctx.beginPath(); ctx.ellipse(0, radius * 0.2, radius * progress, radius * progress * 0.3, 0, 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore();
}
