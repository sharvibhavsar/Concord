import { createContext, useContext, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./auth-context";

export interface UserProfile {
  userId: string;
  displayName: string | null;
  gender: "female" | "male" | "other" | "prefer_not_to_say" | null;
  lastPeriodDate: string | null;
  cycleLength: number;
  lutealPhaseLength: number;
  lastPeriodUpdatedAt: string | null;
  profileCompleted: boolean;
  weekendAvailable?: boolean;
}

interface ProfileContextValue {
  profile: UserProfile | null;
  isLoading: boolean;
  refetch: () => void;
  updateProfile: (data: Partial<Omit<UserProfile, "userId">>) => Promise<UserProfile>;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<UserProfile>({
    queryKey: ["profile"],
    queryFn: async () => {
      try {
        const r = await fetch("/api/profile", { credentials: "include" });
        if (r.ok) {
          const profileData = await r.json();
          localStorage.setItem("concord_local_profile", JSON.stringify(profileData));
          return profileData;
        }
      } catch (e) {
        console.warn("Backend fetch failed, using local profile fallback");
      }
      const local = localStorage.getItem("concord_local_profile");
      if (local) return JSON.parse(local);
      return {
        userId: "mock",
        displayName: "",
        gender: null,
        lastPeriodDate: null,
        cycleLength: 28,
        lutealPhaseLength: 14,
        lastPeriodUpdatedAt: null,
        profileCompleted: false,
      };
    },
    enabled: isAuthenticated,
  });

  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["profile"] });
  }, [queryClient]);

  const updateProfile = useCallback(
    async (updates: Partial<Omit<UserProfile, "userId">>) => {
      const local = localStorage.getItem("concord_local_profile");
      let current = local ? JSON.parse(local) : {
        userId: "mock",
        displayName: "",
        gender: null,
        lastPeriodDate: null,
        cycleLength: 28,
        lutealPhaseLength: 14,
        lastPeriodUpdatedAt: null,
        profileCompleted: false,
      };
      const updatedProfile = { ...current, ...updates };
      if (updates.gender !== undefined) {
        updatedProfile.profileCompleted = true;
      }
      localStorage.setItem("concord_local_profile", JSON.stringify(updatedProfile));

      try {
        const res = await fetch("/api/profile", {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
        if (res.ok) {
          const updated: UserProfile = await res.json();
          queryClient.setQueryData(["profile"], updated);
          localStorage.setItem("concord_local_profile", JSON.stringify(updated));
          queryClient.invalidateQueries({ queryKey: ["cycle"] });
          return updated;
        }
      } catch (err) {
        console.warn("Failed to patch profile on backend, saved locally");
      }

      queryClient.setQueryData(["profile"], updatedProfile);
      queryClient.invalidateQueries({ queryKey: ["cycle"] });
      return updatedProfile;
    },
    [queryClient],
  );

  return (
    <ProfileContext.Provider value={{ profile: data ?? null, isLoading, refetch, updateProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used within ProfileProvider");
  return ctx;
}
