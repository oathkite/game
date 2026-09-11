/** HTTP round trip to the selected Room Object, including cold-start/transport overhead. */
export const measureRoomRtt = async (socketUrl: string, request: typeof fetch = fetch, now = () => performance.now()): Promise<number | null> => {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 2000);
  try {
    const url = new URL(socketUrl), roomId = url.pathname.split("/").at(-1);
    url.protocol = url.protocol === "wss:" ? "https:" : "http:";
    url.pathname += "/probe";
    const start = now();
    const response = await request(url.href, { cache: "no-store", signal: controller.signal });
    if (!response.ok || (await response.json()).roomId !== roomId) return null;
    return Math.max(0, Math.round(now() - start));
  } catch { return null; }
  finally { clearTimeout(timer); }
};
