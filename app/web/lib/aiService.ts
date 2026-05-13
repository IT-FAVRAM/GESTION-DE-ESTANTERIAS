import { httpsCallable } from 'firebase/functions';
import { functions } from './firebaseV3';

export interface AssistantContextPayload {
  generatedAt: string;
  inventory: {
    totalUniqueItems: number;
    totalPlacements: number;
    occupiedLocations: number;
    totalLocations: number;
  };
  sections: Array<{
    section: string;
    uniqueItems: number;
    placements: number;
    occupancyRate: number;
    avgLeadTimeDays: number | null;
  }>;
  shelves: Array<{
    shelfCode: string;
    shelfName: string;
    section: string;
    placements: number;
    occupancyRate: number;
  }>;
  activeItems: Array<{
    articleCode: string;
    orderFab: string;
    shelfCode: string;
    section: string;
    locationIds: string[];
    daysInLocation: number;
  }>;
  staleItems: Array<{
    articleCode: string;
    orderFab: string;
    shelfCode: string;
    section: string;
    locationIds: string[];
    daysInLocation: number;
    repeatedPair: boolean;
  }>;
  repeatedPairs: Array<{
    articleCode: string;
    orderFab: string;
    shelfCode: string;
    section: string;
    locationIds: string[];
    placements: number;
  }>;
}

export interface AssistantAnswer {
  answer: string;
  model: string;
}

export interface LeadTimeReportingResult {
  generatedAt: string;
  totals: {
    completedCycles: number;
    averageLeadTimeDays: number | null;
  };
  bySection: Array<{
    section: string;
    completedCycles: number;
    averageLeadTimeDays: number;
  }>;
  byShelf: Array<{
    shelfCode: string;
    completedCycles: number;
    averageLeadTimeDays: number;
  }>;
}

export const askInventoryAssistant = async (
  question: string,
  context: AssistantContextPayload,
): Promise<AssistantAnswer> => {
  const callable = httpsCallable(functions, 'inventoryAssistant');
  const result = await callable({ question, context });
  return result.data as AssistantAnswer;
};

export const fetchLeadTimeReporting = async (): Promise<LeadTimeReportingResult> => {
  const callable = httpsCallable(functions, 'leadTimeReporting');
  const result = await callable({});
  return result.data as LeadTimeReportingResult;
};
