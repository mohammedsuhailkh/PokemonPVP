import { RELEASE_TIME } from './PokemonAnimator.js';

const clamp01 = n => Math.max(0, Math.min(1, n));

// Balls live in the same depth-sorted layer as Pokémon; light beams use the effects canvas.
export function renderPokeballs(ctx, game) {
    const animator = game.spriteAnimator;
    const stage = document.getElementById('spriteStageLayer');
    if (!stage) return;
    for (const sequence of animator.balls) {
        const age = animator.time - sequence.start;
        if (age < 0) continue;
        const f = sequence.fighter;
        const ground = game.worldToScreen(f.x, f.y, 0);
        const body = game.worldToScreen(f.x, f.y, f.z);
        const size = game.getFighterSpriteSize(f);
        const recall = sequence.kind === 'recall';
        const ballX = ground.x - (f.presentationSide === 'enemy' ? -1 : 1) * 28;
        let x = ballX, y = ground.y - 8, gap = 0, spin = 0, glow = 0, phase;
        if (!recall) {
            if (age < 0.75) {
                phase = 'throw';
                const t = age / 0.75;
                const originX = f.presentationSide === 'enemy' ? game.width + 25 : -25;
                x = originX + (ballX - originX) * t;
                y = game.height * 0.7 + (ground.y - 8 - game.height * 0.7) * t - (game.reducedMotion ? 0 : Math.sin(Math.PI * t) * Math.min(150, game.height * 0.22));
                spin = game.reducedMotion ? 0 : t * Math.PI * 4;
            } else if (age < 0.95) {
                phase = 'landing';
                y -= game.reducedMotion ? 0 : Math.sin((age - 0.75) / 0.2 * Math.PI) * 12;
            } else {
                phase = age < RELEASE_TIME ? 'opening' : 'release';
                gap = clamp01((age - 0.95) / 0.15) * 7;
                glow = Math.sin(clamp01((age - 0.95) / 0.75) * Math.PI);
            }
        } else {
            phase = age < 0.3 ? 'ready' : age < 0.95 ? 'recalling' : 'closing';
            gap = age < 0.95 ? clamp01((age - 0.2) / 0.1) * 7 : (1 - clamp01((age - 0.95) / 0.2)) * 7;
            glow = age > 0.3 && age < 0.95 ? Math.sin((age - 0.3) / 0.65 * Math.PI) : 0;
        }
        let node = sequence.node;
        if (!node) {
            node = document.createElement('canvas'); node.width = node.height = 96;
            node.className = 'pokeball-sequence'; node.setAttribute('aria-hidden', 'true');
            sequence.node = node; stage.append(node);
        }
        node.dataset.phase = phase; node.dataset.kind = sequence.kind;
        node.style.opacity = String(1 - clamp01((age - (recall ? 1.15 : 1.4)) / (recall ? 0.1 : 0.3)));
        node.style.transform = `translate(${x - 48}px, ${y - 48}px)`;
        node.style.zIndex = String(Math.round((f.y + game.WORLD_HALF_H) * 10 + 1));
        const ball = node.getContext('2d'); ball.clearRect(0, 0, 96, 96);
        ball.save(); ball.translate(48, 48);
        if (phase !== 'throw') {
            ball.fillStyle = '#07182455'; ball.beginPath(); ball.ellipse(0, 15, 13, 4, 0, 0, Math.PI * 2); ball.fill();
        }
        if (glow > 0) {
            ball.fillStyle = recall ? `rgba(255,100,130,${glow * 0.45})` : `rgba(255,237,160,${glow * 0.55})`;
            ball.beginPath(); ball.arc(0, 0, 15 + glow * 18, 0, Math.PI * 2); ball.fill();
        }
        ball.rotate(spin); ball.lineWidth = 2; ball.strokeStyle = '#122439';
        ball.fillStyle = '#ef4355'; ball.beginPath(); ball.arc(0, -gap, 11, Math.PI, Math.PI * 2); ball.closePath(); ball.fill(); ball.stroke();
        ball.fillStyle = '#f3f7fa'; ball.beginPath(); ball.arc(0, gap, 11, 0, Math.PI); ball.closePath(); ball.fill(); ball.stroke();
        ball.fillStyle = '#fff'; ball.beginPath(); ball.arc(0, 0, gap ? 3 : 4, 0, Math.PI * 2); ball.fill();
        if (!gap) ball.stroke(); ball.restore();
        if (glow > 0) {
            ctx.save(); ctx.globalAlpha = glow * 0.8;
            ctx.strokeStyle = recall ? '#ff88a5' : '#fff1b6'; ctx.lineWidth = 5;
            ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = game.reducedMotion ? 0 : 12;
            ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(body.x, body.y - size * 0.45); ctx.stroke();
            ctx.restore();
        }
    }
}
