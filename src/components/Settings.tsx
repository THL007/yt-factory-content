import { FormEvent, useState } from "react";
import { ExternalLink, KeyRound, LogIn } from "lucide-react";
import { api, getSettings, Me, saveSettings } from "../lib/api";
import { Ic, SheetHead } from "./Icons";

export const DASHBOARD_URL = "https://thl007.github.io/yt-factory-dashboard/";

// The content desk only holds your own token. People, channels and tokens are managed in the Factory dashboard.
export function Settings({ me, onSignedIn }: { me: Me; onSignedIn: () => void }) {
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    const s = { api: getSettings().api, token: token.trim() };
    if (!/^ytf_[a-f0-9]{48}$/.test(s.token)) { setMsg({ ok: false, text: "A factory token starts with ytf_ followed by 48 characters." }); return; }
    setBusy(true); setMsg(null);
    try { const m = await api.me(s); saveSettings(s); setToken(""); setMsg({ ok: true, text: `Now signed in as ${m.user.display_name} (${m.role}).` }); onSignedIn(); }
    catch (err: any) { setMsg({ ok: false, text: err.status === 401 ? "That token is not valid, revoked or expired." : err.message }); }
    finally { setBusy(false); }
  }
  return (
    <section className="page page--narrow">
      <div className="page__head">
        <div>
          <h1 className="page__title">Settings</h1>
          <p className="page__lede">Signed in as {me.user.display_name}, role {me.role}{me.token_label ? `, token “${me.token_label}”` : ""}. People, channels and tokens are managed in the <a className="ext" href={DASHBOARD_URL} target="_blank" rel="noopener noreferrer">Factory dashboard<Ic i={ExternalLink} s={14} /></a>.</p>
        </div>
      </div>
      <form className="sheet form" onSubmit={submit} noValidate>
        <SheetHead i={KeyRound}>Access token</SheetHead>
        <label className="field"><span className="field__label">Replace your token</span>
          <input className="input input--mono" type="password" autoComplete="off" spellCheck={false} value={token} onChange={(e) => setToken(e.target.value)} placeholder="ytf_…" /></label>
        <p className="field__hint">Use this when the owner gives you a new token or a token for another role.</p>
        {msg && <p className={msg.ok ? "field__ok" : "field__error"} role={msg.ok ? "status" : "alert"}>{msg.text}</p>}
        <button className="btn" type="submit" disabled={busy || !token.trim()} aria-busy={busy}><Ic i={LogIn} />{busy ? "Checking…" : "Use this token"}</button>
      </form>
    </section>
  );
}
