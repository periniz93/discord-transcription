export const buildGlossaryPrompt = (glossary: string[]): string => {
  if (glossary.length === 0) {
    return 'This is a D&D session. Please preserve capitalization of proper nouns and spell names.';
  }

  const terms = glossary.slice(0, 200).join(', ');
  return `This is a D&D session. Proper nouns and terms: ${terms}. Please preserve capitalization.`;
};
