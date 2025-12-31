import { createEffect, createSignal, For, Show, onCleanup } from "solid-js";
import type { NotificationType } from "../components/notifications/useNotifications";
import type { UserRole } from "../types/user";

const apiUrl = () => import.meta.env.VITE_API_URL ?? "http://localhost:3000";

type ChatMessage = {
  id: string;
  sender: string;
  company: string | null;
  text: string;
  createdAt: string;
  pending?: boolean;
};

type DirectChatMessage = {
  id: string;
  sender: string;
  recipient: string;
  text: string;
  createdAt: string;
  pending?: boolean;
};

type CompanyMember = {
  username: string;
  role: UserRole;
  company: string | null;
};

type ChatServerEvent =
  | { type: "history"; messages: ChatMessage[] }
  | { type: "message"; message: ChatMessage }
  | { type: "error"; message: string };

type ChatClientEvent = {
  type: "message";
  text: string;
};

type DirectChatServerEvent =
  | { type: "history"; messages: DirectChatMessage[] }
  | { type: "message"; message: DirectChatMessage }
  | { type: "error"; message: string };

type DirectChatClientEvent = {
  type: "message";
  text: string;
};

type TeamsPageProps = {
  jwtToken: string | null;
  userRole: UserRole | null;
  onNotify?: (message: string, type?: NotificationType) => void;
  onUnauthorized?: () => void;
};

const formatDate = (value: string) => new Date(value).toLocaleString();

const formatRoleLabel = (role: UserRole) => {
  if (role === "owner") {
    return "Owner";
  }
  if (role === "employee") {
    return "Employee";
  }
  if (role === "guest") {
    return "Guest";
  }
  return "User";
};

const getInitials = (value: string) => {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

const TeamsPage = (props: TeamsPageProps) => {
  const allowed = () => props.userRole === "owner" || props.userRole === "employee";
  const [chatMessages, setChatMessages] = createSignal<ChatMessage[]>([]);
  const [chatInput, setChatInput] = createSignal("");
  const [chatStatus, setChatStatus] = createSignal("Chat disconnected");
  const [chatError, setChatError] = createSignal<string | null>(null);
  const [chatSocket, setChatSocket] = createSignal<WebSocket | null>(null);
  const [userCompany, setUserCompany] = createSignal<string | null>(null);
  const [chatUser, setChatUser] = createSignal<string | null>(null);
  const [profileLoading, setProfileLoading] = createSignal(false);
  const [companyMembers, setCompanyMembers] = createSignal<CompanyMember[]>([]);
  const [membersLoading, setMembersLoading] = createSignal(false);
  const [membersError, setMembersError] = createSignal<string | null>(null);
  const [activeChannel, setActiveChannel] = createSignal("global");
  const [activeDirectUser, setActiveDirectUser] = createSignal<string | null>(null);
  const [directMessages, setDirectMessages] = createSignal<DirectChatMessage[]>([]);
  const [directInput, setDirectInput] = createSignal("");
  const [directStatus, setDirectStatus] = createSignal("Direct chat disconnected");
  const [directError, setDirectError] = createSignal<string | null>(null);
  const [directSocket, setDirectSocket] = createSignal<WebSocket | null>(null);
  let chatMessagesEl: HTMLDivElement | undefined;
  let lastMessageEl: HTMLElement | undefined;
  let directMessagesEl: HTMLDivElement | undefined;
  let lastDirectMessageEl: HTMLElement | undefined;

  const isSavedMessages = () => {
    const user = chatUser();
    return Boolean(user && activeDirectUser() === user);
  };

  const notify = (message: string, type: NotificationType = "info") => {
    props.onNotify?.(message, type);
  };

  const handleUnauthorizedResponse = (response: Response) => {
    if (response.status === 401) {
      props.onUnauthorized?.();
      return true;
    }
    return false;
  };

  const getHeaders = () => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };
    if (props.jwtToken) {
      headers.Authorization = `Bearer ${props.jwtToken}`;
    }
    return headers;
  };

  const handleProfileError = async (response: Response) => {
    if (handleUnauthorizedResponse(response)) {
      return;
    }
    let message = `${response.status} ${response.statusText}`;
    try {
      const payload = (await response.json()) as { message?: string };
      if (payload?.message) {
        message = payload.message;
      }
    } catch {
      /* ignore */
    }
    setChatError(message);
    notify(message, "error");
    setCompanyMembers([]);
    setMembersError(null);
    setUserCompany(null);
    setChatUser(null);
  };

  const handleCompanyMembersError = async (response: Response) => {
    if (handleUnauthorizedResponse(response)) {
      return;
    }
    let message = `${response.status} ${response.statusText}`;
    try {
      const payload = (await response.json()) as { message?: string };
      if (payload?.message) {
        message = payload.message;
      }
    } catch {
      /* ignore */
    }
    setMembersError(message);
    setCompanyMembers([]);
    notify(message, "error");
  };

  const loadProfile = async () => {
    if (!props.jwtToken) {
      setUserCompany(null);
      setChatUser(null);
      setCompanyMembers([]);
      setMembersError(null);
      return;
    }

    setProfileLoading(true);
    setChatError(null);
    try {
      const response = await fetch(`${apiUrl()}/me`, {
        headers: getHeaders()
      });
      if (!response.ok) {
        await handleProfileError(response);
        return;
      }
      const payload = (await response.json()) as {
        user: { username: string; company: string | null };
      };
      setUserCompany(payload.user.company ?? null);
      setChatUser(payload.user.username);
    } catch (fetchError) {
      const message = (fetchError as Error).message || "Unable to load profile data.";
      setChatError(message);
      notify(message, "error");
    } finally {
      setProfileLoading(false);
    }
  };

  const loadCompanyMembers = async () => {
    const token = props.jwtToken;
    if (!token) {
      setCompanyMembers([]);
      setMembersError(null);
      return;
    }

    const company = userCompany();
    if (!company) {
      setCompanyMembers([]);
      setMembersError(null);
      return;
    }

    setMembersLoading(true);
    setMembersError(null);
    try {
      const response = await fetch(`${apiUrl()}/me/company/members`, {
        headers: getHeaders()
      });
      if (!response.ok) {
        await handleCompanyMembersError(response);
        return;
      }
      const payload = (await response.json()) as { members: CompanyMember[] };
      setCompanyMembers(payload.members ?? []);
    } catch (fetchError) {
      const message = (fetchError as Error).message || "Unable to load company members.";
      setMembersError(message);
      setCompanyMembers([]);
      notify(message, "error");
    } finally {
      setMembersLoading(false);
    }
  };


  const canSendChat = () => {
    return (
      chatInput().trim().length > 0
    );
  };

  const canSendDirect = () => {
    return Boolean(activeDirectUser()) && directInput().trim().length > 0;
  };

  const handleChatSubmit = (event: SubmitEvent) => {
    event.preventDefault();
    if (!canSendChat()) {
      return;
    }

    const socket = chatSocket();
    const text = chatInput();
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "message", text }));
    } else {
      const now = new Date().toISOString();
      setChatMessages((current) => [
        ...current,
        {
          id: `pending-${Date.now()}`,
          sender: chatUser() ?? "You",
          company: userCompany() ?? null,
          text,
          createdAt: now,
          pending: true
        }
      ]);
    }
    setChatInput("");
  };

  const handleDirectSubmit = (event: SubmitEvent) => {
    event.preventDefault();
    if (!canSendDirect()) {
      return;
    }

    const peer = activeDirectUser();
    if (!peer) {
      return;
    }

    const socket = directSocket();
    const text = directInput();
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "message", text } satisfies DirectChatClientEvent));
    } else {
      const now = new Date().toISOString();
      setDirectMessages((current) => [
        ...current,
        {
          id: `pending-${Date.now()}`,
          sender: chatUser() ?? "You",
          recipient: peer,
          text,
          createdAt: now,
          pending: true
        }
      ]);
    }
    setDirectInput("");
  };

  const handleChatKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Enter") {
      return;
    }
    if (event.shiftKey) {
      return;
    }
    event.preventDefault();
    if (!canSendChat()) {
      return;
    }
    handleChatSubmit(new SubmitEvent("submit"));
  };

  const handleDirectKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Enter") {
      return;
    }
    if (event.shiftKey) {
      return;
    }
    event.preventDefault();
    if (!canSendDirect()) {
      return;
    }
    handleDirectSubmit(new SubmitEvent("submit"));
  };

  const scrollChatToLatest = () => {
    if (!chatMessagesEl || !lastMessageEl) {
      return;
    }
    const containerHeight = chatMessagesEl.clientHeight;
    const lastHeight = lastMessageEl.offsetHeight;
    if (lastHeight > containerHeight) {
      chatMessagesEl.scrollTop = Math.max(lastMessageEl.offsetTop - 8, 0);
      return;
    }
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
  };

  const scrollDirectToLatest = () => {
    if (!directMessagesEl || !lastDirectMessageEl) {
      return;
    }
    const containerHeight = directMessagesEl.clientHeight;
    const lastHeight = lastDirectMessageEl.offsetHeight;
    if (lastHeight > containerHeight) {
      directMessagesEl.scrollTop = Math.max(lastDirectMessageEl.offsetTop - 8, 0);
      return;
    }
    directMessagesEl.scrollTop = directMessagesEl.scrollHeight;
  };

  createEffect(() => {
    if (!allowed()) {
      return;
    }
    if (activeDirectUser()) {
      return;
    }
    const messages = chatMessages();
    if (messages.length === 0) {
      return;
    }
    queueMicrotask(scrollChatToLatest);
  });

  createEffect(() => {
    if (!allowed()) {
      return;
    }
    if (!activeDirectUser()) {
      return;
    }
    const messages = directMessages();
    if (messages.length === 0) {
      return;
    }
    queueMicrotask(scrollDirectToLatest);
  });

  createEffect(() => {
    if (!allowed()) {
      return;
    }

    if (!props.jwtToken) {
      return;
    }

    void loadProfile();
  });

  createEffect(() => {
    const token = props.jwtToken;
    if (!allowed() || !token) {
      setCompanyMembers([]);
      setMembersError(null);
      return;
    }

    if (!userCompany()) {
      setCompanyMembers([]);
      setMembersError(null);
      return;
    }

    void loadCompanyMembers();
  });

  createEffect(() => {
    if (!allowed()) {
      setChatStatus("Team chat is restricted to owners and employees.");
      setChatSocket(null);
      setChatMessages([]);
      return;
    }

    const token = props.jwtToken;
    if (!token) {
      setChatStatus("Sign in to access the team chat.");
      setChatMessages([]);
      setChatSocket(null);
      return;
    }

    const socketUrl = new URL(`${apiUrl()}/teams/chat`);
    socketUrl.protocol = socketUrl.protocol === "https:" ? "wss:" : "ws:";
    socketUrl.searchParams.set("token", token);

    const socket = new WebSocket(socketUrl.toString());
    setChatSocket(socket);
    setChatStatus("Connecting to chat...");
    setChatError(null);

    const handleOpen = () => {
      setChatStatus("Connected to the team chat.");
    };

    const handleMessage = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data) as ChatServerEvent;
        if (payload.type === "history") {
          setChatMessages(payload.messages);
          setChatStatus("Ready for company chat.");
          return;
        }
        if (payload.type === "message") {
          setChatMessages((current) => [...current, payload.message].slice(-200));
          return;
        }
        if (payload.type === "error") {
          setChatError(payload.message);
        }
      } catch {
        setChatError("Unexpected chat response.");
      }
    };

    const handleClose = () => {
      setChatStatus("Chat disconnected.");
      setChatSocket(null);
    };

    const handleError = () => {
      setChatError("Unable to reach chat service.");
      setChatStatus("Chat unavailable.");
    };

    socket.addEventListener("open", handleOpen);
    socket.addEventListener("message", handleMessage);
    socket.addEventListener("close", handleClose);
    socket.addEventListener("error", handleError);

    onCleanup(() => {
      socket.removeEventListener("open", handleOpen);
      socket.removeEventListener("message", handleMessage);
      socket.removeEventListener("close", handleClose);
      socket.removeEventListener("error", handleError);
      socket.close();
    });
  });

  createEffect(() => {
    if (!allowed()) {
      setActiveDirectUser(null);
      setDirectStatus("Direct chat is restricted to owners and employees.");
      setDirectSocket(null);
      setDirectMessages([]);
      return;
    }

    const token = props.jwtToken;
    const peer = activeDirectUser();
    if (!token) {
      setDirectStatus("Sign in to access direct chats.");
      setDirectMessages([]);
      setDirectSocket(null);
      return;
    }

    if (!peer) {
      setDirectStatus("Pick a teammate to start a direct chat.");
      setDirectMessages([]);
      setDirectSocket(null);
      return;
    }

    const socketUrl = new URL(`${apiUrl()}/teams/direct`);
    socketUrl.protocol = socketUrl.protocol === "https:" ? "wss:" : "ws:";
    socketUrl.searchParams.set("token", token);
    socketUrl.searchParams.set("peer", peer);

    const socket = new WebSocket(socketUrl.toString());
    setDirectSocket(socket);
    setDirectStatus(`Connecting to ${peer}...`);
    setDirectError(null);

    const handleOpen = () => {
      setDirectStatus(`Connected to ${peer}.`);
    };

    const handleMessage = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data) as DirectChatServerEvent;
        if (payload.type === "history") {
          setDirectMessages(payload.messages);
          setDirectStatus(`Ready to chat with ${peer}.`);
          return;
        }
        if (payload.type === "message") {
          setDirectMessages((current) => [...current, payload.message].slice(-200));
          return;
        }
        if (payload.type === "error") {
          setDirectError(payload.message);
        }
      } catch {
        setDirectError("Unexpected chat response.");
      }
    };

    const handleClose = () => {
      setDirectStatus("Direct chat disconnected.");
      setDirectSocket(null);
    };

    const handleError = () => {
      setDirectError("Unable to reach direct chat service.");
      setDirectStatus("Direct chat unavailable.");
    };

    socket.addEventListener("open", handleOpen);
    socket.addEventListener("message", handleMessage);
    socket.addEventListener("close", handleClose);
    socket.addEventListener("error", handleError);

    onCleanup(() => {
      socket.removeEventListener("open", handleOpen);
      socket.removeEventListener("message", handleMessage);
      socket.removeEventListener("close", handleClose);
      socket.removeEventListener("error", handleError);
      socket.close();
    });
  });
  return (
    <section class="profile-page">
      <div>
        <h1>Teams</h1>
        <p class="helper-text">
          Owners and employees can monitor teammates and use the company chat.
        </p>
      </div>

      <Show when={!allowed()}>
        <p class="helper-text">Teams insights are only available to owner and employee roles.</p>
      </Show>

      <Show when={allowed()}>
        <div class="teams-layout teams-shell">
          <div class="teams-layout__projects teams-sidebar">
            <Show when={userCompany()}>
              <article class="profile-card profile-card--emphasis company-members teams-sidebar__card">
                <header class="profile-item-heading teams-sidebar__header">
                  <div>
                    <strong>Company teammates</strong>
                    <p class="helper-text">Roster for {userCompany()}</p>
                  </div>
                  <span class="small-text">
                    {companyMembers().length} member{companyMembers().length === 1 ? "" : "s"}
                  </span>
                </header>
                <Show when={membersLoading()}>
                  <p class="helper-text">Loading company members...</p>
                </Show>
                <Show when={membersError()}>
                  <p class="helper-text">{membersError()}</p>
                </Show>
                <Show when={!membersLoading() && !membersError()}>
                  <Show when={companyMembers().length > 0}>
                    <ul class="company-members__list teams-sidebar__list">
                      <For each={companyMembers()}>
                        {(member) => (
                          <li class="company-members__item teams-sidebar__item">
                            <Show when={member.username !== chatUser()}>
                              <div class="teams-member">
                                <div class="teams-member__avatar" aria-hidden="true">
                                  {getInitials(member.username)}
                                </div>
                                <div class="teams-member__meta">
                                  <strong>{member.username}</strong>
                                  <p class="helper-text">{formatRoleLabel(member.role)}</p>
                                </div>
                              </div>
                              <div class="teams-member__actions">
                                <button
                                  class="ghost teams-member__action"
                                  type="button"
                                  onClick={() => {
                                    setActiveDirectUser(member.username);
                                    setDirectMessages([]);
                                    setDirectError(null);
                                    setDirectInput("");
                                  }}
                                >
                                  Message
                                </button>
                                <span class="company-members__role teams-member__role">
                                  {formatRoleLabel(member.role)}
                                </span>
                              </div>
                            </Show>
                            <Show when={member.username === chatUser()}>
                              <div class="teams-member">
                                <div class="teams-member__avatar" aria-hidden="true">
                                  {getInitials(member.username)}
                                </div>
                                <div class="teams-member__meta">
                                  <strong>Saved Messages</strong>
                                  <p class="helper-text">Personal notes and reminders</p>
                                </div>
                              </div>
                              <div class="teams-member__actions">
                                <button
                                  class="ghost teams-member__action"
                                  type="button"
                                  onClick={() => {
                                    if (chatUser()) {
                                      setActiveDirectUser(chatUser());
                                    }
                                    setDirectMessages([]);
                                    setDirectError(null);
                                    setDirectInput("");
                                  }}
                                >
                                  Open
                                </button>
                              </div>
                            </Show>
                          </li>
                        )}
                      </For>
                    </ul>
                  </Show>
                  <Show when={companyMembers().length === 0}>
                    <p class="helper-text">No teammates assigned to {userCompany()} yet.</p>
                  </Show>
                </Show>
              </article>
              <article class="profile-card profile-card--emphasis teams-sidebar__card">
                <header class="profile-item-heading teams-sidebar__header">
                  <div>
                    <strong>Channels</strong>
                    <p class="helper-text">Team spaces</p>
                  </div>
                  <span class="small-text">1 channel</span>
                </header>
                <ul class="teams-channels__list">
                  <li class="teams-channels__item">
                    <button
                      classList={{
                        "teams-channels__button": true,
                        "teams-channels__button--active": activeChannel() === "global" && !activeDirectUser()
                      }}
                      type="button"
                      onClick={() => {
                        setActiveDirectUser(null);
                        setActiveChannel("global");
                        setDirectMessages([]);
                        setDirectError(null);
                      }}
                    >
                      <span class="teams-channels__hash">#</span>
                      <div class="teams-channels__meta">
                        <strong>global</strong>
                        <p class="helper-text">Company-wide chat</p>
                      </div>
                    </button>
                  </li>
                </ul>
              </article>
            </Show>
          </div>
          <article class="profile-card profile-card--emphasis team-chat teams-layout__chat teams-chat-panel">
            <header class="profile-item-heading teams-chat__header">
              <div class="teams-chat__title">
                <Show when={activeDirectUser()}>
                  <strong>{isSavedMessages() ? "Saved Messages" : "Direct chat"}</strong>
                </Show>
                <Show when={!activeDirectUser()}>
                  <strong>Company chat</strong>
                </Show>
                <Show when={chatUser() && activeDirectUser() && !isSavedMessages()}>
                  <p class="helper-text">
                    {chatUser()} and {activeDirectUser()}
                  </p>
                </Show>
                <Show when={chatUser() && activeDirectUser() && isSavedMessages()}>
                  <p class="helper-text">Private space for your notes</p>
                </Show>
                <Show when={chatUser() && !activeDirectUser()}>
                  <p class="helper-text">
                    {chatUser()} - {userCompany() ?? "No company assigned yet"}
                  </p>
                </Show>
                <Show when={!chatUser()}>
                  <p class="helper-text">Loading chat identity...</p>
                </Show>
              </div>
              <div class="teams-chat__status">
                <span class="teams-chat__dot" aria-hidden="true" />
                <span class="small-text">
                  <Show when={activeDirectUser()}>{directStatus()}</Show>
                  <Show when={!activeDirectUser()}>{chatStatus()}</Show>
                </span>
              </div>
            </header>
            <Show when={profileLoading()}>
              <p class="helper-text">Refreshing company membership...</p>
            </Show>
            <Show when={!activeDirectUser()}>
              <div
                class="team-chat__messages teams-chat__messages"
                ref={(el) => {
                  chatMessagesEl = el;
                }}
              >
                <Show when={chatMessages().length > 0}>
                  <For each={chatMessages()}>
                    {(message, index) => {
                      const isOwn = () => message.sender === chatUser();
                      const timeLabel = () => {
                        if (message.pending) {
                          return "Sending...";
                        }
                        return formatDate(message.createdAt);
                      };
                      return (
                        <article
                          classList={{
                            "team-chat__message": true,
                            "team-chat__message--own": isOwn()
                          }}
                          ref={(el) => {
                            if (index() === chatMessages().length - 1) {
                              lastMessageEl = el;
                            }
                          }}
                        >
                          <div class="team-chat__bubble">
                            <Show when={!isOwn()}>
                              <strong class="team-chat__sender">{message.sender}</strong>
                            </Show>
                            <pre class="team-chat__text">{message.text}</pre>
                            <span class="team-chat__time">{timeLabel()}</span>
                          </div>
                        </article>
                      );
                    }}
                  </For>
                </Show>
                <Show when={chatMessages().length === 0}>
                  <p class="helper-text">No messages yet.</p>
                </Show>
              </div>
              <form class="team-chat__form teams-chat__form" onSubmit={handleChatSubmit}>
                <div class="teams-chat__input-row">
                  <textarea
                    class="team-chat__input teams-chat__input"
                    placeholder="Write a message..."
                    value={chatInput()}
                    onInput={(event) => setChatInput(event.currentTarget.value)}
                    onKeyDown={handleChatKeyDown}
                    rows={2}
                  />
                  <button class="primary teams-chat__send" type="submit" disabled={!canSendChat()}>
                    Send
                  </button>
                </div>
              </form>
              <Show when={chatError()}>
                <p class="helper-text">{chatError()}</p>
              </Show>
            </Show>
            <Show when={activeDirectUser()}>
              <div class="teams-chat__controls">
                <button
                  class="ghost teams-chat__switch"
                  type="button"
                  onClick={() => {
                    setActiveDirectUser(null);
                    setDirectMessages([]);
                    setDirectError(null);
                  }}
                >
                  Back to company chat
                </button>
              </div>
              <div
                class="team-chat__messages teams-chat__messages"
                ref={(el) => {
                  directMessagesEl = el;
                }}
              >
                <Show when={directMessages().length > 0}>
                  <For each={directMessages()}>
                    {(message, index) => {
                      const isOwn = () => message.sender === chatUser();
                      const timeLabel = () => {
                        if (message.pending) {
                          return "Sending...";
                        }
                        return formatDate(message.createdAt);
                      };
                      return (
                        <article
                          classList={{
                            "team-chat__message": true,
                            "team-chat__message--own": isOwn()
                          }}
                          ref={(el) => {
                            if (index() === directMessages().length - 1) {
                              lastDirectMessageEl = el;
                            }
                          }}
                        >
                          <div class="team-chat__bubble">
                            <Show when={!isOwn()}>
                              <strong class="team-chat__sender">{message.sender}</strong>
                            </Show>
                            <pre class="team-chat__text">{message.text}</pre>
                            <span class="team-chat__time">{timeLabel()}</span>
                          </div>
                        </article>
                      );
                    }}
                  </For>
                </Show>
                <Show when={directMessages().length === 0}>
                  <p class="helper-text">No messages yet.</p>
                </Show>
              </div>
              <form class="team-chat__form teams-chat__form" onSubmit={handleDirectSubmit}>
                <div class="teams-chat__input-row">
                  <textarea
                    class="team-chat__input teams-chat__input"
                    placeholder="Write a direct message..."
                    value={directInput()}
                    onInput={(event) => setDirectInput(event.currentTarget.value)}
                    onKeyDown={handleDirectKeyDown}
                    rows={2}
                  />
                  <button class="primary teams-chat__send" type="submit" disabled={!canSendDirect()}>
                    Send
                  </button>
                </div>
              </form>
              <Show when={directError()}>
                <p class="helper-text">{directError()}</p>
              </Show>
            </Show>
          </article>
        </div>
      </Show>
    </section>
  );
};

export default TeamsPage;
