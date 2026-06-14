/**
 * Backdrop — the dashboard's full-bleed background layer.
 *
 * In the previous LENS_0 (Hermes teal dark) theme this component painted
 * a five-layer visual stack — canvas, inverted filler image, warm
 * vignette, foreground inversion, animated noise grain — that gave the
 * dashboard its distinctive "AI editor" look.  None of that translates
 * to the paper / publication theme that ships by default today: there's
 * no dark canvas to invert, no glow to soften, and grain reads as
 * dirt on a clean white page.
 *
 * The CSS in `index.css` already paints the paper canvas (#fafaf9) on
 * `<html>` / `<body>`, so the right thing to do here is render
 * nothing.  The component is preserved (not deleted) because:
 *   1. `App.tsx` still imports it, and
 *   2. Future themes (or the legacy LENS_0 preset, still available via
 *      `themes/presets.ts`) can re-implement the rich backdrop here
 *      without touching any callers.
 */
export function Backdrop(): null {
  return null;
}
