import { createSignal } from "solid-js";

const apiUrl = () => import.meta.env.VITE_API_URL ?? "http://localhost:3000";

type RegisterPageProps = {
  onSuccess?: () => void;
};

const RegisterPage = ({ onSuccess }: RegisterPageProps) => {
  const [username, setUsername] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [loading, setLoading] = createSignal(false);
  const [result, setResult] = createSignal<string | null>(null);

  const handleRegister = async (event: SubmitEvent) => {
    event.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch(`${apiUrl()}/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ username: username(), password: password() })
      });

      const data = await response.json();

      if (!response.ok) {
        setResult(data.message ?? "Не удалось зарегистрировать пользователя");
        return;
      }

      setResult(data.message ?? "Регистрация прошла успешно");
      onSuccess?.();
    } catch (error) {
      setResult((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form class="form-panel" onSubmit={handleRegister}>
      <h2>Регистрация</h2>
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
        {loading() ? "Отправка…" : "Зарегистрироваться"}
      </button>
      {result() && <p class="helper-text">{result()}</p>}
    </form>
  );
};

export default RegisterPage;
