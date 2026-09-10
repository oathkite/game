import { expect, it } from "vitest";
import { inviteRoom, roomInviteUrl } from "../src/worldUi/roomInvite";
it("accepts only six hexadecimal room codes", () => {
  expect(inviteRoom("https://game.example/?room=abcdef")).toBe("ABCDEF");
  expect(inviteRoom("https://game.example/?room=bad%3Cscript%3E")).toBeNull();
  expect(inviteRoom("https://game.example/")).toBeNull();
});
it("shares the room without carrying unrelated parameters or private tokens", () => {
  expect(roomInviteUrl("https://game.example/?token=private&room=OLD#secret", "ABCDEF")).toBe("https://game.example/?room=ABCDEF");
  expect(roomInviteUrl("http://localhost:5186/?prototype=world&token=private", "ABCDEF")).toBe("http://localhost:5186/?prototype=world&room=ABCDEF");
});
