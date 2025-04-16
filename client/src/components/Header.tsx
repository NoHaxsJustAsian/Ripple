import { ModeToggle } from "@/components/ui/mode-toggle";
import { UserAvatar } from "@/components/UserAvatar";
import { Link } from "react-router-dom";
import { Sparkles, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";

export function Header() {
  const { user } = useAuth();
  
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between">
        <div className="mr-4 flex items-center">
          <Link className="mr-6 flex items-center space-x-2" to="/">
            <Sparkles className="h-5 w-5 text-blue-600" />
            <span className="font-bold text-lg">Ripple</span>
          </Link>
          
          <nav className="hidden md:flex items-center space-x-4">
            <Link to="/editor" className="text-sm font-medium transition-colors hover:text-primary">
              Editor
            </Link>
          </nav>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center">
            {!user ? (
              <Link to="/auth">
                <Button variant="outline" size="sm" className="mr-2">
                  Sign In
                </Button>
              </Link>
            ) : (
              <div className="flex items-center mr-2">
                <Button variant="ghost" size="sm" className="text-sm font-medium gap-1.5">
                  <Bot className="h-4 w-4" />
                  AI Assistant
                </Button>
              </div>
            )}
          </div>
          <ModeToggle />
          <UserAvatar />
        </div>
      </div>
    </header>
  );
} 