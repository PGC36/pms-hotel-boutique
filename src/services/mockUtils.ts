let forceError = false;

export async function simulateLatency(minMs = 300, maxMs = 600): Promise<void> {
  const min = Math.max(0, Math.min(minMs, maxMs));
  const max = Math.max(min, maxMs);
  const delay = min + Math.random() * (max - min);
  await new Promise<void>((resolve) => globalThis.setTimeout(resolve, delay));
}

function hasUrlErrorFlag(): boolean {
  return (
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('mockError') === 'true'
  );
}

export const mockUtils = {
  setForceError(value: boolean): void {
    forceError = value;
  },
  throwIfSimulatingError(message = 'Error simulado por la capa de servicios'): void {
    if (forceError || hasUrlErrorFlag()) throw new Error(message);
  },
};

export const { setForceError, throwIfSimulatingError } = mockUtils;
