export function Input({ className = "", ...props }) {
  return (
    <input
      className={`w-full rounded-md border border-black/20 bg-white px-3 py-2 text-sm text-black placeholder-black/40 transition-all duration-200 focus:outline-none focus:border-[#D4AF37]/60 focus-visible:ring-2 focus-visible:ring-[#D4AF37]/40 ${className}`}
      {...props}
    />
  );
}
