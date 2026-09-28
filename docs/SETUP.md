# Setup

This covers everything that has to be configured once: the site values, the
GitHub Pages settings, and the tokens the fetchers use.

## Local development

Requires Node 22.12+ (`.nvmrc` pins the current LTS) and Python 3.10+.

```sh
npm install
npm run dev        # http://localhost:4321/blog/ — drafts are visible here
npm run build      # static site in dist/
npm run preview    # serve dist/ locally
npm run check      # type-check (astro check)
npm run lint       # ESLint + Prettier check
npm run format     # format everything with Prettier
```

```sh
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
ruff check . && ruff format --check . && mypy && pytest
```

Without any secrets, the site builds from the sample feeds in `src/data/feeds/`.

## Site values

Every site-specific value is in [`site.config.ts`](../site.config.ts). Values
still in CAPITALS are placeholders.

| Field                | Value                                                                                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`               | The lowercase wordmark, `matteo`.                                                                                                                 |
| `tagline`            | `a slow feed`.                                                                                                                                    |
| `heroTitle`          | The large line on the home page.                                                                                                                  |
| `heroBio`            | One or two sentences about you, under the hero title.                                                                                             |
| `url`                | The site's origin only, no path: `https://<user>.github.io`, or your custom domain.                                                               |
| `basePath`           | `/blog` while the site is served at `https://<user>.github.io/blog/`. Set it to `/` if you move to a custom domain; nothing else needs to change. |
| `timezone`           | An IANA zone such as `Europe/Berlin`. Used for dates and the "this week" range.                                                                   |
| `spotifyPlaylistId`  | The id at the end of the playlist's share link, `open.spotify.com/playlist/<id>`.                                                                 |
| `letterboxdUsername` | From `letterboxd.com/<username>/`.                                                                                                                |
| `goodreadsUserId`    | The number in your profile URL, `goodreads.com/user/show/<id>-name`.                                                                              |
| `instagramUsername`  | `fuzetea_esports`.                                                                                                                                |
| `githubUsername`     | Your GitHub login.                                                                                                                                |

## GitHub Pages

In the repository's **Settings → Pages**, set **Source** to **GitHub Actions**.
The deploy workflow builds and publishes the site; nothing is committed back to
the repo.

## Secrets

Add each secret in **Settings → Secrets and variables → Actions → New repository
secret**, or from a terminal with `gh secret set NAME`. Never commit a token or a
`.env` file.

### Spotify: `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REFRESH_TOKEN`

These are the same kind of credentials as in the WeeklySpotifyUpdate repo, and
you can reuse that app.

1. At [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard),
   create an app (or open the existing one). Add a redirect URI such as
   `http://127.0.0.1:8888/callback`.
2. Copy the **Client ID** and **Client secret** into `SPOTIFY_CLIENT_ID` and
   `SPOTIFY_CLIENT_SECRET`.
3. Open this URL in a browser, logged in to your account, and approve:
   `https://accounts.spotify.com/authorize?client_id=<CLIENT_ID>&response_type=code&redirect_uri=http://127.0.0.1:8888/callback&scope=playlist-read-private%20playlist-read-collaborative`
4. The browser lands on the redirect URI with `?code=…` in the address bar.
   Exchange that code for tokens:
   ```sh
   curl -X POST https://accounts.spotify.com/api/token \
     -u "<CLIENT_ID>:<CLIENT_SECRET>" \
     -d grant_type=authorization_code \
     -d code=<CODE> \
     -d redirect_uri=http://127.0.0.1:8888/callback
   ```
5. Save the `refresh_token` from the response as `SPOTIFY_REFRESH_TOKEN`. It
   doesn't expire unless you revoke the app.

### Instagram: `INSTAGRAM_TOKEN`

The fetcher uses the Instagram API with Instagram Login, which needs a
professional (Business or Creator) account. The account stays public.

1. In the Instagram app, switch the account to a **Creator** or **Business**
   account (Settings → Account type and tools).
2. At [developers.facebook.com](https://developers.facebook.com/apps), create an
   app of type **Business**, add the **Instagram** product and choose **API setup
   with Instagram login**.
3. Under **Generate access tokens**, add your Instagram account and generate a
   token with the `instagram_business_basic` permission. This is a long-lived
   token, valid for 60 days.
4. Save it as `INSTAGRAM_TOKEN`.

The fetcher refreshes the token on every run, so it never reaches its 60 days.
When Instagram returns a new token, the fetcher writes it back to
`INSTAGRAM_TOKEN` with `gh secret set`, which needs `GH_SECRETS_TOKEN` below. If
the site doesn't deploy for 60 days, generate a new token by hand.

### `GH_SECRETS_TOKEN`

Lets the workflow rotate `INSTAGRAM_TOKEN`. The built-in `GITHUB_TOKEN` can't
write secrets.

1. Go to **GitHub → Settings → Developer settings → Fine-grained personal access
   tokens → Generate new token**.
2. **Repository access:** only this repository.
3. **Permissions → Repository → Secrets:** Read and write. Nothing else.
4. Pick an expiry and set yourself a reminder to renew it.
5. Save the token as `GH_SECRETS_TOKEN`.

### `GH_STATS_TOKEN`

Reads your contribution calendar through the GraphQL API.

1. Create another fine-grained personal access token.
2. **Repository access:** public repositories (read-only). No extra permissions.
3. Save it as `GH_STATS_TOKEN`.
