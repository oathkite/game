export const inviteRoom = (href: string): string | null => {
  const room = new URL(href).searchParams.get("room")?.toUpperCase();
  return room && /^[A-F0-9]{6}$/.test(room) ? room : null;
};
export const roomInviteUrl = (href: string, roomId: string): string => {
  if (!/^[A-F0-9]{6}$/.test(roomId)) throw new Error("invalid room");
  const current = new URL(href), url = new URL(current.pathname, current.origin);
  if (current.searchParams.get("prototype") === "world") url.searchParams.set("prototype", "world");
  url.searchParams.set("room", roomId);
  return url.href;
};
