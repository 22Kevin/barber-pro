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

/** Remove a máscara e retorna apenas os dígitos */
export function stripMask(masked: string): string {
  return masked.replace(/\D/g, "");
}
