import "server-only";
import { isDemoMode } from "../config";
import { createMemoryRepo } from "./memory";
import { createSupabaseRepo } from "./supabase";
import type { Repo } from "./types";

let repo: Repo | null = null;
export function getRepo(): Repo {
  return (repo ??= isDemoMode() ? createMemoryRepo() : createSupabaseRepo());
}
export type * from "./types";
