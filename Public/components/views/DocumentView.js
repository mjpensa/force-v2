export class DocumentView {
  constructor(documentData = null, sessionId = null) {
    this.documentData = documentData;
    this.sessionId = sessionId;
    this.container = null;
  }
  render() {
    this.container = document.createElement('div');
    this.container.className = 'document-view';
    if (!this.documentData || !this.documentData.sections) {
      this.container.appendChild(this._renderEmptyState());
      return this.container;
    }
    const content = document.createElement('div');
    content.className = 'document-content';
    const title = document.createElement('h1');
    title.className = 'document-title';
    title.textContent = this.documentData.title;
    content.appendChild(title);
    this.documentData.sections.forEach(section => {
      const sectionEl = document.createElement('section');
      sectionEl.className = 'document-section';
      const heading = document.createElement('h2');
      heading.className = 'section-heading';
      heading.textContent = section.heading;
      sectionEl.appendChild(heading);
      if (section.paragraphs) {
        section.paragraphs.forEach(text => {
          const p = document.createElement('p');
          p.className = 'section-paragraph';
          p.textContent = text;
          sectionEl.appendChild(p);
        });
      }
      content.appendChild(sectionEl);
    });
    this.container.appendChild(content);
    return this.container;
  }
  _renderEmptyState() {
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-state';
    emptyState.innerHTML = `
      <h2>Document Not Ready</h2>
      <p>The executive summary is still generating.</p>
      <button onclick="window.location.reload()">Refresh</button>
    `;
    return emptyState;
  }
  destroy() {
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
  }
  async loadData(sessionId) {
    const response = await fetch(`/api/content/${sessionId}/document`);
    if (!response.ok) throw new Error('Failed to load document');
    const result = await response.json();
    if (result.status === 'completed' && result.data) {
      this.documentData = result.data;
      this.sessionId = sessionId;
    } else if (result.status === 'processing') {
      throw new Error('Document still generating...');
    } else {
      throw new Error(result.error || 'Failed to generate');
    }
  }
}
