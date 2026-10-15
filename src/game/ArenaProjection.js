import { clamp } from './BattleRules.js';

// Shared high-angle ground projection. The shallow trapezoid matches all four
// painted backgrounds. Simulation coordinates and collision distances stay in
// world units; only their presentation changes with the viewport.
export function projectGround(wx, wy, wz, width, height, halfW = 470, halfH = 255) {
    const top = width / height < 1.2 ? 0.17 : 0.14;
    const span = width / height < 1.2 ? 0.48 : 0.70;
    const depth = (wy + halfH) / (2 * halfH);
    const scale = width * (0.84 + depth * 0.12) / (2 * halfW);
    return {
        x: width * 0.5 + wx * scale,
        y: height * (top + depth * span) - wz * scale,
        scale,
        scaleY: height * span / (2 * halfH),
        depth
    };
}

export function unprojectGround(sx, sy, width, height, halfW = 470, halfH = 255) {
    const top = width / height < 1.2 ? 0.17 : 0.14;
    const span = width / height < 1.2 ? 0.48 : 0.70;
    const depth = (sy / height - top) / span;
    const scale = width * (0.84 + depth * 0.12) / (2 * halfW);
    return { x: (sx - width * 0.5) / scale, y: depth * (2 * halfH) - halfH };
}

export function fighterSpriteSize(fighter, width, height) {
    const heightDm = fighter.height || 10;
    // Species height establishes relative size; readable min/max bounds keep
    // tiny species selectable and unusually large species inside the HUD budget.
    const speciesHeight = clamp(18 + heightDm * 3.3, 30, 118);
    const viewportScale = clamp(Math.min(width / 1440, height / 810), 0.65, 1.35);
    const depthScale = 0.94 + clamp((fighter.y + 255) / 510, 0, 1) * 0.1;
    return speciesHeight * viewportScale * depthScale;
}

export function traceGroundCircle(ctx, game, x, y, radius, z = 0) {
    ctx.beginPath();
    for (let i = 0; i <= 64; i++) {
        const angle = i / 64 * Math.PI * 2;
        const p = game.worldToScreen(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius, z);
        if (!i) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
}
