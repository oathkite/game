import { cpuSituationSchema, cpuDecisionSchema } from "@game/protocol/cpu";
import { readSmallJson } from "../rooms/readSmallJson.js";

type Limiter = { readonly limit: (input: { key: string }) => Promise<{ success: boolean }> };
export type CpuEnvironment = { readonly ALLOWED_ORIGINS: string; readonly TYPESAFE_API_KEY?: string | undefined; readonly JEV_MODEL: string; readonly JEV_ENABLED: string; readonly CPU_LIMITER: Limiter; readonly CPU_TOTAL_LIMITER: Limiter };
const questions = {
  movement: { type: "choice", instructions: "Choose plausible positioning for a human-like artillery player. Consider HP, range, safe left/right steps and whether the last shot hit. Avoid pointless repeated movement. self is CPU; x increases right.", criteria: { hold: "Keep a useful firing position or stay when paths are blocked", approach: "Close excessive distance via a safe path", retreat: "Create space or protect low HP via a safe path" } },
  weapon: { type: "choice", instructions: "Which equipped weapon suits this situation without always maximizing damage?", criteria: { cannon: "A simple, deliberate single shot", triple: "A spread shot when uncertain or under pressure" } },
  trajectory: { type: "choice", instructions: "Choose a plausible shot style from relative elevation, distance and terrain (9 ground heights from self to opponent; smaller y is higher ground). Use a lob for intervening high ground. Do not assume perfect aim.", criteria: { direct: "Lower arc, angle 10 to 40 degrees", lob: "Higher arc, angle 50 to 80 degrees" } },
  pace: { type: "choice", instructions: "Choose a human-like pace. Consider difficulty, HP, distance, wind and previous miss. Do not always act at maximum speed.", criteria: { quick: "Familiar simple shot, act promptly", steady: "Normal adjustment and brief consideration", careful: "Difficult wind, range or previous miss; take a little more care" } },
};

export const handleCpuRequest = async (request: Request, env: CpuEnvironment, fetcher: typeof fetch = fetch): Promise<Response> => {
  const origin = request.headers.get("Origin") ?? "";
  const headers = { "Access-Control-Allow-Origin": origin, "Vary": "Origin", "Cache-Control": "no-store" };
  if (!env.ALLOWED_ORIGINS.split(",").includes(origin)) return new Response("origin denied", { status: 403 });
  if (new URL(request.url).pathname !== "/decision") return new Response("not found", { status: 404, headers });
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...headers, "Access-Control-Allow-Methods": "POST", "Access-Control-Allow-Headers": "Content-Type" } });
  if (request.method !== "POST") return new Response("method not allowed", { status: 405, headers });
  if (env.JEV_ENABLED !== "true" || !env.TYPESAFE_API_KEY) return new Response("cpu unavailable", { status: 503, headers });
  const input = cpuSituationSchema.safeParse(await readSmallJson(request));
  if (!input.success) return new Response("invalid situation", { status: 400, headers });
  const ip = request.headers.get("CF-Connecting-IP") ?? "local";
  if (!(await env.CPU_LIMITER.limit({ key: ip })).success || !(await env.CPU_TOTAL_LIMITER.limit({ key: "cpu" })).success) return new Response("rate limited", { status: 429, headers });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);
  try {
    const response = await fetcher("https://api.typesafe.ai/v1/systemone", { method: "POST", signal: controller.signal,
      headers: { Authorization: `Bearer ${env.TYPESAFE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: env.JEV_MODEL, state: JSON.stringify(input.data), questions }),
    });
    if (!response.ok) return new Response("cpu upstream unavailable", { status: 502, headers });
    const data = await readAnswer(response);
    return data ? Response.json(data, { headers }) : new Response("invalid cpu answer", { status: 502, headers });
  } catch { return new Response("cpu request failed", { status: 502, headers }); }
  finally { clearTimeout(timeout); }
};

const readAnswer = async (response: Response) => {
  // Jev応答もサイズ制限を設け、任意の文字列や命令をクライアントへ渡さない。
  const reader = response.body?.getReader();
  if (!reader) return null;
  let content = "", bytes = 0;
  const decoder = new TextDecoder();
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 16384) { await reader.cancel(); return null; }
      content += decoder.decode(chunk.value, { stream: true });
    }
    content += decoder.decode();
    const raw: unknown = JSON.parse(content);
    if (!raw || typeof raw !== "object" || !("answers" in raw) || !raw.answers || typeof raw.answers !== "object") return null;
    const answers = raw.answers as Record<string, unknown>;
    const values = Object.fromEntries(Object.keys(questions).map(key => {
      const answer = answers[key];
      return [key, answer && typeof answer === "object" && "choice" in answer ? answer.choice : null];
    }));
    const result = cpuDecisionSchema.safeParse(values);
    return result.success ? result.data : null;
  } finally { reader.releaseLock(); }
};
