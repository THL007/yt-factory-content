# YT Factory · Content desk

Stage 2 (Script → Assets) of the faceless YouTube factory: a PWA for the Content role. Writers take videos whose research brief is done, write the outline and the spoken script beside the brief, add titles, thumbnail text and a rights check, then hand the video to production.

| Piece | Where |
|---|---|
| PWA (Expo web, Hallmark Studio theme) | this repo, https://thl007.github.io/yt-factory-content/ |
| API (Cloudflare Worker, Neon) | `yt-factory-api`, source in [THL007/yt-factory-research](https://github.com/THL007/yt-factory-research) `api/` (routes `/content/*`) |
| Data | Neon `yt-factory-cm-1`: `scripts` (one row per saved version, `db/004_scripts.sql`), `video_tickets` |

## Flow

1. **Queue:** tickets in stage `script`, oldest first. Filters: In Script, Mine, Handed off, All.
2. **Claim** sets the ticket owner. **Release** clears it.
3. **Write:** hook (3 s or less), 3–5 beats, call to action, soft close, spoken script with `[PAUSE]` and `[B-ROLL: …]` cue lines, 3+ titles, thumbnail text (4 words or fewer), description, rights flags and the rights check. Each save is a new version; older versions can be opened back into the editor.
4. **Hand off to Assets** when the API's gate passes (hook, 3 beats, CTA, spoken script, 3 titles, thumbnail text, rights check). The ticket moves to `assets`, the final script, titles, thumbnail text and description are copied onto `video_tickets`, and the owner is cleared for production.
5. **Send back to Research** with a note: the ticket returns to `idea` and the research job shows under Needs review with the note.

Roles: owner, admin and content write; research, production and publish read.

## Develop

`npm install`, `npm run web`, `npm run typecheck`. Deploy: `npm run deploy` (gh-pages).
