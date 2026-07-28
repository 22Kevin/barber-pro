// Stub vazio de react-native-view-shot para a build web.
//
// Essa biblioteca so e usada em components/appointment-share-card.tsx (gerar
// uma imagem compartilhavel do agendamento) - um recurso que so faz sentido
// no celular (captura de tela nativa + folha de compartilhamento nativa).
//
// O arquivo .web.js que a propria biblioteca ja tras (RNViewShot.web.js) da
// erro de "More than one plugin attempted to override parsing" no pipeline
// de transformacao do react-native-css-interop especifico da build web -
// um conflito de plugins do Babel que nao conseguimos resolver ajustando a
// configuracao do projeto. Como o recurso nao roda de verdade na web mesmo,
// a solucao mais simples e nao empacotar a biblioteca nessa plataforma.
module.exports = {
  __esModule: true,
  default: function ViewShotStub() {
    return null;
  },
  captureRef: async () => {
    throw new Error("react-native-view-shot não está disponível na versão web.");
  },
  captureScreen: async () => {
    throw new Error("react-native-view-shot não está disponível na versão web.");
  },
};
