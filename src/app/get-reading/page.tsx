
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ImageUploadForm } from '@/components/sipnread/ImageUploadForm';
import { getTeaLeafAiAnalysisAction, type FullInterpretationResult } from '../actions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, Send, CheckCircle, Wand2, UserX, Brain, Database } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { getFunctions, httpsCallable, type HttpsCallableResult } from 'firebase/functions';
import { app as firebaseApp, db } from '@/lib/firebase';
import type { SaveReadingDataCallableInput, ReadingType } from '@/../functions/src';
import { collection, query, where, getDocs } from 'firebase/firestore';


export default function GetReadingPage() {
  const [result, setResult] = useState<FullInterpretationResult | null>(null);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [isSavingReading, setIsSavingReading] = useState(false);
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const transitionContainerRef = useRef<HTMLDivElement>(null);
  // selectedReadingTypeForDisplay is for UI only, not for critical data path.
  const [selectedReadingTypeForDisplay, setSelectedReadingTypeForDisplay] = useState<string | null>(null);

  const loadingAudioRef = useRef<HTMLAudioElement | null>(null);
  
  const [generatingAudioUrls, setGeneratingAudioUrls] = useState<string[]>([]);
  const [selectedAudioUrl, setSelectedAudioUrl] = useState<string | null>(null);
  const [isAudioConfigLoading, setIsAudioConfigLoading] = useState(true);

  const overallLoading = isLoadingAI || isSavingReading;

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const type = localStorage.getItem('selectedReadingType');
      setSelectedReadingTypeForDisplay(type);
    }
  }, []);

  useEffect(() => {
    const fetchAudioTracks = async () => {
      setIsAudioConfigLoading(true);
      try {
        const q = query(collection(db, 'audioTracks'), where('playOn', '==', 'generating'));
        const querySnapshot = await getDocs(q);
        const urls: string[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          if (data.audioURL && typeof data.audioURL === 'string') {
            urls.push(data.audioURL);
          }
        });
        setGeneratingAudioUrls(urls);
        if (urls.length > 0) {
          const randomIndex = Math.floor(Math.random() * urls.length);
          setSelectedAudioUrl(urls[randomIndex]);
        } else {
          setSelectedAudioUrl(null);
          console.warn("No audio tracks found for 'generating' state.");
        }
      } catch (error) {
        console.error("Error fetching 'generating' audio tracks:", error);
        setSelectedAudioUrl(null);
      } finally {
        setIsAudioConfigLoading(false);
      }
    };
    fetchAudioTracks();
  }, []);


  useEffect(() => {
    if (overallLoading && transitionContainerRef.current) {
      transitionContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [overallLoading]);

  useEffect(() => {
    const audioPlayer = loadingAudioRef.current;
    return () => {
      if (audioPlayer) {
        audioPlayer.pause();
        audioPlayer.currentTime = 0;
      }
    };
  }, []);


  const handleInterpretation = async (imageStorageUrls: string[], question?: string, userSymbolNames?: string[]) => {
    if (!user) {
      setResult({ error: "You must be logged in to get a reading." });
      return;
    }

    setIsLoadingAI(true);
    setIsSavingReading(false);
    setResult(null);
    localStorage.removeItem('teaLeafReadingResult');

    if (loadingAudioRef.current && selectedAudioUrl) {
        if(loadingAudioRef.current.src !== selectedAudioUrl) {
            loadingAudioRef.current.src = selectedAudioUrl;
            loadingAudioRef.current.load(); // Ensure new source is loaded
        }
      loadingAudioRef.current.currentTime = 0; 
      loadingAudioRef.current.volume = 1; 
      loadingAudioRef.current.play().catch(error => console.warn("Audio play failed:", error));
    } else if (!selectedAudioUrl) {
        console.warn("No audio track selected or available to play during AI processing.");
    }
    
    let aiAnalysisResponse: FullInterpretationResult | null = null;
    let saveSucceeded = false;
    let finalReadingId: string | undefined;
    let errorForState: string | undefined;

    try {
      const currentReadingTypeFromStorage = typeof window !== 'undefined' ? localStorage.getItem('selectedReadingType') : null;
      aiAnalysisResponse = await getTeaLeafAiAnalysisAction(
        user.uid,
        imageStorageUrls,
        question,
        userSymbolNames,
        currentReadingTypeFromStorage ?? undefined
      );

      if (aiAnalysisResponse.error || !aiAnalysisResponse.aiInterpretation) {
        errorForState = aiAnalysisResponse.error || "Failed to get AI interpretation.";
      } else {
        setIsSavingReading(true); 

        const functions = getFunctions(firebaseApp);
        const saveReadingData = httpsCallable<SaveReadingDataCallableInput, { success: boolean; readingId?: string; message?: string }>(functions, 'saveReadingDataCallable');
        
        const readingTypeForSave = typeof window !== 'undefined' ? localStorage.getItem('selectedReadingType') : null;
        let finalReadingTypeForPayload: ReadingType | null | undefined;
        const validReadingTypes: ReadingType[] = ['tea', 'coffee', 'tarot', 'runes'];

        if (readingTypeForSave && validReadingTypes.includes(readingTypeForSave as ReadingType)) {
            finalReadingTypeForPayload = readingTypeForSave as ReadingType;
        } else if (readingTypeForSave === null) { 
            finalReadingTypeForPayload = null;
        } else {
            finalReadingTypeForPayload = undefined; 
             if (readingTypeForSave !== null && readingTypeForSave !== undefined) {
              console.warn(`[GetReadingPage] Unexpected readingType ('${readingTypeForSave}') from localStorage during save. Defaulting to undefined for payload.`);
            }
        }
        
        const saveDataPayload: SaveReadingDataCallableInput = {
          imageStorageUrls: aiAnalysisResponse.imageStorageUrls || imageStorageUrls,
          aiSymbolsDetected: aiAnalysisResponse.aiSymbolsDetected || [],
          aiInterpretation: aiAnalysisResponse.aiInterpretation,
          userQuestion: aiAnalysisResponse.userQuestion || null,
          userSymbolNames: aiAnalysisResponse.userSymbolNames || null,
          readingType: finalReadingTypeForPayload,
        };

        const saveResult: HttpsCallableResult<{ success: boolean; readingId?: string; message?: string }> = await saveReadingData(saveDataPayload);

        if (saveResult.data.success && saveResult.data.readingId) {
          saveSucceeded = true;
          finalReadingId = saveResult.data.readingId;
        } else {
          errorForState = saveResult.data.message || 'Failed to save reading data.';
        }
      }
    } catch (e: unknown) { 
      console.error("Error during interpretation or saving process:", e);
      if (!errorForState) { 
         errorForState = e instanceof Error ? e.message : 'An unexpected error occurred.';
      }
    } finally {
      const performFinalActions = () => { // Removed async as fadeOutAudio is gone
        if (loadingAudioRef.current) {
          loadingAudioRef.current.pause();
          loadingAudioRef.current.currentTime = 0;
        }
        
        setIsLoadingAI(false);
        setIsSavingReading(false);

        if (saveSucceeded && aiAnalysisResponse && finalReadingId) {
          const finalResultForState: FullInterpretationResult = {
            ...aiAnalysisResponse,
            readingType: aiAnalysisResponse.readingType,
            readingId: finalReadingId,
            error: undefined,
          };
          setResult(finalResultForState);
          localStorage.setItem('teaLeafReadingResult', JSON.stringify(finalResultForState));
        } else {
          setResult({ 
            ...(aiAnalysisResponse || {}),
            readingType: aiAnalysisResponse?.readingType, 
            error: errorForState || "An unknown error occurred after processing." 
          });
        }
      };
      
      performFinalActions(); // Call directly, no delay logic needed
    }
  };

  if (authLoading || isAudioConfigLoading) {
    return (
      <div className="container mx-auto min-h-screen flex flex-col items-center justify-center py-8">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg mt-4 text-muted-foreground">
          {authLoading ? "Loading authentication..." : "Preparing mystical energies..."}
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto min-h-screen flex flex-col items-center justify-center py-8 selection:bg-accent selection:text-accent-foreground">
      <audio
        ref={loadingAudioRef}
        key={selectedAudioUrl} 
      />
      <header className="text-center mb-10">
        <Wand2 className="mx-auto h-16 w-16 text-primary mb-4" />
        <h1 className="text-5xl md:text-6xl font-headline text-primary mb-3 tracking-tight">Read Your Leaves</h1>
        <p className="text-lg md:text-xl text-muted-foreground">Upload images of your tea cup to begin.</p>
      </header>

      <main className="w-full max-w-xl space-y-8">
        {!user && !authLoading && (
          <Alert variant="destructive">
            <UserX className="h-4 w-4" />
            <AlertTitle>Authentication Required</AlertTitle>
            <AlertDescription>
              You need to be logged in to get a tea leaf reading. Please{' '}
              <Button variant="link" className="p-0 h-auto" onClick={() => router.push('/login')}>log in</Button> or{' '}
              <Button variant="link" className="p-0 h-auto" onClick={() => router.push('/signup')}>sign up</Button>.
            </AlertDescription>
          </Alert>
        )}

        {user && (
           <div ref={transitionContainerRef} className="relative min-h-[450px]">
            <div
              className={cn(
                "transition-opacity duration-300 ease-in-out",
                !overallLoading && !result ? "opacity-100" : "opacity-0 pointer-events-none absolute inset-0"
              )}
            >
              <ImageUploadForm onSubmit={handleInterpretation} isLoading={overallLoading || (!selectedAudioUrl && generatingAudioUrls.length > 0)} />
            </div>

            <div
              className={cn(
                "absolute inset-0 flex flex-col justify-center items-center p-6 bg-card rounded-lg shadow-md transition-opacity duration-300 ease-in-out",
                overallLoading ? "opacity-100" : "opacity-0 pointer-events-none"
              )}
            >
              {isLoadingAI && (
                <>
                  <Brain className="h-12 w-12 animate-pulse text-primary" />
                  <p className="ml-4 text-lg mt-4 text-muted-foreground">AI is interpreting your leaves...</p>
                </>
              )}
              {isSavingReading && !isLoadingAI && (
                <>
                  <Database className="h-12 w-12 animate-pulse text-primary" />
                  <p className="ml-4 text-lg mt-4 text-muted-foreground">Saving your reading...</p>
                </>
              )}
            </div>

            <div
              className={cn(
                "absolute inset-0 transition-opacity duration-300 ease-in-out",
                result && !overallLoading ? "opacity-100" : "opacity-0 pointer-events-none"
              )}
            >
              {(result && !overallLoading) && (
                <>
                  {result.error && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Reading Process Error</AlertTitle>
                      <AlertDescription>{result.error}</AlertDescription>
                       <Button onClick={() => { setResult(null); setIsLoadingAI(false); setIsSavingReading(false); }} variant="outline" className="mt-4">Try Again</Button>
                    </Alert>
                  )}
                  {result.aiInterpretation && result.readingId && !result.error && (
                    <div className="p-6 bg-card rounded-lg shadow-md text-center">
                      <CheckCircle className="h-12 w-12 text-primary mx-auto mb-4" />
                      <h3 className="text-2xl font-semibold text-primary mb-3">Your Reading is Ready!</h3>
                      <p className="text-card-foreground mb-6">Your tea leaf interpretation has been generated and saved.</p>
                      <Button onClick={() => router.push('/reading')} size="lg">
                        <Send className="mr-2 h-5 w-5" />
                        View My Reading
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </main>
      <footer className="text-center mt-12 py-6 text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} Sip-n-Read. All mystical rights reserved.</p>
      </footer>
    </div>
  );
}

    