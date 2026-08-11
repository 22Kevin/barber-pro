// Substitui react-native-safe-area-context/src/specs/NativeSafeAreaView.ts
// (versão 5.6.2, a mesma pinada no projeto — conferido diretamente no pacote
// baixado do npm). É EXATAMENTE o mesmo código, só sem a sintaxe de tipos do
// TypeScript (generics, "import type", interface) — que não existe em tempo
// de execução mesmo no arquivo original (é só apagada na compilação). O
// comportamento real do componente nativo é idêntico ao original.
//
// Motivo: o arquivo .ts original quebra o parser do
// @react-native/babel-plugin-codegen no RN 0.81.x ("Cannot read properties
// of null (reading 'loc')"), mas esse .js simples não usa nada que dispare
// esse bug.
import codegenNativeComponent from "react-native/Libraries/Utilities/codegenNativeComponent";

export default codegenNativeComponent("RNCSafeAreaView", {
  interfaceOnly: true,
});
