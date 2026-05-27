import { seedFromBrowser } from './seedDatabase.js';

seedFromBrowser().then(() => {
  console.log('Finished!');
  process.exit(0);
}).catch(console.error);
