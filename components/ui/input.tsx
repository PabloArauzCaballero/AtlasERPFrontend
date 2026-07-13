import { cn } from '@/lib/cn';
import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'w-full rounded-lg border border-border-subtle bg-white px-3 py-2 text-sm outline-none focus:border-primary',
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'min-h-40 w-full rounded-lg border border-border-subtle bg-white px-3 py-2 font-mono text-xs outline-none focus:border-primary',
        className,
      )}
      {...props}
    />
  );
}
