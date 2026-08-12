// Substitui @react-native-google-signin/google-signin/lib/module/spec/SignInButtonNativeComponent.ts
// (versão 16.1.2, conferido diretamente no pacote baixado do npm).
//
// Detalhe curioso desse pacote: a pasta "lib/module" deveria conter só
// JavaScript já compilado (sem tipos), mas esse arquivo especificamente
// ficou sem compilar nessa versão do pacote — ainda é TypeScript cru
// mesmo dentro da pasta de saída (o arquivo irmão, NativeGoogleSignin.js,
// está compilado normalmente). É esse .ts "esquecido" que o Metro resolve
// e que quebra o parser do codegen.
//
// Ver lib/codegen-stubs/NativeSafeAreaView.js para o motivo completo do
// uso de requireNativeComponent em vez de codegenNativeComponent.
import { requireNativeComponent } from "react-native";

export default requireNativeComponent("RNGoogleSigninButton");
