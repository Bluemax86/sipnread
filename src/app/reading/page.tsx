
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { InterpretationDisplay } from '@/components/sipnread/InterpretationDisplay';
import type { AiAnalysisResult } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, AlertCircle, ArrowLeft, BookOpenText, Wand2, Gem, Send, Brain, Volume2, VolumeX, CheckCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { getFunctions, httpsCallable, type HttpsCallableResult } from 'firebase/functions';
import { app as firebaseApp, db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore'; 
import type { SubmitRoxyReadingRequestCallableInput } from '@/../functions/src';

interface StoredReadingResult extends AiAnalysisResult {
  readingId?: string;
}

export default function ReadingPage() {
  const [reading, setReading] = useState<StoredReadingResult | null>(null);
  const [isLoadingStorage, setIsLoadingStorage] = useState(true);
  const [showRoxyDialog, setShowRoxyDialog] = useState(false);
  const [isSubmittingRoxyRequest, setIsSubmittingRoxyRequest] = useState(false);
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const backgroundAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isMuted, setIsMuted] = useState(false); 

  // const [readingAudioUrls, setReadingAudioUrls] = useState<string[]>([]); // Removed, use selectedReadingAudioUrl
  const [selectedReadingAudioUrl, setSelectedReadingAudioUrl] = useState<string | null>(null);
  const [isAudioConfigLoading, setIsAudioConfigLoading] = useState(true);

  const [showInterpretation, setShowInterpretation] = useState(false); // New state

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedResult = localStorage.getItem('teaLeafReadingResult');
      if (storedResult) {
        try {
          const parsedResult = JSON.parse(storedResult) as StoredReadingResult;
          setReading(parsedResult);
        } catch (error) {
          console.error("Error parsing reading from localStorage:", error);
          setReading({ error: "Could not load your reading. Please try again." });
        }
      }
      setIsLoadingStorage(false);
    }
  }, []);

  useEffect(() => {
    const fetchAudioTracks = async () => {
      setIsAudioConfigLoading(true);
      try {
        const readingDocRef = doc(db, 'audioTracks', 'reading');
        const readingDocSnap = await getDoc(readingDocRef);

        if (readingDocSnap.exists()) {
          const data = readingDocSnap.data();
          if (data.audioURLs && Array.isArray(data.audioURLs) && data.audioURLs.every((url: unknown) => typeof url === 'string' && (url as string).trim() !== '')) {
            // setReadingAudioUrls(data.audioURLs as string[]); // Removed
            if (data.audioURLs.length > 0) {
              const randomIndex = Math.floor(Math.random() * data.audioURLs.length);
              setSelectedReadingAudioUrl(data.audioURLs[randomIndex] as string);
            } else {
              setSelectedReadingAudioUrl(null);
              console.warn("Audio document 'reading' has an empty 'audioURLs' array.");
            }
          } else {
            setSelectedReadingAudioUrl(null);
            console.warn("Audio document 'reading' is missing 'audioURLs' array or it's malformed.");
          }
        } else {
          setSelectedReadingAudioUrl(null);
          console.warn("Audio document 'reading' not found in 'audioTracks' collection.");
        }
      } catch (error) {
        console.error("Error fetching 'reading' audio tracks:", error);
        setSelectedReadingAudioUrl(null);
      } finally {
        setIsAudioConfigLoading(false);
      }
    };
    fetchAudioTracks();
  }, []);

  useEffect(() => {
    const audio = backgroundAudioRef.current;
    if (showInterpretation && audio && selectedReadingAudioUrl && !isAudioConfigLoading) {
      audio.muted = isMuted;
      if (audio.paused) {
        audio.play().catch(error => {
          console.warn("Background audio autoplay prevented after interaction. User might need to unmute or browser settings are blocking it.", error);
        });
      }
    } else if (!showInterpretation && audio) {
      audio.pause(); // Ensure audio stops if interpretation is hidden
    }
    // Cleanup on unmount
    return () => {
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
    };
  }, [isMuted, showInterpretation, selectedReadingAudioUrl, isAudioConfigLoading]);


  const handleViewReadingClick = () => {
    setShowInterpretation(true);
    // Audio playback will be handled by the useEffect above when showInterpretation becomes true
  };

  const toggleMute = () => {
    const audio = backgroundAudioRef.current;
    if (!audio) return;

    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    audio.muted = newMutedState;

    if (!newMutedState && audio.paused && showInterpretation) { // Only play if interpretation is shown
      audio.play().catch(error => {
        console.warn("Playback attempt after unmute failed:", error);
        toast({
          variant: "default",
          title: "Audio Playback",
          description: "Could not start audio. Your browser might require another click on the unmute button or interaction with the page.",
        });
      });
    }
  };

  const handleRequestRoxyReading = async () => {
    if (!user || !user.email) {
      toast({
        variant: "destructive",
        title: "Authentication Required",
        description: "You must be logged in and have an email associated with your account to request a personalized reading.",
      });
      return;
    }
    if (!reading?.readingId) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "The original reading ID is missing. Cannot submit request.",
      });
      return;
    }

    setIsSubmittingRoxyRequest(true);
    try {
      const functions = getFunctions(firebaseApp);
      const submitRoxyReadingRequest = httpsCallable<
        SubmitRoxyReadingRequestCallableInput,
        { success: boolean; requestId?: string; message?: string }
      >(functions, 'submitRoxyReadingRequestCallable');

      const payload: SubmitRoxyReadingRequestCallableInput = {
        userEmail: user.email,
        originalReadingId: reading.readingId,
      };

      const result: HttpsCallableResult<{ success: boolean; requestId?: string; message?: string }> = await submitRoxyReadingRequest(payload);

      if (result.data.success && result.data.requestId) {
        setShowRoxyDialog(true);
      } else {
        toast({
          variant: "destructive",
          title: "Request Failed",
          description: result.data.message || "Could not submit your request. Please try again.",
        });
      }
    } catch (error: unknown) {
      console.error("Error calling submitRoxyReadingRequestCallable:", error);
      toast({
        variant: "destructive",
        title: "Request Error",
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
      });
    } finally {
      setIsSubmittingRoxyRequest(false);
    }
  };

  if (authLoading || isLoadingStorage || isAudioConfigLoading) {
    return (
      <div className="container mx-auto min-h-screen flex flex-col items-center justify-center py-8">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg mt-4 text-muted-foreground">
          {authLoading ? "Authenticating..." : (isLoadingStorage ? "Loading your reading..." : "Preparing ambience...")}
        </p>
      </div>
    );
  }

  if (!reading || (!reading.aiInterpretation && !reading.error && !showInterpretation)) {
     // This case means localStorage might be empty or page loaded directly without a result.
     // Show the "Ready to View" button if we have a reading ID (meaning it was likely set from a previous session)
     // or if we expect the user to proceed to get a new reading.
     // For now, if !reading, show the generic "No reading found"
    return (
      <div className="container mx-auto min-h-screen flex flex-col items-center justify-center py-8 text-center">
        <Wand2 className="mx-auto h-16 w-16 text-primary mb-4" />
        <Alert variant="default" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No Active Reading Found</AlertTitle>
          <AlertDescription>
            It seems there isn't an active reading session. Please start by getting a new reading.
          </AlertDescription>
        </Alert>
        <Button onClick={() => router.push('/get-reading')} className="mt-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Get a New Reading
        </Button>
         <footer className="text-center mt-12 py-6 text-sm text-muted-foreground absolute bottom-0">
            <p>&copy; {new Date().getFullYear()} Sip-n-Read. All mystical rights reserved.</p>
        </footer>
      </div>
    );
  }


  return (
    <div className="container mx-auto min-h-screen flex flex-col items-center py-8 selection:bg-accent selection:text-accent-foreground">
      <audio ref={backgroundAudioRef} src={selectedReadingAudioUrl || undefined} loop key={selectedReadingAudioUrl} />
      
      {!showInterpretation && reading && !reading.error && (
        <div className="w-full max-w-xl flex flex-col items-center justify-center flex-grow">
          <Card className="p-6 bg-card rounded-lg shadow-md text-center animate-fade-in">
            <CardHeader className="p-0 mb-4">
                <CheckCircle className="h-16 w-16 text-primary mx-auto mb-3" />
                <CardTitle className="text-3xl font-headline text-primary">Your Reading is Ready!</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <CardDescription className="text-card-foreground mb-6 text-base">
                    Your tea leaf interpretation has been generated and saved.
                </CardDescription>
                <Button onClick={handleViewReadingClick} size="lg" className="w-full">
                    <Send className="mr-2 h-5 w-5" />
                    View My Reading
                </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {showInterpretation && (
        <>
          <header className="mb-6 w-full max-w-xl flex flex-col items-center">
            <div className="w-full flex justify-between items-center mb-6">
                <Button onClick={() => router.push('/get-reading')} variant="outline" className="self-start">
                <ArrowLeft className="mr-2 h-4 w-4" />
                New Reading
                </Button>
                {selectedReadingAudioUrl && (
                    <Button onClick={toggleMute} variant="outline" size="icon" className="self-start" aria-label={isMuted ? "Unmute background audio" : "Mute background audio"}>
                    {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                    </Button>
                )}
            </div>
            <div className="flex items-center justify-center mb-4">
            <BookOpenText className="h-12 w-12 text-primary mr-3" />
            <h1 className="text-4xl md:text-5xl font-headline text-primary tracking-tight">Your Reading</h1>
            </div>
          </header>

          <main className="w-full max-w-xl space-y-8">
            {reading.error && (
            <Alert variant="destructive" className="animate-fade-in">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Reading Error</AlertTitle>
                <AlertDescription>{reading.error}</AlertDescription>
            </Alert>
            )}
            {reading.aiInterpretation && (
            <Card className="w-full shadow-md animate-fade-in">
                <CardHeader>
                <CardTitle className="font-headline text-xl flex items-center">
                    <Brain className="mr-2 h-6 w-6 text-primary" />
                    AI Interpretation
                </CardTitle>
                </CardHeader>
                <CardContent>
                <InterpretationDisplay
                    aiSymbolsDetected={reading.aiSymbolsDetected || []}
                    aiInterpretation={reading.aiInterpretation}
                />
                </CardContent>
            </Card>
            )}

            {reading.aiInterpretation && !reading.error && user && (
            <Card className="w-full shadow-lg animate-fade-in border-accent">
                <CardHeader className="flex flex-row items-center gap-3">
                <Gem className="h-10 w-10 text-accent" />
                <div>
                    <CardTitle className="font-headline text-2xl text-accent">
                    Want a Deeper Dive?
                    </CardTitle>
                    <CardDescription className="text-sm">Get a personalized reading from Roxy O&apos;Reilly!</CardDescription>
                </div>
                </CardHeader>
                <CardContent className="space-y-4">
                <p className="text-card-foreground leading-relaxed">
                    Our renowned in-house tassologist, Roxy O&apos;Reilly, offers bespoke interpretations.
                    For just $25, Roxy will personally analyze your tea leaves and provide a detailed,
                    intuitive reading tailored to you.
                </p>
                <Button
                    onClick={handleRequestRoxyReading}
                    disabled={isSubmittingRoxyRequest}
                    variant="default"
                    className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
                >
                    {isSubmittingRoxyRequest ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Submitting Request...
                    </>
                    ) : (
                    <>
                        <Send className="mr-2 h-5 w-5" />
                        Request Roxy&apos;s Reading ($25)
                    </>
                    )}
                </Button>
                </CardContent>
            </Card>
            )}
            <AlertDialog open={showRoxyDialog} onOpenChange={setShowRoxyDialog}>
                <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Thank You for Your Request!</AlertDialogTitle>
                    <AlertDialogDescription>
                    Your request for a personalized reading from Roxy O&apos;Reilly has been received.
                    Roxy will meticulously prepare your reading, and you&apos;ll receive an email
                    with the details within 1-2 business days. We&apos;ll notify you at the
                    email address associated with your account.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogAction onClick={() => {
                    setShowRoxyDialog(false);
                    router.push('/'); 
                    }}>
                    OK
                    </AlertDialogAction>
                </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
          </main>
        </>
      )}
       <footer className="text-center mt-12 py-6 text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} Sip-n-Read. All mystical rights reserved.</p>
      </footer>
    </div>
  );
}
    
