/**
 * Load the footer SVG asset
 * @returns {Promise<string>} - SVG content or empty string on error
 */
export async function loadFooterSVG() {
  try {
    const footerResponse = await fetch('/horizontal-stripe.svg');
    const svg = await footerResponse.text();
    return svg;
  } catch (error) {
    return '';
  }
}
