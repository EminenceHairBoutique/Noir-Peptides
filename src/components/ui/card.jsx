export function Card({ className = "", ...props }) {
  return (
    <div
      className={
        // base dark card appearance
        [
          "rounded-3xl",
          "border border-white/10",
          "bg-white/5",
          "text-white",
          "backdrop-blur",
          "shadow-[0_30px_120px_rgba(255,255,255,0.12)]",
          "flex flex-col",
          className,
        ].join(" ")
      }
      {...props}
    />
  );
}

export function CardHeader({ className = "", ...props }) {
  return (
    <div
      className={
        [
          "relative p-0", // we typically don't want default padding on the image header
          className,
        ].join(" ")
      }
      {...props}
    />
  );
}

export function CardTitle({ className = "", ...props }) {
  return (
    <h3
      className={
        [
          "font-semibold leading-tight text-white",
          className,
        ].join(" ")
      }
      {...props}
    />
  );
}

export function CardContent({ className = "", ...props }) {
  return (
    <div
      className={
        [
          "p-4 flex-1 flex flex-col gap-2 text-sm text-white",
          className,
        ].join(" ")
      }
      {...props}
    />
  );
}

export function CardFooter({ className = "", ...props }) {
  return (
    <div
      className={
        [
          "p-4 pt-0 flex items-center justify-between gap-3",
          className,
        ].join(" ")
      }
      {...props}
    />
  );
}
