import { useCallback, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ModeToggle } from '@/components/ui/mode-toggle';
import { Save, FileDown, HelpCircle, FileCheck2 } from 'lucide-react';
import { toast } from "sonner";
import { AnalysisTools } from './AnalysisTools';
import { CommentType } from './types';
import { Editor } from '@tiptap/react';
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
  isInsightsOpen,
  setIsInsightsOpen,
  setIsHelpOpen,
  isHelpOpen,
  setComments,
  eventBatcher,
  currentFileId,
  setCurrentFileId,
  onLoadFile
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
    const content = editor.getHTML();

    try {
      // First, save to localStorage for backward compatibility
      localStorage.setItem('ripple-doc', JSON.stringify({
        title: documentTitle,
        content,
        comments,
        lastSaved: new Date().toISOString()
      }));

      // Then save to Supabase if we have a file service
      if (fileService) {
        // Debug comments
        console.log("Comments to save:", comments);

        const savedFile = await fileService.saveFile(
          documentTitle,
          content,
          currentFileId || undefined
        );

        if (savedFile && setCurrentFileId) {
          setCurrentFileId(savedFile.id);
          
          try {
            // Save comments separately after saving the file
            await fileService.saveComments(savedFile.id, comments);
            
            toast.success('Document saved to cloud');

            // Log successful save
            eventBatcher?.addEvent(EventType.FILE_SAVE, {
              file_id: savedFile.id,
              title: documentTitle,
              comment_count: comments.length,
              success: true
            });
          } catch (commentError) {
            console.error('Error saving comments:', commentError);
            toast.error('File saved but failed to save comments');
            
            // Log partial save
            eventBatcher?.addEvent(EventType.FILE_SAVE, {
              file_id: savedFile.id,
              title: documentTitle,
              success: true,
              comments_success: false,
              error: String(commentError)
            });
          }
        } else {
          toast.success("Document saved locally");
        }
      } else {
        toast.success("Document saved locally");
      }
    } catch (error) {
      console.error('Error saving document:', error);
      toast.error("Failed to save document");

      // Log error
      eventBatcher?.addEvent(EventType.ERROR, {
        action: 'save_document',
        error: String(error)
      });
    } finally {
      setIsSaving(false);
    }
  }, [editor, documentTitle, comments, user, fileService, currentFileId, setCurrentFileId, eventBatcher]);


  const handleSaveAs = useCallback(async () => {
    if (!editor || !user) return;

    setIsSaving(true);
    const content = editor.getHTML();

    try {
      const timestamp = new Date().toISOString().split('T')[0];
      const newTitle = `${documentTitle} - ${timestamp}`;

      const docKey = `ripple-doc-${Date.now()}`;
      localStorage.setItem(docKey, JSON.stringify({
        title: newTitle,
        content,
        comments,
        lastSaved: new Date().toISOString()
      }));

      // Then save to Supabase as a new file if we have a file service
      if (fileService) {
        // Always create a new file for "Save As", don't pass the currentFileId
        const savedFile = await fileService.saveFile(
          newTitle,
          content
        );

        if (savedFile && setCurrentFileId) {
          setCurrentFileId(savedFile.id);
          
          try {
            // Save comments separately after saving the file
            await fileService.saveComments(savedFile.id, comments);
            
            setDocumentTitle(newTitle);
            toast.success('Saved as new document in cloud');

            // Log successful save
            eventBatcher?.addEvent(EventType.FILE_SAVE, {
              file_id: savedFile.id,
              title: newTitle,
              comment_count: comments.length,
              success: true,
              action: 'save_as'
            });
          } catch (commentError) {
            console.error('Error saving comments:', commentError);
            setDocumentTitle(newTitle);
            toast.error('New file saved but failed to save comments');
            
            // Log partial save
            eventBatcher?.addEvent(EventType.FILE_SAVE, {
              file_id: savedFile.id,
              title: newTitle,
              success: true,
              comments_success: false,
              error: String(commentError),
              action: 'save_as'
            });
          }
        } else {
          // Still update the title since we saved locally
          setDocumentTitle(newTitle);
          toast.error('Failed to save to cloud, but saved locally');

          // Log failed save
          eventBatcher?.addEvent(EventType.FILE_SAVE, {
            title: newTitle,
            success: false,
            error: 'Database save failed',
            action: 'save_as'
          });
        }
      } else {
        setDocumentTitle(newTitle);
        toast.success("Document saved as new copy locally");
      }
    } catch (error) {
      console.error('Error saving document:', error);
      toast.error("Failed to save document");

      // Log error
      eventBatcher?.addEvent(EventType.ERROR, {
        action: 'save_as_document',
        error: String(error)
      });
    } finally {
      setIsSaving(false);
    }
  }, [editor, documentTitle, comments, user, fileService, setDocumentTitle, setCurrentFileId, eventBatcher]);

  const handleOpenFilePicker = () => {
    setIsFilePickerOpen(true);
  };

  const handleFileSelect = (file: FileData) => {
    if (onLoadFile) {
      onLoadFile(file);

      // Log file load event
      eventBatcher?.addEvent(EventType.FILE_OPEN, {
        file_id: file.id,
        title: file.title,
        action: 'load_file'
      });
    }
  };

  return (
    <>
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
                onClick={handleOpenFilePicker}
                className="h-7 px-3 text-xs flex items-center space-x-2"
              >
                <Save className="h-3.5 w-3.5" />
                <span>Open</span>
              </Button>
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

      {/* File Picker Dialog */}
      {onLoadFile && (
        <FilePicker
          isOpen={isFilePickerOpen}
          onClose={() => setIsFilePickerOpen(false)}
          onFileSelect={handleFileSelect}
          eventBatcher={eventBatcher}
        />
      )}
    </>
  );
}