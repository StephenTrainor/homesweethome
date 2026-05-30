/**
 * Parse and format address data for display.
 * Handles both JSON address format and legacy plain text addresses.
 */

interface AddressData {
  street: string;
  street2?: string;
  city: string;
  state: string;
  zip5: string;
  zip4?: string;
}

export function parseAddressJson(address: string): AddressData | null {
  try {
    const data = JSON.parse(address);
    if (
      typeof data === "object" &&
      data !== null &&
      typeof data.street === "string" &&
      typeof data.city === "string" &&
      typeof data.state === "string" &&
      typeof data.zip5 === "string"
    ) {
      return data as AddressData;
    }
    return null;
  } catch {
    return null;
  }
}

export function formatAddressForDisplay(address: string): string {
  const parsed = parseAddressJson(address);

  if (!parsed) {
    return address;
  }

  const parts = [parsed.street];

  if (parsed.street2) {
    parts.push(parsed.street2);
  }

  const zip = parsed.zip4 ? `${parsed.zip5}-${parsed.zip4}` : parsed.zip5;
  parts.push(`${parsed.city}, ${parsed.state} ${zip}`);

  return parts.join(", ");
}
