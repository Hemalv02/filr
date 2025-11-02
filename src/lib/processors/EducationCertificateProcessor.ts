import { Type } from "@google/genai";
import { DocumentProcessor } from "./DocumentProcessor";
import type { GoogleGenAI } from "@google/genai";
import type { ExtractedData } from "../gemini";

export class EducationCertificateProcessor extends DocumentProcessor {
  protected canProcess(file: File): boolean {
    const fileName = file.name.toLowerCase();
    return (
      fileName.includes("ssc") ||
      fileName.includes("education") ||
      fileName.includes("certificate") ||
      fileName.includes("marksheet") ||
      fileName.includes("transcript") ||
      fileName.includes("academic") ||
      fileName.includes("school") ||
      fileName.includes("এসএসসি") ||
      fileName.includes("শিক্ষা")
    );
  }

  protected async process(
    file: File,
    ai: GoogleGenAI,
    model: string
  ): Promise<Partial<ExtractedData>> {
    const prompt = `Extract information from this Bangladesh Education Certificate (SSC or equivalent).

This is for proof of education and age verification.

Focus on extracting:
- Education board name (শিক্ষা বোর্ড) - e.g., Dhaka Board, Chittagong Board, etc.
- Roll number (রোল নম্বর)
- Registration number (রেজিস্ট্রেশন নম্বর)
- Passing year (পাশের বছর) - 4 digit year
- Institution/School name (প্রতিষ্ঠানের নাম)

Look for:
- "Board of Intermediate and Secondary Education"
- "মাধ্যমিক ও উচ্চ মাধ্যমিক শিক্ষা বোর্ড"
- Roll No., Reg. No., Year
- School/College name

Return empty strings for fields not found.`;

    const schema = {
      type: Type.OBJECT,
      properties: {
        education_board: { type: Type.STRING },
        ssc_roll_number: { type: Type.STRING },
        ssc_registration_number: { type: Type.STRING },
        ssc_passing_year: { type: Type.STRING },
        institution_name: { type: Type.STRING },
      },
      propertyOrdering: [
        "education_board",
        "ssc_roll_number",
        "ssc_registration_number",
        "ssc_passing_year",
        "institution_name",
      ],
    };

    return await this.uploadAndExtract(file, ai, model, prompt, schema);
  }
}
