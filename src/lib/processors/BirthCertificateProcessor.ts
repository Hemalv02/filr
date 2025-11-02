import { Type } from "@google/genai";
import { DocumentProcessor } from "./DocumentProcessor";
import type { GoogleGenAI } from "@google/genai";
import type { ExtractedData } from "../gemini";

export class BirthCertificateProcessor extends DocumentProcessor {
  protected canProcess(file: File): boolean {
    const fileName = file.name.toLowerCase();
    return (
      fileName.includes("birth") ||
      fileName.includes("জন্ম") ||
      fileName.includes("certificate")
    );
  }

  protected async process(
    file: File,
    ai: GoogleGenAI,
    model: string
  ): Promise<Partial<ExtractedData>> {
    const prompt = `Extract information from this Bangladesh Birth Certificate.

Focus on extracting:
- Full name in English and Bengali (নাম)
- Father's name in English and Bengali (পিতার নাম)
- Mother's name in English and Bengali (মাতার নাম)
- Date of birth in DD/MM/YYYY format
- Break down date into: birth_day (DD), birth_month (MM), birth_year (YYYY)
- Place of birth (জন্মস্থান)
- Birth registration number (জন্ম নিবন্ধন নম্বর)
- Sex/Gender (লিঙ্গ)
- Permanent address (স্থায়ী ঠিকানা)

For date of birth, if you find "15/06/1995":
- date_of_birth: "15/06/1995"
- birth_day: "15"
- birth_month: "06"
- birth_year: "1995"

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
        place_of_birth: { type: Type.STRING },
        birth_registration_number: { type: Type.STRING },
        sex: { type: Type.STRING },
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
        "place_of_birth",
        "birth_registration_number",
        "sex",
        "permanent_address",
      ],
    };

    return await this.uploadAndExtract(file, ai, model, prompt, schema);
  }
}
