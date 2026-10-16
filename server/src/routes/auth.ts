import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { config } from "../config";
import { Human } from "../models/Human";
import { OtpChallenge } from "../models/OtpChallenge";
import { FamilyMembership } from "../models/FamilyMembership";
import { Family } from "../models/Family";
import { requireAuth, signToken, type AuthedRequest } from "../middleware/auth";
import { asyncHandler } from "../middleware/error";
import { toHumanDto, toMembershipDto } from "../utils/mappers";

const router = Router();

const destinationSchema = z
  .object({
    email: z.string().email().optional(),
    phone: z.string().min(7).max(20).optional(),
  })
  .refine((v) => (Boolean(v.email) && !v.phone) || (Boolean(v.phone) && !v.email), {
    message: "Provide exactly one of email or phone",
  });

function normalizeDestination(body: { email?: string; phone?: string }): {
  destination: string;
  channel: "email" | "phone";
} {
  if (body.email) {
    return { destination: body.email.trim().toLowerCase(), channel: "email" };
  }
  return { destination: body.phone!.trim(), channel: "phone" };
}

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

router.post(
  "/request-otp",
  asyncHandler(async (req, res) => {
    const parsed = destinationSchema.parse(req.body);
    const { destination, channel } = normalizeDestination(parsed);
    const code = generateOtp();
    const codeHash = await bcrypt.hash(code, 8);
    const expiresAt = new Date(Date.now() + config.otpTtlMinutes * 60 * 1000);

    await OtpChallenge.create({
      destination,
      channel,
      codeHash,
      expiresAt,
    });

    const existing =
      channel === "email"
        ? await Human.findOne({ email: destination })
        : await Human.findOne({ phone: destination });

    console.log(`\n[OTP] ${channel}:${destination} => ${code} (expires in ${config.otpTtlMinutes}m)\n`);

    res.json({
      ok: true,
      channel,
      destination,
      expiresInMinutes: config.otpTtlMinutes,
      /** Returning humans skip name / adult attestation and go straight to the app */
      existingAccount: Boolean(existing),
      ...(config.isDev ? { devOtpHint: code } : {}),
    });
  })
);

const verifySchema = destinationSchema.and(
  z.object({
    code: z.string().min(4).max(8),
    adultAttested: z.boolean().optional(),
    name: z.string().min(1).max(80).optional(),
    firstName: z.string().min(1).max(40).optional(),
    lastName: z.string().min(1).max(40).optional(),
  })
);

function buildDisplayName(parsed: {
  name?: string;
  firstName?: string;
  lastName?: string;
}): string | undefined {
  const first = parsed.firstName?.trim();
  const last = parsed.lastName?.trim();
  if (first && last) return `${first} ${last}`;
  if (first) return first;
  if (last) return last;
  return parsed.name?.trim() || undefined;
}

router.post(
  "/verify-otp",
  asyncHandler(async (req, res) => {
    const parsed = verifySchema.parse(req.body);
    const { destination, channel } = normalizeDestination(parsed);

    const challenge = await OtpChallenge.findOne({
      destination,
      channel,
      consumedAt: { $exists: false },
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!challenge) {
      res.status(400).json({ error: "No valid OTP found. Request a new code." });
      return;
    }

    const valid = await bcrypt.compare(parsed.code, challenge.codeHash);
    if (!valid) {
      res.status(400).json({ error: "Invalid code" });
      return;
    }

    const query = channel === "email" ? { email: destination } : { phone: destination };
    let human = await Human.findOne(query);
    let isNewHuman = false;

    const displayName = buildDisplayName(parsed);

    if (!human) {
      if (!parsed.adultAttested) {
        res.status(400).json({
          error: "Adult attestation required for new accounts (confirm you are 18+)",
          requiresAdultAttestation: true,
        });
        return;
      }
      // Humans only — families are created when the first pet is added (or via invite).
      human = await Human.create({
        ...query,
        name: displayName,
        adultAttestedAt: new Date(),
      });
      isNewHuman = true;
    } else {
      if (!human.adultAttestedAt) {
        if (!parsed.adultAttested) {
          res.status(400).json({
            error: "Adult attestation required",
            requiresAdultAttestation: true,
          });
          return;
        }
        human.adultAttestedAt = new Date();
        await human.save();
      }
      if (displayName && !human.name) {
        human.name = displayName;
        await human.save();
      }
    }

    challenge.consumedAt = new Date();
    await challenge.save();

    const token = signToken(human._id.toString());
    res.json({
      token,
      human: toHumanDto(human),
      isNewHuman,
    });
  })
);

router.post(
  "/logout",
  requireAuth,
  asyncHandler(async (_req, res) => {
    res.json({ ok: true });
  })
);

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { human, humanId } = req as AuthedRequest;
    const memberships = await FamilyMembership.find({ humanId });
    const familyIds = memberships.map((m) => m.familyId);
    const families = await Family.find({
      _id: { $in: familyIds },
      status: { $ne: "merged" },
    });
    const familyMap = new Map(families.map((f) => [f._id.toString(), f]));
    const activeMemberships = memberships.filter((m) =>
      familyMap.has(m.familyId.toString())
    );

    res.json({
      human: toHumanDto(human),
      memberships: activeMemberships.map((m) =>
        toMembershipDto(m, { family: familyMap.get(m.familyId.toString()) })
      ),
    });
  })
);

export default router;
