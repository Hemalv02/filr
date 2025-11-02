import { Type } from "@google/genai";
import { DocumentProcessor } from "./DocumentProcessor";
import type { GoogleGenAI } from "@google/genai";
import type { ExtractedData } from "../gemini";

export class UtilityBillProcessor extends DocumentProcessor {
  protected canProcess(file: File): boolean {
    const fileName = file.name.toLowerCase();
    return (
      fileName.includes("utility") ||
      fileName.includes("bill") ||
      fileName.includes("electricity") ||
      fileName.includes("gas") ||
      fileName.includes("water") ||
      fileName.includes("rent") ||
      fileName.includes("receipt") ||
      fileName.includes("বিদ্যুৎ") ||
      fileName.includes("গ্যাস") ||
      fileName.includes("ভাড়া")
    );
  }

  protected async process(
    file: File,
    ai: GoogleGenAI,
    model: string
  ): Promise<Partial<ExtractedData>> {
    const prompt = `Extract information from this Utility Bill, Rent Receipt, or Address Proof document.

This is for proof of residence in Bangladesh.

Focus on extracting:
- Current/billing address (ঠিকানা) - Complete address with house number, road, area, district
- Account number or customer number or meter number
- Any reference numbers on the bill

The address should be as complete as possible, including:
- House/Holding number
- Road/Street name
- Area/Locality
- Thana/Upazila
- District
- Postal code if available

Return empty strings for fields not found.`;

    const schema = {
      type: Type.OBJECT,
      properties: {
        current_address: { type: Type.STRING },
        utility_account_number: { type: Type.STRING },
      },
      propertyOrdering: ["current_address", "utility_account_number"],
    };

    return await this.uploadAndExtract(file, ai, model, prompt, schema);
  }
}
