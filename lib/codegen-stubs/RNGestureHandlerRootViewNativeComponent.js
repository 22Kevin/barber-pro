// Substitui react-native-gesture-handler/src/specs/
// RNGestureHandlerRootViewNativeComponent.ts (versão 2.28.0, conferido
// diretamente no pacote baixado do npm). É EXATAMENTE o mesmo código, só
// sem a sintaxe de tipos do TypeScript (generic <NativeProps>, "import
// type", interface) — que não existe em tempo de execução mesmo no arquivo
// original. O comportamento real do componente nativo é idêntico.
//
// Este é o componente raiz que envolve o app inteiro (GestureHandlerRootView)
// — por isso a atenção extra em manter o comportamento exatamente igual ao
// original, em vez de um stub vazio.
import codegenNativeComponent from "react-native/Libraries/Utilities/codegenNativeComponent";

export default codegenNativeComponent("RNGestureHandlerRootView");
