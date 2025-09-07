// Hook for handling image uploads and WebP conversion
import { useState, useCallback } from 'react';

export const useImageUpload = () => {
  const [isUploading, setIsUploading] = useState(false);

  const convertToWebP = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        // Calculate new dimensions (max 800px width)
        const maxWidth = 800;
        const ratio = Math.min(maxWidth / img.width, maxWidth / img.height);
        const newWidth = img.width * ratio;
        const newHeight = img.height * ratio;

        canvas.width = newWidth;
        canvas.height = newHeight;

        // Draw and compress
        ctx?.drawImage(img, 0, 0, newWidth, newHeight);
        
        // Convert to WebP with 0.7 quality
        const webpDataUrl = canvas.toDataURL('image/webp', 0.7);
        resolve(webpDataUrl);
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  }, []);

  const uploadImage = useCallback(async (file: File): Promise<string> => {
    setIsUploading(true);
    try {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        throw new Error('Please select an image file');
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('Image size must be less than 5MB');
      }

      const webpDataUrl = await convertToWebP(file);
      return webpDataUrl;
    } catch (error) {
      throw error;
    } finally {
      setIsUploading(false);
    }
  }, [convertToWebP]);

  return {
    uploadImage,
    isUploading
  };
};