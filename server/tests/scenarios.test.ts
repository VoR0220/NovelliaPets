import { describe, expect, it } from "vitest";
import request from "supertest";
import { runSeed } from "../src/seedData";
import { Pet } from "../src/models/Pet";
import { FamilyMembership } from "../src/models/FamilyMembership";
import { Family } from "../src/models/Family";
import { app, auth, loginAs } from "./helpers";

describe("Seeded demo scenarios", () => {
  it("Scenario 1 — care due / overdue for solo pet Maple", async () => {
    const seed = await runSeed();
    const application = app();
    const { token } = await loginAs(application, {
      email: seed.personas.alex.email,
    });

    const dash = await request(application)
      .get("/api/dashboard")
      .set(auth(token))
      .expect(200);

    expect(dash.body.care.overdue.length).toBeGreaterThanOrEqual(1);
    expect(
      dash.body.care.overdue.some((r: { title: string }) => r.title === "Rabies")
    ).toBe(true);
    expect(dash.body.pets.some((p: { name: string }) => p.name === "Maple")).toBe(
      true
    );
    expect(dash.body.familyCount).toBeGreaterThanOrEqual(2);
  });

  it("Scenario 2 — shared household member sees conjoined pets", async () => {
    const seed = await runSeed();
    const application = app();
    const { token } = await loginAs(application, {
      email: seed.personas.jordan.email,
    });

    const pets = await request(application)
      .get("/api/pets")
      .set(auth(token))
      .expect(200);

    const names = pets.body.map((p: { name: string }) => p.name);
    expect(names).toEqual(expect.arrayContaining(["Biscuit", "Nova"]));
    expect(names).not.toContain("Maple");
    expect(names).not.toContain("Pepper");

    const me = await request(application)
      .get("/api/auth/me")
      .set(auth(token))
      .expect(200);
    expect(me.body.memberships).toHaveLength(1);
    expect(me.body.memberships[0].role).toBe("member");
  });

  it("Scenario 3 — Sam accepts pending invite into shared household", async () => {
    const seed = await runSeed();
    const application = app();
    const { token } = await loginAs(application, {
      phone: seed.personas.sam.phone,
    });

    const invites = await request(application)
      .get("/api/families/invites/mine")
      .set(auth(token))
      .expect(200);

    expect(invites.body).toHaveLength(1);
    expect(invites.body[0].familyName).toBe(seed.families.shared.name);

    await request(application)
      .post(`/api/families/invites/${invites.body[0].id}/accept`)
      .set(auth(token))
      .expect(200);

    const pets = await request(application)
      .get("/api/pets")
      .set(auth(token))
      .expect(200);
    const names = pets.body.map((p: { name: string }) => p.name);
    expect(names).toEqual(
      expect.arrayContaining(["Pepper", "Biscuit", "Nova"])
    );
  });

  it("Scenario 4 — Casey approves pending transfer of Nova", async () => {
    const seed = await runSeed();
    const application = app();
    const { token: caseyToken } = await loginAs(application, {
      email: seed.personas.casey.email,
    });

    const caseyFamilies = await request(application)
      .get("/api/families")
      .set(auth(caseyToken))
      .expect(200);
    const caseyFamilyId = caseyFamilies.body[0].familyId as string;

    const detail = await request(application)
      .get(`/api/families/${caseyFamilyId}`)
      .set(auth(caseyToken))
      .expect(200);

    expect(detail.body.transfers).toHaveLength(1);
    const transfer = detail.body.transfers[0];
    expect(transfer.petName).toBe("Nova");
    expect(transfer.status).toBe("pending_documentation");

    await request(application)
      .post(`/api/families/transfers/${transfer.id}/decide`)
      .set(auth(caseyToken))
      .send({ decision: "approved" })
      .expect(200);

    const nova = await Pet.findById(seed.pets.nova);
    expect(nova?.familyId.toString()).toBe(caseyFamilyId);

    const { token: jordanToken } = await loginAs(application, {
      email: seed.personas.jordan.email,
    });
    const jordanPets = await request(application)
      .get("/api/pets")
      .set(auth(jordanToken))
      .expect(200);
    expect(jordanPets.body.map((p: { name: string }) => p.name)).not.toContain(
      "Nova"
    );
  });

  it("Scenario 5 — Alex sees pets across multiple families", async () => {
    const seed = await runSeed();
    const application = app();
    const { token } = await loginAs(application, {
      email: seed.personas.alex.email,
    });

    const pets = await request(application)
      .get("/api/pets")
      .set(auth(token))
      .expect(200);

    const byName = Object.fromEntries(
      pets.body.map((p: { name: string; familySerialCode?: string }) => [
        p.name,
        p.familySerialCode,
      ])
    );
    expect(byName.Maple).toBe(seed.families.alexSolo.serialCode);
    expect(byName.Biscuit).toBe(seed.families.shared.serialCode);
    expect(byName.Nova).toBe(seed.families.shared.serialCode);
  });

  it("Scenario 6 — empty start: signup has no family until first pet", async () => {
    const seed = await runSeed();
    const application = app();
    const { token } = await loginAs(application, {
      email: seed.personas.morgan.email,
    });

    const me = await request(application)
      .get("/api/auth/me")
      .set(auth(token))
      .expect(200);
    expect(me.body.memberships).toHaveLength(0);

    const created = await request(application)
      .post("/api/pets")
      .set(auth(token))
      .send({
        newFamilyName: "Morgan's Family",
        name: "Pixel",
        species: "Cat",
        breed: "Tabby",
        sex: "female",
        approxAge: "2 years",
      })
      .expect(201);

    expect(created.body.name).toBe("Pixel");
    expect(created.body.familySerialCode).toMatch(/^NP-\d{6}$/);

    const meAfter = await request(application)
      .get("/api/auth/me")
      .set(auth(token))
      .expect(200);
    expect(meAfter.body.memberships).toHaveLength(1);
    expect(meAfter.body.memberships[0].role).toBe("admin");
  });
});

describe("Auth & family creation guards", () => {
  it("marks seeded emails as existing and verifies with OTP only", async () => {
    const seed = await runSeed();
    const application = app();

    const otp = await request(application)
      .post("/api/auth/request-otp")
      .send({ email: seed.personas.alex.email })
      .expect(200);

    expect(otp.body.existingAccount).toBe(true);

    const verified = await request(application)
      .post("/api/auth/verify-otp")
      .send({
        email: seed.personas.alex.email,
        code: otp.body.devOtpHint,
      })
      .expect(200);

    expect(verified.body.token).toBeTruthy();
    expect(verified.body.isNewHuman).toBe(false);

    const dash = await request(application)
      .get("/api/dashboard")
      .set(auth(verified.body.token))
      .expect(200);
    expect(dash.body.pets.length).toBeGreaterThan(0);
  });

  it("requires adult attestation for brand-new humans", async () => {
    const application = app();
    const otp = await request(application)
      .post("/api/auth/request-otp")
      .send({ email: "newbie@example.com" })
      .expect(200);

    expect(otp.body.existingAccount).toBe(false);

    const denied = await request(application)
      .post("/api/auth/verify-otp")
      .send({
        email: "newbie@example.com",
        code: otp.body.devOtpHint,
      })
      .expect(400);
    expect(denied.body.requiresAdultAttestation).toBe(true);

    await request(application)
      .post("/api/auth/verify-otp")
      .send({
        email: "newbie@example.com",
        code: otp.body.devOtpHint,
        adultAttested: true,
        name: "Newbie",
      })
      .expect(200);
  });

  it("does not create a family on signup", async () => {
    const application = app();
    const { token } = await loginAs(
      application,
      { email: "nofamily@example.com" },
      { name: "No Family Yet" }
    );
    const me = await request(application)
      .get("/api/auth/me")
      .set(auth(token))
      .expect(200);
    expect(me.body.memberships).toEqual([]);
  });
});

describe("Transfers & merges", () => {
  it("steward can request transfer by Family ID; non-steward cannot", async () => {
    const seed = await runSeed();
    const application = app();

    const { token: jordanToken } = await loginAs(application, {
      email: seed.personas.jordan.email,
    });
    const jordanFamilies = await request(application)
      .get("/api/families")
      .set(auth(jordanToken))
      .expect(200);
    const sharedId = jordanFamilies.body[0].familyId as string;

    await request(application)
      .post(`/api/families/${sharedId}/transfers`)
      .set(auth(jordanToken))
      .send({
        petId: seed.pets.biscuit,
        toFamilySerial: seed.families.casey.serialCode,
        warningAcknowledged: true,
      })
      .expect(403);

    const { token: alexToken } = await loginAs(application, {
      email: seed.personas.alex.email,
    });
    const transfer = await request(application)
      .post(`/api/families/${sharedId}/transfers`)
      .set(auth(alexToken))
      .send({
        petId: seed.pets.biscuit,
        toFamilySerial: seed.families.casey.serialCode,
        warningAcknowledged: true,
      })
      .expect(201);

    expect(transfer.body.petName).toBe("Biscuit");
    expect(transfer.body.toFamilySerialCode).toBe(
      seed.families.casey.serialCode
    );
  });

  it("merge moves pets, keeps stewards, and archives source family", async () => {
    const seed = await runSeed();
    const application = app();
    const mapleBefore = await Pet.findById(seed.pets.maple);
    const mapleSteward = mapleBefore!.stewardHumanId.toString();

    const { token: alexToken } = await loginAs(application, {
      email: seed.personas.alex.email,
    });
    const families = await request(application)
      .get("/api/families")
      .set(auth(alexToken))
      .expect(200);

    const solo = families.body.find(
      (m: { family?: { serialCode?: string } }) =>
        m.family?.serialCode === seed.families.alexSolo.serialCode
    );
    expect(solo).toBeTruthy();

    const mergeReq = await request(application)
      .post(`/api/families/${solo.familyId}/merges`)
      .set(auth(alexToken))
      .send({
        toAdminEmail: seed.personas.alex.email,
        warningAcknowledged: true,
      })
      .expect(201);

    // Alex is also admin of shared — can self-approve as target admin
    await request(application)
      .post(`/api/families/merges/${mergeReq.body.id}/decide`)
      .set(auth(alexToken))
      .send({ decision: "approved" })
      .expect(200);

    const mapleAfter = await Pet.findById(seed.pets.maple);
    expect(mapleAfter!.stewardHumanId.toString()).toBe(mapleSteward);

    const sharedMembership = await FamilyMembership.findOne({
      humanId: mapleAfter!.stewardHumanId,
      familyId: mapleAfter!.familyId,
    });
    expect(sharedMembership).toBeTruthy();

    const archived = await Family.findById(solo.familyId);
    expect(archived?.status).toBe("merged");

    const pets = await request(application)
      .get("/api/pets")
      .set(auth(alexToken))
      .expect(200);
    const maple = pets.body.find((p: { name: string }) => p.name === "Maple");
    expect(maple.familySerialCode).toBe(seed.families.shared.serialCode);
  });

  it("transfer by email creates a family for Morgan and makes her steward on approve", async () => {
    const seed = await runSeed();
    const application = app();
    const { token: alexToken } = await loginAs(application, {
      email: seed.personas.alex.email,
    });

    const alexFamilies = await request(application)
      .get("/api/families")
      .set(auth(alexToken))
      .expect(200);
    const solo = alexFamilies.body.find(
      (m: { family?: { serialCode?: string } }) =>
        m.family?.serialCode === seed.families.alexSolo.serialCode
    );
    expect(solo).toBeTruthy();

    const created = await request(application)
      .post(`/api/families/${solo.familyId}/transfers`)
      .set(auth(alexToken))
      .send({
        petId: seed.pets.maple,
        toEmail: seed.personas.morgan.email,
        warningAcknowledged: true,
      })
      .expect(201);

    expect(created.body.toHumanId).toBeTruthy();
    expect(created.body.toFamilySerialCode).toMatch(/^NP-\d{6}$/);
    expect(created.body.toFamilySerialCode).not.toBe(
      seed.families.alexSolo.serialCode
    );

    const { token: morganToken, human: morgan } = await loginAs(application, {
      email: seed.personas.morgan.email,
    });
    expect(created.body.toHumanId).toBe(morgan.id);

    const morganFamilies = await request(application)
      .get("/api/families")
      .set(auth(morganToken))
      .expect(200);
    expect(morganFamilies.body.length).toBeGreaterThanOrEqual(1);
    const morganFamilyId = created.body.toFamilyId as string;

    await request(application)
      .post(`/api/families/transfers/${created.body.id}/decide`)
      .set(auth(morganToken))
      .send({ decision: "approved" })
      .expect(200);

    const maple = await Pet.findById(seed.pets.maple);
    expect(maple?.familyId.toString()).toBe(morganFamilyId);
    expect(maple?.stewardHumanId.toString()).toBe(morgan.id);
  });

  it("rejects transfer to an email with no account", async () => {
    const seed = await runSeed();
    const application = app();
    const { token: alexToken } = await loginAs(application, {
      email: seed.personas.alex.email,
    });
    const alexFamilies = await request(application)
      .get("/api/families")
      .set(auth(alexToken))
      .expect(200);
    const solo = alexFamilies.body.find(
      (m: { family?: { serialCode?: string } }) =>
        m.family?.serialCode === seed.families.alexSolo.serialCode
    );

    const res = await request(application)
      .post(`/api/families/${solo.familyId}/transfers`)
      .set(auth(alexToken))
      .send({
        petId: seed.pets.maple,
        toEmail: "nobody-yet@example.com",
        warningAcknowledged: true,
      })
      .expect(404);

    expect(res.body.error).toMatch(/no account/i);
  });

  it("rejects transfer to a member who is not a family admin", async () => {
    const seed = await runSeed();
    const application = app();
    const { token: alexToken } = await loginAs(application, {
      email: seed.personas.alex.email,
    });
    const alexFamilies = await request(application)
      .get("/api/families")
      .set(auth(alexToken))
      .expect(200);
    const solo = alexFamilies.body.find(
      (m: { family?: { serialCode?: string } }) =>
        m.family?.serialCode === seed.families.alexSolo.serialCode
    );

    const res = await request(application)
      .post(`/api/families/${solo.familyId}/transfers`)
      .set(auth(alexToken))
      .send({
        petId: seed.pets.maple,
        toEmail: seed.personas.jordan.email,
        warningAcknowledged: true,
      })
      .expect(400);

    expect(res.body.error).toMatch(/not a family admin/i);
  });

  it("denying a transfer leaves the pet in the source family", async () => {
    const seed = await runSeed();
    const application = app();
    const { token: caseyToken } = await loginAs(application, {
      email: seed.personas.casey.email,
    });
    const caseyFamilies = await request(application)
      .get("/api/families")
      .set(auth(caseyToken))
      .expect(200);
    const detail = await request(application)
      .get(`/api/families/${caseyFamilies.body[0].familyId}`)
      .set(auth(caseyToken))
      .expect(200);

    await request(application)
      .post(`/api/families/transfers/${detail.body.transfers[0].id}/decide`)
      .set(auth(caseyToken))
      .send({ decision: "denied" })
      .expect(200);

    const nova = await Pet.findById(seed.pets.nova);
    const shared = await Family.findOne({
      serialId: 2,
      status: "active",
    });
    expect(nova?.familyId.toString()).toBe(shared!._id.toString());
  });
});

describe("Medical records & membership boundaries", () => {
  it("member can add records; only admins add pets to an existing family", async () => {
    const seed = await runSeed();
    const application = app();
    const { token: jordanToken } = await loginAs(application, {
      email: seed.personas.jordan.email,
    });
    const families = await request(application)
      .get("/api/families")
      .set(auth(jordanToken))
      .expect(200);
    const sharedId = families.body[0].familyId as string;

    await request(application)
      .post("/api/pets")
      .set(auth(jordanToken))
      .send({
        familyId: sharedId,
        name: "ShouldFail",
        species: "Dog",
        breed: "Mix",
        sex: "male",
        approxAge: "1 year",
      })
      .expect(403);

    const record = await request(application)
      .post(`/api/pets/${seed.pets.biscuit}/records`)
      .set(auth(jordanToken))
      .send({
        type: "checkup",
        title: "Dental",
        date: new Date().toISOString(),
      })
      .expect(201);
    expect(record.body.title).toBe("Dental");
  });
});
