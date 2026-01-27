const STORAGE_KEY = 'completedLogos';

export function getCompletedLogos(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function addCompletedLogo(logoId: string): void {
  const completed = getCompletedLogos();
  if (!completed.includes(logoId)) {
    completed.push(logoId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(completed));
  }
}

export function isLogoCompleted(logoId: string): boolean {
  return getCompletedLogos().includes(logoId);
}
