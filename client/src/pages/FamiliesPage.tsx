import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { FamilyMembershipDto, InviteDto } from "@novellia/shared";
import { api } from "../api";

export function FamiliesPage() {
  const [memberships, setMemberships] = useState<FamilyMembershipDto[]>([]);
  const [invites, setInvites] = useState<InviteDto[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const [m, inv] = await Promise.all([api.listFamilies(), api.myInvites()]);
      setMemberships(m);
      setInvites(inv);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div>
      <header className="page-header">
        <h1>Families</h1>
        <p>
          Households you belong to. Manage members, invites, and custody transfers here —
          pets stay conjoined on the overview with a family badge.
        </p>
      </header>

      {error && <p className="error">{error}</p>}

      {invites.length > 0 && (
        <section className="panel" style={{ marginBottom: "1.5rem" }}>
          <h2>Invitations for you</h2>
          {invites.map((inv) => (
            <div key={inv.id} className="row" style={{ justifyContent: "space-between" }}>
              <span>
                <strong>{inv.familyName}</strong>
              </span>
              <button
                type="button"
                className="btn"
                onClick={() => void api.acceptInvite(inv.id).then(load)}
              >
                Accept
              </button>
            </div>
          ))}
        </section>
      )}

      <section className="panel">
        {memberships.length === 0 ? (
          <p className="empty">No families yet.</p>
        ) : (
          memberships.map((m) => (
            <div key={m.id} className="pet-row">
              <div>
                <Link to={`/families/${m.familyId}`}>
                  <strong>{m.family?.name ?? "Family"}</strong>
                </Link>
                <div className="muted">
                  Your role: {m.role}
                  {m.family?.serialCode ? ` · ID ${m.family.serialCode}` : ""}
                </div>
              </div>
              <Link className="btn secondary" to={`/families/${m.familyId}`}>
                Open
              </Link>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
