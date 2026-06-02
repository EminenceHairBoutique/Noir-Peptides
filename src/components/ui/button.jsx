import * as React from "react";

export function Button({
  className = "",
  variant = "default",
  size = "md",
  ...props
}) {
  const base =
    "inline-flex items-center justify-center font-accent text-[11px] tracking-[0.12em] uppercase " +
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-se-gold/60 " +
    "disabled:opacity-50 disabled:pointer-events-none " +
    "transition-all duration-200 active:scale-[0.98]";
  const variants = {
    default:
      "bg-se-bone text-se-black hover:bg-se-cream hover:-translate-y-px hover:shadow-md",
    outline:
      "border border-white/20 bg-transparent text-se-bone hover:bg-white/5 hover:-translate-y-px",
    secondary:
      "bg-se-asphalt text-se-bone hover:bg-se-concrete hover:-translate-y-px",
    ghost:
      "bg-transparent text-se-bone hover:bg-white/5",
  };
  const sizes = {
    sm: "h-8 px-3",
    md: "h-9 px-4",
    lg: "h-10 px-5",
    icon: "h-9 w-9",
  };
  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  );
}
