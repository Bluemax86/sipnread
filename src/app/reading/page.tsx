
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { InterpretationDisplay } from '@/components/sipnread/InterpretationDisplay';
import type { AiAnalysisResult, ReadingType } from '@/app/actions'; // Added ReadingType
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
import { Loader2, AlertCircle, ArrowLeft, BookOpenText, Wand2, Gem, Send, Brain, Volume2, VolumeX, CheckCircle, Info, Coins } from 'lucide-react'; // Added Coins
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

  const [selectedReadingAudioUrl, setSelectedReadingAudioUrl] = useState<string | null>(null);
  const [isAudioConfigLoading, setIsAudioConfigLoading] = useState(true);
  const [showInterpretation, setShowInterpretation] = useState(false);

  const [currentReadingPrice, setCurrentReadingPrice] = useState<number | null>(null);
  const [isLoadingPrice, setIsLoadingPrice] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [selectedReadingType, setSelectedReadingType] = useState<ReadingType | null>(null);


  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedResult = localStorage.getItem('teaLeafReadingResult');
      const typeFromStorage = localStorage.getItem('selectedReadingType') as ReadingType | null;
      setSelectedReadingType(typeFromStorage);

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
    if (selectedReadingType && user && !authLoading) { // Fetch price only when type and user are known
      const fetchPrice = async () => {
        setIsLoadingPrice(true);
        setPriceError(null);
        try {
          const tileDocRef = doc(db, 'appTiles', selectedReadingType);
          const tileDocSnap = await getDoc(tileDocRef);
          if (tileDocSnap.exists()) {
            const tileData = tileDocSnap.data();
            if (typeof tileData.readingPrice === 'number' && tileData.readingPrice > 0) {
              setCurrentReadingPrice(tileData.readingPrice);
            } else {
              setPriceError(`Price not configured for ${selectedReadingType} readings or is invalid.`);
              setCurrentReadingPrice(null);
            }
          } else {
            setPriceError(`Configuration not found for ${selectedReadingType} readings.`);
            setCurrentReadingPrice(null);
          }
        } catch (error) {
          console.error(`Error fetching price for ${selectedReadingType}:`, error);
          setPriceError("Could not load pricing information.");
          setCurrentReadingPrice(null);
        } finally {
          setIsLoadingPrice(false);
        }
      };
      fetchPrice();
    } else if (!selectedReadingType && user && !authLoading) {
        setPriceError("Reading type not selected. Price cannot be determined.");
        setCurrentReadingPrice(null);
        setIsLoadingPrice(false);
    }
  }, [selectedReadingType, user, authLoading]);


  useEffect(() => {
    const audio = backgroundAudioRef.current;
    if (showInterpretation && audio && selectedReadingAudioUrl && !isAudioConfigLoading) {
      audio.muted = isMuted;
      if (audio.paused) {
        audio.play().catch(error => {
          console.warn("Background audio autoplay prevented. User might need to unmute or browser settings are blocking it.", error);
        });
      }
    } else if (!showInterpretation && audio) {
      audio.pause(); 
    }
    return () => {
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
    };
  }, [isMuted, showInterpretation, selectedReadingAudioUrl, isAudioConfigLoading]);


  const handleViewReadingClick = () => {
    setShowInterpretation(true);
  };

  const toggleMute = () => {
    const audio = backgroundAudioRef.current;
    if (!audio) return;

    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    audio.muted = newMutedState;

    if (!newMutedState && audio.paused && showInterpretation) { 
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
    if (currentReadingPrice === null || currentReadingPrice <= 0) {
      toast({
        variant: "destructive",
        title: "Pricing Error",
        description: priceError || "The price for this reading is not available. Cannot submit request.",
      });
      return;
    }
    if (!selectedReadingType) {
      toast({
        variant: "destructive",
        title: "Reading Type Error",
        description: "The reading type is not defined. Cannot submit request.",
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
        price: currentReadingPrice,
        readingType: selectedReadingType,
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

  const overallInitialLoading = authLoading || isLoadingStorage || isAudioConfigLoading;

  if (overallInitialLoading) {
    return (
      <div className="container mx-auto min-h-screen flex flex-col items-center justify-center py-8">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg mt-4 text-muted-foreground">
          {authLoading ? "Authenticating..." : (isLoadingStorage ? "Loading your reading..." : "Preparing ambience...")}
        </p>
      </div>
    );
  }

  if (!showInterpretation) {
    return (
        <div className="container mx-auto min-h-screen flex flex-col items-center justify-center py-8 text-center">
            <audio ref={backgroundAudioRef} src={selectedReadingAudioUrl || undefined} loop key={selectedReadingAudioUrl} />
            {reading && !reading.error && (
                 <Card className="p-6 bg-card rounded-lg shadow-md text-center animate-fade-in w-full max-w-xl">
                    <CardHeader className="p-0 mb-4">
                        <CheckCircle className="h-16 w-16 text-primary mx-auto mb-3" />
                        <CardTitle className="text-3xl font-headline text-primary">Your Reading is Ready!</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <CardDescription className="text-card-foreground mb-6 text-base">
                            Your AI interpretation has been generated and saved.
                        </CardDescription>
                        <Button onClick={handleViewReadingClick} size="lg" className="w-full">
                            <Send className="mr-2 h-5 w-5" />
                            View My Reading
                        </Button>
                    </CardContent>
                 </Card>
            )}
            {(!reading || reading.error) && (
                 <>
                    <Wand2 className="mx-auto h-16 w-16 text-primary mb-4" />
                    <Alert variant="default" className="max-w-md">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No Active Reading Found</AlertTitle>
                    <AlertDescription>
                        {reading?.error || "It seems there isn't an active reading session. Please start by getting a new reading."}
                    </AlertDescription>
                    </Alert>
                    <Button onClick={() => router.push('/get-reading')} className="mt-6">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Get a New Reading
                    </Button>
                </>
            )}
            <footer className="text-center mt-12 py-6 text-sm text-muted-foreground fixed bottom-0 left-0 right-0">
                <p>&copy; {new Date().getFullYear()} Sip-n-Read. All mystical rights reserved.</p>
            </footer>
        </div>
    );
  }


  return (
    <div className="container mx-auto min-h-screen flex flex-col items-center py-8 selection:bg-accent selection:text-accent-foreground">
      <audio ref={backgroundAudioRef} src={selectedReadingAudioUrl || undefined} loop key={selectedReadingAudioUrl} />
      
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
        {reading?.error && (
        <Alert variant="destructive" className="animate-fade-in">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Reading Error</AlertTitle>
            <AlertDescription>{reading.error}</AlertDescription>
        </Alert>
        )}
        {reading?.aiInterpretation && (
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

        {reading?.aiInterpretation && !reading.error && user && (
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
                {isLoadingPrice && <Loader2 className="inline-block ml-2 h-4 w-4 animate-spin" />}
                {!isLoadingPrice && currentReadingPrice !== null && ` For just $${currentReadingPrice}, Roxy will personally analyze your tea leaves and provide a detailed, intuitive reading tailored to you.`}
                {!isLoadingPrice && currentReadingPrice === null && <span className="text-destructive ml-1">{priceError || "Pricing information currently unavailable."}</span>}
            </p>
            <Button
                onClick={handleRequestRoxyReading}
                disabled={isSubmittingRoxyRequest || isLoadingPrice || currentReadingPrice === null || !!priceError}
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
                    Request Roxy&apos;s Reading 
                    {isLoadingPrice && <Loader2 className="inline-block ml-1 h-4 w-4 animate-spin" />}
                    {!isLoadingPrice && currentReadingPrice !== null && ` ($${currentReadingPrice})`}
                    {!isLoadingPrice && currentReadingPrice === null && (priceError ? '' : ' (Price unavailable)')}
                </>
                )}
            </Button>
             {priceError && !isLoadingPrice && (
                <Alert variant="destructive" className="text-xs">
                    <Coins className="h-4 w-4" />
                    <AlertTitle>Pricing Issue</AlertTitle>
                    <AlertDescription>{priceError}</AlertDescription>
                </Alert>
             )}
            </CardContent>
        </Card>
        )}
         {!user && reading?.aiInterpretation && !reading.error && (
             <Card className="w-full shadow-md animate-fade-in">
                 <CardHeader>
                     <CardTitle className="font-headline text-xl flex items-center">
                         <Info className="mr-2 h-6 w-6 text-primary" />
                         Personalized Readings
                     </CardTitle>
                 </CardHeader>
                 <CardContent>
                     <p className="text-card-foreground">
                         <Button variant="link" className="p-0 h-auto" onClick={() => router.push('/login')}>Log in</Button> or 
                         <Button variant="link" className="p-0 h-auto ml-1" onClick={() => router.push('/signup')}>sign up</Button>
                         {' '}to request a personalized reading from Roxy O&apos;Reilly.
                     </p>
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
                localStorage.removeItem('teaLeafReadingResult'); // Clear reading from storage after successful request
                router.push('/my-readings'); 
                }}>
                OK
                </AlertDialogAction>
            </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      </main>
       <footer className="text-center mt-12 py-6 text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} Sip-n-Read. All mystical rights reserved.</p>
      </footer>
    </div>
  );
}
    
