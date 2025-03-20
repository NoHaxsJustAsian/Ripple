// filepath: /Users/kimberlydo/Ripple/client/src/components/saveHandlers.ts
import { Editor } from '@tiptap/react';
import { toast } from 'sonner';

// Define or import CommentType
type CommentType = {
  id: string;
  text: string;
  author: string;
};

export const handleSave = async (
  editor: Editor | null,
  documentTitle: string,
  comments: CommentType[],
  setIsSaving: React.Dispatch<React.SetStateAction<boolean>>
) => {
  if (!editor) return;

  setIsSaving(true);
  try {
    localStorage.setItem('ripple-doc', JSON.stringify({
      title: documentTitle,
      content: editor.getHTML(),
      comments,
      lastSaved: new Date().toISOString()
    }));

    toast.success("Document saved successfully");
  } catch (error) {
    console.error('Error saving document:', error);
    toast.error("Failed to save document");
  } finally {
    setIsSaving(false);
  }
};

export const handleSaveAs = async (
  editor: Editor | null,
  documentTitle: string,
  comments: CommentType[],
  setIsSaving: React.Dispatch<React.SetStateAction<boolean>>,
  setDocumentTitle: React.Dispatch<React.SetStateAction<string>>
) => {
  if (!editor) return;

  setIsSaving(true);
  try {
    const timestamp = new Date().toISOString().split('T')[0];
    const newTitle = `${documentTitle} - ${timestamp}`;
    
    const docKey = `ripple-doc-${Date.now()}`;
    localStorage.setItem(docKey, JSON.stringify({
      title: newTitle,
      content: editor.getHTML(),
      comments,
      lastSaved: new Date().toISOString()
    }));

    setDocumentTitle(newTitle);
    toast.success("Document saved as new copy");
  } catch (error) {
    console.error('Error saving document:', error);
    toast.error("Failed to save document");
  } finally {
    setIsSaving(false);
  }
};