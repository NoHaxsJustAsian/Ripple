import { ThemeProvider } from "@/components/ui/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import Editor from "@/components/Editor";
import { Login } from "@/components/Login";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";
import { EventBatcher } from "@/lib/event-logger";

const editorEventBatcher = new EventBatcher("", 20, 2000);

function AppContent() {
  const { user, loading } = useAuth();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (user && !loading) {
      // Update the event batcher with the current user ID
      editorEventBatcher.updateUserId(user.id);
      setIsReady(true);
    } else {
      setIsReady(false);
    }
  }, [user, loading]);

  // Show loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-foreground">Loading...</div>
      </div>
    );
  }

  // Show login if no user
  if (!user) {
    return <Login />;
  }

  // Show editor when authenticated and ready
  return (
    <div className="min-h-screen bg-background">
      {isReady && <Editor eventBatcher={editorEventBatcher} />}
    </div>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <AuthProvider>
        <AppContent />
        <Toaster />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
