/**
 * Asset loading and legend building utilities
 */

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

/**
 * Build a legend element from legend data
 * @param {Array} legendData - Array of {color, label} objects
 * @returns {HTMLElement} - Legend container element
 */
export function buildLegend(legendData) {
  const legendContainer = document.createElement('div');
  legendContainer.className = 'gantt-legend';

  const title = document.createElement('h3');
  title.className = 'legend-title';
  title.textContent = 'Legend';
  legendContainer.appendChild(title);

  const list = document.createElement('div');
  list.className = 'legend-list';

  for (const item of legendData) {
    const itemEl = document.createElement('div');
    itemEl.className = 'legend-item';

    const colorBox = document.createElement('div');
    colorBox.className = 'legend-color-box';
    colorBox.setAttribute('data-color', item.color);

    const label = document.createElement('span');
    label.className = 'legend-label';
    label.textContent = item.label;

    itemEl.appendChild(colorBox);
    itemEl.appendChild(label);
    list.appendChild(itemEl);
  }

  legendContainer.appendChild(list);
  return legendContainer;
}
