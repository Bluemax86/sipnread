
// src/app/actions.ts
'use server';

import { analyzeTeaLeafPatterns, type AnalyzeTeaLeafPatternsInput, type AnalyzeTeaLeafPatternsOutput } from '@/ai/flows/analyze-tea-leaf-patterns';
import { Timestamp, doc, updateDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app as firebaseApp, db } from '@/lib/firebase';
import { SpeechClient } from '@google-cloud/speech';
import type { protos } from '@google-cloud/speech'; // Import protos for type safety

import type {
  SubmitRoxyReadingRequestCallableInput,
  SaveTassologistInterpretationCallableInput,
  MarkPersonalizedReadingAsReadCallableInput
} from '@/../functions/src';


export interface AiSymbol {
  symbolName: string;
  symbolDescription: string;
  truePositionInCup: string;
  "bestSeenInView(s)": string;
  appearanceNotes?: string;
  traditionalMeaning: string;
  origin: 'user-identified and confirmed' | 'ai-discovered';
}

export interface StoredManualSymbol {
  symbolName: string;
  truePositionInCup: string;
}

export interface TeaReadingDocument {
  userId: string;
  readingDate: Timestamp;
  photoStorageUrls: string[];
  aiSymbolsDetected: AiSymbol[];
  aiInterpretation: string;
  userQuestion?: string;
  userSymbolNames?: string[];
  manualSymbolsDetected: StoredManualSymbol[];
  manualInterpretation: string;
  updatedAt?: Timestamp;
}

export interface MailDocument {
  to: string[];
  message: {
    subject: string;
    html: string;
    text?: string;
  };
  createdAt?: Timestamp;
}

export type TranscriptionStatus = 'not_requested' | 'pending' | 'completed' | 'failed' | null;

export interface RoxyPersonalizedReadingRequest {
  userId: string;
  userEmail: string;
  originalReadingId?: string | null;
  requestDate: Timestamp;
  status: 'new' | 'in-progress' | 'completed' | 'cancelled' | 'read';
  price: number;
  paymentStatus: 'pending';
  userSatisfaction?: 'happy' | 'neutral' | 'unhappy' | null;
  completionDate?: Timestamp;
  tassologistId?: string;
  updatedAt?: Timestamp;
  dictatedAudioGcsUri?: string | null;
  transcriptionOperationId?: string | null;
  transcriptionStatus?: TranscriptionStatus;
  transcriptionError?: string | null;
}

export interface AiAnalysisResult {
  aiSymbolsDetected?: AiSymbol[];
  aiInterpretation?: string;
  error?: string;
  imageStorageUrls?: string[];
  userQuestion?: string | null;
  userSymbolNames?: string[] | null;
}

export interface FullInterpretationResult extends AiAnalysisResult {
    readingId?: string;
}


export async function getTeaLeafAiAnalysisAction(
  userIdClientProvided: string,
  imageStorageUrls: string[],
  userQuestion?: string,
  userSymbolNames?: string[]
): Promise<AiAnalysisResult> {
  if (!userIdClientProvided) {
    return { error: "User context missing for AI analysis." };
  }
  if (!imageStorageUrls || imageStorageUrls.length === 0) {
    return { error: "No images provided for AI analysis."};
  }

  try {
    const aiFlowInput: AnalyzeTeaLeafPatternsInput = {
      photoDataUris: imageStorageUrls,
    };
    if (userQuestion && userQuestion.trim() !== '') {
      aiFlowInput.userQuestion = userQuestion;
    }
    if (userSymbolNames && userSymbolNames.length > 0) {
      aiFlowInput.userSymbolNames = userSymbolNames.filter(name => name.trim() !== '');
    }

    const aiResult: AnalyzeTeaLeafPatternsOutput = await analyzeTeaLeafPatterns(aiFlowInput);

    return {
      aiSymbolsDetected: aiResult.aiSymbolsDetected,
      aiInterpretation: aiResult.aiInterpretation,
      imageStorageUrls: imageStorageUrls,
      userQuestion: (userQuestion && userQuestion.trim() !== '') ? userQuestion : null,
      userSymbolNames: (userSymbolNames && userSymbolNames.length > 0) ? userSymbolNames.filter(name => name.trim() !== '') : null,
    };

  } catch (e: unknown) {
    console.error("[getTeaLeafAiAnalysisAction] Error in AI analysis server action:", e);
    let errorMessage = 'Failed to analyze tea leaves. An unexpected error occurred.';
     if (e instanceof Error && e.message) {
      if (e.message.includes("Schema validation failed") || e.message.includes("INVALID_ARGUMENT")) {
          errorMessage = `There was an issue with the data sent for AI analysis. ${e.message}`;
      } else if (e.message.includes('image format') || e.message.includes('Invalid media') || e.message.includes('Could not fetch')) {
          errorMessage = 'Invalid image format, content, or URL for AI. Please use JPG, PNG, or WEBP, ensure images are clear and URLs are accessible.';
      } else if (e.message.includes('quota')) {
          errorMessage = 'The daily limit for AI requests has been reached. Please try again tomorrow.';
      } else {
        errorMessage = e.message;
      }
    }
    return { error: errorMessage };
  }
}

/**
 * @deprecated This server action is deprecated. Audio processing and transcription initiation
 * is now handled by the `processAndTranscribeAudioCallable` Firebase Function.
 * The `getTranscriptionResultAction` should be used to poll for results.
 */
export async function startTranscriptionForRequestAction(
): Promise<{ success: boolean; operationId?: string; error?: string; }> {
  console.warn("[startTranscriptionForRequestAction DEPRECATED] This action is deprecated. Use the 'processAndTranscribeAudioCallable' Firebase Function to start transcription, and 'getTranscriptionResultAction' to poll.");
  return {
    success: false,
    error: "This action (startTranscriptionForRequestAction) is deprecated. Use processAndTranscribeAudioCallable Firebase Function."
  };
}

export interface GetTranscriptionResultPayload {
  success: boolean;
  transcript?: string;
  status?: 'processing' | 'completed' | 'failed' | 'not_found';
  error?: string;
}

// Using IRecognitionAudio and IRecognitionConfig from protos for better type safety if needed.
// For SpeechOperationResponse, we use protos.google.longrunning.IOperation which is what checkLongRunningRecognizeProgress returns.
// If more specific result types are needed, they can be defined from protos.google.cloud.speech.v1.

export async function getTranscriptionResultAction(
  operationName: string,
  personalizedReadingRequestId: string,
  originalReadingId: string | null
): Promise<GetTranscriptionResultPayload> {
  if (!operationName || !personalizedReadingRequestId) {
    return { success: false, error: "Operation name and personalized reading request ID are required.", status: 'failed' };
  }

  const speechClient = new SpeechClient();
  try {
    console.log(`[getTranscriptionResultAction] Checking operation: ${operationName}`);
    // Use checkLongRunningRecognizeProgress for a more direct API
    const operation: protos.google.longrunning.IOperation = await speechClient.checkLongRunningRecognizeProgress(operationName);

    if (!operation) { // Should not happen if operationName is valid, as an error would likely be thrown by the client
      console.warn(`[getTranscriptionResultAction] Operation ${operationName} not found by client library (unexpected).`);
       await updateDoc(doc(db, 'personalizedReadings', personalizedReadingRequestId), {
        transcriptionStatus: 'failed',
        transcriptionError: 'Operation not found by client action (checkLongRunningRecognizeProgress).',
        updatedAt: Timestamp.now(),
      });
      return { success: false, error: 'Transcription operation not found.', status: 'not_found' };
    }

    if (operation.done) {
      if (operation.error) {
        console.error(`[getTranscriptionResultAction] Operation ${operationName} failed:`, operation.error);
        await updateDoc(doc(db, 'personalizedReadings', personalizedReadingRequestId), {
          transcriptionStatus: 'failed',
          transcriptionError: operation.error.message || 'Transcription failed.',
          updatedAt: Timestamp.now(),
        });
        return { success: false, error: operation.error.message || 'Transcription failed.', status: 'failed' };
      }

      // The response for speech.projects.operations is google.cloud.speech.v1.LongRunningRecognizeResponse
      // We need to cast operation.response to this type.
      const speechResponse = operation.response as protos.google.cloud.speech.v1.LongRunningRecognizeResponse;

      if (speechResponse && speechResponse.results && speechResponse.results.length > 0) {
        const transcript = speechResponse.results
          .map((result: protos.google.cloud.speech.v1.ISpeechRecognitionResult) => result.alternatives?.[0]?.transcript || '')
          .join('\n');

        console.log(`[getTranscriptionResultAction] Transcription complete for ${operationName}. Transcript length: ${transcript.length}`);

        if (originalReadingId) {
            const readingDocRef = doc(db, 'readings', originalReadingId);
            await updateDoc(readingDocRef, {
              manualInterpretation: transcript,
              updatedAt: Timestamp.now(),
            });
            console.log(`[getTranscriptionResultAction] Reading document ${originalReadingId} updated with transcript.`);
        } else {
            console.log(`[getTranscriptionResultAction] No originalReadingId provided, transcript not saved to a 'readings' document.`);
        }

        await updateDoc(doc(db, 'personalizedReadings', personalizedReadingRequestId), {
          transcriptionStatus: 'completed',
          transcriptionError: null,
          updatedAt: Timestamp.now(),
        });
        console.log(`[getTranscriptionResultAction] Personalized reading ${personalizedReadingRequestId} status updated to completed.`);

        return { success: true, transcript: transcript, status: 'completed' };
      } else {
         console.warn(`[getTranscriptionResultAction] Operation ${operationName} done but no transcript found in response.`);
         await updateDoc(doc(db, 'personalizedReadings', personalizedReadingRequestId), {
          transcriptionStatus: 'failed',
          transcriptionError: 'Transcription completed but no text was recognized.',
          updatedAt: Timestamp.now(),
        });
        return { success: false, error: 'Transcription completed but no text was recognized.', status: 'completed' };
      }
    } else {
      console.log(`[getTranscriptionResultAction] Operation ${operationName} still processing.`);
      // Update status in Firestore to 'pending' if it wasn't already, or just confirm it.
      // This might be redundant if the callable function already set it to pending.
      // Consider if this update is necessary or if client should just retry.
      await updateDoc(doc(db, 'personalizedReadings', personalizedReadingRequestId), {
        transcriptionStatus: 'pending',
        updatedAt: Timestamp.now(),
      });
      return { success: false, status: 'processing', error: 'Transcription is still in progress.' };
    }
  } catch (error: unknown) {
    console.error(`[getTranscriptionResultAction] Error checking/processing operation ${operationName}:`, error);
    const errorMessage = error instanceof Error ? error.message : "Failed to get transcription result.";
     try {
      await updateDoc(doc(db, 'personalizedReadings', personalizedReadingRequestId), {
        transcriptionStatus: 'failed',
        transcriptionError: errorMessage.substring(0, 500), // Limit error message length
        updatedAt: Timestamp.now(),
      });
    } catch (updateError) {
      console.error(`[getTranscriptionResultAction] Failed to update status to 'failed' for ${personalizedReadingRequestId}:`, updateError);
    }
    return { success: false, error: errorMessage, status: 'failed' };
  }
}


/**
 * @deprecated This server action is no longer used by the primary "Request Roxy's Reading" flow on ReadingPage.
 * The client now calls the `submitRoxyReadingRequestCallable` Firebase Function directly.
 */
export async function submitRoxyReadingRequestAction(
  userIdClientProvided: string,
  userEmail: string,
  originalReadingId?: string
): Promise<{ success: boolean; error?: string; requestId?: string }> {
  if (!userIdClientProvided || !userEmail) {
    return { success: false, error: "User ID and Email are required." };
  }

  try {
    const functions = getFunctions(firebaseApp);
    const submitRoxyReadingRequest = httpsCallable<
      SubmitRoxyReadingRequestCallableInput,
      { success: boolean; requestId?: string; message?: string }
    >(functions, 'submitRoxyReadingRequestCallable');

    const payload: SubmitRoxyReadingRequestCallableInput = {
      userEmail,
      originalReadingId: originalReadingId || null,
    };

    const result = await submitRoxyReadingRequest(payload);

    if (result.data.success && result.data.requestId) {
      return { success: true, requestId: result.data.requestId };
    } else {
      return { success: false, error: result.data.message || "Failed to submit request via callable." };
    }
  } catch (error: unknown) {
    console.error("[Action submitRoxyReadingRequestAction - PROBLEMATIC PATH] Error calling callable function:", error);
    const message = error instanceof Error ? error.message : "Failed to submit request. Please try again.";
    return { success: false, error: message };
  }
}

export type SaveTassologistInterpretationType = 'complete' | 'draft';

export interface ManualSymbolInput {
  symbol: string;
  position?: number;
}

export async function saveTassologistInterpretationAction(
  requestId: string,
  originalReadingId: string,
  manualSymbols: ManualSymbolInput[],
  manualInterpretation: string,
  saveType: SaveTassologistInterpretationType
): Promise<{ success: boolean; error?: string }> {
  if (!requestId || !originalReadingId) {
    return { success: false, error: "Request ID and Original Reading ID are required." };
  }
  if (saveType === 'complete' && (!manualInterpretation || manualInterpretation.trim() === "")) {
    return { success: false, error: "Manual interpretation cannot be empty when completing." };
  }

  try {
    const functions = getFunctions(firebaseApp);
    const saveTassologistInterpretation = httpsCallable<
      SaveTassologistInterpretationCallableInput,
      { success: boolean; message?: string }
    >(functions, 'saveTassologistInterpretationCallable');

    const payload: SaveTassologistInterpretationCallableInput = {
      requestId,
      originalReadingId,
      manualSymbols,
      manualInterpretation,
      saveType,
    };

    const result = await saveTassologistInterpretation(payload);

    if (result.data.success) {
      return { success: true };
    } else {
      return { success: false, error: result.data.message || "Failed to save interpretation via callable." };
    }
  } catch (error: unknown) {
    console.error("[Action saveTassologistInterpretationAction] Error calling callable function:", error);
    const message = error instanceof Error ? error.message : "Failed to save interpretation. Please try again.";
    return { success: false, error: message };
  }
}

export async function markPersonalizedReadingAsReadAction(
  requestId: string
): Promise<{ success: boolean; error?: string }> {
  if (!requestId) {
    return { success: false, error: "Request ID is required to mark as read." };
  }

  try {
    const functions = getFunctions(firebaseApp);
    const markPersonalizedReadingAsRead = httpsCallable<
      MarkPersonalizedReadingAsReadCallableInput,
      { success: boolean; message?: string }
    >(functions, 'markPersonalizedReadingAsReadCallable');

    const payload: MarkPersonalizedReadingAsReadCallableInput = { requestId };

    const result = await markPersonalizedReadingAsRead(payload);

    if (result.data.success) {
      return { success: true };
    } else {
      return { success: false, error: result.data.message || "Failed to update reading status via callable." };
    }
  } catch (error: unknown) {
    console.error("[Action markPersonalizedReadingAsReadAction] Error calling callable function:", error);
    const message = error instanceof Error ? error.message : "Failed to update reading status.";
    return { success: false, error: message };
  }
}


export interface UpdateUserProfileInput {
  name: string;
  bio?: string | null;
  profilePicUrl?: string | null;
  birthdate?: string | null;
}


/**
 * @deprecated This server action is replaced by the updateUserProfileCallable Firebase Cloud Function.
 */
export async function updateUserProfile(
): Promise<{ success: boolean; error?: string }> {
  return { success: false, error: "This action is deprecated. Use the 'updateUserProfileCallable' Firebase Cloud Function instead."};
}

