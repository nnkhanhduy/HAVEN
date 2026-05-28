import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  CalendarDays,
  Check,
  ChevronRight,
  Gift,
  Heart,
  ImagePlus,
  LogOut,
  MapPin,
  MessageCircle,
  Pencil,
  Plus,
  RefreshCw,
  LocateFixed,
  Send,
  Share2,
  Settings,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { apiFormRequest, apiRequest, apiBaseUrl, appVersion, supabase } from "./lib/api";
import type { AskResponse, ImportantDate, Memory, Preference, Profile, WishlistItem } from "./types";

type Notice = { type: "ok" | "error"; text: string } | null;
type Tab = "today" | "memories" | "ask" | "wiki" | "map" | "settings";
type CreateCoupleResult = {
  couple_id: string;
  profile: Profile;
  invite?: { code: string; couple_id: string; expires_at?: string | null } | null;
};

const tabs = [
  { id: "today" as const, label: "Today", icon: Sparkles },
  { id: "memories" as const, label: "Memories", icon: Heart },
  { id: "ask" as const, label: "Coach", icon: MessageCircle },
  { id: "wiki" as const, label: "Profile", icon: Gift },
  { id: "map" as const, label: "Map", icon: MapPin },
  { id: "settings" as const, label: "Settings", icon: Settings },
];

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
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
    setProfileLoading(true);
    try {
      const nextProfile = await apiRequest<Profile | null>(session, "/api/onboarding/profile");
      setProfile(nextProfile);
    } catch (error) {
      showError(error);
    } finally {
      setProfileLoading(false);
    }
  }

  function showError(error: unknown) {
    setNotice({ type: "error", text: error instanceof Error ? error.message : "Something went wrong" });
  }

  function showOk(text: string) {
    setNotice({ type: "ok", text });
  }

  if (loading || (session && profileLoading)) {
    return <LoadingScreen text={session ? "Checking your Haven" : "Opening your Haven"} />;
  }

  return (
    <main className="app-shell">
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

function LoadingScreen({ text = "Opening your Haven" }: { text?: string }) {
  return (
    <main className="loading-screen">
      <div className="loading-mark">
        <Heart size={28} />
      </div>
      <p>{text}</p>
      <span className="version-badge">Frontend {shortVersion(appVersion)}</span>
    </main>
  );
}

function NoticeBanner({ notice, onClose }: { notice: NonNullable<Notice>; onClose: () => void }) {
  return (
    <button className={`notice ${notice.type}`} onClick={onClose} type="button">
      <span>{notice.text}</span>
      <X size={16} />
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
      showOk(mode === "signin" ? "Signed in" : "Account created. Check your email if confirmation is enabled.");
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    if (!email) {
      showError(new Error("Enter your email first"));
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      if (error) throw error;
      showOk("Password recovery email sent");
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="auth-page page-enter">
      <div className="auth-ambient" />
      <div className="auth-story">
        <div className="brand-lockup">
          <span className="brand-mark">
            <Heart size={24} />
          </span>
          <span>Haven</span>
        </div>
        <h1>A private place for the moments only you two understand.</h1>
        <p>
          Capture memories, learn each other's preferences, and ask your shared history for ideas when it matters.
        </p>
        <div className="auth-highlights">
          <span>Private couple space</span>
          <span>Memory-powered AI</span>
          <span>Shared rituals</span>
        </div>
      </div>

      <form className="auth-card" onSubmit={(event) => event.preventDefault()}>
        <div>
          <p className="eyebrow">Welcome back</p>
          <h2>Sign in to Haven</h2>
        </div>
        <label>
          Email
          <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" />
        </label>
        <label>
          Password
          <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" />
        </label>
        <div className="button-row">
          <button disabled={busy || !email || !password} onClick={() => submit("signin")} type="button">
            <Send size={17} />
            Sign in
          </button>
          <button className="secondary" disabled={busy || !email || !password} onClick={() => submit("signup")} type="button">
            Sign up
          </button>
        </div>
        <button className="text-button" disabled={busy} onClick={resetPassword} type="button">
          Forgot password?
        </button>
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
  const [createdInvite, setCreatedInvite] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function createCouple() {
    setBusy(true);
    try {
      const result = await apiRequest<CreateCoupleResult>(session, "/api/onboarding/couple", {
        method: "POST",
        body: JSON.stringify({
          display_name: displayName || null,
          role: "partner_1",
          anniversary_date: anniversaryDate || null,
        }),
      });
      if (result.invite?.code) {
        setCreatedInvite(result.invite.code);
        showOk("Your Haven is ready. Share the invite code with your partner.");
      } else {
        showOk("Your Haven is ready");
        await refreshProfile();
      }
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }

  async function copyInvite() {
    if (!createdInvite) return;
    try {
      await navigator.clipboard.writeText(createdInvite);
      showOk("Invite code copied");
    } catch {
      showOk(`Invite code: ${createdInvite}`);
    }
  }

  async function joinCouple() {
    const normalizedCode = inviteCode.trim().toUpperCase();
    setBusy(true);
    try {
      await apiRequest(session, "/api/onboarding/join", {
        method: "POST",
        body: JSON.stringify({
          code: normalizedCode,
          display_name: displayName || null,
          role: "partner_2",
        }),
      });
      showOk("Joined your shared Haven");
      await refreshProfile();
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="onboarding-page page-enter">
      <div className="onboarding-header">
        <div className="brand-lockup">
          <span className="brand-mark">
            <Heart size={23} />
          </span>
          <span>Haven</span>
        </div>
        <div className="header-actions">
          <span className="version-badge">Frontend {shortVersion(appVersion)}</span>
          <button className="ghost" onClick={() => supabase.auth.signOut()} type="button">
            <LogOut size={17} />
            Sign out
          </button>
        </div>
      </div>
      <div className="onboarding-copy">
        <p className="eyebrow">One more step</p>
        <h1>Create or join your private couple space.</h1>
      </div>
      <div className="choice-grid">
        <section className="choice-card">
          <h2>Create a Haven</h2>
          {createdInvite ? (
            <div className="quick-invite">
              <p>Send this code to your partner. They can paste it into Join with invite.</p>
              <div className="invite-display">{createdInvite}</div>
              <div className="button-row">
                <button onClick={copyInvite} type="button">
                  <Share2 size={17} />
                  Copy code
                </button>
                <button className="secondary" onClick={refreshProfile} type="button">
                  Continue
                  <ChevronRight size={17} />
                </button>
              </div>
            </div>
          ) : (
            <>
              <p>Start a shared space and get an invite code immediately.</p>
              <label>
                Display name
                <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
              </label>
              <label>
                Anniversary
                <input type="date" value={anniversaryDate} onChange={(event) => setAnniversaryDate(event.target.value)} />
              </label>
              <button disabled={busy} onClick={createCouple} type="button">
                <Plus size={18} />
                Create and get code
              </button>
            </>
          )}
        </section>
        <section className="choice-card accent">
          <h2>Join with invite</h2>
          <p>Use the invite code from your partner to enter the same space.</p>
          <label>
            Display name
            <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
          </label>
          <label>
            Invite code
            <input
              className="invite-input"
              value={inviteCode}
              onChange={(event) => setInviteCode(event.target.value.trim().toUpperCase())}
            />
          </label>
          <button disabled={busy || inviteCode.trim().length < 4} onClick={joinCouple} type="button">
            Join Haven
            <ChevronRight size={18} />
          </button>
        </section>
      </div>
      <ApiStatusPanel compact />
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
  const [tab, setTab] = useState<Tab>("today");
  const [inviteCode, setInviteCode] = useState<string | null>(null);

  async function createInvite() {
    try {
      const invite = await apiRequest<{ code: string }>(session, "/api/onboarding/invite", { method: "POST" });
      setInviteCode(invite.code);
      showOk(`Invite code: ${invite.code}`);
    } catch (error) {
      showError(error);
    }
  }

  return (
    <section className="workspace-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-mark">
            <Heart size={22} />
          </span>
          <div>
            <strong>Haven</strong>
            <span>{profile.display_name || "Partner"}</span>
          </div>
        </div>
        <button className="invite-button" onClick={createInvite} type="button">
          <Plus size={17} />
          Invite partner
        </button>
        {inviteCode ? <div className="invite-code">Code {inviteCode}</div> : null}
        <nav className="side-nav">
          {tabs.map((item) => {
            const Icon = item.icon;
            return (
              <button className={tab === item.id ? "active" : ""} key={item.id} onClick={() => setTab(item.id)} type="button">
                <Icon size={18} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>

      <div className="mobile-topbar">
        <div className="brand-lockup">
          <span className="brand-mark">
            <Heart size={21} />
          </span>
          <span>Haven</span>
        </div>
        <button className="icon-only ghost" onClick={createInvite} title="Invite partner" type="button">
          <Plus size={18} />
        </button>
      </div>

      <section className="content-panel">
        <div key={tab} className="tab-view page-enter">
          {tab === "today" ? <Today session={session} profile={profile} setTab={setTab} showError={showError} /> : null}
          {tab === "memories" ? <Memories session={session} showError={showError} showOk={showOk} /> : null}
          {tab === "ask" ? <AskAi session={session} showError={showError} /> : null}
          {tab === "wiki" ? <Wiki session={session} showError={showError} showOk={showOk} /> : null}
          {tab === "map" ? <LoveMap session={session} showError={showError} showOk={showOk} /> : null}
          {tab === "settings" ? (
            <SettingsView session={session} profile={profile} apiBaseUrl={apiBaseUrl} showError={showError} showOk={showOk} />
          ) : null}
        </div>
      </section>

      <nav className="bottom-nav">
        {tabs.slice(0, 5).map((item) => {
          const Icon = item.icon;
          return (
            <button className={tab === item.id ? "active" : ""} key={item.id} onClick={() => setTab(item.id)} type="button">
              <Icon size={18} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </section>
  );
}

function Today({
  session,
  profile,
  setTab,
  showError,
}: {
  session: Session;
  profile: Profile;
  setTab: (tab: Tab) => void;
  showError: (error: unknown) => void;
}) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [dates, setDates] = useState<ImportantDate[]>([]);
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiRequest<Memory[]>(session, "/api/memories?limit=3"),
      apiRequest<ImportantDate[]>(session, "/api/important-dates"),
      apiRequest<WishlistItem[]>(session, "/api/wishlist"),
    ])
      .then(([nextMemories, nextDates, nextWishlist]) => {
        setMemories(nextMemories);
        setDates(nextDates);
        setWishlist(nextWishlist);
      })
      .catch(showError)
      .finally(() => setLoading(false));
  }, [session.access_token]);

  const nextDate = [...dates].sort((a, b) => a.date_value.localeCompare(b.date_value))[0];

  return (
    <div className="view-stack">
      <header className="hero-panel">
        <div>
          <p className="eyebrow">Today in your Haven</p>
          <h1>{profile.display_name ? `Hi, ${profile.display_name}` : "Welcome back"}</h1>
          <p>Keep the small details close. They become the story you two can return to later.</p>
        </div>
        <button onClick={() => setTab("memories")} type="button">
          <ImagePlus size={18} />
          Add memory
        </button>
      </header>

      <div className="metric-grid">
        <MetricCard label="Recent memories" value={loading ? "..." : String(memories.length)} />
        <MetricCard label="Wishlist ideas" value={loading ? "..." : String(wishlist.length)} />
        <MetricCard label="Important dates" value={loading ? "..." : String(dates.length)} />
      </div>

      <div className="quick-action-grid">
        <button className="quick-action-card" onClick={() => setTab("memories")} type="button">
          <ImagePlus size={20} />
          <span>Add a memory</span>
        </button>
        <button className="quick-action-card" onClick={() => setTab("ask")} type="button">
          <MessageCircle size={20} />
          <span>Ask your AI</span>
        </button>
        <button className="quick-action-card" onClick={() => setTab("wiki")} type="button">
          <Gift size={20} />
          <span>Update wiki</span>
        </button>
      </div>

      <div className="dashboard-grid">
        <section className="surface">
          <SectionHeader title="Recent moments" actionLabel="View all" onAction={() => setTab("memories")} />
          {loading ? <SkeletonRows /> : memories.length ? memories.map((memory) => <MemoryMini key={memory.id} memory={memory} />) : <EmptyState title="No memories yet" text="Start with one moment from today." />}
        </section>
        <section className="surface warm">
          <SectionHeader title="Next ritual" />
          {nextDate ? (
            <div className="date-spotlight">
              <CalendarDays size={22} />
              <div>
                <strong>{nextDate.title}</strong>
                <span>{formatDate(nextDate.date_value)}</span>
              </div>
            </div>
          ) : (
            <EmptyState title="No dates saved" text="Add anniversaries and meaningful days in Wiki." />
          )}
          <button className="secondary full" onClick={() => setTab("wiki")} type="button">
            Open Wiki
          </button>
        </section>
      </div>
    </div>
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
  const [image, setImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [editing, setEditing] = useState<Memory | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<Memory | null>(null);
  const [memoryView, setMemoryView] = useState<"diary" | "photos">("diary");
  const [busy, setBusy] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    loadMemories();
  }, []);

  useEffect(() => {
    if (!image) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(image);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  async function loadMemories() {
    setLoadingList(true);
    try {
      setMemories(await apiRequest<Memory[]>(session, "/api/memories"));
    } catch (error) {
      showError(error);
    } finally {
      setLoadingList(false);
    }
  }

  async function createMemory() {
    setBusy(true);
    try {
      const form = new FormData();
      form.append("content", content);
      if (location) form.append("location", location);
      if (image) form.append("image", image);
      await apiFormRequest(session, "/api/memories", form);
      setContent("");
      setLocation("");
      setImage(null);
      setComposerOpen(false);
      if (fileRef.current) fileRef.current.value = "";
      showOk("Diary entry saved");
      await loadMemories();
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }

  async function updateMemory() {
    if (!editing) return;
    setBusy(true);
    try {
      await apiRequest(session, `/api/memories/${editing.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          content: editing.content || null,
          location: editing.location || null,
          sentiment: editing.sentiment || null,
        }),
      });
      setEditing(null);
      showOk("Memory updated");
      await loadMemories();
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }

  async function deleteMemory(memoryId: string) {
    if (!window.confirm("Delete this memory?")) return;
    setBusy(true);
    try {
      await apiRequest(session, `/api/memories/${memoryId}`, { method: "DELETE" });
      showOk("Memory deleted");
      await loadMemories();
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }

  const photoMemories = memories.filter((memory) => memory.image_signed_url);
  const diaryGroups = groupMemoriesByDate(memories);

  return (
    <div className="view-stack">
      <div className="section-title-row">
        <SectionTitle title="Memories" eyebrow="Shared Diary" subtitle="A shared diary for notes, photos, and the little pieces of your days." icon={Heart} />
        <button onClick={() => setComposerOpen(true)} type="button">
          <Plus size={18} />
          New diary entry
        </button>
      </div>

      <section className="memory-board">
        <div className="section-header">
          <div className="segmented-control">
            <button className={memoryView === "diary" ? "active" : ""} onClick={() => setMemoryView("diary")} type="button">
              Diary
            </button>
            <button className={memoryView === "photos" ? "active" : ""} onClick={() => setMemoryView("photos")} type="button">
              Photos
            </button>
          </div>
          <button className="text-button" onClick={loadMemories} type="button">
            Refresh
          </button>
        </div>
        {loadingList ? (
          <SkeletonRows />
        ) : memoryView === "diary" && memories.length ? (
          <div className="diary-book">
            {diaryGroups.map(([dateLabel, group]) => (
              <section className="diary-day" key={dateLabel}>
                <div className="diary-date">{dateLabel}</div>
                <div className="diary-entries">
                  {group.map((memory) => (
                    <article className={memory.image_signed_url ? "diary-entry with-photo" : "diary-entry"} key={memory.id}>
                      {memory.image_signed_url ? (
                        <button className="diary-photo-button" onClick={() => setSelectedPhoto(memory)} type="button">
                          <img alt="" src={memory.image_signed_url} />
                        </button>
                      ) : null}
                      <div className="diary-entry-body">
                        <p>{memory.content || "Photo memory"}</p>
                        <div className="meta">
                          {memory.location ? <span>{memory.location}</span> : null}
                          {memory.timestamp ? <span>{formatDate(memory.timestamp)}</span> : null}
                        </div>
                        <div className="card-actions">
                          <button className="icon-only ghost" onClick={() => setEditing(memory)} title="Edit diary entry" type="button">
                            <Pencil size={16} />
                          </button>
                          <button className="icon-only danger" disabled={busy} onClick={() => deleteMemory(memory.id)} title="Delete diary entry" type="button">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : memoryView === "photos" && photoMemories.length ? (
          <div className="photo-library">
            {photoMemories.map((memory) => (
              <button className="photo-tile" key={memory.id} onClick={() => setSelectedPhoto(memory)} type="button">
                <img alt="" src={memory.image_signed_url || ""} />
                <span>{memory.location || formatDate(memory.timestamp || memory.created_at || "")}</span>
              </button>
            ))}
          </div>
        ) : (
          <EmptyState
            title={memoryView === "photos" ? "No photos yet" : "No diary entries yet"}
            text={memoryView === "photos" ? "Add a photo to a diary entry and it will appear here." : "Write a note or attach a photo to start your shared diary."}
          />
        )}
      </section>

      {editing ? (
        <Modal title="Edit memory" onClose={() => setEditing(null)}>
          <label>
            Diary note
            <textarea value={editing.content ?? ""} onChange={(event) => setEditing({ ...editing, content: event.target.value })} />
          </label>
          <label>
            Location
            <input value={editing.location ?? ""} onChange={(event) => setEditing({ ...editing, location: event.target.value })} />
          </label>
          <label>
            Sentiment
            <input value={editing.sentiment ?? ""} onChange={(event) => setEditing({ ...editing, sentiment: event.target.value })} />
          </label>
          <div className="button-row">
            <button disabled={busy} onClick={updateMemory} type="button">
              <Check size={17} />
              Save
            </button>
            <button className="secondary" onClick={() => setEditing(null)} type="button">
              Cancel
            </button>
          </div>
        </Modal>
      ) : null}

      {composerOpen ? (
        <Modal
          title="New diary entry"
          onClose={() => {
            setComposerOpen(false);
            setImage(null);
            if (fileRef.current) fileRef.current.value = "";
          }}
        >
          <p className="muted">Saved with the current time when you press save.</p>
          <label className="wide">
            Diary note
            <textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder="Write the note you want to remember with this moment." />
          </label>
          <label>
            Location
            <input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Cafe, beach, home..." />
          </label>
          <div className="upload-row">
            <button className="secondary" onClick={() => fileRef.current?.click()} type="button">
              <Upload size={17} />
              {image ? image.name : "Add photo"}
            </button>
            <input
              ref={fileRef}
              hidden
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => setImage(event.target.files?.[0] ?? null)}
            />
            {previewUrl ? <img className="image-preview" alt="" src={previewUrl} /> : null}
            <button disabled={busy || (!content.trim() && !image)} onClick={createMemory} type="button">
              <Plus size={18} />
              {busy ? "Saving..." : "Save entry"}
            </button>
          </div>
        </Modal>
      ) : null}

      {selectedPhoto ? (
        <Modal title={selectedPhoto.location || "Photo memory"} onClose={() => setSelectedPhoto(null)}>
          {selectedPhoto.image_signed_url ? <img className="photo-viewer-image" alt="" src={selectedPhoto.image_signed_url} /> : null}
          <p className="photo-caption">{selectedPhoto.content || "No note yet"}</p>
          <div className="meta">
            {selectedPhoto.location ? <span>{selectedPhoto.location}</span> : null}
            {selectedPhoto.timestamp ? <span>{formatDate(selectedPhoto.timestamp)}</span> : null}
          </div>
          <div className="button-row">
            <button className="secondary" onClick={() => setEditing(selectedPhoto)} type="button">
              <Pencil size={17} />
              Edit note
            </button>
            <button className="danger" disabled={busy} onClick={() => deleteMemory(selectedPhoto.id)} type="button">
              <Trash2 size={17} />
              Delete
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function AskAi({ session, showError }: { session: Session; showError: (error: unknown) => void }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<AskResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const suggestions = [
    "What should we do together this weekend?",
    "What gift would feel personal based on what we saved?",
    "Give us advice based on our recent diary entries.",
  ];

  async function ask(nextQuestion = question) {
    setQuestion(nextQuestion);
    setBusy(true);
    try {
      const query = encodeURIComponent(nextQuestion);
      setAnswer(await apiRequest<AskResponse>(session, `/api/ask?question=${query}`));
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="view-stack">
      <SectionTitle title="Relationship Coach" eyebrow="AI Coach" subtitle="Advice and suggestions based on your diary, profile, places, ideas, and important dates." icon={Sparkles} />
      <section className="chat-panel">
        <label>
          What would you like help with?
          <textarea value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask for advice, date ideas, gift suggestions, or a gentle read on your recent moments." />
        </label>
        <div className="suggestion-row">
          {suggestions.map((item) => (
            <button className="chip-button" key={item} onClick={() => ask(item)} type="button">
              {item}
            </button>
          ))}
        </div>
        <button disabled={busy || question.length < 2} onClick={() => ask()} type="button">
          <Send size={17} />
          {busy ? "Thinking..." : "Get advice"}
        </button>
      </section>
      {busy ? <SkeletonRows /> : null}
      {answer ? (
        <section className="answer-panel">
          <p>{answer.answer}</p>
          <h3>Used from your diary</h3>
          <div className="source-list">
            {answer.sources.map((source) => (
              <MemoryMini key={source.id} memory={source} />
            ))}
          </div>
        </section>
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
  const [likes, setLikes] = useState("");
  const [dislikes, setDislikes] = useState("");
  const [notes, setNotes] = useState("");
  const [wishTitle, setWishTitle] = useState("");
  const [wishDescription, setWishDescription] = useState("");
  const [wishStatus, setWishStatus] = useState("open");
  const [dateTitle, setDateTitle] = useState("");
  const [dateValue, setDateValue] = useState("");
  const [dateType, setDateType] = useState("anniversary");
  const [editingPreferenceId, setEditingPreferenceId] = useState<string | null>(null);
  const [editingWishlistId, setEditingWishlistId] = useState<string | null>(null);
  const [editingDateId, setEditingDateId] = useState<string | null>(null);
  const [loadingWiki, setLoadingWiki] = useState(true);
  const [savingWiki, setSavingWiki] = useState(false);

  useEffect(() => {
    loadWiki();
  }, []);

  async function loadWiki() {
    setLoadingWiki(true);
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
    } finally {
      setLoadingWiki(false);
    }
  }

  async function savePreference() {
    setSavingWiki(true);
    const payload = {
      category,
      detail_json: {
        likes: splitList(likes),
        dislikes: splitList(dislikes),
        notes: notes || null,
      },
    };
    try {
      await apiRequest(session, editingPreferenceId ? `/api/preferences/${editingPreferenceId}` : "/api/preferences", {
        method: editingPreferenceId ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });
      setEditingPreferenceId(null);
      setLikes("");
      setDislikes("");
      setNotes("");
      showOk("Preference saved");
      await loadWiki();
    } catch (error) {
      showError(error);
    } finally {
      setSavingWiki(false);
    }
  }

  async function saveWishlist() {
    setSavingWiki(true);
    const payload = { title: wishTitle, description: wishDescription || null, category: "gift", status: wishStatus };
    try {
      await apiRequest(session, editingWishlistId ? `/api/wishlist/${editingWishlistId}` : "/api/wishlist", {
        method: editingWishlistId ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });
      setEditingWishlistId(null);
      setWishTitle("");
      setWishDescription("");
      showOk("Wishlist item saved");
      await loadWiki();
    } catch (error) {
      showError(error);
    } finally {
      setSavingWiki(false);
    }
  }

  async function saveDate() {
    setSavingWiki(true);
    const payload = { title: dateTitle, date_value: dateValue, date_type: dateType };
    try {
      await apiRequest(session, editingDateId ? `/api/important-dates/${editingDateId}` : "/api/important-dates", {
        method: editingDateId ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });
      setEditingDateId(null);
      setDateTitle("");
      setDateValue("");
      showOk("Date saved");
      await loadWiki();
    } catch (error) {
      showError(error);
    } finally {
      setSavingWiki(false);
    }
  }

  async function deleteWikiItem(path: string, label: string) {
    if (!window.confirm(`Delete this ${label}?`)) return;
    try {
      await apiRequest(session, path, { method: "DELETE" });
      showOk(`${label} deleted`);
      await loadWiki();
    } catch (error) {
      showError(error);
    }
  }

  return (
    <div className="view-stack">
      <SectionTitle title="Couple Profile" eyebrow="Wiki" subtitle="The details Haven uses to understand your relationship and make better suggestions." icon={Gift} />
      {loadingWiki ? <SkeletonRows /> : null}
      <div className="profile-overview">
        <MetricCard label="Preference notes" value={String(preferences.length)} />
        <MetricCard label="Ideas saved" value={String(wishlist.length)} />
        <MetricCard label="Important dates" value={String(dates.length)} />
      </div>
      <div className="wiki-grid profile-grid">
        <section className="surface">
          <h2>Likes, Dislikes & Notes</h2>
          <label>
            Topic
            <input value={category} onChange={(event) => setCategory(event.target.value)} />
          </label>
          <label>
            Likes
            <input value={likes} onChange={(event) => setLikes(event.target.value)} placeholder="Thai food, bookstores, quiet cafes" />
          </label>
          <label>
            Dislikes
            <input value={dislikes} onChange={(event) => setDislikes(event.target.value)} placeholder="Crowds, spicy food" />
          </label>
          <label>
            Notes
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
          </label>
          <button disabled={savingWiki || !category} onClick={savePreference} type="button">
            {savingWiki ? "Saving..." : editingPreferenceId ? "Update note" : "Save note"}
          </button>
          <div className="wiki-card-list">
            {preferences.length ? (
              preferences.map((item) => (
                <article className="wiki-item-card" key={item.id}>
                  <strong>{item.category}</strong>
                  <p>{formatPreference(item.detail_json)}</p>
                  <div className="card-actions">
                    <button
                      className="icon-only ghost"
                      onClick={() => {
                        setEditingPreferenceId(item.id);
                        setCategory(item.category);
                        setLikes(Array.isArray(item.detail_json.likes) ? item.detail_json.likes.join(", ") : "");
                        setDislikes(Array.isArray(item.detail_json.dislikes) ? item.detail_json.dislikes.join(", ") : "");
                        setNotes(typeof item.detail_json.notes === "string" ? item.detail_json.notes : "");
                      }}
                      title="Edit preference"
                      type="button"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      className="icon-only danger"
                      onClick={() => deleteWikiItem(`/api/preferences/${item.id}`, "preference")}
                      title="Delete preference"
                      type="button"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <span className="muted">Nothing saved yet</span>
            )}
          </div>
        </section>

        <section className="surface">
          <h2>Ideas & Wishlist</h2>
          <label>
            Idea
            <input value={wishTitle} onChange={(event) => setWishTitle(event.target.value)} />
          </label>
          <label>
            Notes
            <textarea value={wishDescription} onChange={(event) => setWishDescription(event.target.value)} />
          </label>
          <label>
            Status
            <select value={wishStatus} onChange={(event) => setWishStatus(event.target.value)}>
              <option value="open">Open</option>
              <option value="planned">Planned</option>
              <option value="done">Done</option>
            </select>
          </label>
          <button disabled={savingWiki || !wishTitle} onClick={saveWishlist} type="button">
            <Gift size={18} />
            {savingWiki ? "Saving..." : editingWishlistId ? "Update idea" : "Add idea"}
          </button>
          <div className="wiki-card-list">
            {wishlist.length ? (
              wishlist.map((item) => (
                <article className="wiki-item-card" key={item.id}>
                  <strong>{item.title}</strong>
                  <p>{item.description || "No notes yet"}</p>
                  <div className="meta">
                    <span>{item.status}</span>
                    {item.category ? <span>{item.category}</span> : null}
                  </div>
                  <div className="card-actions">
                    <button
                      className="icon-only ghost"
                      onClick={() => {
                        setEditingWishlistId(item.id);
                        setWishTitle(item.title);
                        setWishDescription(item.description || "");
                        setWishStatus(item.status);
                      }}
                      title="Edit wishlist item"
                      type="button"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      className="icon-only danger"
                      onClick={() => deleteWikiItem(`/api/wishlist/${item.id}`, "wishlist item")}
                      title="Delete wishlist item"
                      type="button"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <span className="muted">Nothing saved yet</span>
            )}
          </div>
        </section>

        <section className="surface">
          <h2>Important Dates</h2>
          <label>
            Title
            <input value={dateTitle} onChange={(event) => setDateTitle(event.target.value)} />
          </label>
          <label>
            Date
            <input type="date" value={dateValue} onChange={(event) => setDateValue(event.target.value)} />
          </label>
          <label>
            Type
            <input value={dateType} onChange={(event) => setDateType(event.target.value)} />
          </label>
          <button disabled={savingWiki || !dateTitle || !dateValue} onClick={saveDate} type="button">
            <CalendarDays size={18} />
            {savingWiki ? "Saving..." : editingDateId ? "Update date" : "Add date"}
          </button>
          <div className="wiki-card-list">
            {dates.length ? (
              dates.map((item) => (
                <article className="wiki-item-card" key={item.id}>
                  <strong>{item.title}</strong>
                  <p>{formatDate(item.date_value)}</p>
                  <div className="meta">
                    <span>{item.date_type}</span>
                  </div>
                  <div className="card-actions">
                    <button
                      className="icon-only ghost"
                      onClick={() => {
                        setEditingDateId(item.id);
                        setDateTitle(item.title);
                        setDateValue(item.date_value);
                        setDateType(item.date_type);
                      }}
                      title="Edit date"
                      type="button"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      className="icon-only danger"
                      onClick={() => deleteWikiItem(`/api/important-dates/${item.id}`, "date")}
                      title="Delete date"
                      type="button"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <span className="muted">Nothing saved yet</span>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function LoveMap({
  session,
  showError,
  showOk,
}: {
  session: Session;
  showError: (error: unknown) => void;
  showOk: (text: string) => void;
}) {
  const [items, setItems] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [editingCheckIn, setEditingCheckIn] = useState<Memory | null>(null);
  const [draftCoords, setDraftCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [geoNotice, setGeoNotice] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    loadMapItems();
  }, [session.access_token]);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    const map = L.map(mapRef.current, { scrollWheelZoom: true }).setView([13.7563, 100.5018], 11);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);
    const markerLayer = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;
    markerLayerRef.current = markerLayer;
    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markerLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const markerLayer = markerLayerRef.current;
    if (!map || !markerLayer) return;
    markerLayer.clearLayers();
    const pinned = items.filter(hasCoordinates);
    const bounds = L.latLngBounds([]);
    pinned.forEach((item) => {
      const marker = L.marker([item.latitude!, item.longitude!], {
        icon: L.divIcon({
          className: "haven-map-marker",
          html: '<span></span>',
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        }),
      });
      marker.bindPopup(renderMarkerPopup(item));
      marker.addTo(markerLayer);
      bounds.extend([item.latitude!, item.longitude!]);
    });
    if (pinned.length) {
      map.fitBounds(bounds, { padding: [38, 38], maxZoom: 15 });
    }
  }, [items]);

  async function loadMapItems() {
    setLoading(true);
    try {
      setItems(await apiRequest<Memory[]>(session, "/api/love-map"));
    } catch (error) {
      showError(error);
    } finally {
      setLoading(false);
    }
  }

  function startCheckIn() {
    setGeoNotice(null);
    if (!navigator.geolocation) {
      setDraftCoords(null);
      setGeoNotice("Location is not available in this browser. You can still save a memory without a pin.");
      setCheckInOpen(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setDraftCoords({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setCheckInOpen(true);
      },
      () => {
        setDraftCoords(null);
        setGeoNotice("Location permission was not granted. You can still save the memory, but it will not have a map pin.");
        setCheckInOpen(true);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }

  function startEditCheckIn(memory: Memory) {
    setGeoNotice(null);
    setDraftCoords(hasCoordinates(memory) ? { latitude: memory.latitude!, longitude: memory.longitude! } : null);
    setEditingCheckIn(memory);
  }

  async function deleteCheckIn(memory: Memory) {
    const label = memory.place_name || memory.location || "this check-in";
    if (!window.confirm(`Delete ${label}?`)) return;
    setDeletingId(memory.id);
    try {
      await apiRequest(session, `/api/memories/${memory.id}`, { method: "DELETE" });
      showOk("Check-in deleted");
      await loadMapItems();
    } catch (error) {
      showError(error);
    } finally {
      setDeletingId(null);
    }
  }

  const pinnedItems = items.filter(hasCoordinates);
  const unpinnedItems = items.filter((item) => !hasCoordinates(item));

  function renderPlaceCard(memory: Memory) {
    return (
      <article className="location-card" key={memory.id}>
        <MapPin size={20} />
        <div>
          <h2>{memory.place_name || memory.location || "Saved place"}</h2>
          <span>{memory.timestamp ? formatDate(memory.timestamp) : "Check-in"}</span>
          {memory.image_signed_url ? <img alt="" src={memory.image_signed_url} /> : null}
          <p>{memory.content || memory.location_note || "A saved place in your story."}</p>
          {memory.location_note ? <p className="location-note">{memory.location_note}</p> : null}
          <div className="card-actions">
            <button className="icon-only ghost" onClick={() => startEditCheckIn(memory)} title="Edit check-in" type="button">
              <Pencil size={16} />
            </button>
            <button
              className="icon-only danger"
              disabled={deletingId === memory.id}
              onClick={() => deleteCheckIn(memory)}
              title="Delete check-in"
              type="button"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      </article>
    );
  }

  return (
    <div className="view-stack">
      <SectionTitle title="Love Map" eyebrow="Places" subtitle="Places that hold parts of your story." icon={MapPin} />
      <section className="map-shell">
        <div className="map-toolbar">
          <div>
            <strong>{pinnedItems.length} pinned places</strong>
            <span>{loading ? "Loading map memories..." : "OpenStreetMap, free-first check-ins"}</span>
          </div>
          <div className="button-row">
            <button className="secondary" onClick={loadMapItems} type="button">
              <RefreshCw size={17} />
              Refresh
            </button>
            <button onClick={startCheckIn} type="button">
              <LocateFixed size={17} />
              Check in
            </button>
          </div>
        </div>
        <div className="leaflet-map" ref={mapRef} />
      </section>

      {loading ? <SkeletonRows /> : null}
      {!loading && !items.length ? (
        <EmptyState title="No places yet" text="Check in from the map to save a place, note, and optional photo." />
      ) : null}

      {pinnedItems.length ? (
        <div className="map-board">
          {pinnedItems.map(renderPlaceCard)}
        </div>
      ) : null}

      {unpinnedItems.length ? (
        <section className="surface">
          <SectionHeader title="Places without pin" />
          <div className="map-board">{unpinnedItems.map(renderPlaceCard)}</div>
        </section>
      ) : null}

      {checkInOpen ? (
        <CheckInModal
          coords={draftCoords}
          geoNotice={geoNotice}
          onClose={() => setCheckInOpen(false)}
          onSaved={async () => {
            setCheckInOpen(false);
            await loadMapItems();
          }}
          session={session}
          showError={showError}
          showOk={showOk}
        />
      ) : null}

      {editingCheckIn ? (
        <CheckInModal
          coords={draftCoords}
          geoNotice={geoNotice}
          initialMemory={editingCheckIn}
          onClose={() => setEditingCheckIn(null)}
          onSaved={async () => {
            setEditingCheckIn(null);
            await loadMapItems();
          }}
          session={session}
          showError={showError}
          showOk={showOk}
        />
      ) : null}
    </div>
  );
}

function CheckInModal({
  coords,
  geoNotice,
  initialMemory,
  onClose,
  onSaved,
  session,
  showError,
  showOk,
}: {
  coords: { latitude: number; longitude: number } | null;
  geoNotice: string | null;
  initialMemory?: Memory | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
  session: Session;
  showError: (error: unknown) => void;
  showOk: (text: string) => void;
}) {
  const [placeName, setPlaceName] = useState(initialMemory?.place_name || initialMemory?.location || "");
  const [content, setContent] = useState(initialMemory?.content || "");
  const [locationNote, setLocationNote] = useState(initialMemory?.location_note || "");
  const [currentCoords, setCurrentCoords] = useState(coords);
  const [image, setImage] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const isEditing = Boolean(initialMemory);

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      showError(new Error("Location is not available in this browser"));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCurrentCoords({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLocating(false);
      },
      () => {
        showError(new Error("Location permission was not granted"));
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }

  async function saveCheckIn() {
    setBusy(true);
    try {
      if (isEditing && initialMemory) {
        await apiRequest(session, `/api/memories/${initialMemory.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            memory_type: "check_in",
            content: content || null,
            location: placeName.trim() || null,
            place_name: placeName.trim() || null,
            location_note: locationNote.trim() || null,
            latitude: currentCoords?.latitude ?? null,
            longitude: currentCoords?.longitude ?? null,
          }),
        });
        showOk("Check-in updated");
      } else {
        const form = new FormData();
        form.append("memory_type", "check_in");
        form.append("content", content);
        if (placeName.trim()) {
          form.append("place_name", placeName.trim());
          form.append("location", placeName.trim());
        }
        if (locationNote.trim()) form.append("location_note", locationNote.trim());
        if (currentCoords) {
          form.append("latitude", String(currentCoords.latitude));
          form.append("longitude", String(currentCoords.longitude));
        }
        if (image) form.append("image", image);
        await apiFormRequest(session, "/api/memories", form);
        showOk("Check-in saved");
      }
      await onSaved();
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={isEditing ? "Edit check-in" : "Check in"} onClose={onClose}>
      {geoNotice ? <p className="inline-warning">{geoNotice}</p> : null}
      <label>
        Place name
        <input value={placeName} onChange={(event) => setPlaceName(event.target.value)} placeholder="Cafe, beach, home..." />
      </label>
      <label>
        Memory
        <textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder="What do you want to remember here?" />
      </label>
      <label>
        Location note
        <input value={locationNote} onChange={(event) => setLocationNote(event.target.value)} placeholder="Table by the window, sunset view..." />
      </label>
      {currentCoords ? (
        <div className="coordinate-row">
          <span>{currentCoords.latitude.toFixed(5)}</span>
          <span>{currentCoords.longitude.toFixed(5)}</span>
        </div>
      ) : null}
      <div className="upload-row">
        <button className="secondary" disabled={locating} onClick={useCurrentLocation} type="button">
          <LocateFixed size={17} />
          {locating ? "Locating..." : currentCoords ? "Update pin" : "Add pin"}
        </button>
        {currentCoords ? (
          <button className="secondary" onClick={() => setCurrentCoords(null)} type="button">
            <X size={17} />
            Remove pin
          </button>
        ) : null}
        {!isEditing ? (
          <>
            <button className="secondary" onClick={() => fileRef.current?.click()} type="button">
              <Upload size={17} />
              {image ? image.name : "Add photo"}
            </button>
            <input
              ref={fileRef}
              hidden
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => setImage(event.target.files?.[0] ?? null)}
            />
          </>
        ) : null}
        <button disabled={busy || (!content.trim() && !image && !placeName.trim())} onClick={saveCheckIn} type="button">
          <Check size={17} />
          {busy ? "Saving..." : isEditing ? "Save changes" : "Save check-in"}
        </button>
      </div>
    </Modal>
  );
}

function hasCoordinates(memory: Memory): boolean {
  return typeof memory.latitude === "number" && typeof memory.longitude === "number";
}

function renderMarkerPopup(memory: Memory): string {
  const title = escapeHtml(memory.place_name || memory.location || "Saved place");
  const body = escapeHtml(memory.content || memory.location_note || "A saved Haven check-in.");
  const when = memory.timestamp ? escapeHtml(formatDate(memory.timestamp)) : "Check-in";
  const image = memory.image_signed_url ? `<img src="${escapeHtml(memory.image_signed_url)}" alt="" />` : "";
  return `<article class="map-popup">${image}<strong>${title}</strong><span>${when}</span><p>${body}</p></article>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return entities[char];
  });
}

function ApiStatusPanel({ compact = false }: { compact?: boolean }) {
  const [status, setStatus] = useState<"checking" | "ok" | "down">("checking");
  const [version, setVersion] = useState<string>("unknown");

  useEffect(() => {
    fetch(`${apiBaseUrl}/health`)
      .then(async (response) => {
        if (!response.ok) {
          setStatus("down");
          return;
        }
        const payload = await response.json();
        setVersion(typeof payload.version === "string" ? payload.version : "unknown");
        setStatus("ok");
      })
      .catch(() => setStatus("down"));
  }, []);

  return (
    <section className={compact ? "api-status compact" : "api-status"}>
      <div>
        <strong>Deployment status</strong>
        <span>Frontend {shortVersion(appVersion)} · API {shortVersion(version)}</span>
      </div>
      <span className={`status-dot ${status}`}>{status}</span>
    </section>
  );
}

function SettingsView({
  session,
  profile,
  apiBaseUrl,
  showError,
  showOk,
}: {
  session: Session;
  profile: Profile;
  apiBaseUrl: string;
  showError: (error: unknown) => void;
  showOk: (text: string) => void;
}) {
  const [inviteCode, setInviteCode] = useState<string | null>(null);

  async function copyValue(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      showOk(`${label} copied`);
    } catch {
      showOk(value);
    }
  }

  async function createInvite() {
    try {
      const invite = await apiRequest<{ code: string }>(session, "/api/onboarding/invite", { method: "POST" });
      setInviteCode(invite.code);
      await copyValue(invite.code, "Invite code");
    } catch (error) {
      showError(error);
    }
  }

  return (
    <div className="view-stack">
      <SectionTitle title="Settings" eyebrow="Account" subtitle="Account and deployment details for this Haven." icon={Settings} />
      <section className="surface settings-list">
        <ApiStatusPanel />
        <InfoRow label="Display name" value={profile.display_name || "Not set"} />
        <InfoRow label="Role" value={profile.role || "member"} />
        <InfoRow label="Couple ID" value={profile.couple_id} />
        {inviteCode ? <InfoRow label="Latest invite" value={inviteCode} /> : null}
        <div className="button-row">
          <button className="secondary" onClick={() => copyValue(profile.couple_id, "Couple ID")} type="button">
            Copy Couple ID
          </button>
          <button onClick={createInvite} type="button">
            <Share2 size={17} />
            Copy new invite
          </button>
        </div>
        <button className="secondary" onClick={() => supabase.auth.signOut()} type="button">
          <LogOut size={17} />
          Sign out
        </button>
      </section>
    </div>
  );
}

function SectionTitle({
  title,
  subtitle,
  eyebrow,
  icon: Icon,
}: {
  title: string;
  subtitle: string;
  eyebrow?: string;
  icon: typeof Heart;
}) {
  return (
    <header className="section-title-block">
      <div>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
        <span>{subtitle}</span>
      </div>
      <div className="section-icon">
        <Icon size={22} />
      </div>
    </header>
  );
}

function SectionHeader({ title, actionLabel, onAction }: { title: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <div className="section-header">
      <h2>{title}</h2>
      {actionLabel ? (
        <button className="text-button" onClick={onAction} type="button">
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="metric-card">
      <strong>{value}</strong>
      <span>{label}</span>
    </article>
  );
}

function MemoryMini({ memory }: { memory: Pick<Memory, "id" | "content" | "location" | "timestamp" | "sentiment"> }) {
  return (
    <article className="memory-mini">
      <p>{memory.content || "Image memory"}</p>
      <div className="meta">
        {memory.location ? <span>{memory.location}</span> : null}
        {memory.sentiment ? <span>{memory.sentiment}</span> : null}
        {memory.timestamp ? <span>{formatDate(memory.timestamp)}</span> : null}
      </div>
    </article>
  );
}

function MiniList({ items }: { items: string[] }) {
  return (
    <div className="mini-list">
      {items.length ? items.map((item, index) => <div key={`${item}-${index}`}>{item}</div>) : <span className="muted">Nothing saved yet</span>}
    </div>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty-state">
      <Sparkles size={22} />
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="skeleton-stack">
      <span />
      <span />
      <span />
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-card" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="icon-only ghost" onClick={onClose} title="Close" type="button">
            <X size={17} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="info-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function groupMemoriesByDate(memories: Memory[]): [string, Memory[]][] {
  const grouped = memories.reduce<Record<string, Memory[]>>((acc, memory) => {
    const label = formatDate(memory.timestamp || memory.created_at || new Date().toISOString());
    acc[label] = [...(acc[label] || []), memory];
    return acc;
  }, {});
  return Object.entries(grouped);
}

function formatPreference(value: Record<string, unknown>): string {
  const likes = Array.isArray(value.likes) ? value.likes.join(", ") : "";
  const notes = typeof value.notes === "string" ? value.notes : "";
  return [likes, notes].filter(Boolean).join(" · ") || JSON.stringify(value);
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function shortVersion(value: string): string {
  return value.length > 12 ? value.slice(0, 7) : value;
}
