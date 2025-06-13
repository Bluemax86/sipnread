
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { InterpretationDisplay } from '@/components/sipnread/InterpretationDisplay';
import type { AiAnalysisResult } from '@/app/actions'; // Changed from InterpretationResult
// submitRoxyReadingRequestAction is no longer directly used by this component for this flow
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  // AlertDialogCancel, // Unused import
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  // AlertDialogTrigger, // Unused import
} from "@/components/ui/alert-dialog";
import { Loader2, AlertCircle, ArrowLeft, BookOpenText, Wand2, Gem, Send, Brain } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { getFunctions, httpsCallable, type HttpsCallableResult } from 'firebase/functions';
import { app as firebaseApp } from '@/lib/firebase';
import type { SubmitRoxyReadingRequestCallableInput } from '@/../functions/src'; // For type safety

// This type represents the data structure stored in localStorage
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

  const handleRequestRoxyReading = async () => {
    if (!user || !user.email) { // Ensure user and user.email are available
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
        userEmail: user.email, // Use the authenticated user's email
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


  if (authLoading || isLoadingStorage) {
    return (
      <div className="container mx-auto min-h-screen flex flex-col items-center justify-center py-8">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg mt-4 text-muted-foreground">
          {authLoading ? "Loading authentication..." : "Loading your reading..."}
        </p>
      </div>
    );
  }

  if (!reading || (!reading.aiInterpretation && !reading.error)) {
    return (
      <div className="container mx-auto min-h-screen flex flex-col items-center justify-center py-8 text-center">
        <Wand2 className="mx-auto h-16 w-16 text-primary mb-4" />
        <Alert variant="default" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No Reading Found</AlertTitle>
          <AlertDescription>
            You don&apos;t have a tea leaf reading yet. Please go back and upload an image to get your fortune told.
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
      <header className="text-center mb-6 w-full max-w-xl flex flex-col items-start">
         <Button onClick={() => router.push('/get-reading')} variant="outline" className="mb-6 self-start">
          <ArrowLeft className="mr-2 h-4 w-4" />
          New Reading
        </Button>
        <div className="flex items-center justify-center mb-4 w-full">
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

        {/* Roxy O'Reilly Personalized Reading Card */}
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
                For just $50, Roxy will personally analyze your tea leaves and provide a detailed, 
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
                    Request Roxy&apos;s Reading ($50)
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
                  router.push('/'); // Navigate to home, or /my-readings could also be an option
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
