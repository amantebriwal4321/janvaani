// Push the Unmute-compiled SLNG agent body to the hosted agent that Live Call
// mode connects to. `unmute deploy` does this through the `voiceai` CLI, which
// only ships for macOS/Windows today; this is the same PATCH, done directly.
//
//   unmute compile unmute/janvaani      # writes unmute/janvaani/build/slng/agent.json
//   node scripts/push-agent.mjs          # PATCH https://api.agents.slng.ai/v1/agents/$SLNG_AGENT_ID
import fs from "node:fs";
import path from "node:path";

const envFile = path.resolve(".env.local");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
const key = process.env.SLNG_API_KEY;
const agentId = process.env.SLNG_AGENT_ID;
if (!key || !agentId) {
  console.error("Set SLNG_API_KEY and SLNG_AGENT_ID (in .env.local or the environment).");
  process.exit(1);
}

const bodyPath = path.resolve("unmute/janvaani/build/slng/agent.json");
if (!fs.existsSync(bodyPath)) {
  console.error(`Missing ${bodyPath}. Run: unmute compile unmute/janvaani`);
  process.exit(1);
}
const compiled = JSON.parse(fs.readFileSync(bodyPath, "utf8"));

// Region is immutable after creation and `name` is the dashboard label, so only
// the behaviour fields travel in the update.
const patch = {
  system_prompt: compiled.system_prompt,
  greeting: compiled.greeting,
  models: compiled.models,
  enable_interruptions: compiled.enable_interruptions,
};

const res = await fetch(`https://api.agents.slng.ai/v1/agents/${agentId}`, {
  method: "PATCH",
  headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
  body: JSON.stringify(patch),
});
const json = await res.json().catch(() => ({}));
if (!res.ok) {
  console.error(`PATCH failed (${res.status}):`, json);
  process.exit(1);
}
console.log(`Updated agent ${json.id ?? agentId} (${json.name ?? "?"}) in region ${json.region ?? "?"}`);
console.log(`  stt ${json.models?.stt}  llm ${json.models?.llm}  tts ${json.models?.tts} (${json.models?.tts_voice})`);
console.log(`  greeting: ${String(json.greeting ?? "").slice(0, 60)}...`);
console.log(`  prompt: ${String(json.system_prompt ?? "").length} chars`);
