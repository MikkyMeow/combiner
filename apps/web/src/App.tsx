import { createSignal, createEffect, createMemo, onCleanup, onMount } from "solid-js";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import TasksPage from "./pages/TasksPage";
import { getRoutes } from "./routes";
import NotificationStack from "./components/notifications/NotificationStack";
import { useNotifications } from "./components/notifications/useNotifications";

const initialToken =
  typeof window !== "undefined" ? localStorage.getItem("jwtToken") : null;

const App = () => {
  const [page, setPage] = createSignal(window.location.pathname || "/");
  const [jwtToken, setJwtToken] = createSignal<string | null>(initialToken ?? null);
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
  };

  const onAuthenticated = (token: string) => {
    setJwtToken(token);
    navigate("/tasks");
  };

  const handleLogout = () => {
    setJwtToken(null);
    localStorage.removeItem("jwtToken");
    navigate("/login");
  };

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

    if (initialToken && page() !== "/tasks") {
      navigate("/tasks");
    }
  });

  const routes = createMemo(() => getRoutes(!!jwtToken()));

  createEffect(() => {
    const available = routes().map((route) => route.path);
    if (available.length === 0) return;
    if (!available.includes(page())) {
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
      case "/tasks":
        return (
          <TasksPage
            jwtToken={jwtToken()}
            onNotify={enqueueNotification}
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
              Выйти
            </button>
          )}
        </div>
      </nav>
      <div class="content">{renderPage()}</div>
      <NotificationStack
        notifications={notifications()}
        onDismiss={dismissNotification}
      />
    </div>
  );
};

export default App;
