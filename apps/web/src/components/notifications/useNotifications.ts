import { createSignal, onCleanup } from "solid-js";

export type NotificationType = "success" | "error" | "warning" | "info";

export type NotificationItem = {
  id: string;
  message: string;
  type: NotificationType;
};

const createNotificationId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;

export const useNotifications = () => {
  const [notifications, setNotifications] = createSignal<NotificationItem[]>([]);
  const notificationTimers = new Map<string, number>();
  const clearTimer = (id: string) => {
    const timer = notificationTimers.get(id);
    if (timer) {
      window.clearTimeout(timer);
      notificationTimers.delete(id);
    }
  };

  const removeNotification = (id: string) => {
    setNotifications((current) => current.filter((notification) => notification.id !== id));
    clearTimer(id);
  };

  const enqueueNotification = (message: string, type: NotificationType = "info") => {
    const id = createNotificationId();
    setNotifications((current) => [...current, { id, message, type }]);
    const timer = window.setTimeout(() => removeNotification(id), 3000);
    notificationTimers.set(id, timer);
  };

  const dismissNotification = (id: string) => removeNotification(id);

  onCleanup(() => {
    notificationTimers.forEach((timer) => window.clearTimeout(timer));
    notificationTimers.clear();
  });

  return {
    notifications,
    enqueueNotification,
    dismissNotification
  };
};
