/// <reference types="vite/client" />

interface Window {
  fbq: (
    action: "track" | "trackCustom" | "init",
    eventName: string,
    params?: Record<string, unknown>
  ) => void;
}
