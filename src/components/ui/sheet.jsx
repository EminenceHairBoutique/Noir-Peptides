import React from "react";

export function Sheet({ open, onOpenChange, children }) {
  return React.Children.map(children, (child) =>
    React.cloneElement(child, { open, onOpenChange })
  );
}

export function SheetTrigger({ asChild: _asChild, children }) {
  return children;
}

export function SheetContent({ className="", open, children }) {
  if (!open) return null;
  return (
    <div className={`fixed right-0 top-0 z-50 h-full w-full max-w-sm overflow-y-auto bg-white p-6 shadow-xl border-l border-black/10 ${className}`}>
      {children}
    </div>
  );
}

export function SheetHeader({ children }) {
  return <div className="mb-4">{children}</div>;
}

export function SheetTitle({ children }) {
  return <h2 className="text-lg font-semibold">{children}</h2>;
}

export function SheetDescription({ children }) {
  return <p className="text-sm text-black/60">{children}</p>;
}
