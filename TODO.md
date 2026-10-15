# Project TODO

- [ ] Add online PvP with private rooms and invite codes.
  - [x] Extract shared combat simulation from browser rendering and audio.
  - [x] Run authoritative battles on a Node.js server with WebSockets.
  - [x] Support private room codes, 27-species team selection, ready checks, switching, shared results and rematches.
  - [x] Add bounded local movement prediction, opponent interpolation, ping, and a 30-second reconnect window.
  - [x] Validate teams, resources, movement and actions on the server; limit message sizes, rates and room count.
  - [x] Test two independent browser clients, mobile layout, delayed input, refresh/reconnect, forfeit, malformed messages and offline regressions.
  - [x] Add Render configuration, same-origin production server, health check and npm start.
  - [ ] Deploy to Render Free and verify a complete battle between two physical devices on separate networks. Account for idle sleep and startup delays.
  - [ ] Load-test hosting capacity before increasing the initial room limit.
  - [ ] Add durable room/session storage if battles must survive server restarts.
  - [ ] Add accounts and public matchmaking later if needed.
