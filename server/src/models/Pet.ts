import { Schema, model, Types } from "mongoose";
import type { PetSex } from "@novellia/shared";

export interface PetDoc {
  _id: Types.ObjectId;
  familyId: Types.ObjectId;
  name: string;
  species: string;
  breed: string;
  sex: PetSex;
  approxAge: string;
  photoUrl?: string;
  notes: string;
  createdByHumanId: Types.ObjectId;
  /** Human who may transfer/delete this pet (survives family merges) */
  stewardHumanId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const petSchema = new Schema<PetDoc>(
  {
    familyId: { type: Schema.Types.ObjectId, ref: "Family", required: true, index: true },
    name: { type: String, required: true, trim: true },
    species: { type: String, required: true, trim: true },
    breed: { type: String, required: true, trim: true },
    sex: { type: String, enum: ["male", "female", "unknown"], required: true },
    approxAge: { type: String, required: true, trim: true },
    photoUrl: { type: String },
    notes: { type: String, default: "" },
    createdByHumanId: { type: Schema.Types.ObjectId, ref: "Human", required: true },
    stewardHumanId: { type: Schema.Types.ObjectId, ref: "Human", required: true, index: true },
  },
  { timestamps: true }
);

export const Pet = model<PetDoc>("Pet", petSchema);
