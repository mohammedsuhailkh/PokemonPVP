import { SoundEngine } from './SoundEngine.js';
import { TYPE_CHART, TYPE_COLORS, RIVALRIES, STADIUM_THEMES } from './constants.js';
import { PokeApiService } from './PokeApiService.js';
import { CombatSystem } from './CombatSystem.js';
import { ShowmotionAnimations } from './ShowmotionAnimations.js';
import { projectGround, unprojectGround, fighterSpriteSize, traceGroundCircle } from './ArenaProjection.js';
import { renderArenaBackground } from './ArenaRenderer.js';
import { PokemonAnimator } from './PokemonAnimator.js';
import { renderPokeballs } from './PokeballRenderer.js';
import { BattlePresentation, muzzleKind } from './BattlePresentation.js';

        export const GameEngine = {
            ...CombatSystem,
            audio: SoundEngine,
            uiElement(id) { return document.getElementById(id); },
            setOverlay(id, opacity) { const el = this.uiElement(id); if (el) el.style.opacity = opacity; },
            captureVisualOrigin(owner, x, y, move) {
                return owner ? { x, y, z: owner.z, id: owner.id, speciesId: owner.speciesId, height: owner.height, visualAnchor: this.spriteAnimator.attachment(owner, muzzleKind(owner, move)) } : null;
            },
            moveAnimations: null,
            spriteAnimator: new PokemonAnimator(),
            presentation: new BattlePresentation(),
            moveDeckOwner: null,
            queuedMove: null,
            attackFeedback: null,
            animFrameId: null,
            loading: false,
            matchRequestId: 0,
            battleConfig: null,
            signatureReady: false,
            flyHeld: false,
            visualTimers: new Set(),
            accumulator: 0,
            hudTimer: 0,
            listeners: [],
            currentStadium: 'grassy',
            stadiumImages: {},
            spriteBoundsCache: new Map(),

            canvas: null,
            ctx: null,
            width: 960,
            height: 500,

            // 2.5D World Bounds & Perspective Constants
            WORLD_HALF_W: 470,
            WORLD_HALF_H: 255,
            Y_SCALE: 0.62, // Semi-top-down 2.5D foreshortening ratio

            // Dynamic Camera State
            camera: {
                x: 0,
                y: 0,
                zoom: 1.0,
                targetZoom: 1.0,
                shakeTimer: 0,
                shakeMagnitude: 0
            },

            // Match State
            playerTrainer: 'ASH KETCHUM',
            enemyTrainer: 'RIVAL GARY OAK',
            playerParty: [],
            enemyParty: [],
            playerActiveIdx: 0,
            enemyActiveIdx: 0,
            matchOver: false,
            paused: false,
            hitStopTimer: 0,
            timeScale: 1.0,
            slowMoTimer: 0,

            // Player Bond Sync & Overdrive
            bondSync: 25,
            overdriveTimer: 0,
            matchElapsed: 0,

            // Input & Aiming State
            keys: {},
            joyVec: { x: 0, y: 0, active: false },
            aimMode: 'auto', // 'auto' or 'cursor'
            mouseWorld: { x: 200, y: 0 },

            // Pre-generated Stadium Spectators & Floodlights for Realistic Colosseum Atmosphere
            crowdSpectators: [],

            // Spatial Entities in 2.5D Arena
            projectiles: [],
            beams: [],
            aoeWaves: [],
            hazards: [],     // { type: 'puddle' | 'electrified_puddle' | 'magma', x, y, radius, timer }
            pillars: [],     // { x, y, radius, hp, maxHp, height }
            particles: [],
            floatingTexts: [],

            // Enemy Real-Time AI State
            ai: {
                state: 'STRAFE',
                strafeDir: 1,
                thinkTimer: 0,
                attackCooldown: 1.2
            },

            get player() {
                return this.playerParty[this.playerActiveIdx];
            },
            get enemy() {
                return this.enemyParty[this.enemyActiveIdx];
            },

            setStadium(stadiumKey) {
                if (this.online?.active && !this.online.applying) return;
                if (STADIUM_THEMES[stadiumKey]) {
                    this.currentStadium = stadiumKey;
                    const sum = document.getElementById('fieldStatusSummary');
                    if (sum) sum.innerText = `STADIUM: ${STADIUM_THEMES[stadiumKey].name.toUpperCase()}`;
                    this.logAnnouncer(`🏟️ Battlefield transitioned to ${STADIUM_THEMES[stadiumKey].name}!`, 'cyan');
                    if (this.player && this.enemy && !this.loading) this.resetBattlefield();
                }
            },

            preloadStadiumImages() {
                if (typeof window === 'undefined') return;
                this.stadiumImagePromises = {};
                Object.values(STADIUM_THEMES).forEach(theme => {
                    const img = new Image();
                    img.src = theme.image;
                    this.stadiumImages[theme.id] = img;
                    this.stadiumImagePromises[theme.id] = img.decode().catch(() => null);
                });
            },

            init() {
                this.canvas = document.getElementById('stadiumCanvas');
                this.ctx = this.canvas.getContext('2d');
                this.effectsCanvas = document.getElementById('moveEffectsCanvas');
                this.effectsCtx = this.effectsCanvas.getContext('2d');
                this.moveAnimations = new ShowmotionAnimations();
                this.resize();
                this.addTrackedListener(window, 'resize', () => this.resize());
                this.arenaResizeObserver = new ResizeObserver(() => this.resize());
                this.arenaResizeObserver.observe(this.canvas.parentElement);

                this.preloadStadiumImages();
                this.generateStadiumSpectators();
                this.bindControls();
                this.paused = true;
                this.initMatch('ash_gary');
                this.paused = true; // Wait for player to hit start / select squad in Start Menu

                this.lastTime = performance.now();
                this.animFrameId = requestAnimationFrame((t) => this.loop(t));
            },

            generateStadiumSpectators() {
                this.crowdSpectators = [];
                const colors = ['#38bdf8', '#facc15', '#f43f5e', '#a855f7', '#4ade80', '#ffffff'];
                for (let row = 0; row < 3; row++) {
                    const count = 46 + row * 8;
                    for (let i = 0; i < count; i++) {
                        this.crowdSpectators.push({
                            row,
                            pct: (i + 0.5) / count,
                            color: colors[(i * 7 + row * 3) % colors.length],
                            phase: Math.random() * Math.PI * 2,
                            speed: 3 + Math.random() * 3
                        });
                    }
                }
            },

            resize() {
                if (!this.canvas) return;
                const rect = this.canvas.parentElement.getBoundingClientRect();
                this.width = rect.width;
                this.height = rect.height;
                this.canvas.width = this.width * window.devicePixelRatio;
                this.canvas.height = this.height * window.devicePixelRatio;
                this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
                if (this.effectsCanvas) {
                    this.effectsCanvas.width = this.width * window.devicePixelRatio;
                    this.effectsCanvas.height = this.height * window.devicePixelRatio;
                    this.effectsCtx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
                }
                const center = projectGround(0, 0, 0, this.width, this.height);
                this.camera.zoom = 1;
                this.Y_SCALE = center.scaleY / center.scale;
                this.updateActors();
            },

            setKeyVisual(id, active) {
                const el = document.getElementById(id);
                if (el) el.classList.toggle('keycap-active', active);
            },

            
            addTrackedListener(target, type, handler, options) {
                if (!target || !target.addEventListener) return;
                target.addEventListener(type, handler, options);
                this.listeners.push({ target, type, handler, options });
            },

            bindControls() {
                this.addTrackedListener(document.getElementById('movesGrid'), 'click', e => {
                    const button = e.target.closest('button[data-move-index]');
                    if (button && !button.disabled) this.useMove(Number(button.dataset.moveIndex));
                });
                this.addTrackedListener(window, 'keydown', (e) => {
                    if (e.target instanceof HTMLElement && (e.target.matches('input, textarea, select') || e.target.isContentEditable)) return;
                    if (e.target instanceof HTMLElement && e.target.closest('button') && e.key === 'Enter') return;
                    if (!this.canCommand()) return;
                    this.keys[e.key.toLowerCase()] = true;
                    if (e.key.toLowerCase() === 'q') this.setGuard(true);
                    if (e.repeat) return;
                    if (e.code === 'Space' || e.key === ' ') {
                        this.keys['space'] = true;
                        e.preventDefault();
                    }
                    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) {
                        e.preventDefault();
                    }

                    // Key bindings mapping
                    if (e.key === '1' || e.key === 'j' || e.key === 'J') this.useMove(0);
                    if (e.key === '2' || e.key === 'k' || e.key === 'K') this.useMove(1);
                    if (e.key === '3' || e.key === 'l' || e.key === 'L') this.useMove(2);
                    if (e.key === '4' || e.key === 'u' || e.key === 'U') this.useMove(3);
                    if (e.key === ' ' || e.code === 'Space' || e.key === 'Shift') this.triggerDodgeDash();
                    if (e.key === 'e' || e.key === 'E' || e.key === 'i' || e.key === 'I') this.triggerCounterShield();
                    if (e.key === 'r' || e.key === 'R') this.activateOverdrive();
                    if (e.key === 'f' || e.key === 'F') this.toggleAimMode();
                    if (e.key === 'z' || e.key === 'Z') this.switchPartyOffset(1);
                    if (e.key === 'x' || e.key === 'X') this.switchPartyOffset(2);
                    if (e.key === 'c' || e.key === 'C' || e.key === 'Tab') {
                        e.preventDefault();
                        this.switchPartyOffset(1);
                    }
                });

                this.addTrackedListener(window, 'keyup', (e) => {
                    this.keys[e.key.toLowerCase()] = false;
                    if (e.key.toLowerCase() === 'q') this.setGuard(false);
                    if (e.code === 'Space' || e.key === ' ') {
                        this.keys['space'] = false;
                    }
                });

                // Mouse Aim & Guard on Viewport
                const vp = document.getElementById('arenaViewport');
                this.addTrackedListener(vp, 'mousemove', (e) => {
                    const rect = vp.getBoundingClientRect();
                    this.mouseScreen = { x: e.clientX - rect.left, y: e.clientY - rect.top };
                    this.mouseWorld = this.screenToWorld(this.mouseScreen.x, this.mouseScreen.y);
                });

                this.addTrackedListener(vp, 'contextmenu', (e) => e.preventDefault());
                this.addTrackedListener(vp, 'mousedown', e => { if (e.button === 2) this.setGuard(true); });
                this.addTrackedListener(window, 'mouseup', e => { if (e.button === 2) this.setGuard(false); });
                this.addTrackedListener(window, 'blur', () => this.clearInput());
                this.addTrackedListener(document, 'visibilitychange', () => { if (document.hidden) this.clearInput(); });

                // Virtual On-Screen Joystick Drag
                const joyZone = document.getElementById('virtualJoystickZone');
                const knob = document.getElementById('joystickKnob');
                let joyActive = false;
                let joyCenter = { x: 0, y: 0 };

                const handleJoyStart = (clientX, clientY) => {
                    if (!this.canCommand()) return;
                    joyActive = true;
                    const rect = joyZone.getBoundingClientRect();
                    joyCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
                };
                const handleJoyMove = (clientX, clientY) => {
                    if (!joyActive || !this.canCommand()) return;
                    const dx = clientX - joyCenter.x;
                    const dy = clientY - joyCenter.y;
                    const dist = Math.hypot(dx, dy);
                    const maxR = 36;
                    const angle = Math.atan2(dy, dx);
                    const clampedDist = Math.min(dist, maxR);

                    const kx = Math.cos(angle) * clampedDist;
                    const ky = Math.sin(angle) * clampedDist;
                    knob.style.transform = `translate(${kx}px, ${ky}px)`;

                    this.joyVec.x = clampedDist > 6 ? Math.cos(angle) * (clampedDist / maxR) : 0;
                    this.joyVec.y = clampedDist > 6 ? Math.sin(angle) * (clampedDist / maxR) : 0;
                    this.joyVec.active = clampedDist > 6;
                };
                const handleJoyEnd = () => {
                    joyActive = false;
                    knob.style.transform = `translate(0px, 0px)`;
                    this.joyVec.x = 0;
                    this.joyVec.y = 0;
                    this.joyVec.active = false;
                };
                this.resetJoystick = handleJoyEnd;

                this.addTrackedListener(joyZone, 'mousedown', (e) => handleJoyStart(e.clientX, e.clientY));
                this.addTrackedListener(window, 'mousemove', (e) => handleJoyMove(e.clientX, e.clientY));
                this.addTrackedListener(window, 'mouseup', handleJoyEnd);

                this.addTrackedListener(joyZone, 'touchstart', (e) => {
                    handleJoyStart(e.touches[0].clientX, e.touches[0].clientY);
                    e.preventDefault();
                }, { passive: false });
                this.addTrackedListener(window, 'touchmove', (e) => {
                    if (e.touches.length > 0) handleJoyMove(e.touches[0].clientX, e.touches[0].clientY);
                }, { passive: true });
                this.addTrackedListener(window, 'touchend', handleJoyEnd);
                this.addTrackedListener(window, 'touchcancel', handleJoyEnd);

            },

            async initMatch(rivalryKey = 'ash_gary', customTeams = null) {
                if (this.online?.active) return false;
                const requestId = ++this.matchRequestId;
                const rivalry = customTeams || RIVALRIES[rivalryKey] || RIVALRIES.ash_gary;
                this.loading = true;
                if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('battlestatus', { detail: { error: null } }));
                this.clearInput();
                document.getElementById('loadingOverlay').classList.remove('hidden');
                this.hitStopTimer = 0;
                document.getElementById('resultModal').classList.add('hidden');
                try {
                    const [playerParty, enemyParty] = await Promise.all([
                        Promise.all(rivalry.playerTeam.map(entry => PokeApiService.fetchPokemon(entry))),
                        Promise.all(rivalry.enemyTeam.map(entry => PokeApiService.fetchPokemon(entry))),
                        this.moveAnimations?.preload(),
                        this.stadiumImagePromises?.[this.currentStadium]
                    ]);
                    await Promise.all([
                        this.prepareCombatantSprites([...playerParty, ...enemyParty]),
                        this.spriteAnimator.prepare([...playerParty, ...enemyParty])
                    ]);
                    if (requestId !== this.matchRequestId) return false;
                    if (!playerParty.length || !enemyParty.length) throw new Error('Both teams need a Pokemon.');
                    this.battleConfig = JSON.parse(JSON.stringify(rivalry));
                    this.playerParty = playerParty; this.enemyParty = enemyParty;
                    playerParty.forEach(f => { f.presentationSide = 'player'; });
                    enemyParty.forEach(f => { f.presentationSide = 'enemy'; });
                    this.playerActiveIdx = 0; this.enemyActiveIdx = 0;
                    this.playerTrainer = rivalry.playerTrainer; this.enemyTrainer = rivalry.enemyTrainer;
                    document.getElementById('playerTrainerLabel').textContent = `${this.playerTrainer} (YOU)`;
                    document.getElementById('enemyTrainerLabel').textContent = this.enemyTrainer;
                    this.matchOver = false; this.bondSync = 0; this.overdriveTimer = 0;
                    this.signatureReady = false; this.matchElapsed = 0; this.accumulator = 0;
                    this.slowMoTimer = 0; this.flashTimer = 0;
                    this.projectiles = []; this.beams = []; this.aoeWaves = [];
                    this.particles = []; this.floatingTexts = [];
                    this.moveAnimations?.clear(); this.moveDeckOwner = null;
                    this.spriteAnimator.clear();
                    this.presentation.clear(); this.camera.x = this.camera.y = 0; this.camera.zoom = 1;
                    this.ai = { state: 'APPROACH', strafeDir: 1, thinkTimer: 0, attackCooldown: 1.2, moveX: 0, moveY: 0, flying: false };
                    this.player.x = -240; this.player.y = 30; this.player.facing = 1;
                    this.enemy.x = 240; this.enemy.y = -30; this.enemy.facing = -1;
                    this.pendingResult = null;
                    this.spriteAnimator.sendOut(this.player);
                    this.spriteAnimator.sendOut(this.enemy);
                    this.resetBattlefield();
                    document.getElementById('speedLinesOverlay').style.opacity = '0';
                    document.getElementById('perfectDodgeFlash').style.opacity = '0';
                    document.getElementById('announcerLog').replaceChildren();
                    this.updateHud(); this.renderPartySwitchBar(); this.renderMovesDeck(); this.updateActors();
                    this.logAnnouncer(`${this.playerTrainer} sends out ${this.player.name}!`, 'amber');
                    this.logAnnouncer(`${this.enemyTrainer} sends out ${this.enemy.name}!`, 'red');
                    if ([...playerParty, ...enemyParty].some(pk => pk.offline))
                        this.logAnnouncer('Using local Pokemon data while PokeAPI is unavailable. Sprites still require a connection.', 'amber');
                    return true;
                } catch (error) {
                    if (requestId === this.matchRequestId) {
                        this.logAnnouncer(error.message, 'red');
                        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('battlestatus', { detail: { error: error.message } }));
                        if (this.matchOver) document.getElementById('resultModal').classList.remove('hidden');
                    }
                    return false;
                } finally {
                    if (requestId === this.matchRequestId) {
                        this.loading = false;
                        document.getElementById('loadingOverlay').classList.add('hidden');
                        this.renderMovesDeck();
                    }
                }
            },

            rematch() {
                return this.initMatch('custom', this.battleConfig || RIVALRIES.ash_gary);
            },

            clearInput() {
                if (this.online) this.online.guardHeld = false;
                this.queuedMove = null;
                this.attackFeedback = null;
                this.keys = {}; this.joyVec = { x: 0, y: 0, active: false }; this.flyHeld = false;
                this.resetJoystick?.();
                for (const f of [this.player, this.enemy]) if (f) f.guarding = false;
                const knob = document.getElementById('joystickKnob');
                if (knob) knob.style.transform = 'translate(0px, 0px)';
            },

            toggleAimMode() {
                this.aimMode = this.aimMode === 'auto' ? 'cursor' : 'auto';
                const txt = document.getElementById('aimModeText');
                txt.innerText = this.aimMode === 'auto' ? 'AIM: AUTO-LOCK [F]' : 'AIM: CURSOR [F]';
                window.dispatchEvent(new CustomEvent('aimmodechange', { detail: this.aimMode }));
                this.logAnnouncer(`Aim Mode switched to: ${this.aimMode.toUpperCase()}`, 'cyan');
            },

            spawnExplosion(x, y, colorHex) {
                for (let i = 0; i < 18; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const speed = 60 + Math.random() * 180;
                    this.particles.push({
                        x, y, z: 15,
                        vx: Math.cos(angle) * speed,
                        vy: Math.sin(angle) * speed,
                        vz: (Math.random() - 0.5) * 120,
                        color: colorHex,
                        radius: 3 + Math.random() * 4,
                        alpha: 1.0,
                        life: 0.4 + Math.random() * 0.3
                    });
                }
            },

            spawnFloatingText(text, x, y, color) {
                this.floatingTexts.push({
                    text, x, y, color,
                    vy: -45,
                    alpha: 1.0,
                    life: 0.85
                });
            },

            triggerAnimeCallout(trainerName, subtitle, glowHex) {
                const banner = document.getElementById('animeCalloutBanner');
                const sub = document.getElementById('animeCalloutSub');
                const main = document.getElementById('animeCalloutMain');
                const bg = document.getElementById('animeCalloutBg');

                sub.innerText = `${trainerName.toUpperCase()} COMMANDS`;
                main.innerText = subtitle;
                bg.style.borderColor = glowHex;

                banner.classList.remove('hidden');
                banner.classList.remove('banner-slash-active');
                void banner.offsetWidth; // trigger reflow
                banner.classList.add('banner-slash-active');

                if (this.calloutTimer) { clearTimeout(this.calloutTimer); this.visualTimers.delete(this.calloutTimer); }
                this.calloutTimer = setTimeout(() => {
                    banner.classList.add('hidden');
                    this.visualTimers.delete(this.calloutTimer);
                }, 1350);
                this.visualTimers.add(this.calloutTimer);
            },

            logAnnouncer(msg, colorStyle = 'slate') {
                const log = document.getElementById('announcerLog');
                const div = document.createElement('div');
                div.className = `text-[11px] font-bold border-l-2 pl-1.5 py-0.5 ${
                    colorStyle === 'amber' ? 'border-amber-400 text-amber-300 bg-amber-950/20' :
                    colorStyle === 'red' ? 'border-red-500 text-red-300 bg-red-950/20' :
                    colorStyle === 'cyan' ? 'border-cyan-400 text-cyan-300 bg-cyan-950/20' :
                    colorStyle === 'purple' ? 'border-purple-400 text-purple-300 bg-purple-950/20' :
                    'border-slate-600 text-slate-300'
                }`;
                div.textContent = `[${Math.floor(this.matchElapsed / 60).toString().padStart(2, '0')}:${Math.floor(this.matchElapsed % 60).toString().padStart(2, '0')}] ${msg}`;
                log.appendChild(div);
                log.scrollTop = log.scrollHeight;
                while (log.children.length > 28) {
                    log.removeChild(log.firstChild);
                }
            },

            // Main Update Loop
            loop(timestamp) {
                const elapsed = Math.min(0.05, Math.max(0, (timestamp - this.lastTime) / 1000));
                this.lastTime = timestamp;
                this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
                if (!this.paused && !this.loading) this.presentation.update(elapsed, this);
                if (this.mouseScreen) this.mouseWorld = this.screenToWorld(this.mouseScreen.x, this.mouseScreen.y);
                if (!this.paused && !this.loading) this.spriteAnimator.tick(elapsed, this);
                if (!this.online?.active && !this.paused && !this.loading && this.spriteAnimator.busy) this.updateTransientVisuals(elapsed);
                if (this.online?.active && !this.loading) this.online.tick(elapsed);
                if (this.pendingResult && !this.paused && !this.loading && !this.spriteAnimator.busy) {
                    if (this.matchOver && this.pendingResult.requestId === this.matchRequestId) this.pendingResult.modal.classList.remove('hidden');
                    this.pendingResult = null;
                }
                if (this.matchOver && !this.paused) this.updateActors();
                if (!this.online?.active && !this.matchOver && !this.paused && !this.loading) {
                    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
                    const stopped = this.hitStopTimer > 0;
                    this.hitStopTimer = Math.max(0, this.hitStopTimer - elapsed);
                    this.slowMoTimer = Math.max(0, this.slowMoTimer - elapsed);
                    this.accumulator += stopped || this.spriteAnimator.busy ? 0 : elapsed * (this.slowMoTimer > 0 ? 0.45 : 1);
                    const step = 1 / 120;
                    while (this.accumulator >= step && !this.matchOver) {
                        this.updateAi(step);
                        this.updatePhysics(step);
                        this.matchElapsed += step;
                        this.accumulator -= step;
                        if (this.hitStopTimer > 0 || this.spriteAnimator.busy) { this.accumulator = 0; break; }
                    }
                    this.updateActors();
                    this.hudTimer += elapsed;
                    if (this.hudTimer >= 0.1) { this.hudTimer = 0; this.updateHud(); this.renderMovesDeck(); this.renderPartySwitchBar(); }
                } else this.accumulator = 0;
                if (this.flashTimer > 0) {
                    this.flashTimer = Math.max(0, this.flashTimer - elapsed);
                    if (!this.flashTimer) document.getElementById('perfectDodgeFlash').style.opacity = '0';
                }
                this.camera.shakeTimer = Math.max(0, this.camera.shakeTimer - elapsed);
                const clock = document.getElementById('matchClockHud');
                if (clock) clock.textContent = `${Math.floor(this.matchElapsed / 60).toString().padStart(2, '0')}:${Math.floor(this.matchElapsed % 60).toString().padStart(2, '0')}`;
                this.renderFrame();
                this.animFrameId = requestAnimationFrame(t => this.loop(t));
            },

            getFighterSpriteSize(fighter) {
                return fighterSpriteSize(fighter, this.width, this.height) * this.camera.zoom;
            },

            prepareCombatantSprites(fighters) {
                if (typeof Image === 'undefined') return Promise.resolve();
                this.spriteLoadPromises ||= new Map();
                return Promise.all(fighters.filter(f => f.sprite).map(fighter => {
                    const url = fighter.sprite;
                    if (!this.spriteLoadPromises.has(url)) {
                        this.spriteLoadPromises.set(url, new Promise(resolve => {
                            const image = new Image();
                            const timer = setTimeout(() => { image.onload = null; image.onerror = null; resolve(false); }, 8000);
                            image.onload = () => { clearTimeout(timer); this.measureSprite(image, url); resolve(true); };
                            image.onerror = () => {
                                if (image.crossOrigin === 'anonymous') { image.crossOrigin = null; image.src = url; }
                                else { clearTimeout(timer); this.spriteLoadPromises.delete(url); resolve(false); }
                            };
                            image.crossOrigin = 'anonymous'; image.src = url;
                        }));
                    }
                    return this.spriteLoadPromises.get(url);
                }));
            },

            measureSprite(image, url) {
                if (!image.naturalWidth || image.getAttribute('src') !== url || this.spriteBoundsCache.has(url)) return;
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
                    const ctx = canvas.getContext('2d', { willReadFrequently: true });
                    ctx.drawImage(image, 0, 0);
                    const rgba = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
                    let left = canvas.width, top = canvas.height, right = -1, bottom = -1;
                    for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
                        if (rgba[(y * canvas.width + x) * 4 + 3] < 12) continue;
                        left = Math.min(left, x); right = Math.max(right, x);
                        top = Math.min(top, y); bottom = Math.max(bottom, y);
                    }
                    if (right < left) return;
                    left = Math.max(0, left - 1); top = Math.max(0, top - 1);
                    right = Math.min(canvas.width - 1, right + 1); bottom = Math.min(canvas.height - 1, bottom + 1);
                    this.spriteBoundsCache.set(url, { left, top, width: right - left + 1, height: bottom - top + 1,
                        imageWidth: canvas.width, imageHeight: canvas.height });
                    this.updateActors();
                } catch {
                    // A sprite host without CORS can still display normally.
                    // Its intrinsic box remains the safe normalization fallback.
                    this.spriteBoundsCache.set(url, { left: 0, top: 0, width: image.naturalWidth, height: image.naturalHeight,
                        imageWidth: image.naturalWidth, imageHeight: image.naturalHeight });
                }
            },

            updateActors() {
                if (!this.player || !this.enemy) return;
                for (const [fighter, side] of [[this.player, 'player'], [this.enemy, 'enemy']]) {
                    const actor = document.getElementById(`${side}Actor`);
                    const image = document.getElementById(`${side}SpriteImg`);
                    if (!actor || !image) continue;
                    const point = this.worldToScreen(fighter.x, fighter.y, fighter.z);
                    const size = this.getFighterSpriteSize(fighter);
                    const bounds = this.spriteBoundsCache.get(fighter.sprite);
                    const fit = bounds ? size / bounds.height : 1;
                    const width = bounds ? bounds.width * fit : size;
                    actor.style.width = `${width}px`; actor.style.height = `${size}px`;
                    actor.style.transformOrigin = '50% 100%';
                    actor.style.transform = `translate(${point.x - width / 2}px, ${point.y - size}px) scaleX(${-fighter.facing})`;
                    actor.style.zIndex = String(Math.round((fighter.y + this.WORLD_HALF_H) * 10 + fighter.z * 20));
                    image.style.position = 'absolute';
                    image.style.maxWidth = 'none'; image.style.maxHeight = 'none'; image.style.objectFit = 'fill';
                    image.style.left = bounds ? `${-bounds.left * fit}px` : '0px';
                    image.style.top = bounds ? `${-bounds.top * fit}px` : '0px';
                    image.style.width = bounds ? `${bounds.imageWidth * fit}px` : '100%';
                    image.style.height = bounds ? `${bounds.imageHeight * fit}px` : '100%';
                    image.style.objectPosition = 'center bottom';
                    image.className = `sprite-pixelated ${fighter.hitFlashTimer > 0 ? 'sprite-hit-flash' : ''} ${fighter.dashTimer > 0 ? 'sprite-iframe-ghost' : ''} ${side === 'player' && this.overdriveTimer > 0 ? 'sprite-overdrive-glow' : ''}`;
                    this.spriteAnimator.render(fighter, actor, image, this);
                }
                this.updateRockActors();
            },

            updateRockActors() {
                const stage = document.getElementById('spriteStageLayer');
                if (!stage) return;
                const active = new Set(this.pillars.filter(p => p.hp > 0));
                this.rockActors ||= new Map();
                for (const [pillar, node] of this.rockActors) if (!active.has(pillar)) {
                    node.remove(); this.rockActors.delete(pillar);
                }
                for (const pillar of active) {
                    let node = this.rockActors.get(pillar);
                    if (!node) {
                        node = document.createElement('div'); node.className = 'world-rock'; node.setAttribute('aria-hidden', 'true');
                        node.innerHTML = '<svg viewBox="0 0 100 100" width="100%" height="100%"><ellipse cx="50" cy="91" rx="45" ry="7" fill="#17211e" opacity=".24"/><path d="M8 69L23 24L52 8L83 29L95 72L65 94L24 91Z" fill="#77796e" stroke="#50564d" stroke-width="2"/><path d="M23 24L52 8L83 29L60 53L32 48Z" fill="#bac1a5"/><path d="M8 69L23 24L32 48L26 88Z" fill="#929981"/><path d="M60 53L83 29L95 72L65 94Z" fill="#575c52"/><path d="M34 48L43 64L40 78M60 53L56 71L65 85" fill="none" stroke="#434b43" stroke-width="2"/></svg><i class="rock-health"></i>';
                        stage.appendChild(node); this.rockActors.set(pillar, node);
                    }
                    const point = this.worldToScreen(pillar.x, pillar.y);
                    const width = pillar.radius * 2.3 * point.scale;
                    const height = (pillar.height + pillar.radius) * point.scale;
                    node.style.width = `${width}px`; node.style.height = `${height}px`;
                    node.style.transform = `translate(${point.x - width / 2}px, ${point.y - height * 0.9}px)`;
                    node.style.zIndex = String(Math.round((pillar.y + this.WORLD_HALF_H) * 10));
                    node.querySelector('.rock-health').style.width = `${Math.max(0, pillar.hp / pillar.maxHp) * 70}%`;
                }
            },

            endMatch(playerWon) {
                if (this.matchOver) return;
                this.matchOver = true;
                const title = document.getElementById('resultTitle');
                if (title) title.innerText = playerWon ? 'VICTORY!' : 'DEFEAT...';
                const sub = document.getElementById('resultSubtitle');
                if (sub) sub.innerText = playerWon ? `${this.playerTrainer} triumphs in an unforgettable stadium showdown!` : `${this.enemyTrainer} claims the World Coronation crown.`;
                const trophy = document.getElementById('resultTrophyIcon');
                if (trophy) trophy.innerHTML = playerWon ? '<i class="fa-solid fa-trophy text-yellow-400"></i>' : '<i class="fa-solid fa-skull text-red-500"></i>';
                const modal = document.getElementById('resultModal');
                if (modal) {
                    this.pendingResult = { modal, requestId: this.matchRequestId };
                }
            },

            updateHud() {
                const p = this.player;
                const e = this.enemy;
                if (!p || !e) return;

                // Player HUD
                document.getElementById('playerNameHud').innerText = p.name;
                const pHpPct = Math.max(0, (p.currentHp / p.maxHp) * 100);
                const pBar = document.getElementById('playerHpBar');
                pBar.style.width = `${pHpPct}%`;
                pBar.className = `h-full rounded-xs transition-all duration-150 ${pHpPct > 50 ? 'bg-emerald-500' : (pHpPct > 20 ? 'bg-amber-400' : 'bg-red-500')}`;
                document.getElementById('playerHpText').innerText = `${p.currentHp} / ${p.maxHp} HP`;
                document.getElementById('playerSpeedStat').innerText = p.stats.speed;
                document.getElementById('playerAtkStat').innerText = p.stats.attack;
                document.getElementById('playerStaminaBar').style.width = `${p.stamina}%`;
                document.getElementById('playerStaminaText').innerText = `${Math.floor(p.stamina)}%`;
                document.getElementById('playerBondBar').style.width = `${this.bondSync}%`;
                document.getElementById('playerBondText').innerText = `${this.bondSync}%`;

                // Overdrive button state
                const ovBtn = document.getElementById('overdriveBtn');
                ovBtn.disabled = this.bondSync < 100 || this.overdriveTimer > 0;

                const overdriveLabel = document.getElementById('overdriveBtnLabel');
                if (overdriveLabel) overdriveLabel.textContent = this.overdriveTimer > 0
                    ? `OVERDRIVE ${this.overdriveTimer.toFixed(1)}s${this.signatureReady ? ' · BURST' : ''}`
                    : `OVERDRIVE [R] · ${Math.floor(this.bondSync)}%`;
                for (const [fighter, prefix] of [[p, 'player'], [e, 'enemy']]) {
                    const badge = document.getElementById(`${prefix}StatusHud`);
                    const state = fighter.guardBreakTimer > 0 ? 'GUARD BREAK' : fighter.action ? 'CHARGING' :
                        fighter.counterShieldTimer > 0 ? 'COUNTER' : fighter.guarding ? 'GUARD' :
                        fighter.recoveryTimer > 0 ? 'RECOVERY' : fighter.z > 30 ? 'AIRBORNE' : fighter.status;
                    badge.textContent = state || '';
                    badge.className = `${state ? '' : 'hidden'} text-[9px] font-black px-1.5 py-0.5 rounded uppercase bg-amber-950 text-amber-300`;
                }
                document.getElementById('enemyAiStateBadge').textContent = this.online?.active ? 'ONLINE OPPONENT' : `AI: ${this.ai.state}`;
                document.getElementById('enemyStaminaText').textContent = `${Math.floor(e.stamina)}%`;
                this.setKeyVisual('btnGuard', p.guarding);
                const fly = document.getElementById('btnFly');
                if (fly) { fly.disabled = !p.traits.airborne; fly.classList.toggle('keycap-active', p.z > 30); }
                for (const key of ['W', 'A', 'S', 'D', 'Q', 'E', 'SPACE']) this.setKeyVisual(`keyVis_${key}`, Boolean(this.keys[key.toLowerCase()]));

                // Enemy HUD
                document.getElementById('enemyNameHud').innerText = e.name;
                const eHpPct = Math.max(0, (e.currentHp / e.maxHp) * 100);
                const eBar = document.getElementById('enemyHpBar');
                eBar.style.width = `${eHpPct}%`;
                eBar.className = `h-full rounded-xs transition-all duration-150 ${eHpPct > 50 ? 'bg-emerald-500' : (eHpPct > 20 ? 'bg-amber-400' : 'bg-red-500')}`;
                document.getElementById('enemyHpText').innerText = `${e.currentHp} / ${e.maxHp} HP`;
                document.getElementById('enemyStaminaBar').style.width = `${e.stamina}%`;

                // Types & Party Balls
                this.renderTypeBadges('playerTypesHud', p.types);
                this.renderTypeBadges('enemyTypesHud', e.types);
                this.renderPartyBalls();

                // Sprite Image tags
                const pImg = document.getElementById('playerSpriteImg');
                const eImg = document.getElementById('enemySpriteImg');

                for (const [fighter, image] of [[p, pImg], [e, eImg]]) {
                    if (fighter.sprite && image.getAttribute('src') !== fighter.sprite) {
                        image.onload = () => this.measureSprite(image, fighter.sprite);
                        image.onerror = () => {
                            if (image.crossOrigin === 'anonymous') {
                                image.crossOrigin = null;
                                image.src = fighter.sprite;
                            }
                        };
                        image.crossOrigin = 'anonymous';
                        image.src = fighter.sprite;
                    }
                }

                this.updateActors();
            },

            renderTypeBadges(containerId, types) {
                const c = document.getElementById(containerId);
                c.innerHTML = types.map(t => {
                    const cfg = TYPE_COLORS[t] || { bg: 'bg-slate-700', border: 'border-slate-500' };
                    return `<span class="px-1.5 py-0.2 rounded text-[9px] font-black uppercase text-white ${cfg.bg} border ${cfg.border}">${t}</span>`;
                }).join('');
            },

            renderPartyBalls() {
                const pContainer = document.getElementById('playerPartyBalls');
                pContainer.innerHTML = this.playerParty.map((pk, i) => `
                    <span class="w-3 h-3 rounded-full border border-slate-700 flex items-center justify-center ${pk.fainted ? 'bg-slate-800 opacity-40' : (i === this.playerActiveIdx ? 'bg-cyan-400 shadow-[0_0_8px_#22d3ee]' : 'bg-red-500')}"></span>
                `).join('');

                const eContainer = document.getElementById('enemyPartyBalls');
                eContainer.innerHTML = this.enemyParty.map((pk, i) => `
                    <span class="w-3 h-3 rounded-full border border-slate-700 flex items-center justify-center ${pk.fainted ? 'bg-slate-800 opacity-40' : (i === this.enemyActiveIdx ? 'bg-red-500 shadow-[0_0_8px_#ef4444]' : 'bg-slate-600')}"></span>
                `).join('');
            },

            renderPartySwitchBar() {
                const bar = document.getElementById('partySwitchBar');
                if (!bar || !this.player) return;
                if (bar.children.length !== this.playerParty.length) {
                    bar.replaceChildren(...this.playerParty.map((_, i) => {
                        const button = document.createElement('button');
                        button.type = 'button';
                        button.onclick = () => this.switchPokemon(i);
                        button.innerHTML = '<span class="switch-name"></span><span class="switch-status"></span><span class="switch-hp"><i></i></span>';
                        return button;
                    }));
                }
                this.playerParty.forEach((pk, i) => {
                    const button = bar.children[i];
                    const active = i === this.playerActiveIdx;
                    const cooldown = this.player.switchCooldown > 0;
                    button.disabled = pk.fainted || active;
                    button.className = `squad-switch ${active ? 'is-active' : ''}`;
                    button.setAttribute('aria-pressed', String(active));
                    button.setAttribute('aria-label', `${active ? 'Active' : 'Switch to'} ${pk.name}`);
                    button.querySelector('.switch-name').textContent = pk.name;
                    button.querySelector('.switch-status').textContent = pk.fainted ? 'FAINTED' : active ? 'ACTIVE' : cooldown ? `${this.player.switchCooldown.toFixed(1)}s` : `SWITCH · ${Math.ceil(pk.currentHp)} HP`;
                    button.querySelector('.switch-hp i').style.width = `${Math.max(0, pk.currentHp / pk.maxHp * 100)}%`;
                    button.title = active ? `${pk.name} is battling` : `Send out ${pk.name} · Z/X or tap`;
                });
            },

            renderMovesDeck() {
                const p = this.player;
                const grid = document.getElementById('movesGrid');
                if (!p || !grid) return;
                const exhausted = p.moves.every(m => m.pp <= 0);
                const moves = exhausted ? [this.struggleMove(p)] : p.moves;
                grid.style.gridTemplateColumns = `repeat(${moves.length}, minmax(0, 1fr))`;
                const signature = exhausted ? 'struggle' : p.moves.map(m => m.slug).join(',');
                // Create cards only when the fighter/moveset changes. Updating
                // cooldown text must never detach a pointer or focused button.
                if (this.moveDeckOwner !== p || this.moveDeckSignature !== signature) {
                    grid.replaceChildren();
                    for (const [i, m] of moves.entries()) {
                        const typeCfg = TYPE_COLORS[m.type] || { bg: 'bg-slate-700' };
                        const button = document.createElement('button');
                        button.type = 'button'; button.dataset.moveIndex = exhausted ? '-1' : String(i);
                        button.className = 'move-card relative overflow-hidden rounded-xl p-2.5 bg-slate-950/80 border-2 border-slate-700 shadow-lg transition flex flex-col justify-between text-left disabled:opacity-60 disabled:cursor-not-allowed';
                        if (exhausted) button.classList.add('col-span-2', 'sm:col-span-4');
                        const icon = ({ electric: 'bolt', water: 'droplet', fire: 'fire', grass: 'leaf', ice: 'snowflake', normal: 'feather', steel: 'link', psychic: 'eye', ghost: 'ghost', dark: 'moon', fighting: 'hand-fist', ground: 'mountain', rock: 'gem', flying: 'wind', dragon: 'dragon', fairy: 'star', poison: 'flask', bug: 'bug' })[m.type] || 'circle';
                        button.innerHTML = `<span class="move-type-icon ${typeCfg.bg}"><i aria-hidden="true" class="fa-solid fa-${icon}"></i></span><div class="flex justify-between items-center mb-1"><span class="px-1.5 py-0.5 rounded text-[9px] font-black uppercase text-white ${typeCfg.bg}" data-type></span><span class="text-[9px] font-black text-yellow-300" data-archetype></span></div>
                            <h4 class="font-extrabold text-xs sm:text-sm uppercase text-white truncate" data-name></h4>
                            <div class="flex justify-between text-[10px] font-bold text-slate-400 mt-0.5"><span data-power></span><span data-pp></span></div>
                            <div class="text-[9px] mt-1 text-cyan-200" data-readiness></div>
                            <div data-cooldown class="absolute inset-0 bg-slate-950/90 flex items-center justify-center font-mono font-black text-sm text-cyan-300 pointer-events-none"></div>`;
                        button.querySelector('[data-type]').textContent = m.type;
                        button.querySelector('[data-archetype]').textContent = `${m.archetype} [${exhausted ? 'CLICK' : i + 1}]`;
                        button.querySelector('[data-name]').textContent = exhausted ? 'STRUGGLE - LAST RESORT' : m.name;
                        button.querySelector('[data-power]').textContent = `PWR ${m.power}`;
                        grid.appendChild(button);
                    }
                    this.moveDeckOwner = p; this.moveDeckSignature = signature;
                }
                for (const [i, m] of moves.entries()) {
                    const button = grid.children[i];
                    const disabled = m.cooldown > 0 || m.pp <= 0;
                    button.disabled = disabled;
                    button.querySelector('[data-pp]').textContent = exhausted ? 'RECOIL' : `PP ${m.pp}/${m.maxPp}`;
                    const overlay = button.querySelector('[data-cooldown]');
                    overlay.style.display = disabled ? 'flex' : 'none';
                    overlay.textContent = m.pp <= 0 ? 'NO PP' : `${m.cooldown.toFixed(1)}s`;
                    const reason = this.attackBlockReason(p, m);
                    const readiness = reason === 'Ready' ? 'READY' : reason;
                    button.querySelector('[data-readiness]').textContent = readiness;
                    button.title = `${m.name}: ${readiness}`;
                    button.setAttribute('aria-label', `${m.name}, move ${i + 1}: ${readiness}`);
                }
                const feedback = document.getElementById('attackFeedback');
                if (feedback && (!this.attackFeedback || this.attackFeedback.until < this.matchElapsed))
                    feedback.textContent = 'Choose a move. Close the distance for melee attacks.';
            },

            // ==================== STADIUM 2.5D RENDERER ====================
            
            worldToScreen(wx, wy, wz = 0) {
                const point = projectGround(wx, wy, wz, this.width, this.height, this.WORLD_HALF_W, this.WORLD_HALF_H);
                const zoom = this.camera.zoom;
                return { ...point, scale: point.scale * zoom, scaleY: point.scaleY * zoom,
                    x: this.width / 2 + (point.x - this.width / 2) * zoom + this.camera.x,
                    y: this.height / 2 + (point.y - this.height / 2) * zoom + this.camera.y };
            },

            screenToWorld(sx, sy) {
                const zoom = this.camera.zoom;
                return unprojectGround(this.width / 2 + (sx - this.width / 2 - this.camera.x) / zoom,
                    this.height / 2 + (sy - this.height / 2 - this.camera.y) / zoom,
                    this.width, this.height, this.WORLD_HALF_W, this.WORLD_HALF_H);
            },

            getFighterMoveSpeed(fighter) {
                if (!fighter) return 200;
                let spd = 160 + (fighter.stats?.speed || 80) * 0.9;
                if (fighter.status === 'PAR') spd *= 0.5;
                if (fighter === this.player && this.overdriveTimer > 0) spd *= 1.25;
                return spd;
            },

            cleanup() {
                this.presentation.clear(); this.softenedArena = null;
                this.pendingResult = null;
                this.spriteAnimator.clear();
                this.arenaResizeObserver?.disconnect();
                this.moveAnimations?.clear(); this.moveAnimations = null; this.moveDeckOwner = null;
                this.rockActors?.forEach(node => node.remove()); this.rockActors = new Map();
                ++this.matchRequestId;
                this.loading = false;
                this.clearInput();
                this.visualTimers.forEach(timer => clearTimeout(timer));
                this.visualTimers.clear();
                if (this.animFrameId) {
                    cancelAnimationFrame(this.animFrameId);
                    this.animFrameId = null;
                }
                if (Array.isArray(this.listeners)) {
                    this.listeners.forEach(({ target, type, handler, options }) => {
                        if (target && target.removeEventListener) {
                            target.removeEventListener(type, handler, options);
                        }
                    });
                    this.listeners = [];
                }
            },

            renderFrame() {
                if (!this.ctx) return;
                const ctx = this.ctx;
                ctx.clearRect(0, 0, this.width, this.height);

                const theme = STADIUM_THEMES[this.currentStadium] || STADIUM_THEMES.grassy;

                renderArenaBackground(ctx, this);
                this.presentation.renderAmbient(ctx, this);
                this.presentation.renderGround(ctx, this);

                // 4. Draw Hazards (Puddles, Magma)
                this.hazards.forEach(hz => {
                    const scr = this.worldToScreen(hz.x, hz.y, 0);
                    ctx.save();
                    traceGroundCircle(ctx, this, hz.x, hz.y, hz.radius);
                    ctx.fillStyle = ({ puddle: 'rgba(56,189,248,.35)', magma: 'rgba(249,115,22,.4)', ice: 'rgba(165,243,252,.5)', electrified_puddle: 'rgba(250,204,21,.5)', steam: 'rgba(226,232,240,.35)' })[hz.type];
                    ctx.fill();
                    ctx.lineWidth = 2;
                    ctx.strokeStyle = ({ puddle: '#38bdf8', magma: '#f97316', ice: '#a5f3fc', electrified_puddle: '#facc15', steam: '#cbd5e1' })[hz.type];
                    ctx.stroke();
                    ctx.restore();
                });

                this.renderCombatTelegraphs(ctx);

                // All attack visuals use frames rendered from Showmotion's
                // actual effects; hitboxes remain owned by the simulation.
                if (this.effectsCtx) {
                    this.effectsCtx.clearRect(0, 0, this.width, this.height);
                    this.moveAnimations?.render(this.effectsCtx, this);
                    renderPokeballs(this.effectsCtx, this);
                }

                // 8. Draw Particles
                this.particles.forEach(pt => {
                    const scr = this.worldToScreen(pt.x, pt.y, pt.z);
                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(scr.x, scr.y, pt.radius * this.camera.zoom, 0, Math.PI * 2);
                    ctx.fillStyle = pt.color;
                    ctx.globalAlpha = pt.alpha;
                    ctx.shadowColor = pt.color;
                    ctx.shadowBlur = 8;
                    ctx.fill();
                    ctx.restore();
                });

                // 9. Draw Floating Numbers & Text Callouts
                this.floatingTexts.forEach(ft => {
                    const scr = this.worldToScreen(ft.x, ft.y, 25);
                    ctx.save();
                    ctx.font = '900 15px "Chakra Petch", sans-serif';
                    ctx.fillStyle = ft.color;
                    ctx.globalAlpha = ft.alpha;
                    ctx.shadowColor = '#000';
                    ctx.shadowBlur = 6;
                    ctx.textAlign = 'center';
                    ctx.fillText(ft.text, scr.x, scr.y);
                    ctx.restore();
                });
            }
        };

// Online commands go to the authoritative server; offline simulation stays local.
for (const [method, action] of Object.entries({ useMove: 'move', switchPokemon: 'switch', triggerDodgeDash: 'dodge', triggerCounterShield: 'shield', activateOverdrive: 'overdrive' })) {
    const offline = GameEngine[method];
    GameEngine[method] = function (...args) {
        if (!this.online?.active) return offline.apply(this, args);
        const extra = {};
        if (action === 'move' || action === 'switch') extra.index = args[0];
        if (action === 'move' && this.aimMode === 'cursor') extra.aim = this.mouseWorld;
        return this.online.command(action, extra);
    };
}
const offlineGuard = GameEngine.setGuard;
GameEngine.setGuard = function (active, fighter = this.player) {
    if (!this.online?.active) return offlineGuard.call(this, active, fighter);
    if (fighter === this.player) { this.online.guardHeld = !!active; fighter.guarding = !!active; }
};
const offlineRematch = GameEngine.rematch;
GameEngine.rematch = function (...args) {
    if (this.online?.active) { this.online.send({ type: 'rematch' }); return; }
    return offlineRematch.apply(this, args);
};
