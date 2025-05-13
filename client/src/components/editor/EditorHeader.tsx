import { useCallback, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ModeToggle } from '@/components/ui/mode-toggle';
import { Save, FileDown, MessageSquare, HelpCircle, FileCheck2 } from 'lucide-react';
import { toast } from "sonner";
import { AnalysisTools } from './AnalysisTools';
import { CommentType } from './types';
import { Editor } from '@tiptap/react';
import { UserAvatar } from '@/components/UserAvatar';
import { useAuth } from '@/lib/auth-context';
import { FileService } from '@/lib/file-service';
import { EventType } from '@/lib/event-logger';
import { FilePicker } from '@/components/FilePicker';
import { FileData } from '@/lib/supabase';

interface EditorHeaderProps {
  editor: Editor | null;
  documentTitle: string;
  setDocumentTitle: (title: string) => void;
  comments: CommentType[];
  toggleAIPanel: () => void;
  isInsightsOpen: boolean;
  setIsInsightsOpen: (open: boolean) => void;
  setIsHelpOpen: (open: boolean) => void;
  isHelpOpen: boolean;
  setComments: React.Dispatch<React.SetStateAction<CommentType[]>>;
  eventBatcher?: any;
  currentFileId?: string | null;
  setCurrentFileId?: (id: string | null) => void;
  onLoadFile?: (file: FileData) => void;
}

export function EditorHeader({
  editor,
  documentTitle,
  setDocumentTitle,
  comments,
  toggleAIPanel,
  isInsightsOpen,
  setIsInsightsOpen,
  setIsHelpOpen,
  isHelpOpen,
  setComments
}: EditorHeaderProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isFilePickerOpen, setIsFilePickerOpen] = useState(false);
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const { user } = useAuth();
  const [fileService, setFileService] = useState<FileService | null>(null);

  // Initialize file service when user changes
  useEffect(() => {
    if (user) {
      setFileService(new FileService(user.id));
    } else {
      setFileService(null);
    }
  }, [user]);

  const handleSave = useCallback(async () => {
    if (!editor || !user) return;

    setIsSaving(true);
    try {
      // First, save to localStorage for backward compatibility
      localStorage.setItem('ripple-doc', JSON.stringify({
        title: documentTitle,
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
  }, [editor, documentTitle, comments]);


  const handleSaveAs = useCallback(async () => {
    if (!editor || !user) return;

    setIsSaving(true);
    try {
      const timestamp = new Date().toISOString().split('T')[0];
      const newTitle = `${documentTitle} - ${timestamp}`;

      const docKey = `ripple-doc-${Date.now()}`;
      localStorage.setItem(docKey, JSON.stringify({
        title: newTitle,
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
  }, [editor, documentTitle, comments, setDocumentTitle]);

  return (
    <div className="px-4 py-2 border-b border-border/40 bg-blue-100/60 dark:bg-blue-900/10 backdrop-blur supports-[backdrop-filter]:bg-blue-100/40 dark:supports-[backdrop-filter]:bg-blue-900/5">
      <div className="flex items-center justify-between space-x-4">
        {/* Left section */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-semibold">Ripple</span>
          </div>
          <div className="w-[1px] h-7 bg-border/40 dark:bg-zinc-800 rounded-full" />
          <input
            type="text"
            value={documentTitle}
            onChange={(e) => setDocumentTitle(e.target.value)}
            placeholder="Untitled document"
            className="bg-transparent border-none text-sm focus:outline-none focus:ring-0 p-0 h-6 text-stone-800 dark:text-zinc-100"
          />
          <div className="w-[1px] h-7 bg-border/40 dark:bg-zinc-800 rounded-full" />
          <ModeToggle />
          <div className="w-[1px] h-7 bg-border/40 dark:bg-zinc-800 rounded-full" />
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
              className="h-7 px-3 text-xs flex items-center space-x-2"
            >
              <Save className="h-3.5 w-3.5" />
              <span>Save</span>
              <span className="text-xs text-muted-foreground ml-1">{isMac ? '⌘S' : 'Ctrl+S'}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSaveAs}
              disabled={isSaving}
              className="h-7 px-3 text-xs flex items-center space-x-2"
            >
              <FileDown className="h-3.5 w-3.5" />
              <span>Save As</span>
            </Button>
          </div>
        </div>

        {/* Right section */}
        <div className="flex items-center space-x-4">
          <AnalysisTools
            editor={editor}
            setComments={setComments}
            setIsInsightsOpen={setIsInsightsOpen}
          />
          <div className="w-[1px] h-7 bg-border/40 dark:bg-zinc-800 rounded-full" />
          <Button
            variant={isInsightsOpen ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setIsInsightsOpen(!isInsightsOpen)}
            className="h-7 px-3 text-xs flex items-center space-x-1"
          >
            <FileCheck2 className="h-3.5 w-3.5" />
            <span>Toggle Suggestions</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsHelpOpen(!isHelpOpen)}
            className="h-7 px-3 text-xs flex items-center space-x-1"
          >
            <HelpCircle className="h-3.5 w-3.5" />
            <span>Help</span>
          </Button>

          {/* <Button
            variant="ghost"
            size="sm"
            onClick={toggleAIPanel}
            className="h-7 px-3 text-xs flex items-center space-x-1"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span>Chat</span>
          </Button> */}
        </div>
      </div>
    </div>
  );
} 