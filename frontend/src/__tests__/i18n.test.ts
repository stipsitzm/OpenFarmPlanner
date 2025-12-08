/**
 * Tests for i18n configuration and functionality
 */

import { describe, it, expect } from 'vitest';
import i18n from '../i18n';

describe('i18n Configuration', () => {
  it('should be configured with German as default language', () => {
    expect(i18n.language).toBe('de');
  });

  it('should load common translations', () => {
    const appName = i18n.t('common:appName');
    expect(appName).toBe('OpenFarmPlanner');
  });

  it('should load navigation translations', () => {
    const home = i18n.t('navigation:home');
    expect(home).toBe('Start');
    
    const locations = i18n.t('navigation:locations');
    expect(locations).toBe('Standorte');
  });

  it('should load page-specific translations', () => {
    const locationsTitle = i18n.t('locations:title');
    expect(locationsTitle).toBe('Standorte');
    
    const culturesTitle = i18n.t('cultures:title');
    expect(culturesTitle).toBe('Kulturen');
  });

  it('should support interpolation', () => {
    const harvestWindow = i18n.t('cultures:fields.harvestWindowValue', { first: 60, last: 90 });
    expect(harvestWindow).toBe('60–90 Tage nach der Aussaat');
  });

  it('should handle nested keys', () => {
    const addAction = i18n.t('common:actions.add');
    expect(addAction).toBe('Hinzufügen');
    
    const deleteAction = i18n.t('common:actions.delete');
    expect(deleteAction).toBe('Löschen');
  });

  it('should have all required namespaces', () => {
    const namespaces = ['common', 'navigation', 'home', 'locations', 'cultures', 'plantingPlans', 'tasks', 'fields', 'beds', 'hierarchy'];
    
    namespaces.forEach(ns => {
      expect(i18n.hasResourceBundle('de', ns)).toBe(true);
    });
  });
});
