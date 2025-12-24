import { createEffect, createSignal, For, Show, onCleanup } from "solid-js";
import type { NotificationType } from "../components/notifications/useNotifications";
import type { UserRole } from "../types/user";

const apiUrl = () => import.meta.env.VITE_API_URL ?? "http://localhost:3000";

type Project = {
  id: string;
  title: string;
  description: string;
  owner: string;
  members: string[];
  createdAt: string;
  updatedAt: string;
};

type ChatMessage = {
  id: string;
  sender: string;
  company: string | null;
  text: string;
  createdAt: string;
};

type ChatServerEvent =
  | { type: "history"; messages: ChatMessage[] }
  | { type: "message"; message: ChatMessage }
  | { type: "error"; message: string };

type ChatClientEvent = {
  type: "message";
  text: string;
};

type TeamsPageProps = {
  jwtToken: string | null;
  userRole: UserRole | null;
  onNotify?: (message: string, type?: NotificationType) => void;
};

const formatDate = (value: string) => new Date(value).toLocaleString();

const TeamsPage = (props: TeamsPageProps) => {
  const [projects, setProjects] = createSignal<Project[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const allowed = () => props.userRole === "owner" || props.userRole === "employee";
  const [chatMessages, setChatMessages] = createSignal<ChatMessage[]>([]);
  const [chatInput, setChatInput] = createSignal("");
  const [chatStatus, setChatStatus] = createSignal("Chat disconnected");
  const [chatError, setChatError] = createSignal<string | null>(null);
  const [chatSocket, setChatSocket] = createSignal<WebSocket | null>(null);
  const [userCompany, setUserCompany] = createSignal<string | null>(null);
  const [chatUser, setChatUser] = createSignal<string | null>(null);
  const [profileLoading, setProfileLoading] = createSignal(false);

  const notify = (message: string, type: NotificationType = "info") => {
    props.onNotify?.(message, type);
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

  const handleFetchError = async (response: Response) => {
    let message = `${response.status} ${response.statusText}`;
    try {
      const payload = (await response.json()) as { message?: string };
      if (payload?.message) {
        message = payload.message;
      }
    } catch {
      /* ignore */
    }
    setError(message);
    setProjects([]);
    notify(message, "error");
  };

  const handleProfileError = async (response: Response) => {
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
    setUserCompany(null);
    setChatUser(null);
  };

  const loadTeams = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${apiUrl()}/projects`, {
        headers: getHeaders()
      });
      if (!response.ok) {
        await handleFetchError(response);
        return;
      }
      const payload = (await response.json()) as { projects: Project[] };
      setProjects(payload.projects ?? []);
    } catch (fetchError) {
      const message = (fetchError as Error).message || "Unable to load team data.";
      setError(message);
      setProjects([]);
      notify(message, "error");
    } finally {
      setLoading(false);
    }
  };

  const loadProfile = async () => {
    if (!props.jwtToken) {
      setUserCompany(null);
      setChatUser(null);
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


  const canSendChat = () => {
    const socket = chatSocket();
    return (
      !!socket &&
      socket.readyState === WebSocket.OPEN &&
      !!userCompany() &&
      chatInput().trim().length > 0
    );
  };

  const handleChatSubmit = (event: SubmitEvent) => {
    event.preventDefault();
    if (!canSendChat()) {
      return;
    }

    const socket = chatSocket();
    if (!socket) {
      return;
    }

    socket.send(JSON.stringify({ type: "message", text: chatInput().trim() }));
    setChatInput("");
  };

  createEffect(() => {
    if (!allowed()) {
      setProjects([]);
      setLoading(false);
      setError(null);
      return;
    }

    if (!props.jwtToken) {
      setProjects([]);
      setLoading(false);
      setError("Please sign in to view the teams overview.");
      return;
    }

    void loadTeams();
    void loadProfile();
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

  return (
    <section class="profile-page">
      <div>
        <h1>Teams</h1>
        <p class="helper-text">
          Owners and employees can monitor active projects and the teammates assigned to them.
        </p>
      </div>

      <Show when={!allowed()}>
        <p class="helper-text">Teams insights are only available to owner and employee roles.</p>
      </Show>

      <Show when={allowed()}>
        <Show when={loading()}>
          <p class="helper-text">Loading team overview...</p>
        </Show>

        <Show when={!loading()}>
          <Show when={error()}>
            <p class="helper-text">{error()}</p>
          </Show>

          <Show when={!error()}>
            <Show when={projects().length > 0}>
              <div class="profile-grid">
                <For each={projects()}>
                  {(project) => (
                    <article class="profile-card profile-card--emphasis">
                      <header class="profile-item-heading">
                        <div>
                          <strong>{project.title}</strong>
                          <p class="helper-text">{project.description || "No description yet."}</p>
                        </div>
                        <span class="small-text">Updated {formatDate(project.updatedAt)}</span>
                      </header>
                      <p class="small-text helper-text">Owner: {project.owner}</p>
                      <p class="small-text">
                        Members: {project.members.length > 0 ? project.members.join(", ") : "No members yet."}
                      </p>
                    </article>
                  )}
                </For>
              </div>
            </Show>

            <Show when={projects().length === 0}>
              <p class="helper-text">No active teams yet.</p>
            </Show>
          </Show>
        </Show>
        <article class="profile-card profile-card--emphasis team-chat">
          <header class="profile-item-heading">
            <div>
              <strong>Company chat</strong>
              <Show when={chatUser()}>
                <p class="helper-text">
                  {chatUser()} - {userCompany() ?? "No company assigned yet"}
                </p>
              </Show>
              <Show when={!chatUser()}>
                <p class="helper-text">Loading chat identity...</p>
              </Show>
            </div>
            <span class="small-text">{chatStatus()}</span>
          </header>
          <Show when={profileLoading()}>
            <p class="helper-text">Refreshing company membership...</p>
          </Show>
          <div class="team-chat__messages">
            <Show when={chatMessages().length > 0}>
              <For each={chatMessages()}>
                {(message) => (
                  <article class="team-chat__message">
                    <header class="team-chat__message-header">
                      <strong>{message.sender}</strong>
                      <span class="small-text">{formatDate(message.createdAt)}</span>
                    </header>
                    <p>{message.text}</p>
                  </article>
                )}
              </For>
            </Show>
            <Show when={chatMessages().length === 0}>
              <p class="helper-text">No messages yet.</p>
            </Show>
          </div>
          <form class="team-chat__form" onSubmit={handleChatSubmit}>
            <textarea
              class="team-chat__input"
              placeholder="Share quick updates with teammates from your company..."
              value={chatInput()}
              onInput={(event) => setChatInput(event.currentTarget.value)}
              rows={3}
            />
            <button class="primary" type="submit" disabled={!canSendChat()}>
              Send
            </button>
          </form>
          <Show when={chatError()}>
            <p class="helper-text">{chatError()}</p>
          </Show>
          <Show when={!userCompany()}>
            <p class="helper-text">Join or assign a company to unlock chat posting.</p>
          </Show>
        </article>
      </Show>
    </section>
  );
};

export default TeamsPage;
