// Substitui react-native/src/private/specs_DEPRECATED/modules/NativeDeviceInfo.js
// (versão 0.81.5, conferido diretamente no pacote baixado do npm). Esse é
// o módulo que estava quebrado — o Dimensions.js chama
// NativeDeviceInfo.getConstants() logo na inicialização do app; um stub
// vazio fazia isso virar "undefined is not a function" e derrubava o app
// inteiro ao abrir. Ver INVESTIGACAO-NEW-ARCHITECTURE.md para o relato
// completo da investigação desse crash.
//
// Preserva o mesmo comportamento do original (cache do resultado depois
// da primeira chamada), só usando NativeModules em vez de
// TurboModuleRegistry — ver lib/codegen-stubs/NativeSafeAreaContext.js
// (mesmo padrão) pro motivo completo.
import { NativeModules } from "react-native";

let constants = null;

const NativeDeviceInfo = {
  getConstants() {
    if (constants == null) {
      constants = NativeModules.DeviceInfo.getConstants();
    }
    return constants;
  },
};

export default NativeDeviceInfo;
