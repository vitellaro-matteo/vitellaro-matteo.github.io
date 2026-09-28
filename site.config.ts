// Every blank from SITE_SPEC.md §0 lives here — nowhere else.
// Tokens (Spotify, Instagram, GitHub) are GitHub Actions secrets, not here.
// Values in CAPITALS are placeholders still to be filled in.

export const site = {
  /** {{SITE_NAME}} — lowercase wordmark */
  name: 'matteo',
  /** {{TAGLINE}} */
  tagline: 'a slow feed',
  /** {{HERO_TITLE}} */
  heroTitle:
    'A quiet shelf for the songs, films, books and small things I keep finding.',
  /** {{HERO_BIO}} — 1–2 sentences about me */
  heroBio: 'HERO_BIO — one or two sentences about me go here.',
  /** {{SITE_URL}} — e.g. https://<user>.github.io or a custom domain */
  url: 'https://SITE-URL.example',
  /** {{TIMEZONE}} — used for week numbers and dates */
  timezone: 'Europe/Berlin',

  /** {{SPOTIFY_PLAYLIST_ID}} — the "last week's finds" playlist */
  spotifyPlaylistId: 'SPOTIFY_PLAYLIST_ID',
  /** {{LETTERBOXD_USERNAME}} */
  letterboxdUsername: 'LETTERBOXD_USERNAME',
  /** {{GOODREADS_USER_ID}} — numeric id from the profile URL */
  goodreadsUserId: 'GOODREADS_USER_ID',
  /** {{INSTAGRAM_USERNAME}} */
  instagramUsername: 'fuzetea_esports',
  /** {{GITHUB_USERNAME}} */
  githubUsername: 'GITHUB_USERNAME',
} as const;

export const links = {
  spotify: `https://open.spotify.com/playlist/${site.spotifyPlaylistId}`,
  letterboxd: `https://letterboxd.com/${site.letterboxdUsername}/`,
  goodreads: `https://www.goodreads.com/user/show/${site.goodreadsUserId}`,
  instagram: `https://www.instagram.com/${site.instagramUsername}/`,
  github: `https://github.com/${site.githubUsername}`,
  rss: '/rss.xml',
} as const;
