// Pronunciation matching for the flashcard game. The user pronounces the
// target-language term; STT gives us a transcript that we compare against the
// stored term. We normalize away case, accents, and punctuation, then accept
// exact matches, containment (STT often adds filler words), or a small
// edit-distance tolerance for near-misses.

export function normalizeForMatch(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .replace(/[^\p{L}\p{N}\s]/gu, " ") // drop punctuation
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array<number>(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1]! + 1, prev[j]! + 1, prev[j - 1]! + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length]!;
}

export function isPronunciationCorrect(heard: string, term: string): boolean {
  const h = normalizeForMatch(heard);
  const t = normalizeForMatch(term);
  if (!h || !t) return false;
  if (h === t) return true;
  // STT may capture extra words around the target (e.g. "the house").
  if (h.includes(t) || t.includes(h)) return true;
  // Allow small transcription/pronunciation slips, scaled to the longer string.
  const dist = levenshtein(h, t);
  const maxLen = Math.max(h.length, t.length);
  return dist / maxLen <= 0.25;
}
