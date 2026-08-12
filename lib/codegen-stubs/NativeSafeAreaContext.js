// Substitui react-native-safe-area-context/src/specs/NativeSafeAreaContext.ts
//
// v2: a v1 usava TurboModuleRegistry.get(...), que também é detectado pelo
// mesmo plugin de codegen (mesma família de problema do NativeSafeAreaView).
// Esta versão usa NativeModules — o mecanismo "clássico" do React Native
// pra acessar um módulo nativo pelo nome. Não aciona o plugin de codegen.
// O próprio React Native faz a ponte automaticamente para o TurboModule
// real registrado ("RNCSafeAreaContext"), em qualquer arquitetura.
import { NativeModules } from "react-native";

export default NativeModules.RNCSafeAreaContext;
