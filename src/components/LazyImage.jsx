import { useState } from "react";

const PLACEHOLDER_STYLE = {
  background: "linear-gradient(135deg, #F5EFE6 0%, #E8DDD0 100%)",
};

export default function LazyImage({ src, alt = "", className = "" }) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  const handleError = () => {
    if (import.meta.env.DEV && src) {
      console.warn(`[LazyImage] Missing image: ${src}`);
    }
    setErrored(true);
    setLoaded(true);
  };

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {!loaded && (
        <div className="absolute inset-0 animate-pulse bg-neutral-200" />
      )}
      {errored ? (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center"
          style={PLACEHOLDER_STYLE}
          aria-label={alt || "Image unavailable"}
        >
          <svg
            className="w-10 h-10 text-neutral-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={handleError}
          className={`w-full h-full object-cover transition-opacity duration-500 ${
            loaded ? "opacity-100" : "opacity-0"
          }`}
        />
      )}
    </div>
  );
}
