
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
import { app as firebaseApp } from '@/lib/firebase';
import type { SaveReadingDataCallableInput } from '@/../functions/src';


export default function GetReadingPage() {
  const [result, setResult] = useState<FullInterpretationResult | null>(null);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [isSavingReading, setIsSavingReading] = useState(false);
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const transitionContainerRef = useRef<HTMLDivElement>(null);
  const [selectedReadingTypeForDisplay, setSelectedReadingTypeForDisplay] = useState<string | null>(null); // Renamed for clarity

  const overallLoading = isLoadingAI || isSavingReading;

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const type = localStorage.getItem('selectedReadingType');
      setSelectedReadingTypeForDisplay(type); // Set for display purposes if needed
    }
  }, []);

  useEffect(() => {
    if (overallLoading && transitionContainerRef.current) {
      transitionContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [overallLoading]);

  const handleInterpretation = async (imageStorageUrls: string[], question?: string, userSymbolNames?: string[]) => {
    if (!user) {
      setResult({ error: "You must be logged in to get a reading." });
      return;
    }

    setIsLoadingAI(true);
    setIsSavingReading(false);
    setResult(null);
    localStorage.removeItem('teaLeafReadingResult');

    // Directly fetch readingType from localStorage for the action
    const currentReadingTypeFromStorage = typeof window !== 'undefined' ? localStorage.getItem('selectedReadingType') : null;

    try {
      // Step 1: Get AI Analysis
      const aiAnalysisResponse = await getTeaLeafAiAnalysisAction(
        user.uid,
        imageStorageUrls,
        question,
        userSymbolNames,
        currentReadingTypeFromStorage ?? undefined // Pass freshly fetched readingType
      );

      if (aiAnalysisResponse.error || !aiAnalysisResponse.aiInterpretation) {
        setResult({ error: aiAnalysisResponse.error || "Failed to get AI interpretation." });
        setIsLoadingAI(false);
        return;
      }
      setIsLoadingAI(false); 

      // Step 2: Save the reading data (including AI results) via Callable Function
      setIsSavingReading(true);
      const functions = getFunctions(firebaseApp);
      const saveReadingData = httpsCallable<SaveReadingDataCallableInput, { success: boolean; readingId?: string; message?: string }>(functions, 'saveReadingDataCallable');
      
      const saveDataPayload: SaveReadingDataCallableInput = {
        imageStorageUrls: aiAnalysisResponse.imageStorageUrls || imageStorageUrls,
        aiSymbolsDetected: aiAnalysisResponse.aiSymbolsDetected || [],
        aiInterpretation: aiAnalysisResponse.aiInterpretation,
        userQuestion: aiAnalysisResponse.userQuestion || null,
        userSymbolNames: aiAnalysisResponse.userSymbolNames || null,
        readingType: (aiAnalysisResponse.readingType as 'tea' | 'coffee' | 'tarot' | 'runes' | null | undefined) ?? undefined,
      };

      const saveResult: HttpsCallableResult<{ success: boolean; readingId?: string; message?: string }> = await saveReadingData(saveDataPayload);

      if (saveResult.data.success && saveResult.data.readingId) {
        const finalResult: FullInterpretationResult = {
          ...aiAnalysisResponse,
          readingId: saveResult.data.readingId,
          error: undefined,
        };
        setResult(finalResult);
        localStorage.setItem('teaLeafReadingResult', JSON.stringify(finalResult));
      } else {
        setResult({ 
            ...aiAnalysisResponse,
            error: saveResult.data.message || 'Failed to save reading data.' 
        });
      }
    } catch (error: unknown) {
      console.error("Error during interpretation or saving process:", error);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
      setResult({ error: errorMessage });
    } finally {
      setIsLoadingAI(false);
      setIsSavingReading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="container mx-auto min-h-screen flex flex-col items-center justify-center py-8">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg mt-4 text-muted-foreground">Loading authentication...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto min-h-screen flex flex-col items-center justify-center py-8 selection:bg-accent selection:text-accent-foreground">
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
              <ImageUploadForm onSubmit={handleInterpretation} isLoading={overallLoading} />
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
              {isSavingReading && (
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
