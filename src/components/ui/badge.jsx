export function Badge({ className = "", variant = "default", ...props }) {
  const variants = {
    default:
      "bg-yellow-300 text-black font-semibold border border-yellow-300/20 shadow",
    secondary:
      "bg-white/10 text-white/80 border border-white/20",
    success:
      "bg-green-500/20 text-green-300 border border-green-400/30",
    outline:
      "border border-white/30 text-white/80",
  };

  const base =
    "inline-flex items-center rounded-md px-2 py-1 text-[10px] leading-none font-medium";

  const resolved =
    variants[variant] || variants.default;

  return (
    <span
      className={[base, resolved, className].join(" ")}
      {...props}
    />
  );
}
