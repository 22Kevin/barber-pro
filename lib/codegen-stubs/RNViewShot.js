// Substitui react-native-view-shot/src/RNViewShot.js (versão 4.0.3,
// conferido diretamente no pacote baixado do npm).
//
// O arquivo original tem um comentário "//@flow" no topo (o pacote inteiro
// é tipado com Flow, não TypeScript) e importa de ./specs/NativeRNViewShot
// (um arquivo de especificação de codegen — mesmo padrão dos outros já
// corrigidos). A combinação do parser de Flow com o wrapper de transformação
// do react-native-css-interop causa "More than one plugin attempted to
// override parsing" — mesmo problema já visto antes (e já corrigido) na
// versão .web.js desse mesmo pacote (ver VIEW_SHOT_WEB_STUB acima).
//
// Esta versão evita os dois problemas de uma vez: sem o pragma do Flow, e
// sem precisar importar o arquivo de especificação (usa NativeModules
// diretamente, que o React Native já resolve automaticamente pro
// TurboModule real "RNViewShot", registrado de verdade durante o build
// nativo — mesmo padrão usado nos outros TurboModules já corrigidos).
import { NativeModules } from "react-native";

export default NativeModules.RNViewShot;
