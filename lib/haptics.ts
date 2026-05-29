/**
 * Haptic feedback utilities for native feel on Android/iOS.
 * Silently no-ops on web.
 */
import { Platform } from "react-native";

let Haptics: any = null;
if (Platform.OS !== "web") {
  try { Haptics = require("expo-haptics"); } catch { /* not installed */ }
}

/** Light tap — for selecting, toggling */
export async function hapticLight() {
  try { await Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
}

/** Medium impact — for confirming actions */
export async function hapticMedium() {
  try { await Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
}

/** Heavy impact — for destructive actions (delete, cancel) */
export async function hapticHeavy() {
  try { await Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); } catch {}
}

/** Success notification — for completed actions */
export async function hapticSuccess() {
  try { await Haptics?.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
}

/** Error notification — for failed actions */
export async function hapticError() {
  try { await Haptics?.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch {}
}
