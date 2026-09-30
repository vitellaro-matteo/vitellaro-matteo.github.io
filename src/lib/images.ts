// Responsive sizes for content images (docs/DESIGN.md §3, Images). The widths
// follow the layout: a 1120px container with 40px side padding below 1200px and
// 24px below 768px, a 640px middle column (span 7) and 352px recipe cards.

export interface ImageSizes {
  /** Widths to generate, in px. */
  widths: number[];
  /** The `sizes` attribute: how wide the image is shown at each viewport width. */
  sizes: string;
}

/** The recipe photo and a journal cover, across the middle column. */
export const COLUMN_IMAGE: ImageSizes = {
  widths: [640, 960, 1280, 1920],
  sizes: '(max-width: 767px) calc(100vw - 48px), (max-width: 1023px) calc(100vw - 80px), 640px',
};

/** A recipe card on /cooking: 3 columns, 2 on tablets, 1 on phones. */
export const CARD_IMAGE: ImageSizes = {
  widths: [360, 720, 1080],
  sizes:
    '(max-width: 767px) calc(100vw - 48px), (max-width: 1023px) calc((100vw - 112px) / 2), 352px',
};

/** A cover on the lists page: 104px wide, 72px on phones. */
export const LIST_IMAGE: ImageSizes = {
  widths: [72, 104, 144, 208],
  sizes: '(max-width: 767px) 72px, 104px',
};

/** An image always shown at one width: that width and twice it, for high-density screens. */
export function fixedImage(width: number): ImageSizes {
  return { widths: [width, width * 2], sizes: `${width}px` };
}
