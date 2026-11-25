import { supabase } from "./auth";

/**
 * A PDF too large for one request (over about 3 MB): uploaded to the pilot's own folder of the private "imports"
 * bucket. The server reads it once and deletes it. Null when it cannot be uploaded (signed out, local mode).
 */
export async function uploadImportPdf(bytes: ArrayBuffer): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  const uid = data.user?.id;
  if (!uid) return null;
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const path = `${uid}/${id}.pdf`;
  const { error } = await supabase.storage.from("imports").upload(path, bytes, { contentType: "application/pdf", upsert: false });
  return error ? null : path;
}
