import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getMock, postMock, putMock, deleteMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  putMock: vi.fn(),
  deleteMock: vi.fn(),
}));

vi.mock('../api/httpClient', () => ({
  default: {
    get: getMock,
    post: postMock,
    put: putMock,
    delete: deleteMock,
  },
}));

import api, {
  bedAPI,
  cultureAPI,
  fieldAPI,
  locationAPI,
  plantingPlanAPI,
  supplierAPI,
  seedDemandAPI,
} from '../api/api';

describe('API Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls all culture endpoints with expected URLs and payloads', () => {
    const cultureData = { name: 'Karotte' };
    const importPreviewData = [{ name: 'Tomate' }];
    const importApplyData = { items: importPreviewData, confirm_updates: true };

    cultureAPI.list();
    cultureAPI.get(7);
    cultureAPI.create(cultureData as never);
    cultureAPI.update(7, cultureData as never);
    cultureAPI.delete(7);
    cultureAPI.importPreview(importPreviewData);
    cultureAPI.importApply(importApplyData);

    expect(getMock).toHaveBeenCalledWith('/cultures/');
    expect(getMock).toHaveBeenCalledWith('/cultures/7/');
    expect(postMock).toHaveBeenCalledWith('/cultures/', cultureData);
    expect(putMock).toHaveBeenCalledWith('/cultures/7/', cultureData);
    expect(deleteMock).toHaveBeenCalledWith('/cultures/7/');
    expect(postMock).toHaveBeenCalledWith('/cultures/import/preview/', importPreviewData);
    expect(postMock).toHaveBeenCalledWith('/cultures/import/apply/', importApplyData);
  });

  it('calls supplier endpoints and handles optional query params', () => {
    const supplierData = { id: 1, name: 'Biohof' };

    supplierAPI.list();
    supplierAPI.list('bio');
    supplierAPI.get(1);
    supplierAPI.create('Neuer Lieferant');
    supplierAPI.update(1, supplierData as never);
    supplierAPI.delete(1);

    expect(getMock).toHaveBeenCalledWith('/suppliers/', { params: {} });
    expect(getMock).toHaveBeenCalledWith('/suppliers/', { params: { q: 'bio' } });
    expect(getMock).toHaveBeenCalledWith('/suppliers/1/');
    expect(postMock).toHaveBeenCalledWith('/suppliers/', { name: 'Neuer Lieferant' });
    expect(putMock).toHaveBeenCalledWith('/suppliers/1/', supplierData);
    expect(deleteMock).toHaveBeenCalledWith('/suppliers/1/');
  });

  it('calls bed endpoints', () => {
    const bedData = { name: 'Beet A' };

    bedAPI.list();
    bedAPI.get(3);
    bedAPI.create(bedData as never);
    bedAPI.update(3, bedData as never);
    bedAPI.delete(3);

    expect(getMock).toHaveBeenCalledWith('/beds/');
    expect(getMock).toHaveBeenCalledWith('/beds/3/');
    expect(postMock).toHaveBeenCalledWith('/beds/', bedData);
    expect(putMock).toHaveBeenCalledWith('/beds/3/', bedData);
    expect(deleteMock).toHaveBeenCalledWith('/beds/3/');
  });

  it('calls planting plan endpoints', () => {
    const planData = { name: 'Frühjahr' };

    plantingPlanAPI.list();
    plantingPlanAPI.get(4);
    plantingPlanAPI.create(planData as never);
    plantingPlanAPI.update(4, planData as never);
    plantingPlanAPI.delete(4);

    expect(getMock).toHaveBeenCalledWith('/planting-plans/');
    expect(getMock).toHaveBeenCalledWith('/planting-plans/4/');
    expect(postMock).toHaveBeenCalledWith('/planting-plans/', planData);
    expect(putMock).toHaveBeenCalledWith('/planting-plans/4/', planData);
    expect(deleteMock).toHaveBeenCalledWith('/planting-plans/4/');
  });

  it('calls field and location endpoints', () => {
    const fieldData = { name: 'Feld 1' };
    const locationData = { name: 'Nord' };

    fieldAPI.list();
    fieldAPI.get(5);
    fieldAPI.create(fieldData as never);
    fieldAPI.update(5, fieldData as never);
    fieldAPI.delete(5);

    locationAPI.list();
    locationAPI.get(9);
    locationAPI.create(locationData as never);
    locationAPI.update(9, locationData as never);
    locationAPI.delete(9);

    expect(getMock).toHaveBeenCalledWith('/fields/');
    expect(getMock).toHaveBeenCalledWith('/fields/5/');
    expect(postMock).toHaveBeenCalledWith('/fields/', fieldData);
    expect(putMock).toHaveBeenCalledWith('/fields/5/', fieldData);
    expect(deleteMock).toHaveBeenCalledWith('/fields/5/');

    expect(getMock).toHaveBeenCalledWith('/locations/');
    expect(getMock).toHaveBeenCalledWith('/locations/9/');
    expect(postMock).toHaveBeenCalledWith('/locations/', locationData);
    expect(putMock).toHaveBeenCalledWith('/locations/9/', locationData);
    expect(deleteMock).toHaveBeenCalledWith('/locations/9/');
  });


  it('calls seed demand endpoint', () => {
    seedDemandAPI.list();

    expect(getMock).toHaveBeenCalledWith('/seed-demand/');
  });

  it('exports grouped default API object', () => {
    expect(api.cultures).toBe(cultureAPI);
    expect(api.suppliers).toBe(supplierAPI);
    expect(api.beds).toBe(bedAPI);
    expect(api.plantingPlans).toBe(plantingPlanAPI);
    expect(api.fields).toBe(fieldAPI);
    expect(api.locations).toBe(locationAPI);
    expect(api.seedDemand).toBe(seedDemandAPI);
  });
});
