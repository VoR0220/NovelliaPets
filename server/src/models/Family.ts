import { Schema, model, Types } from "mongoose";

export type FamilyStatus = "active" | "merged";

export interface FamilyDoc {
  _id: Types.ObjectId;
  name: string;
  /** Ordered public ID for sharing / transfers (dedupes common surnames) */
  serialId: number;
  status: FamilyStatus;
  /** Set when this family was merged into another */
  mergedIntoFamilyId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const familySchema = new Schema<FamilyDoc>(
  {
    name: { type: String, required: true, trim: true },
    serialId: { type: Number, required: true, unique: true, index: true },
    status: { type: String, enum: ["active", "merged"], default: "active", index: true },
    mergedIntoFamilyId: { type: Schema.Types.ObjectId, ref: "Family" },
  },
  { timestamps: true }
);

export const Family = model<FamilyDoc>("Family", familySchema);

/** Human-shareable form, e.g. NP-000042 */
export function formatFamilySerial(serialId: number): string {
  return `NP-${String(serialId).padStart(6, "0")}`;
}

export function parseFamilySerialInput(raw: string): number | null {
  const trimmed = raw.trim().toUpperCase();
  const match = trimmed.match(/^(?:NP-)?0*([1-9]\d*)$/);
  if (!match?.[1]) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}
