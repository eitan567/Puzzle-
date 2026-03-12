import React, { useCallback } from 'react';
import { Upload, Image as ImageIcon } from 'lucide-react';

interface ImageUploadProps {
  onImageUpload: (imageUrl: string) => void;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({ onImageUpload }) => {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          onImageUpload(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          onImageUpload(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  }, [onImageUpload]);

  return (
    <div 
      className="flex flex-col items-center justify-center w-full h-full p-8 border border-[#141414]/10 dark:border-white/10 rounded-3xl bg-white dark:bg-zinc-900 hover:shadow-xl transition-all cursor-pointer group"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      onClick={() => document.getElementById('fileInput')?.click()}
    >
      <input 
        type="file" 
        id="fileInput" 
        className="hidden" 
        accept="image/*" 
        onChange={handleFileChange}
      />
      <div className="w-16 h-16 bg-zinc-50 dark:bg-zinc-800 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
        <Upload className="w-8 h-8 text-zinc-600 dark:text-zinc-400" />
      </div>
      <h2 className="text-xl font-bold mb-1 text-[#141414] dark:text-zinc-100">Upload Image</h2>
      <p className="text-sm opacity-60 text-center dark:text-zinc-400">
        Drag and drop or click to browse
      </p>
      
      <div className="mt-6 flex gap-4">
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onImageUpload('https://picsum.photos/seed/puzzle1/1080/1920');
          }}
          className="px-4 py-2 bg-[#141414] dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl text-xs font-medium hover:opacity-90 transition-opacity flex items-center gap-2"
        >
          <ImageIcon className="w-3 h-3" />
          Try Sample
        </button>
      </div>
    </div>
  );
};
