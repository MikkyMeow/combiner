import { createEffect, createSignal, For, Show, onMount, untrack } from "solid-js";
import type { NotificationType } from "../components/notifications/useNotifications";
import type { Project } from "../types/project";
import {
  TASK_STATUS_OPTIONS,
  getStatusRowClass,
  getStatusPillClass
} from "../types/task";
import type { TaskRecord, TaskStatus } from "../types/task";
import type { AuditLogEntry, AuditChange } from "../types/audit";

const apiUrl = () => import.meta.env.VITE_API_URL ?? "http://localhost:3000";
type TaskViewMode = "list" | "kanban";
type TaskSortField = "title" | "status";
type TaskSortOrder = "asc" | "desc";
const TASK_VIEW_STORAGE_KEY = "projectTasksViewMode";
const TASK_VIEW_OPTIONS: { value: TaskViewMode; label: string }[] = [
  { value: "list", label: "List" },
  { value: "kanban", label: "Kanban" }
];
const AUDIT_FIELD_LABELS: Record<string, string> = {
  title: "Title",
  description: "Description",
  tags: "Tags",
  comments: "Comments",
  status: "Status",
  projectId: "Project",
  assignee: "Assignee",
  priority: "Priority",
  dueDate: "Due date",
  createdAt: "Created",
  updatedAt: "Updated",
  createdBy: "Created by",
  visibility: "Visibility",
  members: "Members",
  taskStatuses: "Statuses",
  owner: "Owner"
};
const AUDIT_ACTION_LABELS: Record<string, string> = {
  create: "Created",
  update: "Updated",
  delete: "Deleted",
  move: "Moved",
  member_add: "Member added",
  status_add: "Status added",
  status_remove: "Status removed"
};

type Note = {
  id: string;
  title: string;
  content: string;
  tags: string[];
  projectId: string | null;
  createdAt: string;
  updatedAt: string;
};

type ProjectPageProps = {
  projectId: string | null;
  jwtToken: string | null;
  onNotify?: (message: string, type?: NotificationType) => void;
  onNavigate?: (path: string) => void;
  onUnauthorized?: () => void;
};

const decodeBase64Url = (value: string): string | null => {
  if (typeof window === "undefined" || typeof window.atob !== "function") {
    return null;
  }
  let base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4 !== 0) {
    base64 += "=";
  }
  try {
    return window.atob(base64);
  } catch {
    return null;
  }
};

const getUsernameFromToken = (token: string | null): string | null => {
  if (!token) {
    return null;
  }
  const parts = token.split(".");
  if (parts.length < 2) {
    return null;
  }
  const payload = decodeBase64Url(parts[1]);
  if (!payload) {
    return null;
  }
  try {
    const parsed = JSON.parse(payload) as { username?: string };
    return typeof parsed.username === "string" ? parsed.username : null;
  } catch {
    return null;
  }
};

const ProjectPage = (props: ProjectPageProps) => {
  const [project, setProject] = createSignal<Project | null>(null);
  const [tasks, setTasks] = createSignal<TaskRecord[]>([]);
  const [notes, setNotes] = createSignal<Note[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [creating, setCreating] = createSignal(false);
  const [taskView, setTaskView] = createSignal<TaskViewMode>("list");
  const [newTitle, setNewTitle] = createSignal("");
  const [noteTitle, setNoteTitle] = createSignal("");
  const [noteContent, setNoteContent] = createSignal("");
  const [noteTags, setNoteTags] = createSignal("");
  const [savingNote, setSavingNote] = createSignal(false);
  const [memberUsername, setMemberUsername] = createSignal("");
  const [invitingMember, setInvitingMember] = createSignal(false);
  const [activeTab, setActiveTab] = createSignal<"tasks" | "notes" | "history">("tasks");
  const [draggingTaskId, setDraggingTaskId] = createSignal<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = createSignal<TaskStatus | null>(null);
  const [recentlyMovedTaskId, setRecentlyMovedTaskId] = createSignal<string | null>(null);
  const [taskSearchTerm, setTaskSearchTerm] = createSignal("");
  const [taskTagSearch, setTaskTagSearch] = createSignal("");
  const [taskStatusFilter, setTaskStatusFilter] = createSignal<TaskStatus | "">("");
  const [taskSortField, setTaskSortField] = createSignal<TaskSortField | null>(null);
  const [taskSortOrder, setTaskSortOrder] = createSignal<TaskSortOrder>("asc");
  const [newStatusName, setNewStatusName] = createSignal("");
  const [savingStatus, setSavingStatus] = createSignal(false);
  const [projectHistory, setProjectHistory] = createSignal<AuditLogEntry[]>([]);
  const [historyLoading, setHistoryLoading] = createSignal(false);
  const [historyError, setHistoryError] = createSignal<string | null>(null);
  const currentUsername = () => getUsernameFromToken(props.jwtToken);

  onMount(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(TASK_VIEW_STORAGE_KEY);
    if (stored === "list" || stored === "kanban") {
      setTaskView(stored);
    }
  });

  createEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(TASK_VIEW_STORAGE_KEY, taskView());
  });

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

  const handleUnauthorized = () => {
    const message = "Please authenticate before viewing project details.";
    setError(message);
    notify(message, "warning");
  };

  const handleFetchError = async (response: Response) => {
    if (response.status === 401) {
      props.onUnauthorized?.();
      return;
    }
    let message = "Unable to reach the server.";
    try {
      const payload = (await response.json()) as { message?: string };
      if (payload?.message) {
        message = payload.message;
      } else {
        message = `${response.statusText} (${response.status})`;
      }
    } catch {
      message = `${response.statusText} (${response.status})`;
    }
    setError(message);
    notify(message, "error");
  };

  const handleHistoryError = async (response: Response) => {
    if (response.status === 401) {
      props.onUnauthorized?.();
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
    setHistoryError(message);
  };

  const formatAuditValue = (value: unknown) => {
    if (value === null || value === undefined) {
      return "none";
    }
    if (Array.isArray(value)) {
      return value.length > 0 ? value.join(", ") : "none";
    }
    if (typeof value === "string") {
      return value.trim().length > 0 ? value : "none";
    }
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  };

  const formatAuditField = (field: string) => AUDIT_FIELD_LABELS[field] ?? field;

  const formatAuditAction = (action: string) =>
    AUDIT_ACTION_LABELS[action] ?? action;

  const formatAuditEntity = (entry: AuditLogEntry) =>
    entry.entity === "task" ? "Task" : "Project";

  const getAuditChanges = (changes: Record<string, AuditChange>) =>
    Object.entries(changes ?? {});

  const loadProjectHistory = async (projectId: string) => {
    if (!props.jwtToken) {
      setProjectHistory([]);
      setHistoryError(null);
      return;
    }

    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const response = await fetch(`${apiUrl()}/projects/${encodeURIComponent(projectId)}/history`, {
        headers: getHeaders()
      });

      if (!response.ok) {
        await handleHistoryError(response);
        return;
      }

      const payload = (await response.json()) as { history?: AuditLogEntry[] };
      setProjectHistory(payload.history ?? []);
    } catch (fetchError) {
      const message = (fetchError as Error).message || "Unable to load project history.";
      setHistoryError(message);
    } finally {
      setHistoryLoading(false);
    }
  };

  const parseTags = (input: string) =>
    input
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);

  const getTasksByStatus = (status: TaskStatus) =>
    tasks().filter((task) => task.status === status);

  const projectStatuses = () => project()?.taskStatuses ?? TASK_STATUS_OPTIONS;

  const visibleStatuses = () =>
    taskStatusFilter() ? [taskStatusFilter() as TaskStatus] : projectStatuses();

  const canManageStatuses = () => {
    const owner = project()?.owner;
    const username = currentUsername();
    return !!owner && !!username && owner === username;
  };

  const matchesTaskFilters = (task: TaskRecord) => {
    const trimmedSearch = taskSearchTerm().trim().toLowerCase();
    if (trimmedSearch) {
      const title = task.title.toLowerCase();
      const description = task.description.toLowerCase();
      if (!title.includes(trimmedSearch) && !description.includes(trimmedSearch)) {
        return false;
      }
    }
    const tagSearch = parseTags(taskTagSearch()).map((tag) => tag.toLowerCase());
    if (tagSearch.length > 0) {
      const taskTags = task.tags?.map((tag) => tag.toLowerCase()) ?? [];
      const hasMatch = tagSearch.some((needle) =>
        taskTags.some((tag) => tag.includes(needle))
      );
      if (!hasMatch) {
        return false;
      }
    }
    const status = taskStatusFilter();
    if (status && task.status !== status) {
      return false;
    }
    return true;
  };

  const fetchProject = async (
    projectId: string,
    options?: {
      taskSearch?: string;
      taskTags?: string[];
      taskStatus?: TaskStatus | "";
      taskSortField?: TaskSortField | null;
      taskSortOrder?: TaskSortOrder;
      preserveData?: boolean;
      showLoading?: boolean;
    }
  ) => {
    if (!props.jwtToken) {
      handleUnauthorized();
      return;
    }

    const showLoading = options?.showLoading ?? true;
    if (showLoading) {
      setLoading(true);
    }
    setError(null);
    if (!options?.preserveData) {
      setProject(null);
      setTasks([]);
      setNotes([]);
    }

    try {
      const url = new URL(`${apiUrl()}/projects/${encodeURIComponent(projectId)}`);
      const trimmedSearch = options?.taskSearch?.trim();
      if (trimmedSearch) {
        url.searchParams.set("task_search", trimmedSearch);
      }
      if (options?.taskTags && options.taskTags.length > 0) {
        url.searchParams.set("task_tags", options.taskTags.join(","));
      }
      if (options?.taskStatus) {
        url.searchParams.set("task_status", options.taskStatus);
      }
      if (options?.taskSortField) {
        url.searchParams.set("task_sort_by", options.taskSortField);
        url.searchParams.set("task_order", options?.taskSortOrder ?? "asc");
      }

      const response = await fetch(url.toString(), { headers: getHeaders() });

      if (!response.ok) {
        await handleFetchError(response);
        return;
      }

      const data = (await response.json()) as { project: Project; tasks: TaskRecord[]; notes?: Note[] };
      setProject(data.project);
      setTasks(data.tasks ?? []);
      setNotes(data.notes ?? []);
    } catch (fetchError) {
      const message = (fetchError as Error).message || "Unable to load project data.";
      setError(message);
      notify(message, "error");
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  let taskSearchDebounce: ReturnType<typeof setTimeout> | undefined;

  const scheduleTaskFetch = (
    searchValue: string,
    tagValue: string,
    statusValue: TaskStatus | "",
    field: TaskSortField | null,
    order: TaskSortOrder
  ) => {
    if (taskSearchDebounce) {
      clearTimeout(taskSearchDebounce);
    }
    taskSearchDebounce = setTimeout(() => {
      const projectId = props.projectId?.trim();
      if (!projectId) return;
      void fetchProject(projectId, {
        taskSearch: searchValue,
        taskTags: parseTags(tagValue),
        taskStatus: statusValue,
        taskSortField: field,
        taskSortOrder: order,
        preserveData: true,
        showLoading: false
      });
      taskSearchDebounce = undefined;
    }, 300);
  };

  const handleTaskSearchInput = (event: InputEvent) => {
    const value = event.currentTarget.value;
    setTaskSearchTerm(value);
    scheduleTaskFetch(value, taskTagSearch(), taskStatusFilter(), taskSortField(), taskSortOrder());
  };

  const handleTaskTagSearchInput = (event: InputEvent) => {
    const value = event.currentTarget.value;
    setTaskTagSearch(value);
    scheduleTaskFetch(taskSearchTerm(), value, taskStatusFilter(), taskSortField(), taskSortOrder());
  };

  const handleClearTaskSearch = () => {
    if (!taskSearchTerm()) {
      return;
    }
    if (taskSearchDebounce) {
      clearTimeout(taskSearchDebounce);
      taskSearchDebounce = undefined;
    }
    setTaskSearchTerm("");
    const projectId = props.projectId?.trim();
    if (!projectId) return;
    void fetchProject(projectId, {
      taskSearch: "",
      taskTags: parseTags(taskTagSearch()),
      taskStatus: taskStatusFilter(),
      taskSortField: taskSortField(),
      taskSortOrder: taskSortOrder(),
      preserveData: true,
      showLoading: false
    });
  };

  const handleClearTaskTagSearch = () => {
    if (!taskTagSearch()) {
      return;
    }
    if (taskSearchDebounce) {
      clearTimeout(taskSearchDebounce);
      taskSearchDebounce = undefined;
    }
    setTaskTagSearch("");
    const projectId = props.projectId?.trim();
    if (!projectId) return;
    void fetchProject(projectId, {
      taskSearch: taskSearchTerm(),
      taskTags: [],
      taskStatus: taskStatusFilter(),
      taskSortField: taskSortField(),
      taskSortOrder: taskSortOrder(),
      preserveData: true,
      showLoading: false
    });
  };

  const handleTaskStatusFilterChange = (event: InputEvent) => {
    const value = event.currentTarget.value as TaskStatus | "";
    setTaskStatusFilter(value);
    scheduleTaskFetch(taskSearchTerm(), taskTagSearch(), value, taskSortField(), taskSortOrder());
  };

  const handleTaskSortFieldChange = (event: InputEvent) => {
    const value = event.currentTarget.value;
    const field = value ? (value as TaskSortField) : null;
    setTaskSortField(field);
    scheduleTaskFetch(taskSearchTerm(), taskTagSearch(), taskStatusFilter(), field, taskSortOrder());
  };

  const handleTaskSortOrderChange = (event: InputEvent) => {
    const value = event.currentTarget.value as TaskSortOrder;
    setTaskSortOrder(value);
    scheduleTaskFetch(taskSearchTerm(), taskTagSearch(), taskStatusFilter(), taskSortField(), value);
  };

  createEffect(() => {
    const projectId = props.projectId?.trim();
    if (!projectId) {
      setProject(null);
      setTasks([]);
      setNotes([]);
      setLoading(false);
      const message = "Project identifier is missing.";
      setError(message);
      return;
    }

    const options = untrack(() => ({
      taskSearch: taskSearchTerm(),
      taskTags: parseTags(taskTagSearch()),
      taskStatus: taskStatusFilter(),
      taskSortField: taskSortField(),
      taskSortOrder: taskSortOrder()
    }));
    void fetchProject(projectId, options);
  });

  createEffect(() => {
    const projectId = project()?.id ?? props.projectId?.trim();
    if (!projectId) {
      setProjectHistory([]);
      setHistoryError(null);
      return;
    }
    if (activeTab() !== "history") {
      return;
    }
    void loadProjectHistory(projectId);
  });

  const handleBack = () => {
    props.onNavigate?.("/projects");
  };

  const updateTask = async (
    id: string,
    body: Partial<{ title: string; description: string; status: TaskStatus }>,
    successMessage?: string
  ) => {
    if (!props.jwtToken) {
      handleUnauthorized();
      return null;
    }

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

      const updated = (await response.json()) as TaskRecord;
      setTasks((current) => {
        const exists = current.some((task) => task.id === updated.id);
        if (!matchesTaskFilters(updated)) {
          return current.filter((task) => task.id !== updated.id);
        }
        if (!exists) {
          return [updated, ...current];
        }
        return current.map((task) => (task.id === updated.id ? updated : task));
      });

      if (successMessage) {
        notify(successMessage, "success");
      }

      return updated;
    } catch (fetchError) {
      const message = (fetchError as Error).message || "Unable to update task.";
      setError(message);
      notify(message, "error");
      return null;
    }
  };

  const handleCreateTask = async (event: SubmitEvent) => {
    event.preventDefault();
    if (!props.jwtToken) {
      handleUnauthorized();
      return;
    }

    const title = newTitle().trim();
    if (!title) {
      const message = "Task title cannot be empty.";
      setError(message);
      notify(message, "warning");
      return;
    }

    const currentProject = project();
    if (!currentProject) {
      const message = "Project information is missing.";
      setError(message);
      notify(message, "warning");
      return;
    }

    setCreating(true);
    setError(null);
    try {
      const response = await fetch(`${apiUrl()}/tasks`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          title,
          projectId: currentProject.id
        })
      });

      if (!response.ok) {
        await handleFetchError(response);
        return;
      }

      const created = (await response.json()) as TaskRecord;
      if (matchesTaskFilters(created)) {
        setTasks((current) => [created, ...current]);
      }
      setNewTitle("");
      notify("Task created", "success");
    } catch (fetchError) {
      const message = (fetchError as Error).message || "Unable to create task.";
      setError(message);
      notify(message, "error");
    } finally {
      setCreating(false);
    }
  };

  const handleInviteMember = async (event: SubmitEvent) => {
    event.preventDefault();
    if (!props.jwtToken) {
      handleUnauthorized();
      return;
    }

    const usernameToInvite = memberUsername().trim();
    if (!usernameToInvite) {
      const message = "Username is required to invite someone.";
      setError(message);
      notify(message, "warning");
      return;
    }

    const projectId = project()?.id ?? props.projectId?.trim();
    if (!projectId) {
      const message = "Project identifier is missing.";
      setError(message);
      notify(message, "warning");
      return;
    }

    setInvitingMember(true);
    setError(null);
    try {
      const response = await fetch(`${apiUrl()}/projects/${encodeURIComponent(projectId)}/members`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ username: usernameToInvite })
      });
      if (!response.ok) {
        await handleFetchError(response);
        return;
      }

      const data = (await response.json()) as { project: Project };
      setProject(data.project);
      setMemberUsername("");
      notify("Collaborator invited", "success");
    } catch (fetchError) {
      const message = (fetchError as Error).message || "Unable to invite collaborator.";
      setError(message);
      notify(message, "error");
    } finally {
      setInvitingMember(false);
    }
  };

  const handleCreateNote = async (event: SubmitEvent) => {
    event.preventDefault();
    if (!props.jwtToken) {
      handleUnauthorized();
      return;
    }

    const title = noteTitle().trim();
    if (!title) {
      const message = "Note title is required.";
      setError(message);
      notify(message, "warning");
      return;
    }

    const currentProject = project();
    if (!currentProject) {
      const message = "Project data is not available.";
      setError(message);
      notify(message, "warning");
      return;
    }

    setSavingNote(true);
    setError(null);
    try {
      const response = await fetch(`${apiUrl()}/notes`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          title,
          content: noteContent().trim(),
          tags: parseTags(noteTags()),
          projectId: currentProject.id
        })
      });

      if (!response.ok) {
        await handleFetchError(response);
        return;
      }

      const created = (await response.json()) as Note;
      setNotes((current) => [created, ...current]);
      setNoteTitle("");
      setNoteContent("");
      setNoteTags("");
      notify("Note saved to project", "success");
    } catch (fetchError) {
      const message = (fetchError as Error).message || "Unable to save note.";
      setError(message);
      notify(message, "error");
    } finally {
      setSavingNote(false);
    }
  };

  const refreshProject = () => {
    const projectId = project()?.id ?? props.projectId?.trim();
    if (!projectId) return;
    void fetchProject(projectId, {
      taskSearch: taskSearchTerm(),
      taskTags: parseTags(taskTagSearch()),
      taskStatus: taskStatusFilter(),
      taskSortField: taskSortField(),
      taskSortOrder: taskSortOrder(),
      preserveData: true,
      showLoading: false
    });
  };

  createEffect(() => {
    const filter = taskStatusFilter();
    if (filter && !projectStatuses().includes(filter)) {
      setTaskStatusFilter("");
      refreshProject();
    }
  });

  const handleAddStatus = async (event: SubmitEvent) => {
    event.preventDefault();
    if (!props.jwtToken) {
      handleUnauthorized();
      return;
    }
    const projectId = project()?.id ?? props.projectId?.trim();
    if (!projectId) {
      notify("Project identifier is missing.", "warning");
      return;
    }
    const name = newStatusName().trim();
    if (!name) {
      notify("Status name cannot be empty.", "warning");
      return;
    }
    setSavingStatus(true);
    try {
      const response = await fetch(`${apiUrl()}/projects/${encodeURIComponent(projectId)}/statuses`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ status: name })
      });
      if (!response.ok) {
        await handleFetchError(response);
        return;
      }
      const payload = (await response.json()) as { project: Project };
      setProject(payload.project);
      setNewStatusName("");
      notify("Status added", "success");
    } catch (fetchError) {
      const message = (fetchError as Error).message || "Unable to add status.";
      setError(message);
      notify(message, "error");
    } finally {
      setSavingStatus(false);
    }
  };

  const handleRemoveStatus = async (status: string) => {
    if (!props.jwtToken) {
      handleUnauthorized();
      return;
    }
    const projectId = project()?.id ?? props.projectId?.trim();
    if (!projectId) {
      notify("Project identifier is missing.", "warning");
      return;
    }
    setSavingStatus(true);
    try {
      const response = await fetch(`${apiUrl()}/projects/${encodeURIComponent(projectId)}/statuses`, {
        method: "DELETE",
        headers: getHeaders(),
        body: JSON.stringify({ status })
      });
      if (!response.ok) {
        await handleFetchError(response);
        return;
      }
      const payload = (await response.json()) as { project: Project };
      setProject(payload.project);
      notify("Status removed", "success");
      refreshProject();
    } catch (fetchError) {
      const message = (fetchError as Error).message || "Unable to remove status.";
      setError(message);
      notify(message, "error");
    } finally {
      setSavingStatus(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!props.jwtToken) {
      handleUnauthorized();
      return;
    }

    try {
      const response = await fetch(`${apiUrl()}/tasks/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: getHeaders()
      });

      if (!response.ok) {
        await handleFetchError(response);
        return;
      }

      setTasks((current) => current.filter((task) => task.id !== id));
      notify("Task removed", "success");
    } catch (fetchError) {
      const message = (fetchError as Error).message || "Unable to remove task.";
      setError(message);
      notify(message, "error");
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!props.jwtToken) {
      handleUnauthorized();
      return;
    }

    try {
      const response = await fetch(`${apiUrl()}/notes/${encodeURIComponent(noteId)}`, {
        method: "DELETE",
        headers: getHeaders()
      });
      if (!response.ok) {
        await handleFetchError(response);
        return;
      }
      setNotes((current) => current.filter((note) => note.id !== noteId));
      notify("Note removed from project", "info");
    } catch (fetchError) {
      const message = (fetchError as Error).message || "Unable to remove note.";
      setError(message);
      notify(message, "error");
    }
  };

  const handleChangeStatus = (task: TaskRecord, nextStatus: TaskStatus) => {
    if (task.status === nextStatus) return;
    void updateTask(task.id, { status: nextStatus }, "Task status saved");
  };

  const viewTaskDetail = (task: TaskRecord) => {
    props.onNavigate?.(`/tasks/${encodeURIComponent(task.id)}`);
  };

  const handleDragStart = (task: TaskRecord, event: DragEvent) => {
    setDraggingTaskId(task.id);
    setDragOverStatus(task.status);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", task.id);
      event.dataTransfer.setData("application/x-kanban-task", task.id);
    }
  };

  const handleDragEnd = () => {
    setDraggingTaskId(null);
    setDragOverStatus(null);
  };

  const handleDragOver = (status: TaskStatus, event: DragEvent) => {
    event.preventDefault();
    setDragOverStatus(status);
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }
  };

  const handleDragLeave = (status: TaskStatus, event: DragEvent) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    if (dragOverStatus() === status) {
      setDragOverStatus(null);
    }
  };

  const handleDrop = async (status: TaskStatus, event: DragEvent) => {
    event.preventDefault();
    const draggedId =
      draggingTaskId() ||
      event.dataTransfer?.getData("application/x-kanban-task") ||
      event.dataTransfer?.getData("text/plain") ||
      null;
    if (!draggedId) return;

    setDragOverStatus(null);
    setDraggingTaskId(null);

    const previousTasks = tasks();
    const draggedTask = previousTasks.find((task) => task.id === draggedId);
    if (!draggedTask || draggedTask.status === status) return;

    const nextTasks = tasks().map((task) =>
      task.id === draggedId ? { ...task, status } : task
    );
    setTasks(() =>
      matchesTaskFilters({ ...draggedTask, status })
        ? nextTasks
        : nextTasks.filter((task) => task.id !== draggedId)
    );
    setRecentlyMovedTaskId(draggedId);
    window.setTimeout(() => {
      if (recentlyMovedTaskId() === draggedId) {
        setRecentlyMovedTaskId(null);
      }
    }, 450);

    const updated = await updateTask(draggedId, { status }, "Task moved");
    if (!updated) {
      setTasks(previousTasks);
    }
  };

  return (
    <section class="project-detail-layout">
      <div class="project-header">
        <div class="project-header__info">
          {props.onNavigate && (
            <button type="button" class="ghost" onClick={handleBack}>
              Back to projects
            </button>
          )}
          <h1>{project()?.title ?? "Project details"}</h1>
          <p class="project-description">
            {project()?.description || "No description provided."}
          </p>
          <Show when={project()}>
            <p class="helper-text">
              Scope: {project()?.visibility === "corporate" ? "Corporate" : "Private"}
            </p>
          </Show>
        </div>

        <Show when={project()}>
          <aside class="project-header__members">
            <p class="helper-text">
              Owner: <strong>{project()?.owner}</strong>
            </p>
            <p class="helper-text">
              Members:
              <Show
                when={(project()?.members.length ?? 0) > 0}
                fallback={<span class="member-empty">No collaborators yet.</span>}
              >
                <For each={project()?.members ?? []}>
                  {(member) => <span class="member-chip">{member}</span>}
                </For>
              </Show>
            </p>
            <form class="member-form" onSubmit={handleInviteMember}>
              <label>
                Invite collaborator
                <input
                  class="text-input"
                  value={memberUsername()}
                  onInput={(event) => setMemberUsername(event.currentTarget.value)}
                  placeholder="Username"
                  required
                />
              </label>
              <button class="primary" type="submit" disabled={invitingMember()}>
                {invitingMember() ? "Inviting..." : "Add person"}
              </button>
            </form>
          </aside>
        </Show>
      </div>

      <Show when={error()}>
        <p class="helper-text">{error()}</p>
      </Show>

      <div class="project-tabs" role="tablist">
        <button
          classList={{ "project-tab": true, "project-tab--active": activeTab() === "tasks" }}
          type="button"
          role="tab"
          aria-selected={activeTab() === "tasks"}
          onClick={() => setActiveTab("tasks")}
        >
          Tasks
        </button>
        <button
          classList={{ "project-tab": true, "project-tab--active": activeTab() === "notes" }}
          type="button"
          role="tab"
          aria-selected={activeTab() === "notes"}
          onClick={() => setActiveTab("notes")}
        >
          Notes
        </button>
        <button
          classList={{ "project-tab": true, "project-tab--active": activeTab() === "history" }}
          type="button"
          role="tab"
          aria-selected={activeTab() === "history"}
          onClick={() => setActiveTab("history")}
        >
          History
        </button>
      </div>

      <Show when={loading()}>
        <p class="helper-text">Loading project...</p>
      </Show>

      <Show when={!loading() && project() && activeTab() === "tasks"}>
        <section class="tasks-panel">
          <form class="task-form" onSubmit={handleCreateTask}>
            <label>
              Title
              <input
                class="text-input"
                value={newTitle()}
                onInput={(event) => setNewTitle(event.currentTarget.value)}
                placeholder="Task title"
                required
              />
            </label>
            <button class="primary" type="submit" disabled={creating()}>
              {creating() ? "Saving..." : "Add task"}
            </button>
          </form>

          <form class="projects-search" onSubmit={(event) => event.preventDefault()}>
            <div class="projects-search__controls">
              <input
                type="search"
                class="text-input"
                value={taskSearchTerm()}
                onInput={handleTaskSearchInput}
                placeholder="Search by title or description"
                aria-label="Search tasks"
              />
              <input
                type="search"
                class="text-input"
                value={taskTagSearch()}
                onInput={handleTaskTagSearchInput}
                placeholder="Search by tags"
                aria-label="Search tasks by tags"
              />
              <Show when={taskSearchTerm()}>
                <button type="button" class="ghost" onClick={handleClearTaskSearch}>
                  Clear
                </button>
              </Show>
              <Show when={taskTagSearch()}>
                <button type="button" class="ghost" onClick={handleClearTaskTagSearch}>
                  Clear tags
                </button>
              </Show>
            </div>
            <div class="projects-search__filters" role="group" aria-label="Task filters">
              <label class="projects-search__filter projects-search__filter--select">
                <span>Status</span>
                <select value={taskStatusFilter()} onInput={handleTaskStatusFilterChange}>
                  <option value="">All statuses</option>
                  <For each={projectStatuses()}>
                    {(status) => <option value={status}>{status}</option>}
                  </For>
                </select>
              </label>
              <label class="projects-search__filter projects-search__filter--select">
                <span>Sort by</span>
                <select value={taskSortField() ?? ""} onInput={handleTaskSortFieldChange}>
                  <option value="">Default (created at)</option>
                  <option value="title">Name</option>
                  <option value="status">Status</option>
                </select>
              </label>
              <label class="projects-search__filter projects-search__filter--select">
                <span>Order</span>
                <select value={taskSortOrder()} onInput={handleTaskSortOrderChange} disabled={!taskSortField()}>
                  <option value="asc">Ascending</option>
                  <option value="desc">Descending</option>
                </select>
              </label>
            </div>
          </form>

          <div class="task-view-controls">
            <span class="helper-text">Display</span>
            <div class="task-view-toggle">
              <For each={TASK_VIEW_OPTIONS}>
                {(option) => (
                  <button
                    type="button"
                    class={`ghost task-view-toggle__button ${
                      taskView() === option.value ? "task-view-toggle__button--active" : ""
                    }`}
                    onClick={() => setTaskView(option.value)}
                  >
                    {option.label}
                  </button>
                )}
              </For>
            </div>
          </div>

          <p class="helper-text">
            {tasks().length} task{tasks().length === 1 ? "" : "s"} attached to this project.
          </p>

          <Show when={project() && canManageStatuses()}>
            <section class="status-manager">
              <div class="status-manager__header">
                <h3>Statuses</h3>
                <p class="helper-text">Default statuses cannot be removed.</p>
              </div>
              <form class="status-manager__form" onSubmit={handleAddStatus}>
                <input
                  class="text-input"
                  value={newStatusName()}
                  onInput={(event) => setNewStatusName(event.currentTarget.value)}
                  placeholder="New status name"
                  aria-label="New status name"
                />
                <button class="primary" type="submit" disabled={savingStatus()}>
                  {savingStatus() ? "Saving..." : "Add status"}
                </button>
              </form>
              <div class="status-manager__list">
                <For each={projectStatuses()}>
                  {(status) => (
                    <div class="status-manager__item">
                      <span class={`status-pill ${getStatusPillClass(status)}`}>
                        {status}
                      </span>
                      <Show when={!TASK_STATUS_OPTIONS.includes(status as (typeof TASK_STATUS_OPTIONS)[number])}>
                        <button
                          type="button"
                          class="ghost"
                          onClick={() => handleRemoveStatus(status)}
                          disabled={savingStatus()}
                        >
                          Remove
                        </button>
                      </Show>
                    </div>
                  )}
                </For>
              </div>
            </section>
          </Show>

          <Show when={tasks().length === 0}>
            <p class="helper-text">No tasks are linked to this project yet.</p>
          </Show>

          <Show when={tasks().length > 0}>
            <Show when={taskView() === "list"}>
              <div class="tasks-table-wrapper">
                <table class="tasks-table">
                  <thead>
                    <tr>
                      <th>Title &amp; description</th>
                      <th>Status</th>
                      <th>Updated</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={visibleStatuses()}>
                      {(status) => {
                        const statusTasks = () => getTasksByStatus(status);
                        return (
                          <>
                            <tr class="status-group-row">
                              <td colSpan={4}>
                                <div class="status-group-header">
                                  <span class={`status-pill ${getStatusPillClass(status)}`}>
                                    {status}
                                  </span>
                                  <span class="helper-text">
                                    {statusTasks().length} task
                                    {statusTasks().length === 1 ? "" : "s"}
                                  </span>
                                </div>
                              </td>
                            </tr>
                            <Show when={statusTasks().length === 0}>
                              <tr class="status-group-empty">
                                <td colSpan={4}>
                                  <span class="helper-text">No tasks in this status.</span>
                                </td>
                              </tr>
                            </Show>
                            <For each={statusTasks()}>
                              {(task) => (
                                <tr class={`status-row ${getStatusRowClass(task.status)}`}>
                                  <td>
                                    <strong>{task.title}</strong>
                                    <p class="table-description">
                                      {task.description || "No description provided."}
                                    </p>
                                    <Show when={(task.tags ?? []).length > 0}>
                                      <div class="task-tags">
                                        <For each={task.tags}>{(tag) => <span class="task-tag">{tag}</span>}</For>
                                      </div>
                                    </Show>
                                  </td>
                                  <td>
                                    <div class="status-cell">
                                      <span class={`status-pill ${getStatusPillClass(task.status)}`}>
                                        {task.status}
                                      </span>
                                      <select
                                        class="status-select"
                                        value={task.status}
                                        onInput={(event) =>
                                          handleChangeStatus(
                                            task,
                                            event.currentTarget.value as TaskStatus
                                          )
                                        }
                                      >
                                        <For each={projectStatuses()}>
                                          {(option) => <option value={option}>{option}</option>}
                                        </For>
                                      </select>
                                    </div>
                                  </td>
                                  <td>
                                    <span>Updated {new Date(task.updatedAt).toLocaleString()}</span>
                                  </td>
                                  <td>
                                    <div class="task-actions">
                                      <button
                                        type="button"
                                        class="ghost"
                                        onClick={() => viewTaskDetail(task)}
                                      >
                                        View
                                      </button>
                                      <button
                                        type="button"
                                        class="ghost"
                                        onClick={() => handleDelete(task.id)}
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </For>
                          </>
                        );
                      }}
                    </For>
                  </tbody>
                </table>
              </div>
            </Show>
            <Show when={taskView() === "kanban"}>
              <div class="kanban-board">
                <For each={visibleStatuses()}>
                  {(status) => {
                    const columnTasks = () => getTasksByStatus(status);
                    return (
                      <section
                        classList={{
                          "kanban-column": true,
                          "kanban-column--drag-over": dragOverStatus() === status
                        }}
                        onDragOver={(event) => handleDragOver(status, event)}
                        onDragLeave={(event) => handleDragLeave(status, event)}
                        onDrop={(event) => void handleDrop(status, event)}
                      >
                        <div class="kanban-column__header">
                          <strong>{status}</strong>
                          <span class="helper-text">
                            {columnTasks().length} task{columnTasks().length === 1 ? "" : "s"}
                          </span>
                        </div>
                        <div
                          classList={{
                            "kanban-column__list": true,
                            "kanban-column__list--drag-over": dragOverStatus() === status
                          }}
                        >
                          <For each={columnTasks()}>
                            {(task) => (
                              <article
                                classList={{
                                  "kanban-card": true,
                                  "kanban-card--dragging": draggingTaskId() === task.id,
                                  "kanban-card--moved": recentlyMovedTaskId() === task.id
                                }}
                                draggable={true}
                                onDragStart={(event) => handleDragStart(task, event)}
                                onDragEnd={handleDragEnd}
                              >
                                <strong>{task.title}</strong>
                                <p class="table-description">
                                  {task.description || "No description provided."}
                                </p>
                                <Show when={(task.tags ?? []).length > 0}>
                                  <div class="task-tags">
                                    <For each={task.tags}>{(tag) => <span class="task-tag">{tag}</span>}</For>
                                  </div>
                                </Show>
                                <p class="helper-text">
                                  Updated {new Date(task.updatedAt).toLocaleString()}
                                </p>
                                <div class="task-actions kanban-card-actions">
                                  <button
                                    type="button"
                                    class="ghost"
                                    onClick={() => viewTaskDetail(task)}
                                  >
                                    View
                                  </button>
                                  <button
                                    type="button"
                                    class="ghost"
                                    onClick={() => handleDelete(task.id)}
                                  >
                                    Delete
                                  </button>
                                </div>
                              </article>
                            )}
                          </For>
                          <Show when={columnTasks().length === 0}>
                            <p class="helper-text kanban-empty">No tasks yet.</p>
                          </Show>
                        </div>
                      </section>
                    );
                  }}
                </For>
              </div>
            </Show>
          </Show>
        </section>
      </Show>

      <Show when={!loading() && project() && activeTab() === "notes"}>
        <article class="knowledge-panel project-notes-card">
          <h2>Project notes</h2>
          <p class="helper-text">
            Capture quick guidance, insights, or reminders that live alongside this project.
          </p>

          <form class="knowledge-form" onSubmit={handleCreateNote}>
            <label>
              Title
              <input
                class="text-input"
                value={noteTitle()}
                onInput={(event) => setNoteTitle(event.currentTarget.value)}
                placeholder="Note title"
                required
              />
            </label>
            <label>
              Content
              <textarea
                class="text-input knowledge-textarea"
                value={noteContent()}
                onInput={(event) => setNoteContent(event.currentTarget.value)}
                placeholder="Details or context for this note"
              />
            </label>
            <label>
              Tags (comma separated)
              <input
                class="text-input"
                value={noteTags()}
                onInput={(event) => setNoteTags(event.currentTarget.value)}
              />
            </label>
            <button class="primary" type="submit" disabled={savingNote()}>
              {savingNote() ? "Saving..." : "Save note"}
            </button>
          </form>

          <Show when={notes().length === 0}>
            <p class="helper-text">No notes attached to this project yet.</p>
          </Show>

          <Show when={notes().length > 0}>
            <div class="knowledge-list">
              <For each={notes()}>
                {(note) => (
                  <article class="knowledge-item">
                    <div class="knowledge-item-header">
                      <strong>{note.title}</strong>
                      <span class="status-pill">
                        Updated {new Date(note.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p>{note.content || "No content yet."}</p>
                    <Show when={note.tags.length > 0}>
                      <div class="knowledge-item-tags">
                        <For each={note.tags}>{(tag) => <span class="knowledge-tag">{tag}</span>}</For>
                      </div>
                    </Show>
                    <div class="knowledge-actions">
                      <button class="ghost" type="button" onClick={() => handleDeleteNote(note.id)}>
                        Delete
                      </button>
                    </div>
                  </article>
                )}
              </For>
            </div>
          </Show>
        </article>
      </Show>

      <Show when={!loading() && project() && activeTab() === "history"}>
        <section class="tasks-panel audit-panel">
          <div class="audit-header">
            <h2>Project history</h2>
            <button
              type="button"
              class="ghost"
              onClick={() => {
                const projectId = project()?.id ?? props.projectId?.trim();
                if (projectId) {
                  void loadProjectHistory(projectId);
                }
              }}
            >
              Refresh
            </button>
          </div>
          <Show when={historyLoading()}>
            <p class="helper-text">Loading history...</p>
          </Show>
          <Show when={historyError()}>
            <p class="helper-text">{historyError()}</p>
          </Show>
          <Show when={!historyLoading() && projectHistory().length === 0}>
            <p class="helper-text">No history entries yet.</p>
          </Show>
          <Show when={projectHistory().length > 0}>
            <div class="audit-list">
              <For each={projectHistory()}>
                {(entry) => (
                  <article class="audit-item">
                    <div class="audit-meta">
                      <span class="status-pill">{formatAuditAction(entry.action)}</span>
                      <span class="audit-entity" title={entry.entityId}>
                        {formatAuditEntity(entry)} {entry.entityId.slice(0, 8)}
                      </span>
                      <span class="audit-meta__info">
                        {entry.actor} on {new Date(entry.at).toLocaleString()}
                      </span>
                    </div>
                    <Show when={getAuditChanges(entry.changes).length > 0}>
                      <div class="audit-changes">
                        <For each={getAuditChanges(entry.changes)}>
                          {([field, change]) => (
                            <div class="audit-change">
                              <span class="audit-field">{formatAuditField(field)}</span>
                              <span class="audit-value">{formatAuditValue(change.from)}</span>
                              <span class="audit-arrow">-&gt;</span>
                              <span class="audit-value">{formatAuditValue(change.to)}</span>
                            </div>
                          )}
                        </For>
                      </div>
                    </Show>
                  </article>
                )}
              </For>
            </div>
          </Show>
        </section>
      </Show>
    </section>
  );
};

export default ProjectPage;
