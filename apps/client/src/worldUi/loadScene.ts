/** A failed module URL can remain cached in WebKit even after a document reload. */
export const loadScene = async <T>(source: string, load: () => Promise<T>): Promise<T> => {
  const retry = new URLSearchParams(location.search).get("sceneRetry");
  if (!import.meta.env.PROD || !retry) return load();
  // Preserve Vite's dependency/CSS preload path before bypassing a failed module URL.
  try { return await load(); } catch { /* Retry the entry chunk below. */ }
  const base = new URL(import.meta.env.BASE_URL, location.origin);
  const response = await fetch(new URL("assets/chunks.json", base), { cache: "no-store" });
  if (!response.ok) throw new Error("Scene manifest unavailable");
  const manifest = await response.json() as Record<string, { file?: string }>;
  const file = manifest[source]?.file;
  if (!file?.startsWith("assets/") || !file.endsWith(".js") || file.includes("..")) throw new Error("Scene chunk unavailable");
  const url = new URL(file, base); url.searchParams.set("retry", retry);
  return import(/* @vite-ignore */ url.href) as Promise<T>;
};
