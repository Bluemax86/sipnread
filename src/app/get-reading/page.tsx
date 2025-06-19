
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
// import Link from 'next/link'; // Link was unused
import { ImageUploadForm } from '@/components/sipnread/ImageUploadForm';
import { getTeaLeafAiAnalysisAction, type FullInterpretationResult } from '../actions';
// import { Button } from '@/components/ui/button'; // Button was unused
// import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'; // Card components were unused
import { Loader2, AlertCircle, Wand2, Brain, Database, LockKeyhole, LogIn, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button'; // Re-added for login/signup
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'; // Re-added for login prompt
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { getFunctions, httpsCallable, type HttpsCallableResult } from 'firebase/functions';
import { app as firebaseApp, db } from '@/lib/firebase';
import type { SaveReadingDataCallableInput, ReadingType } from '@/../functions/src';
import { doc, getDoc } from 'firebase/firestore';


export default function GetReadingPage() {
  const [result, setResult] = useState<FullInterpretationResult | null>(null); // Still used for error display
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [isSavingReading, setIsSavingReading] = useState(false);
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const transitionContainerRef = useRef<HTMLDivElement>(null);
  const loginPromptCardRef = useRef<HTMLDivElement>(null);

  const [selectedReadingTypeForDisplay, setSelectedReadingTypeForDisplay] = useState<string | null>(null);

  const loadingAudioRef = useRef<HTMLAudioElement | null>(null);
  const musicStartTimeRef = useRef<number | null>(null);

  // const [generatingAudioUrls, setGeneratingAudioUrls] = useState<string[]>([]); // Removed as it's specific to this page's audio
  const [selectedAudioUrl, setSelectedAudioUrl] = useState<string | null>(null);
  const [isAudioConfigLoading, setIsAudioConfigLoading] = useState(true);

  const [showLoginPromptCard, setShowLoginPromptCard] = useState(false);

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
        const generatingDocRef = doc(db, 'audioTracks', 'generating');
        const generatingDocSnap = await getDoc(generatingDocRef);

        if (generatingDocSnap.exists()) {
          const data = generatingDocSnap.data();
          if (data.audioURLs && Array.isArray(data.audioURLs) && data.audioURLs.every(url => typeof url === 'string' && url.trim() !== '')) {
            // setGeneratingAudioUrls(data.audioURLs); // Removed
            if (data.audioURLs.length > 0) {
              const randomIndex = Math.floor(Math.random() * data.audioURLs.length);
              setSelectedAudioUrl(data.audioURLs[randomIndex]);
            } else {
              setSelectedAudioUrl(null);
              console.warn("Audio document 'generating' has an empty 'audioURLs' array.");
            }
          } else {
            setSelectedAudioUrl(null);
            console.warn("Audio document 'generating' is missing 'audioURLs' array or it's malformed.");
          }
        } else {
          setSelectedAudioUrl(null);
          console.warn("Audio document 'generating' not found in 'audioTracks' collection.");
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
    if (!authLoading) {
      if (!user) {
        setShowLoginPromptCard(true);
      } else {
        setShowLoginPromptCard(false);
      }
    }
  }, [user, authLoading]);


  useEffect(() => {
    if (showLoginPromptCard && loginPromptCardRef.current) {
        loginPromptCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (overallLoading && transitionContainerRef.current) {
      transitionContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [overallLoading, showLoginPromptCard]);

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
      setResult(null);
      setIsLoadingAI(false);
      setIsSavingReading(false);
      setShowLoginPromptCard(true); 
      return;
    }
    setShowLoginPromptCard(false); 

    setIsLoadingAI(true);
    setIsSavingReading(false);
    setResult(null); // Clear previous errors
    localStorage.removeItem('teaLeafReadingResult');

    if (loadingAudioRef.current && selectedAudioUrl) {
        if(loadingAudioRef.current.src !== selectedAudioUrl) {
            loadingAudioRef.current.src = selectedAudioUrl;
            loadingAudioRef.current.load();
        }
      loadingAudioRef.current.currentTime = 0;
      loadingAudioRef.current.volume = 1;
      loadingAudioRef.current.loop = false;
      loadingAudioRef.current.play().catch(error => console.warn("Audio play failed:", error));
      musicStartTimeRef.current = Date.now();
    } else if (!selectedAudioUrl) {
        console.warn("No audio track selected or available to play during AI processing.");
        musicStartTimeRef.current = null;
    } else {
        musicStartTimeRef.current = Date.now();
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
        setIsLoadingAI(false);
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
      const performFinalActions = () => {
        setIsLoadingAI(false);
        setIsSavingReading(false);

        if (saveSucceeded && aiAnalysisResponse && finalReadingId) {
          const finalResultForStorage: FullInterpretationResult = {
            ...aiAnalysisResponse,
            readingType: aiAnalysisResponse.readingType, // Ensure readingType is included
            readingId: finalReadingId,
            error: undefined, 
          };
          localStorage.setItem('teaLeafReadingResult', JSON.stringify(finalResultForStorage));
          router.push('/reading'); // Navigate to reading page
        } else {
          // If there was an error, keep it in the 'result' state to display on this page
          setResult({
            ...(aiAnalysisResponse || {}), // Spread any partial AI response
            readingType: aiAnalysisResponse?.readingType,
            error: errorForState || "An unknown error occurred after processing."
          });
        }
      };

      const processingEndTime = Date.now();
      const musicStartedAt = musicStartTimeRef.current;
      const elapsedTimeMs = musicStartedAt ? processingEndTime - musicStartedAt : Infinity;
      const minDisplayTimeMs = 10000; 

      if (musicStartedAt && elapsedTimeMs < minDisplayTimeMs) {
        const delayMs = minDisplayTimeMs - elapsedTimeMs;
        setTimeout(performFinalActions, delayMs);
      } else {
        performFinalActions();
      }
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
        {showLoginPromptCard ? (
          <div ref={loginPromptCardRef} className="w-full max-w-xl">
            <Card className="shadow-lg animate-fade-in text-center">
              <CardHeader>
                <LockKeyhole className="mx-auto h-12 w-12 text-primary mb-3" />
                <CardTitle className="text-2xl font-headline">Unlock Your Personalized Reading</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-6">
                  Sign in or create a free account to receive your insightful readings, save your past sessions, and access exclusive features.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button onClick={() => router.push('/login')} className="w-full sm:w-auto">
                    <LogIn className="mr-2 h-4 w-4" /> Log In
                  </Button>
                  <Button onClick={() => router.push('/signup')} variant="secondary" className="w-full sm:w-auto">
                    <UserPlus className="mr-2 h-4 w-4" /> Create Account
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div ref={transitionContainerRef} className="relative min-h-[450px]">
            <div
              className={cn(
                "transition-opacity duration-300 ease-in-out",
                !overallLoading && !result ? "opacity-100" : "opacity-0 pointer-events-none absolute inset-0"
              )}
            >
              <ImageUploadForm onSubmit={handleInterpretation} isLoading={overallLoading || (!selectedAudioUrl && !isAudioConfigLoading)} />
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
            
            {/* Error display on this page if something went wrong before navigating */}
             {(result && result.error && !overallLoading) && (
                <Card className="w-full max-w-xl shadow-lg animate-fade-in text-center">
                    <CardHeader>
                    <AlertCircle className="mx-auto h-12 w-12 text-destructive mb-3" />
                    <CardTitle className="text-2xl font-headline text-destructive">Reading Process Error</CardTitle>
                    </CardHeader>
                    <CardContent>
                    <p className="text-muted-foreground mb-6">{result.error}</p>
                    <Button onClick={() => { setResult(null); setIsLoadingAI(false); setIsSavingReading(false); musicStartTimeRef.current = null; setShowLoginPromptCard(false); }} variant="outline">
                        Try Again
                    </Button>
                    </CardContent>
                </Card>
            )}
          </div>
        )}
      </main>
      <footer className="text-center mt-12 py-6 text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} Sip-n-Read. All mystical rights reserved.</p>
      </footer>
    </div>
  );
}
    
