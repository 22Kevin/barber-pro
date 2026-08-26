// Substitui react-native/src/private/specs_DEPRECATED/modules/NativeFileReaderModule.js
// (versão 0.81.5, conferido diretamente no pacote baixado do npm). Módulo
// central do React Native ativamente usado (a pasta "specs_DEPRECATED" tem
// nome enganoso — ver a nota grande em metro.config.js sobre isso). Ver
// lib/codegen-stubs/NativeSafeAreaContext.js (mesmo padrão) para o motivo
// completo do uso de NativeModules em vez de TurboModuleRegistry.
import { NativeModules } from "react-native";

export default NativeModules.FileReaderModule;
