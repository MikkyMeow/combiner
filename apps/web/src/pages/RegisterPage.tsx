type RegisterPageProps = {
  username: string;
  password: string;
  onUpdateUsername: (value: string) => void;
  onUpdatePassword: (value: string) => void;
  onSubmit: (event: SubmitEvent) => Promise<void>;
  loading: boolean;
  result: string | null;
};

const RegisterPage = ({
  username,
  password,
  onUpdateUsername,
  onUpdatePassword,
  onSubmit,
  loading,
  result
}: RegisterPageProps) => (
  <form class="form-panel" onSubmit={onSubmit}>
    <h2>Регистрация</h2>
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
      {loading ? "Отправка…" : "Зарегистрироваться"}
    </button>
    {result && <p class="helper-text">{result}</p>}
  </form>
);

export default RegisterPage;
