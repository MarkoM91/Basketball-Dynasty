# Roster snapshot — 6 November 2026

Current 2026–27 team membership was fetched from ESPN's public NBA team roster feed on 6 November 2026. All 30 responses are stored here as trimmed factual records, with the public source URL and season attached to each team.

Official NBA pages were used to cross-check notable roster moves:
- League player index: https://www.nba.com/players
- Philadelphia: https://www.nba.com/sixers/roster
- Miami: https://www.nba.com/heat/roster
- New York: https://www.nba.com/knicks/roster
- Los Angeles: https://www.nba.com/lakers/team/roster-coaches

The feed contains 521 players. The game retains its 18-player limit, so 519 sourced players are included. Los Angeles Current and Cosmos each have 19 feed entries: Nick Martinelli and Cameron Carr are retained in `scripts/nba-rosters-current.json` under `excluded`, rather than silently presented as assigned players. Teams with fewer than 18 get the game's fictional reserve fillers.

Naming retains the established rule: a different first name with the same initial, and the real surname with one added final letter, preserving suffixes and compound surnames. The persistent name registry keeps known first-name aliases attached to player identity across moves. Legacy multi-typo surnames are corrected to the one-typo rule. Current NBA players are excluded from the old draft parody pool.

Current ages, heights and inferred positions come from the roster feed. The existing rating formula is unchanged. Statistics follow players across teams, matched by normalized identity and explicit nickname aliases, never by surname alone. There are 452 players with retained prior NBA statistics and 67 newcomers without a prior NBA line, marked as development estimates. `historical-stats.json` fills missing veterans using their most recent available prior NBA season (not a fabricated zero-stat rating for injured stars). Contract amounts continue to use the game's salary model.

Regenerate offline with `npm run sync:rosters` (also `npm run compute-ratings`). Validate with `npm run validate:rosters`.

This snapshot initializes new franchises. Existing saves preserve their rosters, trades, cuts and signings.
