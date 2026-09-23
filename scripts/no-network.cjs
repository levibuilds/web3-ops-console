const fs = require('node:fs');
globalThis.fetch = async () => {
  fs.appendFileSync(process.env.FETCH_MARKER, 'attempt\n');
  throw new Error('network attempted in demo mode');
};
