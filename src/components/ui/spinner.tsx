import * as React from "react"
import { cn } from "@/lib/utils"

export interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {}

const Spinner = React.forwardRef<HTMLDivElement, SpinnerProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("animate-spin rounded-full border-2 border-current border-t-transparent", className)}
        {...props}
      />
    )
  }
)
Spinner.displayName = "Spinner"

export { Spinner }
