"use client";
import { useEffect } from "react";

export function Offline() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
        // Offline enhancement is optional; registration failures do not block reading.
      });
    }
  }, []);
  return null;
}
