/**
 * State Pattern Implementation for Application Flow
 *
 * This implements a proper state machine for managing the application's
 * document processing workflow with type-safe state transitions.
 */

import type { ExtractedData } from "../gemini";
import type { FormData, SourceDocumentList } from "../formExtraction";
import type { ProgressEvent } from "../observers/ProcessingObserver";

// Valid page types in the application
export type PageType =
  | "home"
  | "upload"
  | "settings"
  | "loading"
  | "results"
  | "htmlsource"
  | "formdetection"
  | "traditionalform"
  | "toonconfirmation"
  | "debug";

// Context that holds application state data
export interface StateContext {
  currentPage: PageType;
  extractedData: ExtractedData | null;
  detectedFormData: FormData | null;
  detectedSourceDocuments: SourceDocumentList | null;
  progressCallback: ((event: ProgressEvent) => void) | null;
  error: string | null;
  uploadedFiles: Map<string, File> | null; // Track uploaded files by document type
  toonImportData?: Partial<ExtractedData> | null; // Data imported from TOON file
  toonExistingData?: Partial<ExtractedData> | null; // Existing form data before TOON import
}

// State interface - all states must implement this
export interface AppState {
  readonly name: PageType;

  // Allowed transitions from this state
  canTransitionTo(targetState: PageType): boolean;

  // Called when entering this state
  onEnter(context: StateContext): void;

  // Called when leaving this state
  onExit(context: StateContext): void;

  // Validate if the state has required data
  validate(context: StateContext): boolean;
}

// Abstract base class for states with common functionality
export abstract class BaseState implements AppState {
  abstract readonly name: PageType;
  protected allowedTransitions: PageType[] = [];

  canTransitionTo(targetState: PageType): boolean {
    return this.allowedTransitions.includes(targetState);
  }

  onEnter(context: StateContext): void {
    console.log(`Entering ${this.name} state`);
  }

  onExit(context: StateContext): void {
    console.log(`Exiting ${this.name} state`);
  }

  abstract validate(context: StateContext): boolean;
}

// HOME STATE
export class HomeState extends BaseState {
  readonly name: PageType = "home";

  constructor() {
    super();
    this.allowedTransitions = ["settings", "formdetection", "traditionalform", "htmlsource", "results", "debug"];
  }

  validate(context: StateContext): boolean {
    // Home state is always valid
    return true;
  }

  onEnter(context: StateContext): void {
    super.onEnter(context);
    // Clear any form detection data when returning to home
    context.detectedFormData = null;
    context.detectedSourceDocuments = null;
  }
}

// SETTINGS STATE
export class SettingsState extends BaseState {
  readonly name: PageType = "settings";

  constructor() {
    super();
    this.allowedTransitions = ["home"];
  }

  validate(context: StateContext): boolean {
    return true;
  }
}

// FORM DETECTION STATE
export class FormDetectionState extends BaseState {
  readonly name: PageType = "formdetection";

  constructor() {
    super();
    this.allowedTransitions = ["home", "upload", "settings"];
  }

  validate(context: StateContext): boolean {
    // Check if API key exists
    const apiKey = localStorage.getItem("gemini_api_key");
    if (!apiKey) {
      context.error = "API key not configured";
      return false;
    }
    return true;
  }

  onEnter(context: StateContext): void {
    super.onEnter(context);
    // Validate API key exists
    if (!this.validate(context)) {
      console.warn("Form detection requires API key");
    }
  }
}

// UPLOAD STATE
export class UploadState extends BaseState {
  readonly name: PageType = "upload";

  constructor() {
    super();
    this.allowedTransitions = ["home", "settings", "loading", "results"];
  }

  validate(context: StateContext): boolean {
    // Upload state should have form detection data
    return context.detectedFormData !== null;
  }

  onEnter(context: StateContext): void {
    super.onEnter(context);
    if (!this.validate(context)) {
      console.warn("Upload state entered without form detection data");
    }
  }
}

// LOADING/PROCESSING STATE
export class LoadingState extends BaseState {
  readonly name: PageType = "loading";

  constructor() {
    super();
    this.allowedTransitions = ["results", "upload"]; // Can go back to upload on error
  }

  validate(context: StateContext): boolean {
    // Loading state doesn't require progress callback - it's optional
    return true;
  }

  onEnter(context: StateContext): void {
    super.onEnter(context);
    console.log("Starting document processing...");
  }

  onExit(context: StateContext): void {
    super.onExit(context);
    // Clear progress callback when leaving
    context.progressCallback = null;
  }
}

// RESULTS STATE
export class ResultsState extends BaseState {
  readonly name: PageType = "results";

  constructor() {
    super();
    this.allowedTransitions = ["upload", "home"];
  }

  validate(context: StateContext): boolean {
    // Results state requires extracted data
    return context.extractedData !== null;
  }

  onEnter(context: StateContext): void {
    super.onEnter(context);
    if (!this.validate(context)) {
      console.error("Results state entered without extracted data!");
    }
  }

  onExit(context: StateContext): void {
    super.onExit(context);
    // Optionally clear extracted data when leaving results
    // context.extractedData = null;
  }
}

// HTML SOURCE STATE (Debug)
export class HTMLSourceState extends BaseState {
  readonly name: PageType = "htmlsource";

  constructor() {
    super();
    this.allowedTransitions = ["home"];
  }

  validate(context: StateContext): boolean {
    return true;
  }
}

// TRADITIONAL FORM STATE
export class TraditionalFormState extends BaseState {
  readonly name: PageType = "traditionalform";

  constructor() {
    super();
    this.allowedTransitions = ["home", "results", "toonconfirmation"];
  }

  validate(context: StateContext): boolean {
    // Traditional form doesn't require any pre-conditions
    return true;
  }

  onEnter(context: StateContext): void {
    super.onEnter(context);
    // Clear any previous form detection data since this is manual entry
    context.detectedFormData = null;
    context.detectedSourceDocuments = null;
  }
}

// DEBUG STATE
export class DebugState extends BaseState {
  readonly name: PageType = "debug";

  constructor() {
    super();
    this.allowedTransitions = ["home"];
  }

  validate(context: StateContext): boolean {
    return true;
  }
}

// TOON CONFIRMATION STATE
export class ToonConfirmationState extends BaseState {
  readonly name: PageType = "toonconfirmation";

  constructor() {
    super();
    this.allowedTransitions = ["traditionalform"];
  }

  validate(context: StateContext): boolean {
    // Must have both imported data and existing data
    return !!(context.toonImportData);
  }

  onEnter(context: StateContext): void {
    super.onEnter(context);
    if (!this.validate(context)) {
      console.error("Toon confirmation state entered without imported data!");
    }
  }

  onExit(context: StateContext): void {
    super.onExit(context);
    // Clear TOON data when leaving confirmation
    context.toonImportData = null;
    context.toonExistingData = null;
  }
}

/**
 * State Manager - Manages state transitions with validation
 */
export class StateManager {
  private states: Map<PageType, AppState> = new Map();
  private currentState: AppState;
  private context: StateContext;

  constructor(initialContext: StateContext) {
    this.context = initialContext;

    // Register all states
    this.registerState(new HomeState());
    this.registerState(new SettingsState());
    this.registerState(new FormDetectionState());
    this.registerState(new UploadState());
    this.registerState(new LoadingState());
    this.registerState(new ResultsState());
    this.registerState(new HTMLSourceState());
    this.registerState(new TraditionalFormState());
    this.registerState(new ToonConfirmationState());
    this.registerState(new DebugState());

    // Set initial state
    const initialState = this.states.get(initialContext.currentPage);
    if (!initialState) {
      throw new Error(`Invalid initial state: ${initialContext.currentPage}`);
    }
    this.currentState = initialState;
    this.currentState.onEnter(this.context);
  }

  private registerState(state: AppState): void {
    this.states.set(state.name, state);
  }

  /**
   * Transition to a new state with validation
   */
  transitionTo(targetPage: PageType): boolean {
    const targetState = this.states.get(targetPage);

    if (!targetState) {
      console.error(`Unknown state: ${targetPage}`);
      return false;
    }

    // Check if transition is allowed
    if (!this.currentState.canTransitionTo(targetPage)) {
      console.error(
        `Invalid transition from ${this.currentState.name} to ${targetPage}. ` +
        `Allowed transitions: ${this.getAllowedTransitions().join(", ")}`
      );
      return false;
    }

    // Validate target state
    const previousPage = this.context.currentPage;
    this.context.currentPage = targetPage;

    if (!targetState.validate(this.context)) {
      console.error(`Target state ${targetPage} validation failed: ${this.context.error}`);
      // Rollback
      this.context.currentPage = previousPage;
      return false;
    }

    // Perform transition
    this.currentState.onExit(this.context);
    this.currentState = targetState;
    this.currentState.onEnter(this.context);

    console.log(`✓ Transitioned to ${targetPage}`);
    return true;
  }

  /**
   * Get current state name
   */
  getCurrentState(): PageType {
    return this.currentState.name;
  }

  /**
   * Get allowed transitions from current state
   */
  getAllowedTransitions(): PageType[] {
    return Array.from(this.states.values())
      .map(state => state.name)
      .filter(name => this.currentState.canTransitionTo(name));
  }

  /**
   * Get the context (for reading state data)
   */
  getContext(): Readonly<StateContext> {
    return this.context;
  }

  /**
   * Update context data (use this instead of direct modification)
   */
  updateContext(updates: Partial<StateContext>): void {
    this.context = { ...this.context, ...updates };
  }

  /**
   * Check if current state is valid
   */
  validateCurrentState(): boolean {
    return this.currentState.validate(this.context);
  }
}
