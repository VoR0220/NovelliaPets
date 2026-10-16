export type FamilyRole = "admin" | "member";

export type MedicalRecordType =
  | "vaccine"
  | "medication"
  | "checkup"
  | "procedure"
  | "other";

export type InviteStatus = "pending" | "accepted" | "revoked" | "expired";

export type TransferStatus =
  | "requested"
  | "pending_documentation"
  | "approved"
  | "denied";

export type NotificationType =
  | "invite_received"
  | "invite_accepted"
  | "transfer_requested"
  | "transfer_approved"
  | "transfer_denied"
  | "member_promoted"
  | "merge_requested"
  | "merge_approved"
  | "merge_denied";

export type MergeStatus = "requested" | "approved" | "denied";

export type PetSex = "male" | "female" | "unknown";

export type OtpChannel = "email" | "phone";

export type DueStatus = "overdue" | "due_soon" | "ok";

export interface HumanDto {
  id: string;
  email?: string;
  phone?: string;
  name?: string;
  adultAttestedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FamilyDto {
  id: string;
  name: string;
  /** Monotonic public ID used for sharing and transfers */
  serialId: number;
  /** Display / share form, e.g. NP-000042 */
  serialCode: string;
  status: "active" | "merged";
  mergedIntoFamilyId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FamilyMembershipDto {
  id: string;
  familyId: string;
  humanId: string;
  role: FamilyRole;
  family?: FamilyDto;
  human?: HumanDto;
  createdAt: string;
  updatedAt: string;
}

export interface PetDto {
  id: string;
  familyId: string;
  familyName?: string;
  familySerialCode?: string;
  name: string;
  species: string;
  breed: string;
  sex: PetSex;
  approxAge: string;
  photoUrl?: string;
  notes: string;
  createdByHumanId: string;
  /** May transfer/delete this pet even after household merges */
  stewardHumanId: string;
  createdAt: string;
  updatedAt: string;
}

export interface MedicalRecordDto {
  id: string;
  petId: string;
  familyId: string;
  type: MedicalRecordType;
  title: string;
  date: string;
  nextDueAt?: string;
  vetName?: string;
  notes?: string;
  attachmentUrl?: string;
  createdByHumanId: string;
  dueStatus?: DueStatus;
  createdAt: string;
  updatedAt: string;
}

export interface InviteDto {
  id: string;
  familyId: string;
  familyName?: string;
  targetEmail?: string;
  targetPhone?: string;
  invitedByHumanId: string;
  status: InviteStatus;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface PetTransferDto {
  id: string;
  petId: string;
  petName?: string;
  fromFamilyId: string;
  fromFamilyName?: string;
  fromFamilySerialCode?: string;
  toFamilyId: string;
  toFamilyName?: string;
  toFamilySerialCode?: string;
  requestedByHumanId: string;
  /** When transfer was addressed to a specific human (email/phone) */
  toHumanId?: string;
  status: TransferStatus;
  documentationUrl?: string;
  warningAcknowledgedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTransferBody {
  petId: string;
  /** Destination family share code, e.g. NP-000042 or 42 */
  toFamilySerial?: string;
  /** Transfer to an existing human by email (creates a family if they have none) */
  toEmail?: string;
  /** Transfer to an existing human by phone (creates a family if they have none) */
  toPhone?: string;
  warningAcknowledged: true;
  withDocumentation?: boolean;
}

export interface FamilyMergeDto {
  id: string;
  fromFamilyId: string;
  fromFamilyName?: string;
  fromFamilySerialCode?: string;
  toFamilyId: string;
  toFamilyName?: string;
  toFamilySerialCode?: string;
  requestedByHumanId: string;
  status: MergeStatus;
  warningAcknowledgedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMergeBody {
  /** Email of an admin on the destination family */
  toAdminEmail: string;
  warningAcknowledged: true;
}

export interface NotificationDto {
  id: string;
  humanId: string;
  type: NotificationType;
  payload: Record<string, unknown>;
  readAt?: string;
  createdAt: string;
}

export interface MeResponse {
  human: HumanDto;
  memberships: FamilyMembershipDto[];
}

export interface DashboardResponse {
  pets: PetDto[];
  care: {
    overdue: MedicalRecordDto[];
    dueSoon: MedicalRecordDto[];
  };
  familyCount: number;
}

export interface RequestOtpBody {
  email?: string;
  phone?: string;
}

export interface VerifyOtpBody {
  email?: string;
  phone?: string;
  code: string;
  adultAttested?: boolean;
  /** @deprecated prefer firstName + lastName */
  name?: string;
  firstName?: string;
  lastName?: string;
}

/** Common pet species ordered roughly by US household popularity */
export const PET_SPECIES_OPTIONS = [
  "Dog",
  "Cat",
  "Fish",
  "Bird",
  "Rabbit",
  "Hamster",
  "Guinea pig",
  "Turtle",
  "Lizard",
  "Snake",
  "Ferret",
  "Mouse",
  "Rat",
  "Gerbil",
  "Chinchilla",
  "Hedgehog",
  "Frog",
  "Hermit crab",
  "Horse",
  "Goat",
  "Chicken",
  "Duck",
  "Pig",
  "Other",
] as const;

export type PetSpeciesOption = (typeof PET_SPECIES_OPTIONS)[number];


export interface AuthResponse {
  token: string;
  human: HumanDto;
  isNewHuman: boolean;
  /** Dev-only hint; never set in production */
  devOtpHint?: string;
}

export interface CreatePetBody {
  /**
   * Existing family to add to (must be admin).
   * Omit when creating a new family with newFamilyName.
   */
  familyId?: string;
  /** Creates a new family (with you as admin) when you have no familyId */
  newFamilyName?: string;
  name: string;
  species: string;
  breed: string;
  sex: PetSex;
  approxAge: string;
  photoUrl?: string;
  notes?: string;
}

export interface UpdatePetBody {
  name?: string;
  species?: string;
  breed?: string;
  sex?: PetSex;
  approxAge?: string;
  photoUrl?: string;
  notes?: string;
}

export interface CreateMedicalRecordBody {
  type: MedicalRecordType;
  title: string;
  date: string;
  nextDueAt?: string;
  vetName?: string;
  notes?: string;
  attachmentUrl?: string;
}

export interface UpdateMedicalRecordBody {
  type?: MedicalRecordType;
  title?: string;
  date?: string;
  nextDueAt?: string | null;
  vetName?: string;
  notes?: string;
  attachmentUrl?: string | null;
}

export interface CreateInviteBody {
  targetEmail?: string;
  targetPhone?: string;
}

export interface RenameFamilyBody {
  name: string;
}

export const DUE_SOON_DAYS = 14;

export function computeDueStatus(
  nextDueAt: string | Date | undefined | null,
  now: Date = new Date(),
  dueSoonDays: number = DUE_SOON_DAYS
): DueStatus | undefined {
  if (!nextDueAt) return undefined;
  const due = nextDueAt instanceof Date ? nextDueAt : new Date(nextDueAt);
  if (Number.isNaN(due.getTime())) return undefined;
  if (due.getTime() < now.getTime()) return "overdue";
  const soon = new Date(now);
  soon.setDate(soon.getDate() + dueSoonDays);
  if (due.getTime() <= soon.getTime()) return "due_soon";
  return "ok";
}
