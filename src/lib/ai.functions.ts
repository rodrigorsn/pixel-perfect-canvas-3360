import { createServerFn } from "@tanstack/react-start";
import { Output, streamText } from "ai";
import { z } from "zod";
import { MODEL_ID, createDeepSeekProvider } from "./ai-gateway.server";

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

const TextInput = z.object({
  system: z.string(),
  messages: z.array(MessageSchema).min(1),
});

export const aiText = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => TextInput.parse(input))
  .handler(async ({ data }) => {
    const deepseek = createDeepSeekProvider();
    const result = streamText({
      model: deepseek(MODEL_ID),
      system: data.system,
      messages: data.messages,
    });
    const text = await result.text;
    return { text: text.trim() };
  });

const schemas = {
  features: z.object({
    features: z.array(
      z.object({
        name: z.string(),
        slug: z.string(),
        description: z.string(),
      }),
    ),
  }),
  tasks: z.object({
    tasks: z.array(
      z.object({
        title: z.string(),
        kind: z.enum(["prototype", "functional"]),
        dependsOn: z.array(z.string()),
        objective: z.string(),
        files: z.array(z.string()),
        refs: z.array(z.string()),
        actions: z.array(z.object({ action: z.string(), expectedResult: z.string() })),
        acceptanceCriteria: z.array(z.string()),
        howToVerify: z.string(),
        outOfScope: z.string(),
      }),
    ),
  }),
  arquitetura: z.object({
    doc: z.string(),
    adrs: z.array(
      z.object({
        number: z.number(),
        title: z.string(),
        content: z.string(),
      }),
    ),
  }),
  telas: z.object({
    pages: z.array(
      z.object({
        name: z.string(),
        route: z.string(),
        purpose: z.string(),
        components: z.array(
          z.object({
            name: z.string(),
            description: z.string(),
            behaviors: z.array(
              z.object({ trigger: z.string(), expectedResult: z.string(), errorCase: z.string() }),
            ),
          }),
        ),
      }),
    ),
  }),
  wireframe: z.object({ html: z.string() }),
  coerencia: z.object({
    issues: z.array(
      z.object({
        title: z.string(),
        description: z.string(),
        locations: z.array(z.string()),
        suggestion: z.string(),
        severity: z.enum(["alta", "media", "baixa"]),
      }),
    ),
  }),
} as const;

export type AiJsonKind = keyof typeof schemas;

const JsonInput = z.object({
  kind: z.enum(["features", "tasks", "arquitetura", "telas", "wireframe", "coerencia"]),
  system: z.string(),
  prompt: z.string(),
});

export const aiJson = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => JsonInput.parse(input))
  .handler(async ({ data }) => {
    const deepseek = createDeepSeekProvider();
    const schema = schemas[data.kind] as unknown as z.ZodType<Record<string, unknown>>;
    const result = streamText({
      model: deepseek(MODEL_ID),
      system: data.system,
      prompt: data.prompt,
      output: Output.object({ schema }),
    });
    return { json: JSON.stringify(await result.output) };
  });
