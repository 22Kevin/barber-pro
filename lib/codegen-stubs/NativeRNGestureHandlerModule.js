// Substitui react-native-gesture-handler/src/specs/NativeRNGestureHandlerModule.ts
// (versão 2.28.0, conferido diretamente no pacote baixado do npm). É um
// TurboModule (não um componente visual). Ver
// lib/codegen-stubs/NativeSafeAreaContext.js (mesmo padrão) para o motivo
// completo do uso de NativeModules em vez de TurboModuleRegistry.
import { NativeModules } from "react-native";

export default NativeModules.RNGestureHandlerModule;
