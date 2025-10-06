
import React from 'react'
import { cn } from '@/lib/utils'
export function Button({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={cn('px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 active:scale-[0.98] transition shadow', className)} {...props} />
}
