// Substitui react-native/src/private/specs_DEPRECATED/components/PullToRefreshViewNativeComponent.js
// (versão 0.81.5, conferido diretamente no pacote baixado do npm). Módulo
// central do React Native ativamente usado (a pasta "specs_DEPRECATED" tem
// nome enganoso — ver a nota grande em metro.config.js sobre isso). Ver
// lib/codegen-stubs/NativeSafeAreaView.js para o motivo completo do uso
// de requireNativeComponent em vez de codegenNativeComponent.
import { requireNativeComponent } from "react-native";

export default requireNativeComponent("RCTRefreshControl");
