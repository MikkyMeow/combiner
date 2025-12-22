import { createResource, createSignal, createEffect, onCleanup, Resource } from "solid-js";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";

const apiUrl = () => import.meta.env.VITE_API_URL ?? "http://localhost:3000";

const fetchMessage = async () => {
  const response = await fetch(`${apiUrl()}/hello`);
  if (!response.ok) {
    throw new Error("Не удалось получить ответ от сервера");
  }
  const data = (await response.json()) as { message?: string };
  return data.message ?? "Нет сообщения";
};

const App = () => {
  const [message] = createResource(fetchMessage);
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
        throw new Error(data.message ?? "Что-то пошло не так");
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

  const renderPage = () => {
    if (page() === "/login") {
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
    }

    if (page() === "/register") {
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
    }

    return <HomePage messageResource={message} />;
  };

  return (
    <div class="app-shell">
      <nav class="top-nav">
        <h1 class="site-title">Combiner Auth</h1>
        <div class="nav-actions">
          <button type="button" onClick={() => navigate("/")} class="nav-link">
            Главная
          </button>
          <button type="button" onClick={() => navigate("/login")} class="nav-link">
            Вход
          </button>
          <button type="button" onClick={() => navigate("/register")} class="nav-link">
            Регистрация
          </button>
        </div>
      </nav>
      <div class="content">{renderPage()}</div>
    </div>
  );
};

export default App;
