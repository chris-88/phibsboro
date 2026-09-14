/**
 * The iOS share glyph, inline SVG so it takes the surrounding text colour in both themes and stays
 * sharp at any size (S2.8, AC7). A square open at the top with an arrow pushing up out of it — the
 * mark a player taps at the bottom of Safari. Deliberately not a lucide "share" icon: the Android
 * share glyph is a different shape, and a player looking for this one on an iPhone would not find it.
 *
 * Sized at `1em` so it rides at the text's own size inside step one's sentence, `currentColor` for
 * the stroke, and `aria-hidden` — the sentence around it carries the meaning, so a screen reader is
 * not read a lone glyph.
 */
export function IosShareIcon(): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className="inline-block align-text-bottom"
    >
      {/* arrow shaft rising out of the box */}
      <path d="M12 3v12" />
      {/* chevron head at the top of the arrow */}
      <path d="M8 7l4-4 4 4" />
      {/* the box, open at the top where the arrow leaves it */}
      <path d="M8 9H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-2" />
    </svg>
  )
}
