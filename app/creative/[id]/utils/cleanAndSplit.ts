// Lightweight sanitiser: removes code fences, bold markers, list bullets and splits into paragraphs
export const cleanAndSplit = (raw?: string | null): string[] => {
  if (!raw) return [];
  let s = raw;
  s = s.replace(/```[\s\S]*?```/g, '');
  s = s.replace(/\*\*(.*?)\*\*/g, '$1');
  s = s.replace(/^\s*[\*\-•]\s?/gm, '');
  s = s.replace(/\n{3,}/g, '\n\n');
  s = s.trim();
  if (!s) return [];
  return s.split(/\n\s*\n/).map((p) => p.trim());
};

export default cleanAndSplit;
