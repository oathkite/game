import { MULTIPLAYER_MAPS } from "@game/maps";
import { expect, it } from "vitest";
import { roomMapChoiceAllowed } from "../src/cf/roomMapChoice";

it("accepts every multiplayer map and random when a room is created", () => {
  for (const map of MULTIPLAYER_MAPS) expect(roomMapChoiceAllowed(map.id)).toBe(true);
  expect(roomMapChoiceAllowed("random")).toBe(true);
});

it("rejects maps that rooms cannot start on", () => {
  expect(roomMapChoiceAllowed("")).toBe(false);
  expect(roomMapChoiceAllowed("valley")).toBe(false);
  expect(roomMapChoiceAllowed("Random")).toBe(false);
});
