import { site } from '../../site.config';
import { url } from './paths';

/** One share card per page type; pages of a type share its card. */
export const OG_CARDS = {
  home: { label: 'hello', title: site.heroTitle },
  journal: { label: 'journal', title: 'Notes & essays' },
  lists: { label: 'lists', title: 'Top tens, every December' },
  cooking: { label: 'cooking', title: "What I've been cooking" },
  challenge: { label: 'around the world', title: 'One dish, every country' },
} as const;

export type OgType = keyof typeof OG_CARDS;

export const isOgType = (value: string | undefined): value is OgType =>
  value !== undefined && Object.hasOwn(OG_CARDS, value);

/** Absolute URL of a page type's card, as og:image needs. */
export const ogImageUrl = (type: OgType, siteUrl: string | URL): string =>
  new URL(url(`/og/${type}.png`), siteUrl).href;
