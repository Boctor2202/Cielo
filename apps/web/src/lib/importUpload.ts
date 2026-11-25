"use client";

import { supabase } from "@/lib/supabase";

/**
 * A PDF too large for one request (over about 3 MB): uploaded to the pilot's own folder of the private "imports"
 * bucket. The server reads it once and deletes it. Null when it cannot be uploaded (signed out, local mode).
 */
export async function uploadImportPdf(file: Blob): Promise<string | null> {
  const db = supabase();
  if (!db) return null;
  const { data } = await db.auth.getUser();
  const uid = data.user?.id;
  if (!uid) return null;
  const path = `${uid}/${crypto.randomUUID()}.pdf`;
  const { error } = await db.storage.from("imports").upload(path, file, { contentType: "application/pdf", upsert: false });
  return error ? null : path;
}
