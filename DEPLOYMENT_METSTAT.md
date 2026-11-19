# AVA STUDIO — publishing inside MetStat

## Current layout
- Frontend: React / Vite, bundled into `dist/`.
- Backend: Express in `server.ts`, API mounted at `/api`.
- Gemini calls: server-side `GEMINI_API_KEY`, never a browser-side token.
- Audio processing: FFmpeg must be available on the server.
- Health endpoint: `GET /api/health`.

## Google AI Studio (preferred when using its managed Gemini key)
1. Open the AI Studio project and use **Publish** to deploy to Cloud Run.
2. Copy the **public deployed service URL** (not the Build/Share/Preview URL ending in `/apps/...`).
3. Confirm `/api/health`, text-to-speech, audio downloads and file import work from a browser.
4. Ensure the service can be framed by `https://wtafkik.ir`, or use a same-origin reverse proxy. Frame restrictions set upstream (CSP `frame-ancestors` / `X-Frame-Options`) cannot be bypassed by MetStat.
5. Replace the temporary AI Studio sharing URL in `metstat-site/seasonal_release/toolbox.html` with the deployed URL, test the hosted page and then publish it.

AI Studio's **Share** link may need Google sign-in and may prohibit embedding; it is a fallback entry point only.

## Deploying the repository independently
A Dockerfile is included for an external platform supporting containers:
- Service must listen on `PORT` (defaults to 3000; Cloud Run sets 8080).
- Inject `GEMINI_API_KEY` as a *server-side secret* and never commit its value.
- `NODE_ENV=production` serves built Vite assets through the Express service.
- The container includes FFmpeg for audio editing / export.

## Production safety gates
**Do not open the current API publicly for unrestricted multi-user use without further work.** At present, projects, history, dictionaries and audio artifacts are stored in shared local JSON files under `data/`; there is no per-user isolation or authentication. Cloud Run container storage is ephemeral and multiple replicas will not share this state. Configure per-user authentication, durable object storage/database, and quota/rate controls before using the app as a public MetStat feature. A shared server-side Gemini key can incur usage charges.

## Verification
```sh
bun install --frozen-lockfile
bun run lint
bun run build
```
GitHub Actions runs these quality gates for each relevant change. The GitHub test does **not** call Gemini with a real key; end-to-end TTS availability needs a separate, authenticated smoke test on the deployed backend.
