import { useCallback, useEffect, useState } from "react";
import { Bot, CircleAlert, Eye, CircleCheck, FileText, Inbox, List, RotateCw, ShieldCheck, UserRound, type LucideIcon } from "lucide-react";
import { ago, api, Me, QueueRow, STAGE_LABEL } from "../lib/api";
import { Ic } from "./Icons";

const FILTERS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: "open", label: "In Script", icon: Inbox },
  { id: "mine", label: "Mine", icon: UserRound },
  { id: "done", label: "Handed off", icon: CircleCheck },
  { id: "all", label: "All", icon: List },
];

function readFilter() {
  if (typeof window === "undefined") return "open";
  const f = new URLSearchParams(window.location.search).get("filter");
  return FILTERS.some((x) => x.id === f) ? (f as string) : "open";
}

function ScriptState({ r }: { r: QueueRow }) {
  if (r.stage !== "script") return <span className="state state--done"><Ic i={CircleCheck} s={14} />{STAGE_LABEL[r.stage] || r.stage}</span>;
  if (r.draft_status === "queued" || r.draft_status === "running") return <span className="state state--new"><Ic i={Bot} s={14} />Agent drafting</span>;
  if (r.draft_status === "failed" && !r.script_version) return <span className="state state--fail"><Ic i={CircleAlert} s={14} />Draft failed</span>;
  if (!r.script_version) return <span className="state state--new"><Ic i={FileText} s={14} />No draft yet</span>;
  if (r.script_author === "agent") return <span className="state state--review"><Ic i={Eye} s={14} />Agent draft v{r.script_version}, to review</span>;
  return <span className="state"><Ic i={r.rights_checked ? ShieldCheck : FileText} s={14} />Edited v{r.script_version}</span>;
}

export function Queue({ me, onOpen }: { me: Me; onOpen: (id: string) => void }) {
  const [filter, setFilterState] = useState(readFilter);
  const [rows, setRows] = useState<QueueRow[] | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try { setRows(await api.queue(filter)); setError(""); } catch (e: any) { setError(e.message); }
  }, [filter]);
  useEffect(() => { setRows(null); load(); }, [load]);

  const setFilter = (id: string) => {
    const url = new URL(window.location.href);
    if (id === "open") url.searchParams.delete("filter"); else url.searchParams.set("filter", id);
    window.history.replaceState({}, "", url);
    setFilterState(id);
  };

  return (
    <section className="page">
      <div className="page__head">
        <div>
          <h1 className="page__title">Scripts to review</h1>
          <p className="page__lede">The script agent drafts every video as soon as its brief is approved. Review the oldest draft first: approve it, edit it, or ask for a redo.</p>
        </div>
      </div>

      <div className="filters" role="group" aria-label="Filter videos">
        {FILTERS.map((f) => (
          <button key={f.id} type="button" className="chip" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}><Ic i={f.icon} s={14} />{f.label}</button>
        ))}
      </div>

      <div className="sheet">
        {error && (
          <div className="notice notice--error" role="alert">
            <p>Couldn’t load the scripts: {error}</p>
            <button type="button" className="btn" onClick={load}><Ic i={RotateCw} />Try again</button>
          </div>
        )}
        {!error && rows === null && <TableSkeleton />}
        {!error && rows && rows.length === 0 && (
          <div className="empty">
            <Ic i={Inbox} s={28} />
            <p className="empty__title">{filter === "mine" ? "Nothing claimed by you." : filter === "done" ? "No scripts handed off yet." : "No video is waiting for a script."}</p>
            <p>Videos land here when Research hands off a finished brief.</p>
          </div>
        )}
        {!error && rows && rows.length > 0 && (
          <table className="table table--rows">
            <thead>
              <tr><th scope="col">Video</th><th scope="col" className="hide-s">Channel</th><th scope="col">Script</th><th scope="col" className="hide-s">Writer</th><th scope="col" className="num">Waiting</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="row-link" onClick={() => onOpen(r.id)}>
                  <td>
                    <a href={`?view=video&video=${r.id}`} className="row-title" onClick={(e) => { e.preventDefault(); onOpen(r.id); }}>{r.title_working}</a>
                    {r.angle && <span className="row-sub">{r.angle}</span>}
                  </td>
                  <td className="hide-s">{r.channel_name}</td>
                  <td><ScriptState r={r} /></td>
                  <td className="hide-s"><span className="who-cell">{r.owner_kind === "agent" ? <Ic i={Bot} s={14} /> : <Ic i={UserRound} s={14} />}{r.owner_kind === "agent" ? "Unclaimed" : r.owner_name || "Unclaimed"}</span></td>
                  <td className="num">{ago(r.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

function TableSkeleton() {
  return (
    <div className="skel-table" aria-busy="true" aria-label="Loading scripts">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="skel-row"><span className="skel skel--line" style={{ width: "46%" }} /><span className="skel skel--line" style={{ width: "14%" }} /><span className="skel skel--line" style={{ width: "10%" }} /></div>
      ))}
    </div>
  );
}

Queue.Skeleton = function QueueSkeleton() {
  return (
    <section className="page">
      <div className="page__head"><span className="skel skel--head" /></div>
      <div className="sheet"><TableSkeleton /></div>
    </section>
  );
};
