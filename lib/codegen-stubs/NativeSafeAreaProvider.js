// Substitui react-native-safe-area-context/src/specs/NativeSafeAreaProvider.ts
// v2 — ver NativeSafeAreaView.js (mesma pasta) para o motivo completo da
// troca de codegenNativeComponent para requireNativeComponent.
import { requireNativeComponent } from "react-native";

export default requireNativeComponent("RNCSafeAreaProvider");
