import { useCallback, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ModeToggle } from '@/components/ui/mode-toggle';
import { ToggleSwitch } from '@/components/ui/toggle-switch';
import { Save, FileDown, HelpCircle, FileCheck2, Droplet, PencilIcon, Pencil, PencilOffIcon } from 'lucide-react';
import { toast } from "sonner";
import { AnalysisTools } from './AnalysisTools';
import { CommentType } from './types';
import { Editor } from '@tiptap/react';
import { useAuth } from '@/lib/auth-context';
import { FileService } from '@/lib/file-service';
import { EventType } from '@/lib/event-logger';
import { FilePicker } from '@/components/FilePicker';
import { FileData } from '@/lib/supabase';
import { HighlightingManager } from '@/lib/highlighting-manager';

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
  highlightingManager?: HighlightingManager | null;
  isAnalysisRunning?: boolean;
  setIsAnalysisRunning?: (running: boolean) => void;
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
  onLoadFile,
  highlightingManager,
  isAnalysisRunning,
  setIsAnalysisRunning
}: EditorHeaderProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isFilePickerOpen, setIsFilePickerOpen] = useState(false);
  const [isFlowMode, setIsFlowMode] = useState(true);
  const [isWriteMode, setIsWriteMode] = useState(false);
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const { user } = useAuth();
  const [fileService, setFileService] = useState<FileService | null>(null);

  // Custom DropletOff component
  const DropletOffIcon = () => (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18.715 13.186C18.29 11.858 17.384 10.607 16 9.5c-2-1.6-3.5-4-4-6.5a10.7 10.7 0 0 1-.884 2.586" />
      <path d="m2 2 20 20" />
      <path d="M8.795 8.797A11 11 0 0 1 8 9.5C6 11.1 5 13 5 15a7 7 0 0 0 13.222 3.208" />
    </svg>
  );

  // Initialize file service when user changes
  useEffect(() => {
    if (user) {
      setFileService(new FileService(user.id));
    } else {
      setFileService(null);
    }
  }, [user]);

  // Sync highlighting manager with initial UI state
  useEffect(() => {
    if (highlightingManager && isFlowMode) {
      // Set highlighting manager to flow mode to match the default UI state
      console.log('🔄 Syncing highlighting manager with initial flow mode state');
      highlightingManager.switchMode('flow');
    }
  }, [highlightingManager]); // Only run when highlighting manager becomes available

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

  const handleFlowToggle = (checked: boolean) => {
    setIsFlowMode(checked);

    if (highlightingManager) {
      // Don't change highlighting mode if Write Mode is currently active
      if (isWriteMode) {
        console.log('🌊 Flow mode state updated but Write Mode is active - keeping write mode');
        return;
      }

      if (checked) {
        // Flow mode ON: Switch to flow highlighting, hide comments
        console.log('🌊 FLOW MODE ACTIVATED - Switching to flow highlights');
        highlightingManager.switchMode('flow');

        // Check if there are no flow highlights yet
        const flowHighlights = highlightingManager.getHighlightData('flow');
        if (flowHighlights.size === 0) {
          toast.info("No flow highlights yet. Check for feedback to generate them.", {
            duration: 4000,
          });
        }
      } else {
        highlightingManager.switchMode('comments');
      }
    } else {
      console.warn('HighlightingManager not available for flow toggle');
    }

    console.log('Flow mode:', checked ? 'enabled' : 'disabled');
  };

  const handleWriteModeToggle = (checked: boolean) => {
    setIsWriteMode(checked);

    if (highlightingManager) {
      if (checked) {
        // Write mode ON: Switch to write mode, hide all highlights
        console.log('✍️ WRITE MODE ACTIVATED - Switching to write mode, hiding all highlights');
        highlightingManager.switchMode('write');
        toast.info("Write mode activated - Focus on your writing!", {
          duration: 3000,
        });
      } else {
        // Write mode OFF: Restore appropriate mode based on Flow Mode state
        console.log('✍️ WRITE MODE DEACTIVATED - Restoring normal mode');
        if (isFlowMode) {
          highlightingManager.switchMode('flow');
        } else {
          highlightingManager.switchMode('comments');
        }
        toast.info("Write mode deactivated", {
          duration: 2000,
        });
      }
    } else {
      console.warn('HighlightingManager not available for write mode toggle');
    }

    console.log('Write mode:', checked ? 'enabled' : 'disabled');
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

            <div className="bg-white dark:bg-transparent rounded-lg shadow-sm dark:shadow-none">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsHelpOpen(!isHelpOpen)}
                className="h-7 px-3 text-xs flex items-center space-x-1"
              >
                <HelpCircle className="h-3.5 w-3.5" />
                <span>Help</span>
              </Button>
            </div>
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
            <div>

            </div>
            <AnalysisTools
              editor={editor}
              setComments={setComments}
              setIsInsightsOpen={setIsInsightsOpen}
              highlightingManager={highlightingManager || undefined}
              isAnalysisRunning={isAnalysisRunning}
              setIsAnalysisRunning={setIsAnalysisRunning}
            />
            <div className="w-[1px] h-7 bg-border/40 dark:bg-zinc-800 rounded-full" />

            {/* Flow Toggle */}
            <div className="flex items-center space-x-2 bg-white dark:bg-transparent rounded-lg px-3 py-1.5 shadow-sm dark:shadow-none">
              <ToggleSwitch
                checked={isFlowMode}
                onCheckedChange={handleFlowToggle}
                label="Flow Mode"
                onIcon={<Droplet className="h-2.5 w-2.5" strokeWidth={2.5} />}
                offIcon={<DropletOffIcon />}
                activeColor="bg-blue-500"
                size="sm"
              />
            </div>

            <div className="flex items-center space-x-2 bg-white dark:bg-transparent rounded-lg px-3 py-1.5 shadow-sm dark:shadow-none">
              <ToggleSwitch
                checked={isWriteMode}
                onCheckedChange={handleWriteModeToggle}
                label="Write Mode"
                onIcon={<PencilIcon className="h-2.5 w-2.5" strokeWidth={2.5} />}
                offIcon={<PencilOffIcon />}
                activeColor="bg-green-500"
                size="sm"
              />
            </div>

            <div className="w-[1px] h-7 bg-border/40 dark:bg-zinc-800 rounded-full" />
            <div className="bg-white dark:bg-transparent rounded-lg shadow-sm dark:shadow-none">
            <Button
                variant={isInsightsOpen ? "ghost" : "ghost"}
              size="sm"
              onClick={() => setIsInsightsOpen(!isInsightsOpen)}
              className="h-7 px-3 text-xs flex items-center space-x-1"
            >
              <FileCheck2 className="h-3.5 w-3.5" />
              <span>Toggle Suggestions</span>
            </Button>
            </div>


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