// Test-only colour maths, so AC11 is a check rather than an assertion of good intent.
// OKLCH to sRGB uses Björn Ottosson's matrices; the ratio is WCAG 2.1 relative luminance.

export type Rgb = readonly [number, number, number]

export function oklchToSrgb(L: number, C: number, hDeg: number): Rgb {
  const h = (hDeg * Math.PI) / 180
  const a = C * Math.cos(h)
  const b = C * Math.sin(h)

  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3

  const lr = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
  const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
  const lb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s

  const encode = (u: number) => (u <= 0.0031308 ? 12.92 * u : 1.055 * u ** (1 / 2.4) - 0.055)
  const clamp = (u: number) => Math.min(1, Math.max(0, u))

  return [clamp(encode(lr)), clamp(encode(lg)), clamp(encode(lb))]
}

function luminance([r, g, b]: Rgb): number {
  const lin = (u: number) => (u <= 0.04045 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4)
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05)
}

/** Pull the `:root` OKLCH custom properties out of the token stylesheet. */
export function readOklchTokens(css: string): Record<string, Rgb> {
  const tokens: Record<string, Rgb> = {}
  const pattern = /--([a-z-]+):\s*oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)\)/g
  for (const match of css.matchAll(pattern)) {
    const [, name, l, c, h] = match
    if (name === undefined || l === undefined || c === undefined || h === undefined) continue
    tokens[name] = oklchToSrgb(Number(l), Number(c), Number(h))
  }
  return tokens
}

export function toHex(rgb: Rgb): string {
  return `#${rgb
    .map((v) =>
      Math.round(v * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`
}
