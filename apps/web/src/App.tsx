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

  createEffect(() => {
    const handler = () => setPage(window.location.pathname || "/");
    window.addEventListener("popstate", handler);
    onCleanup(() => window.removeEventListener("popstate", handler));
  });

  const navigate = (target: string) => {
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
        return <TasksPage />;
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
