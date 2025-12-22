import { createSignal, createEffect, onCleanup, createMemo } from "solid-js";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import TasksPage from "./pages/TasksPage";
import { getRoutes } from "./routes";

const apiUrl = () => import.meta.env.VITE_API_URL ?? "http://localhost:3000";

const App = () => {
  const [page, setPage] = createSignal(window.location.pathname || "/");
  const [loginUsername, setLoginUsername] = createSignal("");
  const [loginPassword, setLoginPassword] = createSignal("");
  const [registerUsername, setRegisterUsername] = createSignal("");
  const [registerPassword, setRegisterPassword] = createSignal("");
  const [loginResult, setLoginResult] = createSignal<string | null>(null);
  const [registerResult, setRegisterResult] = createSignal<string | null>(null);
  const [jwtToken, setJwtToken] = createSignal<string | null>(null);
  const [profileInfo, setProfileInfo] = createSignal<string | null>(null);
  const [loginLoading, setLoginLoading] = createSignal(false);
  const [registerLoading, setRegisterLoading] = createSignal(false);

  createEffect(() => {
    const handler = () => setPage(window.location.pathname || "/");
    window.addEventListener("popstate", handler);
    onCleanup(() => window.removeEventListener("popstate", handler));
  });

  const navigate = (target: string) => {
    window.history.pushState(null, "", target);
    setPage(target);
  };

  const handleAuth = async (
    endpoint: "/login" | "/register",
    payload: { username: string; password: string },
    setLoading: (value: boolean) => void,
    setResult: (value: string | null) => void,
    onSuccess?: (token: string) => void
  ) => {
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch(`${apiUrl()}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message ?? "Произошла ошибка на сервере");
      }

      if (endpoint === "/login" && data.token) {
        onSuccess?.(data.token);
        setResult("Вход выполнен, токен получен");
        return;
      }

      setResult(data.message ?? "Успешно");
    } catch (error) {
      setResult((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (event: SubmitEvent) => {
    event.preventDefault();
    await handleAuth(
      "/login",
      { username: loginUsername(), password: loginPassword() },
      setLoginLoading,
      setLoginResult,
      (token) => {
        setJwtToken(token);
        fetchProfile(token);
        navigate("/tasks");
      }
    );
  };

  const handleRegister = async (event: SubmitEvent) => {
    event.preventDefault();
    await handleAuth(
      "/register",
      { username: registerUsername(), password: registerPassword() },
      setRegisterLoading,
      setRegisterResult
    );
  };

  const fetchProfile = async (token: string) => {
    try {
      const response = await fetch(`${apiUrl()}/me`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!response.ok) {
        throw new Error("Не удалось получить профиль");
      }
      const data = await response.json();
      setProfileInfo(JSON.stringify(data.user));
    } catch (error) {
      setProfileInfo((error as Error).message);
    }
  };

  const routes = createMemo(() => getRoutes(!!jwtToken()));

  createEffect(() => {
    const available = routes().map((route) => route.path);
    if (available.length === 0) return;
    if (!available.includes(page())) {
      navigate(available[0]);
    }
  });

  const renderPage = () => {
    switch (page()) {
      case "/login":
        return (
          <LoginPage
            username={loginUsername()}
            password={loginPassword()}
            onUpdateUsername={setLoginUsername}
            onUpdatePassword={setLoginPassword}
            onSubmit={handleLogin}
            loading={loginLoading()}
            result={loginResult()}
            token={jwtToken()}
            profileInfo={profileInfo()}
          />
        );
      case "/register":
        return (
          <RegisterPage
            username={registerUsername()}
            password={registerPassword()}
            onUpdateUsername={setRegisterUsername}
            onUpdatePassword={setRegisterPassword}
            onSubmit={handleRegister}
            loading={registerLoading()}
            result={registerResult()}
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
        </div>
      </nav>
      <div class="content">{renderPage()}</div>
    </div>
  );
};

export default App;
