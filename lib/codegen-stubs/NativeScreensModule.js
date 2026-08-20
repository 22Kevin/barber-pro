// Substitui react-native-screens/src/fabric/NativeScreensModule.ts (versão 4.16.0,
// conferido diretamente no pacote baixado do npm). É um TurboModule (não
// um componente visual). Ver lib/codegen-stubs/NativeSafeAreaContext.js
// (mesmo padrão) para o motivo completo do uso de NativeModules em vez de
// TurboModuleRegistry.
import { NativeModules } from "react-native";

export default NativeModules.RNSModule;
