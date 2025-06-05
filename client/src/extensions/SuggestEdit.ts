import { Extension, Mark } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { diffChars, Change } from 'diff';

interface SuggestEditOptions {
  HTMLAttributes?: Record<string, any>;
  onSuggestEdit?: (original: string, suggested: string) => void;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    suggestEdit: {
      /**
       * Suggest an edit for selected text
       */
      setSuggestEdit: (suggestedText: string) => ReturnType;
      /**
       * Remove a suggested edit
       */
      removeSuggestEdit: () => ReturnType;
    };
  }
}

export const SuggestEditMark = Mark.create({
  name: 'suggestEditMark',

  addAttributes() {
    return {
      id: {
        default: null,
      },
      suggestion: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-suggest-edit-id]',
        getAttrs: element => {
          if (!(element instanceof HTMLElement)) {
            return false;
          }
          return {
            id: element.getAttribute('data-suggest-edit-id'),
            suggestion: element.getAttribute('data-suggestion'),
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', HTMLAttributes, 0];
  },
});

export const SuggestEditExtension = Extension.create<SuggestEditOptions>({
  name: 'suggestEdit',

  addOptions() {
    return {
      HTMLAttributes: {},
      onSuggestEdit: () => {},
    };
  },

  addExtensions() {
    return [
      SuggestEditMark,
    ];
  },

  addCommands() {
    return {
      setSuggestEdit:
        (suggestedText: string) =>
        ({ chain, state }) => {
          const { from, to } = state.selection;
          const originalText = state.doc.textBetween(from, to);
          
          if (from === to) {
            return false;
          }

          const id = `suggest-${Date.now()}`;
          this.options.onSuggestEdit?.(originalText, suggestedText);

          return chain()
            .setMark('suggestEditMark', { id, suggestion: suggestedText })
            .run();
        },
      removeSuggestEdit:
        () =>
        ({ chain }) => {
          return chain()
            .unsetMark('suggestEditMark')
            .run();
        },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('suggestEditPlugin'),
        props: {
          decorations(state) {
            const decorations: Decoration[] = [];
            const doc = state.doc;

            // Guard against infinite recursion
            if (!doc || doc.nodeSize === 0) {
              return DecorationSet.empty;
            }

            try {
              doc.descendants((node, pos) => {
                // Additional safety check
                if (!node || !node.marks) {
                  return;
                }

                const suggestEditMark = node.marks.find(mark => mark.type.name === 'suggestEditMark');
                if (!suggestEditMark || !node.isText) return;

                const originalText = node.text || '';
                const suggestedText = suggestEditMark.attrs.suggestion || '';

                // Safety check for text content
                if (!originalText && !suggestedText) {
                  return;
                }

                const diff = diffChars(originalText, suggestedText);
                let currentPos = pos;

                diff.forEach((part: Change) => {
                  if (part.added) {
                    // For additions, create a widget decoration at the current position
                    decorations.push(
                      Decoration.widget(currentPos, () => {
                        const span = document.createElement('span');
                        span.className = 'suggest-edit-addition';
                        span.textContent = part.value;
                        return span;
                      }, { side: 1 })
                    );
                  } else if (part.removed) {
                // For deletions, mark the text with strikethrough
                    const endPos = currentPos + part.value.length;
                    // Ensure positions are valid
                    if (endPos <= doc.nodeSize - 2) {
                      decorations.push(
                        Decoration.inline(currentPos, endPos, {
                          class: 'suggest-edit-deletion'
                        })
                      );
                    }
                    currentPos += part.value.length;
                  } else {
                    // For unchanged text, just update the position
                    currentPos += part.value.length;
                  }
                });
              });

              return DecorationSet.create(doc, decorations);
            } catch (error) {
              console.warn('SuggestEdit decorations error:', error);
              return DecorationSet.empty;
            }
          },
        },
      }),
    ];
  },
}); 