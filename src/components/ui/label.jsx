export function Label({ className = "", ...props }) {
  return (
    <label
      className={`text-xs font-medium text-black ${className}`}
      {...props}
    />
  );
}
