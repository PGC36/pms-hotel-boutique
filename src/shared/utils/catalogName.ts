const VOWELS = /[aeiouáéíóúü]/gi;

export function catalogNameError(value: string): string | null {
  const letters = value.normalize('NFC').match(/\p{L}/gu) ?? [];
  const normalized = letters.join('').toLocaleLowerCase('es');

  if (letters.length < 2) return 'Escribe un nombre con al menos dos letras.';
  if (/(.)\1{3}/u.test(normalized)) return 'Evita repetir la misma letra tantas veces.';
  if (/[^aeiouáéíóúü]{5}/u.test(normalized)) return 'Escribe un nombre fácil de reconocer.';
  if (letters.length > 2 && (normalized.match(VOWELS) ?? []).length / letters.length < 0.25) {
    return 'Revisa el nombre; parece que contiene letras al azar.';
  }
  return null;
}
