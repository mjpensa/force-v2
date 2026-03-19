export function buildAnalysisSection(title, content) {
  if (!content) return '';
  return `<div class="analysis-section"><h4>${DOMPurify.sanitize(title)}</h4><p>${DOMPurify.sanitize(content)}</p></div>`;
}
