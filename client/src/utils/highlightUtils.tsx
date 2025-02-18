import { $getRoot, $getSelection, $isRangeSelection } from 'lexical';

/**
 * Updates highlighted text based on selected topic filters.
 * @param {string[]} items - The selected items from the dropdown.
 * @param {LexicalEditor} editor - The Lexical editor instance.
 */
export const updateHighlightedText = (items: string[], editor: any) => {
  if (!editor) return;

  editor.update(() => {
    const root = $getRoot();
    const selection = $getSelection();

    if (!$isRangeSelection(selection)) return;

    const nodes = root.getChildren();

    nodes.forEach((node) => {
      if (node.getTextContent().includes("Topic Sentence")) { 
        if (items.includes("Paragraph Topics") || items.includes("Essay Topics")) {
          (node as any).setStyle("background-color: yellow"); // Apply highlight
        } else {
          (node as any).setStyle("background-color: transparent"); // Remove highlight
        }
      }
    });
  });
};
