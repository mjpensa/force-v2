import { jest, describe, it, expect, beforeAll, beforeEach } from '@jest/globals';

let callGeminiForJson, callGeminiForText;
let generateContentMock;

function resetMock() {
  generateContentMock = jest.fn().mockResolvedValue({ response: { text: () => '{}' } });
}

beforeAll(async () => {
  resetMock();

  // Use plain functions for structural parts so resetMocks does not wipe them.
  // Only generateContentMock is a jest.fn that gets swapped per test.
  await jest.unstable_mockModule('@google/generative-ai', () => ({
    GoogleGenerativeAI: function () {
      return {
        getGenerativeModel() {
          return { generateContent: (...args) => generateContentMock(...args) };
        }
      };
    }
  }));

  const mod = await import('../../server/gemini.js');
  callGeminiForJson = mod.callGeminiForJson;
  callGeminiForText = mod.callGeminiForText;
});

beforeEach(() => {
  resetMock();
});

describe('callGeminiForJson', () => {
  it('returns parsed JSON on valid response', async () => {
    generateContentMock.mockResolvedValue({
      response: { text: () => '{"title":"Test","score":42}' }
    });
    const result = await callGeminiForJson('test prompt', 1);
    expect(result).toEqual({ title: 'Test', score: 42 });
  });

  it('strips ```json fencing before parsing', async () => {
    generateContentMock.mockResolvedValue({
      response: { text: () => '```json\n{"title":"Fenced"}\n```' }
    });
    const result = await callGeminiForJson('prompt', 1);
    expect(result).toEqual({ title: 'Fenced' });
  });

  it('strips bare ``` fencing before parsing', async () => {
    generateContentMock.mockResolvedValue({
      response: { text: () => '```\n{"bare":true}\n```' }
    });
    const result = await callGeminiForJson('prompt', 1);
    expect(result).toEqual({ bare: true });
  });

  it('uses jsonrepair on malformed JSON (trailing comma)', async () => {
    generateContentMock.mockResolvedValue({
      response: { text: () => '{"a":1,"b":2,}' }
    });
    const result = await callGeminiForJson('prompt', 1);
    expect(result).toEqual({ a: 1, b: 2 });
  });

  it('retries on transient errors then resolves', async () => {
    let call = 0;
    generateContentMock.mockImplementation(async () => {
      call++;
      if (call === 1) throw new Error('transient 500');
      return { response: { text: () => '{"retry":"ok"}' } };
    });
    const result = await callGeminiForJson('prompt', 3);
    expect(result).toEqual({ retry: 'ok' });
    expect(call).toBe(2);
  });

  it('calls onRetry callback on transient error', async () => {
    let call = 0;
    generateContentMock.mockImplementation(async () => {
      call++;
      if (call === 1) throw new Error('transient');
      return { response: { text: () => '{}' } };
    });
    const onRetry = jest.fn();
    await callGeminiForJson('prompt', 3, onRetry);
    expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error));
  });

  it('throws on persistent failure after retries', async () => {
    generateContentMock.mockRejectedValue(new Error('persistent failure'));
    await expect(callGeminiForJson('prompt', 2)).rejects.toThrow('persistent failure');
  });

  it('throws immediately on quota exhaustion errors', async () => {
    generateContentMock.mockRejectedValue(new Error('429 RESOURCE_EXHAUSTED quota'));
    await expect(callGeminiForJson('prompt', 3)).rejects.toThrow('RESOURCE_EXHAUSTED');
  });
});

describe('callGeminiForText', () => {
  it('returns raw text string', async () => {
    generateContentMock.mockResolvedValue({
      response: { text: () => 'Hello, world!' }
    });
    const result = await callGeminiForText('prompt', 1);
    expect(result).toBe('Hello, world!');
  });

  it('retries on transient error then returns text', async () => {
    let call = 0;
    generateContentMock.mockImplementation(async () => {
      call++;
      if (call === 1) throw new Error('network blip');
      return { response: { text: () => 'recovered' } };
    });
    const result = await callGeminiForText('prompt', 3);
    expect(result).toBe('recovered');
  });

  it('throws on persistent failure', async () => {
    generateContentMock.mockRejectedValue(new Error('dead'));
    await expect(callGeminiForText('prompt', 2)).rejects.toThrow('dead');
  });

  it('throws immediately on quota exhaustion', async () => {
    generateContentMock.mockRejectedValue(new Error('quota RESOURCE_EXHAUSTED'));
    await expect(callGeminiForText('prompt', 3)).rejects.toThrow('RESOURCE_EXHAUSTED');
  });
});
