import { inject, type InjectionKey } from "vue";
import type { SectionInstance } from '@shoppp/contracts';
import { visibleBlockId } from './section-blocks';

export const storefrontEditorModeKey = Symbol("storefront-editor-mode") as InjectionKey<boolean>;
export function useStorefrontEditorBlockId(section: () => SectionInstance) {
  const enabled = inject(storefrontEditorModeKey, false);
  return (type: string, index = 0) => enabled ? visibleBlockId(section(), type, index) : undefined;
}
