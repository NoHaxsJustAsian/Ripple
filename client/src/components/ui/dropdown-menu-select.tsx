import * as React from "react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
} from "./dropdown-menu";
import { Button } from "./button";
import { ChevronUp, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface DropdownMenuWithCheckboxesProps {
  label: string;
  items: { id: string; label: string }[];
  selectedItems: string[];
  onSelectedItemsChange: (items: string[]) => void;
}

const DropdownMenuWithCheckboxes: React.FC<DropdownMenuWithCheckboxesProps> = ({
  label,
  items,
  selectedItems,
  onSelectedItemsChange,
}) => {
  const [open, setOpen] = React.useState(false);

  const handleCheckedChange = (itemId: string) => {
    onSelectedItemsChange(
      selectedItems.includes(itemId)
        ? selectedItems.filter((id) => id !== itemId) // Remove if already selected
        : [...selectedItems, itemId] // Add if not selected
    );
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-7 px-3 text-xs flex items-center space-x-1"
        >
          <span>{label}</span>
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
          <DropdownMenuCheckboxItem
            key={item.id}
            checked={selectedItems.includes(item.id)}
            onCheckedChange={() => handleCheckedChange(item.id)}
            className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent"
          >
            <span className="absolute left-2 flex h-4 w-4 items-center justify-center">
              <Check className={cn(
                "h-4 w-4 transition-opacity",
                selectedItems.includes(item.id) ? "opacity-100" : "opacity-0"
              )} />
            </span>
            <span className="ml-6">{item.label}</span>
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default DropdownMenuWithCheckboxes;
