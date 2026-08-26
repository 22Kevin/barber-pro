// Substitui react-native/src/private/specs_DEPRECATED/components/RCTModalHostViewNativeComponent.js
// (versão 0.81.5, conferido diretamente no pacote baixado do npm). Esse é
// o componente interno usado pelo <Modal> do próprio React Native — usado
// de verdade pelo app, não é código morto (diferente do
// AndroidDrawerLayout/RCTInputAccessoryView, que continuam com stub vazio).
//
// Detalhe importante: o arquivo original tem "paperComponentName:
// 'RCTModalHostView'" — esse é o nome real do componente nativo na
// arquitetura antiga (Paper), diferente do nome "ModalHostView" usado na
// New Architecture. Como requireNativeComponent é a API da arquitetura
// antiga, precisa usar o nome do paperComponentName aqui, não o outro.
//
// Ver lib/codegen-stubs/NativeSafeAreaView.js para o motivo completo do
// uso de requireNativeComponent em vez de codegenNativeComponent.
import { requireNativeComponent } from "react-native";

export default requireNativeComponent("RCTModalHostView");
