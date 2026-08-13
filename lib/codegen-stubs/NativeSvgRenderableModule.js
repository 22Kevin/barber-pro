// Substitui react-native-svg/src/fabric/NativeSvgRenderableModule.ts (versão 15.12.1,
// conferido diretamente no pacote baixado do npm). É um TurboModule (não
// um componente visual). Ver lib/codegen-stubs/NativeSafeAreaContext.js
// (mesmo padrão) para o motivo completo do uso de NativeModules em vez de
// TurboModuleRegistry.
import { NativeModules } from "react-native";

export default NativeModules.RNSVGRenderableModule;
