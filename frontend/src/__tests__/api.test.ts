import { describe, it, expect } from 'vitest';
import { cultureAPI, bedAPI, plantingPlanAPI } from '../api/api';

describe('API Client', () => {
  it('has culture API methods', () => {
    expect(cultureAPI.list).toBeDefined();
    expect(cultureAPI.get).toBeDefined();
    expect(cultureAPI.create).toBeDefined();
    expect(cultureAPI.update).toBeDefined();
    expect(cultureAPI.delete).toBeDefined();
  });

  it('has bed API methods', () => {
    expect(bedAPI.list).toBeDefined();
    expect(bedAPI.get).toBeDefined();
    expect(bedAPI.create).toBeDefined();
    expect(bedAPI.update).toBeDefined();
    expect(bedAPI.delete).toBeDefined();
  });

  it('has planting plan API methods', () => {
    expect(plantingPlanAPI.list).toBeDefined();
    expect(plantingPlanAPI.get).toBeDefined();
    expect(plantingPlanAPI.create).toBeDefined();
    expect(plantingPlanAPI.update).toBeDefined();
    expect(plantingPlanAPI.delete).toBeDefined();
  });
});
