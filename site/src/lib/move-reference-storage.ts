const MAX_REFERENCE_BYTES = 12 * 1024 * 1024;

type ReferenceDescriptor = {
  objectPath: string;
  publicPath?: string;
};

export type ReferenceBucket = {
  list(path: string, options: { limit: number; search: string }): Promise<{ data: Array<{ name: string }> | null; error: { message: string } | null }>;
  upload(path: string, body: ArrayBuffer, options: { cacheControl: string; contentType: string; upsert: boolean }): Promise<{ error: { message: string } | null }>;
};

function objectLocation(objectPath: string): { directory: string; filename: string } {
  const separator = objectPath.lastIndexOf("/");
  if (separator < 1 || separator === objectPath.length - 1) throw new Error("The motion-reference object path is invalid.");
  return { directory: objectPath.slice(0, separator), filename: objectPath.slice(separator + 1) };
}

export async function ensureMoveReferenceStored(
  bucket: ReferenceBucket,
  reference: ReferenceDescriptor,
  siteUrl: string | null,
  fetchReference: typeof fetch = fetch,
): Promise<"existing" | "uploaded"> {
  const { directory, filename } = objectLocation(reference.objectPath);
  const listed = await bucket.list(directory, { limit: 10, search: filename });
  if (listed.error) throw new Error(listed.error.message);
  if (listed.data?.some((item) => item.name === filename)) return "existing";

  if (!reference.publicPath || !siteUrl?.startsWith("https://")) {
    throw new Error("The packaged motion-reference source is unavailable.");
  }
  const response = await fetchReference(`${siteUrl.replace(/\/$/, "")}${reference.publicPath}`, {
    redirect: "follow",
    signal: AbortSignal.timeout(20_000),
  });
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!response.ok || !contentType.startsWith("video/mp4")) {
    await response.body?.cancel();
    throw new Error(`The packaged motion-reference video could not be copied (HTTP ${response.status}).`);
  }
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_REFERENCE_BYTES) {
    throw new Error("The packaged motion-reference video has an invalid size.");
  }
  const uploaded = await bucket.upload(reference.objectPath, bytes, {
    cacheControl: "31536000",
    contentType: "video/mp4",
    upsert: true,
  });
  if (uploaded.error) throw new Error(uploaded.error.message);
  return "uploaded";
}
