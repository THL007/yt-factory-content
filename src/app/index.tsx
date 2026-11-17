import { useCallback, useEffect, useState } from "react";
import { ExternalLink, ListTodo, LogOut, PenLine, RotateCw, Settings as SettingsIcon, type LucideIcon } from "lucide-react";
import { api, getSettings, Me, RESEARCH_URL, signOut } from "../lib/api";
import { SignIn } from "../components/SignIn";
import { Queue } from "../components/Queue";
import { Desk } from "../components/Desk";
import { Settings } from "../components/Settings";
import { Ic } from "../components/Icons";

type View = "queue" | "video" | "settings";

function readUrl(): { view: View; video: string | null } {
  if (typeof window === "undefined") return { view: "queue", video: null };
  const q = new URLSearchParams(window.location.search);
  const v = q.get("view"), video = q.get("video");
  return { view: v === "settings" || (v === "video" && video) ? (v as View) : "queue", video };
}

export default function Home() {
  const [me, setMe] = useState<Me | null>(null);
  const [boot, setBoot] = useState<"loading" | "signed-out" | "ready" | "error">("loading");
  const [bootError, setBootError] = useState("");
  const [{ view, video }, setRoute] = useState<{ view: View; video: string | null }>({ view: "queue", video: null });

  const load = useCallback(async () => {
    if (!getSettings().token) { setBoot("signed-out"); return; }
    setBoot("loading");
    try { setMe(await api.me()); setBoot("ready"); }
    catch (e: any) {
      if (e.status === 401) { signOut(); setBoot("signed-out"); }
      else { setBootError(e.message); setBoot("error"); }
    }
  }, []);

  useEffect(() => {
    setRoute(readUrl());
    load();
    const onPop = () => setRoute(readUrl());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [load]);

  const go = (v: View, id?: string) => {
    const url = new URL(window.location.href);
    url.search = "";
    if (v !== "queue") url.searchParams.set("view", v);
    if (id) url.searchParams.set("video", id);
    window.history.pushState({}, "", url);
    setRoute({ view: v, video: id || null });
    window.scrollTo({ top: 0 });
  };

  if (boot === "signed-out") return <SignIn onDone={load} />;

  const tabs: { id: View; label: string; Icon: LucideIcon }[] = [
    { id: "queue", label: "Scripts", Icon: ListTodo },
    { id: "settings", label: "Settings", Icon: SettingsIcon },
  ];

  return (
    <div className="app">
      <header className="bar">
        <div className="bar__in">
          <a className="wordmark" href="./" onClick={(e) => { e.preventDefault(); go("queue"); }}>
            <PenLine className="wordmark__mark" size={22} strokeWidth={1.75} aria-hidden="true" />
            <span className="wordmark__text"><span className="wordmark__name">Content desk</span><span className="wordmark__sub">YT factory, Script stage</span></span>
          </a>
          <nav className="tabs" aria-label="Sections">
            {tabs.map((t) => (
              <button key={t.id} type="button" className="tab" aria-current={view === t.id || (t.id === "queue" && view === "video") ? "page" : undefined} onClick={() => go(t.id)}>
                <t.Icon size={16} strokeWidth={1.75} aria-hidden="true" /><span>{t.label}</span>
              </button>
            ))}
          </nav>
          <div className="who">
            <a className="who__link hide-s" href={RESEARCH_URL} target="_blank" rel="noopener noreferrer">Research desk<Ic i={ExternalLink} s={14} /></a>
            {me ? <><span className="who__name">{me.user.display_name}</span><span className="who__role">{me.role}</span></> : <span className="skel skel--line" style={{ width: 96 }} />}
            <button type="button" className="icon-btn" aria-label="Sign out" title="Sign out" onClick={() => { signOut(); setMe(null); setBoot("signed-out"); }}><Ic i={LogOut} /></button>
          </div>
        </div>
      </header>

      <main className="main">
        {boot === "error" && (
          <div className="notice notice--error" role="alert">
            <p>{bootError}</p>
            <button type="button" className="btn" onClick={load}><Ic i={RotateCw} />Try again</button>
          </div>
        )}
        {boot === "loading" && <Queue.Skeleton />}
        {boot === "ready" && me && (
          <>
            {view === "queue" && <Queue me={me} onOpen={(id) => go("video", id)} />}
            {view === "video" && video && <Desk key={video} id={video} me={me} onBack={() => go("queue")} />}
            {view === "settings" && <Settings me={me} onSignedIn={load} />}
          </>
        )}
      </main>
    </div>
  );
}
