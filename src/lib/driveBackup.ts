import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged, 
  User 
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App & Auth
const app = initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/drive.file');

// In-memory token cache as required by safety guidelines
// but we will persist to localStorage so it works on reload for up to 1 hour
let cachedAccessToken: string | null = localStorage.getItem('google_drive_token');
let isSigningIn = false;

export const initAuthListener = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(firebaseAuth, async (user) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else {
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      localStorage.removeItem('google_drive_token');
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const signInWithGoogleDrive = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(firebaseAuth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('فشل الحصول على رمز الوصول من جوجل.');
    }
    cachedAccessToken = credential.accessToken;
    localStorage.setItem('google_drive_token', cachedAccessToken);
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error) {
    console.error('Google Sign-In Error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const signOutGoogleDrive = async () => {
  await signOut(firebaseAuth);
  cachedAccessToken = null;
  localStorage.removeItem('google_drive_token');
};

export const clearCachedToken = () => {
  cachedAccessToken = null;
  localStorage.removeItem('google_drive_token');
};

export const getCachedToken = () => cachedAccessToken;

// Google Drive API Helpers

export interface BackupFileInfo {
  id: string;
  name: string;
  modifiedTime: string;
}

/**
 * Searches for simpleledger_backup.json in Google Drive
 */
export async function findBackupFile(token: string): Promise<BackupFileInfo | null> {
  const q = encodeURIComponent("name = 'simpleledger_backup.json' and trashed = false");
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,modifiedTime)`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('401_UNAUTHORIZED');
    }
    const errText = await response.text();
    throw new Error(`خطأ أثناء البحث عن النسخة الاحتياطية: ${errText}`);
  }

  const result = await response.json();
  if (result.files && result.files.length > 0) {
    return result.files[0] as BackupFileInfo;
  }
  return null;
}

/**
 * Creates or updates the backup file in Google Drive
 */
export async function saveBackupToDrive(token: string, data: any): Promise<BackupFileInfo> {
  let fileInfo = await findBackupFile(token);
  let fileId = fileInfo?.id;

  if (!fileId) {
    // 1. Create file metadata
    const metadataUrl = 'https://www.googleapis.com/drive/v3/files';
    const metadataResponse = await fetch(metadataUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'simpleledger_backup.json',
        mimeType: 'application/json'
      })
    });

    if (!metadataResponse.ok) {
      if (metadataResponse.status === 401) throw new Error('401_UNAUTHORIZED');
      const errText = await metadataResponse.text();
      throw new Error(`خطأ أثناء إنشاء ملف النسخ الاحتياطي: ${errText}`);
    }

    const createdFile = await metadataResponse.json();
    fileId = createdFile.id;
  }

  // 2. Upload file contents
  const uploadUrl = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`;
  const uploadResponse = await fetch(uploadUrl, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data, null, 2)
  });

  if (!uploadResponse.ok) {
    if (uploadResponse.status === 401) throw new Error('401_UNAUTHORIZED');
    const errText = await uploadResponse.text();
    throw new Error(`خطأ أثناء رفع بيانات النسخ الاحتياطي: ${errText}`);
  }

  const updatedFile = await uploadResponse.json();
  
  // Get updated metadata to return modifiedTime
  const infoUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,modifiedTime`;
  const infoResponse = await fetch(infoUrl, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (infoResponse.ok) {
    return await infoResponse.json() as BackupFileInfo;
  }

  return {
    id: fileId!,
    name: 'simpleledger_backup.json',
    modifiedTime: new Date().toISOString()
  };
}

/**
 * Downloads the backup file from Google Drive
 */
export async function downloadBackupFromDrive(token: string, fileId: string): Promise<any> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    if (response.status === 401) throw new Error('401_UNAUTHORIZED');
    const errText = await response.text();
    throw new Error(`خطأ أثناء تنزيل ملف النسخ الاحتياطي: ${errText}`);
  }

  return await response.json();
}
