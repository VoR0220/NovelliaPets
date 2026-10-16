import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PET_SPECIES_OPTIONS, type PetSex } from "@novellia/shared";
import { api } from "../api";
import { useAuth } from "../auth/AuthContext";

export function NewPetPage() {
  const { memberships, human, refresh } = useAuth();
  const navigate = useNavigate();
  const adminFamilies = memberships.filter(
    (m) => m.role === "admin" && m.family && m.family.status !== "merged"
  );

  const [mode, setMode] = useState<"existing" | "new">(
    adminFamilies.length > 0 ? "existing" : "new"
  );
  const [familyId, setFamilyId] = useState(adminFamilies[0]?.familyId ?? "");
  const [newFamilyName, setNewFamilyName] = useState(
    human?.name ? `${human.name.split(" ").slice(-1)[0]} Family` : ""
  );
  const [name, setName] = useState("");
  const [species, setSpecies] = useState<string>(PET_SPECIES_OPTIONS[0]);
  const [breed, setBreed] = useState("");
  const [sex, setSex] = useState<PetSex>("unknown");
  const [approxAge, setApproxAge] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onPhotoChange(file: File | undefined) {
    if (!file) {
      setPhotoUrl("");
      return;
    }
    setUploadingPhoto(true);
    setError(null);
    try {
      const res = await api.upload(file);
      setPhotoUrl(res.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Photo upload failed");
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const pet = await api.createPet({
        ...(mode === "new"
          ? { newFamilyName: newFamilyName.trim() }
          : { familyId }),
        name,
        species,
        breed,
        sex,
        approxAge,
        photoUrl: photoUrl || undefined,
        notes,
      });
      await refresh();
      navigate(`/pets/${pet.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create pet");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <header className="page-header">
        <h1>Add a pet</h1>
        <p>
          {adminFamilies.length === 0
            ? "Adding your first pet creates a family household for them."
            : "Add to a family you admin, or start a new household."}
        </p>
      </header>
      <form className="panel" onSubmit={(e) => void onSubmit(e)} style={{ maxWidth: 520 }}>
        {adminFamilies.length > 0 && (
          <div className="row" style={{ marginBottom: "1rem" }}>
            <button
              type="button"
              className={`btn ${mode === "existing" ? "" : "secondary"}`}
              onClick={() => setMode("existing")}
            >
              Existing family
            </button>
            <button
              type="button"
              className={`btn ${mode === "new" ? "" : "secondary"}`}
              onClick={() => setMode("new")}
            >
              New family
            </button>
          </div>
        )}

        {mode === "existing" && adminFamilies.length > 0 ? (
          <div className="field">
            <label htmlFor="family">Family</label>
            <select
              id="family"
              value={familyId}
              onChange={(e) => setFamilyId(e.target.value)}
              required
            >
              {adminFamilies.map((m) => (
                <option key={m.familyId} value={m.familyId}>
                  {m.family?.name}
                  {m.family?.serialCode ? ` (${m.family.serialCode})` : ""}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="field">
            <label htmlFor="newFamily">New family name</label>
            <input
              id="newFamily"
              value={newFamilyName}
              onChange={(e) => setNewFamilyName(e.target.value)}
              placeholder="e.g. Rivera Family"
              required
            />
          </div>
        )}

        <div className="field">
          <label htmlFor="name">Name</label>
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="species">Species</label>
          <select
            id="species"
            value={species}
            onChange={(e) => setSpecies(e.target.value)}
            required
          >
            {PET_SPECIES_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="breed">Breed</label>
          <input id="breed" value={breed} onChange={(e) => setBreed(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="sex">Sex</label>
          <select id="sex" value={sex} onChange={(e) => setSex(e.target.value as PetSex)}>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="unknown">Unknown</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="age">Approx age</label>
          <input
            id="age"
            value={approxAge}
            onChange={(e) => setApproxAge(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="photo">Photo (optional)</label>
          <input
            id="photo"
            type="file"
            accept="image/*"
            onChange={(e) => void onPhotoChange(e.target.files?.[0])}
          />
          {uploadingPhoto && <span className="muted">Uploading…</span>}
          {photoUrl && !uploadingPhoto && (
            <div className="photo-preview">
              <img src={photoUrl} alt="Pet preview" />
              <span className="muted">Uploaded</span>
            </div>
          )}
        </div>
        <div className="field">
          <label htmlFor="notes">Notes</label>
          <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        {error && <p className="error">{error}</p>}
        <div className="row">
          <button className="btn" type="submit" disabled={busy || uploadingPhoto}>
            {busy ? "Saving…" : "Save pet"}
          </button>
          <Link className="btn secondary" to="/pets">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
