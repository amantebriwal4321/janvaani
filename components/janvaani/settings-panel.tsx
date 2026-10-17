"use client";

import { Settings2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BULBUL_VOICES, LANG_IDS, LANGS, STT_MODELS, TTS_MODELS, type ReplyLang, type SttModelId, type TtsModelId } from "@/lib/models";
import type { JanVaani } from "@/lib/client/use-janvaani";

export function SettingsPanel({ jv }: { jv: JanVaani }) {
  const { settings, setSettings, health } = jv;
  const upd = <K extends keyof typeof settings>(k: K, v: (typeof settings)[K]) => setSettings((s) => ({ ...s, [k]: v }));

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Settings2 data-icon="inline-start" /> Models
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Execution layer</DialogTitle>
          <DialogDescription>Swap any component without changing a line of app code. Every option runs through SLNG&apos;s India gateway and bills to the same project.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Row label="Reply language" hint="JanVaani answers and speaks in this language whatever the citizen types or says. Hindi, Kannada, Punjabi, Bhojpuri, Assamese, Telugu, Tamil, Marathi, or English. Auto follows the citizen. Bhojpuri is spoken with the Hindi voice, Assamese with the Bengali voice.">
            <Select value={settings.replyLang} onValueChange={(v) => v && upd("replyLang", v as ReplyLang)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {LANG_IDS.map((l) => <SelectItem key={l} value={l}>{LANGS[l].native} ({LANGS[l].label})</SelectItem>)}
                <SelectItem value="auto">Auto (match the citizen)</SelectItem>
              </SelectContent>
            </Select>
          </Row>
          <Row label="Ears (speech to text)">
            <Select value={settings.stt} onValueChange={(v) => v && upd("stt", v as SttModelId)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STT_MODELS.map((m) => <SelectItem key={m.id} value={m.id}>{m.label} <span className="text-muted-foreground">- {m.langs}</span></SelectItem>)}
              </SelectContent>
            </Select>
          </Row>
          <Row label="Voice (text to speech)">
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <Select value={settings.tts} onValueChange={(v) => v && upd("tts", v as TtsModelId)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TTS_MODELS.map((m) => <SelectItem key={m.id} value={m.id}>{m.label} <span className="text-muted-foreground">- {m.langs}</span></SelectItem>)}
                </SelectContent>
              </Select>
              {settings.tts === "sarvam/bulbul:v3" && (
                <Select value={settings.voice} onValueChange={(v) => v && upd("voice", v)}>
                  <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>{BULBUL_VOICES.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                </Select>
              )}
            </div>
          </Row>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label htmlFor="llm" className="text-sm">Brain: LLM extraction via Context Router</Label>
              <p className="text-xs text-muted-foreground">Off = deterministic rule engine only (zero LLM cost, instant). The scheme rules are code either way.</p>
            </div>
            <Switch id="llm" checked={settings.useLlm} onCheckedChange={(v) => upd("useLlm", v)} />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label htmlFor="speak" className="text-sm">Speak replies aloud</Label>
              <p className="text-xs text-muted-foreground">{health?.slng ? "Synthesised with the voice model above." : "Needs SLNG_API_KEY."}</p>
            </div>
            <Switch id="speak" checked={settings.speak} onCheckedChange={(v) => upd("speak", v)} disabled={!health?.slng} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
