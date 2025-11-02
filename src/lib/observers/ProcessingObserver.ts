export type ProcessingStatus = "uploading" | "processing" | "completed" | "error";

export interface ProgressEvent {
  fileName: string;
  status: ProcessingStatus;
  current: number;
  total: number;
  message?: string;
  error?: string;
}

export interface ProcessingObserver {
  onProgress(event: ProgressEvent): void;
}

export class ProgressNotifier {
  private observers: ProcessingObserver[] = [];

  subscribe(observer: ProcessingObserver): void {
    this.observers.push(observer);
  }

  unsubscribe(observer: ProcessingObserver): void {
    this.observers = this.observers.filter((obs) => obs !== observer);
  }

  notify(event: ProgressEvent): void {
    this.observers.forEach((observer) => observer.onProgress(event));
  }

  notifyUploading(fileName: string, current: number, total: number): void {
    this.notify({
      fileName,
      status: "uploading",
      current,
      total,
      message: `Uploading ${fileName}...`,
    });
  }

  notifyProcessing(fileName: string, current: number, total: number): void {
    this.notify({
      fileName,
      status: "processing",
      current,
      total,
      message: `Processing ${fileName}...`,
    });
  }

  notifyCompleted(fileName: string, current: number, total: number): void {
    this.notify({
      fileName,
      status: "completed",
      current,
      total,
      message: `${fileName} completed`,
    });
  }

  notifyError(fileName: string, error: string, current: number, total: number): void {
    this.notify({
      fileName,
      status: "error",
      current,
      total,
      message: `Error processing ${fileName}`,
      error,
    });
  }
}
