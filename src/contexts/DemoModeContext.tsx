import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type DemoModeContextValue = {
  demoMode: boolean;
  setDemoMode: (v: boolean) => void;
  toggleDemoMode: () => void;
};

const DemoModeContext = createContext<DemoModeContextValue | undefined>(undefined);

const STORAGE_KEY = "proads:demo-mode";

export function DemoModeProvider({ children }: { children: ReactNode }) {
  const [demoMode, setDemoModeState] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw === null ? true : raw === "true";
  });

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, String(demoMode));
  }, [demoMode]);

  return (
    <DemoModeContext.Provider
      value={{
        demoMode,
        setDemoMode: setDemoModeState,
        toggleDemoMode: () => setDemoModeState((v) => !v),
      }}
    >
      {children}
    </DemoModeContext.Provider>
  );
}

export function useDemoMode() {
  const ctx = useContext(DemoModeContext);
  if (!ctx) throw new Error("useDemoMode must be used within DemoModeProvider");
  return ctx;
}
