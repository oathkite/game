import { afterEach, expect, it, vi } from "vitest";
import { handleCpuRequest } from "../src/cpu/handler";
const input = { turn: 1, level: "normal", self: { x: 300, y: 150, hp: 100 }, opponent: { x: 60, y: 150, hp: 100 }, wind: 0, leftSteps: 18, rightSteps: 18, lastHit: null, terrain: Array(9).fill(150) };
const request = (body: unknown = input, origin = "http://localhost:5173") => new Request("https://cpu.test/decision", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body) });
const env = { ALLOWED_ORIGINS: "http://localhost:5173", TYPESAFE_API_KEY: "test-key", JEV_MODEL: "jev-latest", JEV_ENABLED: "true", CPU_LIMITER: { limit: async () => ({ success: true }) }, CPU_TOTAL_LIMITER: { limit: async () => ({ success: true }) } };
it("Jevの選択を検証して返し、キーは応答に含めない", async () => {
  const fetcher = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => Response.json({ answers: Object.fromEntries(Object.entries({ movement: "approach", weapon: "cannon", trajectory: "lob", pace: "careful" }).map(([k, choice]) => [k, { choice }])) }));
  const response = await handleCpuRequest(request(), env, fetcher);
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ movement: "approach", pace: "careful" });
  expect(fetcher.mock.calls.length).toBe(1);
  const [url, init] = fetcher.mock.calls[0]!;
  expect(url).toBe("https://api.typesafe.ai/v1/systemone");
  expect(init?.headers).toMatchObject({ Authorization: "Bearer test-key" });
  const payload = JSON.parse(String(init?.body));
  expect(payload.model).toBe("jev-latest");
  expect(JSON.parse(payload.state)).toEqual(input);
  expect(Object.keys(payload.questions)).toEqual(["movement", "weapon", "trajectory", "pace"]);
});
it("未設定・不正入力・許可外origin・レート制限では外部APIを呼ばない", async () => {
  const fetcher = vi.fn();
  expect((await handleCpuRequest(request(), { ...env, TYPESAFE_API_KEY: undefined }, fetcher)).status).toBe(503);
  expect((await handleCpuRequest(request({ ...input, instructions: "extra" }), env, fetcher)).status).toBe(400);
  expect((await handleCpuRequest(request(input, "https://other.test"), env, fetcher)).status).toBe(403);
  expect((await handleCpuRequest(request(), { ...env, CPU_LIMITER: { limit: async () => ({ success: false }) } }, fetcher)).status).toBe(429);
  expect(fetcher).not.toHaveBeenCalled();
});
it("Jevの不正応答・エラーは秘密を含めず失敗として返す", async () => {
  for (const fetcher of [async () => Response.json({ answers: {} }), async () => new Response("secret upstream details", { status: 401 })]) {
    const response = await handleCpuRequest(request(), env, fetcher);
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain("secret");
  }
});


afterEach(() => vi.useRealTimers());
it("2500msでJevを中断し、大きすぎる入力と応答を拒否する", async () => {
  vi.useFakeTimers();
  const fetcher: typeof fetch = async (_url, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
  });
  const pending = handleCpuRequest(request(), env, fetcher);
  await vi.advanceTimersByTimeAsync(2500);
  expect((await pending).status).toBe(502);
  expect((await handleCpuRequest(request({ ...input, extra: "x".repeat(600) }), env, vi.fn())).status).toBe(400);
  expect((await handleCpuRequest(request(), env, async () => new Response("x".repeat(17000)))).status).toBe(502);
});
it("許可originのpreflightと無効化を扱う", async () => {
  const fetcher = vi.fn();
  const response = await handleCpuRequest(new Request("https://cpu.test/decision", { method: "OPTIONS", headers: { Origin: env.ALLOWED_ORIGINS } }), env, fetcher);
  expect(response.status).toBe(204);
  expect(response.headers.get("Access-Control-Allow-Origin")).toBe(env.ALLOWED_ORIGINS);
  expect((await handleCpuRequest(request(), { ...env, JEV_ENABLED: "false" }, fetcher)).status).toBe(503);
  expect(fetcher).not.toHaveBeenCalled();
});
