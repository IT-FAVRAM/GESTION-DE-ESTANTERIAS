import { getShelvesForSection } from './lib/schema/sections';

const sections = ['PLEGADORA', 'AUTOPLEGADORA', 'SOLDADURA'];

sections.forEach((section) => {
  const shelves = getShelvesForSection(section as any);
  console.log(`${section}: ${shelves.join(', ')}`);
});
