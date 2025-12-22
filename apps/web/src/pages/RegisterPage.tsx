import { createSignal } from "solid-js";
import { NotificationType } from "../components/notifications/useNotifications";

const apiUrl = () => import.meta.env.VITE_API_URL ?? "http://localhost:3000";

type RegisterPageProps = {
  onSuccess?: () => void;
  onNotify?: (message: string, type?: NotificationType) => void;
};

const RegisterPage = ({ onSuccess, onNotify }: RegisterPageProps) => {
  const [username, setUsername] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [loading, setLoading] = createSignal(false);
  const [result, setResult] = createSignal<string | null>(null);

  const notify = (message: string, type: NotificationType = "info") => {
    onNotify?.(message, type);
  };

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
        const errorMessage = data.message ?? "Registration failed. Please try again.";
        setResult(errorMessage);
        notify(errorMessage, "error");
        return;
      }

      const successMessage = data.message ?? "Account created successfully.";
      setResult(successMessage);
      notify(successMessage, "success");
      onSuccess?.();
    } catch (error) {
      const errorMessage = (error as Error).message || "An unexpected error occurred.";
      setResult(errorMessage);
      notify(errorMessage, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form class="form-panel" onSubmit={handleRegister}>
      <h2>Create an account</h2>
      <label>
        Username
        <input
          class="text-input"
          value={username()}
          onInput={(event) => setUsername(event.currentTarget.value)}
          required
        />
      </label>
      <label>
        Password
        <input
          class="text-input"
          type="password"
          value={password()}
          onInput={(event) => setPassword(event.currentTarget.value)}
          required
        />
      </label>
      <button class="primary" type="submit" disabled={loading()}>
        {loading() ? "Submitting..." : "Register"}
      </button>
      {result() && <p class="helper-text">{result()}</p>}
    </form>
  );
};

export default RegisterPage;
