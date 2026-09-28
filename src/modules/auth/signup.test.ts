import { describe, expect, it, vi } from "vitest";
import { EXISTING_ACCOUNT_MESSAGE, registerAccount, SIGNUP_FAILED_MESSAGE, type SignupDeps } from "./signup";

const input = { email: "owner@clinic.example", password: "a long password", fullName: "Asha Rao" };

function deps(overrides: Partial<SignupDeps> = {}): SignupDeps {
  return {
    signUp: vi.fn(async () => ({ ok: true as const, userId: "user-1" })),
    createRecords: vi.fn(async () => ({ verifyToken: "token-1" })),
    deleteAuthUser: vi.fn(async () => {}),
    signOutLocal: vi.fn(async () => {}),
    sendVerification: vi.fn(async () => {}),
    logError: vi.fn(),
    ...overrides,
  };
}

describe("registerAccount", () => {
  it("creates records and sends the verification email", async () => {
    const d = deps();
    expect(await registerAccount(input, d)).toEqual({ ok: true });
    expect(d.createRecords).toHaveBeenCalledWith("user-1");
    expect(d.sendVerification).toHaveBeenCalledWith("token-1");
    expect(d.deleteAuthUser).not.toHaveBeenCalled();
  });

  it("deletes the auth user and signs out when our records fail", async () => {
    const d = deps({ createRecords: vi.fn(async () => { throw new Error("db down"); }) });
    expect(await registerAccount(input, d)).toEqual({ ok: false, formError: SIGNUP_FAILED_MESSAGE });
    expect(d.signOutLocal).toHaveBeenCalled();
    expect(d.deleteAuthUser).toHaveBeenCalledWith("user-1");
    expect(d.sendVerification).not.toHaveBeenCalled();
  });

  it("still reports failure if the cleanup itself fails", async () => {
    const d = deps({
      createRecords: vi.fn(async () => { throw new Error("db down"); }),
      deleteAuthUser: vi.fn(async () => { throw new Error("admin down"); }),
    });
    expect(await registerAccount(input, d)).toEqual({ ok: false, formError: SIGNUP_FAILED_MESSAGE });
    expect(d.logError).toHaveBeenCalledWith("Deleting orphaned auth user failed", expect.any(Error));
  });

  it("succeeds even when the verification email fails", async () => {
    const d = deps({ sendVerification: vi.fn(async () => { throw new Error("resend down"); }) });
    expect(await registerAccount(input, d)).toEqual({ ok: true });
    expect(d.deleteAuthUser).not.toHaveBeenCalled();
  });

  it("maps provider outcomes to safe messages", async () => {
    const exists = deps({ signUp: vi.fn(async () => ({ ok: false as const, reason: "exists" as const })) });
    expect(await registerAccount(input, exists)).toEqual({ ok: false, formError: EXISTING_ACCOUNT_MESSAGE });
    expect(exists.createRecords).not.toHaveBeenCalled();

    const weak = deps({ signUp: vi.fn(async () => ({ ok: false as const, reason: "rejected" as const, message: "Too weak." })) });
    expect(await registerAccount(input, weak)).toEqual({ ok: false, formError: "Too weak." });

    const failed = deps({ signUp: vi.fn(async () => ({ ok: false as const, reason: "failed" as const })) });
    expect(await registerAccount(input, failed)).toEqual({ ok: false, formError: SIGNUP_FAILED_MESSAGE });
  });
});
