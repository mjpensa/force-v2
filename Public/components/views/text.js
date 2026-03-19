const PROPER_NOUNS = {
  'u.s.': 'U.S.',
  'u.k.': 'U.K.',
  'e.u.': 'E.U.'
};
const KNOWN_ACRONYMS = [
  'CDM', 'DRR', 'API', 'ROI', 'KPI', 'CEO', 'CTO', 'CFO', 'COO', 'CIO',
  'AI', 'ML', 'CFTC', 'SEC', 'FDA', 'EPA', 'UTI', 'UPI', 'ESG', 'DEI',
  'IPO', 'ETF', 'GDP', 'CPMI', 'IOSCO', 'OTC', 'FX', 'USD', 'EUR', 'GBP',
  'ISDA', 'DLT', 'IT', 'HR', 'PR', 'EMIR', 'OCC', 'BSA', 'AML', 'FINOS'
];
const COMPANY_NAMES = {
  'jpmorgan': 'JPMorgan',
  'jpm': 'JPM'
};

export function isAcronymWord(word) {
  if (!word) return false;
  if (KNOWN_ACRONYMS.some(a => a.toLowerCase() === word.toLowerCase())) {
    return true;
  }
  return /^[A-Z][A-Z0-9]{1,4}$/.test(word);
}

export function checkAcronym(word) {
  if (!word) return { isAcronym: false, value: word };
  const punctMatch = word.match(/^(.+?)([.:,;!?]+)$/);
  const baseWord = punctMatch ? punctMatch[1] : word;
  const trailingPunct = punctMatch ? punctMatch[2] : '';
  const lowerWord = baseWord.toLowerCase();
  if (PROPER_NOUNS[lowerWord]) {
    return { isAcronym: true, value: PROPER_NOUNS[lowerWord] + trailingPunct };
  }
  if (COMPANY_NAMES[lowerWord]) {
    return { isAcronym: true, value: COMPANY_NAMES[lowerWord] + trailingPunct };
  }
  if (baseWord.includes('/')) {
    const parts = baseWord.split('/');
    const allAcronyms = parts.every(part => isAcronymWord(part));

    if (allAcronyms) {
      return { isAcronym: true, value: parts.map(p => p.toUpperCase()).join('/') + trailingPunct };
    }
    return { isAcronym: false, value: word };
  }

  if (isAcronymWord(baseWord)) {
    return { isAcronym: true, value: baseWord.toUpperCase() + trailingPunct };
  }

  return { isAcronym: false, value: word };
}

export function toSentenceCasePreservingAcronyms(text) {
  if (!text) return '';
  return text.split('\n').map((line, lineIndex) => {
    const words = line.split(/(\s+)/);

    return words.map((word, wordIndex) => {
      if (/^\s*$/.test(word)) return word;
      const acronymCheck = checkAcronym(word);

      if (acronymCheck.isAcronym) {
        return acronymCheck.value;
      } else if (lineIndex === 0 && wordIndex === 0) {
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      } else {
        return word.toLowerCase();
      }
    }).join('');
  }).join('\n');
}

export function sanitizeText(text) {
  if (!text) return '';

  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '$1')
    .replace(/\b([A-Z]+(?:_[A-Z]+)+)\b/g, (match) => {
      return match.toLowerCase().replace(/_/g, ' ');
    });
}

export function normalizeBodyText(text) {
  if (!text) return '';

  return text.replace(/\b([A-Z]{3,})\b/g, (match) => {
    const acronymCheck = checkAcronym(match);
    if (acronymCheck.isAcronym) {
      return acronymCheck.value;
    }
    return match.charAt(0).toUpperCase() + match.slice(1).toLowerCase();
  });
}
