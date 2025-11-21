import { writeFileSync } from 'fs';
import path from 'path';

export function updateVersionFile() {
  const versionData = {
    version: '1.0.0',
    buildTimestamp: Date.now()
  };
  
  const versionPath = path.join(process.cwd(), 'client', 'public', 'version.json');
  
  try {
    writeFileSync(versionPath, JSON.stringify(versionData));
    console.log('✓ Version file updated');
  } catch (error) {
    console.error('Failed to update version file:', error);
  }
}
