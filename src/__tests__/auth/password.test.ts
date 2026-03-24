import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

describe("password hashing", () => {
  it("produces a hash different from the plain text", async () => {
    const hash = await hashPassword("correct-horse-battery");
    expect(hash).not.toBe("correct-horse-battery");
    expect(hash.length).toBeGreaterThan(20);
  });

  it("verifies correct password", async () => {
    const hash = await hashPassword("my-secret-pass");
    expect(await verifyPassword("my-secret-pass", hash)).toBe(true);
  });

  it("rejects wrong password", async () => {
    const hash = await hashPassword("my-secret-pass");
    expect(await verifyPassword("wrong-pass", hash)).toBe(false);
  });

  it("different hashes for same input (bcrypt salt)", async () => {
    const a = await hashPassword("same");
    const b = await hashPassword("same");
    expect(a).not.toBe(b);
  });
});
