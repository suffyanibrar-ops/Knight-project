"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

const emptySubscribe = () => () => undefined;

/**
 * Renders children into <body> once hydrated.
 *
 * Needed because the sticky header uses backdrop-filter, which becomes the
 * containing block for position: fixed descendants — drawers and modals would
 * otherwise be positioned relative to the header and clipped off-screen.
 *
 * useSyncExternalStore returns false on the server and true on the client after
 * hydration without a setState-in-effect cascade.
 */
export function Portal({ children }: { children: ReactNode }) {
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  if (!mounted) return null;
  return createPortal(children, document.body);
}
