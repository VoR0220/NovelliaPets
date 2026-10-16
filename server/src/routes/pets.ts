import { Router } from "express";
import { Types } from "mongoose";
import { z } from "zod";
import { computeDueStatus } from "@novellia/shared";
import { requireAuth, type AuthedRequest } from "../middleware/auth";
import { asyncHandler } from "../middleware/error";
import {
  createFamilyForHuman,
  getFamilyIdsForHuman,
  requireMembership,
  requirePetSteward,
} from "../services/authz";
import { Pet } from "../models/Pet";
import { Family } from "../models/Family";
import { MedicalRecord } from "../models/MedicalRecord";
import { toPetDto, toMedicalRecordDto } from "../utils/mappers";

const router = Router();
router.use(requireAuth);

const petBodySchema = z
  .object({
    familyId: z.string().min(1).optional(),
    newFamilyName: z.string().min(1).max(80).optional(),
    name: z.string().min(1).max(80),
    species: z.string().min(1).max(80),
    breed: z.string().min(1).max(80),
    sex: z.enum(["male", "female", "unknown"]),
    approxAge: z.string().min(1).max(40),
    photoUrl: z.string().optional(),
    notes: z.string().max(2000).optional(),
  })
  .refine((v) => Boolean(v.familyId) !== Boolean(v.newFamilyName) || (v.familyId && !v.newFamilyName) || (!v.familyId && v.newFamilyName), {
    message: "Provide either familyId or newFamilyName",
  })
  .refine((v) => Boolean(v.familyId) || Boolean(v.newFamilyName), {
    message: "Provide familyId or newFamilyName",
  });

const petUpdateSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  species: z.string().min(1).max(80).optional(),
  breed: z.string().min(1).max(80).optional(),
  sex: z.enum(["male", "female", "unknown"]).optional(),
  approxAge: z.string().min(1).max(40).optional(),
  photoUrl: z.string().optional(),
  notes: z.string().max(2000).optional(),
});

async function familyMetaMap(
  familyIds: string[]
): Promise<Map<string, { name: string; serialCode: string }>> {
  const { formatFamilySerial } = await import("../models/Family");
  const families = await Family.find({
    _id: { $in: familyIds.map((id) => new Types.ObjectId(id)) },
  });
  return new Map(
    families.map((f) => [
      f._id.toString(),
      { name: f.name, serialCode: formatFamilySerial(f.serialId) },
    ])
  );
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { humanId } = req as AuthedRequest;
    const familyIds = await getFamilyIdsForHuman(humanId);
    const q = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
    const species =
      typeof req.query.species === "string" ? req.query.species.trim().toLowerCase() : "";
    const dueStatus =
      typeof req.query.dueStatus === "string" ? req.query.dueStatus : undefined;

    const pets = await Pet.find({
      familyId: { $in: familyIds.map((id) => new Types.ObjectId(id)) },
    }).sort({ name: 1 });

    const meta = await familyMetaMap(familyIds);
    let result = pets.map((p) => {
      const m = meta.get(p.familyId.toString());
      return toPetDto(p, m?.name, m?.serialCode);
    });

    if (q) {
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.species.toLowerCase().includes(q) ||
          p.breed.toLowerCase().includes(q) ||
          (p.familyName?.toLowerCase().includes(q) ?? false) ||
          (p.familySerialCode?.toLowerCase().includes(q) ?? false)
      );
    }
    if (species) {
      // Exact match on selected species (UI sends full option label)
      result = result.filter((p) => p.species.toLowerCase() === species);
    }

    if (dueStatus === "overdue" || dueStatus === "due_soon" || dueStatus === "ok") {
      const records = await MedicalRecord.find({
        petId: { $in: pets.map((p) => p._id) },
        nextDueAt: { $exists: true },
      });
      const petIdsMatching = new Set<string>();
      for (const r of records) {
        const status = computeDueStatus(r.nextDueAt);
        if (status === dueStatus) {
          petIdsMatching.add(r.petId.toString());
        }
      }
      // For "ok", include pets with no due records or all ok
      if (dueStatus === "ok") {
        const hasOverdueOrSoon = new Set<string>();
        for (const r of records) {
          const status = computeDueStatus(r.nextDueAt);
          if (status === "overdue" || status === "due_soon") {
            hasOverdueOrSoon.add(r.petId.toString());
          }
        }
        result = result.filter((p) => !hasOverdueOrSoon.has(p.id));
      } else {
        result = result.filter((p) => petIdsMatching.has(p.id));
      }
    }

    res.json(result);
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { humanId } = req as AuthedRequest;
    const body = petBodySchema.parse(req.body);

    let familyId: string;
    if (body.newFamilyName) {
      const created = await createFamilyForHuman(humanId, body.newFamilyName);
      familyId = created.familyId;
    } else {
      familyId = body.familyId!;
      await requireMembership(humanId, familyId, "admin");
      const existing = await Family.findById(familyId);
      if (!existing || existing.status === "merged") {
        res.status(400).json({ error: "Family is not available" });
        return;
      }
    }

    const pet = await Pet.create({
      familyId,
      name: body.name,
      species: body.species,
      breed: body.breed,
      sex: body.sex,
      approxAge: body.approxAge,
      photoUrl: body.photoUrl || undefined,
      notes: body.notes ?? "",
      createdByHumanId: humanId,
      stewardHumanId: humanId,
    });

    const family = await Family.findById(familyId);
    const { formatFamilySerial } = await import("../models/Family");
    res
      .status(201)
      .json(
        toPetDto(
          pet,
          family?.name,
          family ? formatFamilySerial(family.serialId) : undefined
        )
      );
  })
);

router.get(
  "/:petId",
  asyncHandler(async (req, res) => {
    const { humanId } = req as AuthedRequest;
    const pet = await Pet.findById(req.params.petId);
    if (!pet) {
      res.status(404).json({ error: "Pet not found" });
      return;
    }
    await requireMembership(humanId, pet.familyId.toString(), "member");
    const family = await Family.findById(pet.familyId);
    const { formatFamilySerial } = await import("../models/Family");
    res.json(
      toPetDto(
        pet,
        family?.name,
        family ? formatFamilySerial(family.serialId) : undefined
      )
    );
  })
);

router.patch(
  "/:petId",
  asyncHandler(async (req, res) => {
    const { humanId } = req as AuthedRequest;
    const body = petUpdateSchema.parse(req.body);
    const pet = await Pet.findById(req.params.petId);
    if (!pet) {
      res.status(404).json({ error: "Pet not found" });
      return;
    }
    // Any household member may update pet profile details
    await requireMembership(humanId, pet.familyId.toString(), "member");

    Object.assign(pet, {
      ...body,
      photoUrl: body.photoUrl === "" ? undefined : body.photoUrl ?? pet.photoUrl,
    });
    await pet.save();
    const family = await Family.findById(pet.familyId);
    const { formatFamilySerial } = await import("../models/Family");
    res.json(
      toPetDto(
        pet,
        family?.name,
        family ? formatFamilySerial(family.serialId) : undefined
      )
    );
  })
);

router.delete(
  "/:petId",
  asyncHandler(async (req, res) => {
    const { humanId } = req as AuthedRequest;
    const pet = await Pet.findById(req.params.petId);
    if (!pet) {
      res.status(404).json({ error: "Pet not found" });
      return;
    }
    await requireMembership(humanId, pet.familyId.toString(), "member");
    requirePetSteward(pet, humanId);
    await MedicalRecord.deleteMany({ petId: pet._id });
    await pet.deleteOne();
    res.json({ ok: true });
  })
);

const recordSchema = z.object({
  type: z.enum(["vaccine", "medication", "checkup", "procedure", "other"]),
  title: z.string().min(1).max(120),
  date: z.string().datetime().or(z.string().min(1)),
  nextDueAt: z.string().datetime().or(z.string().min(1)).optional().nullable(),
  vetName: z.string().max(120).optional(),
  notes: z.string().max(4000).optional(),
  attachmentUrl: z.string().min(1).optional().nullable(),
});

router.get(
  "/:petId/records",
  asyncHandler(async (req, res) => {
    const { humanId } = req as AuthedRequest;
    const pet = await Pet.findById(req.params.petId);
    if (!pet) {
      res.status(404).json({ error: "Pet not found" });
      return;
    }
    await requireMembership(humanId, pet.familyId.toString(), "member");
    const q = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
    const type = typeof req.query.type === "string" ? req.query.type : undefined;
    const dueStatus =
      typeof req.query.dueStatus === "string" ? req.query.dueStatus : undefined;

    let records = await MedicalRecord.find({ petId: pet._id }).sort({ date: -1 });
    let dtos = records.map(toMedicalRecordDto);

    if (q) {
      dtos = dtos.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          (r.vetName?.toLowerCase().includes(q) ?? false) ||
          (r.notes?.toLowerCase().includes(q) ?? false)
      );
    }
    if (type) {
      dtos = dtos.filter((r) => r.type === type);
    }
    if (dueStatus) {
      dtos = dtos.filter((r) => r.dueStatus === dueStatus);
    }

    res.json(dtos);
  })
);

router.post(
  "/:petId/records",
  asyncHandler(async (req, res) => {
    const { humanId } = req as AuthedRequest;
    const body = recordSchema.parse(req.body);
    const pet = await Pet.findById(req.params.petId);
    if (!pet) {
      res.status(404).json({ error: "Pet not found" });
      return;
    }
    await requireMembership(humanId, pet.familyId.toString(), "member");

    const record = await MedicalRecord.create({
      petId: pet._id,
      familyId: pet.familyId,
      type: body.type,
      title: body.title,
      date: new Date(body.date),
      nextDueAt: body.nextDueAt ? new Date(body.nextDueAt) : undefined,
      vetName: body.vetName,
      notes: body.notes,
      attachmentUrl: body.attachmentUrl ?? undefined,
      createdByHumanId: humanId,
    });

    res.status(201).json(toMedicalRecordDto(record));
  })
);

router.patch(
  "/:petId/records/:recordId",
  asyncHandler(async (req, res) => {
    const { humanId } = req as AuthedRequest;
    const body = recordSchema.partial().parse(req.body);
    const pet = await Pet.findById(req.params.petId);
    if (!pet) {
      res.status(404).json({ error: "Pet not found" });
      return;
    }
    await requireMembership(humanId, pet.familyId.toString(), "member");

    const record = await MedicalRecord.findOne({
      _id: req.params.recordId,
      petId: pet._id,
    });
    if (!record) {
      res.status(404).json({ error: "Record not found" });
      return;
    }

    if (body.type !== undefined) record.type = body.type;
    if (body.title !== undefined) record.title = body.title;
    if (body.date !== undefined) record.date = new Date(body.date);
    if (body.nextDueAt === null) record.nextDueAt = undefined;
    else if (body.nextDueAt !== undefined) record.nextDueAt = new Date(body.nextDueAt);
    if (body.vetName !== undefined) record.vetName = body.vetName;
    if (body.notes !== undefined) record.notes = body.notes;
    if (body.attachmentUrl === null) record.attachmentUrl = undefined;
    else if (body.attachmentUrl !== undefined) record.attachmentUrl = body.attachmentUrl;

    await record.save();
    res.json(toMedicalRecordDto(record));
  })
);

router.delete(
  "/:petId/records/:recordId",
  asyncHandler(async (req, res) => {
    const { humanId } = req as AuthedRequest;
    const pet = await Pet.findById(req.params.petId);
    if (!pet) {
      res.status(404).json({ error: "Pet not found" });
      return;
    }
    await requireMembership(humanId, pet.familyId.toString(), "member");
    const result = await MedicalRecord.deleteOne({
      _id: req.params.recordId,
      petId: pet._id,
    });
    if (result.deletedCount === 0) {
      res.status(404).json({ error: "Record not found" });
      return;
    }
    res.json({ ok: true });
  })
);

export default router;
