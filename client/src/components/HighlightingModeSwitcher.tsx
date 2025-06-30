import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, GitBranch } from 'lucide-react';
import { HighlightingMode } from '@/lib/highlighting-manager';

interface HighlightingModeSwitcherProps {
    currentMode: HighlightingMode;
    onModeChange: (mode: HighlightingMode) => void;
    commentCount?: number;
    flowConnectionCount?: number;
    className?: string;
}

export function HighlightingModeSwitcher({
    currentMode,
    onModeChange,
    commentCount = 0,
    flowConnectionCount = 0,
    className = ''
}: HighlightingModeSwitcherProps) {

    const modes = [
        {
            id: 'comments' as HighlightingMode,
            label: 'Comments',
            icon: MessageCircle,
            description: 'Show comment highlights',
            count: commentCount,
            color: 'bg-yellow-100 text-yellow-800 border-yellow-300',
            activeColor: 'bg-yellow-500 text-white',
        },
        {
            id: 'flow' as HighlightingMode,
            label: 'Flow',
            icon: GitBranch,
            description: 'Show logical connections',
            count: flowConnectionCount,
            color: 'bg-green-100 text-green-800 border-green-300',
            activeColor: 'bg-green-500 text-white',
        },
    ];

    const handleModeChange = (mode: HighlightingMode) => {
        console.log(`🎯 Mode switch requested: ${currentMode} -> ${mode}`);
        onModeChange(mode);
    };

    return (
        <div className={`flex items-center space-x-2 ${className}`}>
            <span className="text-sm font-medium text-gray-700 mr-2">
                Highlighting:
            </span>

            {/* Mode buttons */}
            {modes.map((mode) => {
                const Icon = mode.icon;
                const isActive = currentMode === mode.id;

                return (
                    <Button
                        key={mode.id}
                        variant={isActive ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleModeChange(mode.id)}
                        className={`h-8 px-3 ${isActive ? mode.activeColor : ''}`}
                        title={mode.description}
                    >
                        <Icon className="h-3.5 w-3.5 mr-1" />
                        {mode.label}
                        {mode.count > 0 && (
                            <Badge
                                variant="secondary"
                                className={`ml-2 h-5 text-xs ${isActive
                                    ? 'bg-white/20 text-white'
                                    : mode.color
                                    }`}
                            >
                                {mode.count}
                            </Badge>
                        )}
                    </Button>
                );
            })}
        </div>
    );
}

// Keyboard shortcut hint component
export function HighlightingModeShortcuts() {
    return (
        <div className="text-xs text-gray-500 mt-2">
            <span className="mr-4">
                <kbd className="px-1 py-0.5 bg-gray-100 border rounded text-xs">Ctrl+1</kbd> Comments
            </span>
            <span className="mr-4">
                <kbd className="px-1 py-0.5 bg-gray-100 border rounded text-xs">Ctrl+2</kbd> Flow
            </span>
        </div>
    );
}

// Compact version for toolbars
export function CompactHighlightingModeSwitcher({
    currentMode,
    onModeChange,
    commentCount = 0,
    flowConnectionCount = 0,
}: HighlightingModeSwitcherProps) {
    const modes = [
        { id: 'comments' as HighlightingMode, icon: MessageCircle, count: commentCount, label: 'Comments' },
        { id: 'flow' as HighlightingMode, icon: GitBranch, count: flowConnectionCount, label: 'Flow' },
    ];

    const handleModeToggle = (modeId: HighlightingMode) => {
        // Toggle between the two modes
        const otherMode = modeId === 'comments' ? 'flow' : 'comments';
        const targetMode = currentMode === modeId ? otherMode : modeId;
        console.log(`🔄 Compact mode toggle: ${currentMode} -> ${targetMode}`);
        onModeChange(targetMode);
    };

    return (
        <div className="flex items-center space-x-1">
            {modes.map((mode) => {
                const Icon = mode.icon;
                const isActive = currentMode === mode.id;

                return (
                    <Button
                        key={mode.id}
                        variant={isActive ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => handleModeToggle(mode.id)}
                        className="h-8 w-8 p-0 relative"
                        title={`${mode.label} (${mode.count})`}
                    >
                        <Icon className="h-4 w-4" />
                        {mode.count > 0 && (
                            <Badge
                                variant="secondary"
                                className="absolute -top-1 -right-1 h-4 w-4 p-0 text-xs flex items-center justify-center"
                            >
                                {mode.count > 99 ? '99+' : mode.count}
                            </Badge>
                        )}
                    </Button>
                );
            })}
        </div>
    );
} 