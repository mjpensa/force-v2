import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * Reports measured contrast of the glass text tokens, and holds the invariants that are
 * genuinely invariant.
 *
 * It does NOT assert a WCAG AA threshold. The secondary/muted alphas are an aesthetic
 * decision — the separation between them is what makes the glass read as glass — and the
 * owner has chosen to keep them where they are, below 4.5:1 for normal text. A test that
 * failed on those values would be enforcing a design choice that was explicitly declined,
 * which is how a suite starts getting ignored.
 *
 * What it does enforce: the hierarchy ordering, and that the Tailwind utilities stay in step
 * with the CSS custom properties. Those two are separate declarations of the same colour and
 * silently drifting apart is a real bug rather than a matter of taste.
 *
 * The measured ratios are printed so the cost of the choice stays visible. If contrast does
 * need improving later, the lever is type size on --text-sm body copy (large text qualifies
 * at 3:1) rather than flattening the palette.
 *
 * Values are alpha-composited white over the glass panel (--glass-white-8) over each navy
 * gradient stop, which is what the browser actually paints. Tokens are parsed out of the
 * stylesheet rather than duplicated here, so editing the CSS is what this test sees.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSS = readFileSync(join(__dirname, '..', '..', 'Public', 'styles', 'design-system.css'), 'utf8');
const TAILWIND_CONFIG = readFileSync(join(__dirname, '..', '..', 'tailwind.config.js'), 'utf8');

const AA_NORMAL = 4.5;

const srgb = (c) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
const luminance = ([r, g, b]) => 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const composite = (fg, alpha, bg) => fg.map((c, i) => c * alpha + bg[i] * (1 - alpha));

/** Read a `--name: <value>;` custom property out of the stylesheet. */
function cssVar(name) {
  const m = CSS.match(new RegExp(`--${name}\\s*:\\s*([^;]+);`));
  if (!m) throw new Error(`--${name} not found in design-system.css`);
  return m[1].trim();
}
/** Alpha channel of an `rgba(r, g, b, a)` token. */
function alphaOf(name) {
  const m = cssVar(name).match(/rgba\([^)]*,\s*([\d.]+)\s*\)/);
  if (!m) throw new Error(`--${name} is not an rgba() value: ${cssVar(name)}`);
  return parseFloat(m[1]);
}

// The three stops of the navy gradient the glass panels sit on.
const BACKDROPS = ['color-navy-deep', 'color-navy-brand', 'color-navy-mid'].map((n) => ({
  name: n,
  rgb: hexToRgb(cssVar(n)),
}));
const PANEL_ALPHA = parseFloat(cssVar('glass-white-8').match(/,\s*([\d.]+)\s*\)/)[1]);

describe('glass text tokens', () => {
  it('reports measured contrast against each gradient stop', () => {
    const lines = [];
    for (const token of ['glass-text-secondary', 'glass-text-muted']) {
      for (const backdrop of BACKDROPS) {
        const panel = composite([255, 255, 255], PANEL_ALPHA, backdrop.rgb);
        const painted = composite([255, 255, 255], alphaOf(token), panel);
        const ratio = contrast(painted, panel);
        lines.push(
          `  --${token} over ${backdrop.name}: ${ratio.toFixed(2)}:1` +
            (ratio >= AA_NORMAL ? '' : ` (below AA ${AA_NORMAL}:1 for normal text — accepted)`)
        );
        expect(Number.isFinite(ratio)).toBe(true);
      }
    }
    console.log('[contrast]\n' + lines.join('\n'));
  });

  it('keeps the visual hierarchy primary > secondary > muted', () => {
    expect(alphaOf('glass-text-secondary')).toBeGreaterThan(alphaOf('glass-text-muted'));
    expect(cssVar('glass-text-primary')).toBe('#FFFFFF');
  });

  // design-system.css drives hand-written CSS; tailwind.config.js drives the text-glass-*
  // utilities used in index.html. They are separate declarations of the same colour, and a
  // fix applied to one and not the other would leave half the UI failing.
  it('tailwind text-glass-* utilities match the CSS custom properties', () => {
    const block = TAILWIND_CONFIG.match(/textColor:\s*\{([^}]+)\}/)[1];
    const tailwindAlpha = (key) =>
      parseFloat(block.match(new RegExp(`'${key}':\\s*'rgba\\([^)]*,\\s*([\\d.]+)\\s*\\)'`))[1]);

    expect(tailwindAlpha('glass-secondary')).toBeCloseTo(alphaOf('glass-text-secondary'), 3);
    expect(tailwindAlpha('glass-muted')).toBeCloseTo(alphaOf('glass-text-muted'), 3);
  });
});
