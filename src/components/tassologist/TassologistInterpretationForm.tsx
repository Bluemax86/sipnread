
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
import { getFunctions, httpsCallable, type FunctionsError } from 'firebase/functions';
import type { ProcessAndTranscribeAudioCallableInput } from '../../../functions/src';


const symbolSchema = z.object({
  symbol: z.string().min(1, "Symbol name cannot be empty."),
  position: z.preprocess(
    (val) => (val === "" || val === undefined || val === null) ? undefined : Number(val),
    z.number().int().min(0, "Position must be a non-negative integer.").max(12, "Position must be between 0 and 12.").optional().nullable()
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
  onNewOperationId?: (operationName: string) => void; 
  currentTranscriptionStatus?: TranscriptionStatus;
}

// TypeScript interfaces for browser SpeechRecognition API if not globally available
// These might be available in modern lib.dom.d.ts, but included for explicitness
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}
interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}
interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string; 
  readonly message: string;
}


export function TassologistInterpretationForm({ 
  personalizedReadingRequestId, 
  onSubmit, 
  isSubmittingForm, 
  initialData,
  onNewOperationId, 
  currentTranscriptionStatus 
}: TassologistInterpretationFormProps) {
  const form = useForm<TassologistInterpretationFormValues>({
    resolver: zodResolver(tassologistInterpretationSchema),
    defaultValues: {
      manualSymbols: [{ symbol: '', position: undefined }],
      manualInterpretation: '',
    },
  });

  const { user } = useAuth();
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "manualSymbols",
  });

  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (initialData) {
      form.reset({
        manualSymbols: initialData.manualSymbols && initialData.manualSymbols.length > 0 
                       ? initialData.manualSymbols 
                       : [{ symbol: '', position: undefined }],
        manualInterpretation: initialData.manualInterpretation || '',
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  useEffect(() => {
    if (initialData?.manualInterpretation !== undefined && 
        initialData.manualInterpretation !== form.getValues('manualInterpretation')) {
      form.setValue('manualInterpretation', initialData.manualInterpretation);
    }
  }, [initialData?.manualInterpretation, form]);


  const handleStartStopDictation = async () => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognitionAPI) {
      if (isRecording) { 
        if (recognitionRef.current) {
          recognitionRef.current.stop();
        }
        return; // Exit if already recording and stop() was called
      }

      // Not recording, so start new recognition
      recognitionRef.current = new SpeechRecognitionAPI();
      recognitionRef.current.continuous = true; 
      recognitionRef.current.interimResults = true; 
      recognitionRef.current.lang = 'en-US';

      let currentFinalTranscript = form.getValues('manualInterpretation') || '';

      recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
        let newFinalizedSegment = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            newFinalizedSegment += event.results[i][0].transcript + ' ';
          }
        }
        if (newFinalizedSegment) {
          currentFinalTranscript = (currentFinalTranscript ? currentFinalTranscript.trim() + ' ' : '') + newFinalizedSegment.trim();
          form.setValue('manualInterpretation', currentFinalTranscript);
        }
      };

      recognitionRef.current.onstart = () => {
        setIsRecording(true);
        toast({ title: "Listening...", description: "Speak now. Click 'Stop Dictation' when done."});
      };

      recognitionRef.current.onend = () => {
        setIsRecording(false);
        if (recognitionRef.current) { // Clean up event handlers
            recognitionRef.current.onresult = null;
            recognitionRef.current.onstart = null;
            recognitionRef.current.onend = null;
            recognitionRef.current.onerror = null;
        }
        recognitionRef.current = null; // Release the instance
        toast({ title: "Dictation Stopped" });
      };

      recognitionRef.current.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error("Speech recognition error:", event.error, event.message);
        toast({ variant: "destructive", title: "Dictation Error", description: event.error || event.message || "Unknown dictation error" });
        setIsRecording(false); // Ensure recording state is updated on error
        if (recognitionRef.current) {
          recognitionRef.current.stop(); // Attempt to stop if not already stopped
        }
        recognitionRef.current = null;
      };

      try {
        // Ensure microphone permission (modern browsers might re-prompt or use existing permission)
        await navigator.mediaDevices.getUserMedia({ audio: true });
        if (recognitionRef.current) { // Check again in case of race conditions or quick UI interaction
          recognitionRef.current.start();
        }
      } catch (err) {
        console.error("Error getting microphone permission:", err);
        toast({ variant: "destructive", title: "Microphone Error", description: "Could not access microphone. Please check permissions." });
        setIsRecording(false); // Reset state if permission fails
      }
      return; // Important: return here to prevent falling through to server-side logic
    } else {
      toast({ variant: "destructive", title: "Browser Not Supported", description: "Speech recognition is not supported by your browser." });
      return; // Explicitly return if API not supported
    }

    // ----- Server-side dictation code (Preserved but not primary path now) -----
    // This block is now effectively "dead code" if SpeechRecognitionAPI is supported.
    // It's kept here as per your request not to remove it.
    if (true) { // This condition can be removed or set to false if you never want it to run
      const originalIsRecording = false; // Simulating old state if we were to use this path
      if (originalIsRecording) { // This 'if' block for stopping server recording is effectively unreachable
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
        return;
      }

      // Logic to start server-side recording (MediaRecorder)
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const options = { mimeType: 'audio/webm;codecs=opus' };
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
           toast({ variant: "destructive", title: "Unsupported Format (Server)", description: "WebM Opus audio is not supported by your browser for server upload." });
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
            toast({ variant: "destructive", title: "Recording Error (Server)", description: "No audio data was recorded for server processing." });
            setIsProcessingAudio(false);
            return;
          }
          
          const audioBlob = new Blob(audioChunksRef.current, { type: options.mimeType });
          
          if (!user) {
            toast({ variant: "destructive", title: "Authentication Error (Server)", description: "You must be logged in for server processing." });
            setIsProcessingAudio(false);
            return;
          }

          setIsProcessingAudio(true);
          toast({ title: "Processing Dictation (Server)...", description: "Uploading and starting transcription." });

          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = async () => {
            const base64Audio = reader.result as string;
            const audioDataOnly = base64Audio.split(',')[1];

            try {
              const functions = getFunctions(firebaseApp);
              const processAndTranscribeAudio = httpsCallable<
                ProcessAndTranscribeAudioCallableInput,
                { success: boolean; operationName?: string; message?: string } 
              >(functions, 'processAndTranscribeAudioCallable');

              const payload: ProcessAndTranscribeAudioCallableInput = {
                audioBase64: audioDataOnly,
                personalizedReadingRequestId,
                mimeType: options.mimeType,
              };
              
              const result = await processAndTranscribeAudio(payload);

              if (result && result.data && result.data.success && result.data.operationName) {
                toast({ title: "Transcription Started (Server)", description: `Processing in background.` });
                if (onNewOperationId) {
                  onNewOperationId(result.data.operationName); 
                }
              } else {
                const errorMessage = result?.data?.message || "Could not start server transcription.";
                toast({ variant: "destructive", title: "Server Transcription Start Failed", description: errorMessage });
              }
            } catch (error: unknown) {
              const callableError = error as FunctionsError; 
              let description = "An error occurred during server audio processing.";
              if (callableError.message) {
                description = callableError.message;
              }
              toast({ variant: "destructive", title: "Server Callable Error", description });
            } finally {
              setIsProcessingAudio(false);
            }
          };
          reader.onerror = () => {
            toast({ variant: "destructive", title: "File Read Error (Server)", description: "Could not read audio data for server processing." });
            setIsProcessingAudio(false);
          };
        };

        mediaRecorderRef.current.start();
        toast({ title: "Recording Started (Server)", description: "Speak now. Click again to stop and process."});
      } catch (err) {
        console.error("Error accessing microphone (Server):", err);
        toast({ variant: "destructive", title: "Microphone Error (Server)", description: "Could not access microphone. Please check permissions." });
      }
    }
  };
  
  useEffect(() => {
    return () => { 
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current.onresult = null;
        recognitionRef.current.onstart = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current = null;
      }
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

  const overallProcessing = isSubmittingForm; 
  
  const dictationButtonText = isRecording ? "Stop Dictation" : "Start Dictation";
  // Button is disabled only when the main form is submitting.
  const dictationButtonDisabled = isSubmittingForm;


  const interpretationValue = form.watch('manualInterpretation');
  const canComplete = interpretationValue && interpretationValue.trim().length >= 10;


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
                            min="0" 
                            max="12"
                            placeholder="Pos (0-12)"
                            {...field}
                            value={field.value === undefined || field.value === null ? '' : String(field.value)}
                            onChange={e => {
                              const rawValue = e.target.value;
                              if (rawValue === '') {
                                field.onChange(undefined);
                              } else {
                                const num = Number(rawValue);
                                if (!isNaN(num) && num < 0) {
                                  field.onChange(0); 
                                } else {
                                  field.onChange(isNaN(num) ? undefined : num);
                                }
                              }
                            }}
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
                        {isRecording ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mic className="mr-2 h-4 w-4" />}
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
                {isSubmittingForm && form.formState.submitCount > 0 && form.formState.isSubmitting && (!canComplete || form.getValues('manualInterpretation').trim().length < 10) ? ( 
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
                disabled={overallProcessing || !canComplete} 
                className="w-full sm:w-auto"
              >
                 {isSubmittingForm && form.formState.submitCount > 0 && form.formState.isSubmitting && canComplete ? ( 
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

