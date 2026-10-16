import { Schema, model, Types } from "mongoose";

export interface HumanDoc {
  _id: Types.ObjectId;
  email?: string;
  phone?: string;
  name?: string;
  adultAttestedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const humanSchema = new Schema<HumanDoc>(
  {
    email: { type: String, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    name: { type: String, trim: true },
    adultAttestedAt: { type: Date },
  },
  { timestamps: true }
);

humanSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: "string" } } }
);
humanSchema.index(
  { phone: 1 },
  { unique: true, partialFilterExpression: { phone: { $type: "string" } } }
);

export const Human = model<HumanDoc>("Human", humanSchema);
