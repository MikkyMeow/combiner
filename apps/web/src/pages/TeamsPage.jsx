import { createEffect, createSignal, For, Show, onCleanup } from "solid-js";
const apiUrl = () => import.meta.env.VITE_API_URL ?? "http://localhost:3000";
const formatDate = (value) => new Date(value).toLocaleString();
const formatRoleLabel = (role) => {
    if (role === "owner") {
        return "Owner";
    }
    if (role === "employee") {
        return "Employee";
    }
    return "User";
};
const TeamsPage = (props) => {
    const [projects, setProjects] = createSignal([]);
    const [loading, setLoading] = createSignal(false);
    const [error, setError] = createSignal(null);
    const allowed = () => props.userRole === "owner" || props.userRole === "employee";
    const [chatMessages, setChatMessages] = createSignal([]);
    const [chatInput, setChatInput] = createSignal("");
    const [chatStatus, setChatStatus] = createSignal("Chat disconnected");
    const [chatError, setChatError] = createSignal(null);
    const [chatSocket, setChatSocket] = createSignal(null);
    const [userCompany, setUserCompany] = createSignal(null);
    const [chatUser, setChatUser] = createSignal(null);
    const [profileLoading, setProfileLoading] = createSignal(false);
    const [companyMembers, setCompanyMembers] = createSignal([]);
    const [membersLoading, setMembersLoading] = createSignal(false);
    const [membersError, setMembersError] = createSignal(null);
    const notify = (message, type = "info") => {
        props.onNotify?.(message, type);
    };
    const getHeaders = () => {
        const headers = {
            "Content-Type": "application/json"
        };
        if (props.jwtToken) {
            headers.Authorization = `Bearer ${props.jwtToken}`;
        }
        return headers;
    };
    const handleFetchError = async (response) => {
        let message = `${response.status} ${response.statusText}`;
        try {
            const payload = (await response.json());
            if (payload?.message) {
                message = payload.message;
            }
        }
        catch {
            /* ignore */
        }
        setError(message);
        setProjects([]);
        notify(message, "error");
    };
    const handleProfileError = async (response) => {
        let message = `${response.status} ${response.statusText}`;
        try {
            const payload = (await response.json());
            if (payload?.message) {
                message = payload.message;
            }
        }
        catch {
            /* ignore */
        }
        setChatError(message);
        notify(message, "error");
        setCompanyMembers([]);
        setMembersError(null);
        setUserCompany(null);
        setChatUser(null);
    };
    const handleCompanyMembersError = async (response) => {
        let message = `${response.status} ${response.statusText}`;
        try {
            const payload = (await response.json());
            if (payload?.message) {
                message = payload.message;
            }
        }
        catch {
            /* ignore */
        }
        setMembersError(message);
        setCompanyMembers([]);
        notify(message, "error");
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
            const payload = (await response.json());
            setProjects(payload.projects ?? []);
        }
        catch (fetchError) {
            const message = fetchError.message || "Unable to load team data.";
            setError(message);
            setProjects([]);
            notify(message, "error");
        }
        finally {
            setLoading(false);
        }
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
            const payload = (await response.json());
            setUserCompany(payload.user.company ?? null);
            setChatUser(payload.user.username);
        }
        catch (fetchError) {
            const message = fetchError.message || "Unable to load profile data.";
            setChatError(message);
            notify(message, "error");
        }
        finally {
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
            const payload = (await response.json());
            setCompanyMembers(payload.members ?? []);
        }
        catch (fetchError) {
            const message = fetchError.message || "Unable to load company members.";
            setMembersError(message);
            setCompanyMembers([]);
            notify(message, "error");
        }
        finally {
            setMembersLoading(false);
        }
    };
    const canSendChat = () => {
        const socket = chatSocket();
        return (!!socket &&
            socket.readyState === WebSocket.OPEN &&
            !!userCompany() &&
            chatInput().trim().length > 0);
    };
    const handleChatSubmit = (event) => {
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
        const handleMessage = (event) => {
            try {
                const payload = JSON.parse(event.data);
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
            }
            catch {
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
    return (<section class="profile-page">
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
            <div class="teams-layout">
              <div class="teams-layout__projects">
                <Show when={projects().length > 0}>
                  <div class="profile-grid">
                    <For each={projects()}>
                      {(project) => (<article class="profile-card profile-card--emphasis">
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
                        </article>)}
                    </For>
                  </div>
                </Show>

                <Show when={projects().length === 0}>
                  <p class="helper-text">No active teams yet.</p>
                </Show>

                <Show when={userCompany()}>
                  <article class="profile-card profile-card--emphasis company-members">
                    <header class="profile-item-heading">
                      <div>
                        <strong>Company teammates</strong>
                        <p class="helper-text">Roster for {userCompany()}</p>
                      </div>
                      <span class="small-text">{companyMembers().length} member{companyMembers().length === 1 ? "" : "s"}</span>
                    </header>
                    <Show when={membersLoading()}>
                      <p class="helper-text">Loading company members...</p>
                    </Show>
                    <Show when={membersError()}>
                      <p class="helper-text">{membersError()}</p>
                    </Show>
                    <Show when={!membersLoading() && !membersError()}>
                      <Show when={companyMembers().length > 0}>
                        <ul class="company-members__list">
                          <For each={companyMembers()}>
                            {(member) => (<li class="company-members__item">
                                <div>
                                  <strong>{member.username}</strong>
                                  <p class="helper-text">{formatRoleLabel(member.role)}</p>
                                </div>
                                <span class="company-members__role">{formatRoleLabel(member.role)}</span>
                              </li>)}
                          </For>
                        </ul>
                      </Show>
                      <Show when={companyMembers().length === 0}>
                        <p class="helper-text">No teammates assigned to {userCompany()} yet.</p>
                      </Show>
                    </Show>
                  </article>
                </Show>
              </div>
              <article class="profile-card profile-card--emphasis team-chat teams-layout__chat">
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
                      {(message) => (<article class="team-chat__message">
                          <header class="team-chat__message-header">
                            <strong>{message.sender}</strong>
                            <span class="small-text">{formatDate(message.createdAt)}</span>
                          </header>
                          <p>{message.text}</p>
                        </article>)}
                    </For>
                  </Show>
                  <Show when={chatMessages().length === 0}>
                    <p class="helper-text">No messages yet.</p>
                  </Show>
                </div>
                <form class="team-chat__form" onSubmit={handleChatSubmit}>
                  <textarea class="team-chat__input" placeholder="Share quick updates with teammates from your company..." value={chatInput()} onInput={(event) => setChatInput(event.currentTarget.value)} rows={3}/>
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
            </div>
          </Show>
        </Show>
      </Show>
    </section>);
};
export default TeamsPage;
