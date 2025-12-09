import { safeGetElement, safeQuerySelector } from '../Utils.js';
export class ChatInterface {
  constructor(container, taskIdentifier) {
    this.container = container;
    this.taskIdentifier = taskIdentifier;
    this.history = [];
  }
  render() {
    if (!this.container) {
      return;
    }
    const chatContainer = document.createElement('div');
    chatContainer.className = 'chat-container';
    chatContainer.innerHTML = `
      <h4 class="chat-title">Ask a follow-up</h4>
      <div class="chat-history" id="chat-history"></div>
      <form class="chat-form" id="chat-form">
        <input type="text" id="chat-input" class="chat-input" placeholder="Ask about this task..." autocomplete="off">
        <button type="submit" class="chat-send-btn">Send</button>
      </form>
    `;
    this.container.appendChild(chatContainer);
    this._attachEventListeners();
  }
  _attachEventListeners() {
    const chatForm = document.getElementById('chat-form');
    if (chatForm) {
      chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.sendMessage();
      });
    }
  }
  async sendMessage() {
    const input = safeGetElement('chat-input', 'ChatInterface.sendMessage');
    const sendBtn = safeQuerySelector('.chat-send-btn', 'ChatInterface.sendMessage');
    if (!input || !sendBtn) return;
    const question = input.value.trim();
    if (!question) return;
    input.disabled = true;
    sendBtn.disabled = true;
    this.addMessageToHistory(question, 'user');
    const spinnerId = `spinner-${Date.now()}`;
    this.addMessageToHistory('<div class="chat-spinner"></div>', 'llm', spinnerId);
    try {
      const response = await fetch('/ask-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...this.taskIdentifier,
          question: question
        })
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
      const data = await response.json();
      const spinnerEl = document.getElementById(spinnerId);
      if (spinnerEl) {
        spinnerEl.innerHTML = DOMPurify.sanitize(data.answer);
      } else {
        this.addMessageToHistory(data.answer, 'llm');
      }
      if (input) {
        input.value = '';
      }
    } catch (error) {
      const spinnerEl = document.getElementById(spinnerId);
      const errorSpan = document.createElement('span');
      errorSpan.style.color = '#BA3930';
      errorSpan.textContent = `Error: ${error.message}`;
      if (spinnerEl) {
        spinnerEl.innerHTML = '';
        spinnerEl.appendChild(errorSpan);
      } else {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'chat-message chat-message-llm';
        errorDiv.appendChild(errorSpan);
        const history = document.getElementById('chat-history');
        if (history) history.appendChild(errorDiv);
      }
    } finally {
      if (input) {
        input.disabled = false;
        input.focus();
      }
      if (sendBtn) {
        sendBtn.disabled = false;
      }
    }
  }
  addMessageToHistory(content, type, id = null) {
    const history = document.getElementById('chat-history');
    if (!history) return;
    const msg = document.createElement('div');
    msg.className = `chat-message chat-message-${type}`;
    if (id) {
      msg.id = id;
    }
    if (type === 'llm' || type === 'spinner') {
      msg.innerHTML = DOMPurify.sanitize(content);
    } else if (type === 'user') {
      msg.textContent = content;
    } else {
      msg.textContent = content;
    }
    history.appendChild(msg);
    history.scrollTop = history.scrollHeight;
  }
}
