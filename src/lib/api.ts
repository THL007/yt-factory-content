// Client for yt-factory-api (Cloudflare Worker → Neon + R2), Script stage. The token stays in this browser only.
export const DEFAULT_API = "https://yt-factory-api.thl007.workers.dev";
export const RESEARCH_URL = "https://thl007.github.io/yt-factory-research/";

export type Me = { user: { id: string; username: string; display_name: string; kind: string }; role: string; token_label: string };
export type QueueRow = {
  id: string; title_working: string; stage: string; target_length: string | null; updated_at: string; created_at: string;
  owner_user_id: string | null; owner_name: string | null; owner_kind: string | null; channel_id: string; channel_name: string; channel_language: string | null;
  research_job_id: string | null; research_mode: string | null; angle: string | null; script_version: number | null; script_saved_at: string | null;
  rights_checked: boolean | null; script_chars: number | null; script_author: string | null; draft_status: DraftStatus | null;
};
export type DraftStatus = "queued" | "running" | "done" | "failed" | "cancelled";
export type Part = "outline" | "script" | "packaging" | "rights";
export const PART_LABEL: Record<Part, string> = { outline: "Outline", script: "Spoken script", packaging: "Titles and thumbnail", rights: "Rights flags" };
export type DraftJob = { id: string; status: DraftStatus; part: Part | null; feedback: string | null; model: string | null; cost_usd: string | null; error: string | null; created_at: string; finished_at: string | null; script_version: number | null };
export type Beat = { title: string; note: string };
export type Script = {
  id: string; version: number; hook: string | null; beats: Beat[]; cta: string | null; soft_close: string | null; script_text: string | null;
  title_options: string[]; thumbnail_text: string | null; description_text: string | null; target_length: string | null;
  rights_flags: string[]; rights_checked: boolean; notes: string | null; author_kind: string; author_user_id?: string | null; created_at: string;
};
export type Fact = { id?: string; claim: string; source_url: string | null; source_title: string | null; verified: boolean };
export type Reference = { id?: string; kind: "seed" | "competitor"; url: string; title: string | null; channel_name: string | null; views_seen: number | null; notes: string | null };
export type Brief = {
  id: string; version: number; angle: string | null; why_now: string | null; audience: string | null; whats_new: string | null; remix_extra: string | null;
  viral_breakdown: { hook: string; promise: string; structure: string[]; pacing: string; why_it_works: string; misses: string } | null;
  title_ideas: string[]; asset_notes: { need: string; source: string; license: string; rights_risk: string }[]; rights_flags: string[];
  extras?: { summary?: Record<string, string[]>; production?: { visual_style?: string; voice?: string; music_sfx?: string; format?: string } } | null;
};
export type Channel = { id: string; name: string; niche: string | null; language: string | null; cadence: string | null; voice_tone: string | null };
export type Version = { id: string; version: number; author_kind: string; author_name: string | null; created_at: string };
export type Detail = { video: QueueRow; channel: Channel; brief: Brief | null; facts: Fact[]; references: Reference[]; script: Script | null; versions: Version[]; missing: string[]; draft_job: DraftJob | null };
export type ScriptInput = Omit<Script, "id" | "version" | "author_kind" | "created_at">;

const KEY = "ytf-content";
export function getSettings(): { api: string; token: string } {
  if (typeof localStorage === "undefined") return { api: DEFAULT_API, token: "" };
  try { return { api: DEFAULT_API, token: "", ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { return { api: DEFAULT_API, token: "" }; }
}
export function saveSettings(s: { api: string; token: string }) { localStorage.setItem(KEY, JSON.stringify(s)); }
export function signOut() { localStorage.removeItem(KEY); }

export class ApiError extends Error { constructor(public status: number, msg: string) { super(msg); } }

async function call<T>(path: string, init: RequestInit = {}, s = getSettings()): Promise<T> {
  let res: Response;
  try {
    res = await fetch(s.api.replace(/\/$/, "") + path, {
      ...init,
      headers: { Authorization: `Bearer ${s.token}`, ...(init.body ? { "Content-Type": "application/json" } : {}), ...(init.headers || {}) },
    });
  } catch {
    throw new ApiError(0, "Can’t reach the factory API. Check your connection.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error || `HTTP ${res.status}`);
  return data as T;
}
const post = <T>(p: string, b?: unknown) => call<T>(p, { method: "POST", body: b === undefined ? undefined : JSON.stringify(b) });

export const api = {
  me: (s?: { api: string; token: string }) => call<Me>("/me", {}, s),
  queue: (filter: string) => call<QueueRow[]>(`/content/queue?filter=${encodeURIComponent(filter)}`),
  video: (id: string) => call<Detail>(`/content/videos/${id}`),
  version: (id: string, v: number) => call<Script>(`/content/videos/${id}/versions/${v}`),
  save: (id: string, b: ScriptInput) => call<Detail & { version: number }>(`/content/videos/${id}/script`, { method: "PUT", body: JSON.stringify(b) }),
  action: (id: string, act: "claim" | "release" | "handoff") => post<Detail>(`/content/videos/${id}/${act}`),
  draft: (id: string, part: Part | null, feedback: string) => post<Detail>(`/content/videos/${id}/draft`, { part, feedback }),
  sendBack: (id: string, reason: string) => post<Detail>(`/content/videos/${id}/sendback`, { reason }),
};

export const canWrite = (r?: string) => r === "owner" || r === "admin" || r === "content";

export const STAGE_LABEL: Record<string, string> = { idea: "Idea", script: "Script", assets: "Assets", edit: "Edit", qa: "QA", upload: "Upload queue", published: "Published" };

export function ago(iso: string | null | undefined) {
  if (!iso) return "";
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}

// ---- the script as spoken ----
export const isCue = (line: string) => /^\s*\[(PAUSE|B-ROLL)\b/i.test(line);
export const countWords = (t: string) => t.split(/\s+/).filter(Boolean).length;
export function spokenWords(script: string) {
  return countWords(script.split("\n").filter((l) => !isCue(l)).join(" "));
}
export const fmtTime = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;
/** "8-10 min" or "60 s" → [minSeconds, maxSeconds] or null. */
export function parseTarget(t: string | null | undefined): [number, number] | null {
  const s = String(t || "").toLowerCase();
  const m = s.match(/(\d+(?:\.\d+)?)\s*(?:[-–to]+\s*(\d+(?:\.\d+)?))?\s*(min|m\b|minutes?|s\b|sec|seconds?)/);
  if (!m) return null;
  const k = /^s/.test(m[3]) ? 1 : 60;
  const a = +m[1] * k, b = (m[2] ? +m[2] : +m[1]) * k;
  return [Math.min(a, b), Math.max(a, b)];
}
