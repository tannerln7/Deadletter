"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

import {
  createPreviewResourceCache,
  type PreviewResourceCache,
} from "@/lib/preview-cache";

const PreviewCacheContext = createContext<PreviewResourceCache | null>(null);

export function PreviewCacheProvider({ children }: { children: ReactNode }) {
  const [cache] = useState(() => createPreviewResourceCache());

  useEffect(() => () => cache.clear(), [cache]);

  return <PreviewCacheContext.Provider value={cache}>{children}</PreviewCacheContext.Provider>;
}

export function usePreviewCache(): PreviewResourceCache {
  const cache = useContext(PreviewCacheContext);
  if (!cache) throw new Error("usePreviewCache must be used inside PreviewCacheProvider.");
  return cache;
}
