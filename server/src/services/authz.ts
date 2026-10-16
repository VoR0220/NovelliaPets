import { Types } from "mongoose";
import type { FamilyRole } from "@novellia/shared";
import { FamilyMembership } from "../models/FamilyMembership";
import type { PetDoc } from "../models/Pet";

export async function getMembership(
  humanId: string,
  familyId: string
): Promise<{ role: FamilyRole } | null> {
  const membership = await FamilyMembership.findOne({
    humanId: new Types.ObjectId(humanId),
    familyId: new Types.ObjectId(familyId),
  });
  if (!membership) return null;
  return { role: membership.role };
}

export async function requireMembership(
  humanId: string,
  familyId: string,
  minRole: FamilyRole = "member"
): Promise<{ role: FamilyRole }> {
  const membership = await getMembership(humanId, familyId);
  if (!membership) {
    const err = new Error("Not a member of this family") as Error & { status: number };
    err.status = 403;
    throw err;
  }
  if (minRole === "admin" && membership.role !== "admin") {
    const err = new Error("Admin role required") as Error & { status: number };
    err.status = 403;
    throw err;
  }
  return membership;
}

export async function getFamilyIdsForHuman(humanId: string): Promise<string[]> {
  const { Family } = await import("../models/Family");
  const memberships = await FamilyMembership.find({
    humanId: new Types.ObjectId(humanId),
  });
  const ids = memberships.map((m) => m.familyId);
  if (ids.length === 0) return [];
  const active = await Family.find({
    _id: { $in: ids },
    status: { $ne: "merged" },
  });
  return active.map((f) => f._id.toString());
}

/** Create a new active family and make human admin */
export async function createFamilyForHuman(
  humanId: string,
  name: string
): Promise<{ familyId: string; serialId: number }> {
  const { Family } = await import("../models/Family");
  const { nextSequence } = await import("../models/Counter");
  const serialId = await nextSequence("familySerial");
  const family = await Family.create({
    name: name.trim() || "My Family",
    serialId,
    status: "active",
  });
  await FamilyMembership.create({
    familyId: family._id,
    humanId,
    role: "admin",
  });
  return { familyId: family._id.toString(), serialId };
}

export function requirePetSteward(pet: PetDoc, humanId: string): void {
  if (pet.stewardHumanId.toString() !== humanId) {
    const err = new Error(
      "Only the pet’s steward can transfer or delete this pet"
    ) as Error & { status: number };
    err.status = 403;
    throw err;
  }
}
