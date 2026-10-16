import { Schema, model, Types } from "mongoose";
import type { FamilyRole } from "@novellia/shared";

export interface FamilyMembershipDoc {
  _id: Types.ObjectId;
  familyId: Types.ObjectId;
  humanId: Types.ObjectId;
  role: FamilyRole;
  createdAt: Date;
  updatedAt: Date;
}

const membershipSchema = new Schema<FamilyMembershipDoc>(
  {
    familyId: { type: Schema.Types.ObjectId, ref: "Family", required: true, index: true },
    humanId: { type: Schema.Types.ObjectId, ref: "Human", required: true, index: true },
    role: { type: String, enum: ["admin", "member"], required: true },
  },
  { timestamps: true }
);

membershipSchema.index({ familyId: 1, humanId: 1 }, { unique: true });

export const FamilyMembership = model<FamilyMembershipDoc>(
  "FamilyMembership",
  membershipSchema
);
