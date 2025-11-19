import * as React from "react"
import { cn } from "@/lib/utils"

export interface RadioGroupProps
  extends React.HTMLAttributes<HTMLDivElement> {}

const RadioGroup = React.forwardRef<HTMLDivElement, RadioGroupProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        className={cn("grid gap-2", className)}
        {...props}
        ref={ref}
        role="radiogroup"
      />
    )
  }
)
RadioGroup.displayName = "RadioGroup"

export interface RadioGroupItemProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

const RadioGroupItem = React.forwardRef<HTMLInputElement, RadioGroupItemProps>(
  ({ className, label, ...props }, ref) => {
    return (
      <label className="flex items-center space-x-2 cursor-pointer">
        <input
          type="radio"
          className={cn(
            "aspect-square h-4 w-4 rounded-full border border-primary text-primary ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
          ref={ref}
          {...props}
        />
        {label && <span className="text-sm font-normal">{label}</span>}
      </label>
    )
  }
)
RadioGroupItem.displayName = "RadioGroupItem"

export { RadioGroup, RadioGroupItem }

