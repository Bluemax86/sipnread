
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
  onNewOperationId, // This prop is for the server-side flow, kept for code integrity
  currentTranscriptionStatus // This prop is for the server-side flow, kept for code integrity
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

  // 'isRecording' state now refers to client-side speech recognition
  const [isRecording, setIsRecording] = useState(false);
  // 'isProcessingAudio' is for the server-side flow, kept for code integrity
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  
  // Ref for client-side SpeechRecognition instance
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Refs for server-side MediaRecorder flow, kept for code integrity
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

    // --- New Client-Side Speech Recognition Logic ---
    if (SpeechRecognitionAPI) {
      if (isRecording) { // User clicked "Stop Dictation"
        if (recognitionRef.current) {
          recognitionRef.current.stop();
        }
        // setIsRecording(false); // onend will handle this
        return;
      }

      // User clicked "Start Dictation"
      recognitionRef.current = new SpeechRecognitionAPI();
      recognitionRef.current.continuous = true; // Keep listening
      recognitionRef.current.interimResults = true; // Show interim results (though we only append final ones)
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
        if (recognitionRef.current) {
            recognitionRef.current.onresult = null;
            recognitionRef.current.onstart = null;
            recognitionRef.current.onend = null;
            recognitionRef.current.onerror = null;
        }
        recognitionRef.current = null;
        toast({ title: "Dictation Stopped" });
      };

      recognitionRef.current.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error("Speech recognition error:", event.error, event.message);
        toast({ variant: "destructive", title: "Dictation Error", description: event.error || event.message || "Unknown dictation error" });
        setIsRecording(false);
        if (recognitionRef.current) {
          recognitionRef.current.stop();
        }
        recognitionRef.current = null;
      };

      try {
        // Check for microphone permission (optional, browser usually prompts)
        await navigator.mediaDevices.getUserMedia({ audio: true });
        if (recognitionRef.current) {
          recognitionRef.current.start();
        }
      } catch (err) {
        console.error("Error getting microphone permission:", err);
        toast({ variant: "destructive", title: "Microphone Error", description: "Could not access microphone. Please check permissions." });
        setIsRecording(false); // Reset recording state if permission fails
      }
      return; // Exit after handling client-side path
    } else {
      toast({ variant: "destructive", title: "Browser Not Supported", description: "Speech recognition is not supported by your browser." });
      return; // Exit if API not supported
    }

    // --- Start of existing server-side dictation code (PRESERVED BUT NOT EXECUTED by this button's new primary path) ---
    // This code block will not be reached if SpeechRecognitionAPI is available because of the 'return' statements above.
    // It is kept in the file as per user request "Leave all the code for the current dictation in place".
    // The 'isRecording' here refers to the original server-side context, shadowing the one for client-side.
    if (true) { // This 'if(true)' is just to make the block parsable and visually distinct.
      const originalIsRecording = false; // Placeholder to avoid name collision if JS were to run this
      if (originalIsRecording) { 
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
        // setIsRecording(false); // This would be for the original server-side state
        return;
      }

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
        // setIsRecording(true); // This would be for the original server-side state
        toast({ title: "Recording Started (Server)", description: "Speak now. Click again to stop and process."});
      } catch (err) {
        console.error("Error accessing microphone (Server):", err);
        toast({ variant: "destructive", title: "Microphone Error (Server)", description: "Could not access microphone. Please check permissions." });
        // setIsRecording(false); // This would be for the original server-side state
      }
    }
    // --- End of existing server-side dictation code ---
  };
  
  useEffect(() => {
    return () => { 
      // Clean up client-side recognition if active
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current.onresult = null;
        recognitionRef.current.onstart = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current = null;
      }
      // Clean up server-side MediaRecorder if it was somehow active (though it shouldn't be by this button)
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

  // Button is disabled if form is submitting OR client-side recording is active
  const overallProcessing = isSubmittingForm || isRecording; 
  
  // Dictation button text and disabled state for NEW client-side dictation
  const dictationButtonText = isRecording ? "Stop Dictation" : "Start Client Dictation";
  const dictationButtonDisabled = isSubmittingForm || isRecording;


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
                        disabled={dictationButtonDisabled} // Uses new client-side logic
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
                className="w-full sm:w-auto text-green-700 border-green-700 hover:bg-green-600 hover:text-green-50 focus-visible:ring-green-500 disabled:text-muted-foreground disabled:border-input disabled:bg-background disabled:hover:bg-background disabled:hover:text-muted-foreground"
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

