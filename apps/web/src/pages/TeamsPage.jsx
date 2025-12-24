import { createEffect, createSignal, For, Show } from "solid-js";
const apiUrl = () => import.meta.env.VITE_API_URL ?? "http://localhost:3000";
const formatDate = (value) => new Date(value).toLocaleString();
const TeamsPage = (props) => {
    const [projects, setProjects] = createSignal([]);
    const [loading, setLoading] = createSignal(false);
    const [error, setError] = createSignal(null);
    const allowed = () => props.userRole === "owner" || props.userRole === "employee";
    const notify = (message, type = "info") => {
        var _a;
        (_a = props.onNotify) === null || _a === void 0 ? void 0 : _a.call(props, message, type);
    };
    const getHeaders = () => {
        const headers = { "Content-Type": "application/json" };
        if (props.jwtToken) {
            headers.Authorization = `Bearer ${props.jwtToken}`;
        }
        return headers;
    };
    const handleFetchError = async (response) => {
        let message = `${response.status} ${response.statusText}`;
        try {
            const payload = await response.json();
            if (payload === null || payload === void 0 ? void 0 : payload.message) {
                message = payload.message;
            }
        }
        catch (_a) {
            /* ignore */
        }
        setError(message);
        setProjects([]);
        notify(message, "error");
    };
    const loadTeams = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`${apiUrl()}/projects`, { headers: getHeaders() });
            if (!response.ok) {
                await handleFetchError(response);
                return;
            }
            const payload = await response.json();
            setProjects(payload.projects ?? []);
        }
        catch (fetchError) {
            const message = (fetchError === null || fetchError === void 0 ? void 0 : fetchError.message) || "Unable to load team data.";
            setError(message);
            setProjects([]);
            notify(message, "error");
        }
        finally {
            setLoading(false);
        }
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
    });
    return (<section class="profile-page">
            <div>
                <h1>Teams</h1>
                <p class="helper-text">Owners and employees can monitor active projects and the teammates assigned to them.</p>
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
                    </Show>
                </Show>
            </Show>
        </section>);
};
export default TeamsPage;
