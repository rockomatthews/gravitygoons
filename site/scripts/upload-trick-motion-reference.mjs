import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, mkdirSync } from "node:fs";
import { basename, join } from "node:path";
import { tmpdir } from "node:os";
import { createClient } from "@supabase/supabase-js";

const trickName = process.argv[2];
const sourcePath = process.argv[3];
if (!trickName || !sourcePath) throw new Error("Usage: npm run upload:trick-reference -- \"Kickflip\" /absolute/path/to/source.mp4 [--extract-only]");
const extractOnly = process.argv.includes("--extract-only");
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!extractOnly && (!supabaseUrl || !serviceRoleKey)) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required unless --extract-only is used.");

const catalogUrl = new URL("../src/data/skate-motion-references.json", import.meta.url);
const catalog = JSON.parse(readFileSync(catalogUrl, "utf8"));
const reference = catalog.references.find((item) => item.discipline === "Skateboarding" && item.trickName.toLowerCase() === trickName.toLowerCase());
if (!reference?.sourceSha256) throw new Error(`No dedicated source is cataloged for ${trickName}.`);

const sourceBytes = readFileSync(sourcePath);
const sourceSha256 = createHash("sha256").update(sourceBytes).digest("hex");
if (sourceSha256 !== reference.sourceSha256) throw new Error(`Source checksum mismatch for ${basename(sourcePath)}.`);

const outputDirectory = join(tmpdir(), "gravity-goons-dedicated-motion-references");
mkdirSync(outputDirectory, { recursive: true });
const outputPath = join(outputDirectory, basename(reference.objectPath));
execFileSync("ffmpeg", [
  "-hide_banner", "-loglevel", "error", "-y",
  "-ss", String(reference.startSeconds), "-t", String(reference.durationSeconds), "-i", sourcePath,
  "-an", "-vf", "scale=-2:720", "-c:v", "libx264", "-preset", "medium", "-crf", "20",
  "-pix_fmt", "yuv420p", "-movflags", "+faststart", outputPath,
]);
const clipBytes = readFileSync(outputPath);
const clipSha256 = createHash("sha256").update(clipBytes).digest("hex");

if (!extractOnly) {
  const bucket = "move-reference-clips";
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) throw listError;
  if (!buckets.some((item) => item.id === bucket)) {
    const { error } = await supabase.storage.createBucket(bucket, { public: false, fileSizeLimit: 12 * 1024 * 1024, allowedMimeTypes: ["video/mp4"] });
    if (error) throw error;
  }
  const { error: uploadError } = await supabase.storage.from(bucket).upload(reference.objectPath, clipBytes, { contentType: "video/mp4", cacheControl: "3600", upsert: true });
  if (uploadError) throw uploadError;
  const { data: downloaded, error: downloadError } = await supabase.storage.from(bucket).download(reference.objectPath);
  if (downloadError) throw downloadError;
  const remoteSha256 = createHash("sha256").update(Buffer.from(await downloaded.arrayBuffer())).digest("hex");
  if (remoteSha256 !== clipSha256) throw new Error(`Uploaded clip verification failed for ${reference.objectPath}.`);
}

console.log(`${reference.sourceLabel} -> ${reference.objectPath} (${clipBytes.length} bytes, sha256 ${clipSha256})${extractOnly ? " extracted" : " uploaded and verified"}`);
