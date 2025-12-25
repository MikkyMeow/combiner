import { createSignal } from "solid-js";
const apiUrl = () => import.meta.env.VITE_API_URL ?? "http://localhost:3000";
const RegisterPage = ({ onSuccess, onNotify }) => {
    const [username, setUsername] = createSignal("");
    const [password, setPassword] = createSignal("");
    const [confirmPassword, setConfirmPassword] = createSignal("");
    const [loading, setLoading] = createSignal(false);
    const [result, setResult] = createSignal(null);
    const notify = (message, type = "info") => {
        onNotify?.(message, type);
    };
    const passwordsMatch = () => password() === confirmPassword();
    const showPasswordMismatch = () => confirmPassword().length > 0 && !passwordsMatch();
    const handleRegister = async (event) => {
        event.preventDefault();
        const mismatchMessage = "Passwords do not match.";
        if (!passwordsMatch()) {
            setResult(mismatchMessage);
            notify(mismatchMessage, "error");
            return;
        }
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
        }
        catch (error) {
            const errorMessage = error.message || "An unexpected error occurred.";
            setResult(errorMessage);
            notify(errorMessage, "error");
        }
        finally {
            setLoading(false);
        }
    };
    return (<form class="form-panel" onSubmit={handleRegister}>
      <h2>Create an account</h2>
      <label>
        Username
        <input class="text-input" value={username()} onInput={(event) => setUsername(event.currentTarget.value)} required/>
      </label>
      <label>
        Password
        <input class="text-input" type="password" value={password()} onInput={(event) => setPassword(event.currentTarget.value)} required/>
      </label>
      <label>
        Confirm password
        <input class="text-input" type="password" value={confirmPassword()} onInput={(event) => setConfirmPassword(event.currentTarget.value)} required/>
        {showPasswordMismatch() && (<p class="helper-text">Passwords do not match.</p>)}
      </label>
      <button class="primary" type="submit" disabled={loading() || !passwordsMatch()}>
        {loading() ? "Creating account..." : "Register"}
      </button>
      {result() && <p class="helper-text">{result()}</p>}
    </form>);
};
export default RegisterPage;
