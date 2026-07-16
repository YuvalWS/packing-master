import strings from '$lib/strings.js';

const bagLabels: Record<string, string> = strings.view.bags;

export function bagLabel(bagId: string): string {
  return bagLabels[bagId] ?? bagId;
}
