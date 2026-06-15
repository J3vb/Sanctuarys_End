# Sanctuary's End

A fun, vibe-coded, browser-based action-RPG with serious Diablo vibes.

Sanctuary's End is a hack-and-slash ARPG packed into a single HTML file and rendered in 3D with Three.js. Roll a hero, dive an endless procedural dungeon, hunt loot, build out your skills, and clear bosses — all in your browser, no install required.

![Sanctuary's End](image.png)

## Play it

**Online:** https://j3vb.github.io/Sanctuarys_End/sanctuary.html — just click and play.

**Locally:** download the repo and open `sanctuary.html` in a modern browser (WebGL support required). It's a static file with no build step. The Three.js libraries load from a CDN, so you'll need an internet connection the first time.

## Features

- Three classes — Warrior, Mage, and Rogue, each with their own skills and stat growth
- Active skills plus a passive skill forest of nodes, notables, and keystones
- Deep loot: five rarity tiers, affixes, enchanting, and gems across seven gear slots
- Towns and shops — vendors, a smith, alchemist, enchanter, gambler, and jeweler
- An endless procedural dungeon ("The Descent") with bosses every few floors
- An open world of biome-themed regions to explore and travel between
- Difficulty tiers from Normal all the way up to Inferno
- Auto-saving characters with multiple save slots (plus export/import for backups)
- Optional online co-op

## Co-op (optional)

For shared-world play, run the lightweight relay in `Server/server.js` (Node 16+):

```
cd Server
npm install
npm start
```

It defaults to port 8787 — start it, then connect from the in-game Multiplayer menu. Each player's game runs locally; the server just relays presence and chat.

Note: co-op uses a `ws://` (non-TLS) connection, so play from a local file or an `http://` page — browsers block `ws://` from the `https://` hosted page above. For LAN/internet play, share the host's IP + port.

## Learn more

The full game codex lives in `sanctuary_wiki.html` — open it in your browser for searchable, detailed docs on classes, stats, combat formulas, status effects, items and affixes, uniques and sets, the economy, zones, difficulty scaling, monsters, bosses, and the version changelog.

See also [CHANGELOG.md](CHANGELOG.md) for the release history.

## License & credits

Game code is MIT-licensed — see [LICENSE](LICENSE). Bundled third-party models and libraries keep their own licenses; attribution and terms are in [CREDITS.md](CREDITS.md).

---

Built for the fun of it — a vibe-coded passion project.
