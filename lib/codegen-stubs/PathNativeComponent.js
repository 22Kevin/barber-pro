// Substitui react-native-svg/src/fabric/PathNativeComponent.ts (versão 15.12.1,
// conferido diretamente no pacote baixado do npm). Ver
// lib/codegen-stubs/NativeSafeAreaView.js para o motivo completo do uso
// de requireNativeComponent em vez de codegenNativeComponent.
import { requireNativeComponent } from "react-native";

export default requireNativeComponent("RNSVGPath");
