import { auth } from './firebase';

/**
 * Compresses a base64 image string to stay below the 1MB Firestore limit.
 * Resizes the image to a maximum dimension and converts to JPEG with quality.
 */
export async function compressImage(dataUrl: string, maxDimension = 1024, quality = 0.7): Promise<string> {
  // If it's already a small enough URL (e.g. external link), return it
  if (!dataUrl.startsWith('data:')) return dataUrl;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      // Resize if necessary
      if (width > height) {
        if (width > maxDimension) {
          height *= maxDimension / width;
          width = maxDimension;
        }
      } else {
        if (height > maxDimension) {
          width *= maxDimension / height;
          height = maxDimension;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      
      // Convert to JPEG with quality to reduce size
      const compressed = canvas.toDataURL('image/jpeg', quality);
      
      // Check if it's still too large (approx 1MB limit for Firestore doc)
      // Base64 is ~33% larger than binary, so 1MB limit is ~1.3MB base64 string
      if (compressed.length > 1000000) {
        // Try again with lower quality
        console.warn('Image still too large, re-compressing with lower quality');
        resolve(compressImage(dataUrl, maxDimension * 0.8, quality * 0.7));
      } else {
        resolve(compressed);
      }
    };
    img.onerror = (err) => reject(err);
    img.src = dataUrl;
  });
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
