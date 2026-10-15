# Private-room online PvP

## Development

Use Node.js 22 or newer. Run `npm ci`, then start `npm run server` in one terminal and `npm run dev` in another. Open the Vite URL, choose **PLAY ONLINE PvP**, and create a room. A second browser or device joins with its six-character room code. The host selects a 3v3 or 6v6 battle format; both trainers must choose that many distinct Pokémon and press Ready. Changing format resets both ready checks. Rematches keep the format.

Choose **EDIT SLOT** to target a team slot, then search by Pokémon name, Pokédex number (with or without `#`), or type and select a result. Selection advances to the next slot. Slot dropdowns also remain available; duplicate picks are disabled. Search covers the curated online roster, not the full offline Pokédex. These formats are single private battles, without a multi-round tournament bracket.

The initial PvP roster contains 27 curated species with server-owned stats and moves. Offline custom selection remains available independently. Refresh the catalog deliberately with `node scripts/build-pvp-catalog.mjs` when changing PvP balance.

For a production-style local run, use `npm run build` followed by `npm start`, then visit `http://localhost:4317`. The production server serves both the built game and `/ws`; Vite development proxies `/ws` and `/api/pvp` to port 4317.

## Render

The repository includes `render.yaml`. For the manually configured Web Service use:

| Setting | Value |
| --- | --- |
| Runtime | Node |
| Branch | main |
| Region | Singapore |
| Root directory | blank |
| Build command | `npm ci --include=dev && npm run build` |
| Start command | `npm start` |
| Plan | Free |
| Health-check path | `/healthz` |
| Environment | `NODE_VERSION=22` |

The server listens on `0.0.0.0` and uses Render's `PORT` environment variable. The client derives its secure WebSocket URL from the current page, so no backend URL or secret is needed in the frontend. Wait for Render's live deployment status, then open its HTTPS URL on both devices. Free hosting can sleep while idle; connection startup may take time. No Render deployment has been performed by the local setup itself.

## Authority and connection behavior

`BattleSimulation.js` contains shared combat rules without DOM or audio dependencies. `CombatSystem.js` adds offline AI and rendering. Each room owns an isolated `Battle` instance using the shared movement, damage, PP, stamina, collision, terrain, defense and clash rules. Both players send inputs and commands, not positions or damage values.

Simulation uses a fixed 60 Hz step with capped catch-up; clients receive compact snapshots approximately 15 times per second. Definition data is sent at initialization; subsequent updates contain dynamic state and new presentation events. Local movement uses bounded extrapolation with reconciliation; the opponent is interpolated. This is a prototype prediction scheme, without historical input replay or latency-compensated hit rewind. At higher latency, corrections may be visible.

Initial matches and replacements preserve Poké Ball presentation locks. Online menus suppress that client's input but do not pause the opponent's game. A dropped connection pauses the battle for up to 30 seconds; refreshing the same browser tab restores its token from session storage. Permanent disconnects and leaving forfeit the match. Rematches return both connected players to the ready lobby. Expired waiting lobbies close after 30 minutes.

Rooms are in memory on one server instance: restarts or redeploys lose them. The initial service caps rooms at 12 and sockets at 48; these are protective limits, not measured hosting capacity. Accounts, rankings, public matchmaking and persistent saves are not included. Test real-device network behavior and load before increasing capacity.

## Verification

- `npm test`: offline/shared combat and presentation unit tests.
- `npm run test:pvp`: headless battles and real WebSocket room, authentication, reconnect and input-validation tests.
- `npm run test:browser`: offline regression plus a two-browser PvP scenario covering mobile, commands, switching, delayed input, refresh and forfeit.
- `npm run build`: production frontend bundle.
- `npm run test:production`: build, HTTP smoke checks and a two-browser match against the production server.
