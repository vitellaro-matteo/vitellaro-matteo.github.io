// The CMS configuration (public/admin/config.yml) must describe exactly the
// content schemas: same field names, types and required flags. Also checks the
// editor components that write the site's MDX embeds.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { z } from 'astro/zod';
import { site } from '../../site.config';
import { countrySchema } from './countries';
import { journalSchema, LIST_CATEGORIES, LIST_LENGTH, listSchema, recipeSchema } from './schemas';
import {
  components,
  escapeAttribute,
  escapeBodyOnSave,
  escapeProse,
  parseAttributes,
  trackId,
  unescapeAttribute,
} from '../../public/admin/cms.js';

interface CmsField {
  name: string;
  widget: string;
  required?: boolean;
  options?: string[];
  max?: number;
  field?: CmsField;
  fields?: CmsField[];
  root?: boolean;
  modes?: string[];
  editor_components?: string[];
}

interface CmsCollection {
  name: string;
  folder?: string;
  path?: string;
  extension?: string;
  fields?: CmsField[];
  files?: { name: string; file: string; fields: CmsField[] }[];
}

interface CmsConfig {
  site_url: string;
  backend: { name: string; repo: string; branch: string; auth_methods: string[] };
  collections: CmsCollection[];
  media_libraries: {
    default: { config: { transformations: { raster_image: Record<string, unknown> } } };
  };
}

const config = parse(readFileSync('public/admin/config.yml', 'utf-8')) as CmsConfig;
const collection = (name: string) => {
  const found = config.collections.find((c) => c.name === name);
  if (!found) throw new Error(`no ${name} collection in config.yml`);
  return found;
};

/** Stands in for Astro's image(): a string the test can recognise. */
const image = () => z.string().describe('image');

type Kind =
  | { type: 'string' | 'image' | 'date' | 'boolean' | 'number' | 'union' | 'tuple' }
  | { type: 'enum'; options: string[] }
  | { type: 'array'; element: z.ZodType; max: number | undefined };

/** A schema's shape, seen through optional(), default() and transform(). */
function kindOf(schema: z.ZodType): Kind {
  const def = schema._zod.def as {
    type: string;
    innerType?: z.ZodType;
    in?: z.ZodType;
    element?: z.ZodType;
    entries?: Record<string, string>;
    checks?: { _zod: { def: { check: string; maximum?: number } } }[];
  };
  if (def.innerType) return kindOf(def.innerType);
  if (def.type === 'pipe' && def.in) return kindOf(def.in);
  if (def.type === 'string') return { type: schema.description === 'image' ? 'image' : 'string' };
  if (def.type === 'enum') return { type: 'enum', options: Object.values(def.entries ?? {}) };
  if (def.type === 'array' && def.element) {
    const max = def.checks?.find((c) => c._zod.def.check === 'max_length')?._zod.def.maximum;
    return { type: 'array', element: def.element, max };
  }
  return { type: def.type as 'date' | 'boolean' | 'number' | 'union' | 'tuple' };
}

/** The CMS widgets that write a value the schema accepts. */
const WIDGETS: Record<string, string[]> = {
  string: ['string', 'text'],
  image: ['image'],
  date: ['datetime'],
  boolean: ['boolean'],
  number: ['number'],
  union: ['string', 'relation'],
  tuple: ['list'],
  enum: ['select'],
  array: ['list'],
};

/** Checks one CMS field list against one object schema, recursing into lists of objects. */
function expectFieldsMatch(
  fields: CmsField[],
  shape: Record<string, z.ZodType>,
  where: string,
  extra: string[] = [],
) {
  const names = fields.map((f) => f.name).filter((n) => !extra.includes(n));
  expect(names.sort(), `${where}: field names`).toEqual(Object.keys(shape).sort());

  for (const field of fields) {
    const schema = shape[field.name];
    if (!schema) continue;
    const at = `${where}.${field.name}`;
    const kind = kindOf(schema);
    expect(WIDGETS[kind.type], `${at}: ${field.widget} can't write a ${kind.type}`).toContain(
      field.widget,
    );
    const required = !schema.safeParse(undefined).success;
    expect(field.required ?? true, `${at}: required`).toBe(required);

    if (kind.type === 'enum') expect(field.options, `${at}: options`).toEqual(kind.options);
    if (kind.type === 'array') {
      expect(field.max, `${at}: max`).toBe(kind.max);
      if (kind.element instanceof z.ZodObject) {
        expect(field.fields, `${at}: a list of objects needs fields`).toBeDefined();
        expectFieldsMatch(field.fields ?? [], kind.element.shape, at);
      } else {
        expect(field.fields, `${at}: a list of values has no subfields`).toBeUndefined();
      }
    }
  }
}

describe('config.yml matches the content schemas', () => {
  it('journal', () => {
    expectFieldsMatch(collection('journal').fields ?? [], journalSchema(image).shape, 'journal', [
      'body',
    ]);
  });

  it('recipes', () => {
    expectFieldsMatch(collection('cooking').fields ?? [], recipeSchema(image).shape, 'cooking', [
      'body',
    ]);
  });

  it('lists, with a maximum of ten per category', () => {
    const fields = collection('lists').fields ?? [];
    expectFieldsMatch(fields, listSchema(image).shape, 'lists');
    for (const name of LIST_CATEGORIES) {
      expect(fields.find((f) => f.name === name)?.max).toBe(LIST_LENGTH);
    }
  });

  it('countries', () => {
    const file = collection('countries').files?.[0];
    const list = file?.fields[0];
    expect(file?.file).toBe('src/data/countries.yaml');
    expect(list?.root).toBe(true);
    expectFieldsMatch(list?.fields ?? [], countrySchema.shape, 'countries');
  });
});

describe('config.yml collections', () => {
  const entryCollections = config.collections.filter((c) => c.folder);

  it.each(entryCollections.map((c) => [c.name, c] as const))(
    '%s keeps each entry in a folder of its own, as the content loader reads it',
    (_, c) => {
      expect(c.path).toBe('{{slug}}/index');
      const folder = c.folder ?? '';
      const entries = readdirSync(folder, { withFileTypes: true }).filter((d) => d.isDirectory());
      expect(entries.length).toBeGreaterThan(0);
      for (const entry of entries) {
        expect(existsSync(join(folder, entry.name, `index.${c.extension}`))).toBe(true);
      }
    },
  );

  it('edits MDX bodies in rich text, with the embed components and raw mode', () => {
    for (const name of ['journal', 'cooking']) {
      const body = collection(name).fields?.find((f) => f.name === 'body');
      expect(body?.widget).toBe('markdown');
      expect(body?.modes).toEqual(['rich_text', 'raw']);
      expect(body?.editor_components).toEqual(components.map((c) => c.id));
    }
  });

  it('signs in to this repository with a token and shrinks photos before committing', () => {
    expect(config.site_url).toBe(site.url);
    expect(config.backend.repo.split('/')[0]).toBe(site.githubUsername);
    expect(config.backend).toMatchObject({
      name: 'github',
      repo: 'vitellaro-matteo/vitellaro-matteo.github.io',
      branch: 'main',
      auth_methods: ['token'],
    });
    expect(config.media_libraries.default.config.transformations.raster_image).toMatchObject({
      format: 'webp',
      width: 2400,
      height: 2400,
    });
  });
});

describe('editor components', () => {
  const component = (id: string) => {
    const found = components.find((c) => c.id === id);
    if (!found) throw new Error(`no ${id} component`);
    return found;
  };
  /** Writes data as MDX, then reads it back the way the CMS does. */
  const roundTrip = (id: string, data: Record<string, unknown>) => {
    const c = component(id);
    const block = c.toBlock(data);
    const match = block.match(c.pattern);
    expect(match, `${id} pattern must match its own output:\n${block}`).not.toBeNull();
    return { block, data: c.fromBlock(match as RegExpMatchArray) };
  };

  it('write nothing broken when inserted empty', () => {
    for (const c of components) {
      expect(() => c.toBlock({})).not.toThrow();
      expect(() => c.toPreview({})).not.toThrow();
    }
  });

  it('track: writes the attributes the component reads, and reads them back', () => {
    const { block, data } = roundTrip('track', {
      id: '7uIy4cNPvKpDYaXfCcmuSe',
      title: 'Say "hi" & go',
      artist: 'Someone',
      label: '',
    });
    expect(block).toBe(
      '<Track id="7uIy4cNPvKpDYaXfCcmuSe" title="Say &quot;hi&quot; &amp; go" artist="Someone" />',
    );
    expect(data).toEqual({
      id: '7uIy4cNPvKpDYaXfCcmuSe',
      title: 'Say "hi" & go',
      artist: 'Someone',
    });
  });

  it('track: takes the id out of a pasted share link', () => {
    expect(trackId('https://open.spotify.com/track/7uIy4cNPvKpDYaXfCcmuSe?si=abc123')).toBe(
      '7uIy4cNPvKpDYaXfCcmuSe',
    );
    expect(trackId('https://open.spotify.com/intl-it/track/7uIy4cNPvKpDYaXfCcmuSe')).toBe(
      '7uIy4cNPvKpDYaXfCcmuSe',
    );
    expect(trackId('  placeholder1 ')).toBe('placeholder1');
  });

  it('aside: round-trips a margin note, escaping MDX', () => {
    expect(roundTrip('aside', { text: 'A note with *emphasis* and {braces}.' })).toEqual({
      block: '<Aside>A note with *emphasis* and \\{braces\\}.</Aside>',
      data: { text: 'A note with *emphasis* and {braces}.' },
    });
  });

  it('ingredients: round-trips rows, with or without a quantity, and escapes MDX', () => {
    const items = [
      { qty: '200 g', item: 'flour' },
      { qty: '', item: 'salt {to taste}' },
    ];
    const { block, data } = roundTrip('ingredients', { items });
    expect(block).toBe(
      [
        '<Ingredients>',
        '  <Ingredient qty="200 g">flour</Ingredient>',
        '  <Ingredient>salt \\{to taste\\}</Ingredient>',
        '</Ingredients>',
      ].join('\n'),
    );
    expect(data).toEqual({ items });
  });

  it('read the embeds already in the example entries', () => {
    const entry = readFileSync('src/content/journal/example-entry/index.mdx', 'utf-8');
    const recipe = readFileSync('src/content/recipes/example-recipe/index.mdx', 'utf-8');

    const track = entry.match(component('track').pattern);
    expect(component('track').fromBlock(track as RegExpMatchArray)).toEqual({ id: 'placeholder1' });

    const aside = entry.match(component('aside').pattern);
    expect(component('aside').fromBlock(aside as RegExpMatchArray)).toMatchObject({
      text: expect.stringMatching(/^A margin note\./),
    });

    const ingredients = recipe.match(component('ingredients').pattern);
    expect(component('ingredients').fromBlock(ingredients as RegExpMatchArray)).toEqual({
      items: [
        { qty: '200 g', item: 'ingredient one' },
        { qty: '2 tbsp', item: 'ingredient two' },
        { qty: '1', item: 'ingredient three' },
      ],
    });
  });

  it('attribute escaping is reversible', () => {
    const value = 'a "quoted" & amped value';
    expect(unescapeAttribute(escapeAttribute(value))).toBe(value);
    expect(parseAttributes(`id="x" title="${escapeAttribute(value)}"`)).toEqual({
      id: 'x',
      title: value,
    });
  });
});

describe('escapeProse', () => {
  it('escapes braces and a stray < in prose', () => {
    expect(escapeProse('Braces {like these} and a < sign, 3<4.')).toBe(
      'Braces \\{like these\\} and a \\< sign, 3\\<4.',
    );
  });

  it('leaves tags, code and escaped characters alone', () => {
    const body = [
      'Text with `{code}` inline and an <em>inline tag</em>.',
      '',
      '<Film title="A" year={1997} />',
      '<Track',
      '  id="x"',
      '/>',
      '',
      '```js',
      'const a = { b: 1 } < 2;',
      '```',
      '',
      'Already \\{escaped\\} and \\< too.',
    ].join('\n');
    expect(escapeProse(body)).toBe(body);
  });

  it('changes nothing when saved a second time', () => {
    const once = escapeProse('A {brace} and < and `{code}`.');
    expect(escapeProse(once)).toBe(once);
  });

  it('keeps every example entry as it is', () => {
    for (const path of [
      'src/content/journal/example-entry/index.mdx',
      'src/content/recipes/example-recipe/index.mdx',
    ]) {
      const body = readFileSync(path, 'utf-8').split('\n---\n')[1] ?? '';
      expect(escapeProse(body)).toBe(body);
    }
  });
});

describe('the save hook', () => {
  /** A minimal Immutable Map, enough for the hook. */
  const map = (values: Record<string, unknown>) => ({
    get: (key: string) => values[key],
    set: (key: string, value: unknown) => map({ ...values, [key]: value }),
  });

  it('escapes the body of journal entries and recipes only', () => {
    const run = (collection: string) =>
      escapeBodyOnSave
        .handler({ entry: map({ collection, data: map({ body: 'a {b}', title: 'x' }) }) })
        .get('body');
    expect(run('journal')).toBe('a \\{b\\}');
    expect(run('cooking')).toBe('a \\{b\\}');
    expect(run('lists')).toBe('a {b}');
  });
});
