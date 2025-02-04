import { cn } from "./utils";

export const theme = {
  root: cn(
    'relative',
    'font-sans'
  ),
  paragraph: cn(
    'mb-0 leading-[1.5] min-h-[1.5em]',
    'text-stone-800 dark:text-zinc-50',
    'font-sans'
  ),
  text: {
    bold: 'font-bold',
    italic: 'italic',
    underline: 'underline',
    strikethrough: 'line-through',
    underlineStrikethrough: 'underline line-through',
    code: 'font-mono px-[0.25em] py-[0.15em] bg-stone-100 dark:bg-zinc-800 rounded'
  },
  heading: {
    h1: cn(
      'text-[20pt] font-normal leading-[1.2] mt-[20pt] mb-[6pt]',
      'text-stone-800 dark:text-zinc-50',
      'font-sans'
    ),
    h2: cn(
      'text-[16pt] font-normal leading-[1.2] mt-[18pt] mb-[6pt]',
      'text-stone-800 dark:text-zinc-50',
      'font-sans'
    ),
    h3: cn(
      'text-[14pt] font-normal leading-[1.2] mt-[16pt] mb-[4pt]',
      'text-stone-800 dark:text-zinc-50',
      'font-sans'
    ),
  },
  list: {
    nested: {
      listitem: 'list-none ml-[1.5em] font-sans',
    },
    ol: 'list-decimal ml-[1.5em] my-[0.5em] font-sans',
    ul: 'list-disc ml-[1.5em] my-[0.5em] font-sans',
    listitem: 'ml-[1.5em] leading-[1.5] font-sans',
  },
  quote: cn(
    'border-l-2 border-stone-200 dark:border-zinc-700',
    'pl-4 ml-0 italic',
    'text-stone-600 dark:text-zinc-300',
    'font-sans'
  ),
}; 