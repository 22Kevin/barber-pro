// Stub para node_modules/react-native/src/private/components/virtualview/*.
//
// Esses arquivos internos do React Native (VirtualView.js e
// VirtualViewNativeComponent.js) usam sintaxe experimental do JavaScript
// (proposta de pattern matching "match (mode) { ... }") que o parser do
// Metro/babel-plugin-codegen ainda não entende no React Native 0.81.x —
// bug confirmado e reproduzido por outros desenvolvedores na mesma versão:
// github.com/facebook/metro/issues/1651 e /issues/1602.
//
// VirtualView é um componente oficialmente marcado como experimental 🧪
// (reactnative.dev/docs/virtualview) — o Barber Pro não usa ele em nenhum
// lugar do código. Só é puxado pro bundle porque o próprio pacote
// "react-native" reexporta esse componente no seu índice geral, mesmo sem
// ninguém usar. Redirecionar pra este stub vazio evita o crash de build
// sem remover nenhuma funcionalidade real do app.
module.exports = {};
