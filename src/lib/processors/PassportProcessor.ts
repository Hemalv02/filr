import { Type } from "@google/genai";
import { DocumentProcessor } from "./DocumentProcessor";
import type { GoogleGenAI } from "@google/genai";
import type { ExtractedData } from "../gemini";

export class PassportProcessor extends DocumentProcessor {
  protected canProcess(file: File): boolean {
    const fileName = file.name.toLowerCase();
    return (
      fileName.includes("passport") ||
      fileName.includes("driving") ||
      fileName.includes("license") ||
      fileName.includes("tin") ||
      fileName.includes("পাসপোর্ট") ||
      fileName.includes("লাইসেন্স")
    );
  }

  protected async process(
    file: File,
    ai: GoogleGenAI,
    model: string
  ): Promise<Partial<ExtractedData>> {
    const prompt = `Extract information from this identification document (Passport, Driving License, or TIN Certificate).

This is optional identification for age verification.

Focus on extracting:
- Passport number (পাসপোর্ট নম্বর) if this is a passport
- Driving license number (ড্রাইভিং লাইসেন্স নম্বর) if this is a driving license
- TIN number (টিআইএন নম্বর) if this is a TIN certificate

Look for:
- "Passport No." or "পাসপোর্ট নং"
- "Driving License No." or "DL No."
- "TIN" or "Taxpayer Identification Number"

Return empty strings for fields not found.`;

    const schema = {
      type: Type.OBJECT,
      properties: {
        passport_number: { type: Type.STRING },
        tin_number: { type: Type.STRING },
        driving_license_number: { type: Type.STRING },
      },
      propertyOrdering: ["passport_number", "driving_license_number", "tin_number"],
    };

    return await this.uploadAndExtract(file, ai, model, prompt, schema);
  }
}
