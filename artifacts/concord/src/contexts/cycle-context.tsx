import { createContext, useContext, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./auth-context";

export type CyclePhase = "menstrual" | "follicular" | "ovulatory" | "luteal" | "unknown";

export interface CycleInfo {
  hasData: boolean;
  phase: CyclePhase;
  dayInCycle: number | null;
  efficiency: number;
  phaseLabel: string;
  phaseDescription: string;
  shouldReschedule: boolean;
  needsPeriodUpdate: boolean;
}

interface CycleContextValue {
  cycleInfo: CycleInfo | null;
  isLoading: boolean;
  refetch: () => void;
}

const CycleContext = createContext<CycleContextValue | null>(null);

const DEFAULT_CYCLE: CycleInfo = {
  hasData: false,
  phase: "unknown",
  dayInCycle: null,
  efficiency: 100,
  phaseLabel: "Unknown",
  phaseDescription: "",
  shouldReschedule: false,
  needsPeriodUpdate: false,
};

export function CycleProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<CycleInfo>({
    queryKey: ["cycle"],
    queryFn: () =>
      fetch("/api/cycle", { credentials: "include" }).then((r) => r.json()),
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000, // 5 min
  });

  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["cycle"] });
  }, [queryClient]);

  return (
    <CycleContext.Provider
      value={{
        cycleInfo: data ?? (isAuthenticated ? null : DEFAULT_CYCLE),
        isLoading,
        refetch,
      }}
    >
      {children}
    </CycleContext.Provider>
  );
}

export function useCycle() {
  const ctx = useContext(CycleContext);
  if (!ctx) throw new Error("useCycle must be used within CycleProvider");
  return ctx;
}
