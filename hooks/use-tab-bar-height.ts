/**
 * useTabBarHeight — retorna a altura total do tab bar admin (ícone + padding inferior).
 * Use este valor como paddingBottom nos ScrollViews das telas admin para evitar
 * que o conteúdo seja cortado pelo tab bar.
 */
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const TAB_BAR_ICON_AREA = 56; // altura fixa da área de ícones
const EXTRA_PADDING = 16;     // espaço extra acima do tab bar

export function useTabBarHeight(): number {
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === "web" ? 12 : Math.max(insets.bottom, 8);
  return TAB_BAR_ICON_AREA + bottomPadding + EXTRA_PADDING;
}
