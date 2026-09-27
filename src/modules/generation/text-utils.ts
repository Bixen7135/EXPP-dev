const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "are",
  "was",
  "were",
  "you",
  "your",
  "have",
  "has",
  "had",
  "not",
  "but",
  "can",
  "will",
  "shall",
  "into",
  "about",
  "they",
  "them",
  "their",
  "its",
  "our",
  "out",
  "when",
  "where",
  "what",
  "how",
  "why",
  "which",
  "who",
  "also",
  "than",
  "then",
  "there",
  "here",
  "such",
  "using",
  "between",
  "within",
  "because",
  "while",
  "during",
  "each",
  "every",
  "any",
  "all",
  "more",
  "most",
  "very",
  "some",
  "other",
  "over",
  "under",
  "для",
  "что",
  "это",
  "как",
  "или",
  "при",
  "если",
  "где",
  "когда",
  "чтобы",
  "который",
  "которые",
  "также",
  "нужно",
  "можно",
]);

export function extractSignalKeywords(input: string, limit = 10): string[] {
  const freq = new Map<string, number>();
  const tokens = input
    .toLowerCase()
    .split(/[^\p{L}\p{N}_-]+/u)
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));

  for (const token of tokens) {
    freq.set(token, (freq.get(token) ?? 0) + 1);
  }

  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([token]) => token);
}
