import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, mkdirSync } from "node:fs";
import { basename, join } from "node:path";
import { tmpdir } from "node:os";
import { createClient } from "@supabase/supabase-js";

const sourcePath = process.argv[2];
if (!sourcePath) throw new Error("Usage: npm run prepare:skate-references -- /absolute/path/to/source.mp4");
const extractOnly = process.argv.includes("--extract-only");
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!extractOnly && (!supabaseUrl || !serviceRoleKey)) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required unless --extract-only is used.");

const catalogUrl = new URL("../src/data/skate-motion-references.json", import.meta.url);
const catalog = JSON.parse(readFileSync(catalogUrl, "utf8"));
const sourceBytes = readFileSync(sourcePath);
const sha256 = createHash("sha256").update(sourceBytes).digest("hex");
if (sha256 !== catalog.source.sha256) throw new Error(`Source checksum mismatch for ${basename(sourcePath)}.`);

const outputDirectory = join(tmpdir(), "gravity-goons-skate-motion-references");
mkdirSync(outputDirectory, { recursive: true });
const supabase = extractOnly ? null : createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
const bucket = "move-reference-clips";
if (supabase) {
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) throw listError;
  if (!buckets.some((item) => item.id === bucket)) {
    const { error } = await supabase.storage.createBucket(bucket, { public: false, fileSizeLimit: 12 * 1024 * 1024, allowedMimeTypes: ["video/mp4"] });
    if (error) throw error;
  }
}

for (const reference of catalog.references) {
  const outputPath = join(outputDirectory, basename(reference.objectPath));
  execFileSync("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y",
    "-ss", String(reference.startSeconds), "-t", String(reference.durationSeconds), "-i", sourcePath,
    "-an", "-vf", "scale=720:1280:flags=lanczos,setsar=1", "-r", "30",
    "-c:v", "libx264", "-profile:v", "high", "-level:v", "4.0", "-preset", "medium", "-crf", "18",
    "-pix_fmt", "yuv420p", "-movflags", "+faststart", outputPath,
  ]);
  const clipBytes = readFileSync(outputPath);
  if (supabase) {
    const { error } = await supabase.storage.from(bucket).upload(reference.objectPath, clipBytes, { contentType: "video/mp4", cacheControl: "3600", upsert: true });
    if (error) throw error;
  }
  console.log(`${reference.sourceLabel} -> ${outputPath} (${clipBytes.length} bytes)${extractOnly ? "" : " uploaded"}`);
}

console.log(extractOnly
  ? `Extracted ${catalog.references.length} motion references without uploading.`
  : `Uploaded ${catalog.references.length} private motion references to ${bucket}.`);
