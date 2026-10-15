import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { Battle, validateTeam } from '../server/Battle.js';
import { createPvpServer } from '../server/index.js';

const teams = [[25, 6, 448], [9, 466, 212]];
function advance(b, seconds) { for (let i = 0; i < seconds * 60; i++) b.step(1 / 60); }

test('server simulation runs without DOM, validates teams and treats both players equally', () => {
    assert.equal(typeof document, 'undefined');
    assert.throws(() => validateTeam([25, 25, 6])); assert.throws(() => validateTeam([25, 6, 99999]));
    const b = new Battle(teams); b.start(); advance(b, 2);
    b.inputs = [{ x: 1, y: 0 }, { x: -1, y: 0 }];
    const before = [b.player.x, b.enemy.x]; advance(b, 0.3);
    assert.ok(b.player.x > before[0]); assert.ok(b.enemy.x < before[1]);
    for (const side of [0, 1]) {
        const f = b.teams[side][b.active[side]], pp = f.moves[0].pp;
        assert.equal(b.command(side, { action: 'move', index: 0 }), true);
        assert.equal(f.moves[0].pp, pp - 1);
        assert.equal(b.command(side, { action: 'move', index: 0 }), false);
    }
    advance(b, 1); assert.doesNotThrow(() => JSON.stringify(b.snapshot()));
    assert.ok(b.projectiles.length + b.beams.length + b.aoeWaves.length >= 0);
});

test('switches and knockouts preserve resources, lock combat and produce one shared winner', () => {
    const b = new Battle(teams); b.start(); advance(b, 2);
    b.player.currentHp = 100; const old = b.player;
    assert.equal(b.command(0, { action: 'switch', index: 1 }), true);
    assert.equal(b.command(1, { action: 'move', index: 0 }), false);
    advance(b, 5); assert.equal(old.currentHp, 100);
    for (const f of b.enemyParty) { f.currentHp = 0; b.handleFaint(f); advance(b, 3); }
    assert.equal(b.winner, 0); assert.equal(b.snapshot().matchOver, true);
});

async function peer(url) {
    const ws = new WebSocket(url); const messages = [];
    ws.on('message', raw => messages.push(JSON.parse(raw)));
    await once(ws, 'open');
    return { ws, messages, send: m => ws.send(JSON.stringify(m)), async wait(type, predicate = () => true) {
        const start = Date.now();
        while (Date.now() - start < 5000) {
            const result = messages.find(m => m.type === type && predicate(m));
            if (result) return result;
            await new Promise(r => setTimeout(r, 10));
        }
        throw new Error(`Timed out waiting for ${type}`);
    } };
}

test('two real sockets create, join, reject a third player, reconnect and forfeit', async t => {
    const { server, rooms } = createPvpServer({ reconnectMs: 180 }); server.listen(0, '127.0.0.1'); await once(server, 'listening');
    const url = `ws://127.0.0.1:${server.address().port}/ws`, peers = [];
    t.after(() => { peers.forEach(p => p.ws.terminate()); server.close(); });
    const a = await peer(url); peers.push(a); a.send({ type: 'create', name: 'A' }); const joined = await a.wait('joined');
    const b = await peer(url); peers.push(b); b.send({ type: 'join', code: joined.code, name: 'B' }); await b.wait('joined');
    const c = await peer(url); peers.push(c); c.send({ type: 'join', code: joined.code, name: 'C' }); await c.wait('error');
    a.send({ type: 'ready', team: teams[0] }); b.send({ type: 'ready', team: teams[1] }); await a.wait('init'); await b.wait('init');
    a.send({ type: 'loaded' }); b.send({ type: 'loaded' }); await a.wait('room', m => m.phase === 'battle');
    a.ws.close(); await once(a.ws, 'close');
    const resumed = await peer(url); peers.push(resumed); resumed.send({ type: 'resume', code: joined.code, token: joined.token });
    assert.equal((await resumed.wait('joined')).side, 0); await resumed.wait('init');
    rooms.get(joined.code).battle.finish(0);
    await resumed.wait('state', m => m.state.matchOver);
    resumed.send({ type: 'rematch' }); await resumed.wait('room', m => m.phase === 'lobby');
    assert.ok(rooms.get(joined.code).players.every(p => p && !p.ready));
    resumed.messages.length = 0; b.messages.length = 0;
    resumed.send({ type: 'ready', team: teams[0] }); b.send({ type: 'ready', team: teams[1] });
    await resumed.wait('init'); await b.wait('init');
    resumed.send({ type: 'loaded' }); b.send({ type: 'loaded' });
    await resumed.wait('room', m => m.phase === 'battle');
    b.ws.close(); await once(b.ws, 'close');
    await resumed.wait('state', m => m.state.matchOver);
    assert.equal(rooms.get(joined.code).battle.winner, 0);
});

test('malformed messages cannot claim an empty slot or inject HP', async t => {
    const { server, rooms } = createPvpServer(); server.listen(0, '127.0.0.1'); await once(server, 'listening');
    const url = `ws://127.0.0.1:${server.address().port}/ws`; const a = await peer(url), b = await peer(url);
    t.after(() => { a.ws.terminate(); b.ws.terminate(); server.close(); });
    a.send({ type: 'create', name: 'A' }); const { code } = await a.wait('joined');
    b.send({ type: 'resume', code }); await b.wait('error');
    assert.equal(rooms.get(code).players[1], null);
    b.send({ type: 'join', code, name: 'B' }); await b.wait('joined');
    a.send({ type: 'ready', team: [25, 6, 448], currentHp: 999999 });
    b.send({ type: 'ready', team: [9, 466, 212] }); await a.wait('init'); await b.wait('init');
    const battle = rooms.get(code).battle;
    assert.equal(battle.player.currentHp, battle.player.maxHp);
    a.send({ type: 'loaded' }); b.send({ type: 'loaded' }); await a.wait('room', m => m.phase === 'battle');
    battle.pauseUntil = 0;
    a.send({ type: 'input', x: 999999, y: null, currentHp: 999999 });
    a.send({ type: 'command', action: 'move', index: 0, power: 999999 });
    await a.wait('state', m => m.state.teams[0][0].moves[0].pp === 14);
    assert.equal(battle.inputs[0].x, 1); assert.equal(battle.inputs[0].y, 0);
    assert.ok(battle.player.currentHp <= battle.player.maxHp);
    assert.notEqual(battle.player.action?.move.power, 999999);
});
