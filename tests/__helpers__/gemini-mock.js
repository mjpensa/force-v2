import { jest } from '@jest/globals';

let generateContentMock = jest.fn().mockResolvedValue({ response: { text: () => '{}' } });

export function setupGeminiMock(fixture) {
  if (typeof fixture === 'function') {
    generateContentMock = jest.fn().mockImplementation(async (payload) => {
      const data = await fixture(payload);
      return { response: { text: () => JSON.stringify(data) } };
    });
  } else if (fixture) {
    generateContentMock = jest.fn().mockResolvedValue({
      response: { text: () => JSON.stringify(fixture) }
    });
  }
  return generateContentMock;
}

export function setupGeminiSequence(fixtures) {
  let i = 0;
  generateContentMock = jest.fn().mockImplementation(async () => {
    const f = fixtures[i] || fixtures[fixtures.length - 1];
    i++;
    return { response: { text: () => JSON.stringify(f) } };
  });
  return generateContentMock;
}

export function setupGeminiError(message) {
  generateContentMock = jest.fn().mockRejectedValue(new Error(message));
  return generateContentMock;
}

export async function registerGeminiMock() {
  await jest.unstable_mockModule('@google/generative-ai', () => ({
    GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
      getGenerativeModel: jest.fn().mockReturnValue({
        generateContent: (...args) => generateContentMock(...args)
      })
    }))
  }));
}

export function resetGeminiMock() {
  generateContentMock = jest.fn().mockResolvedValue({ response: { text: () => '{}' } });
}

export { generateContentMock };
