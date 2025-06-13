
'use client';

import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PlusCircle, Trash2, Loader2, Send, Mic, BookOpenText, Sparkles, Save } from 'lucide-react';
import type { SaveTassologistInterpretationType, TranscriptionStatus } from '@/app/actions';
import { useEffect, useState, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { app as firebaseApp } from '@/lib/firebase'; 
import { getFunctions, httpsCallable, type HttpsCallableResult, type FunctionsError } from 'firebase/functions';
import type { ProcessAndTranscribeAudioCallableInput } from '../../../functions/src';


const symbolSchema = z.object({
  symbol: z.string().min(1, "Symbol name cannot be empty."),
  position: z.preprocess(
    (val) => (val === "" || val === undefined || val === null) ? undefined : Number(val),
    z.number().int().min(0).max(12).optional()
  ).describe("Optional clock position (0-12). 0 or empty for general.")
});

const tassologistInterpretationSchema = z.object({
  manualSymbols: z.array(symbolSchema).max(20, "Maximum of 20 symbols allowed."),
  manualInterpretation: z.string().min(10, "Interpretation must be at least 10 characters long.").max(5000, "Interpretation cannot exceed 5000 characters."),
});

export type TassologistInterpretationFormValues = z.infer<typeof tassologistInterpretationSchema>;

interface TassologistInterpretationFormProps {
  personalizedReadingRequestId: string; 
  onSubmit: (data: TassologistInterpretationFormValues, saveType: SaveTassologistInterpretationType) => Promise<void>;
  isSubmittingForm: boolean; 
  initialData?: Partial<TassologistInterpretationFormValues>;
  onTranscriptFetched?: (transcript: string, operationName?: string) => void; 
  currentTranscriptionStatus?: TranscriptionStatus;
}

export function TassologistInterpretationForm({ 
  personalizedReadingRequestId, 
  onSubmit, 
  isSubmittingForm, 
  initialData,
  onTranscriptFetched,
  currentTranscriptionStatus
}: TassologistInterpretationFormProps) {
  const form = useForm<TassologistInterpretationFormValues>({
    resolver: zodResolver(tassologistInterpretationSchema),
    defaultValues: {
      manualSymbols: initialData?.manualSymbols || [{ symbol: '', position: undefined }],
      manualInterpretation: initialData?.manualInterpretation || '',
    },
  });

  const { user } = useAuth();
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "manualSymbols",
  });

  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (initialData?.manualInterpretation !== undefined) {
      form.setValue('manualInterpretation', initialData.manualInterpretation);
    }
    if (initialData?.manualSymbols !== undefined) {
        form.setValue('manualSymbols', initialData.manualSymbols.length > 0 ? initialData.manualSymbols : [{ symbol: '', position: undefined }]);
    }
  }, [initialData, form]);

  const handleStartStopDictation = async () => {
    if (isRecording) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const options = { mimeType: 'audio/webm;codecs=opus' };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
         toast({ variant: "destructive", title: "Unsupported Format", description: "WebM Opus audio is not supported by your browser." });
         return;
      }
      mediaRecorderRef.current = new MediaRecorder(stream, options);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        if (audioChunksRef.current.length === 0) {
          toast({ variant: "destructive", title: "Recording Error", description: "No audio data was recorded." });
          setIsProcessingAudio(false);
          return;
        }
        
        const audioBlob = new Blob(audioChunksRef.current, { type: options.mimeType });
        
        if (!user) {
          toast({ variant: "destructive", title: "Authentication Error", description: "You must be logged in." });
          setIsProcessingAudio(false);
          return;
        }

        setIsProcessingAudio(true);
        toast({ title: "Processing Dictation...", description: "Uploading and starting transcription." });

        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = reader.result as string;
          const audioDataOnly = base64Audio.split(',')[1];

          try {
            const functions = getFunctions(firebaseApp);
            const processAndTranscribeAudio = httpsCallable<
              ProcessAndTranscribeAudioCallableInput,
              { success: boolean; operationName?: string; message?: string } // Expected success response
            >(functions, 'processAndTranscribeAudioCallable');

            const payload: ProcessAndTranscribeAudioCallableInput = {
              audioBase64: audioDataOnly,
              personalizedReadingRequestId,
              mimeType: options.mimeType,
            };
            
            console.log("[TassologistInterpretationForm] Calling processAndTranscribeAudioCallable with payload:", payload.mimeType, `requestId: ${payload.personalizedReadingRequestId}`);
            const result = await processAndTranscribeAudio(payload);
            console.log("[TassologistInterpretationForm] Raw result from callable:", JSON.stringify(result, null, 2));


            if (result && result.data && result.data.success && result.data.operationName) {
              toast({ title: "Transcription Started", description: `Processing in background. You can save draft or refresh for transcript later.` });
              if (onTranscriptFetched) {
                onTranscriptFetched("", result.data.operationName); 
              }
            } else {
              // This branch handles cases where the callable returned successfully (HTTP 200)
              // but the logical operation indicated failure (e.g., result.data.success was false)
              // or the response structure was not as expected.
              const errorMessage = result?.data?.message || "Could not start transcription (unexpected response structure).";
              console.error("[TassologistInterpretationForm] Callable returned non-success or malformed data:", result?.data);
              toast({ variant: "destructive", title: "Transcription Start Failed", description: errorMessage });
            }
          } catch (error: unknown) {
            // This catch block handles HttpsError thrown by the callable, network errors, etc.
            const callableError = error as FunctionsError; // Cast to FunctionsError for more specific details
            console.error("[TassologistInterpretationForm] Error calling processAndTranscribeAudioCallable:", JSON.stringify(callableError, null, 2));
            
            let description = "An error occurred during audio processing.";
            if (callableError.message) {
              description = callableError.message;
            }
            // You can check callableError.code and callableError.details for more specific error handling
            // e.g., if (callableError.code === 'unauthenticated') { ... }

            toast({ variant: "destructive", title: "Callable Error", description });
          } finally {
            setIsProcessingAudio(false);
          }
        };
        reader.onerror = () => {
          toast({ variant: "destructive", title: "File Read Error", description: "Could not read audio data for processing." });
          setIsProcessingAudio(false);
        };
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      toast({ title: "Recording Started", description: "Speak now. Click again to stop and process."});
    } catch (err) {
      console.error("Error accessing microphone:", err);
      toast({ variant: "destructive", title: "Microphone Error", description: "Could not access microphone. Please check permissions." });
      setIsRecording(false);
    }
  };
  
  useEffect(() => {
    return () => { 
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.stream) {
          mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleFormSubmitInternal = (saveType: SaveTassologistInterpretationType) => {
    return form.handleSubmit((data) => onSubmit(data, saveType))();
  };

  const overallProcessing = isSubmittingForm || isRecording || isProcessingAudio;
  const dictationButtonDisabled = isSubmittingForm || isProcessingAudio || currentTranscriptionStatus === 'pending';
  const dictationButtonText = 
    isRecording ? "Stop Dictation" :
    isProcessingAudio ? "Processing Audio..." :
    currentTranscriptionStatus === 'pending' ? "Transcription Pending..." :
    "Start Dictation";


  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="font-headline text-xl flex items-center">
          <BookOpenText className="mr-2 h-6 w-6 text-primary" />
          Your Personalized Interpretation
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form className="space-y-6">
            <div className="space-y-3">
              <FormLabel className="flex items-center"><Sparkles className="inline mr-1 h-4 w-4 text-muted-foreground" /> Symbols You Visualized</FormLabel>
              {fields.map((item, index) => (
                <div key={item.id} className="flex items-start gap-2 p-3 border rounded-md bg-card">
                  <FormField
                    control={form.control}
                    name={`manualSymbols.${index}.symbol`}
                    render={({ field }) => (
                      <FormItem className="flex-grow">
                        <FormLabel htmlFor={`symbol-${index}`} className="sr-only">Symbol description</FormLabel>
                        <FormControl>
                          <Input id={`symbol-${index}`} placeholder="Symbol name (e.g., Anchor)" {...field} disabled={overallProcessing} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`manualSymbols.${index}.position`}
                    render={({ field }) => (
                      <FormItem className="w-28">
                         <FormLabel htmlFor={`position-${index}`} className="sr-only">Position</FormLabel>
                        <FormControl>
                          <Input 
                            id={`position-${index}`} 
                            type="number" 
                            placeholder="Pos (0-12)" 
                            {...field} 
                            value={field.value === undefined ? '' : field.value}
                            onChange={e => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))} 
                            disabled={overallProcessing} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(index)}
                    className="mt-0.5 text-destructive hover:text-destructive/80"
                    aria-label="Remove symbol"
                    disabled={fields.length <= 1 || overallProcessing}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ symbol: '', position: undefined })}
                disabled={overallProcessing || fields.length >= 20}
                className="mt-2"
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Symbol
              </Button>
              <FormMessage>{form.formState.errors.manualSymbols?.message || form.formState.errors.manualSymbols?.root?.message}</FormMessage>
            </div>
            
            <FormField
              control={form.control}
              name="manualInterpretation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center justify-between w-full">
                    <span><Sparkles className="inline mr-1 h-4 w-4 text-muted-foreground" /> Your Interpretation</span>
                     <Button 
                        type="button" 
                        onClick={handleStartStopDictation} 
                        variant={isRecording ? "destructive" : "outline"} 
                        size="sm" 
                        disabled={dictationButtonDisabled}
                        className="flex items-center"
                      >
                        {isRecording || isProcessingAudio ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mic className="mr-2 h-4 w-4" />}
                        {dictationButtonText}
                      </Button>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Type or dictate the detailed tea leaf interpretation here..."
                      rows={10}
                      className="resize-y"
                      {...field}
                      disabled={overallProcessing}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3">
              <Button 
                type="button" 
                onClick={() => handleFormSubmitInternal('draft')} 
                disabled={overallProcessing} 
                variant="outline" 
                className="w-full sm:w-auto"
              >
                {isSubmittingForm && form.formState.submitCount > 0 && form.formState.isSubmitting && (form.getValues().manualInterpretation === initialData?.manualInterpretation) ? ( 
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving Draft...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save as Draft
                  </>
                )}
              </Button>
              <Button 
                type="button" 
                onClick={() => handleFormSubmitInternal('complete')} 
                disabled={overallProcessing} 
                className="w-full sm:w-auto"
              >
                 {isSubmittingForm && form.formState.submitCount > 0 && form.formState.isSubmitting && (form.getValues().manualInterpretation !== initialData?.manualInterpretation) ? ( 
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Completing...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Save and Complete Reading
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
