import { createResource } from "solid-js";

const apiUrl = () => import.meta.env.VITE_API_URL ?? "http://localhost:3000";

const fetchMessage = async () => {
  const response = await fetch(`${apiUrl()}/hello`);
  if (!response.ok) {
    throw new Error("Не удалось получить сообщение");
  }
  const data = (await response.json()) as { message?: string };
  return data.message ?? "В ответе нет message";
};

const infoList = [
  {
    label: "Frontend",
    value: "Solid + Vite + TypeScript"
  },
  {
    label: "Backend",
    value: "Fastify + TypeScript + tsx"
  },
  {
    label: "Dev script",
    value: "runs both pnpm dev:api & pnpm dev:web",
    code: "pnpm dev"
  }
];

const App = () => {
  const [message] = createResource(fetchMessage);

  return (
    <main>
      <h1>Backend message</h1>
      <p>
        {message.loading
          ? "Подключение к бэку..."
          : message.error
          ? message.error.message
          : message()}
      </p>
      <section>
        <h2>Проект</h2>
        <ul>
          {infoList.map((item) => (
            <li>
              <strong>{item.label}:</strong>{" "}
              {item.code ? (
                <>
                  <code>{item.code}</code>
                  {item.value ? ` — ${item.value}` : ""}
                </>
              ) : (
                item.value
              )}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
};

export default App;
