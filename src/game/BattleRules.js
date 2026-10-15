// Pure combat geometry and tuning. World units are shared by simulation and renderer.
export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function segmentDistance(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1);
    return Math.hypot(px - ax - dx * t, py - ay - dy * t);
}

export function turnToward(angle, target, amount) {
    const delta = Math.atan2(Math.sin(target - angle), Math.cos(target - angle));
    return angle + clamp(delta, -amount, amount);
}

export function moveProfile(move, empowered = false) {
    const base = {
        range: 640, charge: 0.18, recovery: 0.3, tracking: 0,
        knockback: 70, speed: 440, radius: 13, breakPower: 1,
        stamina: 18, width: 22, duration: 0.28, elevation: 18,
        ...({
            BEAM: { range: 740, charge: 0.5, recovery: 0.48, width: 24, stamina: 25 },
            BLITZ: { range: 190, charge: 0.18, recovery: 0.5, knockback: 125, stamina: 22 },
            AOE: { range: 210, charge: 0.48, recovery: 0.55, stamina: 28, elevation: 0 }
        }[move.archetype] || {})
    };
    const overrides = {
        thunderbolt: { tracking: 1.3, charge: 0.38, width: 18 },
        'hydro-pump': { knockback: 240, charge: 0.65, width: 30, breakPower: 1.5 },
        'iron-tail': { range: 110, breakPower: 3, knockback: 180, recovery: 0.6 },
        'quick-attack': { range: 280, charge: 0.08, recovery: 0.2, duration: 0.18 },
        'volt-tackle': { range: 310, charge: 0.25, knockback: 180, breakPower: 2 },
        'aura-sphere': { tracking: 1.5, speed: 340 },
        'electro-ball': { tracking: 0.85, speed: 390 },
        'water-shuriken': { charge: 0.1, recovery: 0.22, speed: 560, radius: 9 },
        'ice-beam': { charge: 0.55, knockback: 45 },
        earthquake: { range: 270, charge: 0.65, breakPower: 3, knockback: 160, elevation: 0 },
        'dragon-claw': { range: 125, breakPower: 2 },
        flamethrower: { charge: 0.3, range: 470, width: 34 }
    };
    Object.assign(base, overrides[move.slug]);
    // Signature overdrive changes geometry as well as damage; it never skips charging.
    if (empowered) {
        base.range *= 1.2;
        base.width *= 1.35;
        base.radius *= 1.3;
        base.knockback *= 1.3;
        base.breakPower *= 1.5;
        base.tracking += 0.4;
    }
    return base;
}

export function fighterTraits(raw) {
    const weight = raw.weight || 100; // PokeAPI weight uses hectograms.
    const mass = clamp(weight / 1000, 0.35, 3);
    return {
        mass,
        acceleration: 950 / Math.sqrt(mass),
        turnRate: 7 / Math.sqrt(mass),
        reach: clamp((raw.height || 10) * 1.2, 8, 28),
        airborne: raw.types.includes('flying')
    };
}

export function typeEffectiveness(chart, moveType, types) {
    return types.reduce((value, type) => value * (chart[moveType]?.[type] ?? 1), 1);
}
