import { createDeepSeek } from "@ai-sdk/deepseek";

export function createDeepSeekProvider() {
  const key = process.env["DEEPSEEK_API_KEY"];
  if (!key) throw new Error("DEEPSEEK_API_KEY ausente");

  return createDeepSeek({ apiKey: key });
}

export const MODEL_ID = "deepseek-flash";
