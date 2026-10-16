import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  PET_SPECIES_OPTIONS,
  type FamilyMembershipDto,
  type MedicalRecordDto,
  type MedicalRecordType,
  type PetDto,
  type PetSex,
} from "@novellia/shared";
import { api } from "../api";
import { useAuth } from "../auth/AuthContext";
import { OverflowMenu, PanelHeader } from "../components/OverflowMenu";

type TransferTargetMode = "circle" | "contact";
type ContactChannel = "email" | "phone";

function toInputDate(iso?: string): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export function PetDetailPage() {
  const { petId } = useParams<{ petId: string }>();
  const { human } = useAuth();
  const navigate = useNavigate();

  const [pet, setPet] = useState<PetDto | null>(null);
  const [records, setRecords] = useState<MedicalRecordDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const [editingPet, setEditingPet] = useState(false);
  const [editName, setEditName] = useState("");
  const [editSpecies, setEditSpecies] = useState("");
  const [editBreed, setEditBreed] = useState("");
  const [editSex, setEditSex] = useState<PetSex>("unknown");
  const [editAge, setEditAge] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editPhotoUrl, setEditPhotoUrl] = useState("");
  const [petSaveBusy, setPetSaveBusy] = useState(false);

  const [title, setTitle] = useState("");
  const [type, setType] = useState<MedicalRecordType>("vaccine");
  const [date, setDate] = useState(toInputDate(new Date().toISOString()));
  const [nextDueAt, setNextDueAt] = useState("");
  const [vetName, setVetName] = useState("");
  const [notes, setNotes] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState<string | undefined>();

  const [addingRecord, setAddingRecord] = useState(false);
  const [addBusy, setAddBusy] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [recTitle, setRecTitle] = useState("");
  const [recType, setRecType] = useState<MedicalRecordType>("vaccine");
  const [recDate, setRecDate] = useState("");
  const [recNextDue, setRecNextDue] = useState("");
  const [recVet, setRecVet] = useState("");
  const [recNotes, setRecNotes] = useState("");
  const [recAttachment, setRecAttachment] = useState<string | undefined>();
  const [recordSaveBusy, setRecordSaveBusy] = useState(false);

  const [transferOpen, setTransferOpen] = useState(false);
  const [transferMode, setTransferMode] = useState<TransferTargetMode>("circle");
  const [circleFamilies, setCircleFamilies] = useState<FamilyMembershipDto[]>([]);
  const [toFamilySerial, setToFamilySerial] = useState("");
  const [contactChannel, setContactChannel] = useState<ContactChannel>("email");
  const [contactValue, setContactValue] = useState("");
  const [warningAck, setWarningAck] = useState(false);
  const [withDocs, setWithDocs] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [transferBusy, setTransferBusy] = useState(false);

  const isSteward = useMemo(() => {
    if (!pet || !human) return false;
    return pet.stewardHumanId === human.id;
  }, [pet, human]);

  async function load() {
    if (!petId) return;
    try {
      const [p, r] = await Promise.all([
        api.getPet(petId),
        api.listRecords(petId, {
          q: q || undefined,
          type: typeFilter || undefined,
        }),
      ]);
      setPet(p);
      setRecords(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [petId, q, typeFilter]);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 3500);
    return () => window.clearTimeout(t);
  }, [notice]);

  function openPetEditor() {
    if (!pet) return;
    setEditName(pet.name);
    setEditSpecies(pet.species);
    setEditBreed(pet.breed);
    setEditSex(pet.sex);
    setEditAge(pet.approxAge);
    setEditNotes(pet.notes ?? "");
    setEditPhotoUrl(pet.photoUrl ?? "");
    setEditingPet(true);
    setTransferOpen(false);
  }

  function resetAddForm() {
    setTitle("");
    setType("vaccine");
    setDate(toInputDate(new Date().toISOString()));
    setNextDueAt("");
    setVetName("");
    setNotes("");
    setAttachmentUrl(undefined);
  }

  function openAddRecord() {
    setEditingRecordId(null);
    resetAddForm();
    setAddingRecord(true);
  }

  function closeAddRecord() {
    setAddingRecord(false);
    resetAddForm();
  }

  function openRecordEditor(r: MedicalRecordDto) {
    setAddingRecord(false);
    setEditingRecordId(r.id);
    setRecTitle(r.title);
    setRecType(r.type);
    setRecDate(toInputDate(r.date));
    setRecNextDue(toInputDate(r.nextDueAt));
    setRecVet(r.vetName ?? "");
    setRecNotes(r.notes ?? "");
    setRecAttachment(r.attachmentUrl);
  }

  async function savePet(e: FormEvent) {
    e.preventDefault();
    if (!petId) return;
    setPetSaveBusy(true);
    setError(null);
    try {
      const updated = await api.updatePet(petId, {
        name: editName.trim(),
        species: editSpecies,
        breed: editBreed.trim(),
        sex: editSex,
        approxAge: editAge.trim(),
        notes: editNotes,
        photoUrl: editPhotoUrl || undefined,
      });
      setPet(updated);
      setEditingPet(false);
      setNotice(`Saved updates for ${updated.name}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save pet");
    } finally {
      setPetSaveBusy(false);
    }
  }

  async function saveRecord(e: FormEvent) {
    e.preventDefault();
    if (!petId || !editingRecordId) return;
    setRecordSaveBusy(true);
    setError(null);
    try {
      await api.updateRecord(petId, editingRecordId, {
        title: recTitle.trim(),
        type: recType,
        date: new Date(recDate).toISOString(),
        nextDueAt: recNextDue ? new Date(recNextDue).toISOString() : null,
        vetName: recVet || undefined,
        notes: recNotes || undefined,
        attachmentUrl: recAttachment ?? null,
      });
      setEditingRecordId(null);
      setNotice("Medical record updated.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save record");
    } finally {
      setRecordSaveBusy(false);
    }
  }

  async function addRecord(e: FormEvent) {
    e.preventDefault();
    if (!petId) return;
    setAddBusy(true);
    setError(null);
    try {
      await api.createRecord(petId, {
        title,
        type,
        date: new Date(date).toISOString(),
        nextDueAt: nextDueAt ? new Date(nextDueAt).toISOString() : undefined,
        vetName: vetName || undefined,
        notes: notes || undefined,
        attachmentUrl,
      });
      closeAddRecord();
      setNotice("Medical record added.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add record");
    } finally {
      setAddBusy(false);
    }
  }

  async function removeRecord(recordId: string) {
    if (!petId) return;
    if (!confirm("Delete this medical record?")) return;
    await api.deleteRecord(petId, recordId);
    if (editingRecordId === recordId) setEditingRecordId(null);
    setNotice("Medical record deleted.");
    await load();
  }

  async function removePet() {
    if (!petId) return;
    if (!confirm("Delete this pet and all medical records?")) return;
    await api.deletePet(petId);
    navigate("/pets");
  }

  function resetTransferForm() {
    setTransferMode("circle");
    setToFamilySerial("");
    setContactChannel("email");
    setContactValue("");
    setWarningAck(false);
    setWithDocs(false);
    setTransferError(null);
  }

  async function openTransferPanel() {
    setEditingPet(false);
    resetTransferForm();
    setTransferOpen(true);
    if (!pet) return;
    try {
      const memberships = await api.listFamilies();
      const others = memberships.filter(
        (m) =>
          m.familyId !== pet.familyId &&
          m.family &&
          m.family.status !== "merged"
      );
      setCircleFamilies(others);
      if (others.length === 0) {
        setTransferMode("contact");
      } else if (others[0]?.family?.serialCode) {
        setToFamilySerial(others[0].family.serialCode);
      }
    } catch {
      setCircleFamilies([]);
      setTransferMode("contact");
    }
  }

  function transferDestinationReady(): boolean {
    if (transferMode === "circle") return Boolean(toFamilySerial.trim());
    return Boolean(contactValue.trim());
  }

  async function requestTransfer(e: FormEvent) {
    e.preventDefault();
    if (!pet || !warningAck || !transferDestinationReady()) return;
    setTransferBusy(true);
    setTransferError(null);
    try {
      const destination =
        transferMode === "circle"
          ? { toFamilySerial: toFamilySerial.trim() }
          : contactChannel === "email"
            ? { toEmail: contactValue.trim() }
            : { toPhone: contactValue.trim() };

      await api.createTransfer(pet.familyId, {
        petId: pet.id,
        ...destination,
        warningAcknowledged: true,
        withDocumentation: withDocs,
      });
      setTransferOpen(false);
      resetTransferForm();
      setNotice(
        transferMode === "contact"
          ? "Transfer requested. If they had no household yet, one was created for them to approve."
          : "Transfer requested. The destination family admin must approve."
      );
    } catch (err) {
      setTransferError(
        err instanceof Error ? err.message : "Could not request transfer"
      );
    } finally {
      setTransferBusy(false);
    }
  }

  if (error && !pet) return <p className="error">{error}</p>;
  if (!pet) return <p className="muted">Loading…</p>;

  const petMenuActions = [
    {
      label: "Edit pet",
      onClick: openPetEditor,
    },
    ...(isSteward
      ? [
          {
            label: "Transfer…",
            onClick: () => void openTransferPanel(),
          },
          {
            label: "Delete pet",
            onClick: () => void removePet(),
            danger: true,
          },
        ]
      : []),
  ];

  return (
    <div>
      <header className="page-header pet-hero">
        <div className="pet-hero-actions">
          <OverflowMenu label="Pet actions" actions={petMenuActions} />
        </div>
        <p>
          <Link to="/pets">← Pets</Link>
        </p>
        <h1>
          {pet.name}{" "}
          <span className="family-badge">
            {pet.familyName}
            {pet.familySerialCode ? ` · ${pet.familySerialCode}` : ""}
          </span>
        </h1>
        <p>
          {pet.species} · {pet.breed} · {pet.sex} · {pet.approxAge}
        </p>
        {pet.notes && <p>{pet.notes}</p>}
        {pet.photoUrl && (
          <div className="photo-preview" style={{ marginTop: "0.75rem" }}>
            <img src={pet.photoUrl} alt={pet.name} />
          </div>
        )}
        {!isSteward && (
          <p className="muted" style={{ fontSize: "0.9rem" }}>
            You’re a household member. Only this pet’s steward can transfer or delete them.
          </p>
        )}
      </header>

      {notice && (
        <p className="toast-success" role="status" aria-live="polite">
          {notice}
        </p>
      )}
      {error && <p className="error">{error}</p>}

      {editingPet && (
        <form
          className="panel"
          onSubmit={(e) => void savePet(e)}
          style={{ marginBottom: "1.5rem", maxWidth: 560 }}
        >
          <PanelHeader
            title="Edit pet"
            actions={[{ label: "Cancel", onClick: () => setEditingPet(false) }]}
          />
          <div className="field">
            <label htmlFor="editName">Name</label>
            <input
              id="editName"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="editSpecies">Species</label>
            <select
              id="editSpecies"
              value={editSpecies}
              onChange={(e) => setEditSpecies(e.target.value)}
              required
            >
              {!PET_SPECIES_OPTIONS.includes(
                editSpecies as (typeof PET_SPECIES_OPTIONS)[number]
              ) && <option value={editSpecies}>{editSpecies}</option>}
              {PET_SPECIES_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="editBreed">Breed</label>
            <input
              id="editBreed"
              value={editBreed}
              onChange={(e) => setEditBreed(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="editSex">Sex</label>
            <select
              id="editSex"
              value={editSex}
              onChange={(e) => setEditSex(e.target.value as PetSex)}
            >
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="unknown">Unknown</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="editAge">Approx age</label>
            <input
              id="editAge"
              value={editAge}
              onChange={(e) => setEditAge(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="editPhoto">Photo</label>
            <input
              id="editPhoto"
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                void api.upload(file).then((res) => setEditPhotoUrl(res.url));
              }}
            />
            {editPhotoUrl && (
              <div className="photo-preview">
                <img src={editPhotoUrl} alt="Preview" />
              </div>
            )}
          </div>
          <div className="field">
            <label htmlFor="editNotes">Notes</label>
            <textarea
              id="editNotes"
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
            />
          </div>
          <div className="row">
            <button className="btn" type="submit" disabled={petSaveBusy}>
              {petSaveBusy ? "Saving…" : "Save changes"}
            </button>
            <button
              type="button"
              className="btn secondary"
              onClick={() => setEditingPet(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {transferOpen && (
        <form
          className="panel"
          onSubmit={(e) => void requestTransfer(e)}
          style={{ marginBottom: "1.5rem" }}
        >
          <PanelHeader
            title="Transfer pet"
            actions={[
              {
                label: "Close",
                onClick: () => {
                  setTransferOpen(false);
                  resetTransferForm();
                },
              },
            ]}
          />
          <div className="warn-box">
            This is permanent. Approving a transfer moves the pet and closes off access for
            the current family. Use only when custody has legally changed.
          </div>

          <div className="row" style={{ marginBottom: "1rem" }}>
            <button
              type="button"
              className={`btn ${transferMode === "circle" ? "" : "secondary"}`}
              onClick={() => setTransferMode("circle")}
              disabled={circleFamilies.length === 0}
            >
              Family in my circle
            </button>
            <button
              type="button"
              className={`btn ${transferMode === "contact" ? "" : "secondary"}`}
              onClick={() => setTransferMode("contact")}
            >
              Email or phone
            </button>
          </div>

          {transferMode === "circle" ? (
            <div className="field">
              <label htmlFor="circleFamily">Destination family</label>
              {circleFamilies.length === 0 ? (
                <p className="muted">
                  You’re only in this household right now. Transfer by email or phone instead
                  (e.g. morgan@example.com).
                </p>
              ) : (
                <select
                  id="circleFamily"
                  value={toFamilySerial}
                  onChange={(e) => setToFamilySerial(e.target.value)}
                  required
                >
                  {circleFamilies.map((m) => (
                    <option key={m.familyId} value={m.family?.serialCode ?? ""}>
                      {m.family?.name ?? "Family"}
                      {m.family?.serialCode ? ` · ${m.family.serialCode}` : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ) : (
            <>
              <div className="row" style={{ marginBottom: "0.75rem" }}>
                <button
                  type="button"
                  className={`btn ${contactChannel === "email" ? "" : "secondary"}`}
                  onClick={() => {
                    setContactChannel("email");
                    setContactValue("");
                  }}
                >
                  Email
                </button>
                <button
                  type="button"
                  className={`btn ${contactChannel === "phone" ? "" : "secondary"}`}
                  onClick={() => {
                    setContactChannel("phone");
                    setContactValue("");
                  }}
                >
                  Phone
                </button>
              </div>
              <div className="field">
                <label htmlFor="transferContact">
                  {contactChannel === "email" ? "Recipient email" : "Recipient phone"}
                </label>
                <input
                  id="transferContact"
                  value={contactValue}
                  onChange={(e) => setContactValue(e.target.value)}
                  placeholder={
                    contactChannel === "email"
                      ? "morgan@example.com"
                      : "+15551234567"
                  }
                  required
                  autoComplete={contactChannel === "email" ? "email" : "tel"}
                />
                <p className="muted" style={{ marginTop: "0.35rem", fontSize: "0.9rem" }}>
                  They must already have an account. Transfers go to a family admin — or, if
                  they have no household yet, we’ll create one for them.
                </p>
              </div>
            </>
          )}

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={withDocs}
              onChange={(e) => setWithDocs(e.target.checked)}
            />
            <span>Mark as needing documentation (court order / agreement stub)</span>
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={warningAck}
              onChange={(e) => setWarningAck(e.target.checked)}
              required
            />
            <span>
              I understand this transfer permanently ends access for the current family.
            </span>
          </label>
          {transferError && <p className="error">{transferError}</p>}
          <button
            className="btn"
            type="submit"
            disabled={!warningAck || !transferDestinationReady() || transferBusy}
          >
            {transferBusy ? "Requesting…" : "Request transfer"}
          </button>
        </form>
      )}

      <section className="panel" style={{ marginBottom: "1.5rem" }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
          <h2 style={{ margin: 0 }}>Medical records</h2>
          {!addingRecord && (
            <button type="button" className="btn" onClick={openAddRecord}>
              Add a Medical Record
            </button>
          )}
        </div>
        {!addingRecord && (
          <div className="filters">
            <input
              placeholder="Filter records…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="">All types</option>
              <option value="vaccine">Vaccine</option>
              <option value="medication">Medication</option>
              <option value="checkup">Checkup</option>
              <option value="procedure">Procedure</option>
              <option value="other">Other</option>
            </select>
          </div>
        )}

        {addingRecord && (
          <form className="form-box" onSubmit={(e) => void addRecord(e)}>
            <PanelHeader
              title="Add a Medical Record"
              actions={[{ label: "Cancel", onClick: closeAddRecord }]}
            />
            <div className="field">
              <label htmlFor="title">Title</label>
              <input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="type">Type</label>
              <select
                id="type"
                value={type}
                onChange={(e) => setType(e.target.value as MedicalRecordType)}
              >
                <option value="vaccine">Vaccine</option>
                <option value="medication">Medication</option>
                <option value="checkup">Checkup</option>
                <option value="procedure">Procedure</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="date">Date</label>
              <input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="next">Next due (optional)</label>
              <input
                id="next"
                type="date"
                value={nextDueAt}
                onChange={(e) => setNextDueAt(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="vet">Vet name</label>
              <input
                id="vet"
                value={vetName}
                onChange={(e) => setVetName(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="notes">Notes</label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="attach">Attachment (optional)</label>
              <input
                id="attach"
                type="file"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  void api.upload(file).then((res) => setAttachmentUrl(res.url));
                }}
              />
              {attachmentUrl && (
                <span className="muted">Uploaded: {attachmentUrl}</span>
              )}
            </div>
            <div className="row">
              <button className="btn" type="submit" disabled={addBusy}>
                {addBusy ? "Saving…" : "Save record"}
              </button>
              <button
                type="button"
                className="btn secondary"
                onClick={closeAddRecord}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {records.length === 0 && !addingRecord ? (
          <p className="empty">No records yet.</p>
        ) : (
          records.map((r) => (
            <div key={r.id} className="record-card">
              {editingRecordId === r.id ? (
                <form onSubmit={(e) => void saveRecord(e)}>
                  <PanelHeader
                    title="Edit record"
                    actions={[
                      {
                        label: "Cancel",
                        onClick: () => setEditingRecordId(null),
                      },
                    ]}
                  />
                  <div className="field">
                    <label htmlFor={`rt-${r.id}`}>Title</label>
                    <input
                      id={`rt-${r.id}`}
                      value={recTitle}
                      onChange={(e) => setRecTitle(e.target.value)}
                      required
                    />
                  </div>
                  <div className="field">
                    <label htmlFor={`rtype-${r.id}`}>Type</label>
                    <select
                      id={`rtype-${r.id}`}
                      value={recType}
                      onChange={(e) =>
                        setRecType(e.target.value as MedicalRecordType)
                      }
                    >
                      <option value="vaccine">Vaccine</option>
                      <option value="medication">Medication</option>
                      <option value="checkup">Checkup</option>
                      <option value="procedure">Procedure</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor={`rd-${r.id}`}>Date</label>
                    <input
                      id={`rd-${r.id}`}
                      type="date"
                      value={recDate}
                      onChange={(e) => setRecDate(e.target.value)}
                      required
                    />
                  </div>
                  <div className="field">
                    <label htmlFor={`rn-${r.id}`}>Next due</label>
                    <input
                      id={`rn-${r.id}`}
                      type="date"
                      value={recNextDue}
                      onChange={(e) => setRecNextDue(e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor={`rv-${r.id}`}>Vet name</label>
                    <input
                      id={`rv-${r.id}`}
                      value={recVet}
                      onChange={(e) => setRecVet(e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor={`rnotes-${r.id}`}>Notes</label>
                    <textarea
                      id={`rnotes-${r.id}`}
                      value={recNotes}
                      onChange={(e) => setRecNotes(e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor={`ra-${r.id}`}>Attachment</label>
                    <input
                      id={`ra-${r.id}`}
                      type="file"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        void api
                          .upload(file)
                          .then((res) => setRecAttachment(res.url));
                      }}
                    />
                    {recAttachment && (
                      <span className="muted">Current: {recAttachment}</span>
                    )}
                  </div>
                  <div className="row">
                    <button className="btn" type="submit" disabled={recordSaveBusy}>
                      {recordSaveBusy ? "Saving…" : "Save record"}
                    </button>
                    <button
                      type="button"
                      className="btn secondary"
                      onClick={() => setEditingRecordId(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="record-card-top">
                  <div>
                    <strong>{r.title}</strong>{" "}
                    <span className="muted">({r.type})</span>{" "}
                    {r.dueStatus && r.dueStatus !== "ok" && (
                      <span className={`due-pill ${r.dueStatus}`}>
                        {r.dueStatus.replace("_", " ")}
                      </span>
                    )}
                    <div className="muted">
                      {new Date(r.date).toLocaleDateString()}
                      {r.nextDueAt &&
                        ` · next due ${new Date(r.nextDueAt).toLocaleDateString()}`}
                      {r.vetName && ` · ${r.vetName}`}
                    </div>
                    {r.notes && <div>{r.notes}</div>}
                    {r.attachmentUrl && (
                      <div>
                        <a href={r.attachmentUrl} target="_blank" rel="noreferrer">
                          Attachment
                        </a>
                      </div>
                    )}
                  </div>
                  <OverflowMenu
                    label={`Actions for ${r.title}`}
                    actions={[
                      {
                        label: "Edit",
                        onClick: () => openRecordEditor(r),
                      },
                      {
                        label: "Delete",
                        onClick: () => void removeRecord(r.id),
                        danger: true,
                      },
                    ]}
                  />
                </div>
              )}
            </div>
          ))
        )}
      </section>
    </div>
  );
}
