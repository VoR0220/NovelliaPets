import { Schema, model, Types } from "mongoose";
import type { OtpChannel } from "@novellia/shared";

export interface OtpChallengeDoc {
  _id: Types.ObjectId;
  destination: string;
  channel: OtpChannel;
  codeHash: string;
  expiresAt: Date;
  consumedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const otpSchema = new Schema<OtpChallengeDoc>(
  {
    destination: { type: String, required: true, index: true },
    channel: { type: String, enum: ["email", "phone"], required: true },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    consumedAt: { type: Date },
  },
  { timestamps: true }
);

otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const OtpChallenge = model<OtpChallengeDoc>("OtpChallenge", otpSchema);
