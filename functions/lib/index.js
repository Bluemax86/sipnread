"use strict";
/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.processAndTranscribeAudioCallable = exports.markPersonalizedReadingAsReadCallable = exports.saveTassologistInterpretationCallable = exports.submitRoxyReadingRequestCallable = exports.saveReadingDataCallable = exports.updateUserProfileCallable = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const zod_1 = require("zod");
// import { SpeechClient } from '@google-cloud/speech';
// import { Storage } from '@google-cloud/storage';
// Initialize Firebase Admin SDK
if (admin.apps.length === 0) {
    admin.initializeApp();
}
const adminDb = admin.firestore();
// SDK Clients - Initialize them once globally.
// let speechClient: SpeechClient;
// let storage: Storage;
/*
try {
    console.log('[Global Init] Attempting to initialize SpeechClient...');
    // speechClient = new SpeechClient();
    console.log('[Global Init] SpeechClient initialization skipped (currently unused).');
} catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    const stack = e instanceof Error ? e.stack : undefined;
    console.error('[Global Init] CRITICAL: Failed to initialize SpeechClient:', message, stack);
}
*/
/*
try {
    console.log('[Global Init] Attempting to initialize Storage client...');
    // storage = new Storage();
    console.log('[Global Init] Storage client initialization skipped (currently unused).');
} catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    const stack = e instanceof Error ? e.stack : undefined;
    console.error('[Global Init] CRITICAL: Failed to initialize Storage client:', message, stack);
}
*/
// Zod schema for input validation for updateUserProfileCallable
const UpdateUserProfileCallableInputSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, "Name is required.").max(100, "Name cannot exceed 100 characters."),
    profilePicUrl: zod_1.z.string().url("Please enter a valid URL for the profile picture.").or(zod_1.z.literal("")).optional().nullable(),
    bio: zod_1.z.string().max(500, "Bio can be up to 500 characters.").optional().nullable(),
    birthdate: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Birthdate must be in YYYY-MM-DD format.").optional().nullable(),
});
exports.updateUserProfileCallable = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        console.error("[updateUserProfileCallable] Authentication failed: No auth context.");
        throw new https_1.HttpsError("unauthenticated", "The function must be called while authenticated.");
    }
    const userId = request.auth.uid;
    const data = request.data;
    try {
        const validatedData = UpdateUserProfileCallableInputSchema.parse(data);
        const profileRef = adminDb.collection("profiles").doc(userId);
        const updatePayload = {
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        if (validatedData.name) {
            updatePayload.name = validatedData.name;
        }
        if (validatedData.bio !== undefined) {
            updatePayload.bio = validatedData.bio === null ? null : (validatedData.bio || "");
        }
        if (validatedData.profilePicUrl !== undefined) {
            updatePayload.profilePicUrl = validatedData.profilePicUrl === null ? null : (validatedData.profilePicUrl || null);
        }
        if (validatedData.birthdate) {
            const dateParts = validatedData.birthdate.split("-");
            const year = parseInt(dateParts[0], 10);
            const month = parseInt(dateParts[1], 10) - 1; // JS months are 0-indexed
            const day = parseInt(dateParts[2], 10);
            if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
                updatePayload.birthdate = admin.firestore.Timestamp.fromDate(new Date(year, month, day));
            }
        }
        else if (validatedData.birthdate === null || validatedData.birthdate === "") {
            updatePayload.birthdate = null; // Explicitly set to null if client sends empty or null
        }
        await profileRef.update(updatePayload);
        return { success: true, message: "Profile updated successfully." };
    }
    catch (error) {
        console.error(`[updateUserProfileCallable] Error updating profile for user ${userId}:`, error);
        if (error instanceof zod_1.z.ZodError) {
            throw new https_1.HttpsError("invalid-argument", `Validation failed: ${error.errors.map((e) => e.message).join(", ")}`);
        }
        const message = error instanceof Error ? error.message : "Failed to update profile.";
        throw new https_1.HttpsError("internal", message);
    }
});
// Schema for AI Symbol (matches structure from Genkit flow output)
// This is used for the `aiSymbolsDetected` field.
const AiSymbolSchemaCallable = zod_1.z.object({
    symbolName: zod_1.z.string(),
    symbolDescription: zod_1.z.string(),
    truePositionInCup: zod_1.z.string(),
    "bestSeenInView(s)": zod_1.z.string(),
    appearanceNotes: zod_1.z.string().optional(),
    traditionalMeaning: zod_1.z.string(),
    origin: zod_1.z.enum(['user-identified and confirmed', 'ai-discovered'])
});
// Zod schema for input validation for saveReadingDataCallable
const SaveReadingDataCallableInputSchema = zod_1.z.object({
    imageStorageUrls: zod_1.z.array(zod_1.z.string().url()),
    aiSymbolsDetected: zod_1.z.array(AiSymbolSchemaCallable),
    aiInterpretation: zod_1.z.string(),
    userQuestion: zod_1.z.string().optional().nullable(),
    userSymbolNames: zod_1.z.array(zod_1.z.string()).optional().nullable(),
});
exports.saveReadingDataCallable = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "The function must be called while authenticated.");
    }
    const userId = request.auth.uid;
    const data = request.data;
    try {
        const validatedData = SaveReadingDataCallableInputSchema.parse(data);
        const readingDocData = {
            userId,
            readingDate: admin.firestore.FieldValue.serverTimestamp(),
            photoStorageUrls: validatedData.imageStorageUrls,
            aiSymbolsDetected: validatedData.aiSymbolsDetected,
            aiInterpretation: validatedData.aiInterpretation,
            userQuestion: validatedData.userQuestion || null,
            userSymbolNames: validatedData.userSymbolNames || [],
            manualSymbolsDetected: [],
            manualInterpretation: "",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        const readingRef = await adminDb.collection('readings').add(readingDocData);
        const profileRef = adminDb.collection('profiles').doc(userId);
        const profileSnap = await profileRef.get();
        if (profileSnap.exists) {
            await profileRef.update({
                numberOfReadings: admin.firestore.FieldValue.increment(1),
                lastReadingDate: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        else {
            console.warn(`[saveReadingDataCallable] Profile not found for user ${userId}. Cannot update reading stats.`);
        }
        return { success: true, readingId: readingRef.id, message: "Reading saved successfully." };
    }
    catch (error) {
        console.error(`[saveReadingDataCallable] Error saving reading for user ${userId}:`, error);
        if (error instanceof zod_1.z.ZodError) {
            throw new https_1.HttpsError("invalid-argument", `Validation failed: ${error.errors.map((e) => e.message).join(", ")}`);
        }
        const message = error instanceof Error ? error.message : "Failed to save reading.";
        throw new https_1.HttpsError("internal", message);
    }
});
// ---- Submit Roxy Reading Request Callable ----
const SubmitRoxyReadingRequestCallableInputSchema = zod_1.z.object({
    userEmail: zod_1.z.string().email("Valid email is required for the request."),
    originalReadingId: zod_1.z.string().optional().nullable(),
});
exports.submitRoxyReadingRequestCallable = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "The function must be called while authenticated.");
    }
    const userId = request.auth.uid;
    const data = request.data;
    try {
        const validatedData = SubmitRoxyReadingRequestCallableInputSchema.parse(data);
        let assignedTassologistId = undefined;
        let tassologistEmailForNotification = undefined;
        const tassologistsQuery = adminDb.collection('profiles').where('role', '==', 'tassologist').limit(1);
        const tassologistsSnapshot = await tassologistsQuery.get();
        if (!tassologistsSnapshot.empty) {
            const tassologistDoc = tassologistsSnapshot.docs[0];
            assignedTassologistId = tassologistDoc.id;
            tassologistEmailForNotification = tassologistDoc.data().email;
        }
        else {
            console.warn("[submitRoxyReadingRequestCallable] No tassologist found. Request will be created without assignment.");
        }
        const requestDocData = {
            userId,
            userEmail: validatedData.userEmail,
            requestDate: admin.firestore.FieldValue.serverTimestamp(),
            status: 'new',
            price: 50,
            paymentStatus: 'pending',
            userSatisfaction: null,
            tassologistId: assignedTassologistId || null,
            originalReadingId: validatedData.originalReadingId || null,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            dictatedAudioGcsUri: null,
            transcriptionOperationId: null,
            transcriptionStatus: 'not_requested',
            transcriptionError: null,
        };
        const requestRef = await adminDb.collection('personalizedReadings').add(requestDocData);
        if (tassologistEmailForNotification) {
            const subject = `New Personalized Reading Request - ID: ${requestRef.id}`;
            const htmlBody = `
        <p>Hello Roxy,</p>
        <p>A new personalized tea leaf reading request has been submitted.</p>
        <ul>
          <li><strong>Request ID:</strong> ${requestRef.id}</li>
          <li><strong>User Email:</strong> ${validatedData.userEmail}</li>
          ${validatedData.originalReadingId ? `<li><strong>Original AI Reading ID:</strong> ${validatedData.originalReadingId}</li>` : ''}
        </ul>
        <p>Please log in to the Tassologist Dashboard to view and process this request.</p>
        <p>Thank you,<br/>Sip-n-Read System</p>
      `;
            await adminDb.collection('mail').add({
                to: [tassologistEmailForNotification],
                message: { subject, html: htmlBody },
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        return { success: true, requestId: requestRef.id, message: "Personalized reading request submitted successfully." };
    }
    catch (error) {
        console.error(`[submitRoxyReadingRequestCallable] Error submitting request for user ${userId}:`, error);
        if (error instanceof zod_1.z.ZodError) {
            throw new https_1.HttpsError("invalid-argument", `Validation failed: ${error.errors.map((e) => e.message).join(", ")}`);
        }
        const message = error instanceof Error ? error.message : "Failed to submit personalized reading request.";
        throw new https_1.HttpsError("internal", message);
    }
});
// ---- Save Tassologist Interpretation Callable ----
const ManualSymbolCallableSchema = zod_1.z.object({
    symbol: zod_1.z.string(),
    position: zod_1.z.number().optional(),
});
const StoredManualSymbolSchema = zod_1.z.object({
    symbolName: zod_1.z.string(),
    truePositionInCup: zod_1.z.string(),
});
const SaveTassologistInterpretationCallableInputSchema = zod_1.z.object({
    requestId: zod_1.z.string().min(1),
    originalReadingId: zod_1.z.string().min(1),
    manualSymbols: zod_1.z.array(ManualSymbolCallableSchema),
    manualInterpretation: zod_1.z.string().min(1, "Interpretation cannot be empty."),
    saveType: zod_1.z.enum(['complete', 'draft']),
});
exports.saveTassologistInterpretationCallable = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "The function must be called by an authenticated Tassologist.");
    }
    const data = request.data;
    try {
        const validatedData = SaveTassologistInterpretationCallableInputSchema.parse(data);
        const batch = adminDb.batch();
        const currentTime = admin.firestore.FieldValue.serverTimestamp();
        const readingDocRef = adminDb.collection('readings').doc(validatedData.originalReadingId);
        const symbolsToStore = validatedData.manualSymbols.map(ms => ({
            symbolName: ms.symbol,
            truePositionInCup: (ms.position !== undefined && ms.position !== null && ms.position !== 0) ? `${ms.position} o'clock` : 'General area',
        }));
        batch.update(readingDocRef, {
            manualSymbolsDetected: symbolsToStore,
            manualInterpretation: validatedData.manualInterpretation,
            updatedAt: currentTime,
        });
        const requestDocRef = adminDb.collection('personalizedReadings').doc(validatedData.requestId);
        let newStatus = 'in-progress';
        const requestUpdates = {
            updatedAt: currentTime,
            transcriptionError: null
        };
        if (validatedData.saveType === 'complete') {
            newStatus = 'completed';
            requestUpdates.completionDate = currentTime;
            const currentRequestSnap = await requestDocRef.get();
            if (currentRequestSnap.exists) {
                const currentRequestData = currentRequestSnap.data();
                if (currentRequestData && currentRequestData.transcriptionStatus === 'pending') {
                    requestUpdates.transcriptionStatus = 'completed';
                }
            }
        }
        requestUpdates.status = newStatus;
        batch.update(requestDocRef, requestUpdates);
        await batch.commit();
        if (validatedData.saveType === 'complete') {
            const reqSnap = await requestDocRef.get();
            if (reqSnap.exists) {
                const completedRequestData = reqSnap.data();
                if (completedRequestData && completedRequestData.userEmail) {
                    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002';
                    let readingUrl = `${appUrl}/my-readings`;
                    if (validatedData.originalReadingId) {
                        readingUrl = `${appUrl}/my-readings/${validatedData.originalReadingId}?roxyRequestId=${validatedData.requestId}`;
                    }
                    const subject = "Your Sip-n-Read Personalized Reading is Ready!";
                    const htmlBody = `
            <p>Hello,</p>
            <p>Great news! Your personalized tea leaf reading from Roxy O'Reilly is now complete and ready for you to view.</p>
            <p>You can access your reading by clicking the link below:</p>
            <p><a href="${readingUrl}" style="background-color: #FFB81D; color: #404348; padding: 12px 20px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block; font-family: Arial, sans-serif; font-size: 16px;">View Your Reading</a></p>
            <p style="margin-top: 15px;">If the button doesn't work, copy and paste this URL into your browser:</p>
            <p>${readingUrl}</p>
            <p>We hope you find insight and enjoyment in your reading.</p>
            <p>Warmly,<br/>The Sip-n-Read Team</p>
          `;
                    await adminDb.collection('mail').add({
                        to: [completedRequestData.userEmail],
                        message: { subject, html: htmlBody },
                        createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    });
                }
            }
        }
        return { success: true, message: `Interpretation ${validatedData.saveType === 'complete' ? 'completed' : 'draft saved'}.` };
    }
    catch (error) {
        console.error(`[saveTassologistInterpretationCallable] Error:`, error);
        if (error instanceof zod_1.z.ZodError) {
            throw new https_1.HttpsError("invalid-argument", `Validation failed: ${error.errors.map((e) => e.message).join(", ")}`);
        }
        const message = error instanceof Error ? error.message : "Failed to save Tassologist interpretation.";
        throw new https_1.HttpsError("internal", message);
    }
});
// ---- Mark Personalized Reading As Read Callable ----
const MarkPersonalizedReadingAsReadCallableInputSchema = zod_1.z.object({
    requestId: zod_1.z.string().min(1),
});
exports.markPersonalizedReadingAsReadCallable = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "The function must be called while authenticated.");
    }
    const userId = request.auth.uid;
    const data = request.data;
    try {
        const validatedData = MarkPersonalizedReadingAsReadCallableInputSchema.parse(data);
        const requestDocRef = adminDb.collection('personalizedReadings').doc(validatedData.requestId);
        const requestDocSnap = await requestDocRef.get();
        if (!requestDocSnap.exists) {
            throw new https_1.HttpsError("not-found", "Personalized reading request not found.");
        }
        const requestData = requestDocSnap.data();
        if (!requestData || requestData.userId !== userId) {
            throw new https_1.HttpsError("permission-denied", "You do not have permission to update this reading request.");
        }
        if (requestData.status === 'completed') {
            await requestDocRef.update({
                status: 'read',
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            return { success: true, message: "Reading marked as read." };
        }
        else if (requestData.status === 'read') {
            return { success: true, message: "Reading was already marked as read." };
        }
        else {
            throw new https_1.HttpsError("failed-precondition", `Reading request status is '${requestData.status}', cannot mark as read yet.`);
        }
    }
    catch (error) {
        console.error(`[markPersonalizedReadingAsReadCallable] Error for user ${userId}, request ${data.requestId}:`, error);
        if (error instanceof zod_1.z.ZodError) {
            throw new https_1.HttpsError("invalid-argument", `Validation failed: ${error.errors.map((e) => e.message).join(", ")}`);
        }
        if (error instanceof https_1.HttpsError)
            throw error;
        const message = error instanceof Error ? error.message : "Failed to update reading status.";
        throw new https_1.HttpsError("internal", message);
    }
});
// ---- Process and Transcribe Audio Callable ----
const ProcessAndTranscribeAudioCallableInputSchema = zod_1.z.object({
    audioBase64: zod_1.z.string().min(1, "Audio data is required."),
    personalizedReadingRequestId: zod_1.z.string().min(1, "Personalized reading request ID is required."),
    mimeType: zod_1.z.string().min(1, "MIME type is required (e.g., audio/webm).")
});
const processAudioCallableOptions = {
    cors: true,
};
exports.processAndTranscribeAudioCallable = (0, https_1.onCall)(processAudioCallableOptions, async (callableRequest) => {
    console.log('[processAndTranscribeAudioCallable] INVOKED (Simplified for Debugging).');
    if (!callableRequest.auth) {
        console.error("[processAndTranscribeAudioCallable] Authentication failed: No auth context.");
        throw new https_1.HttpsError("unauthenticated", "The function must be called by an authenticated Tassologist.");
    }
    const tassologistId = callableRequest.auth.uid;
    const data = callableRequest.data;
    console.log(`[processAndTranscribeAudioCallable] Received data for request ID: ${data?.personalizedReadingRequestId}, Tassologist: ${tassologistId}, MIME Type: ${data?.mimeType}`);
    // ---- SIMPLIFIED LOGIC FOR DEBUGGING ----
    try {
        // Simulate some work
        await new Promise(resolve => setTimeout(resolve, 50)); // Short delay
        console.log('[processAndTranscribeAudioCallable] Simplified logic returning dummy success.');
        return { success: true, operationName: "dummy-operation-" + Date.now(), message: "Audio processed (dummy) and transcription started (dummy)." };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error in simplified logic";
        const errorStack = error instanceof Error ? error.stack : undefined;
        let errorDetails;
        if (typeof error === 'object' && error !== null && 'details' in error) {
            errorDetails = error.details;
        }
        console.error(`[processAndTranscribeAudioCallable] CRITICAL ERROR (Simplified Debugging Catch) for Tassologist ${tassologistId}, request ${data?.personalizedReadingRequestId || 'UNKNOWN_REQUEST_ID'}:`, errorMessage, errorStack, errorDetails);
        console.error(`[processAndTranscribeAudioCallable] RAW ERROR OBJECT (Simplified Debugging Catch):`, JSON.stringify(error, Object.getOwnPropertyNames(error)));
        throw new https_1.HttpsError("internal", "Simplified function encountered an error: " + errorMessage);
    }
    // ---- ORIGINAL LOGIC COMMENTED OUT FOR DEBUGGING ----
    /*
    if (!speechClient || !storage) {
      console.error('[processAndTranscribeAudioCallable] CRITICAL: SpeechClient or Storage client not initialized. Function cannot proceed.');
      throw new HttpsError("internal", "Core services not initialized. Check server logs.");
    }
  
    if (!callableRequest.auth) {
      console.error("[processAndTranscribeAudioCallable] Authentication failed: No auth context.");
      throw new HttpsError("unauthenticated", "The function must be called by an authenticated Tassologist.");
    }
    // const tassologistId = callableRequest.auth.uid;
    // const data = callableRequest.data as ProcessAndTranscribeAudioCallableInput;
    // console.log(`[processAndTranscribeAudioCallable] Received data for request ID: ${data.personalizedReadingRequestId}, Tassologist: ${tassologistId}, MIME Type: ${data.mimeType}`);
  
    try {
      const validatedData = ProcessAndTranscribeAudioCallableInputSchema.parse(data);
      console.log('[processAndTranscribeAudioCallable] Data validated successfully.');
  
      const { audioBase64, personalizedReadingRequestId, mimeType } = validatedData;
  
      const GCLOUD_STORAGE_BUCKET_ENV = process.env.GCLOUD_STORAGE_BUCKET;
      const GCP_PROJECT_ENV = process.env.GCP_PROJECT;
      const GOOGLE_CLOUD_PROJECT_ENV = process.env.GOOGLE_CLOUD_PROJECT;
  
      console.log(`[processAndTranscribeAudioCallable] ENV Vars: GCLOUD_STORAGE_BUCKET=${GCLOUD_STORAGE_BUCKET_ENV}, GCP_PROJECT=${GCP_PROJECT_ENV}, GOOGLE_CLOUD_PROJECT=${GOOGLE_CLOUD_PROJECT_ENV}`);
  
      const bucketName = GCLOUD_STORAGE_BUCKET_ENV || `${GCP_PROJECT_ENV || GOOGLE_CLOUD_PROJECT_ENV}.appspot.com`;
  
      if (!bucketName || bucketName.includes("undefined") || bucketName === ".appspot.com") {
          console.error("[processAndTranscribeAudioCallable] GCS bucket name could not be determined or is invalid. Ensure GCLOUD_STORAGE_BUCKET or GCP_PROJECT/GOOGLE_CLOUD_PROJECT env var is set. Current bucketName:", bucketName);
          throw new HttpsError("internal", "Storage bucket configuration error. Bucket name missing or invalid.");
      }
      console.log(`[processAndTranscribeAudioCallable] Using bucket: ${bucketName}`);
  
      const audioBuffer = Buffer.from(audioBase64, 'base64');
      const audioFileExtension = mimeType.split('/')[1] || 'webm';
      const audioFileName = `dictation-${Date.now()}.${audioFileExtension}`;
      const gcsFilePath = `tassologist-dictations-callable/${personalizedReadingRequestId}/${audioFileName}`;
  
      console.log(`[processAndTranscribeAudioCallable] Uploading audio to gs://${bucketName}/${gcsFilePath}`);
  
      const file = storage.bucket(bucketName).file(gcsFilePath);
      await file.save(audioBuffer, {
        metadata: { contentType: mimeType },
      });
  
      const gcsUri = `gs://${bucketName}/${gcsFilePath}`;
      console.log(`[processAndTranscribeAudioCallable] Audio uploaded successfully to: ${gcsUri}`);
  
      const audio = { uri: gcsUri };
      const configRec = {
        languageCode: 'en-US',
        enableAutomaticPunctuation: true,
        model: 'long',
        audioChannelCount: 1,
        enableWordTimeOffsets: false,
      };
      const requestPayload = {
        audio: audio,
        config: configRec,
      };
  
      console.log(`[processAndTranscribeAudioCallable] Submitting longRunningRecognize request for GCS URI: ${gcsUri} with payload:`, JSON.stringify(requestPayload));
      const [operation] = await speechClient.longRunningRecognize(requestPayload);
      console.log(`[processAndTranscribeAudioCallable] Transcription operation started successfully: ${operation.name} for GCS URI: ${gcsUri}`);
  
      const requestDocRef = adminDb.collection('personalizedReadings').doc(personalizedReadingRequestId);
      console.log(`[processAndTranscribeAudioCallable] Updating Firestore document: ${personalizedReadingRequestId} with operation ID ${operation.name}`);
      await requestDocRef.update({
        dictatedAudioGcsUri: gcsUri,
        transcriptionOperationId: operation.name,
        transcriptionStatus: 'pending',
        transcriptionError: null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log(`[processAndTranscribeAudioCallable] Firestore update successful for ${personalizedReadingRequestId}`);
  
      console.log('[processAndTranscribeAudioCallable] Function completed successfully, returning to client.');
      return { success: true, operationName: operation.name, message: "Audio processed and transcription started." };
  
    } catch (error: unknown) {
      const tassologistIdForError = callableRequest?.auth?.uid || 'UNKNOWN_TASSOLOGIST';
      let requestIdForError = 'UNKNOWN_REQUEST_ID';
      if (typeof callableRequest?.data === 'object' && callableRequest.data !== null && 'personalizedReadingRequestId' in callableRequest.data) {
          requestIdForError = (callableRequest.data as ProcessAndTranscribeAudioCallableInput).personalizedReadingRequestId;
      }
      
  
      console.error(`[processAndTranscribeAudioCallable] RAW ERROR OBJECT:`, JSON.stringify(error, Object.getOwnPropertyNames(error)));
      if (error instanceof Error) {
          console.error(`[processAndTranscribeAudioCallable] CRITICAL ERROR for Tassologist ${tassologistIdForError}, request ${requestIdForError}:`, error.message, error.stack, (error as {details?: unknown}).details);
      } else {
          console.error(`[processAndTranscribeAudioCallable] CRITICAL ERROR for Tassologist ${tassologistIdForError}, request ${requestIdForError}: Non-Error object thrown:`, error);
      }
  
  
      let errorMessage = "Failed to process audio and start transcription. Please check server logs for details.";
  
      if (error instanceof z.ZodError) {
        errorMessage = `Validation failed: ${error.errors.map((e) => e.message).join(", ")}`;
        console.error("[processAndTranscribeAudioCallable] ZodError:", errorMessage);
        throw new HttpsError("invalid-argument", errorMessage);
      }
      
      // Using type assertion for gcpError
      const gcpError = error as {code?: string | number; message?: string; details?: string};
  
      if (gcpError.code === 'storage/object-not-found') {
        errorMessage = "GCS object not found after upload attempt, or bucket issue.";
      } else if (gcpError.message && (gcpError.message.includes("SpeechClient") || gcpError.message.includes("speech.googleapis.com"))) {
        errorMessage = `Speech API error: ${gcpError.message}`;
      } else if (gcpError.code && typeof gcpError.code === 'number') {
          errorMessage = `gRPC Error Code ${gcpError.code}: ${gcpError.message || gcpError.details || 'Unknown gRPC error'}`;
      } else if (gcpError.message) {
        errorMessage = gcpError.message;
      }
  
      console.error(`[processAndTranscribeAudioCallable] Determined error message for HttpsError: ${errorMessage}`);
  
      if (requestIdForError !== 'UNKNOWN_REQUEST_ID') {
          try {
              console.log(`[processAndTranscribeAudioCallable] Attempting to update Firestore for request ${requestIdForError} with failed status due to error: ${errorMessage.substring(0, 500)}`);
              const requestDocRef = adminDb.collection('personalizedReadings').doc(requestIdForError);
              await requestDocRef.update({
                  transcriptionStatus: 'failed',
                  transcriptionError: errorMessage.substring(0, 500),
                  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              });
              console.log(`[processAndTranscribeAudioCallable] Firestore updated with failed status for request ${requestIdForError}.`);
          } catch (firestoreError: unknown) {
              const fsErrorMessage = firestoreError instanceof Error ? firestoreError.message : String(firestoreError);
              const fsErrorStack = firestoreError instanceof Error ? firestoreError.stack : undefined;
              console.error(`[processAndTranscribeAudioCallable] ADDITIONALLY FAILED to update Firestore with error status for request ${requestIdForError}:`, fsErrorMessage, fsErrorStack);
          }
      } else {
          console.warn(`[processAndTranscribeAudioCallable] personalizedReadingRequestId not available in error handler. Cannot update Firestore status.`);
      }
  
      console.log(`[processAndTranscribeAudioCallable] Throwing HttpsError to client with message: ${errorMessage}`);
      throw new HttpsError("internal", errorMessage);
    }
    */
});
//# sourceMappingURL=index.js.map