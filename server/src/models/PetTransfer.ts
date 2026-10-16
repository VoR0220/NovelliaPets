import { Schema, model, Types } from "mongoose";
import type { TransferStatus } from "@novellia/shared";

export interface PetTransferDoc {
  _id: Types.ObjectId;
  petId: Types.ObjectId;
  fromFamilyId: Types.ObjectId;
  toFamilyId: Types.ObjectId;
  requestedByHumanId: Types.ObjectId;
  /** Set when transfer was addressed to a specific human via email/phone */
  toHumanId?: Types.ObjectId;
  status: TransferStatus;
  documentationUrl?: string;
  warningAcknowledgedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const transferSchema = new Schema<PetTransferDoc>(
  {
    petId: { type: Schema.Types.ObjectId, ref: "Pet", required: true, index: true },
    fromFamilyId: { type: Schema.Types.ObjectId, ref: "Family", required: true },
    toFamilyId: { type: Schema.Types.ObjectId, ref: "Family", required: true },
    requestedByHumanId: { type: Schema.Types.ObjectId, ref: "Human", required: true },
    toHumanId: { type: Schema.Types.ObjectId, ref: "Human" },
    status: {
      type: String,
      enum: ["requested", "pending_documentation", "approved", "denied"],
      default: "requested",
    },
    documentationUrl: { type: String },
    warningAcknowledgedAt: { type: Date },
  },
  { timestamps: true }
);

export const PetTransfer = model<PetTransferDoc>("PetTransfer", transferSchema);
