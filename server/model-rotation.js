const DEFAULT_MODELS = [
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
];

export class ModelRotator {
  constructor(models = DEFAULT_MODELS) {
    this.models = models;
    this.currentIndex = 0;
    this.exhausted = new Set();
  }

  current() {
    return this.models[this.currentIndex];
  }

  rotate() {
    const startIndex = this.currentIndex;
    do {
      this.currentIndex = (this.currentIndex + 1) % this.models.length;
      if (!this.exhausted.has(this.models[this.currentIndex])) {
        console.log(`[ModelRotator] Switched to ${this.models[this.currentIndex]}`);
        return this.models[this.currentIndex];
      }
    } while (this.currentIndex !== startIndex);
    throw new Error('All Gemini models exhausted. Please wait for quota reset.');
  }

  handleError(error) {
    const msg = error.message || '';
    const isRateLimit = msg.includes('429') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED');
    if (isRateLimit) {
      this.exhausted.add(this.current());
      return this.rotate();
    }
    throw error;
  }

  reset() {
    this.exhausted.clear();
    this.currentIndex = 0;
  }
}

export const modelRotator = new ModelRotator();
