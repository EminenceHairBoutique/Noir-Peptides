import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { scrollBehavior } from "../lib/motion";

export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: scrollBehavior() });
  }, [pathname]);

  return null;
}
