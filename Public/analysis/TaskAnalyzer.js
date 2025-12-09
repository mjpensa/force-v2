import { safeGetElement, safeQuerySelector, buildAnalysisSection, createModal } from '../Utils.js';
import { ChatInterface } from './ChatInterface.js';
export class TaskAnalyzer {
  constructor() {
    this.modal = null;
    this.chatInterface = null;
  }
  async showAnalysis(taskIdentifier) {
    document.getElementById('analysis-modal')?.remove();
    const { overlay, body, close } = createModal({
      id: 'analysis-modal',
      title: 'Analyzing...',
      showSpinner: true,
      actions: [{ id: 'modal-export-btn', label: '📥', title: 'Export Analysis', className: 'modal-export-btn' }]
    });
    this.modal = overlay;
    this.modalClose = close;
    await this._fetchAndDisplayAnalysis(taskIdentifier);
  }
  async _fetchAndDisplayAnalysis(taskIdentifier) {
    try {
      const response = await fetch('/get-task-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskIdentifier)
      });
      if (!response.ok) {
        let errorMessage = `Server error: ${response.status}`;
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const err = await response.json();
            errorMessage = err.error || errorMessage;
          } else {
            const text = await response.text();
            errorMessage = text.substring(0, 200) || errorMessage;
          }
        } catch (parseError) {
        }
        throw new Error(errorMessage);
      }
      const analysis = await response.json();
      this._displayAnalysis(analysis, taskIdentifier);
    } catch (error) {
      this._displayError(error.message);
    }
  }
  _displayAnalysis(analysis, taskIdentifier) {
    const modalBody = safeGetElement('modal-body-content', 'TaskAnalyzer._displayAnalysis');
    if (!modalBody) return;
    const modalTitle = safeQuerySelector('.modal-title', 'TaskAnalyzer._displayAnalysis');
    if (modalTitle) {
      const confidenceBadge = this._buildConfidenceBadge(analysis.confidence);
      modalTitle.innerHTML = `${DOMPurify.sanitize(analysis.taskName)} ${confidenceBadge}`;
    }
    const quickFactsHTML = this._buildQuickFacts(analysis);
    const mainContentHTML = `
      ${this._buildFinancialSection(analysis)}
      ${this._buildStakeholderSection(analysis)}
      ${buildAnalysisSection('Success Metrics', analysis.keyMetrics)}
      ${this._buildTimelineSection(analysis)}
      ${this._buildRisksImpactSection(analysis)}
      ${this._buildProgressSection(analysis)}
      ${buildAnalysisSection('Facts', analysis.factsText)}
      ${buildAnalysisSection('Assumptions', analysis.assumptionsText)}
      ${buildAnalysisSection('Summary', analysis.summary)}
      ${buildAnalysisSection('Rationale / Hurdles', analysis.rationale)}
    `;
    const analysisHTML = `
      <div class="analysis-layout">
        <aside class="analysis-sidebar">
          ${quickFactsHTML}
        </aside>
        <main class="analysis-main">
          ${mainContentHTML}
        </main>
      </div>
    `;
    modalBody.innerHTML = DOMPurify.sanitize(analysisHTML);
    this._initializeCollapsibleSections();
    this._attachExportListener(analysis);
    this.chatInterface = new ChatInterface(modalBody, taskIdentifier);
    this.chatInterface.render();
  }
  _attachExportListener(analysis) {
    const exportBtn = document.getElementById('modal-export-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        this._exportAnalysis(analysis);
      });
    }
  }
  _exportAnalysis(analysis) {
    let content = `TASK ANALYSIS: ${analysis.taskName}\n`;
    content += `${'='.repeat(60)}\n\n`;
    content += `Status: ${analysis.status}\n`;
    content += `Timeline: ${analysis.startDate || 'N/A'} - ${analysis.endDate || 'N/A'}\n\n`;
    if (analysis.summary) {
      content += `SUMMARY\n${'─'.repeat(40)}\n${analysis.summary}\n\n`;
    }
    if (analysis.expectedDate || analysis.bestCaseDate || analysis.worstCaseDate) {
      content += `TIMELINE SCENARIOS\n${'─'.repeat(40)}\n`;
      if (analysis.bestCaseDate) content += `Best-Case: ${analysis.bestCaseDate}\n`;
      if (analysis.expectedDate) content += `Expected: ${analysis.expectedDate}\n`;
      if (analysis.worstCaseDate) content += `Worst-Case: ${analysis.worstCaseDate}\n`;
      content += '\n';
    }
    if (analysis.risksText) {
      content += `RISKS\n${'─'.repeat(40)}\n${analysis.risksText}\n\n`;
    }
    if (analysis.businessImpact) {
      content += `BUSINESS IMPACT\n${'─'.repeat(40)}\n${analysis.businessImpact}\n\n`;
    }
    if (analysis.strategicImpact) {
      content += `STRATEGIC IMPACT\n${'─'.repeat(40)}\n${analysis.strategicImpact}\n\n`;
    }
    if (analysis.totalCost || analysis.totalBenefit || analysis.roiSummary) {
      content += `FINANCIAL IMPACT\n${'─'.repeat(40)}\n`;
      if (analysis.totalCost) content += `Cost: ${analysis.totalCost}\n`;
      if (analysis.totalBenefit) content += `Benefit: ${analysis.totalBenefit}\n`;
      if (analysis.roiSummary) content += `ROI: ${analysis.roiSummary}\n`;
      content += '\n';
    }
    if (analysis.factsText) {
      content += `FACTS\n${'─'.repeat(40)}\n${analysis.factsText}\n\n`;
    }
    if (analysis.assumptionsText) {
      content += `ASSUMPTIONS\n${'─'.repeat(40)}\n${analysis.assumptionsText}\n\n`;
    }
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${analysis.taskName.replace(/[^a-z0-9]/gi, '_')}_analysis.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  _buildConfidenceBadge(confidence) {
    return '';
  }
  _buildQuickFacts(analysis) {
    const statusClass = analysis.status.replace(/\s+/g, '-').toLowerCase();
    let quickFactsHTML = `
      <div class="quick-facts-panel">
        <h4>Quick Facts</h4>
        <div class="quick-fact">
          <span class="fact-label">Status</span>
          <span class="status-pill status-${statusClass}">${DOMPurify.sanitize(analysis.status)}</span>
        </div>
        <div class="quick-fact">
          <span class="fact-label">Timeline</span>
          <span class="fact-value">${DOMPurify.sanitize(analysis.startDate || 'N/A')} - ${DOMPurify.sanitize(analysis.endDate || 'N/A')}</span>
        </div>
    `;
    if (analysis.status === 'in-progress' && analysis.percentComplete !== undefined) {
      quickFactsHTML += `
        <div class="quick-fact">
          <span class="fact-label">Progress</span>
          <span class="fact-value">${analysis.percentComplete}%</span>
        </div>
      `;
    }
    if (analysis.status === 'in-progress' && analysis.velocity) {
      const velocityIcon = analysis.velocity === 'on-track' ? '✓' : analysis.velocity === 'ahead' ? '▲' : '▼';
      quickFactsHTML += `
        <div class="quick-fact">
          <span class="fact-label">Velocity</span>
          <span class="fact-value">${velocityIcon} ${DOMPurify.sanitize(analysis.velocity)}</span>
        </div>
      `;
    }
    if (analysis.roiSummary) {
      quickFactsHTML += `
        <div class="quick-fact">
          <span class="fact-label">ROI</span>
          <span class="fact-value">${DOMPurify.sanitize(analysis.roiSummary.substring(0, 50))}${analysis.roiSummary.length > 50 ? '...' : ''}</span>
        </div>
      `;
    }
    quickFactsHTML += `</div>`;
    return quickFactsHTML;
  }
  _buildFinancialSection(analysis) {
    if (!analysis.totalCost && !analysis.totalBenefit && !analysis.roiSummary) return '';
    let html = '<div class="analysis-section financial-impact-section"><h4>💰 Financial Impact</h4>';
    if (analysis.totalCost) {
      html += `<p><strong>Total Cost:</strong> ${DOMPurify.sanitize(analysis.totalCost)}</p>`;
    }
    if (analysis.totalBenefit) {
      html += `<p><strong>Annual Benefit:</strong> ${DOMPurify.sanitize(analysis.totalBenefit)}</p>`;
    }
    if (analysis.roiSummary) {
      html += `<p><strong>ROI:</strong> ${DOMPurify.sanitize(analysis.roiSummary)}</p>`;
    }
    html += '</div>';
    return html;
  }
  _buildStakeholderSection(analysis) {
    if (!analysis.stakeholderSummary && !analysis.changeReadiness) return '';
    let html = '<div class="analysis-section stakeholder-impact-section"><h4>👥 Stakeholder & Change Management</h4>';
    if (analysis.stakeholderSummary) {
      html += `<p>${DOMPurify.sanitize(analysis.stakeholderSummary)}</p>`;
    }
    if (analysis.changeReadiness) {
      html += `<p><strong>Change Readiness:</strong> ${DOMPurify.sanitize(analysis.changeReadiness)}</p>`;
    }
    html += '</div>';
    return html;
  }
  _buildTimelineSection(analysis) {
    if (!analysis.expectedDate && !analysis.bestCaseDate && !analysis.worstCaseDate) return '';
    let html = '<div class="analysis-section timeline-scenarios-section"><h4>📅 Timeline Scenarios</h4>';
    if (analysis.bestCaseDate) {
      html += `<p><strong>Best Case:</strong> ${DOMPurify.sanitize(analysis.bestCaseDate)}</p>`;
    }
    if (analysis.expectedDate) {
      html += `<p><strong>Expected:</strong> ${DOMPurify.sanitize(analysis.expectedDate)}</p>`;
    }
    if (analysis.worstCaseDate) {
      html += `<p><strong>Worst Case:</strong> ${DOMPurify.sanitize(analysis.worstCaseDate)}</p>`;
    }
    html += '</div>';
    return html;
  }
  _buildRisksImpactSection(analysis) {
    if (!analysis.risksText && !analysis.businessImpact && !analysis.strategicImpact) return '';
    let html = '<div class="analysis-section risks-section"><h4>⚠️ Risks & Impact</h4>';
    if (analysis.risksText) {
      html += `<div><strong>Key Risks:</strong><div>${DOMPurify.sanitize(analysis.risksText)}</div></div>`;
    }
    if (analysis.businessImpact) {
      html += `<p><strong>Business Impact:</strong> ${DOMPurify.sanitize(analysis.businessImpact)}</p>`;
    }
    if (analysis.strategicImpact) {
      html += `<p><strong>Strategic Impact:</strong> ${DOMPurify.sanitize(analysis.strategicImpact)}</p>`;
    }
    html += '</div>';
    return html;
  }
  _buildProgressSection(analysis) {
    if (analysis.status !== 'in-progress' || (!analysis.percentComplete && !analysis.velocity)) return '';
    let html = '<div class="analysis-section progress-section"><h4>📊 Progress</h4>';
    if (analysis.percentComplete !== undefined) {
      html += `<p><strong>Completion:</strong> ${analysis.percentComplete}%</p>`;
    }
    if (analysis.velocity) {
      const velocityIcon = analysis.velocity === 'on-track' ? '✓' : analysis.velocity === 'ahead' ? '▲' : '▼';
      html += `<p><strong>Velocity:</strong> ${velocityIcon} ${DOMPurify.sanitize(analysis.velocity)}</p>`;
    }
    html += '</div>';
    return html;
  }
  _initializeCollapsibleSections() {
    const sections = document.querySelectorAll('.analysis-section.timeline-scenarios-section, .analysis-section.risks-section, .analysis-section.impact-section, .analysis-section.scheduling-section, .analysis-section.progress-section, .analysis-section.accelerators-section, .analysis-section.financial-impact-section, .analysis-section.stakeholder-impact-section');
    sections.forEach(section => {
      const header = section.querySelector('h4');
      if (!header) return;
      section.classList.add('collapsible');
      header.classList.add('collapsible-header');
      header.innerHTML += ' <span class="collapse-toggle">▼</span>';
      header.addEventListener('click', () => {
        section.classList.toggle('collapsed');
        const toggle = header.querySelector('.collapse-toggle');
        if (toggle) {
          toggle.textContent = section.classList.contains('collapsed') ? '▶' : '▼';
        }
      });
    });
  }
  _displayError(errorMessage) {
    const modalBody = document.getElementById('modal-body-content');
    if (modalBody) {
      const errorDiv = document.createElement('div');
      errorDiv.className = 'modal-error';
      const isQuotaError = errorMessage.includes('quota') ||
                          errorMessage.includes('rate limit') ||
                          errorMessage.includes('429');
      if (isQuotaError) {
        errorDiv.innerHTML = `
          <div style="text-align: left;">
            <h3 style="color: #da291c; margin-top: 0;">⚠️ API Quota Exceeded</h3>
            <p><strong>What happened?</strong></p>
            <p>The Google Gemini API has rate limits to prevent abuse. You've reached the free tier limit.</p>
            <p><strong>What can you do?</strong></p>
            <ol style="margin: 10px 0; padding-left: 20px;">
              <li><strong>Wait a few minutes</strong> and try again (the quota resets automatically)</li>
              <li><strong>Upgrade your API plan</strong> at <a href="https://ai.google.dev/pricing" target="_blank" style="color: #0066cc;">https://ai.google.dev/pricing</a></li>
              <li><strong>Check your usage</strong> at <a href="https://ai.dev/usage?tab=rate-limit" target="_blank" style="color: #0066cc;">https://ai.dev/usage</a></li>
            </ol>
            <p style="margin-top: 15px; padding: 10px; background: #f5f5f5; border-left: 3px solid #da291c; font-size: 0.9em;">
              <strong>Technical details:</strong><br>
              ${DOMPurify.sanitize(errorMessage)}
            </p>
          </div>
        `;
      } else {
        errorDiv.textContent = `Failed to load analysis: ${errorMessage}`;
      }
      modalBody.innerHTML = '';
      modalBody.appendChild(errorDiv);
    }
  }
}
