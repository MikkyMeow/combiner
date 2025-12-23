import { For } from "solid-js";
const NotificationStack = (props) => (<div class="notification-stack" aria-live="polite">
    <For each={props.notifications}>
      {(notification) => (<div class={`notification-toast ${notification.type}`}>
          <span>{notification.message}</span>
          <button type="button" class="notification-close" aria-label="Close notification" onClick={() => props.onDismiss(notification.id)}>
            {"\u00D7"}
          </button>
        </div>)}
    </For>
  </div>);
export default NotificationStack;
