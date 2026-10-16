import { Family } from "../models/Family";
import { FamilyMembership } from "../models/FamilyMembership";
import { Human, type HumanDoc } from "../models/Human";
import { createFamilyForHuman } from "./authz";

export type ResolvedTransferDestination = {
  toFamily: InstanceType<typeof Family>;
  toHuman: HumanDoc | null;
  createdFamily: boolean;
};

function householdNameFor(human: HumanDoc): string {
  const raw = human.name?.trim();
  if (!raw) return "New Family";
  const first = raw.split(/\s+/)[0];
  return `${first}'s Family`;
}

/**
 * Resolve a destination family for a transfer addressed to a human.
 * - Prefer an active family they admin (other than the source).
 * - If they have no household yet, create one (they become admin).
 * - If they only have member (non-admin) roles elsewhere, reject.
 */
export async function resolveFamilyForHuman(
  human: HumanDoc,
  sourceFamilyId: string
): Promise<{ family: InstanceType<typeof Family>; createdFamily: boolean }> {
  const memberships = await FamilyMembership.find({ humanId: human._id });

  if (memberships.length === 0) {
    const created = await createFamilyForHuman(
      human._id.toString(),
      householdNameFor(human)
    );
    const family = await Family.findById(created.familyId);
    if (!family) {
      throw Object.assign(new Error("Failed to create destination family"), {
        status: 500,
      });
    }
    return { family, createdFamily: true };
  }

  const familyIds = memberships.map((m) => m.familyId);
  const families = await Family.find({
    _id: { $in: familyIds },
    status: "active",
  });
  const roleByFamily = new Map(
    memberships.map((m) => [m.familyId.toString(), m.role])
  );

  const adminFamilies = families
    .filter(
      (f) =>
        f._id.toString() !== sourceFamilyId &&
        roleByFamily.get(f._id.toString()) === "admin"
    )
    .sort((a, b) => a.serialId - b.serialId);

  if (adminFamilies[0]) {
    return { family: adminFamilies[0], createdFamily: false };
  }

  const onlySourceAdmin =
    families.length === 1 &&
    families[0]!._id.toString() === sourceFamilyId &&
    roleByFamily.get(sourceFamilyId) === "admin";

  if (onlySourceAdmin) {
    throw Object.assign(
      new Error(
        "That person is only an admin of this household — pick someone who admins a different family"
      ),
      { status: 400 }
    );
  }

  throw Object.assign(
    new Error(
      "That person is not a family admin. Transfers go to an admin’s household (or someone with no household yet)."
    ),
    { status: 400 }
  );
}

export async function resolveTransferDestination(input: {
  sourceFamilyId: string;
  requesterHumanId: string;
  toFamilySerial?: string;
  toEmail?: string;
  toPhone?: string;
}): Promise<ResolvedTransferDestination> {
  const { parseFamilySerialInput } = await import("../models/Family");

  if (input.toFamilySerial) {
    const serial = parseFamilySerialInput(input.toFamilySerial);
    if (serial === null) {
      throw Object.assign(
        new Error("Invalid family ID. Use a code like NP-000042"),
        { status: 400 }
      );
    }
    const toFamily = await Family.findOne({
      serialId: serial,
      status: "active",
    });
    if (!toFamily) {
      throw Object.assign(new Error("No family found with that ID"), {
        status: 404,
      });
    }
    if (toFamily._id.toString() === input.sourceFamilyId) {
      throw Object.assign(
        new Error("Source and target family must differ"),
        { status: 400 }
      );
    }
    return { toFamily, toHuman: null, createdFamily: false };
  }

  const email = input.toEmail?.trim().toLowerCase();
  const phone = input.toPhone?.trim();
  if (!email && !phone) {
    throw Object.assign(
      new Error("Provide a family in your circle, or an email / phone"),
      { status: 400 }
    );
  }

  const human = email
    ? await Human.findOne({ email })
    : await Human.findOne({ phone });

  if (!human) {
    throw Object.assign(
      new Error(
        "No account found for that email or phone. They need to sign up first."
      ),
      { status: 404 }
    );
  }

  if (human._id.toString() === input.requesterHumanId) {
    throw Object.assign(new Error("You cannot transfer a pet to yourself"), {
      status: 400,
    });
  }

  const { family, createdFamily } = await resolveFamilyForHuman(
    human,
    input.sourceFamilyId
  );

  if (family._id.toString() === input.sourceFamilyId) {
    throw Object.assign(
      new Error("Source and target family must differ"),
      { status: 400 }
    );
  }

  return { toFamily: family, toHuman: human, createdFamily };
}
