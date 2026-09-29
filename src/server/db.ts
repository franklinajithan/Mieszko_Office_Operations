import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { AppError, logServerError, missingColumnName } from "./errors";

let client: SupabaseClient | null = null;

export function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new AppError("The application database is not configured.");
  }
  if (!client) {
    client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

export async function insertFlexible(table: string, payload: Record<string, unknown>) {
  const current = { ...payload };
  let lastMessage = "Unable to save.";
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const { data, error } = await db().from(table).insert(current).select("*").maybeSingle();
    if (!error) return data;
    lastMessage = error.message;
    const column = missingColumnName(error.message);
    if (!column || !(column in current)) break;
    delete current[column];
  }
  logServerError(`insert ${table}`, lastMessage);
  throw new AppError("Unable to save changes. Please try again.");
}

export async function updateFlexible(table: string, filters: Record<string, string>, payload: Record<string, unknown>) {
  const current = { ...payload };
  let lastMessage = "Unable to save.";
  for (let attempt = 0; attempt < 8; attempt += 1) {
    let query = db().from(table).update(current);
    for (const [key, value] of Object.entries(filters)) query = query.eq(key, value);
    const { data, error } = await query.select("*");
    if (!error) return data ?? [];
    lastMessage = error.message;
    const column = missingColumnName(error.message);
    if (!column || !(column in current)) break;
    delete current[column];
  }
  logServerError(`update ${table}`, lastMessage);
  throw new AppError("Unable to save changes. Please try again.");
}
