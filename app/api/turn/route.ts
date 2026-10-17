import { NextRequest } from "next/server";
import { z } from "zod";
import { CitizenProfileSchema } from "@/lib/profile/schema";
import { runTurn } from "@/lib/turn";

export const runtime = "nodejs";

const Body = z.object({
  text: z.string().min(1).max(2000),
  profile: CitizenProfileSchema.partial().default({}),
  stage: z.enum(["intake", "audit", "done"]).default("intake"),
  pendingField: z.string().nullable().default(null),
  lang: z.enum(["auto", "hi", "kn", "te", "ta", "mr", "en"]).default("auto"),
  sessionId: z.string().min(1).max(200).default("local"),
  useLlm: z.boolean().default(true),
});

export async function POST(req: NextRequest) {
  const t0 = Date.now();
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  const b = parsed.data;
  try {
    const out = await runTurn({
      text: b.text,
      profile: CitizenProfileSchema.parse(b.profile),
      stage: b.stage,
      pendingField: (b.pendingField as never) ?? null,
      lang: b.lang,
      sessionId: b.sessionId.replace(/[^A-Za-z0-9_-]/g, "_"),
      useLlm: b.useLlm,
    });
    return Response.json({ ...out, serverMs: Date.now() - t0 });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Turn failed" }, { status: 500 });
  }
}
