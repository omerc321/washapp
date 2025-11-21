/**
 * Fee calculation utilities for CarWash Pro
 * Supports three fee package types with consistent VAT calculations
 */

export type FeePackageType = "custom" | "package1" | "package2";

export interface FeeCalculationInput {
  carWashPrice: number;
  feePackageType: FeePackageType;
  platformFee: number; // Custom amount for "custom" type, ignored for package1/package2
}

export interface FeeCalculationResult {
  carWashPrice: number;
  platformFeeAmount: number;
  subtotal: number; // carWash + platformFee
  vatAmount: number; // 5% of subtotal
  totalAmount: number; // subtotal + VAT
  displayBreakdown: string; // What to show customer
}

const VAT_RATE = 0.05; // 5% VAT

/**
 * Calculate all fees based on package type
 * 
 * Custom: platformFee is the custom amount (e.g., 3 AED)
 * Package1: 2 AED + 5% of car wash price
 * Package2: 0 AED (offline payment, only car wash + VAT)
 */
export function calculateFees(input: FeeCalculationInput): FeeCalculationResult {
  const { carWashPrice, feePackageType, platformFee } = input;
  
  let platformFeeAmount: number;
  
  switch (feePackageType) {
    case "custom":
      // Custom fee amount set by admin
      platformFeeAmount = platformFee;
      break;
      
    case "package1":
      // 2 AED + 5% of car wash price
      platformFeeAmount = 2 + (carWashPrice * 0.05);
      break;
      
    case "package2":
      // Offline payment - no platform fee charged to customer
      platformFeeAmount = 0;
      break;
      
    default:
      platformFeeAmount = platformFee;
  }
  
  // Round platform fee to 2 decimals
  platformFeeAmount = Math.round(platformFeeAmount * 100) / 100;
  
  // Calculate subtotal (car wash + platform fee)
  const subtotal = carWashPrice + platformFeeAmount;
  
  // Calculate VAT (5% of subtotal)
  const vatAmount = Math.round(subtotal * VAT_RATE * 100) / 100;
  
  // Calculate total
  const totalAmount = Math.round((subtotal + vatAmount) * 100) / 100;
  
  // Create display breakdown
  const displayBreakdown = `Company cost is ${subtotal.toFixed(2)} AED + VAT 5%`;
  
  return {
    carWashPrice,
    platformFeeAmount,
    subtotal,
    vatAmount,
    totalAmount,
    displayBreakdown,
  };
}

/**
 * Helper to get fee package display name
 */
export function getFeePackageDisplayName(type: FeePackageType): string {
  switch (type) {
    case "custom":
      return "Custom Fee";
    case "package1":
      return "Package 1 (2 AED + 5%)";
    case "package2":
      return "Package 2 (Offline Payment)";
    default:
      return "Unknown";
  }
}

/**
 * Helper to get fee package description
 */
export function getFeePackageDescription(type: FeePackageType, customAmount?: number): string {
  switch (type) {
    case "custom":
      return `Custom platform fee of ${customAmount?.toFixed(2) || "0.00"} AED + VAT`;
    case "package1":
      return "2 AED + 5% of car wash price + VAT";
    case "package2":
      return "Offline payment - company pays platform fees separately";
    default:
      return "";
  }
}
