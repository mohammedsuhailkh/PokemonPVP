import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

// Render the actual, unmodified Showmotion .efkwgd effects to transparent atlases.
// Start Vite first. WebGPU is needed for baking, never for playing the game.
const baseURL = process.env.SHOWMOTION_BASE_URL || 'http://127.0.0.1:4173';
const selected = process.argv.slice(2);
const effects = selected.length ? selected : ['hydropump', 'shadowball', 'moonblast', 'mysticalfire',
    'psychic', 'gunkshot', 'flowertrick', 'swordsdance', 'willowisp', 'land'];
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-webgpu'] });
try {
    const page = await browser.newPage();
    page.on('pageerror', error => console.error(error.message));
    await page.route('**/__showmotion_bake', route => route.fulfill({ contentType: 'text/html', body:
        '<html><body style="margin:0;background:transparent"><canvas id="effectBake" width="512" height="320"></canvas></body></html>' }));
    await page.goto(`${baseURL}/__showmotion_bake`);
    await page.addScriptTag({ url: `${baseURL}/showmotion/runtime/Demo_Runtime.js` });
    await page.addScriptTag({ url: `${baseURL}/showmotion/runtime/demo.src.js` });
    await page.evaluate(async () => {
        const efk = globalThis.effekseerDemo;
        efk.setLogEnabled(false);
        let failure;
        await efk.initRuntime('/showmotion/runtime/Demo_Runtime.wasm', null, error => { failure = error; });
        if (failure) throw failure;
        const ctx = efk.createContext();
        if (!ctx?.init('#effectBake', { linearColorSpace: false, compositeWithBackground: false }))
            throw new Error('Could not initialize the Showmotion WebGPU renderer.');
        // Use the same perspective matrix as Showmotion's 25-degree Three camera.
        const f = 1 / Math.tan(25 * Math.PI / 360), near = 0.1, far = 1000;
        ctx.setProjectionMatrix([f / (512 / 320), 0, 0, 0, 0, f, 0, 0,
            0, 0, -far / (far - near), -1, 0, 0, -far * near / (far - near), 0]);
        ctx.setCameraLookAt(-9.4, 7.7, 8.1, -0.1, 0.1, -0.5, 0, 1, 0);
        globalThis.bakeContext = ctx;
    });
    await mkdir('public/showmotion/atlases', { recursive: true });
    const manifest = {};
    for (const id of effects) {
        const result = await page.evaluate(async id => {
            const ctx = globalThis.bakeContext;
            ctx.stopAllEffects();
            const effect = await new Promise((resolve, reject) => {
                const effect = ctx.loadEffect(`/showmotion/effects/${id}/${id}.efkwgd`, 1,
                    () => resolve(effect), (message, path) => reject(new Error(`${message}: ${path}`)));
            });
            const handle = ctx.play(effect, 0, 0, 0);
            if (!handle) throw new Error(`Could not play ${id}`);
            handle.setRandomSeed(72);
            const count = 75, cols = 8, width = 512, height = 320;
            const atlas = document.createElement('canvas');
            atlas.width = width * cols; atlas.height = height * Math.ceil(count / cols);
            const target = atlas.getContext('2d');
            const canvas = document.getElementById('effectBake');
            // Sample five seconds at 15 fps from the original 60 Hz motion.
            for (let i = 0; i < count; i++) {
                ctx.update(i ? 4 : 1); ctx.draw();
                // Snapshot in the same task; WebGPU clears presented textures after
                // compositing, so awaiting here would introduce empty frames.
                target.drawImage(canvas, i % cols * width, Math.floor(i / cols) * height);
            }
            ctx.stopAllEffects(); ctx.releaseEffect(effect);
            // The native internal renderer clears to black. Key only its black
            // backing, preserving the effect's original hues and sampled motion.
            const imageData = target.getImageData(0, 0, atlas.width, atlas.height);
            const pixels = imageData.data;
            let visible = 0;
            let firstFrame = count, lastFrame = 0;
            let minX = width, minY = height, maxX = 0, maxY = 0;
            for (let y = 0; y < atlas.height; y++) for (let x = 0; x < atlas.width; x++) {
                const i = (y * atlas.width + x) * 4;
                const light = Math.max(pixels[i], pixels[i + 1], pixels[i + 2]);
                pixels[i + 3] = Math.round(pixels[i + 3] * Math.min(1, light / 40));
                if (light > 12 && pixels[i + 3] > 8) {
                    visible++;
                    const frame = Math.floor(y / height) * cols + Math.floor(x / width);
                    firstFrame = Math.min(firstFrame, frame); lastFrame = Math.max(lastFrame, frame);
                    minX = Math.min(minX, x % width); minY = Math.min(minY, y % height);
                    maxX = Math.max(maxX, x % width); maxY = Math.max(maxY, y % height);
                }
            }
            target.putImageData(imageData, 0, 0);
            const left = Math.max(0, minX - 4), top = Math.max(0, minY - 4);
            const frameWidth = Math.min(width, maxX + 5) - left;
            const frameHeight = Math.min(height, maxY + 5) - top;
            const frames = Math.max(1, lastFrame - firstFrame + 1);
            const cropped = document.createElement('canvas');
            cropped.width = frameWidth * cols; cropped.height = frameHeight * Math.ceil(frames / cols);
            const croppedCtx = cropped.getContext('2d');
            const bounds = [];
            for (let i = 0; i < frames; i++) {
                const sourceFrame = firstFrame + i;
                croppedCtx.drawImage(atlas, sourceFrame % cols * width + left, Math.floor(sourceFrame / cols) * height + top,
                    frameWidth, frameHeight, i % cols * frameWidth, Math.floor(i / cols) * frameHeight, frameWidth, frameHeight);
                const frameData = target.getImageData(sourceFrame % cols * width + left,
                    Math.floor(sourceFrame / cols) * height + top, frameWidth, frameHeight).data;
                let x0 = frameWidth, y0 = frameHeight, x1 = 0, y1 = 0, sx = 0, sy = 0, n = 0;
                for (let y = 0; y < frameHeight; y++) for (let x = 0; x < frameWidth; x++) {
                    const offset = (y * frameWidth + x) * 4;
                    if (frameData[offset + 3] < 24) continue;
                    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
                    sx += x; sy += y; n++;
                }
                const cx = n ? sx / n : frameWidth / 2, cy = n ? sy / n : frameHeight / 2;
                let xx = 0, xy = 0, yy = 0;
                for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
                    if (frameData[(y * frameWidth + x) * 4 + 3] < 24) continue;
                    xx += (x - cx) ** 2; yy += (y - cy) ** 2; xy += (x - cx) * (y - cy);
                }
                const angle = Math.atan2(2 * xy, xx - yy) / 2;
                let major = 1, minor = 1;
                for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
                    if (frameData[(y * frameWidth + x) * 4 + 3] < 24) continue;
                    major = Math.max(major, Math.abs((x - cx) * Math.cos(angle) + (y - cy) * Math.sin(angle)) * 2);
                    minor = Math.max(minor, Math.abs(-(x - cx) * Math.sin(angle) + (y - cy) * Math.cos(angle)) * 2);
                }
                bounds.push({ x: n ? x0 : 0, y: n ? y0 : 0, w: n ? x1 - x0 + 1 : 1, h: n ? y1 - y0 + 1 : 1,
                    cx, cy, angle, major, minor, visible: n });
            }
            return { data: cropped.toDataURL('image/webp', 0.92).split(',')[1], visible,
                firstFrame, lastFrame, width: frameWidth, height: frameHeight, cols, frames, fps: 15, duration: frames / 15, bounds };
        }, id);
        const { data, ...meta } = result;
        if (!meta.visible) throw new Error(`Empty render for ${id}; refusing to save an invisible animation.`);
        await writeFile(`public/showmotion/atlases/${id}.webp`, Buffer.from(data, 'base64'));
        manifest[id] = { ...meta, src: `/showmotion/atlases/${id}.webp` };
        console.log(`${id}: ${meta.visible} visible pixels, ${Math.round(Buffer.from(data, 'base64').length / 1024)} KiB`);
    }
    await writeFile(`public/showmotion/atlases/${selected.length ? 'preview-manifest' : 'manifest'}.json`, JSON.stringify(manifest, null, 2));
    if (!selected.length) await writeFile('src/game/ShowmotionAssets.js',
        '// Generated from the original Showmotion effects by scripts/bake-showmotion.mjs.\nexport default ' + JSON.stringify(manifest) + ';\n');
} finally { await browser.close(); }
