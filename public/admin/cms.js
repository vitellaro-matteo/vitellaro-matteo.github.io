// Sveltia CMS additions for the site's MDX bodies (docs/DESIGN.md §5, CMS),
// registered by index.html:
// - editor components: Insert-menu entries that write <Track>, <Aside> and
//   <Ingredients>, so an entry never needs hand-typed MDX. Each component's
//   pattern must read back exactly what its toBlock writes;
// - a save hook that escapes the characters MDX would read as code in prose,
//   so a { or < typed on a phone can't break the build.
// src/lib/cms.test.ts checks both.

/** Attribute order when writing a <Track>, matching the component's props. */
const TRACK_ATTRIBUTES = ['id', 'title', 'artist', 'cover', 'label'];

/** @param {string} value */
export const escapeAttribute = (value) => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;');

/** @param {string} value */
export const unescapeAttribute = (value) =>
  value.replaceAll('&quot;', '"').replaceAll('&amp;', '&');

/**
 * The attributes of a tag: `id="x" title="y"` → `{ id: 'x', title: 'y' }`.
 * @param {string} source
 * @returns {Record<string, string>}
 */
export function parseAttributes(source) {
  /** @type {Record<string, string>} */
  const found = {};
  for (const [, name, value] of source.matchAll(/(\w+)="([^"]*)"/g)) {
    if (name !== undefined && value !== undefined) found[name] = unescapeAttribute(value);
  }
  return found;
}

/**
 * ` id="x" title="y"`: the non-empty values, in the given order.
 * @param {Record<string, unknown>} data
 * @param {string[]} names
 */
export function writeAttributes(data, names) {
  return names
    .map((name) => [name, String(data[name] ?? '').trim()])
    .filter(([, value]) => value !== '')
    .map(([name, value]) => ` ${name}="${escapeAttribute(value ?? '')}"`)
    .join('');
}

/**
 * The 22-character Spotify id in a pasted share link, or the value as typed.
 * @param {string} value
 */
export function trackId(value) {
  const link = value.match(/open\.spotify\.com\/(?:[\w-]+\/)*track\/([0-9A-Za-z]{22})/);
  return link?.[1] ?? value.trim();
}

/**
 * Text that MDX would otherwise read as a tag or an expression.
 * @param {string} value
 */
export const escapeText = (value) => value.replace(/[{}<]/g, (char) => `\\${char}`);

/** @param {string} value */
export const unescapeText = (value) => value.replace(/\\([{}<])/g, '$1');

/**
 * Escapes {, } and a < that doesn't open a tag, outside inline code.
 * @param {string} line
 */
const escapeProseLine = (line) =>
  line
    .split(/(`[^`]*`)/)
    .map((part, i) =>
      i % 2 === 1
        ? part
        : part
            .replace(/(?<!\\)[{}]/g, (char) => `\\${char}`)
            .replace(/(?<!\\)<(?![A-Za-z/!])/g, '\\<'),
    )
    .join('');

/**
 * A Markdown body made safe for MDX: in prose, {, } and a < that doesn't open a
 * tag are escaped, as MDX would read them as an expression or a tag. Tag lines
 * (the embeds), fenced code and inline code are left as they are, and so is
 * anything already escaped, so saving again changes nothing.
 * @param {string} markdown
 */
export function escapeProse(markdown) {
  /** @type {string | null} */
  let fence = null;
  let inTag = false;
  return markdown
    .split('\n')
    .map((line) => {
      const trimmed = line.trimStart();
      const opensFence = trimmed.match(/^(`{3,}|~{3,})/);
      if (fence !== null) {
        if (opensFence && trimmed.startsWith(fence)) fence = null;
        return line;
      }
      if (opensFence) {
        fence = opensFence[1] ?? null;
        return line;
      }
      if (inTag) {
        if (line.includes('>')) inTag = false;
        return line;
      }
      if (/^<[A-Za-z/!]/.test(trimmed)) {
        inTag = !line.includes('>');
        return line;
      }
      return escapeProseLine(line);
    })
    .join('\n');
}

/** Collections whose body is MDX. */
const MDX_COLLECTIONS = ['journal', 'cooking'];

/**
 * @typedef {{
 *   get(key: string): unknown,
 *   set(key: string, value: unknown): ImmutableMap,
 * }} ImmutableMap
 */

/** Sveltia's preSave hook: escapes the prose of an MDX body before it is written. */
export const escapeBodyOnSave = {
  name: 'preSave',
  /** @param {{ entry: ImmutableMap }} event */
  handler: ({ entry }) => {
    const data = /** @type {ImmutableMap} */ (entry.get('data'));
    const body = data.get('body');
    if (typeof body !== 'string' || !MDX_COLLECTIONS.includes(String(entry.get('collection')))) {
      return data;
    }
    return data.set('body', escapeProse(body));
  },
};

/**
 * @param {string} value
 * @returns {string}
 */
const escapeHtml = (value) =>
  value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

/** @typedef {{ qty?: string, item?: string }} IngredientRow */

export const components = [
  {
    id: 'track',
    label: 'Song',
    icon: 'music_note',
    fields: [
      {
        name: 'id',
        label: 'Spotify link or track id',
        widget: 'string',
        hint: 'Paste the song’s share link. A song from last week’s finds needs nothing else.',
      },
      {
        name: 'title',
        label: 'Title',
        widget: 'string',
        required: false,
        hint: 'Only for a song that isn’t in the playlist.',
      },
      { name: 'artist', label: 'Artist', widget: 'string', required: false },
      {
        name: 'cover',
        label: 'Cover',
        widget: 'string',
        required: false,
        hint: 'Only for a song that isn’t in the playlist: a path like /media/….',
      },
      {
        name: 'label',
        label: 'Label',
        widget: 'string',
        required: false,
        hint: 'Replaces “from last week’s finds”.',
      },
    ],
    pattern: /^<Track\b(?<attributes>[^>]*?)\s*\/>$/m,
    /** @param {RegExpMatchArray} match */
    fromBlock: (match) => parseAttributes(match.groups?.attributes ?? ''),
    /** @param {Record<string, unknown>} data */
    toBlock: (data) =>
      `<Track${writeAttributes({ ...data, id: trackId(String(data.id ?? '')) }, TRACK_ATTRIBUTES)} />`,
    /** @param {Record<string, unknown>} data */
    toPreview: (data) =>
      `<p><strong>Song</strong> ${escapeHtml(String(data.title || trackId(String(data.id ?? ''))))}</p>`,
  },
  {
    id: 'aside',
    label: 'Margin note',
    icon: 'sticky_note_2',
    fields: [
      {
        name: 'text',
        label: 'Note',
        widget: 'text',
        hint: 'Put it just before the paragraph it belongs to.',
      },
    ],
    pattern: /^<Aside>(?<text>[\s\S]*?)<\/Aside>$/m,
    /** @param {RegExpMatchArray} match */
    fromBlock: (match) => ({ text: unescapeText((match.groups?.text ?? '').trim()) }),
    /** @param {Record<string, unknown>} data */
    toBlock: (data) => `<Aside>${escapeText(String(data.text ?? '').trim())}</Aside>`,
    /** @param {Record<string, unknown>} data */
    toPreview: (data) => `<p><em>Margin note:</em> ${escapeHtml(String(data.text ?? ''))}</p>`,
  },
  {
    id: 'ingredients',
    label: 'Ingredients',
    icon: 'grocery',
    fields: [
      {
        name: 'items',
        label: 'Ingredients',
        label_singular: 'Ingredient',
        widget: 'list',
        summary: '{{fields.qty}} {{fields.item}}',
        fields: [
          {
            name: 'qty',
            label: 'Quantity',
            widget: 'string',
            required: false,
            hint: 'e.g. 200 g',
          },
          { name: 'item', label: 'Ingredient', widget: 'string' },
        ],
      },
    ],
    pattern: /^<Ingredients>\n(?<rows>[\s\S]*?)\n?<\/Ingredients>$/m,
    /** @param {RegExpMatchArray} match */
    fromBlock: (match) => ({
      items: [
        ...(match.groups?.rows ?? '').matchAll(/<Ingredient\b([^>]*)>([\s\S]*?)<\/Ingredient>/g),
      ].map(([, attributes = '', item = '']) => ({
        qty: parseAttributes(attributes).qty ?? '',
        item: unescapeText(item.trim()),
      })),
    }),
    /** @param {{ items?: IngredientRow[] }} data */
    toBlock: ({ items = [] }) =>
      [
        '<Ingredients>',
        ...items.map(
          (row) =>
            `  <Ingredient${writeAttributes(row, ['qty'])}>${escapeText(String(row.item ?? '').trim())}</Ingredient>`,
        ),
        '</Ingredients>',
      ].join('\n'),
    /** @param {{ items?: IngredientRow[] }} data */
    toPreview: ({ items = [] }) =>
      `<ul>${items.map((row) => `<li>${escapeHtml(`${row.qty ?? ''} ${row.item ?? ''}`.trim())}</li>`).join('')}</ul>`,
  },
];
