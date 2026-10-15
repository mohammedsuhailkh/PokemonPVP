import { BattleSimulation } from './BattleSimulation.js';
import { TYPE_COLORS, TYPE_CHART } from './constants.js';
import { clamp, segmentDistance, turnToward, moveProfile, typeEffectiveness } from './BattleRules.js';
import { traceGroundCircle } from './ArenaProjection.js';
import { shadowShape } from './BattlePresentation.js';
const color = move => TYPE_COLORS[move.type]?.hex || '#facc15';
const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
export const CombatSystem = {
    ...BattleSimulation,
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
