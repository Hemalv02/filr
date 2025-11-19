import { Type } from "@google/genai";
import { DocumentProcessor } from "./DocumentProcessor";
import type { GoogleGenAI } from "@google/genai";
import type { ExtractedData } from "../gemini";

export class NIDProcessor extends DocumentProcessor {
  protected canProcess(file: File): boolean {
    const fileName = file.name.toLowerCase();
    const canProcess = (
      fileName.includes("nid") ||
      fileName.includes("national") ||
      fileName.includes("জাতীয়") ||
      fileName.includes("পরিচয়") ||
      fileName.includes("photo") // Added for generic photo names
    );
    console.log("🔵 NIDProcessor.canProcess:", file.name, "→", canProcess);
    return canProcess;
  }

  protected async process(
    file: File,
    ai: GoogleGenAI,
    model: string
  ): Promise<Partial<ExtractedData>> {
    console.log("🟢 NIDProcessor.process called for:", file.name);
    
    const prompt = `Extract information from this Bangladesh National ID Card (NID).

Focus on extracting:
- Full name in English and Bengali (নাম)
- Father's name in English and Bengali (পিতার নাম)
- Mother's name in English and Bengali (মাতার নাম)
- Date of birth in DD/MM/YYYY format (জন্ম তারিখ)
- Break down date into: birth_day (DD), birth_month (MM), birth_year (YYYY)
- NID number as parent_nid_number (জাতীয় পরিচয়পত্র নম্বর) - 10, 13, or 17 digit number
- Blood group (রক্তের গ্রুপ)
- Any address information (ঠিকানা)

For date of birth, if you find "13 Jan 2003" or "13/01/2003":
- date_of_birth: "13/01/2003"
- birth_day: "13"
- birth_month: "01"
- birth_year: "2003"

Return empty strings for fields not found.`;

    const schema = {
      type: Type.OBJECT,
      properties: {
        name_english: { type: Type.STRING },
        name_bengali: { type: Type.STRING },
        father_name_english: { type: Type.STRING },
        father_name_bengali: { type: Type.STRING },
        mother_name_english: { type: Type.STRING },
        mother_name_bengali: { type: Type.STRING },
        date_of_birth: { type: Type.STRING },
        birth_day: { type: Type.STRING },
        birth_month: { type: Type.STRING },
        birth_year: { type: Type.STRING },
        parent_nid_number: { type: Type.STRING },
        permanent_address: { type: Type.STRING },
      },
      propertyOrdering: [
        "name_english",
        "name_bengali",
        "father_name_english",
        "father_name_bengali",
        "mother_name_english",
        "mother_name_bengali",
        "date_of_birth",
        "birth_day",
        "birth_month",
        "birth_year",
        "parent_nid_number",
        "permanent_address",
      ],
    };

    return await this.uploadAndExtract(file, ai, model, prompt, schema);
  }
}
