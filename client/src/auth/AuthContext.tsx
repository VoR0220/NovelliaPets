import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { FamilyMembershipDto, HumanDto, NotificationDto } from "@novellia/shared";
import { api, getToken, setToken } from "../api";

type AuthState = {
  human: HumanDto | null;
  memberships: FamilyMembershipDto[];
  loading: boolean;
  notifications: NotificationDto[];
  refresh: () => Promise<void>;
  loginWithToken: (token: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  pushNotification: (n: NotificationDto) => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [human, setHuman] = useState<HumanDto | null>(null);
  const [memberships, setMemberships] = useState<FamilyMembershipDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);

  const refreshNotifications = useCallback(async () => {
    if (!getToken()) {
      setNotifications([]);
      return;
    }
    try {
      const list = await api.notifications();
      setNotifications(list);
    } catch {
      /* ignore while logged out */
    }
  }, []);

  const refresh = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setHuman(null);
      setMemberships([]);
      setLoading(false);
      return;
    }
    try {
      const me = await api.me();
      setHuman(me.human);
      setMemberships(me.memberships);
      await refreshNotifications();
    } catch {
      setToken(null);
      setHuman(null);
      setMemberships([]);
    } finally {
      setLoading(false);
    }
  }, [refreshNotifications]);

  const loginWithToken = useCallback(
    async (token: string) => {
      setToken(token);
      setLoading(true);
      await refresh();
    },
    [refresh]
  );

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      /* ignore */
    }
    setToken(null);
    setHuman(null);
    setMemberships([]);
    setNotifications([]);
  }, []);

  const pushNotification = useCallback((n: NotificationDto) => {
    setNotifications((prev) => [n, ...prev.filter((x) => x.id !== n.id)]);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!human) return;
    const token = getToken();
    if (!token) return;

    const es = new EventSource(
      `/api/notifications/stream?token=${encodeURIComponent(token)}`
    );
    es.addEventListener("notification", (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data) as NotificationDto;
        pushNotification(data);
      } catch {
        /* ignore malformed */
      }
    });
    es.onerror = () => {
      /* browser will retry */
    };
    return () => es.close();
  }, [human, pushNotification]);

  const value = useMemo(
    () => ({
      human,
      memberships,
      loading,
      notifications,
      refresh,
      loginWithToken,
      logout,
      refreshNotifications,
      pushNotification,
    }),
    [
      human,
      memberships,
      loading,
      notifications,
      refresh,
      loginWithToken,
      logout,
      refreshNotifications,
      pushNotification,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
