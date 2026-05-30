"use client";

import { useCallback, useState } from "react";
import {
  type AddressInput as AddressInputType,
  type ValidatedAddress,
  US_STATES,
} from "@/types/listing";

interface AddressInputProps {
  value: AddressInputType;
  onChange: (address: AddressInputType) => void;
  onValidated: (validated: ValidatedAddress | null) => void;
  validatedAddress: ValidatedAddress | null;
  disabled?: boolean;
}

export function AddressInput({
  value,
  onChange,
  onValidated,
  validatedAddress,
  disabled = false,
}: AddressInputProps) {
  const [validationError, setValidationError] = useState<string | null>(null);

  const updateField = useCallback(
    (field: keyof AddressInputType, fieldValue: string) => {
      onChange({ ...value, [field]: fieldValue });
      onValidated(null);
      setValidationError(null);
    },
    [value, onChange, onValidated]
  );

  const validateAddress = useCallback(() => {
    const street = value.street.trim();
    const city = value.city.trim();
    const state = value.state;
    const zip5 = value.zip5.trim();

    if (!street) {
      setValidationError("Street address is required");
      return;
    }

    if (street.length < 5) {
      setValidationError("Street address is too short");
      return;
    }

    if (!city) {
      setValidationError("City is required");
      return;
    }

    if (city.length < 2) {
      setValidationError("City name is too short");
      return;
    }

    if (!state) {
      setValidationError("State is required");
      return;
    }

    if (!zip5) {
      setValidationError("ZIP code is required");
      return;
    }

    if (!/^\d{5}$/.test(zip5)) {
      setValidationError("ZIP code must be exactly 5 digits");
      return;
    }

    setValidationError(null);

    const validated: ValidatedAddress = {
      street: street.toUpperCase(),
      street2: value.street2.trim().toUpperCase(),
      city: city.toUpperCase(),
      state: state.toUpperCase(),
      zip5: zip5,
      zip4: "",
      is_valid: true,
      error: null,
    };

    onValidated(validated);
  }, [value, onValidated]);

  return (
    <div className="address-input-container">
      <div className="form-group">
        <label htmlFor="street" className="form-label">
          Street Address <span className="required">*</span>
        </label>
        <input
          type="text"
          id="street"
          value={value.street}
          onChange={(e) => updateField("street", e.target.value)}
          className="form-input"
          placeholder="123 Main St"
          disabled={disabled}
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="street2" className="form-label">
          Apt / Suite / Unit
        </label>
        <input
          type="text"
          id="street2"
          value={value.street2}
          onChange={(e) => updateField("street2", e.target.value)}
          className="form-input"
          placeholder="Apt 4B"
          disabled={disabled}
        />
      </div>

      <div className="form-row address-row">
        <div className="form-group city-group">
          <label htmlFor="city" className="form-label">
            City <span className="required">*</span>
          </label>
          <input
            type="text"
            id="city"
            value={value.city}
            onChange={(e) => updateField("city", e.target.value)}
            className="form-input"
            placeholder="Austin"
            disabled={disabled}
            required
          />
        </div>

        <div className="form-group state-group">
          <label htmlFor="state" className="form-label">
            State <span className="required">*</span>
          </label>
          <select
            id="state"
            value={value.state}
            onChange={(e) => updateField("state", e.target.value)}
            className="form-select"
            disabled={disabled}
            required
          >
            <option value="">Select...</option>
            {US_STATES.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group zip-group">
          <label htmlFor="zip5" className="form-label">
            ZIP Code <span className="required">*</span>
          </label>
          <input
            type="text"
            id="zip5"
            value={value.zip5}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, "").slice(0, 5);
              updateField("zip5", digits);
            }}
            className="form-input"
            placeholder="78701"
            maxLength={5}
            disabled={disabled}
            required
          />
        </div>
      </div>

      <div className="address-validation-actions">
        <button
          type="button"
          onClick={validateAddress}
          disabled={disabled}
          className="validate-address-btn"
        >
          Confirm Address
        </button>

        {validatedAddress && validatedAddress.is_valid && (
          <div className="validation-success">
            <CheckIcon />
            <span>
              Address verified: {formatValidatedAddress(validatedAddress)}
            </span>
          </div>
        )}

        {validationError && (
          <div className="validation-error">
            <AlertIcon />
            <span>{validationError}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function formatValidatedAddress(addr: ValidatedAddress): string {
  const parts = [addr.street];
  if (addr.street2) {
    parts.push(addr.street2);
  }
  const zip = addr.zip4 ? `${addr.zip5}-${addr.zip4}` : addr.zip5;
  parts.push(`${addr.city}, ${addr.state} ${zip}`);
  return parts.join(", ");
}

export function validatedAddressToJson(addr: ValidatedAddress): string {
  return JSON.stringify({
    street: addr.street,
    street2: addr.street2,
    city: addr.city,
    state: addr.state,
    zip5: addr.zip5,
    zip4: addr.zip4,
  });
}

function CheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}
