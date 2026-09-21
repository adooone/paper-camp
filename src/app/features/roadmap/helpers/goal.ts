export const firstSentence = (text: string): string => {
  const collapsed = text.replace(/[*_`]/g, '').replace(/\s+/g, ' ').trim();
  const match = collapsed.match(/^.*?[.!?](?=\s|$)/);
  return match ? match[0] : collapsed;
};
