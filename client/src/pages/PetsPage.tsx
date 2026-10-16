import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PET_SPECIES_OPTIONS, type PetDto } from "@novellia/shared";
import { api } from "../api";
import { useAuth } from "../auth/AuthContext";

export function PetsPage() {
  const { memberships } = useAuth();
  const [pets, setPets] = useState<PetDto[]>([]);
  const [q, setQ] = useState("");
  const [species, setSpecies] = useState("");
  const [familyId, setFamilyId] = useState("");
  const [dueStatus, setDueStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Anyone signed in can add a pet (creates a family if they don't have one yet)
  const canAdd = true;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const list = await api.listPets({
          q: q || undefined,
          species: species || undefined,
          dueStatus: dueStatus || undefined,
        });
        if (cancelled) return;
        const filtered = familyId
          ? list.filter((p) => p.familyId === familyId)
          : list;
        setPets(filtered);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load pets");
          setPets([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [q, species, dueStatus, familyId]);

  return (
    <div>
      <header className="page-header">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <h1>Pets</h1>
            <p>Every animal across the families you belong to.</p>
          </div>
          {canAdd && (
            <Link className="btn" to="/pets/new">
              Add pet
            </Link>
          )}
        </div>
      </header>

      <div className="filters">
        <input
          placeholder="Search name, breed, family…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select value={species} onChange={(e) => setSpecies(e.target.value)}>
          <option value="">All species</option>
          {PET_SPECIES_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <select value={familyId} onChange={(e) => setFamilyId(e.target.value)}>
          <option value="">All families</option>
          {memberships.map((m) => (
            <option key={m.familyId} value={m.familyId}>
              {m.family?.name ?? "Family"}
              {m.family?.serialCode ? ` (${m.family.serialCode})` : ""}
            </option>
          ))}
        </select>
        <select value={dueStatus} onChange={(e) => setDueStatus(e.target.value)}>
          <option value="">Any care status</option>
          <option value="overdue">Overdue</option>
          <option value="due_soon">Due soon</option>
          <option value="ok">Up to date</option>
        </select>
      </div>

      {error && <p className="error">{error}</p>}

      <section className="panel">
        {loading ? (
          <p className="muted">Loading pets…</p>
        ) : pets.length === 0 ? (
          <div className="empty">
            <p>No pets match these filters.</p>
            {canAdd && (
              <p>
                <Link to="/pets/new">Add a pet</Link> to one of your families, or clear
                the filters above.
              </p>
            )}
          </div>
        ) : (
          pets.map((pet) => (
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
                  {pet.species} · {pet.breed} · {pet.sex} · {pet.approxAge}
                </div>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
