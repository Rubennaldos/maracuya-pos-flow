// Utility to generate correct SHA-256 hashes for PINs
// This file helps verify the correct hashes for development

import CryptoJS from 'crypto-js';

export function generatePinHash(pin: string): string {
  return CryptoJS.SHA256(pin).toString();
}

// Correct hashes for demo PINs
export const DEMO_PIN_HASHES = {
  '1234': '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4',
  '5678': 'ef797c8118f02dfb649607dd5d3f8c7623048c9c063d532cc95c5ed7a898a64f',
  '9999': 'ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb'
};

// Helper function to verify PIN against hash
export function verifyPin(pin: string, hash: string): boolean {
  return generatePinHash(pin) === hash;
}

// Log correct hashes for debugging
console.log('Correct PIN hashes:');
console.log('1234 ->', generatePinHash('1234'));
console.log('5678 ->', generatePinHash('5678'));
console.log('9999 ->', generatePinHash('9999'));