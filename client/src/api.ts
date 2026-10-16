import type {
  AuthResponse,
  DashboardResponse,
  FamilyMembershipDto,
  FamilyMergeDto,
  InviteDto,
  MeResponse,
  MedicalRecordDto,
  NotificationDto,
  PetDto,
  PetTransferDto,
  CreateMedicalRecordBody,
  CreatePetBody,
  UpdatePetBody,
  UpdateMedicalRecordBody,
} from "@novellia/shared";

const TOKEN_KEY = "novellia_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(path, { ...options, headers });
  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : null;

  if (!res.ok) {
    const message =
      data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : res.statusText;
    throw new ApiError(res.status, message, data);
  }
  return data as T;
}

export const api = {
  requestOtp(body: { email?: string; phone?: string }) {
    return request<{
      ok: boolean;
      channel: string;
      destination: string;
      expiresInMinutes: number;
      existingAccount: boolean;
      devOtpHint?: string;
    }>("/api/auth/request-otp", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  verifyOtp(body: {
    email?: string;
    phone?: string;
    code: string;
    adultAttested?: boolean;
    name?: string;
    firstName?: string;
    lastName?: string;
  }) {
    return request<AuthResponse>("/api/auth/verify-otp", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  me() {
    return request<MeResponse>("/api/auth/me");
  },

  logout() {
    return request<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
  },

  dashboard() {
    return request<DashboardResponse>("/api/dashboard");
  },

  listPets(params?: { q?: string; species?: string; dueStatus?: string }) {
    const sp = new URLSearchParams();
    if (params?.q) sp.set("q", params.q);
    if (params?.species) sp.set("species", params.species);
    if (params?.dueStatus) sp.set("dueStatus", params.dueStatus);
    const qs = sp.toString();
    return request<PetDto[]>(`/api/pets${qs ? `?${qs}` : ""}`);
  },

  getPet(id: string) {
    return request<PetDto>(`/api/pets/${id}`);
  },

  createPet(body: CreatePetBody) {
    return request<PetDto>("/api/pets", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },


  updatePet(id: string, body: UpdatePetBody) {
    return request<PetDto>(`/api/pets/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  deletePet(id: string) {
    return request<{ ok: boolean }>(`/api/pets/${id}`, { method: "DELETE" });
  },

  listRecords(
    petId: string,
    params?: { q?: string; type?: string; dueStatus?: string }
  ) {
    const sp = new URLSearchParams();
    if (params?.q) sp.set("q", params.q);
    if (params?.type) sp.set("type", params.type);
    if (params?.dueStatus) sp.set("dueStatus", params.dueStatus);
    const qs = sp.toString();
    return request<MedicalRecordDto[]>(
      `/api/pets/${petId}/records${qs ? `?${qs}` : ""}`
    );
  },

  createRecord(petId: string, body: CreateMedicalRecordBody) {
    return request<MedicalRecordDto>(`/api/pets/${petId}/records`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  updateRecord(petId: string, recordId: string, body: UpdateMedicalRecordBody) {
    return request<MedicalRecordDto>(`/api/pets/${petId}/records/${recordId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  deleteRecord(petId: string, recordId: string) {
    return request<{ ok: boolean }>(`/api/pets/${petId}/records/${recordId}`, {
      method: "DELETE",
    });
  },

  listFamilies() {
    return request<FamilyMembershipDto[]>("/api/families");
  },

  getFamily(id: string) {
    return request<{
      family: {
        id: string;
        name: string;
        serialId: number;
        serialCode: string;
        status: "active" | "merged";
      };
      myRole: "admin" | "member";
      members: FamilyMembershipDto[];
      invites: InviteDto[];
      transfers: PetTransferDto[];
      merges: FamilyMergeDto[];
    }>(`/api/families/${id}`);
  },

  createMerge(
    familyId: string,
    body: { toAdminEmail: string; warningAcknowledged: true }
  ) {
    return request<FamilyMergeDto>(`/api/families/${familyId}/merges`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  decideMerge(mergeId: string, decision: "approved" | "denied") {
    return request(`/api/families/merges/${mergeId}/decide`, {
      method: "POST",
      body: JSON.stringify({ decision }),
    });
  },

  renameFamily(id: string, name: string) {
    return request<{
      id: string;
      name: string;
      serialId: number;
      serialCode: string;
      createdAt: string;
      updatedAt: string;
    }>(`/api/families/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
    });
  },

  promoteMember(familyId: string, memberHumanId: string) {
    return request(`/api/families/${familyId}/promote/${memberHumanId}`, {
      method: "POST",
    });
  },

  createInvite(
    familyId: string,
    body: { targetEmail?: string; targetPhone?: string }
  ) {
    return request<InviteDto>(`/api/families/${familyId}/invites`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  revokeInvite(familyId: string, inviteId: string) {
    return request(`/api/families/${familyId}/invites/${inviteId}`, {
      method: "DELETE",
    });
  },

  myInvites() {
    return request<InviteDto[]>("/api/families/invites/mine");
  },

  acceptInvite(inviteId: string) {
    return request(`/api/families/invites/${inviteId}/accept`, {
      method: "POST",
    });
  },

  createTransfer(
    familyId: string,
    body: {
      petId: string;
      toFamilySerial?: string;
      toEmail?: string;
      toPhone?: string;
      warningAcknowledged: true;
      withDocumentation?: boolean;
    }
  ) {
    return request<PetTransferDto>(`/api/families/${familyId}/transfers`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  attachTransferDoc(transferId: string, documentationUrl: string) {
    return request(`/api/families/transfers/${transferId}/documentation`, {
      method: "POST",
      body: JSON.stringify({ documentationUrl }),
    });
  },

  decideTransfer(transferId: string, decision: "approved" | "denied") {
    return request(`/api/families/transfers/${transferId}/decide`, {
      method: "POST",
      body: JSON.stringify({ decision }),
    });
  },

  notifications() {
    return request<NotificationDto[]>("/api/notifications");
  },

  markNotificationsRead(ids?: string[]) {
    return request("/api/notifications/read", {
      method: "POST",
      body: JSON.stringify({ ids }),
    });
  },

  upload(file: File) {
    const form = new FormData();
    form.append("file", file);
    return request<{ url: string; filename: string }>("/api/uploads", {
      method: "POST",
      body: form,
    });
  },
};
