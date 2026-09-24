import { createServerFn } from "@tanstack/react-start";
import { Output, streamText } from "ai";
import { z } from "zod";
import { MODEL_ID, RESPONSES_OPTIONS, createResponsesProvider } from "./ai-gateway.server";

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
    const lovable = createResponsesProvider();
    const result = streamText({
      model: lovable.responses(MODEL_ID),
      system: data.system,
      messages: data.messages,
      providerOptions: RESPONSES_OPTIONS,
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
        code: z.string(),
        title: z.string(),
        markdown: z.string(),
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
    markdown: z.string(),
    wireframeHtml: z.string(),
  }),
} as const;

export type AiJsonKind = keyof typeof schemas;

const JsonInput = z.object({
  kind: z.enum(["features", "tasks", "arquitetura", "telas"]),
  system: z.string(),
  prompt: z.string(),
});

export const aiJson = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => JsonInput.parse(input))
  .handler(async ({ data }) => {
    const lovable = createResponsesProvider();
    const schema = schemas[data.kind] as unknown as z.ZodType<Record<string, unknown>>;
    const result = streamText({
      model: lovable.responses(MODEL_ID),
      system: data.system,
      prompt: data.prompt,
      output: Output.object({ schema }),
      providerOptions: RESPONSES_OPTIONS,
    });
    return { json: JSON.stringify(await result.output) };
  });
