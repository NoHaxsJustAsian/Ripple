import { useState, useRef, useEffect } from 'react';
import { X, Play, Info, PenTool, Lightbulb, MessageSquare, Award } from 'lucide-react';
import { cn } from "@/lib/utils";
import { Button } from './ui/button';

interface VideoTile {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  videoUrl: string;
  icon: JSX.Element;
}

interface HelpSplashScreenProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HelpSplashScreen({ isOpen, onClose }: HelpSplashScreenProps) {
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const videoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({});
  
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState("-translate-x-full");


  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      const timer = setTimeout(() => {
        setPosition("translate-x-0");
      }, 50);

      return () => clearTimeout(timer);
    } else {
      // First animate out
      setPosition("-translate-x-full");

      // Then remove from DOM after animation completes
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 300); // Match to your transition duration

      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Don't render if not visible
  if (!isVisible) return null;


  const videoTiles: VideoTile[] = [
    {
      id: 'getting-started',
      title: 'Getting Started with Ripple',
      description: 'Learn the basics of Ripple and how to create your first document',
      thumbnailUrl: '/tutorial-thumbnails/getting-started.jpg',
      videoUrl: 'https://example.com/videos/getting-started.mp4',
      icon: <Info className="h-5 w-5" />,
    },
    {
      id: 'using-ai',
      title: 'AI Assistant Features',
      description: 'How to use the AI to improve your writing and get real-time suggestions',
      thumbnailUrl: '/tutorial-thumbnails/ai-features.jpg',
      videoUrl: 'https://example.com/videos/ai-features.mp4',
      icon: <Lightbulb className="h-5 w-5" />,
    },
    {
      id: 'topic-management',
      title: 'Essay & Paragraph Topics',
      description: 'Master document structure with topic highlighting and organization',
      thumbnailUrl: '/tutorial-thumbnails/topics.jpg',
      videoUrl: 'https://example.com/videos/topics.mp4',
      icon: <PenTool className="h-5 w-5" />,
    },
    {
      id: 'using-comments',
      title: 'Comments & Feedback Tools',
      description: 'How to add, manage and resolve comments in your documents',
      thumbnailUrl: '/tutorial-thumbnails/comments.jpg',
      videoUrl: 'https://example.com/videos/comments.mp4',
      icon: <MessageSquare className="h-5 w-5" />,
    },
    {
      id: 'ai-feedback',
      title: 'Text Analysis & Coherence',
      description: 'Analyze your writing with AI and improve document coherence',
      thumbnailUrl: '/tutorial-thumbnails/ai-feedback.jpg',
      videoUrl: 'https://example.com/videos/ai-feedback.mp4',
      icon: <Award className="h-5 w-5" />,
    }
  ];

  const handleMouseEnter = (videoId: string) => {
    setActiveVideoId(videoId);
    const videoElement = videoRefs.current[videoId];
    if (videoElement) {
      videoElement.play().catch(error => {
        console.error('Error playing video:', error);
      });
    }
  };

  const handleMouseLeave = (videoId: string) => {
    setActiveVideoId(null);
    const videoElement = videoRefs.current[videoId];
    if (videoElement) {
      videoElement.pause();
      videoElement.currentTime = 0;
    }
  };

  return (
    <div 
      className={cn(
        "fixed left-0 top-0 h-screen bg-background border-r border-border/40",
        "transition-all duration-300 ease-in-out",
        "z-50 w-[440px] shadow-lg overflow-hidden",
        position
      )}
    >
      {/* Header */}
      <div className="border-b border-border/40 p-3 flex justify-between items-center bg-muted/30">
        <h2 className="text-lg font-semibold">How to Use Ripple</h2>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="overflow-auto h-[calc(100vh-56px)]">
        <div className="p-3">
          <p className="text-sm text-muted-foreground mb-5">
            Hover over any tutorial to preview the video.
          </p>
          
          <div className="space-y-5">
            {videoTiles.map(video => (
              <div 
                key={video.id}
                className="relative rounded-lg overflow-hidden shadow-md border border-border/40 hover:shadow-lg transition-all"
                onMouseEnter={() => handleMouseEnter(video.id)}
                onMouseLeave={() => handleMouseLeave(video.id)}
              >
                <div className="aspect-video relative">
                  {/* Video thumbnail when not active */}
                  {activeVideoId !== video.id && (
                    <>
                      <img 
                        src={video.thumbnailUrl} 
                        alt={video.title}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <div className="bg-white/90 dark:bg-black/90 rounded-full p-3">
                          <Play className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                        </div>
                      </div>
                    </>
                  )}
                  
                  {/* Video player - hidden initially but shows on hover */}
                  <video
                    ref={el => videoRefs.current[video.id] = el}
                    src={video.videoUrl}
                    className={cn(
                      "absolute inset-0 w-full h-full object-cover transition-opacity",
                      activeVideoId === video.id ? "opacity-100" : "opacity-0"
                    )}
                    muted
                    playsInline
                    loop
                  />
                </div>
                
                <div className="p-3 bg-card">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="p-1 rounded-full bg-blue-100 dark:bg-blue-900/30">
                      {video.icon}
                    </div>
                    <h3 className="font-medium text-sm">{video.title}</h3>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {video.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
} 