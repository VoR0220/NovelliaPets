import type { Express } from "express";
import request from "supertest";
import { expect } from "vitest";
import { createApp } from "../src/app";

export function app(): Express {
  return createApp();
}

export async function loginAs(
  application: Express,
  destination: { email?: string; phone?: string },
  opts?: { adultAttested?: boolean; name?: string }
): Promise<{ token: string; human: { id: string; name?: string } }> {
  const otpRes = await request(application)
    .post("/api/auth/request-otp")
    .send(destination)
    .expect(200);

  const code = otpRes.body.devOtpHint as string;
  expect(code).toBeTruthy();

  const verifyRes = await request(application)
    .post("/api/auth/verify-otp")
    .send({
      ...destination,
      code,
      adultAttested: opts?.adultAttested ?? true,
      name: opts?.name,
    })
    .expect(200);

  return {
    token: verifyRes.body.token as string,
    human: verifyRes.body.human,
  };
}

export function auth(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}
