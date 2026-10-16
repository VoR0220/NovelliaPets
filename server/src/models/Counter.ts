import { Schema, model } from "mongoose";

interface CounterDoc {
  _id: string;
  seq: number;
}

const counterSchema = new Schema<CounterDoc>({
  _id: { type: String, required: true },
  seq: { type: Number, required: true, default: 0 },
});

export const Counter = model<CounterDoc>("Counter", counterSchema);

export async function nextSequence(name: string): Promise<number> {
  const updated = await Counter.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  if (!updated) {
    throw new Error(`Failed to allocate sequence: ${name}`);
  }
  return updated.seq;
}
