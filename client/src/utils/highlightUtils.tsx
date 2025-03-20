// highlightUtils.tsx
export const updateHighlightedText = (items: string[], editor: any) => {
  if (!editor) {
    console.error("Editor is not available.");
    return;
  }

  const hasParagraphTopic = items.includes("Paragraph Topics");
  const hasEssayTopic = items.includes("Essay Topics");

  // Toggle paragraph topic highlights
  if (hasParagraphTopic) {
    editor.chain().focus().setHighlight({ color: '#fef9c3' }).run();
  } else {
    editor.chain().focus().unsetHighlight().run();
  }

  // Toggle essay topic underlines
  if (hasEssayTopic) {
    editor.chain().focus().setUnderline().run();
  } else {
    editor.chain().focus().unsetUnderline().run();
  }
};