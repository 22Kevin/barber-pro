// Substitui react-native-safe-area-context/src/specs/NativeSafeAreaView.ts
//
// v2: a v1 (usando codegenNativeComponent sem os tipos do TS) ainda
// disparava o @react-native/babel-plugin-codegen (ele detecta a CHAMADA
// codegenNativeComponent em qualquer arquivo, não só dentro de pastas
// específicas) e falhava com "Could not find component config for native
// component" por faltar a informação de tipos que o codegen precisa pra
// montar o schema.
//
// Esta versão usa requireNativeComponent — o mecanismo "clássico" do React
// Native pra obter um componente nativo pelo nome. Não aciona o plugin de
// codegen (é uma função diferente, sem relação com geração de schema) e
// continua funcionando normalmente: o componente nativo real ("RNCSafeAreaView")
// já foi registrado de verdade durante o build nativo (Gradle/CMake),
// independente do empacotamento do Metro — requireNativeComponent só
// busca esse componente já registrado pelo nome, em qualquer arquitetura
// (antiga ou nova/Fabric).
import { requireNativeComponent } from "react-native";

export default requireNativeComponent("RNCSafeAreaView");
