const fs = require('fs');
const path = require('path');

const placeholders = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'your-project.firebaseapp.com',
  projectId: 'your-project',
  storageBucket: 'your-project.appspot.com',
  messagingSenderId: '123456789',
  appId: 'your-app-id'
};

const envConfig = {
  apiKey: process.env.FIREBASE_API_KEY || '',
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.FIREBASE_APP_ID || ''
};

const hasEnvConfig = Object.values(envConfig).some((v) => String(v || '').trim().length > 0);
const finalConfig = hasEnvConfig
  ? { ...placeholders, ...envConfig }
  : placeholders;

const output = `window.firebaseConfig = ${JSON.stringify(finalConfig, null, 2)};\n`;
const targetPath = path.join(__dirname, '..', 'firebase-runtime-config.js');

fs.writeFileSync(targetPath, output, 'utf8');
console.log(`[build] wrote ${targetPath}`);
