// src/components/ToastContainer.jsx

import React from "react";
import { AnimatePresence, motion as Motion } from "framer-motion";
import { useToast } from "../context/ToastContext";

const ToastContainer = () => {
  const { toasts } = useToast();

  return (
    <div className="fixed top-4 right-4 z-[999] space-y-2">
      <AnimatePresence>
        {toasts.map((toast) => (
          <Motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="px-4 py-2 rounded-full bg-black text-white text-xs tracking-[0.18em] uppercase shadow-lg"
          >
            {toast.message}
          </Motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default ToastContainer;
