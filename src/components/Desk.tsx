import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, BookCheck, CircleAlert, CircleCheck, Clapperboard, Compass, ExternalLink, FileOutput, Film, Hand, History, Image as ImageIcon,
  ListOrdered, Megaphone, Mic, Pause, Plus, RotateCw, RotateCcw, Save, ShieldCheck, Trash2, Type, Undo2, Clock, PenLine, X, Bot, Sparkles, MessageSquareText,
} from "lucide-react";
import {
  ago, api, Beat, canWrite, countWords, Detail, fmtTime, isCue, Me, parseTarget, Part, PART_LABEL, RESEARCH_URL, Script, ScriptInput, spokenWords, STAGE_LABEL,
} from "../lib/api";
import { Ic, SheetHead } from "./Icons";

const WPM_DEFAULT = 150;

function blank(d: Detail): ScriptInput {
  return {
    hook: "", beats: [{ title: "", note: "" }, { title: "", note: "" }, { title: "", note: "" }], cta: "", soft_close: "", script_text: "",
    title_options: ["", "", ""], thumbnail_text: "", description_text: "", target_length: d.video.target_length || "",
    rights_flags: [], rights_checked: false, notes: "",
  };
}
function fromScript(s: Script): ScriptInput {
  const { id: _i, version: _v, author_kind: _a, created_at: _c, ...rest } = s;
  return {
    ...rest, hook: s.hook || "", cta: s.cta || "", soft_close: s.soft_close || "", script_text: s.script_text || "", thumbnail_text: s.thumbnail_text || "",
    description_text: s.description_text || "", target_length: s.target_length || "", notes: s.notes || "",
    beats: s.beats?.length ? s.beats : [{ title: "", note: "" }], title_options: s.title_options?.length ? s.title_options : ["", "", ""],
  };
}

export function Desk({ id, me, onBack }: { id: string; me: Me; onBack: () => void }) {
  const [d, setD] = useState<Detail | null>(null);
  const [f, setF] = useState<ScriptInput | null>(null);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [wpm, setWpm] = useState(WPM_DEFAULT);
  const [redo, setRedo] = useState<null | { part: Part | null }>(null);

  const take = (nd: Detail, keepForm = false) => {
    setD(nd);
    if (!keepForm) { setF(nd.script ? fromScript(nd.script) : blank(nd)); setDirty(false); }
  };
  const load = useCallback(async () => {
    try { take(await api.video(id)); setError(""); } catch (e: any) { setError(e.message); }
  }, [id]);
  useEffect(() => { load(); }, [load]);
  // While the script agent drafts, keep the page current.
  const drafting = !!d?.draft_job && ["queued", "running"].includes(d.draft_job.status);
  useEffect(() => {
    if (!drafting) return;
    const t = setInterval(async () => { try { const nd = await api.video(id); take(nd, !(nd.draft_job && nd.draft_job.status === "done")); } catch { /* next tick */ } }, 8000);
    return () => clearInterval(t);
  }, [drafting, id]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const set = <K extends keyof ScriptInput>(k: K, v: ScriptInput[K]) => { setF((x) => (x ? { ...x, [k]: v } : x)); setDirty(true); };

  if (error) return (
    <section className="page"><div className="notice notice--error" role="alert"><p>Couldn’t open this video: {error}</p>
      <div className="row-gap"><button type="button" className="btn" onClick={load}><Ic i={RotateCw} />Try again</button><button type="button" className="btn" onClick={onBack}><Ic i={ArrowLeft} />Back to scripts</button></div></div></section>
  );
  if (!d || !f) return (
    <section className="page" aria-busy="true"><div className="page__head"><span className="skel skel--head" /></div>
      <div className="desk"><div className="sheet">{[0, 1, 2, 3].map((i) => <span key={i} className="skel skel--line" style={{ width: `${86 - i * 10}%`, margin: "0.9rem 0" }} />)}</div><div className="sheet" /></div></section>
  );

  const { video } = d;
  const inScript = video.stage === "script";
  const mine = video.owner_user_id === me.user.id;
  const writer = canWrite(me.role) && inScript;
  const ro = !writer || drafting;
  const agentDraft = d.script?.author_kind === "agent";
  const claimedByOther = !!video.owner_user_id && !mine && video.owner_kind !== "agent";

  async function save() {
    setBusy("save"); setMsg(null);
    try { const nd = await api.save(id, f!); take(nd); setMsg({ ok: true, text: `Saved as version ${nd.version}.` }); }
    catch (e: any) { setMsg({ ok: false, text: e.message }); } finally { setBusy(null); }
  }
  async function askDraft(part: Part | null, feedback: string) {
    if (dirty && !window.confirm("Your unsaved changes will be replaced by the agent's draft. Continue?")) return;
    setBusy("draft"); setMsg(null);
    try { take(await api.draft(id, part, feedback)); setRedo(null); window.scrollTo({ top: 0 }); }
    catch (e: any) { setMsg({ ok: false, text: e.message }); } finally { setBusy(null); }
  }
  const openRedo = writer && !drafting ? (part: Part | null) => { setRedo({ part }); window.scrollTo({ top: 0 }); } : undefined;

  async function act(a: "claim" | "release" | "handoff") {
    if (a === "handoff" && dirty) { setMsg({ ok: false, text: "Save your changes before handing off." }); return; }
    if (a === "handoff" && !window.confirm("Approve this script and send it to production? The video moves to Assets and leaves your queue.")) return;
    setBusy(a); setMsg(null);
    try { take(await api.action(id, a), a !== "handoff"); if (a === "handoff") setMsg({ ok: true, text: "Handed off. The video is now in Assets." }); }
    catch (e: any) { setMsg({ ok: false, text: e.message }); } finally { setBusy(null); }
  }

  return (
    <article className="page">
      <button type="button" className="link-btn back" onClick={onBack}><Ic i={ArrowLeft} s={14} />Back to scripts</button>
      <header className="page__head">
        <div>
          <h1 className="page__title">{video.title_working}</h1>
          <p className="page__meta">{video.channel_name}. Ticket in <strong>{STAGE_LABEL[video.stage] || video.stage}</strong>.
            {d.script ? ` Script v${d.script.version}, saved ${ago(d.script.created_at)}.` : " No script yet."}
            {video.owner_user_id && video.owner_kind !== "agent" ? ` Writer: ${mine ? "you" : video.owner_name}.` : " Unclaimed."}</p>
        </div>
        {writer && (
          <div className="actions">
            {d.missing.length === 0 && !dirty && !drafting
              ? <button type="button" className="btn btn--primary" disabled={!!busy} aria-busy={busy === "handoff"} onClick={() => act("handoff")}><Ic i={FileOutput} />{busy === "handoff" ? "Sending…" : "Approve and send to Assets"}</button>
              : null}
            {d.script && openRedo && <button type="button" className="btn" disabled={!!busy} onClick={() => openRedo(null)}><Ic i={RotateCcw} />Redo whole draft</button>}
            {!mine && <button type="button" className="btn" disabled={!!busy} onClick={() => act("claim")}><Ic i={Hand} />{claimedByOther ? "Take over" : "Claim it"}</button>}
            {mine && <button type="button" className="link-btn" disabled={!!busy} onClick={() => act("release")}><Ic i={Undo2} s={14} />Release</button>}
          </div>
        )}
      </header>

      {msg && <div className={`notice${msg.ok ? " notice--ok" : " notice--error"}`} role={msg.ok ? "status" : "alert"}><p>{msg.text}</p></div>}
      {!canWrite(me.role) && <div className="notice"><p>Your role ({me.role}) can read scripts. Writing needs a content token.</p></div>}
      {claimedByOther && writer && <div className="notice"><p>{video.owner_name} is writing this one. Take it over only if you agreed.</p></div>}

      <div className="desk">
        <BriefPanel d={d} />
        <div className="desk__main">
          <DraftBanner d={d} drafting={drafting} agentDraft={agentDraft} writer={writer} busy={busy === "draft"} onRetry={() => askDraft(d.draft_job?.part || null, d.draft_job?.feedback || "")} />
          {redo && <RedoPanel part={redo.part} busy={busy === "draft"} onCancel={() => setRedo(null)} onSend={(note) => askDraft(redo.part, note)} />}
          {!d.script && !drafting ? (
            <section className="sheet empty">
              <Ic i={Bot} s={28} />
              <p className="empty__title">No draft yet.</p>
              <p>The script agent writes the first full draft from the brief: outline, spoken script with cues, titles, thumbnail text and rights flags. You review and approve it.</p>
              {writer && <button type="button" className="btn btn--primary" disabled={!!busy} aria-busy={busy === "draft"} onClick={() => askDraft(null, "")}><Ic i={Sparkles} />{busy === "draft" ? "Asking…" : "Ask the agent for a draft"}</button>}
            </section>
          ) : (
            <>
              {writer && !drafting && <Checklist missing={d.missing} dirty={dirty} agentDraft={agentDraft} />}
              <Outline f={f} set={set} ro={ro} wpm={wpm} onRedo={openRedo} />
              <SpokenScript f={f} set={set} ro={ro} wpm={wpm} setWpm={setWpm} onRedo={openRedo} />
              <Packaging f={f} set={set} ro={ro} brief={d.brief} onRedo={openRedo} />
              <Rights f={f} set={set} ro={ro} d={d} onRedo={openRedo} />
            </>
          )}
          {writer && !drafting && <SendBack id={id} onDone={take} />}
          <Versions d={d} onRestore={(s) => { setF(fromScript(s)); setDirty(true); setMsg({ ok: true, text: `Version ${s.version} is in the editor. Save to make it the newest version.` }); window.scrollTo({ top: 0 }); }} ro={ro} />
        </div>
      </div>

      {writer && !drafting && (dirty || busy === "save") && (
        <div className="savebar is-dirty" role="region" aria-label="Save">
          <p className="savebar__state">{dirty ? "Unsaved changes" : "Saving…"}</p>
          <button type="button" className="btn btn--primary" disabled={!dirty || !!busy} aria-busy={busy === "save"} onClick={save}><Ic i={Save} />{busy === "save" ? "Saving…" : "Save version"}</button>
        </div>
      )}
    </article>
  );
}

// ---------- the brief beside the script ----------
function BriefPanel({ d }: { d: Detail }) {
  const b = d.brief;
  const sum = b?.extras?.summary || {};
  const unverified = d.facts.filter((x) => !x.verified);
  return (
    <aside className="brief" aria-label="Research brief">
      <details className="brief__fold" open>
        <summary className="brief__summary"><Ic i={BookCheck} s={18} /><span>Research brief</span>{b && <span className="brief__v">v{b.version}</span>}</summary>
        {!b ? <p className="muted">No research brief is linked to this video.</p> : (
          <div className="brief__body">
            <section>
              <h3 className="brief__h"><Ic i={Compass} s={14} />Angle</h3>
              <p className="brief__angle">{b.angle}</p>
              {b.remix_extra && <p className="brief__extra"><strong>Our extra:</strong> {b.remix_extra}</p>}
              {b.audience && <p className="brief__line"><strong>For:</strong> {b.audience}</p>}
            </section>
            {b.viral_breakdown && (
              <section>
                <h3 className="brief__h"><Ic i={Megaphone} s={14} />Seed hook and shape</h3>
                <p className="brief__line">{b.viral_breakdown.hook}</p>
                {b.viral_breakdown.structure?.length > 0 && <ol className="brief__beats">{b.viral_breakdown.structure.map((s, i) => <li key={i}>{s}</li>)}</ol>}
                <p className="brief__line"><strong>Misses:</strong> {b.viral_breakdown.misses}</p>
              </section>
            )}
            {b.extras?.production?.voice && (
              <section>
                <h3 className="brief__h"><Ic i={Mic} s={14} />Voice</h3>
                <p className="brief__line">{b.extras.production.voice}</p>
              </section>
            )}
            <section>
              <h3 className="brief__h"><Ic i={BookCheck} s={14} />Facts you can use</h3>
              <ol className="brief__facts">
                {d.facts.map((x, i) => (
                  <li key={x.id || i} className={x.verified ? "" : "is-unverified"}>
                    <span>{x.claim}</span>
                    <span className="brief__src">
                      {x.verified ? <span className="ok"><Ic i={CircleCheck} s={12} />Checked</span> : <span className="flag"><Ic i={CircleAlert} s={12} />Unverified</span>}
                      {x.source_url && <a href={x.source_url} target="_blank" rel="noopener noreferrer">{x.source_title || new URL(x.source_url).hostname}</a>}
                    </span>
                  </li>
                ))}
              </ol>
              {unverified.length > 0 && <p className="brief__warn"><Ic i={CircleAlert} s={14} />{unverified.length} unverified: keep {unverified.length === 1 ? "it" : "them"} out of the voice-over or check {unverified.length === 1 ? "it" : "them"} first.</p>}
            </section>
            {sum.titles && sum.titles.length > 0 && (
              <section><h3 className="brief__h"><Ic i={Type} s={14} />Title direction</h3><ul className="brief__list">{sum.titles.map((t, i) => <li key={i}>{t}</li>)}</ul></section>
            )}
            {d.video.research_job_id && <a className="ext brief__open" href={`${RESEARCH_URL}?view=job&job=${d.video.research_job_id}`} target="_blank" rel="noopener noreferrer">Full brief in the Research desk<Ic i={ExternalLink} s={14} /></a>}
          </div>
        )}
      </details>
    </aside>
  );
}

// ---------- what hand-off still needs ----------
function Checklist({ missing, dirty, agentDraft }: { missing: string[]; dirty: boolean; agentDraft: boolean }) {
  if (!missing.length && !dirty) return <div className="check check--ready"><Ic i={CircleCheck} />Ready. Approve it to send it to production.</div>;
  if (!dirty && missing.length === 1 && missing[0] === "the rights check")
    return <div className="check"><Ic i={ListOrdered} /><p>{agentDraft ? "Review the agent’s draft: e" : "E"}dit what you want, tick the rights check at the bottom and save. Then approve it.</p></div>;
  return (
    <div className="check">
      <Ic i={ListOrdered} />
      <p>{missing.includes("a saved script") ? "Not started. Hand-off needs a hook, 3 beats, a call to action, the spoken script, 3 titles, thumbnail text and the rights check." : missing.length ? <>Before hand-off the saved script needs {missing.join(", ")}.</> : "Save your changes to check the script again."}</p>
    </div>
  );
}

type SetF = <K extends keyof ScriptInput>(k: K, v: ScriptInput[K]) => void;

// Spoken seconds for a line at the chosen pace.
const secs = (t: string, wpm: number) => (countWords(t) / wpm) * 60;

function PartHead({ i, title, part, onRedo }: { i: Parameters<typeof SheetHead>[0]["i"]; title: string; part: Part; onRedo?: (p: Part) => void }) {
  return (
    <div className="parthead">
      <SheetHead i={i}>{title}</SheetHead>
      {onRedo && <button type="button" className="icon-btn" aria-label={`Ask the agent to redo: ${title}`} title={`Ask the agent to redo: ${title}`} onClick={() => onRedo(part)}><Ic i={RotateCcw} /></button>}
    </div>
  );
}

function Outline({ f, set, ro, wpm, onRedo }: { f: ScriptInput; set: SetF; ro: boolean; wpm: number; onRedo?: (p: Part) => void }) {
  const hookS = secs(f.hook || "", wpm);
  const beats = f.beats;
  const upd = (i: number, p: Partial<Beat>) => set("beats", beats.map((b, j) => (j === i ? { ...b, ...p } : b)));
  return (
    <section className="sheet form">
      <PartHead i={ListOrdered} title="Outline" part="outline" onRedo={onRedo} />
      <label className="field">
        <span className="field__label field__label--row">Hook, spoken in 3 seconds or less<span className={`meter${hookS > 3 ? " meter--over" : ""}`}>{countWords(f.hook || "")} words, about {hookS.toFixed(1)} s</span></span>
        <textarea className="input input--area input--lead" rows={3} readOnly={ro} value={f.hook || ""} onChange={(e) => set("hook", e.target.value)} placeholder="The first sentence the viewer hears" />
      </label>
      <ol className="beats">
        {beats.map((b, i) => (
          <li key={i} className="beat">
            <span className="beat__n" aria-hidden="true">{i + 1}</span>
            <div className="beat__body">
              <input className="input" aria-label={`Beat ${i + 1}`} readOnly={ro} value={b.title} onChange={(e) => upd(i, { title: e.target.value })} placeholder="What this beat says" />
              <input className="input input--quiet" aria-label={`Beat ${i + 1} note`} readOnly={ro} value={b.note} onChange={(e) => upd(i, { note: e.target.value })} placeholder="Fact or visual it rests on (optional)" />
            </div>
            {!ro && beats.length > 1 && <button type="button" className="icon-btn" aria-label={`Remove beat ${i + 1}`} title="Remove beat" onClick={() => set("beats", beats.filter((_, j) => j !== i))}><Ic i={Trash2} /></button>}
          </li>
        ))}
      </ol>
      {!ro && beats.length < 5 && <button type="button" className="btn btn--quiet" onClick={() => set("beats", [...beats, { title: "", note: "" }])}><Ic i={Plus} />Add beat</button>}
      <div className="two">
        <label className="field"><span className="field__label">Call to action</span>
          <input className="input" readOnly={ro} value={f.cta || ""} onChange={(e) => set("cta", e.target.value)} placeholder="What the viewer should do next" /></label>
        <label className="field"><span className="field__label">Soft close</span>
          <input className="input" readOnly={ro} value={f.soft_close || ""} onChange={(e) => set("soft_close", e.target.value)} placeholder="The last line" /></label>
      </div>
    </section>
  );
}

// ---------- the signature: the spoken script with its running clock ----------
function SpokenScript({ f, set, ro, wpm, setWpm, onRedo }: { f: ScriptInput; set: SetF; ro: boolean; wpm: number; setWpm: (n: number) => void; onRedo?: (p: Part) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [mode, setMode] = useState<"write" | "read">(ro ? "read" : "write");
  const text = f.script_text || "";
  const words = spokenWords(text);
  const total = (words / wpm) * 60;
  const target = parseTarget(f.target_length);
  const cues = text.split("\n").filter(isCue).length;
  const lines = useMemo(() => {
    let t = 0;
    return text.split("\n").map((l) => { const at = t; if (!isCue(l)) t += secs(l, wpm); else if (/^\s*\[PAUSE/i.test(l)) t += 1; return { l, at, cue: isCue(l) }; });
  }, [text, wpm]);

  function insert(s: string) {
    const el = ref.current;
    const pos = el ? el.selectionStart : text.length;
    const before = text.slice(0, pos), after = text.slice(pos);
    const lead = before && !before.endsWith("\n") ? "\n" : "", tail = after.startsWith("\n") ? "" : "\n";
    set("script_text", before + lead + s + tail + after);
    requestAnimationFrame(() => { if (el) { const c = (before + lead + s).length - (s.endsWith("]") ? 1 : 0); el.focus(); el.setSelectionRange(c, c); } });
  }

  const status = !target ? "" : total < target[0] ? "short" : total > target[1] ? "long" : "on";
  return (
    <section className="sheet script">
      <div className="script__head">
        <SheetHead i={Mic}>Spoken script</SheetHead>
        <div className="seg" role="group" aria-label="Script view">
          {!ro && <button type="button" className="seg__opt" aria-pressed={mode === "write"} onClick={() => setMode("write")}><Ic i={PenLine} s={14} />Write</button>}
          <button type="button" className="seg__opt" aria-pressed={mode === "read"} onClick={() => setMode("read")}><Ic i={Clock} s={14} />Read-through</button>
        </div>
        {onRedo && <button type="button" className="icon-btn" aria-label="Ask the agent to redo: Spoken script" title="Ask the agent to redo: Spoken script" onClick={() => onRedo("script")}><Ic i={RotateCcw} /></button>}
      </div>

      <dl className="clock">
        <div><dt>Spoken words</dt><dd className="num">{words.toLocaleString("en-US")}</dd></div>
        <div><dt>Read time</dt><dd className="num">{fmtTime(total)}</dd></div>
        <div><dt>Target</dt><dd>{ro ? (f.target_length || "not set") : <input className="input input--inline" aria-label="Target length" value={f.target_length || ""} onChange={(e) => set("target_length", e.target.value)} placeholder="8-10 min" />}</dd></div>
        <div><dt>Pace</dt><dd><input className="input input--inline input--num" aria-label="Words per minute" inputMode="numeric" value={wpm} onChange={(e) => setWpm(Math.max(80, Math.min(240, +e.target.value.replace(/\D/g, "") || WPM_DEFAULT)))} /><span className="clock__unit">wpm</span></dd></div>
        <div><dt>Cues</dt><dd className="num">{cues}</dd></div>
      </dl>
      {target && (
        <div className="ruler" aria-hidden="true">
          <span className="ruler__band" style={{ left: `${(target[0] / (target[1] * 1.25)) * 100}%`, width: `${((target[1] - target[0]) / (target[1] * 1.25)) * 100}%` }} />
          <span className="ruler__mark" style={{ transform: `translateX(${Math.min(100, (total / (target[1] * 1.25)) * 100)}cqw)` }} />
        </div>
      )}
      {status && <p className={`clock__status clock__status--${status}`}>{status === "on" ? "Inside the target length." : status === "short" ? `About ${fmtTime(target![0] - total)} short of the target.` : `About ${fmtTime(total - target![1])} over the target.`}</p>}

      {mode === "write" && !ro ? (
        <>
          <div className="toolbar" role="toolbar" aria-label="Insert a cue">
            <button type="button" className="btn btn--quiet btn--s" onClick={() => insert("[PAUSE]")}><Ic i={Pause} s={14} />Pause</button>
            <button type="button" className="btn btn--quiet btn--s" onClick={() => insert("[B-ROLL: ]")}><Ic i={Film} s={14} />B-roll cue</button>
            <span className="toolbar__hint">Cues sit on their own line and are not read aloud.</span>
          </div>
          <textarea ref={ref} className="input input--script" aria-label="Spoken script" rows={18} value={text} onChange={(e) => set("script_text", e.target.value)}
            placeholder={"Write only what the narrator says.\n[B-ROLL: what the viewer sees]\nNext spoken line.\n[PAUSE]"} />
        </>
      ) : (
        <ol className="readthrough">
          {lines.filter((x) => x.l.trim()).map((x, i) => (
            <li key={i} className={x.cue ? "rt rt--cue" : "rt"}>
              <span className="rt__t num">{x.cue ? "" : fmtTime(x.at)}</span>
              <span className="rt__l">{x.cue ? <><Ic i={/PAUSE/i.test(x.l) ? Pause : Film} s={14} />{x.l.trim().replace(/^\[|\]$/g, "")}</> : x.l}</span>
            </li>
          ))}
          {!text.trim() && <li className="rt rt--empty">Nothing written yet.</li>}
        </ol>
      )}
    </section>
  );
}

function Packaging({ f, set, ro, brief, onRedo }: { f: ScriptInput; set: SetF; ro: boolean; brief: Detail["brief"]; onRedo?: (p: Part) => void }) {
  const titles = f.title_options;
  const tw = countWords(f.thumbnail_text || "");
  const ideas = (brief?.title_ideas || []).filter((t) => !titles.includes(t));
  return (
    <section className="sheet form">
      <PartHead i={Type} title="Titles and thumbnail" part="packaging" onRedo={onRedo} />
      <ol className="titles">
        {titles.map((t, i) => (
          <li key={i} className="titles__row">
            <input className="input" aria-label={`Title option ${i + 1}`} readOnly={ro} value={t} maxLength={100} onChange={(e) => set("title_options", titles.map((x, j) => (j === i ? e.target.value : x)))} placeholder={`Title option ${i + 1}`} />
            <span className={`meter${t.length > 70 ? " meter--over" : ""}`}>{t.length}/100</span>
            {!ro && titles.length > 3 && <button type="button" className="icon-btn" aria-label={`Remove title ${i + 1}`} onClick={() => set("title_options", titles.filter((_, j) => j !== i))}><Ic i={X} /></button>}
          </li>
        ))}
      </ol>
      {!ro && (
        <div className="row-gap">
          {titles.length < 6 && <button type="button" className="btn btn--quiet" onClick={() => set("title_options", [...titles, ""])}><Ic i={Plus} />Add title</button>}
          {ideas.length > 0 && <button type="button" className="btn btn--quiet" onClick={() => set("title_options", [...titles.filter((t) => t.trim()), ...ideas].slice(0, 6))}><Ic i={BookCheck} />Use the brief’s ideas</button>}
        </div>
      )}
      <p className="field__hint">Keep the strongest under 70 characters so it is not cut off in search.</p>
      <label className="field">
        <span className="field__label field__label--row"><span><Ic i={ImageIcon} s={14} /> Thumbnail text, 4 words or fewer</span><span className={`meter${tw > 4 ? " meter--over" : ""}`}>{tw} of 4 words</span></span>
        <input className="input input--thumb" readOnly={ro} value={f.thumbnail_text || ""} onChange={(e) => set("thumbnail_text", e.target.value)} placeholder="SOLO OR NOTHING?" />
      </label>
      <label className="field"><span className="field__label">Description draft</span>
        <textarea className="input input--area" rows={5} readOnly={ro} value={f.description_text || ""} onChange={(e) => set("description_text", e.target.value)} placeholder="Two lines that promise the payoff, then sources and chapters" /></label>
    </section>
  );
}

function Rights({ f, set, ro, d, onRedo }: { f: ScriptInput; set: SetF; ro: boolean; d: Detail; onRedo?: (p: Part) => void }) {
  const flags = f.rights_flags;
  const fromBrief = (d.brief?.rights_flags || []).filter((x) => !flags.includes(x));
  return (
    <section className="sheet form">
      <PartHead i={ShieldCheck} title="Rights check" part="rights" onRedo={onRedo} />
      <ul className="flags">
        {flags.map((x, i) => (
          <li key={i} className="flags__row">
            <input className="input" aria-label={`Rights flag ${i + 1}`} readOnly={ro} value={x} onChange={(e) => set("rights_flags", flags.map((y, j) => (j === i ? e.target.value : y)))} />
            {!ro && <button type="button" className="icon-btn" aria-label={`Remove flag ${i + 1}`} onClick={() => set("rights_flags", flags.filter((_, j) => j !== i))}><Ic i={X} /></button>}
          </li>
        ))}
        {!flags.length && <li className="muted">No flags yet.</li>}
      </ul>
      {!ro && (
        <div className="row-gap">
          <button type="button" className="btn btn--quiet" onClick={() => set("rights_flags", [...flags, ""])}><Ic i={Plus} />Add flag</button>
          {fromBrief.length > 0 && <button type="button" className="btn btn--quiet" onClick={() => set("rights_flags", [...flags.filter((x) => x.trim()), ...fromBrief])}><Ic i={BookCheck} />Copy the brief’s {fromBrief.length} flags</button>}
        </div>
      )}
      <label className="checkline">
        <input type="checkbox" disabled={ro} checked={f.rights_checked} onChange={(e) => set("rights_checked", e.target.checked)} />
        <span>I checked the copy: no long quotes from someone else’s script, facts are cited, unverified claims stay out of the voice-over and gray claims are flagged.</span>
      </label>
    </section>
  );
}

function SendBack({ id, onDone }: { id: string; onDone: (d: Detail) => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function send() {
    if (reason.trim().length < 5) { setErr("Say what the brief is missing."); return; }
    if (!window.confirm("Send this video back to Research? It leaves the Script queue.")) return;
    setBusy(true); setErr("");
    try { onDone(await api.sendBack(id, reason.trim())); } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  return (
    <details className="sheet sendback">
      <summary><Ic i={Undo2} s={16} />Send back to Research</summary>
      <p className="field__hint">For a brief with missing facts or no clear extra. Research sees your note under Needs review.</p>
      <label className="field"><span className="field__label">What is missing</span>
        <textarea className="input input--area" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Two of the five facts have no source; the extra is not clear" /></label>
      {err && <p className="field__error" role="alert">{err}</p>}
      <button type="button" className="btn" disabled={busy} aria-busy={busy} onClick={send}><Ic i={Undo2} />{busy ? "Sending…" : "Send back"}</button>
    </details>
  );
}

function Versions({ d, onRestore, ro }: { d: Detail; onRestore: (s: Script) => void; ro: boolean }) {
  const [busy, setBusy] = useState<number | null>(null);
  const [err, setErr] = useState("");
  if (d.versions.length < 2) return null;
  async function restore(v: number) {
    setBusy(v); setErr("");
    try { onRestore(await api.version(d.video.id, v)); } catch (e: any) { setErr(e.message); } finally { setBusy(null); }
  }
  return (
    <details className="sheet versions">
      <summary><Ic i={History} s={16} />Earlier versions ({d.versions.length - 1})</summary>
      <ul className="versions__list">
        {d.versions.slice(1).map((v) => (
          <li key={v.id}>
            <span>Version {v.version}, {v.author_name || v.author_kind}, {ago(v.created_at)}</span>
            {!ro && <button type="button" className="link-btn" disabled={busy !== null} onClick={() => restore(v.version)}><Ic i={PenLine} s={14} />{busy === v.version ? "Loading…" : "Open in editor"}</button>}
          </li>
        ))}
      </ul>
      {err && <p className="field__error" role="alert">{err}</p>}
    </details>
  );
}

// ---------- agent first: what the agent did, and asking it again ----------
function DraftBanner({ d, drafting, agentDraft, writer, busy, onRetry }: { d: Detail; drafting: boolean; agentDraft: boolean; writer: boolean; busy: boolean; onRetry: () => void }) {
  const j = d.draft_job;
  if (drafting && j) return (
    <div className="agentbar agentbar--busy" role="status">
      <Ic i={Bot} s={20} />
      <div>
        <p className="agentbar__title">{j.status === "queued" ? "Waiting for the script agent to write" : "The script agent is writing"} {j.part ? `the ${PART_LABEL[j.part].toLowerCase()}` : d.script ? "a new draft" : "the first draft"}.</p>
        <p>It works from the approved brief. This page updates by itself; editing is paused until it is done.</p>
        {j.feedback && <p className="agentbar__note"><Ic i={MessageSquareText} s={14} />Your note: {j.feedback}</p>}
        <span className="progress" aria-hidden="true" />
      </div>
    </div>
  );
  if (j?.status === "failed" && (!d.script || j.created_at > d.script.created_at)) return (
    <div className="agentbar agentbar--fail" role="alert">
      <Ic i={CircleAlert} s={20} />
      <div>
        <p className="agentbar__title">The script agent could not finish{j.part ? ` the ${PART_LABEL[j.part].toLowerCase()}` : ""}.</p>
        <p>{j.error || "No reason given."}</p>
        {writer && <button type="button" className="btn" disabled={busy} onClick={onRetry}><Ic i={RotateCw} />Ask again</button>}
      </div>
    </div>
  );
  if (agentDraft && d.script) return (
    <div className="agentbar">
      <Ic i={Bot} s={20} />
      <div>
        <p className="agentbar__title">Draft v{d.script.version} by the script agent{j?.part && j.script_version === d.script.version ? `, ${PART_LABEL[j.part].toLowerCase()} redone` : ""}, {ago(d.script.created_at)}{j?.cost_usd && j.script_version === d.script.version ? ` (US$${Number(j.cost_usd).toFixed(3)})` : ""}.</p>
        {d.script.notes ? <p className="agentbar__note"><Ic i={MessageSquareText} s={14} />Agent’s note: {d.script.notes}</p> : <p>Review it, edit what you want or ask for a redo, then approve it.</p>}
      </div>
    </div>
  );
  return null;
}

function RedoPanel({ part, busy, onCancel, onSend }: { part: Part | null; busy: boolean; onCancel: () => void; onSend: (note: string) => void }) {
  const [note, setNote] = useState("");
  const what = part ? PART_LABEL[part].toLowerCase() : "whole draft";
  return (
    <section className="sheet form redo" aria-label="Ask the agent to redo">
      <div className="parthead"><SheetHead i={RotateCcw}>Redo the {what}</SheetHead>
        <button type="button" className="icon-btn" aria-label="Close" title="Close" onClick={onCancel}><Ic i={X} /></button></div>
      <p className="field__hint">{part ? "The agent rewrites only this part; the rest of the draft stays as it is." : "The agent rewrites everything from the brief and the current draft."} Saved versions are kept.</p>
      <label className="field"><span className="field__label">What should change (optional)</span>
        <textarea className="input input--area" rows={3} value={note} onChange={(e) => setNote(e.target.value)} autoFocus
          placeholder={part === "outline" ? "A stronger hook with a question; merge beats 2 and 3" : part === "packaging" ? "Shorter titles, no clickbait words" : "More conversational; aim for 8 minutes"} /></label>
      <div className="row-gap">
        <button type="button" className="btn btn--primary" disabled={busy} aria-busy={busy} onClick={() => onSend(note.trim())}><Ic i={Sparkles} />{busy ? "Asking…" : `Redo the ${what}`}</button>
        <button type="button" className="btn btn--quiet" onClick={onCancel}>Cancel</button>
      </div>
    </section>
  );
}
