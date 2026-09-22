import { handleCpuRequest } from "../cpu/handler.js";
export default {
  fetch(request: Request, env: CpuWorkerEnv & { TYPESAFE_API_KEY?: string }): Promise<Response> {
    return handleCpuRequest(request, env);
  },
};
