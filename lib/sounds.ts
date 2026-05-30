/**
 * Subtle sound feedback for key actions.
 * Uses expo-audio — silently no-ops if unavailable or on web.
 */
import { Platform } from "react-native";

let Audio: any = null;
if (Platform.OS !== "web") {
  try { Audio = require("expo-audio"); } catch {}
}

async function playSound(asset: any) {
  if (!Audio) return;
  try {
    const player = Audio.useAudioPlayer ? null : await Audio.Sound?.createAsync(asset);
    if (player?.sound) {
      await player.sound.setVolumeAsync(0.4);
      await player.sound.playAsync();
    }
  } catch {}
}

// For now use haptic as sound proxy — actual sound files would need assets
// This is the foundation when sound assets are added
export const sounds = {
  confirm: () => {}, // placeholder — add sound asset when ready
  error:   () => {},
  tap:     () => {},
};
