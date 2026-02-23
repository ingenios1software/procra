"use client";

import { useState, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Camera, Image as ImageIcon, Loader2, Trash2, AlertCircle } from 'lucide-react';
import Image from 'next/image';
import { useUser, useFirebaseApp } from '@/firebase';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';
import type { Foto } from '@/lib/types';

interface ImageUploadProps {
  onFileAdd: (file: Foto) => void;
  onFileRemove: (storagePath: string) => void;
  existingFiles: Foto[];
  eventoId: string;
  parcelaId: string;
}

interface UploadingFile {
  id: string;
  file: File;
  preview: string;
  progress: number;
  error?: string;
  storagePath?: string;
}

export function ImageUpload({ onFileAdd, onFileRemove, existingFiles, eventoId, parcelaId }: ImageUploadProps) {
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const { user } = useUser();
  const firebaseApp = useFirebaseApp();

  const compressImage = useCallback((file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = event => {
        const img = document.createElement('img');
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1600;
          const MAX_HEIGHT = 1600;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject('No se pudo obtener el contexto del canvas');
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(blob => {
            if (!blob) return reject('Error al comprimir la imagen');
            const newFile = new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() });
            resolve(newFile);
          }, 'image/jpeg', 0.7);
        };
      };
      reader.onerror = error => reject(error);
    });
  }, []);
  
  const uploadFile = useCallback((file: File, id: string): Promise<Foto> => {
    return new Promise((resolve, reject) => {
      if (!user || !firebaseApp) return reject('Usuario o Firebase no inicializado');
      
      const storage = getStorage(firebaseApp);
      const fileId = uuidv4();
      const storagePath = `events/${eventoId || 'temp-id'}/${fileId}-${file.name}`;
      const storageRef = ref(storage, storagePath);
      
      const uploadTask = uploadBytesResumable(storageRef, file, {
        customMetadata: {
          eventoId: eventoId || 'temp-id',
          parcelaId: parcelaId || 'temp-id',
          tecnico: user.uid,
        }
      });

      uploadTask.on('state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadingFiles(prev => prev.map(f => f.id === id ? { ...f, progress } : f));
        },
        (error) => {
          console.error("Upload error:", error);
          reject(error);
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          resolve({ url: downloadURL, storagePath: storagePath });
          setUploadingFiles(prev => prev.map(f => f.id === id ? { ...f, progress: 100 } : f));
        }
      );
    });
  }, [user, firebaseApp, eventoId, parcelaId]);

  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const newFiles: UploadingFile[] = files.map(file => ({
      id: uuidv4(),
      file,
      preview: URL.createObjectURL(file),
      progress: 0,
    }));
    
    setUploadingFiles(prev => [...prev, ...newFiles]);
    event.target.value = ''; // Reset input

    for (const uf of newFiles) {
      try {
        const compressedFile = await compressImage(uf.file);
        const uploadedFoto = await uploadFile(compressedFile, uf.id);
        onFileAdd(uploadedFoto);
        setUploadingFiles(prev => prev.map(f => f.id === uf.id ? { ...f, storagePath: uploadedFoto.storagePath } : f));
      } catch (error: any) {
        setUploadingFiles(prev => prev.map(f => f.id === uf.id ? { ...f, error: error.message } : f));
      }
    }
  }, [compressImage, onFileAdd, uploadFile]);

  const handleRemoveFile = (storagePath: string) => {
    // This function will be called for both uploading and existing files
    setUploadingFiles(prev => prev.filter(f => f.storagePath !== storagePath));
    onFileRemove(storagePath);
    // TODO: Add logic to delete from Firebase Storage if needed
  };

  const allFiles = [...existingFiles, ...uploadingFiles.filter(uf => uf.storagePath).map(uf => ({ url: uf.preview, storagePath: uf.storagePath! }))]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Button asChild variant="outline" className="h-20 flex-col gap-2 text-base">
          <label htmlFor="file-upload-camera">
            <Camera className="h-6 w-6" />
            Tomar Foto
            <input id="file-upload-camera" name="file-upload" type="file" className="sr-only" accept="image/*" capture="environment" onChange={handleFileSelect} />
          </label>
        </Button>
        <Button asChild variant="outline" className="h-20 flex-col gap-2 text-base">
          <label htmlFor="file-upload-gallery">
            <ImageIcon className="h-6 w-6" />
            Galería
            <input id="file-upload-gallery" name="file-upload" type="file" className="sr-only" accept="image/*" multiple onChange={handleFileSelect} />
          </label>
        </Button>
      </div>

      {(existingFiles.length + uploadingFiles.length) > 0 && (
        <ScrollArea>
          <div className="flex space-x-4 pb-4">
            {existingFiles.map(file => (
               <div key={file.storagePath} className="relative w-32 h-32 shrink-0">
                 <Image src={file.url} alt="preview" layout="fill" objectFit="cover" className="rounded-md" />
                 <Button variant="destructive" size="icon" className="absolute -top-2 -right-2 h-6 w-6 rounded-full" onClick={() => handleRemoveFile(file.storagePath)}>
                   <Trash2 className="h-4 w-4" />
                 </Button>
               </div>
            ))}
            {uploadingFiles.map(uf => (
              <div key={uf.id} className="relative w-32 h-32 shrink-0">
                <Image src={uf.preview} alt="preview" layout="fill" objectFit="cover" className="rounded-md" />
                {uf.storagePath && (
                  <Button variant="destructive" size="icon" className="absolute -top-2 -right-2 h-6 w-6 rounded-full" onClick={() => handleRemoveFile(uf.storagePath!)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-md">
                  {uf.progress < 100 && !uf.error && <Loader2 className="h-8 w-8 text-white animate-spin" />}
                  {uf.progress === 100 && <div className="text-white text-xs font-bold">OK</div>}
                  {uf.error && <AlertCircle className="h-8 w-8 text-destructive" />}
                </div>
                {uf.progress > 0 && uf.progress < 100 && (
                  <Progress value={uf.progress} className="absolute bottom-0 left-0 right-0 h-1 rounded-b-md" />
                )}
              </div>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      )}
    </div>
  );
}
