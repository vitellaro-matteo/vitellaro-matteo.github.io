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
`USE_FIXTURES=true` (as CI does), which also includes the draft examples. A plain
`npm run build` behaves like production: any feed card without real data is left
out, and the build log lists which ones.

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

| Field                | Value                                                                              |
| -------------------- | ---------------------------------------------------------------------------------- |
| `name`               | The lowercase wordmark, `matteo`.                                                  |
| `tagline`            | The short line beside the wordmark, `my feed`.                                     |
| `heroTitle`          | The large line on the home page.                                                   |
| `heroBio`            | One or two sentences about you, under the hero title.                              |
| `url`                | `https://vitellaro-matteo.github.io` (origin only, no path).                       |
| `basePath`           | `/`, since Pages serves the `<user>.github.io` repo from the root.                 |
| `timezone`           | An IANA zone such as `Europe/Berlin`. Used for dates and the "this week" range.    |
| `spotifyPlaylistId`  | The playlist id, `open.spotify.com/playlist/<id>`; a pasted share link also works. |
| `lastfmUsername`     | From `last.fm/user/<username>`. Also adds `last.fm ↗` to the footer.               |
| `letterboxdUsername` | From your profile URL, `letterboxd.com/<username>/`.                               |
| `goodreadsUserId`    | The number in your profile URL, `goodreads.com/user/show/<id>-name`.               |
| `githubUsername`     | Your GitHub login, `vitellaro-matteo`.                                             |

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
can reuse that app and skip step 1. Since February 2026 an app in development
mode only works while its owner has Spotify Premium, and it can only read
playlists its user owns, which is the case for "last week's finds".

1. Go to [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard),
   log in and click **Create app**. Give it a name and description, tick
   **Web API** and save.
2. **Register the redirect URI.** Open the app's **Settings**, click **Edit** and,
   under **Redirect URIs**, enter exactly:
   ```
   http://127.0.0.1:8888/callback
   ```
   It must be `127.0.0.1`, not `localhost` (Spotify rejects `localhost`), with
   `http`, the port and no trailing slash. Click **Add**, then **Save** at the
   bottom of the page; the URI isn't registered until you save. This is the URI
   WeeklySpotifyUpdate uses, so one registration serves both repos.
3. In the same **Settings**, copy the **Client ID** and **Client secret**. Save
   them as `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET`.
4. Get the refresh token with the helper script. In PowerShell:
   ```powershell
   $env:SPOTIFY_CLIENT_ID = "<client id>"
   $env:SPOTIFY_CLIENT_SECRET = "<client secret>"
   python -m scripts.spotify_auth
   ```
   In a POSIX shell, `export` the same variables. If `SPOTIFY_CLIENT_SECRET` is
   unset, the script asks for the secret with hidden input instead, which keeps
   it out of your shell history. It opens Spotify in your browser; click
   **Agree**.
5. The script prints `SPOTIFY_REFRESH_TOKEN=…` and the granted scopes, which
   should be `playlist-read-private playlist-read-collaborative`. Save the token
   as `SPOTIFY_REFRESH_TOKEN`. It keeps working until you remove the app's access
   in your Spotify account.

If Spotify shows **redirect_uri: Not matching configuration** or **Invalid
redirect URI**, the URI isn't registered for that client id: check step 2
character for character, and that it was saved. The script stops after five
minutes without a callback and prints the exact URI it expects. To use another
registered URI, pass it with `--redirect-uri`, for example
`--redirect-uri http://127.0.0.1:9090/callback`; the script listens on that
URI's host and port.

#### If the Spotify fetcher fails

The **Fetch feeds** step's log and summary quote Spotify's own error, followed by
a hint, for example:

```
spotify | failed | SpotifyAuthError: client ID + secret check failed (HTTP 400): invalid_client: Invalid client. Hint: …
```

They never contain the client ID, the secret or a token. The log also warns when
a secret had stray whitespace (it is stripped) or doesn't look like what it
should be. It describes the problem without printing the value.

Spotify checks the refresh token before the client credentials, and answers
`invalid_client` both when the secret is wrong and when the refresh token belongs
to another app. So whenever a refresh fails with `invalid_client`, the fetcher
also checks the client ID and secret on their own (the client credentials grant,
which needs no refresh token) and reports whichever of the two it is.

If a Spotify response ever doesn't match what the parser expects, the step
summary shows the traceback, and `python -m scripts.spotify --dump` (same
credentials as below) saves the raw playlist and track JSON to `.debug/spotify/`
to compare against. It prints only the file paths.

To test the three values on your machine:

```powershell
python -m scripts.spotify --check
```

It reads `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` and `SPOTIFY_REFRESH_TOKEN`
from the environment and asks, with hidden input, for any that aren't set. It then
checks the client ID and secret, refreshes a token and reads one playlist item,
printing only OK or failed for each step, with Spotify's error code, its
description and a hint.

| Step and message                                      | What it means                                                                                                                             | Fix                                                                                                                                                                                                          |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| client ID + secret: `Invalid client`                  | Spotify knows the client ID but rejects the secret: a typo, or the secret was rotated and this is the old one.                            | In the dashboard, open the app's **Settings**, click **View client secret** and copy the current one into `SPOTIFY_CLIENT_SECRET`. Rotating replaces the old secret, so update every repo that uses the app. |
| client ID + secret: `Failed to get client`            | Spotify doesn't know the client ID.                                                                                                       | Copy the **Client ID** again from the app's **Settings**; check that the app still exists.                                                                                                                   |
| token refresh: `invalid_client` after the pair passed | The ID and secret are fine together, so the refresh token was issued for a different app.                                                 | Create a token for this app with `python -m scripts.spotify_auth` (step 4) and re-save `SPOTIFY_REFRESH_TOKEN`.                                                                                              |
| token refresh: `invalid_grant`                        | The refresh token was revoked or has expired, or Spotify doesn't recognise it at all.                                                     | Create a new token with `python -m scripts.spotify_auth` and re-save `SPOTIFY_REFRESH_TOKEN`.                                                                                                                |
| anything else                                         | Shown exactly as Spotify worded it.                                                                                                       | Follow the description.                                                                                                                                                                                      |
| playlist read `HTTP 403`                              | The account may not use the app: in development mode the owner needs Premium, and other accounts must be added under **User Management**. | Authorize with the account that owns the app and the playlist.                                                                                                                                               |
| playlist read `HTTP 404`                              | The playlist id is wrong or the playlist belongs to another account.                                                                      | Check `spotifyPlaylistId` in `site.config.ts`.                                                                                                                                                               |

A refresh token copied from WeeklySpotifyUpdate's `.spotify_cache` works only
with that app's client ID and secret. The file is JSON, so copy just the
`refresh_token` value (the log warns if the secret looks like JSON, or like an
access token). Tokens from that cache also carry write scopes this site doesn't
need; a dedicated token from `scripts.spotify_auth` asks only for read access.
When saving secrets, `gh secret set NAME` prompts for the value, which avoids a
trailing newline from `echo`.

### 3. `LASTFM_API_KEY`: the "on repeat" and "most played" rows of the now box

The now box shows your most played track and artist of the last seven days on
Last.fm, so Last.fm has to know what you play. The artist's photo and the
track's preview come from Deezer, which needs no key.

1. **Scrobble Spotify to Last.fm**, if you don't already. At
   [last.fm/settings/applications](https://www.last.fm/settings/applications),
   connect **Spotify scrobbling**. Plays count from then on.
2. **Create an API account.** Logged in to Last.fm, open
   [last.fm/api/account/create](https://www.last.fm/api/account/create). Fill in
   an application name (e.g. `slow feed`) and a short description; leave the
   callback URL empty. Submit.
3. The next page shows an **API key** and a **shared secret**. Only the API key
   is needed: save it as `LASTFM_API_KEY`. (Your applications are listed later
   at [last.fm/api/accounts](https://www.last.fm/api/accounts).)
4. Set `lastfmUsername` in `site.config.ts`.

The key only reads public listening data and doesn't expire.

### Check it worked

Run **Actions → Deploy → Run workflow**. In the finished run, open the **Fetch
feeds** step's summary: every feed you configured should say `updated`, and the
live site shows its card.
