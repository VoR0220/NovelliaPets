import { Human } from "./models/Human";
import { Family, formatFamilySerial } from "./models/Family";
import { FamilyMembership } from "./models/FamilyMembership";
import { Pet } from "./models/Pet";
import { MedicalRecord } from "./models/MedicalRecord";
import { Invite } from "./models/Invite";
import { PetTransfer } from "./models/PetTransfer";
import { Notification } from "./models/Notification";
import { OtpChallenge } from "./models/OtpChallenge";
import { Counter } from "./models/Counter";
import { FamilyMerge } from "./models/FamilyMerge";

export type SeedResult = {
  personas: {
    alex: { email: string; name: string };
    jordan: { email: string; name: string };
    sam: { phone: string; name: string };
    casey: { email: string; name: string };
    morgan: { email: string; name: string };
  };
  families: {
    alexSolo: { serialCode: string; name: string };
    shared: { serialCode: string; name: string };
    casey: { serialCode: string; name: string };
    sam: { serialCode: string; name: string };
  };
  pets: {
    maple: string;
    biscuit: string;
    nova: string;
    pepper: string;
  };
  pendingInviteTargetPhone: string;
  pendingTransferPetName: string;
};

export async function clearDatabase(): Promise<void> {
  await Promise.all([
    Human.deleteMany({}),
    Family.deleteMany({}),
    FamilyMembership.deleteMany({}),
    Pet.deleteMany({}),
    MedicalRecord.deleteMany({}),
    Invite.deleteMany({}),
    PetTransfer.deleteMany({}),
    Notification.deleteMany({}),
    OtpChallenge.deleteMany({}),
    Counter.deleteMany({}),
    FamilyMerge.deleteMany({}),
  ]);
}

/**
 * Loads the six demo scenarios used in README walkthroughs and automated tests.
 * Always wipes the current database first.
 */
export async function runSeed(): Promise<SeedResult> {
  await clearDatabase();

  const now = new Date();
  const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000);
  const daysFromNow = (n: number) => new Date(now.getTime() + n * 86400000);

  const alex = await Human.create({
    email: "alex@example.com",
    name: "Alex Rivera",
    adultAttestedAt: daysAgo(30),
  });
  const jordan = await Human.create({
    email: "jordan@example.com",
    name: "Jordan Lee",
    adultAttestedAt: daysAgo(20),
  });
  const sam = await Human.create({
    phone: "+15551234567",
    name: "Sam Okonkwo",
    adultAttestedAt: daysAgo(10),
  });
  const casey = await Human.create({
    email: "casey@example.com",
    name: "Casey Nguyen",
    adultAttestedAt: daysAgo(5),
  });
  const morgan = await Human.create({
    email: "morgan@example.com",
    name: "Morgan Ellis",
    adultAttestedAt: daysAgo(1),
  });

  // Scenario 1 — solo + overdue care
  const soloFamily = await Family.create({
    name: "Alex's Family",
    serialId: 1,
    status: "active",
  });
  await FamilyMembership.create({
    familyId: soloFamily._id,
    humanId: alex._id,
    role: "admin",
  });
  const maple = await Pet.create({
    familyId: soloFamily._id,
    name: "Maple",
    species: "Dog",
    breed: "Lab mix",
    sex: "female",
    approxAge: "4 years",
    notes: "Gentle, loves swimming",
    createdByHumanId: alex._id,
    stewardHumanId: alex._id,
  });
  await MedicalRecord.create({
    petId: maple._id,
    familyId: soloFamily._id,
    type: "vaccine",
    title: "Rabies",
    date: daysAgo(400),
    nextDueAt: daysAgo(35),
    vetName: "Greenfield Vet",
    notes: "Overdue — schedule ASAP",
    createdByHumanId: alex._id,
  });
  await MedicalRecord.create({
    petId: maple._id,
    familyId: soloFamily._id,
    type: "checkup",
    title: "Annual wellness",
    date: daysAgo(200),
    nextDueAt: daysFromNow(20),
    vetName: "Greenfield Vet",
    createdByHumanId: alex._id,
  });

  // Scenario 2 — shared household
  const sharedFamily = await Family.create({
    name: "Rivera–Lee Household",
    serialId: 2,
    status: "active",
  });
  await FamilyMembership.create({
    familyId: sharedFamily._id,
    humanId: alex._id,
    role: "admin",
  });
  await FamilyMembership.create({
    familyId: sharedFamily._id,
    humanId: jordan._id,
    role: "member",
  });
  const biscuit = await Pet.create({
    familyId: sharedFamily._id,
    name: "Biscuit",
    species: "Cat",
    breed: "Domestic shorthair",
    sex: "male",
    approxAge: "2 years",
    notes: "Indoor only",
    createdByHumanId: alex._id,
    stewardHumanId: alex._id,
  });
  const nova = await Pet.create({
    familyId: sharedFamily._id,
    name: "Nova",
    species: "Dog",
    breed: "Border Collie",
    sex: "female",
    approxAge: "6 years",
    notes: "High energy",
    createdByHumanId: alex._id,
    stewardHumanId: alex._id,
  });
  await MedicalRecord.create({
    petId: biscuit._id,
    familyId: sharedFamily._id,
    type: "medication",
    title: "Flea prevention",
    date: daysAgo(10),
    nextDueAt: daysFromNow(5),
    vetName: "City Cat Clinic",
    createdByHumanId: jordan._id,
  });
  await MedicalRecord.create({
    petId: nova._id,
    familyId: sharedFamily._id,
    type: "vaccine",
    title: "DHPP",
    date: daysAgo(90),
    nextDueAt: daysFromNow(270),
    createdByHumanId: alex._id,
  });

  // Scenario 3 — pending invite to Sam
  await Invite.create({
    familyId: sharedFamily._id,
    targetPhone: sam.phone,
    invitedByHumanId: alex._id,
    status: "pending",
    expiresAt: daysFromNow(5),
  });
  await Notification.create({
    humanId: sam._id,
    type: "invite_received",
    payload: {
      familyName: sharedFamily.name,
      familyId: sharedFamily._id.toString(),
    },
  });

  // Scenario 4 — pending transfer Nova → Casey
  const caseyFamily = await Family.create({
    name: "Casey's Family",
    serialId: 3,
    status: "active",
  });
  await FamilyMembership.create({
    familyId: caseyFamily._id,
    humanId: casey._id,
    role: "admin",
  });

  const pendingTransfer = await PetTransfer.create({
    petId: nova._id,
    fromFamilyId: sharedFamily._id,
    toFamilyId: caseyFamily._id,
    requestedByHumanId: alex._id,
    status: "pending_documentation",
    documentationUrl: "/uploads/seed-custody-stub.pdf",
    warningAcknowledgedAt: daysAgo(1),
  });
  await Notification.create({
    humanId: casey._id,
    type: "transfer_requested",
    payload: {
      transferId: pendingTransfer._id.toString(),
      petName: nova.name,
      fromFamilyName: sharedFamily.name,
      toFamilyName: caseyFamily.name,
      status: "pending_documentation",
      documentationUrl: pendingTransfer.documentationUrl,
    },
  });

  // Sam's own household (Pepper) — also has pending invite to shared
  const samFamily = await Family.create({
    name: "Sam's Family",
    serialId: 4,
    status: "active",
  });
  await Counter.findByIdAndUpdate("familySerial", { seq: 4 }, { upsert: true });
  await FamilyMembership.create({
    familyId: samFamily._id,
    humanId: sam._id,
    role: "admin",
  });
  const pepper = await Pet.create({
    familyId: samFamily._id,
    name: "Pepper",
    species: "Rabbit",
    breed: "Holland Lop",
    sex: "female",
    approxAge: "1 year",
    notes: "Needs hay daily",
    createdByHumanId: sam._id,
    stewardHumanId: sam._id,
  });

  return {
    personas: {
      alex: { email: alex.email!, name: alex.name! },
      jordan: { email: jordan.email!, name: jordan.name! },
      sam: { phone: sam.phone!, name: sam.name! },
      casey: { email: casey.email!, name: casey.name! },
      morgan: { email: morgan.email!, name: morgan.name! },
    },
    families: {
      alexSolo: {
        serialCode: formatFamilySerial(1),
        name: soloFamily.name,
      },
      shared: {
        serialCode: formatFamilySerial(2),
        name: sharedFamily.name,
      },
      casey: {
        serialCode: formatFamilySerial(3),
        name: caseyFamily.name,
      },
      sam: {
        serialCode: formatFamilySerial(4),
        name: samFamily.name,
      },
    },
    pets: {
      maple: maple._id.toString(),
      biscuit: biscuit._id.toString(),
      nova: nova._id.toString(),
      pepper: pepper._id.toString(),
    },
    pendingInviteTargetPhone: sam.phone!,
    pendingTransferPetName: nova.name,
  };
}

export function formatSeedSummary(seed: SeedResult): string {
  return `
Seed complete. Demo walkthrough (OTP prints in server console / login hint):

  Family IDs
     ${seed.families.alexSolo.serialCode}  ${seed.families.alexSolo.name}
     ${seed.families.shared.serialCode}  ${seed.families.shared.name}
     ${seed.families.casey.serialCode}  ${seed.families.casey.name}
     ${seed.families.sam.serialCode}  ${seed.families.sam.name}

  1) Care due / overdue — ${seed.personas.alex.email}
  2) Shared household member — ${seed.personas.jordan.email}
  3) Pending invite — ${seed.personas.sam.phone}
  4) Pending transfer (approve as Casey) — ${seed.personas.casey.email}
  5) Multi-family conjoined pets — ${seed.personas.alex.email}
  6) Empty start (first pet creates family) — ${seed.personas.morgan.email}

See README “Demo scenarios” for step-by-step UI walkthroughs.
`;
}
