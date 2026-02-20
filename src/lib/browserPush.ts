type ChatPushOptions = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

const DEFAULT_ICON = `${import.meta.env.BASE_URL || "/"}icon-192.png`;

export function getBrowserNotificationPermission(): NotificationPermission {
  if (typeof window === "undefined" || typeof Notification === "undefined") {
    return "denied";
  }
  return Notification.permission;
}

export async function requestBrowserPushPermission() {
  if (typeof window === "undefined" || typeof Notification === "undefined") {
    return "denied" as NotificationPermission;
  }
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied" as NotificationPermission;
  }
}

export async function showBrowserPush(options: ChatPushOptions) {
  if (typeof window === "undefined" || typeof Notification === "undefined") return false;
  if (Notification.permission !== "granted") return false;

  const title = options.title || "CRM DIAMANTE";
  const body = options.body || "";
  const data = { url: options.url || window.location.href };
  const payload: NotificationOptions = {
    body,
    icon: DEFAULT_ICON,
    badge: DEFAULT_ICON,
    tag: options.tag,
    data,
  };

  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    if (registration) {
      await registration.showNotification(title, payload);
      return true;
    }
    new Notification(title, payload);
    return true;
  } catch {
    return false;
  }
}
