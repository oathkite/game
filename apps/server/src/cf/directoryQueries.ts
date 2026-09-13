import type { RoomListFilter } from "@game/protocol/v2-rooms";
// Keep the quick queue independent of the public listing's pagination limit.
export const quickCandidateQuery = `
  SELECT id FROM rooms
  WHERE expires >= ? AND json_extract(summary, '$.mode') = ?
    AND json_extract(summary, '$.region') = ?
    AND json_extract(summary, '$.phase') = 'waiting'
    AND json_extract(summary, '$.members') +
      (SELECT COUNT(*) FROM reservations WHERE room_id = id) < ?
  ORDER BY expires, id LIMIT 1`;

export const roomPageQuery = (after: string, now: number, filter: RoomListFilter) => {
  const clauses = ["expires >= ?", "json_extract(summary, '$.members') > 0", "json_extract(summary, '$.mode') = 'custom'"];
  const bindings: (string | number)[] = [now];
  if (after) {
    const [createdAt, id] = after.split(":");
    clauses.push("(COALESCE(json_extract(summary, '$.createdAt'), 0) < ? OR (COALESCE(json_extract(summary, '$.createdAt'), 0) = ? AND id > ?))");
    bindings.push(Number(createdAt), Number(createdAt), id!);
  }
  if (filter.code) { clauses.push("instr(id, ?) > 0"); bindings.push(filter.code); }
  if (filter.map) { clauses.push("json_extract(summary, '$.mapId') = ?"); bindings.push(filter.map); }
  if (filter.phase) { clauses.push("json_extract(summary, '$.phase') = ?"); bindings.push(filter.phase); }
  if (filter.vacancy) clauses.push("json_extract(summary, '$.phase') = 'waiting'", "json_extract(summary, '$.members') < 8");
  return { sql: `SELECT id, summary FROM rooms WHERE ${clauses.join(" AND ")} ORDER BY COALESCE(json_extract(summary, '$.createdAt'), 0) DESC, id ASC LIMIT 21`, bindings };
};
