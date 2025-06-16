
'use client';

import { useState, useEffect, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import type { TeaReadingDocument as BaseTeaReadingDocument, RoxyPersonalizedReadingRequest as BaseRoxyPersonalizedReadingRequest } from '../../actions'; // AiSymbol removed as not directly used here
import { markPersonalizedReadingAsReadAction } from '../../actions';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'; // CardDescription removed
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, AlertCircle, ArrowLeft, CalendarDays, HelpCircle, ImageIcon, Wand2, Gem, BookOpenText, Brain, Tag } from 'lucide-react';
import { format } from 'date-fns';
import { InterpretationDisplay } from '@/components/sipnread/InterpretationDisplay';
// import { cn } from '@/lib/utils'; // cn removed
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle as ShadDialogTitle } from "@/components/ui/dialog";


interface TeaReadingDocument extends BaseTeaReadingDocument {
  id: string;
  // roxyPersonalizedReadingRequestId field is removed as it's not needed here
}

// Helper component to access searchParams because useSearchParams can only be used in Client Components
function ReadingDetailContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams(); // Get search params
  const { user, loading: authLoading } = useAuth();

  const readingId = typeof params.readingId === 'string' ? params.readingId : undefined;
  const roxyRequestIdFromQuery = searchParams.get('roxyRequestId'); // Get the personalized request ID from query

  const [reading, setReading] = useState<TeaReadingDocument | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasAttemptedMarkAsRead, setHasAttemptedMarkAsRead] = useState(false);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setError("You must be logged in to view this page.");
      setIsLoadingData(false);
      return;
    }

    if (!readingId) {
      setError("Reading ID is missing.");
      setIsLoadingData(false);
      return;
    }

    const fetchReading = async () => {
      setIsLoadingData(true);
      setError(null);
      try {
        const readingDocRef = doc(db, 'readings', readingId);
        const readingDocSnap = await getDoc(readingDocRef);

        if (readingDocSnap.exists()) {
          const data = readingDocSnap.data() as BaseTeaReadingDocument;
          if (data.userId !== user.uid) {
            console.warn(`[ReadingDetailPage] fetchReading: User ${user.uid} does not have permission for reading ${readingId} owned by ${data.userId}.`);
            setError("You do not have permission to view this reading.");
            setReading(null);
          } else {
            const fullReadingData: TeaReadingDocument = {
              id: readingDocSnap.id,
              ...data,
            };
            setReading(fullReadingData);
          }
        } else {
          console.warn(`[ReadingDetailPage] fetchReading: Reading document ${readingId} not found.`);
          setError("Reading not found.");
          setReading(null);
        }
      } catch (err: unknown) {
        console.error(`[ReadingDetailPage] fetchReading: Error fetching reading ${readingId}:`, err);
        setError(err instanceof Error ? err.message : "Failed to load reading details.");
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchReading();
  }, [readingId, user, authLoading, roxyRequestIdFromQuery]);


  useEffect(() => {
    if (!user || !reading || !roxyRequestIdFromQuery || hasAttemptedMarkAsRead) {
      return;
    }

    const markReadingAsReadInternal = async (personalizedRequestId: string) => {
      setHasAttemptedMarkAsRead(true); // Attempt only once per effective set of conditions
      try {
        const personalizedRequestDocRef = doc(db, 'personalizedReadings', personalizedRequestId);
        const personalizedRequestDocSnap = await getDoc(personalizedRequestDocRef);

        if (personalizedRequestDocSnap.exists()) {
          const requestData = personalizedRequestDocSnap.data() as BaseRoxyPersonalizedReadingRequest;
          if (requestData.status === 'completed') {
            const result = await markPersonalizedReadingAsReadAction(personalizedRequestId);
            if (result.success) {
              // Potentially refresh local state if needed, or rely on next fetch
            } else {
              console.warn(`[ReadingDetailPage] markReadingAsReadInternal: Failed to mark personalized reading ${personalizedRequestId} as read: ${result.error}`);
            }
          }
        } else {
          console.warn(`[ReadingDetailPage] markReadingAsReadInternal: Personalized reading request ${personalizedRequestId} not found. Cannot mark as read.`);
        }
      } catch (error) {
        console.error(`[ReadingDetailPage] markReadingAsReadInternal: Error checking or marking personalized reading ${personalizedRequestId} as read:`, error);
      }
    };

    if (reading.manualInterpretation && reading.manualInterpretation.trim() !== "" && roxyRequestIdFromQuery) {
      markReadingAsReadInternal(roxyRequestIdFromQuery);
    } else {
       if (!roxyRequestIdFromQuery && reading.manualInterpretation && reading.manualInterpretation.trim() !== "") {
         setHasAttemptedMarkAsRead(true);
       }
    }
  }, [user, reading, roxyRequestIdFromQuery, hasAttemptedMarkAsRead]);

  useEffect(() => {
    if (!isLoadingData && (reading || error)) {
      window.scrollTo(0, 0);
    }
  }, [isLoadingData, reading, error]);


  if (authLoading || isLoadingData) {
    return (
      <div className="container mx-auto min-h-[calc(100vh-56px)] flex flex-col items-center justify-center py-8">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-lg text-muted-foreground">
          {authLoading ? "Authenticating..." : "Loading reading details..."}
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto min-h-[calc(100vh-56px)] flex flex-col items-center justify-center py-8 px-4">
        <Alert variant="destructive" className="max-w-lg w-full">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button onClick={() => router.push('/my-readings')} className="mt-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to My Readings
        </Button>
      </div>
    );
  }

  if (!reading) {
     return (
      <div className="container mx-auto min-h-[calc(100vh-56px)] flex flex-col items-center justify-center py-8 px-4">
        <Alert className="max-w-lg w-full">
          <Wand2 className="h-4 w-4" />
          <AlertTitle>Reading Not Found</AlertTitle>
          <AlertDescription>The reading you are looking for does not exist or you may not have permission to view it.</AlertDescription>
        </Alert>
        <Button onClick={() => router.push('/my-readings')} className="mt-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to My Readings
        </Button>
      </div>
    );
  }

  const displayDate = reading.readingDate ? format((reading.readingDate as Timestamp).toDate(), 'MMMM dd, yyyy \'at\' hh:mm a') : 'Date unknown';
  const hasPersonalizedReading = reading.manualInterpretation && reading.manualInterpretation.trim() !== '';

  return (
    <div className="container mx-auto py-8 px-4 md:px-6 selection:bg-accent selection:text-accent-foreground">
      <header className="mb-8">
        <Button onClick={() => router.push('/my-readings')} variant="outline" className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to My Readings
        </Button>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-headline text-primary mb-1 tracking-tight">Reading Details</h1>
            <p className="text-md text-muted-foreground flex items-center">
              <CalendarDays className="mr-2 h-4 w-4" />
              {displayDate}
            </p>
          </div>
          {hasPersonalizedReading && (
            <Badge variant="default" className="mt-2 sm:mt-0 text-sm px-3 py-1.5 self-start sm:self-center bg-accent text-accent-foreground">
              <Gem className="mr-2 h-4 w-4" /> Personalized by Roxy
            </Badge>
          )}
        </div>
      </header>

      <div className="space-y-8">
        {reading.userQuestion && (
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="text-xl font-headline flex items-center">
                <HelpCircle className="mr-2 h-5 w-5 text-primary" />
                Your Question
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-card-foreground">{reading.userQuestion}</p>
            </CardContent>
          </Card>
        )}

        {reading.userSymbolNames && reading.userSymbolNames.length > 0 && (
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="text-xl font-headline flex items-center">
                <Tag className="mr-2 h-5 w-5 text-primary" />
                Your Pre-Identified Symbols
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {reading.userSymbolNames.map((symbolName, index) => (
                  <Badge key={index} variant="secondary" className="text-sm px-3 py-1">
                    {symbolName}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {reading.photoStorageUrls && reading.photoStorageUrls.length > 0 && (
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="text-xl font-headline flex items-center">
                <ImageIcon className="mr-2 h-5 w-5 text-primary" />
                Your Tea Cup Images
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {reading.photoStorageUrls.map((url, index) => (
                   <Dialog key={index}>
                      <DialogTrigger asChild>
                        <div className="relative aspect-square w-full rounded-lg overflow-hidden border shadow-sm cursor-pointer hover:opacity-80 transition-opacity">
                          <Image
                            src={url}
                            alt={`Tea cup image ${index + 1}`}
                            layout="fill"
                            objectFit="cover"
                            className="transition-transform duration-300 pointer-events-none"
                            data-ai-hint="tea cup leaves"
                            unoptimized={true}
                          />
                        </div>
                      </DialogTrigger>
                      <DialogContent className="max-w-[90vw] sm:max-w-xl md:max-w-2xl lg:max-w-3xl xl:max-w-4xl p-1 bg-transparent border-0 shadow-none overflow-hidden">
                         <DialogHeader>
                           <ShadDialogTitle className="sr-only">Enlarged tea cup image {index + 1}</ShadDialogTitle>
                         </DialogHeader>
                         <div className="relative w-full h-auto max-h-[85vh] flex justify-center items-center">
                            <Image
                             src={url}
                             alt={`Enlarged tea cup image ${index + 1}`}
                             width={1000}
                             height={1000}
                             style={{ width: 'auto', height: 'auto', maxHeight: '85vh', maxWidth: '100%' }}
                             objectFit="contain"
                             data-ai-hint="tea cup leaves"
                             unoptimized={true}
                           />
                         </div>
                       </DialogContent>
                   </Dialog>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* AI Interpretation */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="font-headline text-xl flex items-center">
              <Brain className="mr-2 h-6 w-6 text-primary" />
              AI Interpretation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <InterpretationDisplay
                aiSymbolsDetected={reading.aiSymbolsDetected || []}
                aiInterpretation={reading.aiInterpretation || "No AI interpretation available."}
            />
          </CardContent>
        </Card>


        {/* Roxy's Personalized Interpretation */}
        {hasPersonalizedReading && (
          <Card className="shadow-lg border-accent">
            <CardHeader>
              <CardTitle className="font-headline text-xl flex items-center text-accent">
                <Gem className="mr-2 h-6 w-6" />
                Roxy&apos;s Personalized Interpretation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {reading.manualSymbolsDetected && reading.manualSymbolsDetected.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-2 font-headline text-primary">Roxy&apos;s Symbols Detected:</h3>
                  <div className="flex flex-wrap gap-2">
                    {reading.manualSymbolsDetected.map((item, index) => (
                      <Badge key={index} variant="secondary" className="text-sm px-3 py-1 bg-accent/10 border-accent/30 text-accent-foreground">
                        {item.symbolName}
                        {item.truePositionInCup && item.truePositionInCup !== 'General area' && <span className="ml-1.5 text-xs opacity-75">({item.truePositionInCup})</span>}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <h3 className="text-lg font-semibold mb-2 font-headline text-primary flex items-center">
                   <BookOpenText className="mr-2 h-5 w-5" />
                  Roxy&apos;s Interpretation:
                </h3>
                <p className="text-card-foreground whitespace-pre-wrap leading-relaxed">{reading.manualInterpretation}</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <footer className="text-center mt-16 py-6 text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} Sip-n-Read. All mystical rights reserved.</p>
      </footer>
    </div>
  );
}

// Wrap the page content with Suspense to allow useSearchParams
export default function ReadingDetailPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto min-h-[calc(100vh-56px)] flex flex-col items-center justify-center py-8">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-lg text-muted-foreground">Loading...</p>
      </div>
    }>
      <ReadingDetailContent />
    </Suspense>
  );
}

    

    