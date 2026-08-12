// Substitui react-native-keyboard-controller/src/specs/NativeKeyboardController.ts
// (versão 1.18.5, conferido diretamente no pacote baixado do npm). É um
// TurboModule (não um componente visual). Ver
// lib/codegen-stubs/NativeSafeAreaContext.js (mesmo padrão) para o motivo
// completo do uso de NativeModules em vez de TurboModuleRegistry.
import { NativeModules } from "react-native";

export default NativeModules.KeyboardController;
