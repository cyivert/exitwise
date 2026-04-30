import * as React from "react"
import { cn } from "../../utils/helpers"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'noShadow' | 'neutral' | 'reverse'
  size?: 'default' | 'sm' | 'lg' | 'icon'
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    const variantStyles = {
      default: "text-green-deep bg-amber border-2 border-green-deep shadow-[4px_4px_0px_0px_rgba(26,58,42,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none",
      noShadow: "text-green-deep bg-amber border-2 border-green-deep",
      neutral: "bg-cream text-text-dark border-2 border-green-deep shadow-[4px_4px_0px_0px_rgba(26,58,42,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none",
      reverse: "text-green-deep bg-amber border-2 border-green-deep hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[4px_4px_0px_0px_rgba(26,58,42,1)]",
    }

    const sizeStyles = {
      default: "h-10 px-4 py-2",
      sm: "h-9 px-3",
      lg: "h-11 px-8",
      icon: "h-10 w-10",
    }

    const baseStyles = "inline-flex items-center justify-center whitespace-nowrap rounded-none text-sm font-bold ring-offset-white transition-all gap-2 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-deep focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"

    return (
      <button
        className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
        ref={ref}
        {...props}
      />
    )
  },
)
Button.displayName = "Button"

export { Button }
