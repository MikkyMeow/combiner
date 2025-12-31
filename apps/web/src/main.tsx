import "./style.css";
import { render } from "solid-js/web";
import App from "./App";

const setupConsoleOverlay = () => {
  const container = document.createElement("div");
  container.id = "console-overlay";
  container.setAttribute("role", "log");
  container.style.position = "fixed";
  container.style.zIndex = "99999";
  container.style.left = "8px";
  container.style.right = "8px";
  container.style.bottom = "8px";
  container.style.maxHeight = "40vh";
  container.style.overflow = "auto";
  container.style.padding = "8px 10px";
  container.style.background = "rgba(15, 15, 15, 0.92)";
  container.style.color = "#f1f1f1";
  container.style.font = "12px/1.4 monospace";
  container.style.border = "1px solid rgba(255, 255, 255, 0.2)";
  container.style.borderRadius = "8px";
  container.style.boxShadow = "0 8px 30px rgba(0, 0, 0, 0.3)";

  const title = document.createElement("div");
  title.textContent = "Console errors (live)";
  title.style.fontWeight = "600";
  title.style.marginBottom = "6px";
  container.appendChild(title);

  const list = document.createElement("div");
  const empty = document.createElement("div");
  empty.textContent = "No errors yet.";
  empty.style.opacity = "0.7";
  list.appendChild(empty);
  container.appendChild(list);

  const appendLine = (label: string, message: string) => {
    const line = document.createElement("div");
    line.style.whiteSpace = "pre-wrap";
    line.style.wordBreak = "break-word";
    line.textContent = `${label}: ${message}`;
    if (empty.parentElement) {
      empty.remove();
    }
    list.appendChild(line);
    container.scrollTop = container.scrollHeight;
  };

  const toMessage = (value: unknown) => {
    if (value instanceof Error) return value.stack ?? value.message;
    if (typeof value === "string") return value;
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  };

  const originalError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    appendLine("error", args.map(toMessage).join(" "));
    originalError(...args);
  };

  const originalWarn = console.warn.bind(console);
  console.warn = (...args: unknown[]) => {
    appendLine("warn", args.map(toMessage).join(" "));
    originalWarn(...args);
  };

  window.addEventListener("error", (event) => {
    appendLine("window.error", event.message || "Unknown error");
  });

  window.addEventListener("unhandledrejection", (event) => {
    appendLine("unhandledrejection", toMessage(event.reason));
  });

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const request = args[0];
    const url =
      typeof request === "string"
        ? request
        : request instanceof Request
          ? request.url
          : "unknown";
    const method =
      request instanceof Request
        ? request.method
        : typeof args[1]?.method === "string"
          ? args[1].method
          : "GET";

    try {
      const response = await originalFetch(...args);
      if (!response.ok) {
        appendLine("fetch", `${method} ${url} -> ${response.status} ${response.statusText}`);
      }
      return response;
    } catch (error) {
      appendLine("fetch.error", `${method} ${url} -> ${toMessage(error)}`);
      throw error;
    }
  };

  document.body.appendChild(container);
};

const debugOverlayEnabled = import.meta.env.DEV && import.meta.env.VITE_DEBUG_OVERLAY === "true";
if (debugOverlayEnabled) {
  setupConsoleOverlay();
}
render(() => <App />, document.getElementById("app")!);
