declare module 'db-vendo-client' {
  interface Location {
    id: string;
    name: string;
    type: string;
  }

  interface Line {
    name: string;
    product: string;
  }

  interface Departure {
    line: Line;
    direction: string;
    delay: number | null;
    cancelled: boolean;
    when: string;
  }

  interface Journey {
    id: string;
    line: Line;
    direction: string;
  }

  interface JourneyResponse {
    journeys: Journey[];
  }

  interface Client {
    locations(query: string, options?: { results?: number }): Promise<Location[]>;
    departures(stationId: string, options?: { duration?: number }): Promise<Departure[]>;
    journeys(from: string, to: string, options?: any): Promise<JourneyResponse>;
  }

  export function createClient(profile: any, userAgent: string): Client;
}

declare module 'db-vendo-client/p/dbnav/index.js' {
  export const profile: any;
}
