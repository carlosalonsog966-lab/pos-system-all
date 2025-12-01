// Script to reset frontend backend status cache
const fs = require('fs');
const path = require('path');

// Path to the api.ts file
const apiFile = path.join(__dirname, 'frontend/src/lib/api.ts');

// Read the current file
let content = fs.readFileSync(apiFile, 'utf8');

// Reset the backend status check to force re-evaluation
const modifiedContent = content.replace(
  /const\s+lastStatus\s*=\s*localStorage\.getItem\('__lastBackendStatus'\);/,
  'const lastStatus = null; // Force reset of backend status'
);

// Write the modified content back
fs.writeFileSync(apiFile, modifiedContent);

console.log('✅ Frontend backend status cache reset complete');
console.log('The frontend will now re-evaluate the backend status on next health check');