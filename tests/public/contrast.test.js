import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * Holds the glass text tokens to WCAG AA contrast.
 *
 * README claimed "Verified contrast ratios meeting WCAG 2.1 AA standards" while
 * --glass-text-muted measured 3.08:1 and --glass-text-secondary 4.42:1 against the gradient
 * midpoint — both below the 4.5:1 needed for normal text, and both used on --text-sm body
 * copy in document-view.css. Nothing had ever computed them; the README pointed at a
 * checkColorContrast() helper that does not exist in Accessibility.js.
 *
 * The values are alpha-composited white over the glass panel (--glass-white-8) over each
 * navy gradient stop, which is what the browser actually paints. The tokens are parsed out
 * of the stylesheet rather than duplicated here, so editing the CSS is what this test sees.
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

describe('glass text tokens meet WCAG AA', () => {
  for (const token of ['glass-text-secondary', 'glass-text-muted']) {
    for (const backdrop of BACKDROPS) {
      it(`--${token} clears ${AA_NORMAL}:1 over ${backdrop.name}`, () => {
        const panel = composite([255, 255, 255], PANEL_ALPHA, backdrop.rgb);
        const painted = composite([255, 255, 255], alphaOf(token), panel);
        const ratio = contrast(painted, panel);
        expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL);
      });
    }
  }

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
