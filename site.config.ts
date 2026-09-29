// Every site-specific value lives here and nowhere else (docs/SETUP.md lists them).
// Tokens are GitHub Actions secrets, never files in the repo.
// Values in CAPITALS are placeholders still to be filled in.

export const site = {
  /** {{SITE_NAME}} — lowercase wordmark */
  name: 'matteo',
  /** {{TAGLINE}} */
  tagline: 'my feed',
  /** {{HERO_TITLE}} */
  heroTitle: 'A shelf for the things I keep finding.',
  /** {{HERO_BIO}} — 1–2 sentences about me */
  heroBio: 'Hello! I like to share the things I find interesting, from music to movies and books.',
  /** {{SITE_URL}} — origin only, e.g. https://<user>.github.io or a custom domain */
  url: 'https://vitellaro-matteo.github.io',
  /** {{BASE_PATH}} — "/" for a user site or custom domain, "/<repo>" for a project site */
  basePath: '/',
  /** {{TIMEZONE}} — used for week numbers and dates */
  timezone: 'Europe/Berlin',

  /** {{SPOTIFY_PLAYLIST_ID}} — the "last week's finds" playlist (the id, or its share link) */
  spotifyPlaylistId: '5vxDxvkiXxa8SCCT0MgJMI',
  /** {{LASTFM_USERNAME}} — for the now box's "on repeat" row */
  lastfmUsername: 'matteo2601',
  /** {{LETTERBOXD_USERNAME}} */
  letterboxdUsername: 'matte0vit',
  /** {{GOODREADS_USER_ID}} — numeric id from the profile URL */
  goodreadsUserId: '182900584-matteo-vitellaro',
  /** {{GITHUB_USERNAME}} */
  githubUsername: 'vitellaro-matteo',
};

export const links = {
  spotify: `https://open.spotify.com/playlist/${site.spotifyPlaylistId}`,
  lastfm: `https://www.last.fm/user/${site.lastfmUsername}`,
  letterboxd: `https://letterboxd.com/${site.letterboxdUsername}/`,
  goodreads: `https://www.goodreads.com/user/show/${site.goodreadsUserId}`,
  github: `https://github.com/${site.githubUsername}`,
};
