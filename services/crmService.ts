
import type { QueueItem } from '../types';

// Mock CRM database with richer customer details
const crmDatabase: Record<string, Omit<QueueItem, 'id' | 'waitTime'>> = {
  'Sanchez, Elena': {
    callerName: 'Sanchez, Elena',
    priority: 'High',
    segment: 'Loyalty Gold',
    locale: 'en-US',
    intent: 'Flight Rebooking',
    sentiment: 'Negative',
    interactionHistory: [
      { date: '2024-07-10', summary: 'Inquired about baggage fees.' },
      { date: '2024-05-22', summary: 'Successfully rebooked flight.' },
    ],
  },
  'Tan, Miguel': {
    callerName: 'Tan, Miguel',
    priority: 'Normal',
    segment: 'Retail',
    locale: 'en-PH',
    intent: 'New Booking Inquiry',
    sentiment: 'Neutral+',
    interactionHistory: [
      { date: '2024-06-15', summary: 'First time caller inquiry.' },
    ],
  },
};

export class CrmService {
  /**
   * Fetches customer details from the mock CRM.
   * @param callerName The name of the caller to look up.
   * @returns A promise that resolves with the customer's data.
   */
  public static async getCustomerDetails(callerName: string): Promise<Partial<QueueItem>> {
    console.log(`Fetching CRM data for: ${callerName}`);
    // Simulate network delay for fetching data
    await new Promise(resolve => setTimeout(resolve, 300));

    const customerData = crmDatabase[callerName];
    if (customerData) {
      return customerData;
    }
    
    // Return a default object if the caller is not found in the CRM
    return {
      callerName,
      priority: 'Normal',
      segment: 'Unknown',
      locale: 'en',
      intent: 'General Inquiry',
      sentiment: 'Neutral+',
      interactionHistory: [],
    };
  }
}
