import * as React from "react"
import { cn } from "@/lib/utils"

interface ToggleSwitchProps {
    checked: boolean
    onCheckedChange: (checked: boolean) => void
    label?: string
    onIcon?: React.ReactNode
    offIcon?: React.ReactNode
    disabled?: boolean
    size?: "sm" | "default"
    activeColor?: string
    className?: string
}

export function ToggleSwitch({
    checked,
    onCheckedChange,
    label,
    onIcon,
    offIcon,
    disabled = false,
    size = "sm",
    activeColor = "bg-primary",
    className
}: ToggleSwitchProps) {
    const sizeClasses = {
        sm: {
            track: "h-5 w-9",
            thumb: "h-4 w-4",
            translate: "translate-x-4",
            icon: "h-2.5 w-2.5"
        },
        default: {
            track: "h-6 w-11",
            thumb: "h-5 w-5",
            translate: "translate-x-5",
            icon: "h-3 w-3"
        }
    }

    const sizes = sizeClasses[size]
    const currentIcon = checked ? onIcon : offIcon

    return (
        <div className={cn("flex items-center space-x-2", className)}>
            <button
                type="button"
                role="switch"
                aria-checked={checked}
                aria-label={label}
                disabled={disabled}
                onClick={() => !disabled && onCheckedChange(!checked)}
                className={cn(
                    "relative inline-flex shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    sizes.track,
                    checked
                        ? activeColor
                        : "bg-muted-foreground/20 dark:bg-muted-foreground/30",
                    disabled && "opacity-50 cursor-not-allowed"
                )}
            >
                <span
                    className={cn(
                        "pointer-events-none inline-block rounded-full bg-background shadow-lg ring-0 transition duration-200 ease-in-out flex items-center justify-center",
                        sizes.thumb,
                        checked ? sizes.translate : "translate-x-0"
                    )}
                >
                    {currentIcon && (
                        <span className={cn(
                            "flex items-center justify-center transition-colors duration-200",
                            sizes.icon,
                            checked
                                ? "text-blue-500"
                                : "text-muted-foreground/60"
                        )}>
                            {currentIcon}
                        </span>
                    )}
                </span>
            </button>
            {label && (
                <span className={cn(
                    "text-xs font-medium",
                    disabled
                        ? "opacity-50"
                        : "text-gray-700 dark:text-gray-300"
                )}>
                    {label}
                </span>
            )}
        </div>
    )
} 