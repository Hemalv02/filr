import { Type } from "@google/genai";
import { DocumentProcessor } from "./DocumentProcessor";
import type { GoogleGenAI } from "@google/genai";
import type { ExtractedData } from "../gemini";

export class NIDProcessor extends DocumentProcessor {
  protected canProcess(file: File): boolean {
    const fileName = file.name.toLowerCase();
    return (
      fileName.includes("nid") ||
      fileName.includes("national") ||
      fileName.includes("জাতীয়") ||
      fileName.includes("পরিচয়")
    );
  }

  protected async process(
    file: File,
    ai: GoogleGenAI,
    model: string
  ): Promise<Partial<ExtractedData>> {
    const prompt = `Extract information from this Bangladesh National ID Card (NID).

This is a parent's or spouse's NID card for reference in the applicant's NID application.

Focus on extracting:
- NID number (জাতীয় পরিচয়পত্র নম্বর) - 10, 13, or 17 digit number
- Full name of the NID holder (নাম)
- Relationship to applicant (father/mother/spouse/husband/wife)

If you can determine the relationship from context or the document type:
- Look for words like "Father", "Mother", "Spouse", "পিতা", "মাতা", "স্বামী", "স্ত্রী"
- If it's labeled as father's NID, set relation as "Father"
- If it's labeled as mother's NID, set relation as "Mother"

Return empty strings for fields not found.`;

    const schema = {
      type: Type.OBJECT,
      properties: {
        parent_nid_number: { type: Type.STRING },
        parent_name: { type: Type.STRING },
        relation: { type: Type.STRING },
      },
      propertyOrdering: ["parent_nid_number", "parent_name", "relation"],
    };

    return await this.uploadAndExtract(file, ai, model, prompt, schema);
  }
}
