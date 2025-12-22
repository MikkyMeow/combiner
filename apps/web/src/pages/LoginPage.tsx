import { createSignal } from "solid-js";

const apiUrl = () => import.meta.env.VITE_API_URL ?? "http://localhost:3000";

type LoginPageProps = {
  onAuthenticated: (token: string) => void;
};

const LoginPage = ({ onAuthenticated }: LoginPageProps) => {
  const [username, setUsername] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [loading, setLoading] = createSignal(false);
  const [result, setResult] = createSignal<string | null>(null);
  const [token, setToken] = createSignal<string | null>(null);
  const [profileInfo, setProfileInfo] = createSignal<string | null>(null);

  const handleLogin = async (event: SubmitEvent) => {
    event.preventDefault();
    setLoading(true);
    setResult(null);
    setProfileInfo(null);

    try {
      const response = await fetch(`${apiUrl()}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ username: username(), password: password() })
      });

      const data = await response.json();

      if (!response.ok) {
        setResult(data.message ?? "Не удалось выполнить вход");
        return;
      }

      if (!data.token) {
        setResult("Токен не получен");
        return;
      }

      setToken(data.token);
      setResult("Вход выполнен, токен получен");
      onAuthenticated(data.token);

      const profileResponse = await fetch(`${apiUrl()}/me`, {
        headers: {
          Authorization: `Bearer ${data.token}`
        }
      });

      if (!profileResponse.ok) {
        setProfileInfo("Не удалось получить профиль");
        return;
      }

      const profileData = await profileResponse.json();
      setProfileInfo(JSON.stringify(profileData.user));
    } catch (error) {
      setResult((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form class="form-panel" onSubmit={handleLogin}>
      <h2>Вход</h2>
      <label>
        Имя пользователя
        <input
          class="text-input"
          value={username()}
          onInput={(event) => setUsername(event.currentTarget.value)}
          required
        />
      </label>
      <label>
        Пароль
        <input
          class="text-input"
          type="password"
          value={password()}
          onInput={(event) => setPassword(event.currentTarget.value)}
          required
        />
      </label>
      <button class="primary" type="submit" disabled={loading()}>
        {loading() ? "Отправка…" : "Войти"}
      </button>
      {result() && <p class="helper-text">{result()}</p>}
      {token() && <p class="helper-text">JWT: {token()}</p>}
      {profileInfo() && (
        <div class="profile-card">
          <strong>Профиль:</strong>
          <pre>{profileInfo()}</pre>
        </div>
      )}
    </form>
  );
};

export default LoginPage;
