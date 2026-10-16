import { Router } from "express";
import { Types } from "mongoose";
import { z } from "zod";
import { requireAuth, type AuthedRequest } from "../middleware/auth";
import { asyncHandler } from "../middleware/error";
import { requireMembership } from "../services/authz";
import { Family } from "../models/Family";
import { FamilyMembership } from "../models/FamilyMembership";
import { Human } from "../models/Human";
import { Invite } from "../models/Invite";
import { Pet } from "../models/Pet";
import { PetTransfer } from "../models/PetTransfer";
import { MedicalRecord } from "../models/MedicalRecord";
import {
  toFamilyDto,
  toMembershipDto,
  toInviteDto,
  toTransferDto,
  toMergeDto,
} from "../utils/mappers";
import {
  createNotification,
  notifyFamilyAdmins,
} from "../services/notifications";
import { FamilyMerge } from "../models/FamilyMerge";

const router = Router();
router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { humanId } = req as AuthedRequest;
    const memberships = await FamilyMembership.find({ humanId });
    const families = await Family.find({
      _id: { $in: memberships.map((m) => m.familyId) },
    });
    const familyMap = new Map(families.map((f) => [f._id.toString(), f]));

    res.json(
      memberships.map((m) => ({
        ...toMembershipDto(m, { family: familyMap.get(m.familyId.toString()) }),
      }))
    );
  })
);

// Static invite/transfer paths must be registered before /:familyId
router.get(
  "/invites/mine",
  asyncHandler(async (req, res) => {
    const { human } = req as AuthedRequest;
    const filter: Record<string, unknown>[] = [];
    if (human.email) filter.push({ targetEmail: human.email });
    if (human.phone) filter.push({ targetPhone: human.phone });
    if (filter.length === 0) {
      res.json([]);
      return;
    }

    const invites = await Invite.find({
      status: "pending",
      expiresAt: { $gt: new Date() },
      $or: filter,
    });
    const families = await Family.find({
      _id: { $in: invites.map((i) => i.familyId) },
    });
    const map = new Map(families.map((f) => [f._id.toString(), f.name]));
    res.json(invites.map((i) => toInviteDto(i, map.get(i.familyId.toString()))));
  })
);

router.post(
  "/invites/:inviteId/accept",
  asyncHandler(async (req, res) => {
    const { human, humanId } = req as AuthedRequest;
    const invite = await Invite.findById(req.params.inviteId);
    if (!invite || invite.status !== "pending") {
      res.status(404).json({ error: "Invite not found or not pending" });
      return;
    }
    if (invite.expiresAt < new Date()) {
      invite.status = "expired";
      await invite.save();
      res.status(400).json({ error: "Invite expired" });
      return;
    }

    const matchesEmail =
      invite.targetEmail && human.email && invite.targetEmail === human.email;
    const matchesPhone =
      invite.targetPhone && human.phone && invite.targetPhone === human.phone;
    if (!matchesEmail && !matchesPhone) {
      res.status(403).json({
        error: "This invite is addressed to a different email or phone",
      });
      return;
    }

    const existing = await FamilyMembership.findOne({
      familyId: invite.familyId,
      humanId,
    });
    if (!existing) {
      await FamilyMembership.create({
        familyId: invite.familyId,
        humanId,
        role: "member",
      });
    }

    invite.status = "accepted";
    await invite.save();

    const family = await Family.findById(invite.familyId);
    await notifyFamilyAdmins({
      familyId: invite.familyId,
      type: "invite_accepted",
      payload: {
        familyId: invite.familyId.toString(),
        familyName: family?.name,
        humanId,
        humanName: human.name ?? human.email ?? human.phone,
      },
      excludeHumanId: humanId,
    });

    res.json({ ok: true, family: family ? toFamilyDto(family) : undefined });
  })
);

router.post(
  "/transfers/:transferId/documentation",
  asyncHandler(async (req, res) => {
    const { humanId } = req as AuthedRequest;
    const body = z
      .object({ documentationUrl: z.string().min(1) })
      .parse(req.body);
    const transfer = await PetTransfer.findById(req.params.transferId);
    if (!transfer) {
      res.status(404).json({ error: "Transfer not found" });
      return;
    }
    await requireMembership(humanId, transfer.fromFamilyId.toString(), "admin");
    transfer.documentationUrl = body.documentationUrl;
    if (transfer.status === "requested") {
      transfer.status = "pending_documentation";
    }
    await transfer.save();

    const pet = await Pet.findById(transfer.petId);
    await notifyFamilyAdmins({
      familyId: transfer.toFamilyId,
      type: "transfer_requested",
      payload: {
        transferId: transfer._id.toString(),
        petName: pet?.name,
        status: transfer.status,
        documentationUrl: transfer.documentationUrl,
      },
    });

    res.json(toTransferDto(transfer, { petName: pet?.name }));
  })
);

router.post(
  "/transfers/:transferId/decide",
  asyncHandler(async (req, res) => {
    const { humanId } = req as AuthedRequest;
    const body = z
      .object({ decision: z.enum(["approved", "denied"]) })
      .parse(req.body);

    const transfer = await PetTransfer.findById(req.params.transferId);
    if (!transfer) {
      res.status(404).json({ error: "Transfer not found" });
      return;
    }
    if (!["requested", "pending_documentation"].includes(transfer.status)) {
      res.status(400).json({ error: "Transfer is no longer pending" });
      return;
    }

    await requireMembership(humanId, transfer.toFamilyId.toString(), "admin");

    transfer.status = body.decision;
    await transfer.save();

    const pet = await Pet.findById(transfer.petId);
    if (body.decision === "approved" && pet) {
      pet.familyId = transfer.toFamilyId;
      // Stewardship follows the intended recipient, or the approving admin
      pet.stewardHumanId = transfer.toHumanId ?? new Types.ObjectId(humanId);
      await pet.save();
      const { MedicalRecord } = await import("../models/MedicalRecord");
      await MedicalRecord.updateMany(
        { petId: pet._id },
        { familyId: transfer.toFamilyId }
      );
    }

    const notifType =
      body.decision === "approved" ? "transfer_approved" : "transfer_denied";

    await notifyFamilyAdmins({
      familyId: transfer.fromFamilyId,
      type: notifType,
      payload: {
        transferId: transfer._id.toString(),
        petId: transfer.petId.toString(),
        petName: pet?.name,
      },
    });
    await notifyFamilyAdmins({
      familyId: transfer.toFamilyId,
      type: notifType,
      payload: {
        transferId: transfer._id.toString(),
        petId: transfer.petId.toString(),
        petName: pet?.name,
      },
      excludeHumanId: humanId,
    });

    const [fromFamily, toFamily] = await Promise.all([
      Family.findById(transfer.fromFamilyId),
      Family.findById(transfer.toFamilyId),
    ]);

    res.json(
      toTransferDto(transfer, {
        petName: pet?.name,
        fromFamilyName: fromFamily?.name,
        toFamilyName: toFamily?.name,
      })
    );
  })
);

router.get(
  "/:familyId",
  asyncHandler(async (req, res) => {
    const { humanId } = req as AuthedRequest;
    const membership = await requireMembership(humanId, req.params.familyId, "member");
    const family = await Family.findById(req.params.familyId);
    if (!family || family.status === "merged") {
      res.status(404).json({ error: "Family not found" });
      return;
    }

    const members = await FamilyMembership.find({ familyId: family._id });
    const humans = await Human.find({
      _id: { $in: members.map((m) => m.humanId) },
    });
    const humanMap = new Map(humans.map((h) => [h._id.toString(), h]));

    const invites = await Invite.find({
      familyId: family._id,
      status: "pending",
      expiresAt: { $gt: new Date() },
    });

    const transfers = await PetTransfer.find({
      $or: [{ fromFamilyId: family._id }, { toFamilyId: family._id }],
      status: { $in: ["requested", "pending_documentation"] },
    });

    const pets = await Pet.find({
      _id: { $in: transfers.map((t) => t.petId) },
    });
    const petMap = new Map(pets.map((p) => [p._id.toString(), p]));
    const relatedFamilyIds = [
      ...new Set(
        transfers.flatMap((t) => [t.fromFamilyId.toString(), t.toFamilyId.toString()])
      ),
    ];
    const relatedFamilies = await Family.find({
      _id: { $in: relatedFamilyIds.map((id) => new Types.ObjectId(id)) },
    });
    const { formatFamilySerial } = await import("../models/Family");
    const relatedMap = new Map(
      relatedFamilies.map((f) => [
        f._id.toString(),
        { name: f.name, serialCode: formatFamilySerial(f.serialId) },
      ])
    );

    const merges = await FamilyMerge.find({
      $or: [{ fromFamilyId: family._id }, { toFamilyId: family._id }],
      status: "requested",
    });
    const mergeFamilyIds = [
      ...new Set(
        merges.flatMap((m) => [m.fromFamilyId.toString(), m.toFamilyId.toString()])
      ),
    ];
    const mergeFamilies = await Family.find({
      _id: { $in: mergeFamilyIds.map((id) => new Types.ObjectId(id)) },
    });
    const mergeMap = new Map(
      mergeFamilies.map((f) => [
        f._id.toString(),
        { name: f.name, serialCode: formatFamilySerial(f.serialId) },
      ])
    );

    res.json({
      family: toFamilyDto(family),
      myRole: membership.role,
      members: members.map((m) =>
        toMembershipDto(m, {
          human: humanMap.get(m.humanId.toString()),
          family,
        })
      ),
      invites: invites.map((i) => toInviteDto(i, family.name)),
      transfers: transfers.map((t) =>
        toTransferDto(t, {
          petName: petMap.get(t.petId.toString())?.name,
          fromFamilyName: relatedMap.get(t.fromFamilyId.toString())?.name,
          fromFamilySerialCode: relatedMap.get(t.fromFamilyId.toString())?.serialCode,
          toFamilyName: relatedMap.get(t.toFamilyId.toString())?.name,
          toFamilySerialCode: relatedMap.get(t.toFamilyId.toString())?.serialCode,
        })
      ),
      merges: merges.map((m) =>
        toMergeDto(m, {
          fromFamilyName: mergeMap.get(m.fromFamilyId.toString())?.name,
          fromFamilySerialCode: mergeMap.get(m.fromFamilyId.toString())?.serialCode,
          toFamilyName: mergeMap.get(m.toFamilyId.toString())?.name,
          toFamilySerialCode: mergeMap.get(m.toFamilyId.toString())?.serialCode,
        })
      ),
    });
  })
);

router.patch(
  "/:familyId",
  asyncHandler(async (req, res) => {
    const { humanId } = req as AuthedRequest;
    const body = z.object({ name: z.string().min(1).max(80) }).parse(req.body);
    await requireMembership(humanId, req.params.familyId, "admin");
    const family = await Family.findByIdAndUpdate(
      req.params.familyId,
      { name: body.name },
      { new: true }
    );
    if (!family) {
      res.status(404).json({ error: "Family not found" });
      return;
    }
    res.json(toFamilyDto(family));
  })
);

router.post(
  "/:familyId/promote/:memberHumanId",
  asyncHandler(async (req, res) => {
    const { humanId } = req as AuthedRequest;
    await requireMembership(humanId, req.params.familyId, "admin");
    const membership = await FamilyMembership.findOne({
      familyId: req.params.familyId,
      humanId: req.params.memberHumanId,
    });
    if (!membership) {
      res.status(404).json({ error: "Member not found" });
      return;
    }
    membership.role = "admin";
    await membership.save();
    await createNotification({
      humanId: req.params.memberHumanId,
      type: "member_promoted",
      payload: { familyId: req.params.familyId },
    });
    const human = await Human.findById(membership.humanId);
    const family = await Family.findById(membership.familyId);
    res.json(toMembershipDto(membership, { human: human ?? undefined, family: family ?? undefined }));
  })
);

const inviteSchema = z
  .object({
    targetEmail: z.string().email().optional(),
    targetPhone: z.string().min(7).max(20).optional(),
  })
  .refine((v) => Boolean(v.targetEmail) || Boolean(v.targetPhone), {
    message: "Provide targetEmail or targetPhone",
  })
  .refine((v) => !(v.targetEmail && v.targetPhone), {
    message: "Provide only one of targetEmail or targetPhone",
  });

router.post(
  "/:familyId/invites",
  asyncHandler(async (req, res) => {
    const { humanId } = req as AuthedRequest;
    await requireMembership(humanId, req.params.familyId, "admin");
    const body = inviteSchema.parse(req.body);
    const family = await Family.findById(req.params.familyId);
    if (!family) {
      res.status(404).json({ error: "Family not found" });
      return;
    }

    const invite = await Invite.create({
      familyId: family._id,
      targetEmail: body.targetEmail?.toLowerCase(),
      targetPhone: body.targetPhone,
      invitedByHumanId: humanId,
      status: "pending",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    // Notify existing human if already registered
    const existing = body.targetEmail
      ? await Human.findOne({ email: body.targetEmail.toLowerCase() })
      : await Human.findOne({ phone: body.targetPhone });

    if (existing) {
      await createNotification({
        humanId: existing._id,
        type: "invite_received",
        payload: {
          inviteId: invite._id.toString(),
          familyId: family._id.toString(),
          familyName: family.name,
        },
      });
    }

    res.status(201).json(toInviteDto(invite, family.name));
  })
);

router.delete(
  "/:familyId/invites/:inviteId",
  asyncHandler(async (req, res) => {
    const { humanId } = req as AuthedRequest;
    await requireMembership(humanId, req.params.familyId, "admin");
    const invite = await Invite.findOne({
      _id: req.params.inviteId,
      familyId: req.params.familyId,
    });
    if (!invite) {
      res.status(404).json({ error: "Invite not found" });
      return;
    }
    invite.status = "revoked";
    await invite.save();
    res.json({ ok: true });
  })
);

const transferSchema = z
  .object({
    toFamilySerial: z.string().min(1).optional(),
    toEmail: z.string().email().optional(),
    toPhone: z.string().min(7).max(20).optional(),
    warningAcknowledged: z.literal(true),
    withDocumentation: z.boolean().optional(),
  })
  .superRefine((v, ctx) => {
    const n =
      Number(Boolean(v.toFamilySerial)) +
      Number(Boolean(v.toEmail)) +
      Number(Boolean(v.toPhone));
    if (n !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Provide exactly one of: a family in your circle, an email, or a phone",
      });
    }
  });

router.post(
  "/:familyId/transfers",
  asyncHandler(async (req, res) => {
    const { humanId } = req as AuthedRequest;
    const body = transferSchema.parse(req.body);
    const petId = z.string().min(1).parse(req.body.petId);

    await requireMembership(humanId, req.params.familyId, "member");

    const pet = await Pet.findById(petId);
    if (!pet || pet.familyId.toString() !== req.params.familyId) {
      res.status(404).json({ error: "Pet not found in this family" });
      return;
    }

    const { requirePetSteward } = await import("../services/authz");
    requirePetSteward(pet, humanId);

    const { resolveTransferDestination } = await import("../services/transfers");
    const { formatFamilySerial } = await import("../models/Family");

    let resolved;
    try {
      resolved = await resolveTransferDestination({
        sourceFamilyId: req.params.familyId,
        requesterHumanId: humanId,
        toFamilySerial: body.toFamilySerial,
        toEmail: body.toEmail,
        toPhone: body.toPhone,
      });
    } catch (err) {
      const e = err as Error & { status?: number };
      res.status(e.status ?? 400).json({ error: e.message });
      return;
    }

    const { toFamily, toHuman, createdFamily } = resolved;
    const status = body.withDocumentation ? "pending_documentation" : "requested";

    const transfer = await PetTransfer.create({
      petId: pet._id,
      fromFamilyId: pet.familyId,
      toFamilyId: toFamily._id,
      requestedByHumanId: humanId,
      toHumanId: toHuman?._id,
      status,
      warningAcknowledgedAt: new Date(),
    });

    const fromFamily = await Family.findById(pet.familyId);
    const payload = {
      transferId: transfer._id.toString(),
      petId: pet._id.toString(),
      petName: pet.name,
      fromFamilyId: pet.familyId.toString(),
      fromFamilyName: fromFamily?.name,
      fromFamilySerialCode: fromFamily
        ? formatFamilySerial(fromFamily.serialId)
        : undefined,
      toFamilyId: toFamily._id.toString(),
      toFamilyName: toFamily.name,
      toFamilySerialCode: formatFamilySerial(toFamily.serialId),
      toHumanId: toHuman?._id.toString(),
      createdFamily,
      status,
    };

    await notifyFamilyAdmins({
      familyId: toFamily._id,
      type: "transfer_requested",
      payload,
      excludeHumanId: humanId,
    });

    // Notify email/phone recipient if they are a member (not already covered as admin)
    if (toHuman) {
      const asAdmin = await FamilyMembership.findOne({
        familyId: toFamily._id,
        humanId: toHuman._id,
        role: "admin",
      });
      if (!asAdmin) {
        await createNotification({
          humanId: toHuman._id,
          type: "transfer_requested",
          payload,
        });
      }
    }

    res.status(201).json(
      toTransferDto(transfer, {
        petName: pet.name,
        fromFamilyName: fromFamily?.name,
        fromFamilySerialCode: fromFamily
          ? formatFamilySerial(fromFamily.serialId)
          : undefined,
        toFamilyName: toFamily.name,
        toFamilySerialCode: formatFamilySerial(toFamily.serialId),
      })
    );
  })
);

const mergeSchema = z.object({
  toAdminEmail: z.string().email(),
  warningAcknowledged: z.literal(true),
});

router.post(
  "/:familyId/merges",
  asyncHandler(async (req, res) => {
    const { humanId } = req as AuthedRequest;
    const body = mergeSchema.parse(req.body);
    await requireMembership(humanId, req.params.familyId, "admin");

    const { formatFamilySerial } = await import("../models/Family");

    const fromFamily = await Family.findById(req.params.familyId);
    if (!fromFamily || fromFamily.status !== "active") {
      res.status(404).json({ error: "Source family not found" });
      return;
    }

    const adminHuman = await Human.findOne({
      email: body.toAdminEmail.trim().toLowerCase(),
    });
    if (!adminHuman) {
      res.status(404).json({
        error: "No account found with that email",
      });
      return;
    }

    const adminMemberships = await FamilyMembership.find({
      humanId: adminHuman._id,
      role: "admin",
    });
    if (adminMemberships.length === 0) {
      res.status(400).json({
        error: "That person is not an admin of any family",
      });
      return;
    }

    const adminFamilies = await Family.find({
      _id: { $in: adminMemberships.map((m) => m.familyId) },
      status: "active",
    });
    const candidates = adminFamilies
      .filter((f) => !f._id.equals(fromFamily._id))
      .sort((a, b) => a.serialId - b.serialId);

    if (candidates.length === 0) {
      res.status(400).json({
        error:
          "That admin’s only household is this one — pick an admin of a different family",
      });
      return;
    }

    const toFamily = candidates[0]!;

    const existing = await FamilyMerge.findOne({
      fromFamilyId: fromFamily._id,
      toFamilyId: toFamily._id,
      status: "requested",
    });
    if (existing) {
      res.status(400).json({ error: "A merge request is already pending" });
      return;
    }

    const merge = await FamilyMerge.create({
      fromFamilyId: fromFamily._id,
      toFamilyId: toFamily._id,
      requestedByHumanId: humanId,
      status: "requested",
      warningAcknowledgedAt: new Date(),
    });

    await notifyFamilyAdmins({
      familyId: toFamily._id,
      type: "merge_requested",
      payload: {
        mergeId: merge._id.toString(),
        fromFamilyId: fromFamily._id.toString(),
        fromFamilyName: fromFamily.name,
        fromFamilySerialCode: formatFamilySerial(fromFamily.serialId),
        toFamilyId: toFamily._id.toString(),
        toFamilyName: toFamily.name,
        toFamilySerialCode: formatFamilySerial(toFamily.serialId),
        toAdminEmail: adminHuman.email,
      },
      excludeHumanId: humanId,
    });

    res.status(201).json(
      toMergeDto(merge, {
        fromFamilyName: fromFamily.name,
        fromFamilySerialCode: formatFamilySerial(fromFamily.serialId),
        toFamilyName: toFamily.name,
        toFamilySerialCode: formatFamilySerial(toFamily.serialId),
      })
    );
  })
);

router.post(
  "/merges/:mergeId/decide",
  asyncHandler(async (req, res) => {
    const { humanId } = req as AuthedRequest;
    const body = z
      .object({ decision: z.enum(["approved", "denied"]) })
      .parse(req.body);

    const merge = await FamilyMerge.findById(req.params.mergeId);
    if (!merge || merge.status !== "requested") {
      res.status(404).json({ error: "Merge request not found" });
      return;
    }

    // Target family admin must approve
    await requireMembership(humanId, merge.toFamilyId.toString(), "admin");

    const { formatFamilySerial } = await import("../models/Family");
    const [fromFamily, toFamily] = await Promise.all([
      Family.findById(merge.fromFamilyId),
      Family.findById(merge.toFamilyId),
    ]);

    if (body.decision === "denied") {
      merge.status = "denied";
      await merge.save();
      await notifyFamilyAdmins({
        familyId: merge.fromFamilyId,
        type: "merge_denied",
        payload: {
          mergeId: merge._id.toString(),
          fromFamilyName: fromFamily?.name,
          toFamilyName: toFamily?.name,
        },
      });
      res.json(
        toMergeDto(merge, {
          fromFamilyName: fromFamily?.name,
          fromFamilySerialCode: fromFamily
            ? formatFamilySerial(fromFamily.serialId)
            : undefined,
          toFamilyName: toFamily?.name,
          toFamilySerialCode: toFamily
            ? formatFamilySerial(toFamily.serialId)
            : undefined,
        })
      );
      return;
    }

    // Approve: move pets (stewards unchanged), union memberships as admins, archive source
    if (!fromFamily || !toFamily || fromFamily.status !== "active") {
      res.status(400).json({ error: "Families are not in a mergeable state" });
      return;
    }

    await Pet.updateMany(
      { familyId: fromFamily._id },
      { familyId: toFamily._id }
    );
    await MedicalRecord.updateMany(
      { familyId: fromFamily._id },
      { familyId: toFamily._id }
    );

    const sourceMembers = await FamilyMembership.find({ familyId: fromFamily._id });
    for (const member of sourceMembers) {
      const existing = await FamilyMembership.findOne({
        familyId: toFamily._id,
        humanId: member.humanId,
      });
      if (!existing) {
        await FamilyMembership.create({
          familyId: toFamily._id,
          humanId: member.humanId,
          role: "admin",
        });
      } else if (existing.role !== "admin") {
        existing.role = "admin";
        await existing.save();
      }
    }

    fromFamily.status = "merged";
    fromFamily.mergedIntoFamilyId = toFamily._id;
    await fromFamily.save();

    merge.status = "approved";
    await merge.save();

    await notifyFamilyAdmins({
      familyId: toFamily._id,
      type: "merge_approved",
      payload: {
        mergeId: merge._id.toString(),
        fromFamilyName: fromFamily.name,
        fromFamilySerialCode: formatFamilySerial(fromFamily.serialId),
        toFamilyName: toFamily.name,
        toFamilySerialCode: formatFamilySerial(toFamily.serialId),
      },
    });

    res.json(
      toMergeDto(merge, {
        fromFamilyName: fromFamily.name,
        fromFamilySerialCode: formatFamilySerial(fromFamily.serialId),
        toFamilyName: toFamily.name,
        toFamilySerialCode: formatFamilySerial(toFamily.serialId),
      })
    );
  })
);

export default router;
