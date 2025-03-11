import * as React from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export type OptionType = {
  value: string;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
};

interface MultiSelectProps {
  options: OptionType[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  className?: string;
  badgeClassName?: string;
  disabled?: boolean;
  label?: React.ReactNode;
  emptyText?: string;
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Select options",
  className,
  badgeClassName,
  disabled = false,
  label,
  emptyText = "No options found",
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);
  const commandRef = React.useRef<HTMLDivElement>(null);
  
  // Prevent closing when clicking inside the command
  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
  };

  const handleUnselect = (value: string) => {
    onChange(selected.filter((item) => item !== value));
  };

  const handleSelect = (value: string) => {
    console.log("Selecting value:", value);
    
    setTimeout(() => {
      if (selected.includes(value)) {
        onChange(selected.filter((item) => item !== value));
      } else {
        onChange([...selected, value]);
      }
    }, 0);
  };

  // Convert selected values to labels for display
  const selectedLabels = selected.map((value) => {
    const option = options.find((opt) => opt.value === value);
    return option?.label || value;
  });

  // Is anything selected?
  const anySelected = selected.length > 0;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant={anySelected ? "default" : "outline"}
          size="sm"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "h-8 px-3 text-xs flex items-center justify-between",
            anySelected && "bg-accent text-accent-foreground",
            className
          )}
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            setOpen(!open);
          }}
        >
          <span className="flex items-center">
            {label}
            {anySelected && (
              <span className="ml-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                {selected.length}
              </span>
            )}
          </span>
          <ChevronDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-0" align="start" sideOffset={5}>
        <Command ref={commandRef}>
          <CommandList>
            {options.length === 0 ? (
              <CommandEmpty>{emptyText}</CommandEmpty>
            ) : (
              <CommandGroup>
                {options.map((option) => {
                  const isSelected = selected.includes(option.value);
                  return (
                    <div
                      key={option.value}
                      className={cn(
                        "relative flex select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-primary/10 hover:text-primary data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                        isSelected && "bg-accent text-accent-foreground",
                        option.disabled && "pointer-events-none opacity-50"
                      )}
                      onClick={(e) => {
                        if (option.disabled) return;
                        e.preventDefault();
                        e.stopPropagation();
                        handleSelect(option.value);
                      }}
                    >
                      <div className="mr-2 flex h-4 w-4 items-center justify-center">
                        <Check
                          className={cn(
                            "h-4 w-4",
                            isSelected ? "opacity-100" : "opacity-0"
                          )}
                        />
                      </div>
                      <span className="flex items-center">
                        {option.icon && <span className="mr-2">{option.icon}</span>}
                        {option.label}
                      </span>
                    </div>
                  );
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// For action-only items that don't support multi-select
export type ActionItemType = {
  value: string;
  label: string;
  icon?: React.ReactNode;
  action: () => void;
};

interface ActionSelectProps {
  items: ActionItemType[];
  activeItem?: string | null;
  className?: string;
  label?: React.ReactNode;
  emptyText?: string;
}

export function ActionSelect({
  items,
  activeItem = null,
  className,
  label,
  emptyText = "No options found",
}: ActionSelectProps) {
  const [open, setOpen] = React.useState(false);

  const handleSelect = (item: ActionItemType) => {
    try {
      if (typeof item.action === 'function') {
        item.action();
      }
    } catch (error) {
      console.error("Error executing action:", error);
    } finally {
      setOpen(false);
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline" 
          size="sm"
          className={cn(
            "h-8 px-3 text-xs flex items-center justify-between pointer-events-auto",
            className
          )}
        >
          <span>{label}</span>
          <ChevronDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        {items.length === 0 ? (
          <div className="text-sm py-2 px-3 text-muted-foreground">{emptyText}</div>
        ) : (
          items.map((item) => (
            <DropdownMenuItem
              key={item.value}
              onClick={() => handleSelect(item)}
              className="flex items-center cursor-pointer"
            >
              {item.icon && <span className="mr-2">{item.icon}</span>}
              {item.label}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
} 