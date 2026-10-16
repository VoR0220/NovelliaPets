import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import type {
  FamilyMembershipDto,
  FamilyMergeDto,
  InviteDto,
  PetDto,
  PetTransferDto,
} from "@novellia/shared";
import { api } from "../api";
import { useAuth } from "../auth/AuthContext";

type FamilyDetail = {
  family: {
    id: string;
    name: string;
    serialId: number;
    serialCode: string;
    status: "active" | "merged";
  };
  myRole: "admin" | "member";
  members: FamilyMembershipDto[];
  invites: InviteDto[];
  transfers: PetTransferDto[];
  merges: FamilyMergeDto[];
};

export function FamilyDetailPage() {
  const { familyId } = useParams<{ familyId: string }>();
  const { refresh } = useAuth();
  const [data, setData] = useState<FamilyDetail | null>(null);
  const [pets, setPets] = useState<PetDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePhone, setInvitePhone] = useState("");
  const [docUrl, setDocUrl] = useState("");
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);
  const [copyNotice, setCopyNotice] = useState<string | null>(null);
  const [mergeAdminEmail, setMergeAdminEmail] = useState("");
  const [mergeAck, setMergeAck] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);

  async function load() {
    if (!familyId) return;
    try {
      const [detail, allPets] = await Promise.all([
        api.getFamily(familyId),
        api.listPets(),
      ]);
      setData(detail);
      setName(detail.family.name);
      setPets(allPets.filter((p) => p.familyId === familyId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load family");
    }
  }

  useEffect(() => {
    void load();
  }, [familyId]);

  useEffect(() => {
    if (!saveNotice) return;
    const t = window.setTimeout(() => setSaveNotice(null), 4000);
    return () => window.clearTimeout(t);
  }, [saveNotice]);

  async function rename(e: FormEvent) {
    e.preventDefault();
    if (!familyId) return;
    setSavingName(true);
    setSaveNotice(null);
    try {
      const updated = await api.renameFamily(familyId, name.trim());
      setData((prev) =>
        prev
          ? {
              ...prev,
              family: { ...prev.family, name: updated.name },
            }
          : prev
      );
      setName(updated.name);
      setSaveNotice(`Saved. Family name is now “${updated.name}”.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save family name");
    } finally {
      setSavingName(false);
    }
  }

  async function invite(e: FormEvent) {
    e.preventDefault();
    if (!familyId) return;
    await api.createInvite(familyId, {
      targetEmail: inviteEmail || undefined,
      targetPhone: invitePhone || undefined,
    });
    setInviteEmail("");
    setInvitePhone("");
    await load();
  }

  async function copyFamilyId() {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.family.serialCode);
      setCopyNotice("Family ID copied — share for invites or transfers.");
      window.setTimeout(() => setCopyNotice(null), 3000);
    } catch {
      setCopyNotice("Could not copy. Select the ID and copy manually.");
    }
  }

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="muted">Loading…</p>;

  const isAdmin = data.myRole === "admin";

  return (
    <div>
      <header className="page-header">
        <p>
          <Link to="/families">← Families</Link>
        </p>
        <h1>{data.family.name}</h1>
        <p>Your role: {data.myRole}</p>
        <div className="share-id-row">
          <div>
            <div className="muted" style={{ fontSize: "0.85rem", marginBottom: "0.2rem" }}>
              Family ID (shareable)
            </div>
            <code className="family-serial">{data.family.serialCode}</code>
          </div>
          <button type="button" className="btn secondary" onClick={() => void copyFamilyId()}>
            Copy ID
          </button>
        </div>
        {copyNotice && (
          <p className="toast-success" role="status" aria-live="polite">
            {copyNotice}
          </p>
        )}
      </header>

      {isAdmin && (
        <form className="panel" onSubmit={(e) => void rename(e)} style={{ marginBottom: "1.25rem" }}>
          <h2>Rename family</h2>
          <div className="field">
            <label htmlFor="fname">Name</label>
            <input id="fname" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          {saveNotice && (
            <p className="toast-success" role="status" aria-live="polite">
              {saveNotice}
            </p>
          )}
          <button className="btn" type="submit" disabled={savingName || !name.trim()}>
            {savingName ? "Saving…" : "Save name"}
          </button>
        </form>
      )}

      <section className="panel" style={{ marginBottom: "1.25rem" }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2 style={{ margin: 0 }}>Pets in this family</h2>
          {isAdmin && (
            <Link className="btn secondary" to="/pets/new">
              Add pet
            </Link>
          )}
        </div>
        {pets.length === 0 ? (
          <p className="empty">No pets in this family yet.</p>
        ) : (
          pets.map((pet) => (
            <div key={pet.id} className="pet-row">
              <div>
                <Link to={`/pets/${pet.id}`}>
                  <strong>{pet.name}</strong>
                </Link>
                <div className="muted">
                  {pet.species} · {pet.breed} · {pet.approxAge}
                </div>
              </div>
            </div>
          ))
        )}
      </section>

      <section className="panel" style={{ marginBottom: "1.25rem" }}>
        <h2>Members</h2>
        {data.members.map((m) => (
          <div key={m.id} className="pet-row">
            <div>
              <strong>{m.human?.name ?? m.human?.email ?? m.human?.phone ?? m.humanId}</strong>
              <div className="muted">{m.role}</div>
            </div>
            {isAdmin && m.role === "member" && (
              <button
                type="button"
                className="btn secondary"
                onClick={() =>
                  void api.promoteMember(data.family.id, m.humanId).then(load)
                }
              >
                Promote to admin
              </button>
            )}
          </div>
        ))}
      </section>

      {isAdmin && (
        <form className="panel" onSubmit={(e) => void invite(e)} style={{ marginBottom: "1.25rem" }}>
          <h2>Invite by email or phone</h2>
          <div className="field">
            <label htmlFor="iemail">Email</label>
            <input
              id="iemail"
              value={inviteEmail}
              onChange={(e) => {
                setInviteEmail(e.target.value);
                if (e.target.value) setInvitePhone("");
              }}
              placeholder="person@example.com"
            />
          </div>
          <div className="field">
            <label htmlFor="iphone">Phone</label>
            <input
              id="iphone"
              value={invitePhone}
              onChange={(e) => {
                setInvitePhone(e.target.value);
                if (e.target.value) setInviteEmail("");
              }}
              placeholder="+15551234567"
            />
          </div>
          <button
            className="btn"
            type="submit"
            disabled={!inviteEmail && !invitePhone}
          >
            Send invite
          </button>
        </form>
      )}

      <section className="panel" style={{ marginBottom: "1.25rem" }}>
        <h2>Pending invites</h2>
        {data.invites.length === 0 ? (
          <p className="empty">None</p>
        ) : (
          data.invites.map((inv) => (
            <div key={inv.id} className="pet-row">
              <div>
                {inv.targetEmail ?? inv.targetPhone}
                <div className="muted">
                  Expires {new Date(inv.expiresAt).toLocaleDateString()}
                </div>
              </div>
              {isAdmin && (
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() =>
                    void api.revokeInvite(data.family.id, inv.id).then(load)
                  }
                >
                  Revoke
                </button>
              )}
            </div>
          ))
        )}
      </section>

      {isAdmin && (
        <form
          className="panel"
          style={{ marginBottom: "1.25rem" }}
          onSubmit={(e) => {
            e.preventDefault();
            if (!familyId || !mergeAck) return;
            setMergeError(null);
            void api
              .createMerge(familyId, {
                toAdminEmail: mergeAdminEmail.trim(),
                warningAcknowledged: true,
              })
              .then(() => {
                setMergeAdminEmail("");
                setMergeAck(false);
                return load();
              })
              .catch((err: unknown) => {
                setMergeError(
                  err instanceof Error ? err.message : "Could not request merge"
                );
              });
          }}
        >
          <h2>Merge into another family</h2>
          <p className="muted">
            Enter the email of an admin on the household you want to join. Pets keep their
            stewards.
          </p>
          <div className="field">
            <label htmlFor="mergeAdminEmail">Destination admin email</label>
            <input
              id="mergeAdminEmail"
              type="email"
              value={mergeAdminEmail}
              onChange={(e) => setMergeAdminEmail(e.target.value)}
              placeholder="alex@example.com"
              required
              autoComplete="email"
            />
          </div>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={mergeAck}
              onChange={(e) => setMergeAck(e.target.checked)}
              required
            />
            <span>I understand this merges households and retires this Family ID.</span>
          </label>
          {mergeError && <p className="error">{mergeError}</p>}
          <button
            className="btn"
            type="submit"
            disabled={!mergeAck || !mergeAdminEmail.trim()}
          >
            Request merge
          </button>
        </form>
      )}

      <section className="panel" style={{ marginBottom: "1.25rem" }}>
        <h2>Pending merges</h2>
        {(data.merges ?? []).length === 0 ? (
          <p className="empty">None</p>
        ) : (
          (data.merges ?? []).map((m) => {
            const isTargetAdmin = isAdmin && m.toFamilyId === data.family.id;
            return (
              <div
                key={m.id}
                style={{
                  marginBottom: "1rem",
                  paddingBottom: "1rem",
                  borderBottom: "1px solid var(--line)",
                }}
              >
                <div className="muted">
                  {m.fromFamilyName}
                  {m.fromFamilySerialCode ? ` (${m.fromFamilySerialCode})` : ""} →{" "}
                  {m.toFamilyName}
                  {m.toFamilySerialCode ? ` (${m.toFamilySerialCode})` : ""}
                </div>
                {isTargetAdmin && (
                  <>
                    <div className="warn-box">
                      Approving moves all pets into your household. Each human keeps
                      stewardship of the pets they brought.
                    </div>
                    <div className="row">
                      <button
                        type="button"
                        className="btn"
                        onClick={() =>
                          void api.decideMerge(m.id, "approved").then(async () => {
                            await refresh();
                            await load();
                          })
                        }
                      >
                        Approve merge
                      </button>
                      <button
                        type="button"
                        className="btn secondary"
                        onClick={() =>
                          void api.decideMerge(m.id, "denied").then(load)
                        }
                      >
                        Deny
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}
      </section>

      <section className="panel">
        <h2>Pending transfers</h2>
        {data.transfers.length === 0 ? (
          <p className="empty">None</p>
        ) : (
          data.transfers.map((t) => {
            const isTargetAdmin =
              isAdmin && t.toFamilyId === data.family.id;
            const isSourceAdmin =
              isAdmin && t.fromFamilyId === data.family.id;
            return (
              <div key={t.id} style={{ marginBottom: "1rem", paddingBottom: "1rem", borderBottom: "1px solid var(--line)" }}>
                <strong>{t.petName}</strong>
                <div className="muted">
                  {t.fromFamilyName}
                  {t.fromFamilySerialCode ? ` (${t.fromFamilySerialCode})` : ""} →{" "}
                  {t.toFamilyName}
                  {t.toFamilySerialCode ? ` (${t.toFamilySerialCode})` : ""} ·{" "}
                  {t.status.replace("_", " ")}
                </div>
                {t.documentationUrl && (
                  <div>
                    Docs: <a href={t.documentationUrl}>{t.documentationUrl}</a>
                  </div>
                )}
                {isTargetAdmin && (
                  <div className="warn-box">
                    Approving permanently moves this pet into your family and closes access
                    for {t.fromFamilyName}.
                  </div>
                )}
                <div className="row">
                  {isTargetAdmin && (
                    <>
                      <button
                        type="button"
                        className="btn"
                        onClick={() =>
                          void api.decideTransfer(t.id, "approved").then(load)
                        }
                      >
                        Approve transfer
                      </button>
                      <button
                        type="button"
                        className="btn secondary"
                        onClick={() =>
                          void api.decideTransfer(t.id, "denied").then(load)
                        }
                      >
                        Deny
                      </button>
                    </>
                  )}
                  {isSourceAdmin && (
                    <form
                      className="row"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void api.attachTransferDoc(t.id, docUrl).then(() => {
                          setDocUrl("");
                          return load();
                        });
                      }}
                    >
                      <input
                        placeholder="/uploads/… or URL"
                        value={docUrl}
                        onChange={(e) => setDocUrl(e.target.value)}
                      />
                      <button className="btn secondary" type="submit">
                        Attach documentation URL
                      </button>
                    </form>
                  )}
                </div>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}
