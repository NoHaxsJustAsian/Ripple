import { TextNode, NodeKey, SerializedTextNode } from 'lexical';

export type SerializedCommentNode = SerializedTextNode & {
  commentId: string;
  originalText: string;
};

export class CommentNode extends TextNode {
  __commentId: string;
  __originalText: string;

  static getType(): string {
    return 'comment';
  }

  static clone(node: CommentNode): CommentNode {
    return new CommentNode(node.__text, node.__commentId, node.__originalText, node.__key);
  }

  constructor(text: string, commentId: string, originalText: string, key?: NodeKey) {
    super(text, key);
    this.__commentId = commentId;
    this.__originalText = originalText;
  }

  createDOM(config: any): HTMLElement {
    const element = super.createDOM(config);
    element.style.backgroundColor = 'rgba(147, 51, 234, 0.2)'; // Purple highlight with opacity
    element.style.borderBottom = '2px solid rgb(147, 51, 234)';
    element.setAttribute('data-comment-id', this.__commentId);
    element.setAttribute('data-original-text', this.__originalText);
    return element;
  }

  updateDOM(prevNode: CommentNode, dom: HTMLElement, config: any): boolean {
    const isUpdated = super.updateDOM(prevNode as this, dom, config);
    return isUpdated;
  }

  // static importJSON(serializedNode: SerializedCommentNode): CommentNode {
  //   const node = $createCommentNode(serializedNode.commentId, serializedNode.text);
  //   node.setTextContent(serializedNode.text);
  //   node.setFormat(serializedNode.format);
  //   node.setDetail(serializedNode.detail);
  //   node.setMode(serializedNode.mode);
  //   node.setStyle(serializedNode.style);
  //   return node;
  // }

  exportJSON(): SerializedCommentNode {
    return {
      ...super.exportJSON(),
      commentId: this.__commentId,
      originalText: this.__originalText,
      type: 'comment',
      version: 1,
    };
  }

  getOriginalText(): string {
    return this.__originalText;
  }
}
