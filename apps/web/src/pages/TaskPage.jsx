import { createEffect, createSignal, Show } from "solid-js";
const apiUrl = () => import.meta.env.VITE_API_URL ?? "http://localhost:3000";
const TaskPage = (props) => {
    const [task, setTask] = createSignal(null);
    const [title, setTitle] = createSignal("");
    const [description, setDescription] = createSignal("");
    const [completed, setCompleted] = createSignal(false);
    const [loading, setLoading] = createSignal(true);
    const [saving, setSaving] = createSignal(false);
    const [error, setError] = createSignal(null);
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
    const handleUnauthorized = () => {
        const message = "Please authenticate before viewing task details.";
        setError(message);
        notify(message, "warning");
    };
    const handleFetchError = async (response) => {
        let message = "Unable to reach the server.";
        try {
            const payload = (await response.json());
            if (payload?.message) {
                message = payload.message;
            }
            else {
                message = `${response.statusText} (${response.status})`;
            }
        }
        catch {
            message = `${response.statusText} (${response.status})`;
        }
        setError(message);
        notify(message, "error");
    };
    const loadTask = async (id) => {
        if (!props.jwtToken) {
            handleUnauthorized();
            setLoading(false);
            setTask(null);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`${apiUrl()}/tasks`, {
                headers: getHeaders()
            });
            if (!response.ok) {
                await handleFetchError(response);
                return;
            }
            const data = (await response.json());
            const found = data.tasks.find((entry) => entry.id === id);
            if (!found) {
                const message = "Task not found.";
                setError(message);
                setTask(null);
                return;
            }
            setTask(found);
            setTitle(found.title);
            setDescription(found.description ?? "");
            setCompleted(found.completed);
        }
        catch (fetchError) {
            const message = fetchError.message || "Unable to load task.";
            setError(message);
            notify(message, "error");
        }
        finally {
            setLoading(false);
        }
    };
    createEffect(() => {
        const id = props.taskId;
        if (!id) {
            setTask(null);
            setError("Task identifier is missing.");
            setLoading(false);
            return;
        }
        void loadTask(id);
    });
    const updateTask = async (id, body, successMessage) => {
        if (!props.jwtToken) {
            handleUnauthorized();
            return null;
        }
        setError(null);
        try {
            const response = await fetch(`${apiUrl()}/tasks/${encodeURIComponent(id)}`, {
                method: "PUT",
                headers: getHeaders(),
                body: JSON.stringify(body)
            });
            if (!response.ok) {
                await handleFetchError(response);
                return null;
            }
            const updated = (await response.json());
            setTask(updated);
            setTitle(updated.title);
            setDescription(updated.description ?? "");
            setCompleted(updated.completed);
            if (successMessage) {
                notify(successMessage, "success");
            }
            return updated;
        }
        catch (fetchError) {
            const message = fetchError.message || "Unable to update task.";
            setError(message);
            notify(message, "error");
            return null;
        }
    };
    const handleSave = async (event) => {
        event.preventDefault();
        const current = task();
        if (!current) {
            return;
        }
        const trimmedTitle = title().trim();
        if (!trimmedTitle) {
            const message = "Task title cannot be empty.";
            setError(message);
            notify(message, "warning");
            return;
        }
        setSaving(true);
        try {
            await updateTask(current.id, { title: trimmedTitle, description: description().trim() }, "Task saved");
        }
        finally {
            setSaving(false);
        }
    };
    const handleToggleCompleted = async () => {
        const current = task();
        if (!current) {
            return;
        }
        setSaving(true);
        try {
            await updateTask(current.id, { completed: !current.completed }, current.completed ? "Task marked pending" : "Task marked complete");
        }
        finally {
            setSaving(false);
        }
    };
    const handleBack = () => {
        if (props.onNavigate) {
            const projectId = task()?.projectId;
            if (projectId) {
                props.onNavigate(`/projects/${encodeURIComponent(projectId)}`);
                return;
            }
            props.onNavigate("/projects");
            return;
        }
        if (typeof window !== "undefined") {
            window.history.back();
        }
    };
    return (<section class="tasks-card task-detail-card">
      <div class="task-detail-header">
        <button type="button" class="ghost" onClick={handleBack}>
          Back
        </button>
        <div>
          <h1>{task()?.title ?? "Task details"}</h1>
            <p class="table-description">
              <Show when={task()} fallback="Loading task information...">
                {(current) => (<span>Updated {new Date(current().updatedAt).toLocaleString()}</span>)}
              </Show>
            </p>
        </div>
      </div>

      <Show when={error()}>
        <p class="helper-text">{error()}</p>
      </Show>

      <Show when={loading()}>
        <p class="helper-text">Loading task...</p>
      </Show>

      <Show when={!loading() && task()}>
        <div class="task-detail-summary">
          <span class={`status-pill ${completed() ? "completed" : ""}`}>
            {completed() ? "Completed" : "Pending"}
          </span>
            <p class="helper-text">
              {task()?.projectId ? "Linked to project" : "No project assigned."}
              <Show when={task()?.projectId}>
                {(projectId) => <span> {projectId()}</span>}
              </Show>
            </p>
        </div>

        <form class="task-form" onSubmit={handleSave}>
          <label>
            Title
            <input class="text-input" value={title()} onInput={(event) => setTitle(event.currentTarget.value)} required/>
          </label>
          <label>
            Description
            <textarea class="text-input" rows={3} value={description()} onInput={(event) => setDescription(event.currentTarget.value)}/>
          </label>
          <div class="edit-actions">
            <button type="button" class="ghost" onClick={handleBack}>
              Cancel
            </button>
            <button class="primary" type="submit" disabled={saving()}>
              {saving() ? "Saving..." : "Save"}
            </button>
          </div>
        </form>

        <div class="task-detail-actions">
          <button type="button" class="ghost" onClick={handleToggleCompleted} disabled={saving()}>
            {completed() ? "Mark as pending" : "Mark as complete"}
          </button>
        </div>
      </Show>
    </section>);
};
export default TaskPage;
