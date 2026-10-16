import { Schema, model, Types } from "mongoose";

export type MergeStatus = "requested" | "approved" | "denied";

export interface FamilyMergeDoc {
  _id: Types.ObjectId;
  fromFamilyId: Types.ObjectId;
  toFamilyId: Types.ObjectId;
  requestedByHumanId: Types.ObjectId;
  status: MergeStatus;
  warningAcknowledgedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const mergeSchema = new Schema<FamilyMergeDoc>(
  {
    fromFamilyId: { type: Schema.Types.ObjectId, ref: "Family", required: true, index: true },
    toFamilyId: { type: Schema.Types.ObjectId, ref: "Family", required: true, index: true },
    requestedByHumanId: { type: Schema.Types.ObjectId, ref: "Human", required: true },
    status: {
      type: String,
      enum: ["requested", "approved", "denied"],
      default: "requested",
    },
    warningAcknowledgedAt: { type: Date },
  },
  { timestamps: true }
);

export const FamilyMerge = model<FamilyMergeDoc>("FamilyMerge", mergeSchema);
