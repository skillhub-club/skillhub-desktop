import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '../../lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-[4px] px-2 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-foreground text-background',
        secondary: 'bg-secondary text-muted-foreground',
        outline: 'border border-border-light text-foreground',
        success: 'bg-green-500/20 text-green-600 dark:text-green-400',
        warning: 'bg-amber-500/20 text-amber-600 dark:text-amber-400',
        destructive: 'bg-red-500/20 text-red-600 dark:text-red-400',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
