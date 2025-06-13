'use client';

import * as React from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UploadCloud, MessageSquare, Leaf, RotateCw, X, PlusCircle, Tag, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { getStorage, ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { useAuth } from '@/contexts/AuthContext';
import { Label } from '@/components/ui/label';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_FILES = 4;
const MAX_USER_SYMBOLS = 4;

// Resizing constants
const RESIZE_MAX_WIDTH = 1024;
const RESIZE_MAX_HEIGHT = 1024;
const RESIZE_MIME_TYPE = 'image/jpeg'; // Convert to JPEG for smaller size
const RESIZE_QUALITY = 0.8; // 80% quality for JPEG

// ***** START OF KEY CHANGES *****

// 1. Updated Zod schema for userSymbolNames: array of objects with a 'value' string
const teaLeafFormSchema = z.object({
  images: z
    .array(
      z.instanceof(File)
        .refine((file) => file.size <= MAX_FILE_SIZE, `Max file size for each image is 5MB.`)
        .refine(
          (file) => ACCEPTED_IMAGE_TYPES.includes(file.type),
          'Only .jpg, .jpeg, .png and .webp formats are accepted for each image.'
        )
    )
    .min(1, 'At least one image is required.')
    .max(MAX_FILES, `You can upload a maximum of ${MAX_FILES} images.`),
  question: z.string().max(300, "Question must be 300 characters or less.").optional(),
  userSymbolNames: z.array(z.object({ value: z.string() })), // <-- CHANGED: Array of objects
});

export type TeaLeafFormValues = z.infer<typeof teaLeafFormSchema>;
// TeaLeafFormValues will now be inferred as:
// {
//   images: File[];
//   question?: string;
//   userSymbolNames: { value: string }[];
// }

// ***** END OF KEY CHANGES *****


interface ImageUploadFormProps {
  onSubmit: (imageStorageUrls: string[], question?: string, userSymbolNames?: string[]) => Promise<void>;
  isLoading: boolean;
}

// Helper function for client-side image resizing
async function resizeImage(file: File, options: { maxWidth: number; maxHeight: number; mimeType: string; quality: number }): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width > options.maxWidth || height > options.maxHeight) {
        if (width / options.maxWidth > height / options.maxHeight) {
          height = Math.round(height * (options.maxWidth / width));
          width = options.maxWidth;
        } else {
          width = Math.round(width * (options.maxHeight / height));
          height = options.maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        URL.revokeObjectURL(img.src);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(img.src);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Canvas toBlob returned null'));
            return;
          }
          let newFileName = file.name;
          const lastDot = file.name.lastIndexOf('.');
          const nameWithoutExtension = lastDot > -1 ? file.name.substring(0, lastDot) : file.name;
          let extension = options.mimeType.split('/')[1] || 'jpg';
          if (extension === 'jpeg') extension = 'jpg'; // Common practice
          
          newFileName = `${nameWithoutExtension}.${extension}`;

          resolve(new File([blob], newFileName, {
            type: options.mimeType,
            lastModified: Date.now(),
          }));
        },
        options.mimeType,
        options.quality
      );
    };
    img.onerror = (err: unknown) => {
      URL.revokeObjectURL(img.src);
      reject(new Error(`Failed to load image for resizing: ${file.name}. Error: ${String(err)}`));
    };
  });
}


export function ImageUploadForm({ onSubmit, isLoading }: ImageUploadFormProps) {
  const form = useForm<TeaLeafFormValues>({
    resolver: zodResolver(teaLeafFormSchema),
    defaultValues: {
      images: [],
      question: '',
      userSymbolNames: [{ value: '' }], // <-- CHANGED: Initialize with an object for useFieldArray
    },
  });

  const { user } = useAuth();
  const [previews, setPreviews] = React.useState<string[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [uploadProgress, setUploadProgress] = React.useState<number | null>(null);
  const [isProcessingFiles, setIsProcessingFiles] = React.useState(false);

  // ***** START OF KEY CHANGES *****

  // 2. useFieldArray is now correctly typed and will work as expected with the object array
  const { fields: symbolFields, append: appendSymbol, remove: removeSymbol } = useFieldArray({
    control: form.control,
    name: "userSymbolNames", // <-- This will now correctly infer to an array of objects
  });

  // ***** END OF KEY CHANGES *****

  const imagesWatch = form.watch('images');

  React.useEffect(() => {
    const currentFiles = form.getValues('images');
    if (currentFiles && currentFiles.length > 0) {
      const newPreviewsPromises = currentFiles.map(file => {
        return new Promise<string>((resolve, reject) => {
          if (!(file instanceof File)) {
            reject(new Error(`Item for preview is not a File object: ${typeof file}`));
            return;
          }
          const reader = new FileReader();
          reader.onloadend = () => {
            if (reader.result) {
              resolve(reader.result as string);
            } else {
              reject(new Error(`FileReader result was null for file: ${file.name}.`));
            }
          };
          reader.onerror = () => {
            reject(reader.error || new Error(`Failed to read file "${file.name}" for preview.`));
          };
          reader.readAsDataURL(file);
        });
      });
      Promise.all(newPreviewsPromises)
        .then(resolvedPreviews => setPreviews(resolvedPreviews))
        .catch(error => {
          console.error("Error generating previews:", error.message || error);
          form.setError('images', { type: 'manual', message: 'Could not generate image previews.' });
          setPreviews([]);
        });
    } else {
      setPreviews([]);
    }
  }, [imagesWatch, form]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    if (selectedFiles.length === 0) return;

    const currentFiles = form.getValues('images') || [];
    const combinedFiles = [...currentFiles, ...selectedFiles].slice(0, MAX_FILES);

    form.setValue('images', combinedFiles, { shouldValidate: true });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemoveImage = (indexToRemove: number) => {
    const currentFiles = form.getValues('images') || [];
    const updatedFiles = currentFiles.filter((_, index) => index !== indexToRemove);
    form.setValue('images', updatedFiles, { shouldValidate: true });
  };

  const handleSubmit = async (values: TeaLeafFormValues) => {
    if (!values.images || values.images.length === 0) return;
    if (!user) {
      form.setError("root", { message: "User not authenticated. Cannot upload images." });
      return;
    }

    setIsProcessingFiles(true);
    setUploadProgress(0);

    try {
      // Step 1: Resize images
      const resizePromises = values.images.map(file => 
        resizeImage(file, { 
          maxWidth: RESIZE_MAX_WIDTH, 
          maxHeight: RESIZE_MAX_HEIGHT, 
          mimeType: RESIZE_MIME_TYPE, 
          quality: RESIZE_QUALITY 
        })
      );
      const resizedFiles = await Promise.all(resizePromises);

      // Step 2: Upload resized images
      const storage = getStorage();
      const uploadPromises = resizedFiles.map((file, index) => {
        const filePath = `readings/${user.uid}/${Date.now()}-${index}-${file.name}`;
        const fileRef = storageRef(storage, filePath);
        const uploadTask = uploadBytesResumable(fileRef, file);

        return new Promise<string>((resolve, reject) => {
          uploadTask.on('state_changed',
            null, 
            (error) => { 
              console.error(`Upload failed for ${file.name}:`, error);
              reject(error);
            },
            async () => {
              try {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                resolve(downloadURL);
              } catch (e: unknown) { 
                console.error(`Failed to get download URL for ${file.name}:`, e);
                reject(e);
              }
            }
          );
        });
      });

      let uploadedCount = 0;
      const totalFiles = uploadPromises.length;

      const allUploadsPromise = Promise.all(
        uploadPromises.map(p => p.then(url => {
          uploadedCount++;
          setUploadProgress(Math.round((uploadedCount / totalFiles) * 100));
          return url;
        }).catch(err => { throw err; }))
      );
      
      const downloadedUrls = await allUploadsPromise;
      
      // ***** START OF KEY CHANGES *****
      // 3. Map userSymbolNames back to array of strings before passing to onSubmit
      await onSubmit(
        downloadedUrls, 
        values.question, 
        values.userSymbolNames.map(s => s.value).filter(s => s.trim() !== '') // Extract 'value' and filter empty
      ); 
      // ***** END OF KEY CHANGES *****

    } catch (error: unknown) {
      console.error('Error during file processing or upload:', error);
      let userMessage = 'An error occurred during file processing or upload. Please try again.';
      if (error instanceof Error && error.message) {
        userMessage = error.message;
      } else if (typeof error === 'object' && error !== null && 'code'in error) {
        const firebaseError = error as { code: string; message?: string }; 
        switch (firebaseError.code) {
          case 'storage/unauthorized':
            userMessage = "Upload failed: You're not authorized. Check Storage rules.";
            break;
          case 'storage/canceled':
            userMessage = "Upload canceled.";
            break;
          default:
             userMessage = `Upload error: ${firebaseError.message || 'Unknown storage error'}`;
        }
      }
      form.setError('images', { type: 'manual', message: userMessage });
    } finally {
       setIsProcessingFiles(false);
       setUploadProgress(null);
    }
  };
  
  const internalIsLoading = isLoading || isProcessingFiles;

  return (
    <Card className="w-full shadow-lg">
      <CardHeader>
        <CardTitle className="font-headline text-2xl flex items-center">
          <Leaf className="mr-2 h-6 w-6 text-primary" />
          Your Tea Leaves
        </CardTitle>
        <CardDescription>Upload 1 to {MAX_FILES} photos of your tea cup from different angles (handle at 3, 6, 9, 12 o&apos;clock). Optionally add symbols you see and a question.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="images"
              render={() => (
                <FormItem>
                  <FormLabel>Tea Cup Photos ({previews.length}/{MAX_FILES})</FormLabel>
                  <div className={cn(
                    "grid gap-3",
                    previews.length === 0 ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"
                  )}>
                    {previews.map((src, index) => (
                      <div key={index} className="relative aspect-square rounded-md border overflow-hidden group shadow-sm">
                        <Image src={src} alt={`Preview ${index + 1}`} layout="fill" objectFit="cover" className="rounded-md" data-ai-hint="tea cup leaves"/>
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute top-1.5 right-1.5 z-10 opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 p-1.5"
                          onClick={() => handleRemoveImage(index)}
                          aria-label={`Remove image ${index + 1}`}
                          disabled={internalIsLoading}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}

                    {previews.length < MAX_FILES && (
                      <FormControl>
                        <label
                          htmlFor="tea-image-upload"
                          className={cn(
                            "aspect-square flex flex-col justify-center items-center w-full h-full border-2 border-dashed rounded-md cursor-pointer transition-colors p-4 text-center",
                            form.formState.errors.images ? 'border-destructive' : 'border-border hover:border-primary',
                             previews.length === 0 && 'sm:col-span-1'
                          )}
                          aria-label="Upload tea cup images"
                        >
                          <UploadCloud className="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground" />
                          <span className="mt-2 text-xs sm:text-sm text-primary">
                            {previews.length === 0 ? `Upload Image(s)` : `Add More`}
                          </span>
                           <span className="text-xs text-primary">({previews.length}/{MAX_FILES})</span>
                          <Input
                            type="file"
                            multiple
                            accept={ACCEPTED_IMAGE_TYPES.join(',')}
                            onChange={handleFileChange}
                            className="hidden"
                            id="tea-image-upload"
                            ref={fileInputRef}
                            disabled={internalIsLoading}
                          />
                        </label>
                      </FormControl>
                    )}
                  </div>
                  <FormMessage>{form.formState.errors.images?.message || form.formState.errors.images?.root?.message}</FormMessage>
                   {Array.isArray(form.formState.errors.images) && form.formState.errors.images.map((error, index) => (
                    error && <FormMessage key={index}>{error.message}</FormMessage>
                  ))}
                  {form.formState.errors.root?.message && <FormMessage>{form.formState.errors.root.message}</FormMessage>}
                </FormItem>
              )}
            />
            
            {(isProcessingFiles && uploadProgress !== null) && (
                <div className="space-y-1">
                    <Label htmlFor="upload-progress-bar">
                      {uploadProgress < 100 ? `Uploading: ${uploadProgress}%` : 'Finalizing...'}
                    </Label>
                    <div id="upload-progress-bar" role="progressbar" aria-valuenow={uploadProgress} aria-valuemin={0} aria-valuemax={100} className="w-full bg-muted rounded-full h-2.5">
                        <div className="bg-primary h-2.5 rounded-full" style={{ width: `${uploadProgress}%`, transition: 'width 0.1s ease-in-out' }}></div>
                    </div>
                </div>
            )}
            { (isProcessingFiles && uploadProgress === null) && ( 
                 <div className="space-y-1 text-center">
                    <Label>Processing images...</Label>
                     <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" />
                 </div>
            )}


            <FormItem>
              <FormLabel className="flex items-center">
                <Tag className="mr-2 h-4 w-4 text-muted-foreground" />
                Symbols You See (Optional - Max {MAX_USER_SYMBOLS})
              </FormLabel>
              <div className="space-y-3">
                {symbolFields.map((field, index) => (
                  <FormField
                    key={field.id} // use field.id here, provided by useFieldArray for each item
                    control={form.control}
                    name={`userSymbolNames.${index}.value`} // <-- CHANGED: Access the 'value' property of the object
                    render={({ field: symbolField }) => (
                      <FormItem className="flex items-center gap-2">
                        <FormControl>
                          <Input
                            placeholder={`Symbol ${index + 1}`}
                            {...symbolField}
                            disabled={internalIsLoading}
                            className="flex-grow"
                          />
                        </FormControl>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeSymbol(index)}
                          // <-- CHANGED: Adjusted disabled logic to ensure at least one field can be removed if there are more than one, or if it's the last one and empty.
                          disabled={internalIsLoading || (symbolFields.length === 1 && form.getValues("userSymbolNames")[0].value === "")}
                          className="text-muted-foreground hover:text-destructive"
                          aria-label={`Remove symbol ${index + 1}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
              </div>
              {symbolFields.length < MAX_USER_SYMBOLS && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => appendSymbol({ value: "" })} // <-- CHANGED: Append an object with 'value'
                  disabled={internalIsLoading || symbolFields.length >= MAX_USER_SYMBOLS}
                  className="mt-2"
                >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add Symbol
                </Button>
              )}
              <FormMessage>{form.formState.errors.userSymbolNames?.message || form.formState.errors.userSymbolNames?.root?.message}</FormMessage>
               {Array.isArray(form.formState.errors.userSymbolNames) && form.formState.errors.userSymbolNames.map((error, index) => (
                error && <FormMessage key={`symbol-err-${index}`}>{error.message}</FormMessage>
              ))}
            </FormItem>


            <FormField
              control={form.control}
              name="question"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center">
                    <MessageSquare className="mr-2 h-4 w-4 text-muted-foreground" />
                    Optional Question
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="E.g., What does my future hold in love?"
                      className="resize-none"
                      {...field}
                      disabled={internalIsLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={internalIsLoading || previews.length === 0} className="w-full">
              {isProcessingFiles ? (
                 <>
                  <RotateCw className="mr-2 h-4 w-4 animate-spin" />
                  {uploadProgress !== null && uploadProgress < 100 ? `Uploading (${uploadProgress}%)` : (uploadProgress === 100 ? 'Finalizing...' : 'Processing...')}
                </>
              ) : isLoading ? ( 
                 <>
                  <RotateCw className="mr-2 h-4 w-4 animate-spin" />
                  Interpreting...
                </>
              ) : (
                'Read My Leaves'
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}