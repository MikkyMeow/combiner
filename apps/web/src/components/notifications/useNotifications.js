import { createSignal, onCleanup } from "solid-js";
const createNotificationId = () => typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
export const useNotifications = () => {
    const [notifications, setNotifications] = createSignal([]);
    const notificationTimers = new Map();
    const clearTimer = (id) => {
        const timer = notificationTimers.get(id);
        if (timer) {
            window.clearTimeout(timer);
            notificationTimers.delete(id);
        }
    };
    const removeNotification = (id) => {
        setNotifications((current) => current.filter((notification) => notification.id !== id));
        clearTimer(id);
    };
    const enqueueNotification = (message, type = "info") => {
        const id = createNotificationId();
        setNotifications((current) => [...current, { id, message, type }]);
        const timer = window.setTimeout(() => removeNotification(id), 3000);
        notificationTimers.set(id, timer);
    };
    const dismissNotification = (id) => removeNotification(id);
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
