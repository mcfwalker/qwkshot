import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';

export async function getGitInfo() {
  try {
    // Get version from package.json
    const packageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8'));
    const version = packageJson.version;

    // Get current branch
    const branch = execSync('git branch --show-current').toString().trim();

    // Get environment
    const environment = process.env.NODE_ENV || 'development';

    return { version, branch, environment };
  } catch (error) {
    console.error('Error getting git info:', error);
    return {
      version: 'unknown',
      branch: 'unknown',
      environment: process.env.NODE_ENV || 'development'
    };
  }
} 