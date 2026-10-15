import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { Battle, catalog, validateTeam } from './Battle.js';

const root = resolve(fileURLToPath(new URL('../dist/', import.meta.url)));
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.json': 'application/json', '.wasm': 'application/wasm', '.svg': 'image/svg+xml', '.xml': 'application/xml', '.txt': 'text/plain', '.md': 'text/plain' };
const send = (ws, data) => { if (ws?.readyState === WebSocket.OPEN) { if (ws.bufferedAmount > 1024 * 1024) return ws.terminate(); ws.send(JSON.stringify(data)); } };
export function createPvpServer({ reconnectMs = 30000, maxRooms = 12 } = {}) {
    const rooms = new Map();
    const server = createServer(async (req, res) => {
        try {
            const pathname = new URL(req.url, 'http://localhost').pathname;
            res.setHeader('X-Content-Type-Options', 'nosniff');
            if (pathname === '/healthz') { res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify({ ok: true, rooms: rooms.size })); }
            if (pathname === '/api/pvp/catalog') { res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify(Object.values(catalog).map(p => ({ id: p.id, name: p.name, types: p.types })))); }
            let file = resolve(root, '.' + decodeURIComponent(pathname));
            if (file !== root && !file.startsWith(root + sep)) { res.writeHead(403); return res.end(); }
            if (pathname === '/') file = resolve(root, 'index.html');
            try { if (!(await stat(file)).isFile()) throw new Error(); } catch { res.writeHead(404); return res.end('Not found'); }
            res.setHeader('Content-Type', mime[extname(file)] || 'application/octet-stream');
            res.end(await readFile(file));
        } catch { res.writeHead(400); res.end('Bad request'); }
    });
    const wss = new WebSocketServer({ noServer: true, maxPayload: 8192, perMessageDeflate: false });
    server.on('upgrade', (req, socket, head) => {
        const origin = req.headers.origin;
        let accepted = true;
        try { if (origin && new URL(origin).host !== req.headers.host) accepted = false; } catch { accepted = false; }
        if (req.url !== '/ws' || !accepted || wss.clients.size >= 48) { socket.write('HTTP/1.1 403 Forbidden\r\n\r\n'); socket.destroy(); return; }
        wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws));
    });
    function roomInfo(room) {
        return { type: 'room', code: room.code, phase: room.phase, stadium: room.stadium, teamSize: room.teamSize,
            players: room.players.map(p => p ? { name: p.name, connected: !!p.ws, ready: p.ready, team: p.team } : null) };
    }
    function notify(room) { room.players.forEach(p => send(p?.ws, roomInfo(room))); }
    function begin(room) {
        room.battle = new Battle(room.players.map(p => p.team), room.stadium, room.players.map(p => p.name), room.teamSize);
        room.phase = 'loading'; room.loaded = [false, false]; room.loadStarted = Date.now();
        room.players.forEach(p => { p.lastEvent = 0; });
        room.players.forEach((p, side) => send(p.ws, { type: 'init', side, names: room.players.map(p => p.name), state: room.battle.snapshot() }));
        notify(room);
    }
    function attach(ws, room, side) {
        const p = room.players[side]; p.ws?.close(4001, 'Session resumed in another connection');
        p.ws = ws; p.disconnectedAt = null; ws.room = room; ws.side = side;
        send(ws, { type: 'joined', code: room.code, side, token: p.token });
        p.lastEvent = room.battle?.eventId || 0;
        if (room.battle) { room.loaded[side] = false; send(ws, { type: 'init', side, names: room.players.map(p => p.name), resume: true, state: room.battle.snapshot() }); }
        notify(room);
    }
    wss.on('connection', ws => {
        ws.alive = true; ws.count = 0; ws.window = Date.now();
        ws.on('error', () => {}); ws.on('pong', () => { ws.alive = true; });
        ws.on('message', raw => {
            try {
                if (Date.now() - ws.window > 1000) { ws.window = Date.now(); ws.count = 0; }
                if (++ws.count > 100) return ws.close(1008, 'Too many messages');
                const m = JSON.parse(raw.toString());
                if (!m || typeof m !== 'object') throw new Error('Invalid message');
                if (m.type === 'ping') return send(ws, { type: 'pong', time: m.time });
                if (m.type === 'resume' && !ws.room) {
                    if (typeof m.token !== 'string' || !/^[a-f0-9]{48}$/.test(m.token)) throw new Error('Invalid reconnect token.');
                    const room = rooms.get(m.code); const side = room?.players.findIndex(p => p?.token === m.token);
                    if (!room || side < 0) throw new Error('Room expired. Create or join a new room.');
                    attach(ws, room, side); return;
                }
                if (['create', 'join'].includes(m.type) && !ws.room) {
                    const name = typeof m.name === 'string' ? m.name.trim().slice(0, 24) : '';
                    if (!name) throw new Error('Enter a trainer name.');
                    let room, side;
                    if (m.type === 'create') {
                        if (rooms.size >= maxRooms) throw new Error('Server is full. Please try again later.');
                        let code; do { code = randomBytes(4).toString('hex').slice(0, 6).toUpperCase(); } while (rooms.has(code));
                        room = { code, phase: 'lobby', stadium: 'grassy', teamSize: 3, players: [null, null], created: Date.now() }; rooms.set(code, room); side = 0;
                    } else {
                        room = rooms.get(String(m.code).toUpperCase());
                        side = room?.players.findIndex(p => !p);
                        if (!room || room.phase !== 'lobby' || side < 0) throw new Error('Room not found or already full.');
                    }
                    room.players[side] = { name, token: randomBytes(24).toString('hex'), ws: null, ready: false, team: [25, 6, 448, 9, 445, 658].slice(0, room.teamSize) };
                    attach(ws, room, side); return;
                }
                const room = ws.room, side = ws.side;
                if (!room || room.players[side]?.ws !== ws) throw new Error('Join a room first.');
                if (m.type === 'leave') { if (room.battle && !room.battle.matchOver) room.battle.finish(1 - side, 'forfeit'); room.players[side].token = ''; ws.close(1000, 'Left room'); return; }
                if (m.type === 'format' && room.phase === 'lobby') {
                    if (side !== 0) throw new Error('Only the host can change the battle format.');
                    if (![3, 6].includes(m.teamSize)) throw new Error('Choose the 3-Pokémon or 6-Pokémon format.');
                    if (room.teamSize !== m.teamSize) {
                        room.teamSize = m.teamSize;
                        room.players.forEach(p => { if (p) {
                            p.ready = false;
                            p.team = [...new Set([...p.team, ...Object.values(catalog).map(p => p.id)])].slice(0, room.teamSize);
                        } });
                    }
                    notify(room);
                } else if (m.type === 'ready' && room.phase === 'lobby') {
                    room.players[side].team = validateTeam(m.team, room.teamSize); room.players[side].ready = true;
                    if (side === 0 && ['grassy', 'rocky', 'magma', 'ice_water'].includes(m.stadium)) room.stadium = m.stadium;
                    notify(room);
                    if (room.players.every(p => p?.ws && p.ready)) begin(room);
                } else if (m.type === 'loaded' && room.battle) {
                    room.loaded[side] = true;
                    if (room.phase === 'loading' && room.loaded.every(Boolean)) { room.phase = 'battle'; room.battle.start(); notify(room); }
                } else if (m.type === 'input' && room.phase === 'battle' && !room.battle.matchOver) {
                    const finite = n => typeof n === 'number' && Number.isFinite(n) ? Math.max(-1, Math.min(1, n)) : 0;
                    room.battle.inputs[side] = { x: finite(m.x), y: finite(m.y), guard: m.guard === true, fly: m.fly === true, received: Date.now() };
                } else if (m.type === 'command' && room.phase === 'battle' && room.players.every(p => p?.ws)) room.battle.command(side, m);
                else if (m.type === 'rematch' && room.battle?.matchOver) {
                    room.battle = null; room.phase = 'lobby'; room.created = Date.now();
                    room.players = room.players.map(p => p?.ws ? { ...p, ready: false } : null); notify(room);
                }
            } catch (error) { send(ws, { type: 'error', message: error.message || 'Invalid request' }); }
        });
        ws.on('close', () => {
            const room = ws.room, p = room?.players[ws.side];
            if (p?.ws === ws) { p.ws = null; p.disconnectedAt = Date.now(); if (room.battle) room.battle.inputs[ws.side] = {}; notify(room); }
        });
    });
    let tick = 0, previousTick = performance.now(), accumulator = 0;
    const timer = setInterval(() => {
        const clock = performance.now(); accumulator += Math.min(0.1, (clock - previousTick) / 1000); previousTick = clock;
        const steps = Math.min(6, Math.floor(accumulator * 60)); accumulator -= steps / 60;
        for (const [code, room] of rooms) {
            const now = Date.now();
            if (room.phase === 'loading' && now - room.loadStarted > 60000) {
                room.battle.loading = false; room.phase = 'battle'; room.battle.finish(room.loaded[0] ? 0 : 1, 'loading timeout');
            }
            if (room.phase === 'lobby' && now - room.created > 30 * 60 * 1000) { rooms.delete(code); room.players.forEach(p => p?.ws?.close(1000, 'Room expired')); continue; }
            for (let side = 0; side < 2; side++) {
                const p = room.players[side];
                if (p && !p.ws && p.disconnectedAt && now - p.disconnectedAt > reconnectMs) {
                    if (room.battle && !room.battle.matchOver) room.battle.finish(1 - side, 'disconnect');
                    if (room.phase === 'lobby') { rooms.delete(code); room.players.forEach(p => p?.ws?.close(1000, 'Room expired')); }
                }
            }
            if (room.players.every(p => !p?.ws) && now - Math.max(...room.players.map(p => p?.disconnectedAt || room.created)) > reconnectMs) { rooms.delete(code); continue; }
            if (!room.battle) continue;
            const b = room.battle;
            const interrupted = !room.players.every(p => p?.ws) || !room.loaded.every(Boolean);
            b.paused = interrupted && !b.matchOver;
            b.inputs.forEach((input, side) => { if (now - (input.received || 0) > 500) b.inputs[side] = {}; });
            for (let step = 0; step < steps; step++) b.step(1 / 60);
            if (tick % 4 === 0) {
                const state = b.snapshot(true);
                room.players.forEach(p => {
                    if (!p?.ws) return;
                    send(p.ws, { type: 'state', state: { ...state, events: state.events.filter(e => e.seq > (p.lastEvent || 0)) }, disconnected: interrupted });
                    p.lastEvent = state.eventId;
                });
            }
        }
        tick++;
    }, 1000 / 60);
    const heartbeat = setInterval(() => wss.clients.forEach(ws => { if (!ws.alive) return ws.terminate(); ws.alive = false; ws.ping(); }), 25000);
    server.on('close', () => { clearInterval(timer); clearInterval(heartbeat); wss.clients.forEach(ws => ws.terminate()); wss.close(); });
    return { server, rooms };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const { server } = createPvpServer();
    server.listen(Number(process.env.PORT) || 4317, '0.0.0.0', () => console.log(`Pokémon PvP listening on ${server.address().port}`));
    process.on('SIGTERM', () => { server.close(); setTimeout(() => process.exit(0), 1000).unref(); });
}
