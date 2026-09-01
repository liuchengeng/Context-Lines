# ContextLines Quick Ask

ContextLines Quick Ask is a self-hosted Chrome extension for understanding a line of English you just heard in a video.

Click the extension icon to start a rolling in-memory audio buffer. Press `Alt+Q` when you hear an unfamiliar line. The extension pauses the video, trims silence locally, sends up to eight seconds of audio to Doubao through your Cloudflare Worker, and asks DeepSeek for a Chinese translation and up to three useful words or phrases. The result appears over the current page or fullscreen player.

Saved vocabulary is stored in your own Cloudflare D1 database. Audio and transcripts are not stored.

## Requirements

- Node.js 24 or later with Corepack
- Desktop Chrome 116 or later
- Cloudflare, Doubao, and DeepSeek accounts

Provider usage may incur charges under each provider's pricing terms.

## Local development

```powershell
git clone https://github.com/liuchengeng/contextlines.git
cd contextlines
corepack pnpm install
corepack pnpm dev
```

Open `chrome://extensions`, enable Developer mode, and load `apps/extension/.output/chrome-mv3-dev`.

## Relay setup

Sign in to Cloudflare:

```powershell
corepack pnpm --filter @contextlines/relay exec wrangler login
```

Generate a relay token and keep it private:

```powershell
[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).TrimEnd('=').Replace('+','-').Replace('/','_')
```

Store the provider credentials and relay token as Worker Secrets. Wrangler prompts for each value, so do not include secrets in the commands.

```powershell
corepack pnpm --filter @contextlines/relay exec wrangler secret put DOUBAO_APP_ID
corepack pnpm --filter @contextlines/relay exec wrangler secret put DOUBAO_ACCESS_TOKEN
corepack pnpm --filter @contextlines/relay exec wrangler secret put DEEPSEEK_API_KEY
corepack pnpm --filter @contextlines/relay exec wrangler secret put RELAY_TOKEN
```

The Doubao relay uses the ASR 2.0 hourly resource `volc.seedasr.sauc.duration`. It requires an App ID and Access Token, not a Secret Key.

Create the vocabulary database and apply its migration:

```powershell
corepack pnpm --filter @contextlines/relay exec wrangler d1 create contextlines-vocabulary --binding VOCAB_DB --update-config
corepack pnpm --filter @contextlines/relay exec wrangler d1 migrations apply VOCAB_DB --remote
```

Deploy the Worker:

```powershell
corepack pnpm --filter @contextlines/relay exec wrangler deploy
```

Copy the resulting `https://...workers.dev` URL. Open the extension settings and enter that URL and the relay token.

## Usage

1. Open a page with a video.
2. Click the extension icon. A green `ON` badge confirms that audio capture is active.
3. Play the video for a few seconds, then press `Alt+Q`.
4. Close the result with `Alt+Q`, the close button, or **Close and resume**.
5. Use **My vocabulary** to review or delete saved terms.

## Data flow

- Chrome stores only the Worker URL and relay token.
- Doubao and DeepSeek credentials remain in Cloudflare Worker Secrets.
- Audio leaves the browser only after `Alt+Q` is pressed.
- Doubao receives the trimmed WAV clip. DeepSeek receives only the transcript.
- D1 stores only vocabulary items that the user explicitly saves.

## Repository layout

- `apps/extension`: WXT Chrome extension
- `apps/relay`: Cloudflare Worker relay and vocabulary API
- `apps/relay/migrations`: D1 migrations
- `packages/contracts`: shared Zod schemas
- `docs/architecture.md`: runtime architecture

## Checks

```powershell
corepack pnpm format:check
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
```

## License

[MIT](LICENSE)
