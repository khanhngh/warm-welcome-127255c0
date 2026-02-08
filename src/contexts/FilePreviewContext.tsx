import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface FilePreviewItem {
  url: string;
  name: string;
  size?: number;
  filePath?: string; // storage path for "open in new tab" navigation
}

interface FilePreviewInfo {
  url: string;
  name: string;
  size?: number;
  filePath?: string;
  taskTitle?: string;
  taskId?: string;
  groupSlug?: string;
  taskSlug?: string;
  shareToken?: string; // for public/read-only routes
  siblingFiles?: FilePreviewItem[];
  activeIndex?: number; // which file in siblingFiles is currently shown
  source?: 'submission' | 'resource'; // to know how to build "open in new tab" URL
}

interface FilePreviewContextType {
  openPreview: (info: FilePreviewInfo) => void;
  closePreview: () => void;
  switchFile: (index: number, skipAutosave?: boolean) => void;
  previewInfo: FilePreviewInfo | null;
  isOpen: boolean;
  isSwitchingFile: boolean; // Flag to indicate file switch in progress
}

const FilePreviewContext = createContext<FilePreviewContextType | null>(null);

export function useFilePreview() {
  const ctx = useContext(FilePreviewContext);
  if (!ctx) throw new Error('useFilePreview must be used within FilePreviewProvider');
  return ctx;
}

export function FilePreviewProvider({ children }: { children: ReactNode }) {
  const [previewInfo, setPreviewInfo] = useState<FilePreviewInfo | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isSwitchingFile, setIsSwitchingFile] = useState(false);

  const openPreview = useCallback((info: FilePreviewInfo) => {
    setPreviewInfo(info);
    setIsOpen(true);
    setIsSwitchingFile(false);
  }, []);

  const closePreview = useCallback(() => {
    setIsOpen(false);
    setIsSwitchingFile(false);
    setTimeout(() => setPreviewInfo(null), 200);
  }, []);

  const switchFile = useCallback((index: number, skipAutosave = true) => {
    if (skipAutosave) {
      setIsSwitchingFile(true);
    }
    setPreviewInfo(prev => {
      if (!prev?.siblingFiles || !prev.siblingFiles[index]) return prev;
      const file = prev.siblingFiles[index];
      return {
        ...prev,
        url: file.url,
        name: file.name,
        size: file.size,
        filePath: file.filePath,
        activeIndex: index,
      };
    });
    // Reset flag after a short delay
    if (skipAutosave) {
      setTimeout(() => setIsSwitchingFile(false), 100);
    }
  }, []);

  return (
    <FilePreviewContext.Provider value={{ openPreview, closePreview, switchFile, previewInfo, isOpen, isSwitchingFile }}>
      {children}
    </FilePreviewContext.Provider>
  );
}
