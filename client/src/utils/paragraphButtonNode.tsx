import { DecoratorNode, LexicalNode, NodeKey, SerializedLexicalNode } from "lexical";
import { ReactNode, useEffect } from "react";
import { useLexicalNodeSelection } from "@lexical/react/useLexicalNodeSelection";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { mergeRegister } from "@lexical/utils";
import { $getSelection, $isRangeSelection } from "lexical";

export interface SerializedParagraphButtonNode extends SerializedLexicalNode {
  paragraphKey: string;
}

export class ParagraphButtonNode extends DecoratorNode<ReactNode> {
  __paragraphKey: string;

  constructor(paragraphKey: string, key?: NodeKey) {
    super(key);
    this.__paragraphKey = paragraphKey;
  }

  static getType(): string {
    return "paragraph-button";
  }

  static clone(node: ParagraphButtonNode): ParagraphButtonNode {
    return new ParagraphButtonNode(node.__paragraphKey, node.__key);
  }

  static importJSON(serializedNode: SerializedParagraphButtonNode) {
    const node = $createParagraphButtonNode(serializedNode.paragraphKey);
    return node;
  }

  exportJSON(): SerializedParagraphButtonNode {
    return {
      ...super.exportJSON(),
      paragraphKey: this.__paragraphKey,
      type: 'paragraph-button',
    };
  }

  createDOM(): HTMLElement {
    const element = document.createElement("span");
    element.style.position = "absolute";
    element.style.left = "-30px"; // Position the button to the left of the paragraph
    element.style.top = "0";
    element.textContent = 'Add Paragraph';
    return element;
  }

  updateDOM(): boolean {
    return false; // No updates needed
  }

  decorate(): ReactNode {
    return (
      <ParagraphButtonComponent
        nodeKey={this.getKey()}
        paragraphKey={this.__paragraphKey}
      />
    );
  }
}

function ParagraphButtonComponent({
  nodeKey,
  paragraphKey,
}: {
  nodeKey: string;
  paragraphKey: string;
}) {
  const [editor] = useLexicalComposerContext();
  const [isSelected, setSelected] = useLexicalNodeSelection(nodeKey);

  useEffect(() => {
    const unregister = mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            const isNodeSelected = selection
              .getNodes()
              .some((node) => node.getKey() === nodeKey);
            setSelected(isNodeSelected);
          }
        });
      })
    );

    return () => {
      unregister();
    };
  }, [editor, nodeKey, setSelected]);

  if (!isSelected) {
    return null;
  }

  return (
    <button
      style={{
        background: "red",
        border: "none",
        cursor: "pointer",
        padding: "5px 10px",
        fontSize: "12px",
      }}
      onClick={() => {
        console.log("Button clicked for paragraph:", paragraphKey);
      }}
    >
      Button
    </button>
  );
}

export function $createParagraphButtonNode(paragraphKey: string): ParagraphButtonNode {
  return new ParagraphButtonNode(paragraphKey);
}

export function $isParagraphButtonNode(node: LexicalNode | null | undefined): boolean {
  return node instanceof ParagraphButtonNode;
}
