/**
 * Prefetch a resource (image, script, etc.) by creating a link element.
 * @param {string} url - The URL to prefetch.
 * @param {'image'|'script'|'style'|'fetch'} [asType='fetch'] - The type of resource.
 */
export function prefetch(url, asType = 'fetch') {
  if (typeof window === 'undefined' || !url) return;

  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = url;
  if (asType) link.as = asType;
  document.head.appendChild(link);
}

/**
 * Prefetch a route by calling its dynamic import function.
 * @param {Function} importFn - The dynamic import function.
 */
export const prefetchRoute = (importFn) => {
  if (typeof importFn === "function") {
    importFn();
  }
};