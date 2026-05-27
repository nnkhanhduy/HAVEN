import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  CalendarDays,
  Gift,
  Heart,
  LogOut,
  MapPin,
  MessageCircle,
  Plus,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { apiFormRequest, apiRequest, supabase } from "./lib/api";
import type { AskResponse, ImportantDate, Memory, Preference, Profile, WishlistItem } from "./types";

type Notice = { type: "ok" | "error"; text: string } | null;
type Tab = "memories" | "ask" | "wiki" | "map";

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<Notice>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setProfile(null);
      return;
    }
    loadProfile();
  }, [session?.access_token]);

  async function loadProfile() {
    if (!session) return;
    try {
      const nextProfile = await apiRequest<Profile | null>(session, "/api/onboarding/profile");
      setProfile(nextProfile);
    } catch (error) {
      showError(error);
    }
  }

  function showError(error: unknown) {
    setNotice({ type: "error", text: error instanceof Error ? error.message : "Something went wrong" });
  }

  function showOk(text: string) {
    setNotice({ type: "ok", text });
  }

  if (loading) {
    return <main className="loading">Loading Haven</main>;
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <div className="brand-row">
            <Heart size={24} strokeWidth={2.4} />
            <h1>Haven</h1>
          </div>
          <p>{profile ? `Couple ${profile.couple_id.slice(0, 8)}` : "Private couple memory workspace"}</p>
        </div>
        {session ? (
          <button
            className="icon-text ghost"
            onClick={() => supabase.auth.signOut()}
            title="Sign out"
            type="button"
          >
            <LogOut size={18} />
            Sign out
          </button>
        ) : null}
      </header>

      {notice ? <NoticeBanner notice={notice} onClose={() => setNotice(null)} /> : null}

      {!session ? (
        <AuthPanel showError={showError} showOk={showOk} />
      ) : !profile ? (
        <OnboardingPanel session={session} refreshProfile={loadProfile} showError={showError} showOk={showOk} />
      ) : (
        <Workspace session={session} profile={profile} showError={showError} showOk={showOk} />
      )}
    </main>
  );
}

function NoticeBanner({ notice, onClose }: { notice: NonNullable<Notice>; onClose: () => void }) {
  return (
    <button className={`notice ${notice.type}`} onClick={onClose} type="button">
      {notice.text}
    </button>
  );
}

function AuthPanel({
  showError,
  showOk,
}: {
  showError: (error: unknown) => void;
  showOk: (text: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(mode: "signin" | "signup") {
    setBusy(true);
    try {
      const action =
        mode === "signin"
          ? supabase.auth.signInWithPassword({ email, password })
          : supabase.auth.signUp({ email, password });
      const { error } = await action;
      if (error) throw error;
      showOk(mode === "signin" ? "Signed in" : "Account created");
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="auth-layout">
      <div className="auth-copy">
        <h2>Start testing the backend flow</h2>
        <p>Use a Supabase Auth user, then create or join a couple workspace.</p>
      </div>
      <form className="panel compact" onSubmit={(event) => event.preventDefault()}>
        <label>
          Email
          <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" />
        </label>
        <label>
          Password
          <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" />
        </label>
        <div className="button-row">
          <button disabled={busy} onClick={() => submit("signin")} type="button">
            Sign in
          </button>
          <button className="secondary" disabled={busy} onClick={() => submit("signup")} type="button">
            Sign up
          </button>
        </div>
      </form>
    </section>
  );
}

function OnboardingPanel({
  session,
  refreshProfile,
  showError,
  showOk,
}: {
  session: Session;
  refreshProfile: () => Promise<void>;
  showError: (error: unknown) => void;
  showOk: (text: string) => void;
}) {
  const [displayName, setDisplayName] = useState("");
  const [anniversaryDate, setAnniversaryDate] = useState("");
  const [inviteCode, setInviteCode] = useState("");

  async function createCouple() {
    try {
      await apiRequest(session, "/api/onboarding/couple", {
        method: "POST",
        body: JSON.stringify({
          display_name: displayName || null,
          role: "partner_1",
          anniversary_date: anniversaryDate || null,
        }),
      });
      showOk("Couple created");
      await refreshProfile();
    } catch (error) {
      showError(error);
    }
  }

  async function joinCouple() {
    try {
      await apiRequest(session, "/api/onboarding/join", {
        method: "POST",
        body: JSON.stringify({
          code: inviteCode,
          display_name: displayName || null,
          role: "partner_2",
        }),
      });
      showOk("Joined couple");
      await refreshProfile();
    } catch (error) {
      showError(error);
    }
  }

  return (
    <section className="grid two">
      <div className="panel">
        <h2>Create couple</h2>
        <label>
          Display name
          <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
        </label>
        <label>
          Anniversary
          <input type="date" value={anniversaryDate} onChange={(event) => setAnniversaryDate(event.target.value)} />
        </label>
        <button onClick={createCouple} type="button">
          <Plus size={18} />
          Create
        </button>
      </div>
      <div className="panel">
        <h2>Join with invite</h2>
        <label>
          Display name
          <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
        </label>
        <label>
          Invite code
          <input value={inviteCode} onChange={(event) => setInviteCode(event.target.value.toUpperCase())} />
        </label>
        <button onClick={joinCouple} type="button">
          Join
        </button>
      </div>
    </section>
  );
}

function Workspace({
  session,
  profile,
  showError,
  showOk,
}: {
  session: Session;
  profile: Profile;
  showError: (error: unknown) => void;
  showOk: (text: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("memories");
  const tabs = useMemo(
    () => [
      { id: "memories" as const, label: "Memories", icon: Heart },
      { id: "ask" as const, label: "Ask", icon: MessageCircle },
      { id: "wiki" as const, label: "Wiki", icon: Gift },
      { id: "map" as const, label: "Map", icon: MapPin },
    ],
    [],
  );

  async function createInvite() {
    try {
      const invite = await apiRequest<{ code: string }>(session, "/api/onboarding/invite", { method: "POST" });
      showOk(`Invite code: ${invite.code}`);
    } catch (error) {
      showError(error);
    }
  }

  return (
    <section className="workspace">
      <aside className="sidebar">
        <div className="profile-box">
          <strong>{profile.display_name || "Partner"}</strong>
          <span>{profile.role || "member"}</span>
        </div>
        <button className="secondary full" onClick={createInvite} type="button">
          <Plus size={17} />
          Invite
        </button>
        <nav>
          {tabs.map((item) => {
            const Icon = item.icon;
            return (
              <button
                className={tab === item.id ? "active" : ""}
                key={item.id}
                onClick={() => setTab(item.id)}
                type="button"
              >
                <Icon size={18} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>
      <div className="content">
        {tab === "memories" ? <Memories session={session} showError={showError} showOk={showOk} /> : null}
        {tab === "ask" ? <AskAi session={session} showError={showError} /> : null}
        {tab === "wiki" ? <Wiki session={session} showError={showError} showOk={showOk} /> : null}
        {tab === "map" ? <LoveMap session={session} showError={showError} /> : null}
      </div>
    </section>
  );
}

function Memories({
  session,
  showError,
  showOk,
}: {
  session: Session;
  showError: (error: unknown) => void;
  showOk: (text: string) => void;
}) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [content, setContent] = useState("");
  const [location, setLocation] = useState("");
  const [occurredAt, setOccurredAt] = useState("");

  useEffect(() => {
    loadMemories();
  }, []);

  async function loadMemories() {
    try {
      setMemories(await apiRequest<Memory[]>(session, "/api/memories"));
    } catch (error) {
      showError(error);
    }
  }

  async function createMemory() {
    try {
      const form = new FormData();
      form.append("content", content);
      if (location) form.append("location", location);
      if (occurredAt) form.append("occurred_at", new Date(occurredAt).toISOString());
      await apiFormRequest(session, "/api/memories", form);
      setContent("");
      setLocation("");
      setOccurredAt("");
      showOk("Memory saved");
      await loadMemories();
    } catch (error) {
      showError(error);
    }
  }

  return (
    <div className="stack">
      <div className="section-title">
        <h2>Memories</h2>
        <button className="icon-only" onClick={loadMemories} title="Refresh" type="button">
          <RefreshCw size={18} />
        </button>
      </div>
      <div className="panel form-grid">
        <label className="wide">
          Memory
          <textarea value={content} onChange={(event) => setContent(event.target.value)} />
        </label>
        <label>
          Location
          <input value={location} onChange={(event) => setLocation(event.target.value)} />
        </label>
        <label>
          When
          <input type="datetime-local" value={occurredAt} onChange={(event) => setOccurredAt(event.target.value)} />
        </label>
        <button onClick={createMemory} type="button">
          <Plus size={18} />
          Add
        </button>
      </div>
      <div className="list">
        {memories.map((memory) => (
          <article className="item" key={memory.id}>
            <p>{memory.content || "Image memory"}</p>
            <div className="meta">
              {memory.location ? <span>{memory.location}</span> : null}
              {memory.sentiment ? <span>{memory.sentiment}</span> : null}
              {memory.timestamp ? <span>{new Date(memory.timestamp).toLocaleDateString()}</span> : null}
            </div>
            {memory.image_signed_url ? <img alt="" src={memory.image_signed_url} /> : null}
          </article>
        ))}
      </div>
    </div>
  );
}

function AskAi({ session, showError }: { session: Session; showError: (error: unknown) => void }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<AskResponse | null>(null);
  const [busy, setBusy] = useState(false);

  async function ask() {
    setBusy(true);
    try {
      const query = encodeURIComponent(question);
      setAnswer(await apiRequest<AskResponse>(session, `/api/ask?question=${query}`));
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <div className="section-title">
        <h2>Soulmate AI</h2>
        <Sparkles size={20} />
      </div>
      <div className="panel">
        <label>
          Question
          <textarea value={question} onChange={(event) => setQuestion(event.target.value)} />
        </label>
        <button disabled={busy || question.length < 2} onClick={ask} type="button">
          Ask
        </button>
      </div>
      {answer ? (
        <div className="panel answer">
          <p>{answer.answer}</p>
          <h3>Sources</h3>
          {answer.sources.map((source) => (
            <div className="source" key={source.id}>
              {source.content}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Wiki({
  session,
  showError,
  showOk,
}: {
  session: Session;
  showError: (error: unknown) => void;
  showOk: (text: string) => void;
}) {
  const [preferences, setPreferences] = useState<Preference[]>([]);
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [dates, setDates] = useState<ImportantDate[]>([]);
  const [category, setCategory] = useState("food");
  const [details, setDetails] = useState('{"likes":["Thai food"]}');
  const [wishTitle, setWishTitle] = useState("");
  const [dateTitle, setDateTitle] = useState("");
  const [dateValue, setDateValue] = useState("");

  useEffect(() => {
    loadWiki();
  }, []);

  async function loadWiki() {
    try {
      const [nextPreferences, nextWishlist, nextDates] = await Promise.all([
        apiRequest<Preference[]>(session, "/api/preferences"),
        apiRequest<WishlistItem[]>(session, "/api/wishlist"),
        apiRequest<ImportantDate[]>(session, "/api/important-dates"),
      ]);
      setPreferences(nextPreferences);
      setWishlist(nextWishlist);
      setDates(nextDates);
    } catch (error) {
      showError(error);
    }
  }

  async function addPreference() {
    try {
      await apiRequest(session, "/api/preferences", {
        method: "POST",
        body: JSON.stringify({ category, detail_json: JSON.parse(details) }),
      });
      showOk("Preference saved");
      await loadWiki();
    } catch (error) {
      showError(error);
    }
  }

  async function addWishlist() {
    try {
      await apiRequest(session, "/api/wishlist", {
        method: "POST",
        body: JSON.stringify({ title: wishTitle, category: "gift", status: "open" }),
      });
      setWishTitle("");
      showOk("Wishlist item saved");
      await loadWiki();
    } catch (error) {
      showError(error);
    }
  }

  async function addDate() {
    try {
      await apiRequest(session, "/api/important-dates", {
        method: "POST",
        body: JSON.stringify({ title: dateTitle, date_value: dateValue, date_type: "anniversary" }),
      });
      setDateTitle("");
      setDateValue("");
      showOk("Date saved");
      await loadWiki();
    } catch (error) {
      showError(error);
    }
  }

  return (
    <div className="grid three">
      <div className="panel">
        <h2>Preferences</h2>
        <label>
          Category
          <input value={category} onChange={(event) => setCategory(event.target.value)} />
        </label>
        <label>
          JSON
          <textarea value={details} onChange={(event) => setDetails(event.target.value)} />
        </label>
        <button onClick={addPreference} type="button">
          Save
        </button>
        <MiniList items={preferences.map((item) => `${item.category}: ${JSON.stringify(item.detail_json)}`)} />
      </div>
      <div className="panel">
        <h2>Wishlist</h2>
        <label>
          Title
          <input value={wishTitle} onChange={(event) => setWishTitle(event.target.value)} />
        </label>
        <button onClick={addWishlist} type="button">
          <Gift size={18} />
          Add
        </button>
        <MiniList items={wishlist.map((item) => item.title)} />
      </div>
      <div className="panel">
        <h2>Dates</h2>
        <label>
          Title
          <input value={dateTitle} onChange={(event) => setDateTitle(event.target.value)} />
        </label>
        <label>
          Date
          <input type="date" value={dateValue} onChange={(event) => setDateValue(event.target.value)} />
        </label>
        <button onClick={addDate} type="button">
          <CalendarDays size={18} />
          Add
        </button>
        <MiniList items={dates.map((item) => `${item.title}: ${item.date_value}`)} />
      </div>
    </div>
  );
}

function LoveMap({ session, showError }: { session: Session; showError: (error: unknown) => void }) {
  const [items, setItems] = useState<Memory[]>([]);

  useEffect(() => {
    apiRequest<Memory[]>(session, "/api/love-map").then(setItems).catch(showError);
  }, []);

  return (
    <div className="stack">
      <div className="section-title">
        <h2>Love Map</h2>
        <MapPin size={20} />
      </div>
      <div className="map-list">
        {items.map((item) => (
          <article className="map-item" key={item.id}>
            <MapPin size={18} />
            <div>
              <strong>{item.location}</strong>
              <p>{item.content}</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function MiniList({ items }: { items: string[] }) {
  return (
    <div className="mini-list">
      {items.map((item, index) => (
        <div key={`${item}-${index}`}>{item}</div>
      ))}
    </div>
  );
}
