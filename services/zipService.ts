import JSZip from 'jszip';
import type { FileInfo } from '../types';

export const unzipFile = async (file: File): Promise<FileInfo[]> => {
  const zip = await JSZip.loadAsync(file);
  const files: FileInfo[] = [];

  const promises = Object.keys(zip.files).map(async (filename) => {
    const zipEntry = zip.files[filename];
    if (!zipEntry.dir) {
      try {
        const content = await zipEntry.async('string');
        files.push({ path: filename, content });
      } catch (e) {
        console.warn(`Could not read file ${filename} as text, skipping.`);
      }
    }
  });

  await Promise.all(promises);
  return files;
};
