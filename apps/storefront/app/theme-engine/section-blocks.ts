import type { SectionInstance } from '@shoppp/contracts';

export const visibleBlockId = (section: SectionInstance, type: string, index = 0) =>
  section.blocks.filter(block => block.visible && block.type === type)[index]?.id;
