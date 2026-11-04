# Quest Completer — Web Edition

A clean browser interface for completing Discord quests. The original terminal edition was
rewritten as a small web app with a real backend so the token never has to touch the browser's
storage.

**No database. No config file. No token persistence.**

---

## Quick start

Requirements: **Node.js 18 or newer**. There are no npm dependencies.

```bash
cd quest-completer-web
npm start
```

Open <http://localhost:3000>, paste your Discord **user** token, and connect. After a successful
connection the dashboard opens at `/dashboard/quest`.

For development with auto-restart:

```bash
npm run dev
```

### Configuration

| Variable       | Default     | Purpose                                                  |
| -------------- | ----------- | -------------------------------------------------------- |
| `PORT`         | `3000`      | HTTP port                                                 |
| `HOST`         | `127.0.0.1` | Bind address. Set to `0.0.0.0` only behind HTTPS/reverse proxy |
| `COOKIE_SECURE`| unset       | Set to `1` to force the `Secure` flag on the session cookie |
| `TRUST_PROXY`  | unset       | Set to `1` behind reverse proxies (Cloudflare/Nginx/Vercel) |

On Windows PowerShell:

```powershell
$env:PORT=8080; npm start
```

### Vercel Deployment

Quest Completer includes native Vercel configuration (`vercel.json` + `api/index.js`):
- Static assets (`public/`) are served directly via Vercel CDN.
- All API and session handlers run through the Vercel serverless function (`api/index.js`).
- Client-side routes (`/dashboard`, `/dashboard/quest`) rewrite to `/index.html`.

Deploy directly using the Vercel CLI or by importing this repository into Vercel:

```bash
npx vercel
```

---

## How the token is handled

The entire security model is deliberately boring:

1. You paste the token into the login form.
2. It is sent once to the local Node server over same-origin HTTP.
3. The server verifies it with `GET /users/@me` on Discord.
4. The token is stored **in a JavaScript `Map` in process memory**, keyed by a random
   32-byte session id. That is the only copy.
5. The browser receives an `HttpOnly`, `SameSite=Strict` session cookie. The token itself is
   never sent back to the browser, never placed in `localStorage`, and never rendered.
6. Ending the session deletes the map entry, drops the token reference, stops any run, and
   clears the cookie.
7. The session expires after **2 hours idle** or **12 hours total**, whichever comes first.
   Stopping the server also wipes every session.

Things the app does **not** do:

- no database
- no `config.json`, `.env`, or log file containing a token
- no token in URLs, cookies, localStorage, or the DOM
- no request logging of authorization headers

Because the cookie is a browser session cookie, closing the browser forgets the session id.
The server still removes the in-memory token after the idle timeout.

> If you expose this beyond localhost, put it behind HTTPS. Otherwise the token travels over
> plain HTTP. Use `HOST=0.0.0.0` only when you understand that trade-off.

---

## What it does

- Fetches your Discord quest log through the official user API.
- Shows task type, time target, expiry, rewards, progress, and status. Expired quests are hidden.
- **Watch video quests** — submits watch progress in safe increments until Discord confirms.
- **Play on desktop quests** — sends the required desktop heartbeats every 30 seconds.
- **Claims rewards** automatically after completion, or on demand with *Claim rewards*.
- **Run all pending** queues every runnable quest and streams live logs to the activity panel.
- **Auto-runner** checks for new quests every 5 minutes while the session is alive and starts
  supported quests automatically. Toggle it in the header.
- Live run state is delivered over Server-Sent Events. You can close the activity panel — the
  run continues server-side.
- **Stop** cancels a run after the current step and sends a terminal heartbeat for desktop quests.

Unsupported task types (`STREAM_ON_DESKTOP`, `PLAY_ACTIVITY`) are shown as **Manual only** and
must be completed in the Discord desktop app. This is a Discord API limitation, not a UI bug.

---

## Project structure

```
quest-completer-web/
├── server.js              # HTTP server, routes, SSE, static files
├── public/
│   ├── index.html         # App shell (login + dashboard)
│   ├── styles.css         # Design system and responsive layout
│   ├── app.js             # Client state, rendering, SSE, actions
│   └── favicon.svg
└── src/
    ├── discord.js         # Token verification and Discord API client
    ├── quests.js          # Quest normalization and status/progress parsing
    ├── jobs.js            # Run queue, completion engine, auto-runner
    ├── session.js         # In-memory sessions, expiry, streams
    └── errors.js          # Typed errors
```

### API surface

| Method | Route                         | Purpose                            |
| ------ | ----------------------------- | ---------------------------------- |
| POST   | `/api/session`                | Verify token, create memory session |
| GET    | `/api/session`                | Current account + session metadata |
| DELETE | `/api/session`                | End session and erase token        |
| GET    | `/api/quests`                 | Normalized quest list + summary    |
| POST   | `/api/quests/:id/run`         | Start one quest                    |
| POST   | `/api/quests/run-all`         | Run all pending quests             |
| POST   | `/api/quests/:id/claim`       | Claim one reward                   |
| POST   | `/api/quests/claim-all`       | Claim every ready reward           |
| GET    | `/api/jobs`                   | Recent and active runs             |
| GET    | `/api/jobs/:id`               | Run detail with buffered events    |
| GET    | `/api/jobs/:id/events`        | Live run event stream (SSE)        |
| POST   | `/api/jobs/:id/cancel`        | Stop a run                         |
| GET    | `/api/events`                 | Session events (SSE)               |
| POST   | `/api/auto`                   | Toggle the auto-runner             |

---

## Security notes

- The login route is rate-limited per IP (15 attempts / 10 minutes).
- State-changing requests validate the `Origin` header.
- CSP, `X-Frame-Options: DENY`, `nosniff`, and a strict referrer policy are set on every response.
- Request bodies are capped at 16 KB.
- Run events and logs contain quest names and status messages — never the token.

## Limitations / disclaimer

Using a user token with third-party tools can violate Discord's Terms of Service and may result
in account action. This project is provided for educational use, with no warranty. Use an account
you can afford to lose, and never share your token.

This project is not affiliated with Discord.
