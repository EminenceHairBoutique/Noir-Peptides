import React from "react";

export function Dialog({ children }) {
  return <div>{children}</div>;
}

export function DialogTrigger({ asChild: _asChild, children }) {
  return children;
}

export function DialogContent({ className="", children }) {
  return (
    <div className={`mt-4 rounded-xl border border-black/20 bg-white p-4 text-black ${className}`}>
      {children}
    </div>
  );
}

export function DialogHeader({ children }) {
  return <div className="mb-2">{children}</div>;
}

export function DialogTitle({ children }) {
  return <h3 className="text-base font-semibold">{children}</h3>;
}

export function DialogDescription({ children }) {
  return <p className="text-sm text-black/60">{children}</p>;
}
