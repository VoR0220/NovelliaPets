import { Schema, model, Types } from "mongoose";
import type { MedicalRecordType } from "@novellia/shared";

export interface MedicalRecordDoc {
  _id: Types.ObjectId;
  petId: Types.ObjectId;
  familyId: Types.ObjectId;
  type: MedicalRecordType;
  title: string;
  date: Date;
  nextDueAt?: Date;
  vetName?: string;
  notes?: string;
  attachmentUrl?: string;
  createdByHumanId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const medicalRecordSchema = new Schema<MedicalRecordDoc>(
  {
    petId: { type: Schema.Types.ObjectId, ref: "Pet", required: true, index: true },
    familyId: { type: Schema.Types.ObjectId, ref: "Family", required: true, index: true },
    type: {
      type: String,
      enum: ["vaccine", "medication", "checkup", "procedure", "other"],
      required: true,
    },
    title: { type: String, required: true, trim: true },
    date: { type: Date, required: true },
    nextDueAt: { type: Date },
    vetName: { type: String, trim: true },
    notes: { type: String },
    attachmentUrl: { type: String },
    createdByHumanId: { type: Schema.Types.ObjectId, ref: "Human", required: true },
  },
  { timestamps: true }
);

medicalRecordSchema.index({ petId: 1, nextDueAt: 1 });
medicalRecordSchema.index({ familyId: 1, nextDueAt: 1 });

export const MedicalRecord = model<MedicalRecordDoc>("MedicalRecord", medicalRecordSchema);
