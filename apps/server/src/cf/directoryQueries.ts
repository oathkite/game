// Keep the quick queue independent of the public listing's pagination limit.
export const quickCandidateQuery = `
  SELECT id FROM rooms
  WHERE expires >= ? AND json_extract(summary, '$.mode') = ?
    AND json_extract(summary, '$.region') = ?
    AND json_extract(summary, '$.phase') = 'waiting'
    AND json_extract(summary, '$.members') +
      (SELECT COUNT(*) FROM reservations WHERE room_id = id) < ?
  ORDER BY expires, id LIMIT 1`;
