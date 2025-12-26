import { createSignal, createEffect, createMemo, onCleanup, onMount, Show } from "solid-js";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ProfilePage from "./pages/ProfilePage";
import ProjectsPage from "./pages/ProjectsPage";
import ProjectPage from "./pages/ProjectPage";
import TaskPage from "./pages/TaskPage";
import TeamsPage from "./pages/TeamsPage";
import type { UserRole } from "./types/user";
import { getRoutes } from "./routes";
import NotificationStack from "./components/notifications/NotificationStack";
import { useNotifications } from "./components/notifications/useNotifications";

const themeKey = "combiner-theme";
const getStoredTheme = (): "dark" | "light" => {
  if (typeof window === "undefined") {
    return "dark";
  }
  const stored = localStorage.getItem(themeKey);
  if (stored === "light" || stored === "dark") {
    return stored;
  }
  if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
};

const initialToken =
  typeof window !== "undefined" ? localStorage.getItem("jwtToken") : null;

const decodeBase64Url = (value: string): string | null => {
  if (typeof window === "undefined" || typeof window.atob !== "function") {
    return null;
  }
  let base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4 !== 0) {
    base64 += "=";
  }
  try {
    const binary = window.atob(base64);
    try {
      return decodeURIComponent(
        binary
          .split("")
          .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`)
          .join("")
      );
    } catch {
      return binary;
    }
  } catch {
    return null;
  }
};

const getRoleFromToken = (token: string | null): UserRole | null => {
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
    const parsed = JSON.parse(payload) as { role?: UserRole };
    const { role } = parsed;
    if (role === "owner" || role === "employee" || role === "user" || role === "guest") {
      return role;
    }
  } catch {
    /* ignore */
  }
  return null;
};

const App = () => {
  const [page, setPage] = createSignal(window.location.pathname || "/");
  const [jwtToken, setJwtToken] = createSignal<string | null>(initialToken ?? null);
  const [theme, setTheme] = createSignal<"dark" | "light">(getStoredTheme());
  const [isNavOpen, setNavOpen] = createSignal(false);
  const closeMobileNav = () => setNavOpen(false);
  const toggleMobileNav = () => setNavOpen((value) => !value);
  const { notifications, enqueueNotification, dismissNotification } = useNotifications();

  const scrollKey = (path: string) => `scroll-position:${path}`;

  const canPersistScroll = () => typeof window !== "undefined" && "sessionStorage" in window;

  const saveScroll = (path: string) => {
    if (!canPersistScroll()) return;
    try {
      window.sessionStorage.setItem(scrollKey(path), window.scrollY.toString());
    } catch {
      /* ignore storage exceptions */
    }
  };

  let restoreHandle: number | null = null;

  const restoreScroll = (path: string) => {
    if (!canPersistScroll()) return;
    const stored = window.sessionStorage.getItem(scrollKey(path));
    if (!stored) return;
    const value = Number(stored);
    if (Number.isNaN(value)) return;
    if (restoreHandle !== null) {
      window.cancelAnimationFrame(restoreHandle);
    }
    restoreHandle = window.requestAnimationFrame(() => {
      window.scrollTo(0, value);
      restoreHandle = null;
    });
  };

  createEffect(() => {
    const handler = () => {
      saveScroll(page());
      setPage(window.location.pathname || "/");
    };
    window.addEventListener("popstate", handler);
    onCleanup(() => window.removeEventListener("popstate", handler));
  });

  createEffect(() => {
    restoreScroll(page());
  });

  const navigate = (target: string) => {
    saveScroll(page());
    window.history.pushState(null, "", target);
    setPage(target);
    setNavOpen(false);
  };

  const onAuthenticated = (token: string) => {
    setJwtToken(token);
    navigate("/projects");
  };
  const handleTokenRefresh = (token: string) => {
    setJwtToken(token);
  };

  const resetSession = (message?: string) => {
    closeMobileNav();
    setJwtToken(null);
    localStorage.removeItem("jwtToken");
    if (message) {
      enqueueNotification(message, "warning");
    }
    navigate("/login");
  };

  const handleLogout = () => resetSession();

  const handleUnauthorized = () => resetSession("Session expired. Please sign in again.");
  const applyThemePreference = (value: "dark" | "light") => {
    if (typeof document !== "undefined") {
      document.documentElement.dataset.theme = value;
    }
    if (typeof window !== "undefined") {
      localStorage.setItem(themeKey, value);
    }
  };
  createEffect(() => {
    applyThemePreference(theme());
  });
  const toggleTheme = () => {
    setTheme((value) => (value === "dark" ? "light" : "dark"));
  };

  const isProjectDetailPath = (path: string) =>
    /^\/projects\/[^/]+$/.test(path);
  const isTaskDetailPath = (path: string) => /^\/tasks\/[^/]+$/.test(path);
  const userRole = createMemo(() => getRoleFromToken(jwtToken()) ?? "guest");

  onMount(() => {
    const handleUnload = () => saveScroll(page());
    const handleScroll = () => saveScroll(page());
    window.history.scrollRestoration = "manual";
    window.addEventListener("beforeunload", handleUnload);
    window.addEventListener("scroll", handleScroll, { passive: true });
    onCleanup(() => {
      window.removeEventListener("beforeunload", handleUnload);
      window.removeEventListener("scroll", handleScroll);
      window.history.scrollRestoration = "auto";
    });

    if (initialToken) {
      const currentPath = page();
      const available = routes().map((route) => route.path);
      if (
        !available.includes(currentPath) &&
        !isProjectDetailPath(currentPath) &&
        !isTaskDetailPath(currentPath)
      ) {
        navigate("/projects");
      }
    }
  });

  const routes = createMemo(() => getRoutes(!!jwtToken(), userRole()));

  createEffect(() => {
    const available = routes().map((route) => route.path);
    if (available.length === 0) return;
    const currentPath = page();
    if (
      !available.includes(currentPath) &&
      !isProjectDetailPath(currentPath) &&
      !isTaskDetailPath(currentPath)
    ) {
      navigate(available[0]);
    }
  });

  createEffect(() => {
    const token = jwtToken();
    if (token) {
      localStorage.setItem("jwtToken", token);
    } else {
      localStorage.removeItem("jwtToken");
    }
  });

  const renderPage = () => {
    const taskMatch = page().match(/^\/tasks\/([^/]+)$/);
    if (taskMatch) {
      const taskId = decodeURIComponent(taskMatch[1]);
      return (
        <TaskPage
          taskId={taskId}
          jwtToken={jwtToken()}
          onNotify={enqueueNotification}
          onNavigate={navigate}
          onUnauthorized={handleUnauthorized}
        />
      );
    }

    const projectMatch = page().match(/^\/projects\/([^/]+)$/);
    if (projectMatch) {
      const projectId = decodeURIComponent(projectMatch[1]);
      return (
        <ProjectPage
          projectId={projectId}
          jwtToken={jwtToken()}
          onNotify={enqueueNotification}
          onNavigate={navigate}
          onUnauthorized={handleUnauthorized}
        />
      );
    }

    switch (page()) {
      case "/login":
        return <LoginPage onAuthenticated={onAuthenticated} />;
      case "/register":
        return (
          <RegisterPage
            onSuccess={() => {
              enqueueNotification("Registration succeeded! Please log in to continue.", "success");
              navigate("/login");
            }}
            onNotify={enqueueNotification}
          />
        );
      case "/profile":
        return (
          <ProfilePage
            jwtToken={jwtToken()}
            onNotify={enqueueNotification}
            onTokenRefresh={handleTokenRefresh}
            onUnauthorized={handleUnauthorized}
          />
        );
      case "/projects":
        return (
          <ProjectsPage
            jwtToken={jwtToken()}
            userRole={userRole()}
            onNotify={enqueueNotification}
            onNavigate={navigate}
            onUnauthorized={handleUnauthorized}
          />
        );
      case "/teams":
        return (
          <TeamsPage
            jwtToken={jwtToken()}
            userRole={userRole()}
            onNotify={enqueueNotification}
            onUnauthorized={handleUnauthorized}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div class="app-shell">
      <nav class="top-nav">
        <h1 class="site-title">Combiner Auth</h1>
        <div class="nav-controls">
          <div class="nav-actions">
            {routes().map((route) => (
              <button
                type="button"
                class="nav-link"
                onClick={() => navigate(route.path)}
              >
                {route.label}
              </button>
            ))}
            {jwtToken() && (
              <button type="button" class="nav-link" onClick={handleLogout}>
                Logout
              </button>
            )}
          </div>
          <button
            type="button"
            class="theme-toggle"
            onClick={toggleTheme}
            aria-label="Toggle color theme"
          >
            {theme() === "dark" ? "Light mode" : "Dark mode"}
          </button>
          <button
            type="button"
            class="burger-button"
            aria-controls="mobile-navigation"
            aria-expanded={isNavOpen()}
            aria-label={isNavOpen() ? "Close navigation menu" : "Open navigation menu"}
            onClick={toggleMobileNav}
          >
            <span class="burger-line" />
            <span class="burger-line" />
            <span class="burger-line" />
          </button>
        </div>
      </nav>
      <Show when={isNavOpen()}>
        <div class="mobile-nav-layer">
          <div class="mobile-nav-backdrop" role="presentation" onClick={closeMobileNav} />
          <div
            class="mobile-nav-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Site navigation"
            id="mobile-navigation"
          >
            <div class="mobile-nav-header">
              <span class="mobile-nav-title">Navigation</span>
              <button
                type="button"
                class="ghost mobile-nav-close"
                aria-label="Close menu"
                onClick={closeMobileNav}
              >
                Close
              </button>
            </div>
            <div class="mobile-nav-links">
              {routes().map((route) => (
                <button
                  type="button"
                  class="mobile-nav-link"
                  onClick={() => navigate(route.path)}
                >
                  {route.label}
                </button>
              ))}
              {jwtToken() && (
                <button
                  type="button"
                  class="mobile-nav-link"
                  onClick={handleLogout}
                >
                  Logout
                </button>
              )}
            </div>
            <button
              type="button"
              class="theme-toggle mobile-theme-toggle"
              onClick={toggleTheme}
            >
              {theme() === "dark" ? "Light mode" : "Dark mode"}
            </button>
          </div>
        </div>
      </Show>
      <div class="content">{renderPage()}</div>
      <NotificationStack
        notifications={notifications()}
        onDismiss={dismissNotification}
      />
    </div>
  );
};

export default App;
