export type StoredUploadResult = {
  storageDriver: string;
  storageKey: string;
  fileName: string;
  fileUrl: string;
};

export interface OrderImageStorage {
  saveImage(input: {
    buffer: Buffer;
    fileName: string;
    mimeType: string;
  }): Promise<StoredUploadResult>;
  deleteObject(storageKey: string): Promise<void>;
}
