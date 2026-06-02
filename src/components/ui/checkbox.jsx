import * as React from "react";

// Simple styled checkbox component compatible with Tailwind.
// Usage: <Checkbox checked={...} onChange={...} />

export const Checkbox = React.forwardRef(
  ({ className = "", ...props }, ref) => {
    return (
      <input
        ref={ref}
        type="checkbox"
        className={
          [
            // size / shape
            "h-4 w-4 rounded border border-input",
            // colors
            "text-primary focus:ring-2 focus:ring-primary",
            // disabled state
            "disabled:cursor-not-allowed disabled:opacity-50",
            // allow caller to pass extra classes
            className,
          ].join(" ")
        }
        {...props}
      />
    );
  }
);

Checkbox.displayName = "Checkbox";
