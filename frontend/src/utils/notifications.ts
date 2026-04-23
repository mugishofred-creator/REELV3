import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

let configured = false;

export async function setupNotifications(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  if (!configured) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: true,
      }),
    });
    configured = true;
  }
  const settings = await Notifications.getPermissionsAsync();
  let granted =
    settings.granted ||
    settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  if (!granted) {
    const req = await Notifications.requestPermissionsAsync();
    granted = req.granted;
  }
  return granted;
}

export async function notifyUrgentActions(count: number) {
  if (Platform.OS === "web" || count <= 0) return;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Vinted Manager",
      body:
        count === 1
          ? "1 action urgente t'attend."
          : `${count} actions urgentes t'attendent.`,
      data: { type: "urgent" },
    },
    trigger: null, // immediate
  });
}

export async function scheduleDailyReminder() {
  if (Platform.OS === "web") return;
  // Cancel previously scheduled daily to avoid duplicates
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of scheduled) {
    if (n.content?.data?.type === "daily") {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Check ton stock",
      body: "C'est l'heure de vérifier tes actions du jour.",
      data: { type: "daily" },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      hour: 9,
      minute: 0,
      repeats: true,
    } as Notifications.CalendarTriggerInput,
  });
}

export async function scheduleWeeklyBackupReminder() {
  if (Platform.OS === "web") return;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of scheduled) {
    if (n.content?.data?.type === "backup") {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "💾 Pense à sauvegarder",
      body:
        "Exporte tes données Vinted Manager pour ne rien perdre en cas de changement de téléphone.",
      data: { type: "backup" },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      weekday: 1, // Sunday (1) per iOS / Android expo mapping
      hour: 20,
      minute: 0,
      repeats: true,
    } as Notifications.CalendarTriggerInput,
  });
}
