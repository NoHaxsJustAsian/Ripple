import { useState, useEffect } from 'react';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileService } from '@/lib/file-service';
import { FileData } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { format } from 'date-fns';
import { Loader2, File, Clock, Calendar } from 'lucide-react';
import { EventType } from '@/lib/event-logger';

interface FilePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onFileSelect: (file: FileData) => void;
  eventBatcher?: any;
}

export function FilePicker({ isOpen, onClose, onFileSelect, eventBatcher }: FilePickerProps) {
  const [files, setFiles] = useState<FileData[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  
  useEffect(() => {
    const loadFiles = async () => {
      if (user && isOpen) {
        setLoading(true);
        try {
          const fileService = new FileService(user.id);
          const userFiles = await fileService.getAllFiles();
          setFiles(userFiles);
          
          // Log file list viewed event
          eventBatcher?.addEvent(EventType.FILE_OPEN, {
            action: 'view_file_list',
            file_count: userFiles.length
          });
        } catch (error) {
          console.error('Error loading files:', error);
        } finally {
          setLoading(false);
        }
      }
    };
    
    loadFiles();
  }, [user, isOpen, eventBatcher]);
  
  const handleFileSelect = (file: FileData) => {
    onFileSelect(file);
    onClose();
  };
  
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, 'MMM d, yyyy h:mm a');
    } catch (e) {
      return dateString;
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Your Documents</DialogTitle>
          <DialogDescription>
            Select a document to load
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : files.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No saved documents found</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
              {files.map((file) => (
                <div 
                  key={file.id}
                  className="flex items-center gap-3 p-3 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => handleFileSelect(file)}
                >
                  <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-md">
                    <File className="h-5 w-5 text-blue-700 dark:text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm truncate">{file.title}</h4>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>Created: {formatDate(file.created_at)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>Updated: {formatDate(file.updated_at)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 