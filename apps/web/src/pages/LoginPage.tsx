type LoginPageProps = {
  username: string;
  password: string;
  onUpdateUsername: (value: string) => void;
  onUpdatePassword: (value: string) => void;
  onSubmit: (event: SubmitEvent) => Promise<void>;
  loading: boolean;
  result: string | null;
  token: string | null;
  profileInfo: string | null;
};

const LoginPage = ({
  username,
  password,
  onUpdateUsername,
  onUpdatePassword,
  onSubmit,
  loading,
  result,
  token,
  profileInfo
}: LoginPageProps) => (
  <form class="form-panel" onSubmit={onSubmit}>
    <h2>Вход</h2>
    <label>
      Имя пользователя
      <input
        class="text-input"
        value={username}
        onInput={(event) => onUpdateUsername(event.currentTarget.value)}
        required
      />
    </label>
    <label>
      Пароль
      <input
        class="text-input"
        type="password"
        value={password}
        onInput={(event) => onUpdatePassword(event.currentTarget.value)}
        required
      />
    </label>
    <button class="primary" type="submit" disabled={loading}>
      {loading ? "Отправка…" : "Войти"}
    </button>
    {result && <p class="helper-text">{result}</p>}
    {token && <p class="helper-text">JWT: {token}</p>}
    {profileInfo && (
      <div class="profile-card">
        <strong>Профиль:</strong>
        <pre>{profileInfo}</pre>
      </div>
    )}
  </form>
);

export default LoginPage;
