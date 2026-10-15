import { SoundEngine } from './SoundEngine.js';
export const SENDOUT_DURATION = 1.7;
export const RELEASE_TIME = 1.1;
export const RECALL_DURATION = 1.25;
const REVISION = 'e7868e9a7f6b931d1fb826756a490d4633879d03';
const REMOTE = `https://raw.githubusercontent.com/PMDCollab/SpriteCollab/${REVISION}/sprite/`;
const NAMES = ['Idle', 'Walk', 'Attack', 'Shoot', 'Charge', 'Hurt', 'Hop', 'Cringe', 'Faint', 'Sleep'];
const choices = {
    idle: ['Idle', 'Walk'], walk: ['Walk', 'Idle'], charge: ['Charge', 'Idle', 'Attack'],
    attack: ['Attack', 'Shoot', 'Idle'], shoot: ['Shoot', 'Attack', 'Idle'],
    recovery: ['Idle', 'Walk'], hurt: ['Hurt', 'Cringe', 'Idle'],
    dodge: ['Hop', 'Walk', 'Idle'], guard: ['Cringe', 'Idle'],
    faint: ['Faint', 'Sleep', 'Hurt', 'Idle'], sendout: ['Idle', 'Walk'], recall: ['Idle', 'Walk']
};

export function directionRow(dx, dy, previous = 0) {
    if (Math.hypot(dx, dy) < 0.01) return previous;
    // SpriteCollab row order: S, SE, E, NE, N, NW, W, SW.
    return (Math.round(Math.atan2(dx, dy) / (Math.PI / 4)) + 8) % 8;
}

export function walkingFacing(fighter, target, previous = 0) {
    const vx = fighter.vx || 0, vy = fighter.vy || 0;
    const tx = target ? target.x - fighter.x : 0, ty = target ? target.y - fighter.y : 0;
    const lengths = Math.hypot(vx, vy) * Math.hypot(tx, ty);
    // Retreating keeps the opponent in view; sideways and forward movement face travel.
    const backpedaling = lengths > 0 && (vx * tx + vy * ty) / lengths < -0.35;
    return { backpedaling, direction: backpedaling ? directionRow(tx, ty, previous) : directionRow(vx, vy, previous) };
}

export function animationState(f, event) {
    if (f.fainted) return 'faint';
    if (event?.state === 'sendout') return 'sendout';
    if (f.hitFlashTimer > 0) return 'hurt';
    if (f.dashTimer > 0) return 'dodge';
    if (f.guarding || f.counterShieldTimer > 0) return 'guard';
    if (f.action) return 'charge';
    if (f.blitzState) return 'attack';
    if (event) return event.state;
    if (f.recoveryTimer > 0) return 'recovery';
    return Math.hypot(f.vx || 0, f.vy || 0) > 12 ? 'walk' : 'idle';
}

export function frameAt(durations, seconds, loop = true, reverse = false) {
    const total = durations.reduce((sum, n) => sum + n, 0);
    if (!total) return 0;
    let tick = loop ? seconds * 60 % total : Math.min(seconds * 60, total - 0.001);
    if (reverse && loop) tick = (total - tick) % total;
    for (let i = 0; i < durations.length; i++) {
        if (tick < durations[i]) return i;
        tick -= durations[i];
    }
    return durations.length - 1;
}

async function fetchTimed(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error(`Sprite metadata unavailable (${response.status})`);
        return await response.text();
    } finally { clearTimeout(timer); }
}

function imageAt(url) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        const timer = setTimeout(() => { image.onload = image.onerror = null; reject(new Error('Sprite timeout')); }, 6000);
        image.crossOrigin = 'anonymous';
        image.onload = () => { clearTimeout(timer); resolve(image); };
        image.onerror = () => { clearTimeout(timer); reject(new Error('Sprite image unavailable')); };
        image.src = url;
    });
}

function readAttachments(image, width, height) {
    if (!image) return null;
    const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true }); ctx.drawImage(image, 0, 0);
    const rgba = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const cols = Math.floor(canvas.width / width), result = [];
    for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
        const offset = (y * canvas.width + x) * 4;
        if (!rgba[offset + 3]) continue;
        const point = { x: x % width - width / 2, y: y % height - height / 2 };
        const index = Math.floor(y / height) * cols + Math.floor(x / width);
        const markers = result[index] ||= {};
        const [r, g, b] = rgba.subarray(offset, offset + 3);
        if (!r && !g && !b) markers.head = point;
        if (r && !g) markers.left = point;
        if (b && !g) markers.right = point;
        if (g && !r && !b) markers.center = point;
    }
    return result;
}

export class PokemonAnimator {
    constructor() {
        this.packs = new Map(); this.pending = new Map(); this.actors = new WeakMap();
        this.events = new WeakMap(); this.ghosts = []; this.time = 0;
        this.balls = []; this.hidden = new WeakSet(); this.busyUntil = 0;
    }

    get busy() { return this.time < this.busyUntil; }

    sendOut(fighter, delay = 0) {
        if (typeof document === 'undefined' || typeof document.createElement !== 'function') return;
        this.hidden.delete(fighter);
        const start = this.time + delay, end = start + SENDOUT_DURATION;
        this.events.set(fighter, { state: 'sendout', start, end, ball: true });
        this.balls.push({ fighter, start, end, kind: 'sendout' });
        this.busyUntil = Math.max(this.busyUntil, end);
    }

    async prepare(fighters) {
        if (typeof Image === 'undefined') return;
        if (!this.bundled) this.bundled = fetchTimed('/pokemon-motion/bundled.json').then(JSON.parse).catch(() => ({ species: [] }));
        const bundled = await this.bundled;
        await Promise.all(fighters.map(f => this.load(f.speciesId || f.id, bundled.species)));
    }

    load(id, bundled) {
        if (this.pending.has(id)) return this.pending.get(id);
        const job = this.loadPack(id, bundled).catch(() => null).then(pack => { if (pack) this.packs.set(id, pack); return pack; });
        this.pending.set(id, job);
        return job;
    }

    async loadPack(id, bundled) {
        const folder = String(id).padStart(4, '0');
        const base = bundled.includes(folder) ? `/pokemon-motion/${folder}/` : `${REMOTE}${folder}/`;
        const xml = new DOMParser().parseFromString(await fetchTimed(`${base}AnimData.xml`), 'application/xml');
        const entries = new Map([...xml.querySelectorAll('Anims > Anim')].map(a => [a.querySelector('Name')?.textContent, a]));
        const sheets = new Map(), loads = new Map();
        await Promise.all(NAMES.map(async name => {
            let element = entries.get(name);
            const seen = new Set();
            while (element?.querySelector('CopyOf')) {
                const alias = element.querySelector('CopyOf').textContent;
                if (seen.has(alias)) return;
                seen.add(alias); element = entries.get(alias);
            }
            if (!element) return;
            const source = element.querySelector('Name').textContent;
            const width = Number(element.querySelector('FrameWidth')?.textContent);
            const height = Number(element.querySelector('FrameHeight')?.textContent);
            const durations = [...element.querySelectorAll('Durations > Duration')].map(n => Math.max(1, Number(n.textContent)));
            if (!width || !height || !durations.length) return;
            if (!loads.has(source)) loads.set(source, Promise.all([
                imageAt(`${base}${source}-Anim.png`), imageAt(`${base}${source}-Offsets.png`).catch(() => null)
            ]));
            try {
                const [image, offsets] = await loads.get(source);
                if (image.naturalWidth < width * durations.length || image.naturalHeight < height) return;
                sheets.set(name, { image, width, height, durations, rows: Math.min(8, Math.floor(image.naturalHeight / height)), source, markers: readAttachments(offsets, width, height) });
            } catch { /* A missing action uses another available sheet or the original sprite. */ }
        }));
        const idle = sheets.get('Idle') || sheets.get('Walk');
        if (!idle) return null;
        // One shared species scale and origin, never rescale individual attack frames.
        const canvas = document.createElement('canvas');
        canvas.width = idle.width; canvas.height = idle.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(idle.image, 0, 0, idle.width, idle.height, 0, 0, idle.width, idle.height);
        const pixels = ctx.getImageData(0, 0, idle.width, idle.height).data;
        let top = idle.height, bottom = 0, left = idle.width, right = 0;
        for (let y = 0; y < idle.height; y++) for (let x = 0; x < idle.width; x++) {
            if (pixels[(y * idle.width + x) * 4 + 3] < 12) continue;
            top = Math.min(top, y); bottom = Math.max(bottom, y); left = Math.min(left, x); right = Math.max(right, x);
        }
        if (top > bottom) return null;
        try {
            const used = JSON.parse(sessionStorage.getItem('pokemon-motion-sources') || '{}');
            used[folder] = `${base}credits.txt`;
            sessionStorage.setItem('pokemon-motion-sources', JSON.stringify(used));
        } catch { /* Storage is optional; bundled credits remain available. */ }
        const bodyHeight = bottom - top + 1;
        const footOffset = bottom + 1 - idle.height / 2;
        const span = Math.max(...[...sheets.values()].map(s => Math.max(s.width, s.height + Math.abs(footOffset) * 2))) / bodyHeight;
        return { sheets, bodyHeight, bodyWidth: right - left + 1, footOffset, span, credits: `${base}credits.txt` };
    }

    play(fighter, state, duration = 0.45, target = null) {
        this.events.set(fighter, { state, start: this.time, end: this.time + duration, target });
    }

    attachment(fighter, kind) {
        if (kind === 'cannon') return null;
        const data = this.actors.get(fighter), pack = this.packs.get(fighter.speciesId || fighter.id);
        const sheet = data?.sheet;
        const markers = sheet?.markers?.[data.row * sheet.durations.length + data.frame];
        if (!pack || !markers) return null;
        let point = markers.head || markers.center;
        if (kind === 'hand') {
            const hands = [markers.left, markers.right].filter(Boolean);
            const dx = Math.sin(data.direction * Math.PI / 4), dy = Math.cos(data.direction * Math.PI / 4) * 0.5;
            hands.sort((a, b) => (b.x * dx + b.y * dy) - (a.x * dx + a.y * dy));
            point = hands[0] || point;
        }
        return point ? { x: point.x / pack.bodyHeight, y: (point.y - pack.footOffset) / pack.bodyHeight } : null;
    }

    depart(fighter, state = 'recall') {
        if (typeof document === 'undefined' || typeof document.createElement !== 'function') return;
        const stage = document.getElementById('spriteStageLayer');
        if (!stage) return;
        const node = document.createElement('div'); node.className = 'world-sprite-actor departing-pokemon';
        const image = document.createElement('img'); image.src = fighter.sprite; image.className = 'sprite-pixelated';
        node.append(image); stage.append(node);
        const snapshot = { ...fighter, fainted: false, vx: 0, vy: 0, action: null, blitzState: null, hitFlashTimer: 0, dashTimer: 0, guarding: false, counterShieldTimer: 0 };
        const end = this.time + RECALL_DURATION;
        this.events.set(snapshot, { state: 'recall', start: this.time, end, ball: true, defeated: state === 'faint' });
        this.ghosts.push({ fighter: snapshot, node, image, end });
        this.balls.push({ fighter: snapshot, start: this.time, end, kind: 'recall' });
        this.hidden.add(fighter);
        this.busyUntil = Math.max(this.busyUntil, end);
    }

    tick(dt, game) {
        this.time += dt;
        this.balls = this.balls.filter(ball => {
            if (this.time >= ball.end) { ball.node?.remove(); return false; }
            if (ball.kind === 'sendout' && !ball.released && this.time >= ball.start + RELEASE_TIME) {
                ball.released = true; SoundEngine.playCry(ball.fighter.cry); SoundEngine.playSfx('pokeball_open');
            }
            return true;
        });
        this.ghosts = this.ghosts.filter(ghost => {
            if (this.time >= ghost.end) { ghost.node.remove(); return false; }
            this.render(ghost.fighter, ghost.node, ghost.image, game);
            return true;
        });
    }

    render(f, actor, image, game) {
        if (this.hidden.has(f)) { actor.style.opacity = '0'; actor.dataset.animation = 'recalled'; return; }
        let event = this.events.get(f);
        if (event && event.end <= this.time) { this.events.delete(f); event = null; }
        const state = event?.ball && event.defeated && this.time - event.start < 0.3 ? 'faint' : animationState(f, event);
        let data = this.actors.get(f);
        if (!data) { data = { state, start: this.time, direction: f.facing === 1 ? 2 : 6 }; this.actors.set(f, data); }
        if (data.state !== state) { data.state = state; data.start = this.time; }
        const target = game.playerParty.includes(f) ? game.enemy : game.player;
        const walking = state === 'walk' ? walkingFacing(f, target, data.direction) : { backpedaling: false };
        if (data.backpedaling !== walking.backpedaling) { data.backpedaling = walking.backpedaling; data.start = this.time; }
        if (f.action) data.direction = directionRow(f.action.tx - f.x, f.action.ty - f.y, data.direction);
        else if (event?.target && ['attack', 'shoot'].includes(state)) data.direction = directionRow(event.target.x - f.x, event.target.y - f.y, data.direction);
        else if (state === 'walk') data.direction = walking.direction;
        else if (['dodge', 'attack'].includes(state)) data.direction = directionRow(f.vx, f.vy, data.direction);
        else if (['idle', 'guard', 'charge', 'shoot'].includes(state)) {
            if (target) data.direction = directionRow(target.x - f.x, target.y - f.y, data.direction);
        }
        const pack = this.packs.get(f.speciesId || f.id);
        const name = choices[state].find(n => pack?.sheets.has(n));
        const sheet = pack?.sheets.get(name);
        const age = this.time - data.start;
        const progress = event ? Math.max(0, Math.min(1, (this.time - event.start) / (event.end - event.start))) : 0;
        const size = game.getFighterSpriteSize(f);
        const point = game.worldToScreen(f.x, f.y, f.z);
        const reduced = game.reducedMotion;
        let sx = 1, sy = 1, lift = 0, tilt = 0, opacity = 1;
        if (state === 'sendout') { sx = sy = Math.max(0.05, progress); opacity = progress; }
        if (state === 'recall') { sx = sy = Math.max(0.02, 1 - progress); opacity = 1 - progress; }
        if (state === 'faint') { opacity = Math.max(0, 1 - age / 0.7); tilt = reduced ? 0 : Math.min(75, age * 110); }
        if (event?.ball && event.state === 'sendout') {
            const emerge = Math.max(0, Math.min(1, (this.time - event.start - RELEASE_TIME) / (SENDOUT_DURATION - RELEASE_TIME)));
            sx = sy = Math.max(0.01, 1 - (1 - emerge) ** 3); opacity = emerge > 0 ? 1 : 0;
        }
        if (event?.ball && event.state === 'recall') {
            const shrink = Math.max(0, Math.min(1, (this.time - event.start - 0.3) / 0.65));
            sx = sy = Math.max(0.01, 1 - shrink); opacity = 1 - shrink;
            point.x -= (f.presentationSide === 'enemy' ? -1 : 1) * 28 * shrink;
            point.y += (game.worldToScreen(f.x, f.y, 0).y - point.y) * shrink;
            if (state === 'faint') opacity = 1;
        }
        if (!reduced) {
            if (state === 'walk' && !sheet) lift = Math.abs(Math.sin(age * 14)) * size * 0.07;
            if (state === 'charge') {
                sx *= 1.05; sy *= 0.95;
                const charge = f.action.move?.profile?.charge || 1;
                const anticipation = Math.max(0, Math.min(1, 1 - (f.action.timer ?? charge) / charge));
                tilt = -f.facing * anticipation * 4;
            }
            if (state === 'shoot' && event?.target) {
                const angle = Math.atan2(event.target.y - f.y, event.target.x - f.x);
                const recoil = Math.sin(progress * Math.PI) * size * 0.1;
                point.x -= Math.cos(angle) * recoil; point.y -= Math.sin(angle) * recoil * 0.5;
            }
            if (state === 'hurt') tilt = Math.sin(age * 50) * 9;
            if (state === 'guard') { sx *= 1.1; sy *= 0.9; }
            if (state === 'dodge' && !sheet) { lift = Math.sin(Math.min(1, age / 0.24) * Math.PI) * size * 0.2; tilt = f.facing * 16; }
            if (['attack', 'shoot'].includes(state) && !sheet) tilt = -f.facing * Math.sin(Math.min(1, age / 0.45) * Math.PI) * 18;
        }
        actor.dataset.animation = state;
        actor.dataset.direction = String(data.direction);
        actor.dataset.backpedaling = String(walking.backpedaling);
        actor.dataset.spriteSource = sheet ? 'spritecollab' : 'fallback';
        actor.style.opacity = String(opacity);
        actor.style.zIndex = String(Math.round((f.y + game.WORLD_HALF_H) * 10 + f.z * 20));
        actor.style.transformOrigin = '50% 100%';
        let canvas = actor.querySelector('canvas');
        if (sheet) {
            if (!canvas) { canvas = document.createElement('canvas'); canvas.className = 'pokemon-animation-canvas'; canvas.setAttribute('aria-hidden', 'true'); actor.append(canvas); }
            image.style.visibility = 'hidden'; canvas.style.display = 'block';
            canvas.className = `pokemon-animation-canvas sprite-pixelated ${state === 'dodge' ? 'sprite-iframe-ghost' : ''} ${game.playerParty.includes(f) && game.overdriveTimer > 0 ? 'sprite-overdrive-glow' : ''}`;
            const width = size * pack.bodyWidth / pack.bodyHeight;
            actor.style.width = `${width}px`; actor.style.height = `${size}px`;
            actor.style.transform = `translate(${point.x - width / 2}px, ${point.y - size - lift}px) scale(${sx},${sy}) rotate(${tilt}deg)`;
            const pixels = Math.ceil(size * Math.max(3, pack.span + 0.2));
            if (canvas.width !== pixels) { canvas.width = pixels; canvas.height = pixels; }
            canvas.style.width = `${pixels}px`; canvas.style.height = `${pixels}px`;
            canvas.style.left = `${width / 2 - pixels / 2}px`; canvas.style.top = `${size - pixels / 2}px`;
            const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, pixels, pixels); ctx.imageSmoothingEnabled = false;
            const frame = frameAt(sheet.durations, reduced && ['idle', 'walk'].includes(state) ? 0 : age, ['idle', 'walk', 'guard', 'charge', 'recovery'].includes(state), walking.backpedaling);
            const row = sheet.rows === 1 ? 0 : Math.min(data.direction, sheet.rows - 1);
            Object.assign(data, { sheet, row, frame });
            actor.dataset.animationSheet = name;
            actor.dataset.animationFrame = String(frame);
            const scale = size / pack.bodyHeight;
            ctx.drawImage(sheet.image, frame * sheet.width, row * sheet.height, sheet.width, sheet.height,
                pixels / 2 - sheet.width * scale / 2, pixels / 2 - (sheet.height / 2 + pack.footOffset) * scale,
                sheet.width * scale, sheet.height * scale);
            canvas.style.filter = event?.ball && state === 'recall' ? 'brightness(2) sepia(1) saturate(6) hue-rotate(310deg)' : f.hitFlashTimer > 0 ? 'brightness(1.8) drop-shadow(0 0 3px white)' : f.counterShieldTimer > 0 ? 'drop-shadow(0 0 5px cyan)' : '';
        } else {
            data.sheet = null;
            delete actor.dataset.animationSheet;
            delete actor.dataset.animationFrame;
            if (canvas) canvas.style.display = 'none';
            image.style.visibility = 'visible';
            const bounds = game.spriteBoundsCache.get(f.sprite);
            const fit = bounds ? size / bounds.height : 1;
            const width = bounds ? bounds.width * fit : size;
            actor.style.width = `${width}px`; actor.style.height = `${size}px`;
            image.style.position = 'absolute'; image.style.maxWidth = 'none'; image.style.maxHeight = 'none';
            image.style.left = bounds ? `${-bounds.left * fit}px` : '0px';
            image.style.top = bounds ? `${-bounds.top * fit}px` : '0px';
            image.style.width = bounds ? `${bounds.imageWidth * fit}px` : '100%';
            image.style.height = bounds ? `${bounds.imageHeight * fit}px` : '100%';
            const facing = walking.backpedaling && target ? Math.sign(target.x - f.x) || f.facing : f.facing;
            actor.style.transform = `translate(${point.x - width / 2}px, ${point.y - size - lift}px) scale(${-facing * sx},${sy}) rotate(${tilt}deg)`;
        }
    }

    clear() {
        this.balls.forEach(b => b.node?.remove()); this.balls = []; this.hidden = new WeakSet(); this.busyUntil = 0;
        this.ghosts.forEach(g => g.node.remove()); this.ghosts = [];
        this.actors = new WeakMap(); this.events = new WeakMap(); this.time = 0;
    }
}
