import { Router } from "express";
import { Types } from "mongoose";
import { requireAuth, type AuthedRequest } from "../middleware/auth";
import { asyncHandler } from "../middleware/error";
import { getFamilyIdsForHuman } from "../services/authz";
import { Pet } from "../models/Pet";
import { Family } from "../models/Family";
import { MedicalRecord } from "../models/MedicalRecord";
import { toPetDto, toMedicalRecordDto } from "../utils/mappers";

const router = Router();
router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { humanId } = req as AuthedRequest;
    const familyIds = await getFamilyIdsForHuman(humanId);
    const objectIds = familyIds.map((id) => new Types.ObjectId(id));

    const [pets, families, records] = await Promise.all([
      Pet.find({ familyId: { $in: objectIds } }).sort({ name: 1 }),
      Family.find({ _id: { $in: objectIds } }),
      MedicalRecord.find({
        familyId: { $in: objectIds },
        nextDueAt: { $exists: true, $ne: null },
      }).sort({ nextDueAt: 1 }),
    ]);

    const { formatFamilySerial } = await import("../models/Family");
    const metaMap = new Map(
      families.map((f) => [
        f._id.toString(),
        { name: f.name, serialCode: formatFamilySerial(f.serialId) },
      ])
    );
    const petDtos = pets.map((p) => {
      const m = metaMap.get(p.familyId.toString());
      return toPetDto(p, m?.name, m?.serialCode);
    });
    const recordDtos = records.map(toMedicalRecordDto);

    res.json({
      pets: petDtos,
      care: {
        overdue: recordDtos.filter((r) => r.dueStatus === "overdue"),
        dueSoon: recordDtos.filter((r) => r.dueStatus === "due_soon"),
      },
      familyCount: familyIds.length,
    });
  })
);

export default router;
