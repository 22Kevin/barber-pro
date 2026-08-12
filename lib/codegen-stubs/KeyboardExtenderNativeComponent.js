// Substitui react-native-keyboard-controller/src/specs/KeyboardExtenderNativeComponent.ts
// (versão 1.18.5, conferido diretamente no pacote baixado do npm). No
// original esse componente é excluído no Android (excludedPlatforms:
// ["android"]) — só existe no iOS. Ver lib/codegen-stubs/NativeSafeAreaView.js
// para o motivo completo do uso de requireNativeComponent.
import { requireNativeComponent } from "react-native";

export default requireNativeComponent("KeyboardExtender");
