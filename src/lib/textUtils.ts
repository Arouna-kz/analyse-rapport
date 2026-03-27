/**
 * Cleans markdown formatting from text
 * Removes asterisks, underscores, and other markdown symbols
 */
export const cleanMarkdown = (text: string): string => {
  if (!text) return '';
  
  return text
    // Remove bold/italic markers (**text** or __text__ or *text* or _text_)
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    // Remove code blocks
    .replace(/```[^`]*```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    // Remove headers
    .replace(/^#{1,6}\s+/gm, '')
    // Remove blockquotes
    .replace(/^>\s+/gm, '')
    // Remove horizontal rules
    .replace(/^[-*_]{3,}$/gm, '')
    // Remove list markers
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    // Remove links but keep text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove images
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    // Remove remaining asterisks that might be left over
    .replace(/\*+/g, '')
    // Clean up extra whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

/**
 * Formats text for display, cleaning markdown and ensuring proper line breaks
 */
export const formatDisplayText = (text: string): string => {
  return cleanMarkdown(text);
};
