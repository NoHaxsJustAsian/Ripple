declare module '@tiptap/react' {
  import { Editor, ChainedCommands } from '@tiptap/core';
  
  interface Commands<ReturnType> {
    comment: {
      setComment: (commentId: string) => ReturnType;
      unsetComment: (commentId: string) => ReturnType;
    };
  }

  interface CustomCommands extends ChainedCommands {
    setStyle: (attrs: { [key: string]: string }) => ChainedCommands;
    setMark: (markType: string, attrs?: Record<string, any>) => ChainedCommands;
    toggleMark: (markType: string) => ChainedCommands;
  }

  interface CustomEditor extends Editor {
    chain: () => CustomCommands;
  }

  interface EditorEvents {
    editor: CustomEditor;
  }
  
  export { CustomEditor as Editor };
  export function useEditor(options: { 
    extensions: any[];
    content: string;
    editorProps?: any;
    onUpdate?: (props: EditorEvents) => void;
  }): CustomEditor | null;
  export function EditorContent(props: { editor: CustomEditor | null; [key: string]: any }): JSX.Element;
}

declare module '@tiptap/starter-kit' {
  import { Extension } from '@tiptap/core';
  const StarterKit: Extension;
  export default StarterKit;
}

declare module '@tiptap/extension-highlight' {
  import { Extension } from '@tiptap/core';
  const Highlight: Extension & {
    configure: (options: { multicolor?: boolean }) => Extension;
  };
  export default Highlight;
}

declare module '@tiptap/extension-text-style' {
  import { Extension } from '@tiptap/core';
  const TextStyle: Extension;
  export default TextStyle;
}

declare module '@tiptap/extension-color' {
  import { Extension } from '@tiptap/core';
  export const Color: Extension;
}

declare module '@tiptap/extension-underline' {
  import { Extension } from '@tiptap/core';
  const Underline: Extension;
  export default Underline;
}

declare module '@tiptap/extension-font-family' {
  import { Extension } from '@tiptap/core';
  const FontFamily: Extension;
  export default FontFamily;
}

declare module '@sereneinserenade/tiptap-comment-extension' {
  import { Extension } from '@tiptap/core';
  
  interface CommentOptions {
    HTMLAttributes?: Record<string, any>;
    onCommentActivated?: (commentId: string | null) => void;
  }
  
  const Comment: Extension & {
    configure: (options: CommentOptions) => Extension;
  };
  export default Comment;
} 