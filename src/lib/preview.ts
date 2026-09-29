/**
 * 10 ms of silence. Safari only lets audio start inside the tap itself, and a
 * preview's URL arrives a moment later, so the player starts this first to
 * unlock the audio element.
 */
export const SILENCE =
  'data:audio/wav;base64,UklGRnQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVAAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==';

/** Previews stop after this many seconds, even if the clip is longer. */
export const PREVIEW_SECONDS = 30;

/**
 * How far through a preview playback is, from 0 to 1, for the progress line.
 * Clips are capped at 30 seconds; an unknown duration (still loading) counts as 30.
 */
export function previewProgress(currentTime: number, duration: number): number {
  const length =
    Number.isFinite(duration) && duration > 0
      ? Math.min(duration, PREVIEW_SECONDS)
      : PREVIEW_SECONDS;
  return Math.min(1, Math.max(0, currentTime / length));
}

/** Whether playback has reached the 30-second cap (or the end of a shorter clip). */
export function previewFinished(currentTime: number, duration: number): boolean {
  return previewProgress(currentTime, duration) >= 1;
}
