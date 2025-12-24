import { createSignal } from "solid-js";
const apiUrl = () => import.meta.env.VITE_API_URL ?? "http://localhost:3000";
const LoginPage = ({ onAuthenticated }) => {
    const [username, setUsername] = createSignal("");
    const [password, setPassword] = createSignal("");
    const [loading, setLoading] = createSignal(false);
    const [result, setResult] = createSignal(null);
    const [token, setToken] = createSignal(null);
    const [profileInfo, setProfileInfo] = createSignal(null);
    const handleLogin = async (event) => {
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
                setResult(data.message ?? "Unable to log in. Please check your credentials.");
                return;
            }
            if (!data.token) {
                setResult("Token not received from server.");
                return;
            }
            setToken(data.token);
            setResult("Login successful.");
            onAuthenticated(data.token);
            const profileResponse = await fetch(`${apiUrl()}/me`, {
                headers: {
                    Authorization: `Bearer ${data.token}`
                }
            });
            if (!profileResponse.ok) {
                setProfileInfo("Unable to load profile information.");
                return;
            }
            const profileData = await profileResponse.json();
            setProfileInfo(JSON.stringify(profileData.user));
        }
        catch (error) {
            setResult(error.message);
        }
        finally {
            setLoading(false);
        }
    };
    return (<form class="form-panel" onSubmit={handleLogin}>
      <h2>Login</h2>
      <label>
        Username
        <input class="text-input" value={username()} onInput={(event) => setUsername(event.currentTarget.value)} required/>
      </label>
      <label>
        Password
        <input class="text-input" type="password" value={password()} onInput={(event) => setPassword(event.currentTarget.value)} required/>
      </label>
      <button class="primary" type="submit" disabled={loading()}>
        {loading() ? "Logging in..." : "Log in"}
      </button>
      {result() && <p class="helper-text">{result()}</p>}
      {token() && <p class="helper-text">JWT: {token()}</p>}
      {profileInfo() && (<div class="profile-card">
          <strong>Profile:</strong>
          <pre>{profileInfo()}</pre>
        </div>)}
    </form>);
};
export default LoginPage;
