import { STADIUM_THEMES } from './constants.js';
import { traceGroundCircle, projectGround } from './ArenaProjection.js';

export function renderArenaBackground(ctx, game) {
    const theme = STADIUM_THEMES[game.currentStadium] || STADIUM_THEMES.grassy;
    const image = game.stadiumImages[game.currentStadium];
    ctx.fillStyle = theme.turfFill;
    ctx.fillRect(0, 0, game.width, game.height);
    ctx.save();
    ctx.translate(game.width / 2 + game.camera.x, game.height / 2 + game.camera.y);
    ctx.scale(game.camera.zoom, game.camera.zoom); ctx.translate(-game.width / 2, -game.height / 2);
    if (image?.complete && image.naturalWidth > 0) {
        // Match the approved full-screen composition instead of putting a small
        // stadium picture inside a glowing oval. Portrait crops decorative edges.
        const sourceAspect = image.naturalWidth / image.naturalHeight;
        const viewAspect = game.width / game.height;
        if (viewAspect < 1.2) {
            const sw = image.naturalHeight * viewAspect;
            ctx.drawImage(image, (image.naturalWidth - sw) / 2, 0, sw, image.naturalHeight, 0, 0, game.width, game.height);
        } else ctx.drawImage(image, 0, 0, game.width, game.height);
        let softened = game.softenedArena;
        if (!softened || softened.image !== image || softened.width !== game.width || softened.height !== game.height) {
            const canvas = document.createElement('canvas'); canvas.width = Math.ceil(game.width / 2); canvas.height = Math.ceil(game.height / 2);
            const paint = canvas.getContext('2d');
            paint.filter = 'saturate(0.82) contrast(0.92) brightness(0.91) blur(0.45px)';
            if (viewAspect < 1.2) {
                const sw = image.naturalHeight * viewAspect;
                paint.drawImage(image, (image.naturalWidth - sw) / 2, 0, sw, image.naturalHeight, 0, 0, canvas.width, canvas.height);
            } else paint.drawImage(image, 0, 0, canvas.width, canvas.height);
            softened = game.softenedArena = { image, width: game.width, height: game.height, canvas };
        }
        // Only soften the court: spectators and architectural details stay crisp.
        ctx.save(); ctx.beginPath();
        [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([x, y], i) => {
            const p = projectGround(x * game.WORLD_HALF_W, y * game.WORLD_HALF_H, 0, game.width, game.height, game.WORLD_HALF_W, game.WORLD_HALF_H);
            if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y);
        });
        ctx.closePath(); ctx.clip(); ctx.drawImage(softened.canvas, 0, 0, game.width, game.height); ctx.restore();
    }
    ctx.restore();
    const W = game.WORLD_HALF_W, H = game.WORLD_HALF_H;
    const corners = [[-W, -H], [W, -H], [W, H], [-W, H]].map(([x, y]) => game.worldToScreen(x, y));
    ctx.save(); ctx.lineWidth = Math.max(1.5, game.width / 600);
    ctx.strokeStyle = game.currentStadium === 'ice_water' ? 'rgba(17,77,106,.65)' : 'rgba(255,255,238,.75)';
    ctx.lineJoin = 'round'; ctx.beginPath();
    corners.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
    ctx.closePath(); ctx.stroke();
    const upper = game.worldToScreen(0, -H), lower = game.worldToScreen(0, H);
    ctx.globalAlpha = 0.58; ctx.beginPath(); ctx.moveTo(upper.x, upper.y); ctx.lineTo(lower.x, lower.y); ctx.stroke();
    ctx.globalAlpha = 0.85;
    traceGroundCircle(ctx, game, 0, 0, 65); ctx.stroke();
    traceGroundCircle(ctx, game, 0, 0, 13); ctx.stroke();
    // A small flat battle emblem replaces all football penalty boxes and goals.
    const left = game.worldToScreen(-65, 0), right = game.worldToScreen(65, 0);
    const innerLeft = game.worldToScreen(-13, 0), innerRight = game.worldToScreen(13, 0);
    ctx.beginPath(); ctx.moveTo(left.x, left.y); ctx.lineTo(innerLeft.x, innerLeft.y);
    ctx.moveTo(innerRight.x, innerRight.y); ctx.lineTo(right.x, right.y); ctx.stroke();
    ctx.restore();
}
