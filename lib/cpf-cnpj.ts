/**
 * Utilitários de validação de CPF e CNPJ com dígitos verificadores.
 * Usados no frontend (app mobile) e no backend (server).
 */

/**
 * Valida CPF com cálculo de dígitos verificadores.
 * Aceita CPF com ou sem formatação (pontos e traço).
 */
export function validateCPF(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return false;
  // Rejeitar sequências repetidas (000...000, 111...111, etc.)
  if (/^(\d)\1{10}$/.test(digits)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i);
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(digits[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i);
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  return remainder === parseInt(digits[10]);
}

/**
 * Valida CNPJ com cálculo de dígitos verificadores.
 * Aceita CNPJ com ou sem formatação.
 */
export function validateCNPJ(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, "");
  if (digits.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false;

  const calcDigit = (d: string, weights: number[]) => {
    let sum = 0;
    for (let i = 0; i < weights.length; i++) sum += parseInt(d[i]) * weights[i];
    const rem = sum % 11;
    return rem < 2 ? 0 : 11 - rem;
  };

  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  if (calcDigit(digits, w1) !== parseInt(digits[12])) return false;
  return calcDigit(digits, w2) === parseInt(digits[13]);
}

/**
 * Valida CPF ou CNPJ automaticamente com base no comprimento.
 */
export function validateCpfCnpj(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11) return validateCPF(digits);
  if (digits.length === 14) return validateCNPJ(digits);
  return false;
}

/**
 * Retorna mensagem de erro ou null se válido.
 */
export function cpfCnpjError(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 0) return "CPF ou CNPJ obrigatório.";
  if (digits.length < 11) return "CPF ou CNPJ incompleto.";
  if (digits.length === 11 && !validateCPF(digits)) return "CPF inválido. Verifique os dígitos.";
  if (digits.length > 11 && digits.length < 14) return "CNPJ incompleto.";
  if (digits.length === 14 && !validateCNPJ(digits)) return "CNPJ inválido. Verifique os dígitos.";
  if (digits.length > 14) return "CPF ou CNPJ com dígitos demais.";
  return null;
}
