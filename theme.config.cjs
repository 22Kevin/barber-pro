/** @type {const} */
const themeColors = {
  // Cor primária: dourado premium (igual em ambos os temas)
  primary:    { light: '#C9A84C', dark: '#C9A84C' },

  // Fundo: branco marfim (claro) / preto profundo (escuro)
  background: { light: '#FAF8F5', dark: '#0A0A0A' },

  // Superfície: branco puro com leve sombra (claro) / superfície escura (escuro)
  surface:    { light: '#FFFFFF', dark: '#141414' },

  // Texto principal: quase preto (claro) / branco quente (escuro)
  foreground: { light: '#1A1008', dark: '#F5F5F0' },

  // Texto secundário: cinza quente (claro) / cinza médio (escuro)
  muted:      { light: '#6B5E4E', dark: '#888880' },

  // Bordas: bege acinzentado (claro) / borda sutil escura (escuro)
  border:     { light: '#E8E0D5', dark: '#2A2A2A' },

  // Segunda cor dominante: vinho/borgonha — clássico de barbearia premium
  // Usada como accent em botões secundários, badges e destaques no tema claro
  accent:     { light: '#7B2D3E', dark: '#9B3D52' },

  success:    { light: '#2E7D32', dark: '#4CAF50' },
  warning:    { light: '#E65100', dark: '#FF9800' },
  error:      { light: '#C62828', dark: '#F44336' },

  // Alias do primary (usado pelo tab bar)
  tint:       { light: '#C9A84C', dark: '#C9A84C' },
};

module.exports = { themeColors };
