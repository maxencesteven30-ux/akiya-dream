import agencyServicesData from "@/data/agency_services.json";

export interface AgencyService {
  serviceId: string;
  providerCategory: string;
  serviceName: string;
  costType: string;
  priceMinJpy: number;
  priceMaxJpy: number;
  description: string;
}

const AGENCY_SERVICES = agencyServicesData as AgencyService[];

export function getAllAgencyServices(): AgencyService[] {
  return AGENCY_SERVICES;
}

export function getAgencyService(serviceId: string): AgencyService {
  const service = AGENCY_SERVICES.find((s) => s.serviceId === serviceId);
  if (!service) {
    throw new Error(`Service inconnu dans agency_services.json : ${serviceId}`);
  }
  return service;
}

// Milieu de la fourchette min/max du CSV : hypothèse de gestion explicite
// (pas une donnée mesurée pour un dossier précis), utilisée comme estimation
// représentative par lib/calculations.ts.
export function getAgencyServiceMidpoint(serviceId: string): number {
  const service = getAgencyService(serviceId);
  return Math.round((service.priceMinJpy + service.priceMaxJpy) / 2);
}
