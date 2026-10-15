import { test, expect } from '@playwright/test';

test('two browsers play authoritative PvP, switch, reconnect and share a result', async ({ browser }) => {
    test.setTimeout(90000);
    const aContext = await browser.newContext(), bContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const a = await aContext.newPage(), b = await bContext.newPage(), errors = [];
    for (const p of [a, b]) p.on('pageerror', e => errors.push(e.message));
    try {
        await Promise.all([a.goto('/'), b.goto('/')]);
        for (const p of [a, b]) { await p.waitForFunction(() => window.GameEngine && !window.GameEngine.loading); await p.getByRole('button', { name: 'PLAY ONLINE PvP', exact: true }).click(); }
        await a.getByLabel('Online trainer name').fill('Ash'); await a.getByRole('button', { name: 'CREATE ROOM', exact: true }).click();
        await expect(a.locator('.pvp-code')).toHaveText(/[A-F0-9]{6}/);
        const code = await a.locator('.pvp-code').textContent();
        await b.getByLabel('Online trainer name').fill('Gary'); await b.getByLabel('Room code', { exact: true }).fill(code);
        await b.getByRole('button', { name: 'JOIN ROOM', exact: true }).click();
        await expect(b.locator('.pvp-code')).toHaveText(code);
        await b.getByLabel('Online Pokemon 1').selectOption('9'); await b.getByLabel('Online Pokemon 2').selectOption('466'); await b.getByLabel('Online Pokemon 3').selectOption('212');
        await a.getByRole('button', { name: 'READY TO BATTLE' }).click(); await b.getByRole('button', { name: 'READY TO BATTLE' }).click();
        for (const p of [a, b]) await p.waitForFunction(() => window.GameEngine.online?.status === 'battle' && !window.GameEngine.loading && !window.GameEngine.spriteAnimator.busy && !window.GameEngine.online.state.locked);
        await expect(a.locator('#playerNameHud')).toHaveText('PIKACHU'); await expect(b.locator('#playerNameHud')).toHaveText('BLASTOISE');
        const before = await a.evaluate(() => window.GameEngine.player.x);
        await a.keyboard.down('d'); await expect.poll(() => a.evaluate(() => window.GameEngine.player.targetPosition.x)).toBeGreaterThan(before + 20); await a.keyboard.up('d');
        await a.locator('#movesGrid button').first().click();
        await expect.poll(() => a.evaluate(() => window.GameEngine.player.moves[0].pp)).toBe(14);
        await expect.poll(() => b.evaluate(() => window.GameEngine.enemy.moves[0].pp)).toBe(14);
        await b.locator('#movesGrid button').first().click();
        await expect.poll(() => b.evaluate(() => window.GameEngine.player.moves[0].pp)).toBe(4);
        await a.waitForFunction(() => !window.GameEngine.player.action && !window.GameEngine.player.blitzState);
        await a.getByRole('button', { name: /^Switch to CHARIZARD$/i }).click();
        await expect(a.locator('#playerNameHud')).toHaveText('CHARIZARD'); await expect(b.locator('#enemyNameHud')).toHaveText('CHARIZARD');
        await a.waitForFunction(() => !window.GameEngine.spriteAnimator.busy && !window.GameEngine.online.state.locked);
        // Simulate delayed outbound inputs without changing the server clock or authority.
        await a.evaluate(() => {
            const socket = window.GameEngine.online.socket, send = socket.send.bind(socket);
            socket.send = data => setTimeout(() => { if (socket.readyState === 1) send(data); }, 80);
        });
        const latencyStart = await a.evaluate(() => window.GameEngine.player.targetPosition.x);
        await a.keyboard.down('d');
        await expect.poll(() => a.evaluate(() => window.GameEngine.player.targetPosition.x)).toBeGreaterThan(latencyStart + 10);
        await a.keyboard.up('d');
        await a.screenshot({ path: 'test-results/pvp-desktop.png' }); await b.screenshot({ path: 'test-results/pvp-mobile.png' });
        await b.reload();
        await b.waitForFunction(() => window.GameEngine.online?.active && !window.GameEngine.loading && window.GameEngine.player?.id === 9);
        await expect(b.locator('#enemyNameHud')).toHaveText('CHARIZARD');
        await b.getByRole('button', { name: 'ONLINE PvP', exact: true }).click(); await b.getByRole('button', { name: 'LEAVE ONLINE ROOM' }).click();
        await expect(a.locator('#resultModal')).toBeVisible(); await expect(a.locator('#resultTitle')).toHaveText('VICTORY!');
        expect(errors).toEqual([]);
    } finally { await aContext.close(); await bContext.close(); }
});
