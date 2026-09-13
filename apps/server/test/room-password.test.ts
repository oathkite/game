import { expect, it } from "vitest";
import { hashRoomPassword, verifyRoomPassword } from "../src/cf/roomPassword";
it("stores salted hashes and rejects incorrect passwords", async () => {
  const first = await hashRoomPassword("test-secret"), second = await hashRoomPassword("test-secret");
  expect(first.hash).not.toBe(second.hash);
  expect(JSON.stringify(first)).not.toContain("test-secret");
  expect(await verifyRoomPassword("test-secret", first)).toBe(true);
  expect(await verifyRoomPassword("wrong", first)).toBe(false);
});
