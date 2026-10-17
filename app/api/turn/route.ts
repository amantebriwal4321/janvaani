import { NextRequest } from "next/server";
import { z } from "zod";
import { CitizenProfileSchema } from "@/lib/profile/schema";
import { runTurn } from "@/lib/turn";
import { DEFAULT_REPLY_LANG, REPLY_LANG_IDS } from "@/lib/models";
import { jsonResponse } from "@/lib/http";


const Body = z.object({
  text: z.string().min(1).max(2000),
  profile: CitizenProfileSchema.partial().default({}),
  stage: z.enum(["intake", "audit", "done"]).default("intake"),
  pendingField: z.string().nullable().default(null),
  // Language to reply (and speak) in. "auto" follows the citizen's message.
  replyLang: z.enum(REPLY_LANG_IDS).optional(),
  // Legacy name for replyLang, kept for older clients.
  lang: z.enum(REPLY_LANG_IDS).optional(),
  sessionId: z.string().min(1).max(200).default("local"),
  useLlm: z.boolean().default(true),
});

export async function POST(req: NextRequest) {
  const t0 = Date.now();
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return jsonResponse({ error: "Invalid request", issues: parsed.error.issues }, 400);
  const b = parsed.data;
  try {
    const out = await runTurn({
      text: b.text,
      profile: CitizenProfileSchema.parse(b.profile),
      stage: b.stage,
      pendingField: (b.pendingField as never) ?? null,
      replyLang: b.replyLang ?? b.lang ?? DEFAULT_REPLY_LANG,
      sessionId: b.sessionId.replace(/[^A-Za-z0-9_-]/g, "_"),
      useLlm: b.useLlm,
    });
    return jsonResponse({ ...out, serverMs: Date.now() - t0 });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : "Turn failed" }, 500);
  }
}
