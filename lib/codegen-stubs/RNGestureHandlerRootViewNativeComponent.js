// Substitui react-native-gesture-handler/src/specs/
// RNGestureHandlerRootViewNativeComponent.ts
//
// v2 — ver NativeSafeAreaView.js (react-native-safe-area-context) para o
// motivo completo da troca de codegenNativeComponent para
// requireNativeComponent. Este é o componente raiz que envolve o app
// inteiro (GestureHandlerRootView) — por isso a atenção extra em manter
// o comportamento igual ao original.
import { requireNativeComponent } from "react-native";

export default requireNativeComponent("RNGestureHandlerRootView");
