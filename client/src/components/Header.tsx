import { ModeToggle } from "@/components/ui/mode-toggle";
import { UserAvatar } from "@/components/UserAvatar";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between">
        <div className="mr-4 flex">
          <a className="mr-6 flex items-center space-x-2" href="/">
            <span className="font-bold">Coherence</span>
          </a>
        </div>
        <div className="flex items-center gap-2">
          <ModeToggle />
          <UserAvatar />
        </div>
      </div>
    </header>
  );
} 