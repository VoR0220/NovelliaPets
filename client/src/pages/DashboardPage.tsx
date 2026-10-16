import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { DashboardResponse, InviteDto } from "@novellia/shared";
import { api } from "../api";

export function DashboardPage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [invites, setInvites] = useState<InviteDto[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const [dash, mine] = await Promise.all([api.dashboard(), api.myInvites()]);
      setData(dash);
      setInvites(mine);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function accept(inviteId: string) {
    await api.acceptInvite(inviteId);
    await load();
  }

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="muted">Loading overview…</p>;

  const emptyHousehold = data.familyCount === 0 && data.pets.length === 0;

  return (
    <div>
      <header className="page-header">
        <h1>Your animals, at a glance</h1>
        <p>
          {emptyHousehold
            ? "You’re signed in. Add a pet to create a household, or accept an invite."
            : `Care due across ${data.familyCount} ${
                data.familyCount === 1 ? "family" : "families"
              } — ${data.pets.length} pets in view.`}
        </p>
      </header>

      {emptyHousehold && invites.length === 0 && (
        <section className="panel" style={{ marginBottom: "1.5rem" }}>
          <h2>Get started</h2>
          <p className="muted">
            Families are created when you add a pet — no empty households. Or wait for an
            invite from someone else’s Family ID.
          </p>
          <Link className="btn" to="/pets/new">
            Add your first pet
          </Link>
        </section>
      )}

      {invites.length > 0 && (
        <section className="panel" style={{ marginBottom: "1.5rem" }}>
          <h2>Pending invitations</h2>
          <div className="stack">
            {invites.map((inv) => (
              <div key={inv.id} className="row" style={{ justifyContent: "space-between" }}>
                <span>
                  Join <strong>{inv.familyName}</strong> (
                  {inv.targetEmail ?? inv.targetPhone})
                </span>
                <button className="btn" type="button" onClick={() => void accept(inv.id)}>
                  Accept
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="grid" style={{ marginBottom: "2rem" }}>
        <div className="panel">
          <h2>Overdue</h2>
          {data.care.overdue.length === 0 ? (
            <p className="empty">Nothing overdue. Quiet day.</p>
          ) : (
            <ul style={{ paddingLeft: "1.1rem", margin: 0 }}>
              {data.care.overdue.map((r) => (
                <li key={r.id} style={{ marginBottom: "0.5rem" }}>
                  <Link to={`/pets/${r.petId}`}>{r.title}</Link>{" "}
                  <span className="due-pill overdue">overdue</span>
                  <div className="muted" style={{ fontSize: "0.85rem" }}>
                    Due {r.nextDueAt ? new Date(r.nextDueAt).toLocaleDateString() : "—"}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="panel">
          <h2>Due soon</h2>
          {data.care.dueSoon.length === 0 ? (
            <p className="empty">No upcoming care in the next two weeks.</p>
          ) : (
            <ul style={{ paddingLeft: "1.1rem", margin: 0 }}>
              {data.care.dueSoon.map((r) => (
                <li key={r.id} style={{ marginBottom: "0.5rem" }}>
                  <Link to={`/pets/${r.petId}`}>{r.title}</Link>{" "}
                  <span className="due-pill due_soon">due soon</span>
                  <div className="muted" style={{ fontSize: "0.85rem" }}>
                    Due {r.nextDueAt ? new Date(r.nextDueAt).toLocaleDateString() : "—"}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="row" style={{ justifyContent: "space-between", marginBottom: "0.5rem" }}>
          <h2 style={{ margin: 0 }}>All pets</h2>
          <Link to="/pets">Browse & filter</Link>
        </div>
        {data.pets.length === 0 ? (
          <p className="empty">No pets yet. An admin can add one from Pets.</p>
        ) : (
          data.pets.map((pet) => (
            <div key={pet.id} className="pet-row">
              <div>
                <Link to={`/pets/${pet.id}`}>
                  <strong>{pet.name}</strong>
                </Link>{" "}
                <span className="family-badge">
                  {pet.familyName}
                  {pet.familySerialCode ? ` · ${pet.familySerialCode}` : ""}
                </span>
                <div className="muted">
                  {pet.species} · {pet.breed} · {pet.approxAge}
                </div>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
