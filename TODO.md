# Project TODO

- [ ] Add online PvP with private rooms and invite codes.
  - Extract combat simulation from browser rendering and audio.
  - Run authoritative battles on a Node.js server with WebSockets.
  - Support team selection, ready checks, mid-battle switching, and shared results.
  - Add movement prediction, opponent interpolation, and reconnect handling.
  - Validate inputs and combat rules on the server.
  - Test two-device matches, latency, and disconnects.
  - Start with Render Free hosting for the game and battle server; recheck current limits before deployment. Account for idle sleep and startup delays.
  - Add accounts and public matchmaking later if needed.
