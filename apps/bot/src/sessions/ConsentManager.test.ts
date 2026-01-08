import { describe, it, expect, beforeEach } from 'vitest';
import { ConsentManager } from './ConsentManager';
import { promises as fs } from 'fs';
import * as path from 'path';

describe('ConsentManager', () => {
  let consentManager: ConsentManager;
  const testDataDir = './test-data';
  const consentFilePath = path.join(testDataDir, 'consents.json');

  beforeEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDataDir, { recursive: true, force: true });
    } catch (err) {
      // Ignore if doesn't exist
    }
    await fs.mkdir(testDataDir, { recursive: true });

    consentManager = new ConsentManager(testDataDir);
  });

  afterEach(async () => {
    // Clean up
    try {
      await fs.rm(testDataDir, { recursive: true, force: true });
    } catch (err) {
      // Ignore
    }
  });

  describe('initialize', () => {
    it('should initialize with empty consents when file does not exist', async () => {
      await consentManager.initialize();
      expect(consentManager.hasConsent('guild1', 'user1')).toBe(false);
    });

    it('should load existing consents from file', async () => {
      // Create a consent file
      const consents = [
        { guildId: 'guild1', userId: 'user1', consentedAt: Date.now() },
      ];
      await fs.writeFile(consentFilePath, JSON.stringify(consents));

      await consentManager.initialize();
      expect(consentManager.hasConsent('guild1', 'user1')).toBe(true);
    });
  });

  describe('grantConsent', () => {
    it('should grant consent for a user', async () => {
      await consentManager.initialize();
      await consentManager.grantConsent('guild1', 'user1');

      expect(consentManager.hasConsent('guild1', 'user1')).toBe(true);
    });

    it('should persist consent to file', async () => {
      await consentManager.initialize();
      await consentManager.grantConsent('guild1', 'user1');

      // Read file directly
      const data = await fs.readFile(consentFilePath, 'utf-8');
      const consents = JSON.parse(data);

      expect(consents).toHaveLength(1);
      expect(consents[0].guildId).toBe('guild1');
      expect(consents[0].userId).toBe('user1');
    });

    it('should record consent timestamp', async () => {
      await consentManager.initialize();
      const before = Date.now();

      await consentManager.grantConsent('guild1', 'user1');

      const consent = consentManager.getConsent('guild1', 'user1');
      expect(consent).toBeDefined();
      expect(consent!.consentedAt).toBeGreaterThanOrEqual(before);
    });
  });

  describe('revokeConsent', () => {
    it('should revoke consent for a user', async () => {
      await consentManager.initialize();
      await consentManager.grantConsent('guild1', 'user1');
      await consentManager.revokeConsent('guild1', 'user1');

      expect(consentManager.hasConsent('guild1', 'user1')).toBe(false);
    });

    it('should persist revocation to file', async () => {
      await consentManager.initialize();
      await consentManager.grantConsent('guild1', 'user1');
      await consentManager.revokeConsent('guild1', 'user1');

      // Read file directly
      const data = await fs.readFile(consentFilePath, 'utf-8');
      const consents = JSON.parse(data);

      expect(consents).toHaveLength(0);
    });
  });

  describe('hasConsent', () => {
    it('should return true for consented user', async () => {
      await consentManager.initialize();
      await consentManager.grantConsent('guild1', 'user1');

      expect(consentManager.hasConsent('guild1', 'user1')).toBe(true);
    });

    it('should return false for non-consented user', async () => {
      await consentManager.initialize();
      expect(consentManager.hasConsent('guild1', 'user1')).toBe(false);
    });

    it('should be guild-specific', async () => {
      await consentManager.initialize();
      await consentManager.grantConsent('guild1', 'user1');

      expect(consentManager.hasConsent('guild1', 'user1')).toBe(true);
      expect(consentManager.hasConsent('guild2', 'user1')).toBe(false);
    });
  });

  describe('getConsent', () => {
    it('should return consent record', async () => {
      await consentManager.initialize();
      await consentManager.grantConsent('guild1', 'user1');

      const consent = consentManager.getConsent('guild1', 'user1');
      expect(consent).toBeDefined();
      expect(consent!.guildId).toBe('guild1');
      expect(consent!.userId).toBe('user1');
      expect(consent!.consentedAt).toBeDefined();
    });

    it('should return undefined for non-existent consent', async () => {
      await consentManager.initialize();
      const consent = consentManager.getConsent('guild1', 'user1');
      expect(consent).toBeUndefined();
    });
  });
});
