import assets from './ShowmotionAssets.js';
import { TYPE_COLORS } from './constants.js';
import { clamp } from './BattleRules.js';
import { attackMuzzle, impactSize, renderTypeAccent } from './BattlePresentation.js';

const exact = {
    hydropump: 'hydropump', shadowball: 'shadowball', moonblast: 'moonblast', mysticalfire: 'mysticalfire',
    psychic: 'psychic', gunkshot: 'gunkshot', flowertrick: 'flowertrick', swordsdance: 'swordsdance', willowisp: 'willowisp'
};
const byType = {
    normal: 'swordsdance', fire: 'mysticalfire', water: 'hydropump', electric: 'hydropump',
    grass: 'flowertrick', ice: 'hydropump', fighting: 'swordsdance', poison: 'gunkshot',
    ground: 'land', flying: 'flowertrick', psychic: 'psychic', bug: 'flowertrick', rock: 'land',
    ghost: 'shadowball', dragon: 'moonblast', dark: 'shadowball', steel: 'swordsdance', fairy: 'moonblast'
};
const nativeHue = { hydropump: 225, shadowball: 345, moonblast: 300, mysticalfire: 20,
    psychic: 300, gunkshot: 290, flowertrick: 125, swordsdance: 45, willowisp: 285, land: 40 };

function hue(hex) {
    const rgb = [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16) / 255);
    const [r, g, b] = rgb, max = Math.max(...rgb), min = Math.min(...rgb), delta = max - min;
    if (!delta) return 0;
    return ((max === r ? (g - b) / delta : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4) * 60 + 360) % 360;
}

// Total mapping: unlisted moves always select a real Showmotion motion, never a
// generic geometric replacement. Exact matches retain the original effect colors.
export function animationForMove(move) {
    const key = String(move.slug || move.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const original = exact[key];
    let effect = original || byType[move.type] || 'shadowball';
    if (!original && move.archetype === 'BLITZ') effect = 'swordsdance';
    if (!original && move.archetype === 'BEAM' && (move.type === 'ground' || move.type === 'rock')) effect = 'hydropump';
    const tint = TYPE_COLORS[move.type]?.hex || '#e7e5e4';
    const muted = ['normal', 'steel', 'ice', 'rock'].includes(move.type);
    return { effect, exact: Boolean(original), tint, asset: assets[effect],
        filter: original ? 'none' : `hue-rotate(${hue(tint) - nativeHue[effect]}deg) saturate(${muted ? 0.35 : 1.7}) brightness(${move.empowered ? 1.65 : 1.25})` };
}

export class ShowmotionAnimations {
    constructor() {
        this.images = new Map(); this.impacts = []; this.ready = false;
        this.lastFrameDraws = 0; this.drawnEffects = new Set(); this.error = null;
    }

    async preload() {
        if (this.loading) return this.loading;
        this.loading = Promise.all(Object.entries(assets).map(async ([id, asset]) => {
            const image = new Image(); image.src = asset.src;
            await image.decode(); this.images.set(id, image);
        })).then(() => { this.ready = true; }).catch(error => {
            this.error = error.message; throw error;
        });
        return this.loading;
    }

    clear() { this.impacts = []; this.drawnEffects.clear(); this.lastFrameDraws = 0; }

    impact(move, x, y, z = 0, feedback = {}) {
        // Keep consecutive hits readable without stacking outcome labels.
        for (const previous of this.impacts) {
            if (Math.hypot(previous.x - x, previous.y - y) < 60) previous.labelHidden = true;
        }
        this.impacts.push({ move, x, y, z, ...feedback, age: 0, duration: 1.05 });
        if (this.impacts.length > 18) this.impacts.shift();
    }

    update(dt) {
        for (const impact of this.impacts) impact.age += dt;
        this.impacts = this.impacts.filter(impact => impact.age < impact.duration);
    }

    drawFrame(ctx, move, progress, x, y, width, height, angle = 0, alignAxis = false, opacity = 1) {
        const mapping = animationForMove(move), meta = mapping.asset;
        const image = this.images.get(mapping.effect);
        if (!image || width <= 0 || height <= 0) return;
        const index = Math.min(meta.frames - 1, Math.floor(clamp(progress, 0, 0.9999) * meta.frames));
        // Very brief invisible samples are skipped without dropping the motion.
        const bounds = meta.bounds[index];
        if (!bounds?.visible) return;
        const sx = index % meta.cols * meta.width;
        const sy = Math.floor(index / meta.cols) * meta.height;
        ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
        ctx.globalAlpha = opacity; ctx.filter = mapping.filter;
        if (alignAxis) {
            ctx.scale(width / bounds.major, height / bounds.minor);
            ctx.rotate(-bounds.angle);
            ctx.drawImage(image, sx, sy, meta.width, meta.height, -bounds.cx, -bounds.cy, meta.width, meta.height);
        } else {
            const scale = Math.min(width / bounds.w, height / bounds.h);
            ctx.drawImage(image, sx + bounds.x, sy + bounds.y, bounds.w, bounds.h,
                -bounds.w * scale / 2, -bounds.h * scale / 2, bounds.w * scale, bounds.h * scale);
        }
        ctx.restore(); this.lastFrameDraws++; this.drawnEffects.add(mapping.effect);
    }

    render(ctx, game) {
        this.lastFrameDraws = 0;
        const zoom = game.camera.zoom;
        for (const fighter of [game.player, game.enemy]) {
            if (!fighter || fighter.fainted) continue;
            const bodySize = game.getFighterSpriteSize?.(fighter) || 48 * zoom;
            const foot = game.worldToScreen(fighter.x, fighter.y, fighter.z);
            const screen = { ...foot, y: foot.y - bodySize * 0.45 };
            if (fighter.action) {
                const progress = 1 - fighter.action.timer / fighter.action.move.profile.charge;
                const angle = Math.atan2(fighter.action.ty - fighter.y, fighter.action.tx - fighter.x);
                const muzzle = attackMuzzle(game, fighter, fighter.action.move, angle);
                this.drawFrame(ctx, fighter.action.move, 0.06 + progress * 0.18, muzzle.x, muzzle.y,
                    bodySize * (0.55 + progress * 0.45), bodySize * (0.55 + progress * 0.45), 0, false, 0.65);
                renderTypeAccent(ctx, fighter.action.move.type, muzzle.x, muzzle.y, bodySize * 0.5, (progress * 2) % 1, angle, game.reducedMotion);
            }
            if (fighter.blitzState) {
                this.drawFrame(ctx, fighter.blitzState.move, fighter.blitzState.progress,
                    screen.x, screen.y, bodySize * 2, bodySize * 1.8, 0, false);
            }
        }
        for (const shot of game.projectiles) {
            const screen = game.worldToScreen(shot.x, shot.y, shot.z);
            const progress = 1 - shot.rangeLeft / shot.move.profile.range;
            if (shot.visualOrigin) {
                const muzzle = attackMuzzle(game, shot.visualOrigin, shot.move, shot.angle);
                const origin = game.worldToScreen(shot.originX, shot.originY, shot.z);
                const blend = Math.max(0, 1 - progress / 0.22);
                screen.x += (muzzle.x - origin.x) * blend; screen.y += (muzzle.y - origin.y) * blend;
            }
            this.drawFrame(ctx, shot.move, 0.2 + progress * 0.4, screen.x, screen.y,
                shot.radius * 3 * zoom, shot.radius * 3 * zoom, shot.angle * 0.15);
            renderTypeAccent(ctx, shot.move.type, screen.x, screen.y, shot.radius * 2 * zoom,
                ((game.presentation?.time || 0) * 3 + shot.originX * 0.01) % 1, shot.angle, game.reducedMotion);
        }
        for (const beam of game.beams) {
            const end = beam.clash || { x: beam.endX ?? game.beamEnd(beam).x, y: beam.endY ?? game.beamEnd(beam).y };
            const a = beam.owner ? attackMuzzle(game, beam.owner, beam.move, beam.angle) : game.worldToScreen(beam.x, beam.y, beam.z);
            const b = game.worldToScreen(end.x, end.y, beam.z);
            const progress = beam.clash ? (game.matchElapsed * 2 % 0.2) + 0.4 : 0.25 + (1 - beam.activeTimer / 0.35) * 0.45;
            this.drawFrame(ctx, beam.move, progress, (a.x + b.x) / 2, (a.y + b.y) / 2,
                Math.max(40, Math.hypot(b.x - a.x, b.y - a.y)), Math.max(18, beam.move.profile.width * 1.4) * zoom,
                Math.atan2(b.y - a.y, b.x - a.x), true);
            renderTypeAccent(ctx, beam.move.type, b.x, b.y, 24 * zoom, ((game.presentation?.time || 0) * 3) % 1, beam.angle, game.reducedMotion);
        }
        for (const wave of game.aoeWaves) {
            const screen = game.worldToScreen(wave.x, wave.y, wave.z);
            this.drawFrame(ctx, wave.move, 0.1 + wave.radius / wave.maxRadius * 0.85,
                screen.x, screen.y, wave.radius * 2 * zoom, wave.radius * 2 * zoom * game.Y_SCALE, 0, false, Math.max(0.3, wave.alpha));
        }
        for (const impact of this.impacts) {
            const screen = game.worldToScreen(impact.x, impact.y, impact.z + 20);
            const progress = impact.age / impact.duration;
            const motionProgress = Math.min(1, impact.age / 0.42);
            const size = impactSize(impact.move, impact.guarded, impact.effectiveness ?? 1) * zoom;
            if (motionProgress < 1 && impact.effectiveness !== 0) {
            this.drawFrame(ctx, impact.move, 0.6 + motionProgress * 0.39,
                screen.x, screen.y, size, size);
            ctx.save();
            ctx.translate(screen.x, screen.y);
            ctx.globalAlpha = (1 - motionProgress) * 0.85;
            ctx.strokeStyle = impact.guarded ? '#7dd3fc' : TYPE_COLORS[impact.move.type]?.hex || '#f8fafc';
            ctx.lineWidth = (1 - motionProgress) * 3 + 1;
            ctx.beginPath();
            ctx.ellipse(0, 0, 8 + motionProgress * size * 0.6, 5 + motionProgress * size * 0.35, 0, 0, Math.PI * 2);
            ctx.stroke();
            if (!game.reducedMotion) {
                renderTypeAccent(ctx, impact.move.type, 0, 0, size * 0.75, motionProgress, impact.angle || 0);
            }
            ctx.restore();
            }
            const multiplier = impact.effectiveness;
            const effectivenessLabel = multiplier === 0 ? 'NO EFFECT · ×0' : multiplier > 1 ? `SUPER EFFECTIVE! · ×${multiplier}` : multiplier < 1 ? `NOT VERY EFFECTIVE… · ×${multiplier}` : '';
            if (!impact.labelHidden && (impact.guarded || effectivenessLabel)) {
                ctx.save();
                ctx.translate(screen.x, screen.y);
                ctx.globalAlpha = Math.min(1, (1 - progress) * 2);
                ctx.font = 'bold 12px sans-serif';
                ctx.textAlign = 'center';
                ctx.lineWidth = 3;
                ctx.strokeStyle = '#0f172a';
                ctx.fillStyle = multiplier === 0 ? '#cbd5e1' : multiplier < 1 ? '#b4c9ed' : '#fde68a';
                const label = effectivenessLabel || 'BLOCKED';
                ctx.strokeText(label, 0, -26 - progress * 18);
                ctx.fillText(label, 0, -26 - progress * 18);
                if (impact.guarded && effectivenessLabel) {
                    ctx.fillStyle = '#bae6fd';
                    ctx.strokeText('BLOCKED', 0, -10 - progress * 18);
                    ctx.fillText('BLOCKED', 0, -10 - progress * 18);
                }
                ctx.restore();
            }
        }
    }
}
