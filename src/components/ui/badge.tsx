
import React from 'react'
import { cn } from '@/lib/utils'
export function Badge({ variant='default', className='', ...props }: React.HTMLAttributes<HTMLSpanElement> & {variant?: 'default'|'outline'}) {
  const base = variant==='outline' ? 'border border-slate-300 text-slate-700' : 'bg-slate-900 text-white'
  return <span className={cn('inline-flex items-center px-2 py-0.5 text-xs rounded', base, className)} {...props} />
}
