import { createSignal, For, Show, onMount } from "solid-js";
const apiUrl = () => import.meta.env.VITE_API_URL ?? "http://localhost:3000";
const ProjectsPage = ({ jwtToken, onNotify, onNavigate }) => {
    const [projects, setProjects] = createSignal([]);
    const [loading, setLoading] = createSignal(false);
    const [creating, setCreating] = createSignal(false);
    const [editing, setEditing] = createSignal(false);
    const [error, setError] = createSignal(null);
    const [newTitle, setNewTitle] = createSignal("");
    const [newDescription, setNewDescription] = createSignal("");
    const [editingId, setEditingId] = createSignal(null);
    const [editTitle, setEditTitle] = createSignal("");
    const [editDescription, setEditDescription] = createSignal("");
    const editingProject = () => projects().find((project) => project.id === editingId());
    const [pendingDeleteProject, setPendingDeleteProject] = createSignal(null);
    const [deleting, setDeleting] = createSignal(false);
    const [deleteConfirmation, setDeleteConfirmation] = createSignal("");
    const notify = (message, type = "info") => {
        onNotify?.(message, type);
    };
    const getHeaders = () => {
        const headers = {
            "Content-Type": "application/json"
        };
        if (jwtToken) {
            headers.Authorization = `Bearer ${jwtToken}`;
        }
        return headers;
    };
    const handleUnauthorized = () => {
        const message = "Please authenticate before managing projects.";
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
    const fetchProjects = async () => {
        if (!jwtToken) {
            handleUnauthorized();
            return;
        }
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
            const data = (await response.json());
            setProjects(data.projects ?? []);
        }
        catch (fetchError) {
            const message = fetchError.message || "Unable to load projects.";
            setError(message);
            notify(message, "error");
        }
        finally {
            setLoading(false);
        }
    };
    onMount(() => {
        void fetchProjects();
    });
    const handleCreateProject = async (event) => {
        event.preventDefault();
        if (!jwtToken) {
            handleUnauthorized();
            return;
        }
        const title = newTitle().trim();
        if (!title) {
            const message = "Project title cannot be empty.";
            setError(message);
            notify(message, "warning");
            return;
        }
        setCreating(true);
        setError(null);
        try {
            const response = await fetch(`${apiUrl()}/projects`, {
                method: "POST",
                headers: getHeaders(),
                body: JSON.stringify({
                    title,
                    description: newDescription().trim()
                })
            });
            if (!response.ok) {
                await handleFetchError(response);
                return;
            }
            const createdProject = (await response.json());
            setProjects((current) => [createdProject, ...current]);
            setNewTitle("");
            setNewDescription("");
            notify("Project created", "success");
        }
        catch (fetchError) {
            const message = fetchError.message || "Unable to create project.";
            setError(message);
            notify(message, "error");
        }
        finally {
            setCreating(false);
        }
    };
    const updateProject = async (id, body, successMessage) => {
        if (!jwtToken) {
            handleUnauthorized();
            return null;
        }
        setError(null);
        try {
            const response = await fetch(`${apiUrl()}/projects/${id}`, {
                method: "PUT",
                headers: getHeaders(),
                body: JSON.stringify(body)
            });
            if (!response.ok) {
                await handleFetchError(response);
                return null;
            }
            const updatedProject = (await response.json());
            setProjects((current) => current.map((project) => (project.id === updatedProject.id ? updatedProject : project)));
            if (successMessage) {
                notify(successMessage, "success");
            }
            return updatedProject;
        }
        catch (fetchError) {
            const message = fetchError.message || "Unable to update project.";
            setError(message);
            notify(message, "error");
            return null;
        }
    };
    const requestDelete = (project) => {
        setPendingDeleteProject(project);
        setDeleteConfirmation("");
    };
    const confirmDelete = async () => {
        const project = pendingDeleteProject();
        if (!project)
            return;
        if (deleteConfirmation() !== project.title) {
            setError("Please type the project name to confirm.");
            notify("Project name confirmation did not match.", "warning");
            return;
        }
        if (!jwtToken) {
            handleUnauthorized();
            setPendingDeleteProject(null);
            return;
        }
        setDeleting(true);
        setError(null);
        try {
            const response = await fetch(`${apiUrl()}/projects/${project.id}`, {
                method: "DELETE",
                headers: getHeaders()
            });
            if (!response.ok) {
                await handleFetchError(response);
                return;
            }
            setProjects((current) => current.filter((item) => item.id !== project.id));
            notify("Project removed", "success");
        }
        catch (fetchError) {
            const message = fetchError.message || "Unable to remove project.";
            setError(message);
            notify(message, "error");
        }
        finally {
            setDeleting(false);
            setPendingDeleteProject(null);
            setDeleteConfirmation("");
        }
    };
    const cancelDelete = () => {
        setPendingDeleteProject(null);
        setDeleteConfirmation("");
    };
    const startEdit = (project) => {
        setEditingId(project.id);
        setEditTitle(project.title);
        setEditDescription(project.description);
    };
    const handleEditSubmit = async (event) => {
        event.preventDefault();
        const id = editingId();
        if (!id) {
            return;
        }
        const title = editTitle().trim();
        if (!title) {
            const message = "Project title cannot be empty.";
            setError(message);
            notify(message, "warning");
            return;
        }
        setEditing(true);
        try {
            const updatedProject = await updateProject(id, { title, description: editDescription().trim() }, "Project updated");
            if (updatedProject) {
                setEditingId(null);
            }
        }
        finally {
            setEditing(false);
        }
    };
    const cancelEdit = () => {
        setEditingId(null);
    };
    return (<section class="tasks-card">
      <h1>Projects</h1>
      <form class="task-form" onSubmit={handleCreateProject}>
        <label>
          Title
          <input class="text-input" value={newTitle()} onInput={(event) => setNewTitle(event.currentTarget.value)} placeholder="Short summary of the project" required/>
        </label>
        <label>
          Description (optional)
          <textarea class="text-input" value={newDescription()} onInput={(event) => setNewDescription(event.currentTarget.value)} rows={3} placeholder="More details about what needs to be done"/>
        </label>
        <button class="primary" type="submit" disabled={creating()}>
          {creating() ? "Saving..." : "New Project"}
        </button>
      </form>

      <Show when={error()}>
        <p class="helper-text">{error()}</p>
      </Show>

      <Show when={loading()}>
        <p class="helper-text">Loading projects...</p>
      </Show>

      <Show when={!loading() && projects().length === 0}>
        <p class="helper-text">You currently have no projects.</p>
      </Show>

      <Show when={editingId()}>
        <div class="edit-modal-wrapper">
          <section class="edit-panel">
            <h2>Editing project</h2>
            <form onSubmit={handleEditSubmit}>
              <label>
                Title
                <input class="text-input" value={editTitle()} onInput={(event) => setEditTitle(event.currentTarget.value)} required/>
              </label>
              <label>
                Description
                <textarea class="text-input" rows={3} value={editDescription()} onInput={(event) => setEditDescription(event.currentTarget.value)}/>
              </label>
              <div class="edit-actions">
                <button type="button" class="ghost" onClick={cancelEdit}>
                  Cancel
                </button>
                <button class="primary" type="submit" disabled={editing()}>
                  {editing() ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
            <p class="helper-text">
              Editing: <strong>{editingProject()?.title || "..."}</strong>
            </p>
          </section>
      </div>
    </Show>

    <Show when={pendingDeleteProject()}>
      <div class="edit-modal-wrapper">
        <section class="edit-panel">
          <h2>Confirm deletion</h2>
          <p class="helper-text">
            Are you sure you want to delete <strong>{pendingDeleteProject()?.title}</strong>?
          </p>
          <label>
            Type the project name to confirm
            <input class="text-input" value={deleteConfirmation()} onInput={(event) => setDeleteConfirmation(event.currentTarget.value)} placeholder="Project name"/>
          </label>
          <div class="edit-actions">
            <button type="button" class="ghost" onClick={cancelDelete} disabled={deleting()}>
              Cancel
            </button>
            <button class="primary" type="button" onClick={confirmDelete} disabled={deleting() ||
            deleteConfirmation() !== pendingDeleteProject()?.title}>
              {deleting() ? "Deleting..." : "Delete project"}
            </button>
          </div>
        </section>
      </div>
    </Show>

    <div class="tasks-table-wrapper">
      <table class="tasks-table">
          <thead>
            <tr>
              <th>Title &amp; description</th>
              <th>Updated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <For each={projects()}>
              {(project) => (<tr>
                  <td>
                    <strong>{project.title}</strong>
                    <p class="table-description">
                      {project.description || "No description provided."}
                    </p>
                  </td>
                  <td>
                    <span>Updated {new Date(project.updatedAt).toLocaleString()}</span>
                  </td>
                  <td>
                    <div class="task-actions">
                      <button type="button" class="ghost" onClick={() => onNavigate?.(`/projects/${project.id}`)}>
                        View
                      </button>
                      <button type="button" class="ghost" onClick={() => startEdit(project)}>
                        Edit
                      </button>
                      <button type="button" class="ghost" onClick={() => requestDelete(project)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>)}
            </For>
          </tbody>
        </table>
      </div>
    </section>);
};
export default ProjectsPage;
