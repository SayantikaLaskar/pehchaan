// One-off check: Kannada text → speech (Bulbul v3) → text (Saaras v4).
// Run: node --env-file=.env scripts/sarvam-check.mjs [out.wav]
import { writeFileSync, readFileSync } from "node:fs";

const key = process.env.SARVAM_API_KEY;
if (!key) throw new Error("SARVAM_API_KEY missing — add it to .env");
const out = process.argv[2] ?? "sarvam-check.wav";
const text = "ನಮಸ್ಕಾರ ಮಂಜುನಾಥ್ ಅವರೇ, ನಿಮ್ಮ ನಿಜವಾದ ವ್ಯಾಪಾರ ನಲವತ್ತು ಲಕ್ಷಕ್ಕಿಂತ ಕಡಿಮೆ.";

const tts = await fetch("https://api.sarvam.ai/text-to-speech", {
  method: "POST",
  headers: { "api-subscription-key": key, "Content-Type": "application/json" },
  body: JSON.stringify({ text, language_code: "kn-IN", model: "bulbul:v3", speaker: "kavya" }),
});
if (!tts.ok) throw new Error(`TTS ${tts.status}: ${await tts.text()}`);
const { audios, request_id } = await tts.json();
writeFileSync(out, Buffer.from(audios[0], "base64"));
console.log(`TTS ok (request ${request_id}) → ${out}`);

const form = new FormData();
form.append("file", new Blob([readFileSync(out)], { type: "audio/wav" }), "check.wav");
form.append("model", "saaras:v4");
form.append("language_code", "kn-IN");
const stt = await fetch("https://api.sarvam.ai/speech-to-text", { method: "POST", headers: { "api-subscription-key": key }, body: form });
if (!stt.ok) throw new Error(`STT ${stt.status}: ${await stt.text()}`);
const { transcript } = await stt.json();
console.log(`STT ok → "${transcript}"`);
