import type {
  FamilyDto,
  FamilyMembershipDto,
  FamilyMergeDto,
  HumanDto,
  InviteDto,
  MedicalRecordDto,
  NotificationDto,
  PetDto,
  PetTransferDto,
} from "@novellia/shared";
import type { FamilyMergeDoc } from "../models/FamilyMerge";
import { computeDueStatus } from "@novellia/shared";
import type { HumanDoc } from "../models/Human";
import { formatFamilySerial, type FamilyDoc } from "../models/Family";
import type { FamilyMembershipDoc } from "../models/FamilyMembership";
import type { PetDoc } from "../models/Pet";
import type { MedicalRecordDoc } from "../models/MedicalRecord";
import type { InviteDoc } from "../models/Invite";
import type { PetTransferDoc } from "../models/PetTransfer";
import type { NotificationDoc } from "../models/Notification";

export function toHumanDto(doc: HumanDoc): HumanDto {
  return {
    id: doc._id.toString(),
    email: doc.email,
    phone: doc.phone,
    name: doc.name,
    adultAttestedAt: doc.adultAttestedAt?.toISOString(),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export function toFamilyDto(doc: FamilyDoc): FamilyDto {
  return {
    id: doc._id.toString(),
    name: doc.name,
    serialId: doc.serialId,
    serialCode: formatFamilySerial(doc.serialId),
    status: doc.status ?? "active",
    mergedIntoFamilyId: doc.mergedIntoFamilyId?.toString(),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export function toMembershipDto(
  doc: FamilyMembershipDoc,
  extras?: { family?: FamilyDoc; human?: HumanDoc }
): FamilyMembershipDto {
  return {
    id: doc._id.toString(),
    familyId: doc.familyId.toString(),
    humanId: doc.humanId.toString(),
    role: doc.role,
    family: extras?.family ? toFamilyDto(extras.family) : undefined,
    human: extras?.human ? toHumanDto(extras.human) : undefined,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export function toPetDto(
  doc: PetDoc,
  familyName?: string,
  familySerialCode?: string
): PetDto {
  return {
    id: doc._id.toString(),
    familyId: doc.familyId.toString(),
    familyName,
    familySerialCode,
    name: doc.name,
    species: doc.species,
    breed: doc.breed,
    sex: doc.sex,
    approxAge: doc.approxAge,
    photoUrl: doc.photoUrl,
    notes: doc.notes,
    createdByHumanId: doc.createdByHumanId.toString(),
    stewardHumanId: (doc.stewardHumanId ?? doc.createdByHumanId).toString(),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export function toMedicalRecordDto(doc: MedicalRecordDoc): MedicalRecordDto {
  return {
    id: doc._id.toString(),
    petId: doc.petId.toString(),
    familyId: doc.familyId.toString(),
    type: doc.type,
    title: doc.title,
    date: doc.date.toISOString(),
    nextDueAt: doc.nextDueAt?.toISOString(),
    vetName: doc.vetName,
    notes: doc.notes,
    attachmentUrl: doc.attachmentUrl,
    createdByHumanId: doc.createdByHumanId.toString(),
    dueStatus: computeDueStatus(doc.nextDueAt),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export function toInviteDto(doc: InviteDoc, familyName?: string): InviteDto {
  return {
    id: doc._id.toString(),
    familyId: doc.familyId.toString(),
    familyName,
    targetEmail: doc.targetEmail,
    targetPhone: doc.targetPhone,
    invitedByHumanId: doc.invitedByHumanId.toString(),
    status: doc.status,
    expiresAt: doc.expiresAt.toISOString(),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export function toTransferDto(
  doc: PetTransferDoc,
  extras?: {
    petName?: string;
    fromFamilyName?: string;
    fromFamilySerialCode?: string;
    toFamilyName?: string;
    toFamilySerialCode?: string;
  }
): PetTransferDto {
  return {
    id: doc._id.toString(),
    petId: doc.petId.toString(),
    petName: extras?.petName,
    fromFamilyId: doc.fromFamilyId.toString(),
    fromFamilyName: extras?.fromFamilyName,
    fromFamilySerialCode: extras?.fromFamilySerialCode,
    toFamilyId: doc.toFamilyId.toString(),
    toFamilyName: extras?.toFamilyName,
    toFamilySerialCode: extras?.toFamilySerialCode,
    requestedByHumanId: doc.requestedByHumanId.toString(),
    toHumanId: doc.toHumanId?.toString(),
    status: doc.status,
    documentationUrl: doc.documentationUrl,
    warningAcknowledgedAt: doc.warningAcknowledgedAt?.toISOString(),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export function toNotificationDto(doc: NotificationDoc): NotificationDto {
  return {
    id: doc._id.toString(),
    humanId: doc.humanId.toString(),
    type: doc.type,
    payload: doc.payload,
    readAt: doc.readAt?.toISOString(),
    createdAt: doc.createdAt.toISOString(),
  };
}

export function toMergeDto(
  doc: FamilyMergeDoc,
  extras?: {
    fromFamilyName?: string;
    fromFamilySerialCode?: string;
    toFamilyName?: string;
    toFamilySerialCode?: string;
  }
): FamilyMergeDto {
  return {
    id: doc._id.toString(),
    fromFamilyId: doc.fromFamilyId.toString(),
    fromFamilyName: extras?.fromFamilyName,
    fromFamilySerialCode: extras?.fromFamilySerialCode,
    toFamilyId: doc.toFamilyId.toString(),
    toFamilyName: extras?.toFamilyName,
    toFamilySerialCode: extras?.toFamilySerialCode,
    requestedByHumanId: doc.requestedByHumanId.toString(),
    status: doc.status,
    warningAcknowledgedAt: doc.warningAcknowledgedAt?.toISOString(),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}
