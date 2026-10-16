import type { NotificationType } from "@novellia/shared";
import { Types } from "mongoose";
import { Notification } from "../models/Notification";
import { toNotificationDto } from "../utils/mappers";
import { pushNotificationToHuman } from "../utils/sse";

export async function createNotification(input: {
  humanId: string | Types.ObjectId;
  type: NotificationType;
  payload?: Record<string, unknown>;
}): Promise<void> {
  const doc = await Notification.create({
    humanId: input.humanId,
    type: input.type,
    payload: input.payload ?? {},
  });
  const dto = toNotificationDto(doc);
  pushNotificationToHuman(dto.humanId, dto);
}

export async function notifyFamilyAdmins(input: {
  familyId: string | Types.ObjectId;
  type: NotificationType;
  payload?: Record<string, unknown>;
  excludeHumanId?: string;
}): Promise<void> {
  const { FamilyMembership } = await import("../models/FamilyMembership");
  const admins = await FamilyMembership.find({
    familyId: input.familyId,
    role: "admin",
  });
  for (const admin of admins) {
    if (input.excludeHumanId && admin.humanId.toString() === input.excludeHumanId) {
      continue;
    }
    await createNotification({
      humanId: admin.humanId,
      type: input.type,
      payload: input.payload,
    });
  }
}
