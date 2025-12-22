const tasks = [
  { title: "Авторизация", description: "Fastify + fastify-jwt, JWT или сессии, простой in-memory пользователь" },
  { title: "Frontend", description: "Страницы входа и регистрации в Solid.js, красивые формы и навигация" },
  { title: "Интеграция", description: "Запросы к API `/login`, `/register`, `/me` с отображением токена" },
  { title: "UX", description: "Современный дизайн: градиентный фон, панель навигации и карточки контента" }
];

const TasksPage = () => (
  <section class="home-card">
    <h1>Текущие задачи</h1>
    <ul>
      {tasks.map((task) => (
        <li>
          <strong>{task.title}</strong> — {task.description}
        </li>
      ))}
    </ul>
  </section>
);

export default TasksPage;
