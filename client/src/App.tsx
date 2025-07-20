import { ThemeProvider } from "@/components/ui/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import Editor from "@/components/Editor";
import { Login } from "@/components/Login";
import Hero from "@/components/Hero";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";
import { EventBatcher } from "@/lib/event-logger";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

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
    return (
      <Router>
        <Routes>
          <Route path="/" element={<Hero />} />
          <Route path="/auth" element={<Login />} />
          <Route path="*" element={<Navigate to="/auth" replace />} />
        </Routes>
      </Router>
    );
  }

  // Show editor when authenticated and ready
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Hero />} />
        <Route path="/editor" element={
          <div className="min-h-screen bg-background">
            {isReady && <Editor eventBatcher={editorEventBatcher} />}
          </div>
        } />
        <Route path="*" element={<Navigate to="/editor" replace />} />
      </Routes>
    </Router>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
      <AuthProvider>
        <AppContent />
        <Toaster />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
