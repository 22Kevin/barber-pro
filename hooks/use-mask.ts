/**
 * Funções de máscara para campos de formulário.
 * Uso: import { applyPhoneMask, applyDocumentMask, detectDocumentType } from "@/hooks/use-mask";
 */

/** Aplica máscara de telefone brasileiro: (99) 9999-9999 ou (99) 99999-9999 */
export function applyPhoneMask(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

/** Detecta se o documento é CPF (11 dígitos) ou CNPJ (14 dígitos) */
export function detectDocumentType(raw: string): "cpf" | "cnpj" | "unknown" {
  const digits = raw.replace(/\D/g, "");
  if (digits.length <= 11) return "cpf";
  return "cnpj";
}

/**
 * Aplica máscara de CPF (000.000.000-00) ou CNPJ (00.000.000/0001-00)
 * automaticamente conforme o número de dígitos digitados.
 */
export function applyDocumentMask(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 11) {
    // CPF: 000.000.000-00
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9)
      return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  }
  // CNPJ: 00.000.000/0001-00
  if (digits.length <= 12)
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

/** Aplica máscara de CEP brasileiro: XXXXX-XXX */
export function applyCepMask(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

/** Remove a máscara e retorna apenas os dígitos */
export function stripMask(masked: string): string {
  return masked.replace(/\D/g, "");
}

/**
 * Valida CPF usando o algoritmo de dígito verificador.
 * Retorna true se o CPF for válido.
 */
export function validateCPF(raw: string): boolean {
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 11) return false;
  // Rejeita sequências repetidas (ex: 111.111.111-11)
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
 * Valida CNPJ usando o algoritmo de dígito verificador.
 * Retorna true se o CNPJ for válido.
 */
export function validateCNPJ(raw: string): boolean {
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false;

  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(digits[i]) * weights1[i];
  let remainder = sum % 11;
  const d1 = remainder < 2 ? 0 : 11 - remainder;
  if (d1 !== parseInt(digits[12])) return false;

  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  sum = 0;
  for (let i = 0; i < 13; i++) sum += parseInt(digits[i]) * weights2[i];
  remainder = sum % 11;
  const d2 = remainder < 2 ? 0 : 11 - remainder;
  return d2 === parseInt(digits[13]);
}

/**
 * Valida CPF ou CNPJ automaticamente com base no número de dígitos.
 * Retorna true se válido, false se inválido, null se incompleto.
 */
export function validateDocument(raw: string): boolean | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11) return validateCPF(digits);
  if (digits.length === 14) return validateCNPJ(digits);
  return null; // ainda incompleto
}
