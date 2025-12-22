import { Resource } from "solid-js";

type HomePageProps = {
  messageResource: Resource<string>;
};

const HomePage = ({ messageResource }: HomePageProps) => (
  <section class="home-card">
    <h1>Backend message</h1>
    <p>
      {messageResource.loading
        ? "Идет загрузка…"
        : messageResource.error
        ? messageResource.error.message
        : messageResource()}
    </p>
    <section>
      <h2>Информация</h2>
      <ul>
        <li>
          <strong>Frontend:</strong> Solid + Vite + TypeScript
        </li>
        <li>
          <strong>Backend:</strong> Fastify + TypeScript + tsx
        </li>
        <li>
          <strong>Команда для запуска:</strong> <code>pnpm dev</code>
        </li>
      </ul>
    </section>
  </section>
);

export default HomePage;
