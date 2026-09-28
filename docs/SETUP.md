# Setup

Everything that has to be configured once: the site values, GitHub Pages, and
the secrets the fetchers use. Nothing here ever goes into the repo as a file.

## Local development

Requires Node 22.12+ (`.nvmrc` pins the current LTS) and Python 3.10+.

```sh
npm install
npm run dev        # http://localhost:4321/ — drafts and sample feeds are visible here
npm run build      # static site in dist/
npm run preview    # serve dist/ locally
npm run check      # type-check (astro check)
npm test           # unit tests (Vitest)
npm run lint       # ESLint + Prettier check
npm run format     # format everything with Prettier
```

```sh
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
ruff check . && ruff format --check . && mypy && pytest
```

The sample feeds in `src/data/feeds/` are for development only. `npm run dev`
uses them automatically; a build uses them only when run with
`USE_FIXTURES=true` (as CI does). A plain `npm run build` behaves like
production: any feed card without real data is left out, and the build log
lists which ones.

### Running the fetchers locally

Export the secrets you have as environment variables, then:

```sh
python -m scripts.fetch_all
```

Real feeds land in `src/data/live/` and images in `public/media/feeds/` (both
gitignored), and `npm run build` then uses them. Fetchers whose secret or
setting is missing are skipped with a message saying which.

## Site values

Every site-specific value is in [`site.config.ts`](../site.config.ts). Values
still in CAPITALS are placeholders; a fetcher that needs one skips until it is
filled in.

| Field                | Value                                                                             |
| -------------------- | --------------------------------------------------------------------------------- |
| `name`               | The lowercase wordmark, `matteo`.                                                 |
| `tagline`            | `a slow feed`.                                                                    |
| `heroTitle`          | The large line on the home page.                                                  |
| `heroBio`            | One or two sentences about you, under the hero title.                             |
| `url`                | `https://vitellaro-matteo.github.io` (origin only, no path).                      |
| `basePath`           | `/`, since Pages serves the `<user>.github.io` repo from the root.                |
| `timezone`           | An IANA zone such as `Europe/Berlin`. Used for dates and the "this week" range.   |
| `spotifyPlaylistId`  | The id at the end of the playlist's share link, `open.spotify.com/playlist/<id>`. |
| `letterboxdUsername` | From your profile URL, `letterboxd.com/<username>/`.                              |
| `goodreadsUserId`    | The number in your profile URL, `goodreads.com/user/show/<id>-name`.              |
| `instagramUsername`  | `fuzetea_esports`.                                                                |
| `githubUsername`     | Your GitHub login, `vitellaro-matteo`.                                            |

Letterboxd and Goodreads need no secrets: once their values are filled in, those
cards work on the next deploy. Your Goodreads profile must be public.

## GitHub Pages

In the repository's **Settings → Pages**, **Source** must be **GitHub Actions**.
The deploy workflow then runs on every push to `main`, every day at 05:00 UTC,
and on demand from **Actions → Deploy → Run workflow**. After each run, the
**Fetch feeds** step's summary shows a table of every feed and whether the site
shows fresh data, the last good copy or a hidden card.

## Secrets

Add each secret in **Settings → Secrets and variables → Actions → New repository
secret**, or from a terminal with `gh secret set NAME` (it prompts for the value,
so it never lands in your shell history). Never commit a token or a `.env` file.

A missing secret never breaks a deploy: its fetcher is skipped, and the card
keeps its last good copy or is hidden. Create them in this order:

### 1. `GH_STATS_TOKEN`: the contribution calendar

1. On GitHub, open **Settings → Developer settings → Personal access tokens →
   Fine-grained tokens → Generate new token**.
2. **Token name:** `site contribution stats`. **Expiration:** up to a year; set
   yourself a reminder.
3. **Repository access:** **Public repositories**. Leave every permission at
   **No access**; reading your public contribution calendar needs none.
4. Generate the token, copy it and save it as the secret `GH_STATS_TOKEN`.

### 2. Spotify: `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REFRESH_TOKEN`

These are the same kind of credentials as in the WeeklySpotifyUpdate repo; you
can reuse that app and skip to step 3. Since February 2026 an app in development
mode only works while its owner has Spotify Premium, and it can only read
playlists its user owns, which is the case for "last week's finds".

1. Go to [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard),
   log in and click **Create app**. Give it a name and description, add the
   redirect URI `http://127.0.0.1:8888/callback` (Spotify no longer accepts
   `localhost`), tick **Web API** and save.
2. Open the app's **Settings** and copy the **Client ID** and **Client secret**.
   Save them as `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET`.
3. In a browser where you are logged in to Spotify, open this URL with your
   client id filled in, and click **Agree**:
   ```
   https://accounts.spotify.com/authorize?client_id=<CLIENT_ID>&response_type=code&redirect_uri=http://127.0.0.1:8888/callback&scope=playlist-read-private%20playlist-read-collaborative
   ```
4. The browser tries to open `http://127.0.0.1:8888/callback?code=…` and shows
   an error page; that is expected. Copy the `code` value from the address bar.
   It works once, for about ten minutes.
5. Exchange it for tokens:
   ```sh
   curl -X POST https://accounts.spotify.com/api/token \
     -u "<CLIENT_ID>:<CLIENT_SECRET>" \
     -d grant_type=authorization_code \
     -d code=<CODE> \
     -d redirect_uri=http://127.0.0.1:8888/callback
   ```
6. Save the `refresh_token` from the JSON response as `SPOTIFY_REFRESH_TOKEN`.
   It keeps working until you remove the app's access in your Spotify account.

### 3. `GH_SECRETS_TOKEN`: lets the deploy rotate the Instagram token

The built-in workflow token can't write secrets, so this one does. Create it
before the Instagram token, so the first refresh can already be saved.

1. **Settings → Developer settings → Personal access tokens → Fine-grained
   tokens → Generate new token**.
2. **Token name:** `site secrets rotation`. **Expiration:** up to a year; set a
   reminder.
3. **Repository access:** **Only select repositories** →
   `vitellaro-matteo.github.io`.
4. **Permissions → Repository permissions → Secrets:** **Read and write**.
   Leave everything else at **No access** (Metadata stays read-only, as GitHub
   requires).
5. Generate it and save it as `GH_SECRETS_TOKEN`.

### 4. `INSTAGRAM_TOKEN`: the photo grid

The fetcher uses the Instagram API with Instagram Login, which needs a
professional (Creator or Business) account. The account stays public.

1. **Switch the account to Creator.** In the Instagram app, logged in as
   `@fuzetea_esports`: **Settings → Account type and tools → Switch to
   professional account → Creator**. Pick any category; you can hide it from the
   profile.
2. **Create a Meta app.** At [developers.facebook.com/apps](https://developers.facebook.com/apps),
   log in (register as a developer if asked) and click **Create app**. Choose
   the use case **Manage messaging & content on Instagram**, then finish with
   the defaults. The app can stay in development mode.
3. **Set up Instagram login.** In the app dashboard, open **Instagram → API
   setup with Instagram login**. Under **Generate access tokens**, click **Add
   account** and log in as `@fuzetea_esports`. If Meta asks you to add the
   account as a tester first, add it under **App roles → Roles → Instagram
   testers**, then accept the invite in Instagram at **Settings → Website
   permissions → Apps and websites → Tester invites**.
4. **Generate the token.** Click **Generate token** next to the account and
   approve the `instagram_business_basic` permission. The token shown is
   long-lived (60 days). Copy it.
5. Save it as `INSTAGRAM_TOKEN`.

From then on every deploy refreshes the token and, when Instagram returns a new
one, writes it back to `INSTAGRAM_TOKEN` using `GH_SECRETS_TOKEN`. Since the site
deploys daily, it never reaches its 60 days. If deploys stop for longer than
that, generate a new token the same way.

### Check it worked

Run **Actions → Deploy → Run workflow**. In the finished run, open the **Fetch
feeds** step's summary: every feed you configured should say `updated`, and the
live site shows its card.
