export async function requestNotificationPermission() {
  if (!("Notification" in window)) {
    console.warn("This browser does not support desktop notification");
    return false;
  }
  if (Notification.permission === "granted") return true;
  if (Notification.permission !== "denied") {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  }
  return false;
}

export function showNativeNotification(title: string, options?: NotificationOptions) {
  if (!("Notification" in window)) return;
  if (Notification.permission === "granted") {
    const notification = new Notification(title, {
      icon: "/assets/logo.png",
      ...options,
    });
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  }
}
