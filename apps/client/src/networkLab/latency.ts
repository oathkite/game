/** Local monotonic round-trip measurement; never compare client/server wall clocks. */
export const measureLatency = (socket: WebSocket, update: (milliseconds: number | null) => void) => {
  let nonce = 0, pending: { nonce: number; sent: number } | null = null;
  update(null);
  const probe = () => {
    if (socket.readyState !== WebSocket.OPEN || document.hidden) { pending = null; update(null); return; }
    if (pending) update(null);
    pending = { nonce: ++nonce, sent: performance.now() };
    socket.send(JSON.stringify({ type: "room.ping", nonce }));
  };
  const receive = (event: MessageEvent) => {
    let data; try { data = JSON.parse(String(event.data)); } catch { return; }
    if (data?.type !== "room.pong" || !pending || data.nonce !== pending.nonce) return;
    const elapsed = performance.now() - pending.sent;
    pending = null;
    update(document.hidden ? null : Math.round(elapsed));
  };
  const close = () => { pending = null; update(null); };
  socket.addEventListener("message", receive);
  socket.addEventListener("close", close);
  const timer = setInterval(probe, 5000);
  probe();
  return () => { clearInterval(timer); socket.removeEventListener("message", receive); socket.removeEventListener("close", close); };
};
