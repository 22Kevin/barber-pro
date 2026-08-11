// Substitui react-native-safe-area-context/src/specs/NativeSafeAreaProvider.ts
// (versão 5.6.2, conferido diretamente no pacote baixado do npm). Mesmo
// comportamento real, só sem a sintaxe de tipos do TypeScript. Ver
// NativeSafeAreaView.js (mesma pasta) para o motivo completo.
import codegenNativeComponent from "react-native/Libraries/Utilities/codegenNativeComponent";

export default codegenNativeComponent("RNCSafeAreaProvider");
