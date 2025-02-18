import * as React from "react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
} from "./dropdown-menu"; // Adjust the import path as needed

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
  const handleCheckedChange = (itemId: string) => {
      onSelectedItemsChange(
        selectedItems.includes(itemId)
          ? selectedItems.filter((id) => id !== itemId) // Remove if already selected
          : [...selectedItems, itemId] // Add if not selected
      );
    };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
          {label}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-100 p-2 bg-white shadow-lg rounded-md">
        {items.map((item) => (
          <DropdownMenuCheckboxItem
            key={item.id}
            checked={selectedItems.includes(item.id)}
            onCheckedChange={() => handleCheckedChange(item.id)}
            className="cursor-pointer px-2 py-1 hover:bg-gray-100"
          >
            {item.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default DropdownMenuWithCheckboxes;
