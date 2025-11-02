import { GoogleGenAI } from "@google/genai";
import { DocumentProcessor } from "./DocumentProcessor";
import { BirthCertificateProcessor } from "./BirthCertificateProcessor";
import { NIDProcessor } from "./NIDProcessor";
import { UtilityBillProcessor } from "./UtilityBillProcessor";
import { EducationCertificateProcessor } from "./EducationCertificateProcessor";
import { PassportProcessor } from "./PassportProcessor";
import type { ExtractedData } from "../gemini";
import { ProgressNotifier } from "../observers/ProcessingObserver";
import type { ProcessingObserver } from "../observers/ProcessingObserver";

export interface ProcessingResult {
  data: ExtractedData;
  errors: string[];
}

export class ProcessorChain {
  private chain: DocumentProcessor;
  private notifier: ProgressNotifier;

  constructor() {
    // Build the chain of processors
    const birthProcessor = new BirthCertificateProcessor();
    const nidProcessor = new NIDProcessor();
    const utilityProcessor = new UtilityBillProcessor();
    const educationProcessor = new EducationCertificateProcessor();
    const passportProcessor = new PassportProcessor();

    // Link processors together
    birthProcessor
      .setNext(nidProcessor)
      .setNext(utilityProcessor)
      .setNext(educationProcessor)
      .setNext(passportProcessor);

    this.chain = birthProcessor;
    this.notifier = new ProgressNotifier();
  }

  subscribe(observer: ProcessingObserver): void {
    this.notifier.subscribe(observer);
  }

  async processDocuments(
    files: File[],
    apiKey: string,
    model: string
  ): Promise<ProcessingResult> {
    const ai = new GoogleGenAI({ apiKey });

    // Initialize empty data structure
    let accumulatedData: Partial<ExtractedData> = {
      name_english: "",
      name_bengali: "",
      father_name_english: "",
      father_name_bengali: "",
      mother_name_english: "",
      mother_name_bengali: "",
      date_of_birth: "",
      birth_day: "",
      birth_month: "",
      birth_year: "",
      place_of_birth: "",
      birth_registration_number: "",
      sex: "",
      permanent_address: "",
      current_address: "",
      utility_account_number: "",
      education_board: "",
      ssc_roll_number: "",
      ssc_registration_number: "",
      ssc_passing_year: "",
      institution_name: "",
      parent_nid_number: "",
      parent_name: "",
      relation: "",
      passport_number: "",
      tin_number: "",
      driving_license_number: "",
    };

    const allErrors: string[] = [];

    // Process each file through the chain
    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Set progress notifier for this file
      this.chain.setProgressNotifier(this.notifier, i + 1, files.length);

      const result = await this.chain.handle(file, accumulatedData, ai, model);
      accumulatedData = result.data;
      allErrors.push(...result.errors);
    }

    return {
      data: accumulatedData as ExtractedData,
      errors: allErrors,
    };
  }
}
