import React from "react";

export function Tabs({ value, onValueChange, children, className="" }) {
  return (
    <div className={className}>
      {React.Children.map(children, (child) =>
        React.cloneElement(child, { value, onValueChange })
      )}
    </div>
  );
}

export function TabsList({ children, className="" }) {
  return (
    <div className={`inline-flex rounded-md border border-black/20 bg-white p-1 text-sm ${className}`}>
      {children}
    </div>
  );
}

export function TabsTrigger({ children, value, onValueChange, className="", ...props }) {
  const myValue = props.value;
  const active = myValue === value;
  return (
    <button
      onClick={() => onValueChange(myValue)}
      className={
        "px-3 py-1.5 text-xs font-medium rounded " +
        (active ? "bg-black text-white" : "text-black hover:bg-black/5") +
        " " +
        className
      }
    >
      {children}
    </button>
  );
}
