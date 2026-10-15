import assert from 'node:assert/strict';
import { createPvpServer } from '../server/index.js';
const { server } = createPvpServer();
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const response = await fetch(base), html = await response.text();
    assert.equal(response.status, 200);
    const asset = html.match(/src="(\/assets\/[^\"]+)"/);
    assert.ok(asset, 'Built HTML must load the bundled JavaScript');
    const script = await fetch(base + asset[1]); assert.equal(script.status, 200);
    assert.match(script.headers.get('content-type'), /javascript/);
    assert.equal((await fetch(base + '/healthz').then(r => r.json())).ok, true);
    assert.equal((await fetch(base + '/api/pvp/catalog').then(r => r.json())).length, 27);
    console.log('Production HTML, JavaScript, health check and roster passed');
} finally { await new Promise(resolve => server.close(resolve)); }
