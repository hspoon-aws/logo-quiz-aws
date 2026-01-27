#!/usr/bin/env npx tsx
/**
 * Script to download and update AWS Architecture Icons
 * This fetches the latest AWS Asset Package and extracts the Architecture-Service-Icons
 *
 * Usage:
 *   npx tsx scripts/update-aws-icons.ts
 *   npm run update:icons
 */

import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const AWS_ICONS_PAGE = 'https://aws.amazon.com/architecture/icons/';
const ASSETS_DIR = path.join(__dirname, '..', 'apps', 'logo-quiz', 'public', 'assets');
const ICONS_DIR = path.join(ASSETS_DIR, 'Architecture-Service-Icons');
const TEMP_DIR = '/tmp/aws-icons-update';

async function fetchPage(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        // Handle redirect
        fetchPage(res.headers.location!).then(resolve).catch(reject);
        return;
      }

      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        fs.unlinkSync(destPath);
        downloadFile(res.headers.location!, destPath).then(resolve).catch(reject);
        return;
      }

      res.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlinkSync(destPath);
      reject(err);
    });
  });
}

async function getLatestAssetUrl(): Promise<string> {
  console.log('==> Fetching latest AWS Asset Package URL...');
  const html = await fetchPage(AWS_ICONS_PAGE);

  const match = html.match(/https:\/\/[^"]+Asset-Package[^"]+\.zip/);
  if (!match) {
    throw new Error('Could not find Asset Package URL on AWS page');
  }

  return match[0];
}

function getVersionFromUrl(url: string): string {
  const match = url.match(/Asset-Package_(\d+)/);
  return match ? match[1] : 'unknown';
}

function getCurrentVersion(): string | null {
  const versionFile = path.join(ICONS_DIR, '.version');
  if (fs.existsSync(versionFile)) {
    return fs.readFileSync(versionFile, 'utf-8').trim();
  }
  return null;
}

function saveVersion(version: string): void {
  const versionFile = path.join(ICONS_DIR, '.version');
  fs.writeFileSync(versionFile, version);
}

async function updateIcons(force = false): Promise<boolean> {
  try {
    const assetUrl = await getLatestAssetUrl();
    const newVersion = getVersionFromUrl(assetUrl);
    const currentVersion = getCurrentVersion();

    console.log(`==> Latest version: ${newVersion}`);
    console.log(`==> Current version: ${currentVersion || 'none'}`);

    if (!force && currentVersion === newVersion) {
      console.log('==> Icons are already up to date!');
      return false;
    }

    console.log(`==> Found Asset Package URL: ${assetUrl}`);

    // Create temp directory
    if (fs.existsSync(TEMP_DIR)) {
      fs.rmSync(TEMP_DIR, { recursive: true });
    }
    fs.mkdirSync(TEMP_DIR, { recursive: true });

    const zipPath = path.join(TEMP_DIR, 'aws-icons.zip');

    console.log('==> Downloading Asset Package...');
    await downloadFile(assetUrl, zipPath);

    console.log('==> Extracting Architecture-Service-Icons...');
    // Use unzip command to extract
    execSync(`unzip -q "${zipPath}" 'Architecture-Service-Icons_*/*' -x '__MACOSX/*'`, {
      cwd: TEMP_DIR,
    });

    // Find extracted folder
    const extractedDirs = fs.readdirSync(TEMP_DIR).filter(f =>
      f.startsWith('Architecture-Service-Icons_') &&
      fs.statSync(path.join(TEMP_DIR, f)).isDirectory()
    );

    if (extractedDirs.length === 0) {
      throw new Error('Could not find extracted Architecture-Service-Icons folder');
    }

    const extractedDir = path.join(TEMP_DIR, extractedDirs[0]);
    console.log(`==> Found extracted folder: ${extractedDirs[0]}`);

    // Backup existing icons
    const backupDir = `${ICONS_DIR}.bak`;
    if (fs.existsSync(ICONS_DIR)) {
      console.log('==> Backing up existing icons...');
      if (fs.existsSync(backupDir)) {
        fs.rmSync(backupDir, { recursive: true });
      }
      fs.renameSync(ICONS_DIR, backupDir);
    }

    // Move new icons
    console.log(`==> Installing new icons to ${ICONS_DIR}...`);
    fs.renameSync(extractedDir, ICONS_DIR);

    // Save version
    saveVersion(newVersion);

    // Clean up
    console.log('==> Cleaning up...');
    fs.rmSync(TEMP_DIR, { recursive: true });
    if (fs.existsSync(backupDir)) {
      fs.rmSync(backupDir, { recursive: true });
    }

    // Count icons
    const countIcons = (dir: string): number => {
      let count = 0;
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const fullPath = path.join(dir, item);
        if (fs.statSync(fullPath).isDirectory()) {
          count += countIcons(fullPath);
        } else if (item.endsWith('.png')) {
          count++;
        }
      }
      return count;
    };

    const iconCount = countIcons(ICONS_DIR);
    console.log(`==> Done! Installed ${iconCount} PNG icons`);
    console.log(`==> Asset Package version: ${newVersion}`);

    return true;
  } catch (error) {
    console.error('ERROR:', error);
    throw error;
  }
}

// Export for programmatic use
export { updateIcons, getLatestAssetUrl, getCurrentVersion };

// Run if called directly
if (require.main === module) {
  const force = process.argv.includes('--force') || process.argv.includes('-f');
  updateIcons(force)
    .then((updated) => {
      process.exit(updated ? 0 : 0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
