import { Schema, model, Types } from "mongoose";
import type { InviteStatus } from "@novellia/shared";

export interface InviteDoc {
  _id: Types.ObjectId;
  familyId: Types.ObjectId;
  targetEmail?: string;
  targetPhone?: string;
  invitedByHumanId: Types.ObjectId;
  status: InviteStatus;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const inviteSchema = new Schema<InviteDoc>(
  {
    familyId: { type: Schema.Types.ObjectId, ref: "Family", required: true, index: true },
    targetEmail: { type: String, lowercase: true, trim: true },
    targetPhone: { type: String, trim: true },
    invitedByHumanId: { type: Schema.Types.ObjectId, ref: "Human", required: true },
    status: {
      type: String,
      enum: ["pending", "accepted", "revoked", "expired"],
      default: "pending",
    },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

export const Invite = model<InviteDoc>("Invite", inviteSchema);
