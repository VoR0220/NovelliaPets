import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { api } from "../api";

function labelForNotification(type: string, payload: Record<string, unknown>): string {
  switch (type) {
    case "invite_received":
      return `Invite to ${String(payload.familyName ?? "a family")}`;
    case "invite_accepted":
      return `${String(payload.humanName ?? "Someone")} joined ${String(payload.familyName ?? "your family")}`;
    case "transfer_requested":
      return `Transfer requested for ${String(payload.petName ?? "a pet")}`;
    case "transfer_approved":
      return `Transfer approved for ${String(payload.petName ?? "a pet")}`;
    case "transfer_denied":
      return `Transfer denied for ${String(payload.petName ?? "a pet")}`;
    case "member_promoted":
      return "You were promoted to family admin";
    case "merge_requested":
      return `Merge requested: ${String(payload.fromFamilyName ?? "a family")} → ${String(payload.toFamilyName ?? "your family")}`;
    case "merge_approved":
      return `Households merged into ${String(payload.toFamilyName ?? "one family")}`;
    case "merge_denied":
      return `Merge denied for ${String(payload.fromFamilyName ?? "a family")}`;
    default:
      return type;
  }
}

function BellIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{
        transform: open ? "rotate(180deg)" : "rotate(0deg)",
        transition: "transform 0.15s ease",
      }}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function Layout() {
  const { human, logout, notifications, refreshNotifications } = useAuth();
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const unread = notifications.filter((n) => !n.readAt).length;
  const alertsRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const displayName = human?.name ?? human?.email ?? human?.phone ?? "Account";

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (alertsRef.current && !alertsRef.current.contains(target)) {
        setAlertsOpen(false);
      }
      if (menuRef.current && !menuRef.current.contains(target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  async function handleLogout() {
    setMenuOpen(false);
    await logout();
    navigate("/login");
  }

  async function markAllRead() {
    await api.markNotificationsRead();
    await refreshNotifications();
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-left">
          <NavLink to="/" className="brand">
            Novellia Pets
          </NavLink>
          <nav className="nav-links" aria-label="Primary">
            <NavLink to="/" end className={({ isActive }) => (isActive ? "nav-tab active" : "nav-tab")}>
              Overview
            </NavLink>
            <NavLink
              to="/pets"
              className={({ isActive }) => (isActive ? "nav-tab active" : "nav-tab")}
            >
              Pets
            </NavLink>
          </nav>
        </div>

        <div className="topbar-right">
          <div className="notif-wrap" ref={alertsRef}>
            <button
              type="button"
              className={`icon-btn${alertsOpen ? " open" : ""}`}
              onClick={() => {
                setAlertsOpen((v) => !v);
                setMenuOpen(false);
              }}
              aria-label={unread > 0 ? `Alerts, ${unread} unread` : "Alerts"}
              aria-expanded={alertsOpen}
            >
              <BellIcon />
              {unread > 0 && <span className="badge-count">{unread}</span>}
            </button>
            {alertsOpen && (
              <div className="notif-panel">
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <strong>Notifications</strong>
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={() => void markAllRead()}
                  >
                    Mark read
                  </button>
                </div>
                {notifications.length === 0 && (
                  <p className="empty">No notifications yet.</p>
                )}
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`notif-item${!n.readAt ? " unread" : ""}`}
                  >
                    <div>{labelForNotification(n.type, n.payload)}</div>
                    <div className="muted" style={{ fontSize: "0.8rem" }}>
                      {new Date(n.createdAt).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="account-menu" ref={menuRef}>
            <button
              type="button"
              className={`account-trigger${menuOpen ? " open" : ""}`}
              onClick={() => {
                setMenuOpen((v) => !v);
                setAlertsOpen(false);
              }}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
            >
              <span className="account-name">{displayName}</span>
              <ChevronIcon open={menuOpen} />
            </button>
            {menuOpen && (
              <div className="account-dropdown" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    navigate("/families");
                  }}
                >
                  Families
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="danger-item"
                  onClick={() => void handleLogout()}
                >
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
