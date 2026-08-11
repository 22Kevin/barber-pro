// Substitui react-native-safe-area-context/src/specs/NativeSafeAreaContext.ts
// (versão 5.6.2, conferido diretamente no pacote baixado do npm). Mesmo
// comportamento real (é um TurboModule, não um componente visual), só sem a
// sintaxe de tipos do TypeScript. Ver NativeSafeAreaView.js (mesma pasta)
// para o motivo completo.
import { TurboModuleRegistry } from "react-native";

export default TurboModuleRegistry.get("RNCSafeAreaContext");
