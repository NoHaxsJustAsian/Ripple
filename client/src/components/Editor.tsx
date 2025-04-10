import { EditorContainer } from './editor/EditorContainer';
import { EditorProps } from './editor/types';

export default function Editor(props: EditorProps) {
  return <EditorContainer {...props} />;
} 