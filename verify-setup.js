#!/usr/bin/env node
/**
 * Phase -1 Verification Script
 * Validates local development environment setup
 */

const fs = require('fs');
const path = require('path');

const checks = [];
const errors = [];

function check(name, condition, details = '') {
  if (condition) {
    checks.push(`✓ ${name}`);
  } else {
    errors.push(`✗ ${name}${details ? ': ' + details : ''}`);
  }
}

// Project Root
const root = process.cwd();
const hasPackageJson = fs.existsSync(path.join(root, 'package.json'));
const hasBackend = fs.existsSync(path.join(root, 'backend'));
const hasFrontend = fs.existsSync(path.join(root, 'frontend'));

check('Root package.json exists', hasPackageJson);
check('Backend folder exists', hasBackend);
check('Frontend folder exists', hasFrontend);

// Backend Setup
if (hasBackend) {
  const backendRoot = path.join(root, 'backend');
  check('Backend package.json', fs.existsSync(path.join(backendRoot, 'package.json')));
  check('Backend .env exists', fs.existsSync(path.join(backendRoot, '.env')));
  check('Backend .env.example exists', fs.existsSync(path.join(backendRoot, '.env.example')));
  check('Backend src/ folder', fs.existsSync(path.join(backendRoot, 'src')));
  check('Backend server.js', fs.existsSync(path.join(backendRoot, 'src', 'server.js')));
  check('Backend .eslintrc.json', fs.existsSync(path.join(backendRoot, '.eslintrc.json')));
  check('Backend seeds/', fs.existsSync(path.join(backendRoot, 'seeds')));
}

// Frontend Setup
if (hasFrontend) {
  const frontendRoot = path.join(root, 'frontend');
  check('Frontend package.json', fs.existsSync(path.join(frontendRoot, 'package.json')));
  check('Frontend .env exists', fs.existsSync(path.join(frontendRoot, '.env')));
  check('Frontend .env.example exists', fs.existsSync(path.join(frontendRoot, '.env.example')));
  check('Frontend src/ folder', fs.existsSync(path.join(frontendRoot, 'src')));
  check('Frontend .eslintrc.json', fs.existsSync(path.join(frontendRoot, '.eslintrc.json')));
}

// Documentation
check('SETUP.md guide exists', fs.existsSync(path.join(root, 'SETUP.md')));
check('phases.md exists', fs.existsSync(path.join(root, 'phases.md')));
check('PRD.md exists', fs.existsSync(path.join(root, 'PRD.md')));

// Output Results
console.log('\n▶ Phase -1 Setup Verification\n');
checks.forEach(c => console.log(c));

if (errors.length > 0) {
  console.log('\nErrors Found:');
  errors.forEach(e => console.log(e));
  process.exit(1);
} else {
  console.log('\n✓ All checks passed!\n');
  console.log('Next Steps:');
  console.log('1. Ensure MongoDB is running: mongod');
  console.log('2. Run: npm run dev');
  console.log('3. Backend health: http://localhost:5000/api/health');
  console.log('4. Frontend: http://localhost:3000\n');
}
