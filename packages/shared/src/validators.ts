import { z } from "zod";

export function normalizeCpf(input: string): string {
  return (input || "").replace(/\D/g, "");
}

export function isValidCpf(cpf: string): boolean {
  const normalized = normalizeCpf(cpf);
  if (normalized.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(normalized)) return false;

  const calcDigit = (base: string, factor: number) => {
    let sum = 0;
    for (const char of base) {
      sum += Number(char) * factor;
      factor -= 1;
    }
    const result = (sum * 10) % 11;
    return result === 10 ? 0 : result;
  };

  const first = calcDigit(normalized.slice(0, 9), 10);
  const second = calcDigit(normalized.slice(0, 10), 11);
  return first === Number(normalized[9]) && second === Number(normalized[10]);
}

export function normalizePass6(input: string): string {
  return (input || "").replace(/\D/g, "").slice(0, 6);
}

export function isValidPass6(input: string): boolean {
  return normalizePass6(input).length === 6;
}

export const cpfSchema = z
  .string()
  .transform(normalizeCpf)
  .refine((value) => isValidCpf(value), "CPF inválido");

export const pass6Schema = z
  .string()
  .transform(normalizePass6)
  .refine((value) => value.length === 6, "Senha deve ter 6 dígitos");
