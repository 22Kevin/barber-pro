/**
 * Subtle sound feedback for key actions.
 *
 * Placeholder scaffolding — não usa nenhuma biblioteca de áudio ainda (os
 * métodos abaixo são no-ops). Removido o uso de expo-audio que existia
 * aqui antes: o módulo registra um foreground service restrito via
 * BOOT_COMPLETED que quebra o app no Android 15+, e como esse recurso de
 * som nunca foi implementado de verdade (nenhum lugar do app chama essas
 * funções), não fazia sentido manter a dependência só por causa disso.
 * Se/quando o recurso de som for implementado, usar expo-av (mais estável
 * nesse quesito) ou revisar a versão do expo-audio nessa época.
 */

// For now use haptic as sound proxy — actual sound files would need assets
// This is the foundation when sound assets are added
export const sounds = {
  confirm: () => {}, // placeholder — add sound asset when ready
  error:   () => {},
  tap:     () => {},
};
