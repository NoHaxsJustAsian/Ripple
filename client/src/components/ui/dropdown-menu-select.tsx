import * as React from "react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
} from "./dropdown-menu";
import { Button } from "./button";
import { ChevronUp, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface DropdownMenuWithCheckboxesProps {
  label: React.ReactNode;
  items: { 
    id: string; 
    label: string; 
    icon?: React.ReactNode;
    action?: () => void;
    // If checkable is false, item will just trigger action without being checked
    checkable?: boolean;
  }[];
  selectedItems: string[];
  onSelectedItemsChange: (items: string[]) => void;
  // If activeItem is provided, it will show a visual indication in the button
  activeItem?: string | null;
}

const DropdownMenuWithCheckboxes: React.FC<DropdownMenuWithCheckboxesProps> = ({
  label,
  items,
  selectedItems,
  onSelectedItemsChange,
  activeItem = null,
}) => {
  const [open, setOpen] = React.useState(false);

  const handleItemClick = (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    
    // Call the action if provided
    if (item?.action) {
      item.action();
    }
    
    // Only update selected items if the item is checkable
    if (item?.checkable !== false) {
      onSelectedItemsChange(
        selectedItems.includes(itemId)
          ? selectedItems.filter((id) => id !== itemId) // Remove if already selected
          : [...selectedItems, itemId] // Add if not selected
      );
    } else {
      // Close the dropdown for non-checkable items after action is triggered
      setOpen(false);
    }
  };

  // Calculate button style based on selection
  const anySelected = selectedItems.length > 0;
  const isActive = activeItem !== null;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant={anySelected || isActive ? "default" : "ghost"} 
          size="sm" 
          className={cn(
            "h-7 px-3 text-xs flex items-center space-x-1",
            anySelected && "bg-accent text-accent-foreground",
            isActive && "bg-muted text-muted-foreground"
          )}
        >
          <span className="flex items-center">
            {label}
            {anySelected && (
              <span className="ml-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                {selectedItems.length}
              </span>
            )}
          </span>
          <ChevronUp 
            className={cn(
              "h-3.5 w-3.5 transition-transform duration-200",
              open ? "rotate-0" : "rotate-180"
            )} 
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        {items.map((item) => (
          item.checkable !== false ? (
            // Checkable item
            <DropdownMenuCheckboxItem
              key={item.id}
              checked={selectedItems.includes(item.id)}
              onCheckedChange={() => handleItemClick(item.id)}
              className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent"
            >
              <span className="absolute left-2 flex h-4 w-4 items-center justify-center">
                <Check className={cn(
                  "h-4 w-4 transition-opacity",
                  selectedItems.includes(item.id) ? "opacity-100" : "opacity-0"
                )} />
              </span>
              <span className="ml-6 flex items-center">
                {item.icon && <span className="mr-2">{item.icon}</span>}
                {item.label}
              </span>
            </DropdownMenuCheckboxItem>
          ) : (
            // Non-checkable, action-only item
            <DropdownMenuItem
              key={item.id}
              onClick={() => handleItemClick(item.id)}
              className={cn(
                "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent",
                activeItem === item.id && "bg-muted font-medium"
              )}
            >
              <span className="ml-1 flex items-center">
                {item.icon && <span className="mr-2">{item.icon}</span>}
                {item.label}
              </span>
            </DropdownMenuItem>
          )
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default DropdownMenuWithCheckboxes;
