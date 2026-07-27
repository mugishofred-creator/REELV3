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

export async function notifyFollowUpsDue(count: number) {
  if (Platform.OS === "web" || count <= 0) return;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "JobPilot",
      body:
        count === 1
          ? "1 relance à envoyer aujourd'hui."
          : `${count} relances à envoyer aujourd'hui.`,
      data: { type: "followup" },
    },
    trigger: null,
  });
}

export async function scheduleDailyReminder() {
  if (Platform.OS === "web") return;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of scheduled) {
    if (n.content?.data?.type === "daily") {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Top chrono",
      body: "Lance ta campagne du jour — quelques candidatures qualifiées valent mieux que 100 spam.",
      data: { type: "daily" },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      hour: 9,
      minute: 30,
      repeats: true,
    } as Notifications.CalendarTriggerInput,
  });
}
