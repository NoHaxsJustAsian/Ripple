import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Droplet, PencilIcon, MessageSquare } from "lucide-react"

export type EditorMode = 'write' | 'flow' | 'comments'

interface EditorModeToggleProps {
    value: EditorMode
    onValueChange: (value: EditorMode) => void
    className?: string
    disabled?: boolean
}

export function EditorModeToggle({ value, onValueChange, className, disabled = false }: EditorModeToggleProps) {
    return (
        <Tabs
            value={value}
            onValueChange={disabled ? undefined : (newValue) => onValueChange(newValue as EditorMode)}
            className={className}
        >
            <TabsList className={`h-8 p-1 bg-white dark:bg-transparent shadow-sm dark:shadow-none ${disabled ? 'opacity-50 pointer-events-none cursor-not-allowed' : ''}`}>
                <TabsTrigger
                    value="write"
                    className="h-6 px-2.5 text-xs flex items-center space-x-1.5 data-[state=active]:bg-green-500 data-[state=active]:text-white"
                    disabled={disabled}
                >
                    <PencilIcon className="h-2.5 w-2.5" strokeWidth={2.5} />
                    <span>Write</span>
                </TabsTrigger>
                <TabsTrigger
                    value="flow"
                    className="h-6 px-2.5 text-xs flex items-center space-x-1.5 data-[state=active]:bg-blue-500 data-[state=active]:text-white"
                    disabled={disabled}
                >
                    <Droplet className="h-2.5 w-2.5" strokeWidth={2.5} />
                    <span>Flow</span>
                </TabsTrigger>
                <TabsTrigger
                    value="comments"
                    className="h-6 px-2.5 text-xs flex items-center space-x-1.5 data-[state=active]:bg-orange-500 data-[state=active]:text-white"
                    disabled={disabled}
                >
                    <MessageSquare className="h-2.5 w-2.5" strokeWidth={2.5} />
                    <span>Feedback</span>
                </TabsTrigger>
            </TabsList>
        </Tabs>
    )
} 