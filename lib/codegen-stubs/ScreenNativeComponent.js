// Substitui react-native-screens/src/fabric/ScreenNativeComponent.ts (versão 4.16.0,
// conferido diretamente no pacote baixado do npm). Ver
// lib/codegen-stubs/NativeSafeAreaView.js para o motivo completo do uso
// de requireNativeComponent em vez de codegenNativeComponent.
import { requireNativeComponent } from "react-native";

export default requireNativeComponent("RNSScreen");
