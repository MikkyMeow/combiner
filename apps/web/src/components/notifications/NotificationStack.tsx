import { For } from "solid-js";
import type { NotificationItem } from "./useNotifications";

type NotificationStackProps = {
  notifications: NotificationItem[];
  onDismiss: (id: string) => void;
};

const NotificationStack = (props: NotificationStackProps) => (
  <div class="notification-stack" aria-live="polite">
    <For each={props.notifications}>
      {(notification) => (
        <div class={`notification-toast ${notification.type}`}>
          <span>{notification.message}</span>
          <button
            type="button"
            class="notification-close"
            aria-label="Close notification"
            onClick={() => props.onDismiss(notification.id)}
          >
            {"\u00D7"}
          </button>
        </div>
      )}
    </For>
  </div>
);

export default NotificationStack;
