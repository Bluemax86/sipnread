
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth, type UserProfile } from '@/contexts/AuthContext';
import { db, app as firebaseApp } from '@/lib/firebase'; 
import { getFunctions, httpsCallable } from 'firebase/functions'; 
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import type { TeaReadingDocument as BaseTeaReadingDocument, RoxyPersonalizedReadingRequest as BaseRoxyPersonalizedReadingRequest, SaveTassologistInterpretationType, TranscriptionStatus } from '../../../actions'; 
import { getTranscriptionResultAction } from '../../../actions';
import type { SaveTassologistInterpretationCallableInput } from '../../../../../functions/src'; 


import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'; 
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, AlertCircle, ArrowLeft, ImageIcon, HelpCircle, UserCircle as UserIcon, Tag, Brain, RefreshCw } from 'lucide-react'; 
import { TassologistInterpretationForm, type TassologistInterpretationFormValues } from '@/components/tassologist/TassologistInterpretationForm';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle as ShadDialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { InterpretationDisplay } from '@/components/sipnread/InterpretationDisplay';

interface TeaReadingDocument extends BaseTeaReadingDocument {
  id: string;
}
interface RoxyPersonalizedReadingRequest extends BaseRoxyPersonalizedReadingRequest {
  id: string;
}

interface RequesterProfileData {
  name?: string;
  email?: string;
  profilePicUrl?: string | null;
  bio?: string;
}


export default function ProcessRequestPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading, userProfile, loadingProfile } = useAuth();
  const { toast } = useToast();
  
  const requestId = typeof params.requestId === 'string' ? params.requestId : undefined;

  const [request, setRequest] = useState<RoxyPersonalizedReadingRequest | null>(null);
  const [originalReading, setOriginalReading] = useState<TeaReadingDocument | null>(null);
  const [requesterProfile, setRequesterProfile] = useState<RequesterProfileData | null>(null);
  
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null); // Renamed from error to avoid conflict with catch block variables
  
  const [isFetchingTranscript, setIsFetchingTranscript] = useState(false);
  // Store form values locally to pass to TassologistInterpretationForm
  const [formInitialData, setFormInitialData] = useState<Partial<TassologistInterpretationFormValues>>({});
  const [currentTranscriptionStatus, setCurrentTranscriptionStatus] = useState<TranscriptionStatus>(null);


  const fetchFullRequestData = useCallback(async () => {
    if (!requestId || !user || !userProfile || userProfile.role !== 'tassologist') return;
    
    setIsLoadingData(true);
    setPageError(null);
    try {
      const requestDocRef = doc(db, 'personalizedReadings', requestId);
      const requestDocSnap = await getDoc(requestDocRef);

      if (!requestDocSnap.exists) {
        setPageError("Personalized reading request not found.");
        setIsLoadingData(false);
        return;
      }
      const requestData = { id: requestDocSnap.id, ...requestDocSnap.data() } as RoxyPersonalizedReadingRequest;
      setRequest(requestData);
      setCurrentTranscriptionStatus(requestData.transcriptionStatus || 'not_requested');

      if (requestData.userId) {
        const profileDocRef = doc(db, 'profiles', requestData.userId);
        const profileDocSnap = await getDoc(profileDocRef);
        if (profileDocSnap.exists()) {
          const profile = profileDocSnap.data() as UserProfile;
          setRequesterProfile({ name: profile.name, email: profile.email, profilePicUrl: profile.profilePicUrl, bio: profile.bio });
        } else {
          setRequesterProfile({ email: requestData.userEmail });
        }
      } else {
         setRequesterProfile({ email: requestData.userEmail });
      }

      if (requestData.originalReadingId) {
        const readingDocRef = doc(db, 'readings', requestData.originalReadingId);
        const readingDocSnap = await getDoc(readingDocRef);
        if (readingDocSnap.exists()) {
          const readingData = { id: readingDocSnap.id, ...readingDocSnap.data() } as TeaReadingDocument;
          setOriginalReading(readingData);
          // Set initial form data from original reading (if draft exists) or fetched transcript
          setFormInitialData({
            manualSymbols: readingData.manualSymbolsDetected?.map(s => ({ symbol: s.symbolName, position: parseInt(s.truePositionInCup.split(' ')[0]) || undefined })) || [{ symbol: '', position: undefined }],
            manualInterpretation: readingData.manualInterpretation || '',
          });

          // If transcription was pending, try to fetch it now
          if (requestData.transcriptionOperationId && requestData.transcriptionStatus === 'pending' && (!readingData.manualInterpretation || readingData.manualInterpretation.startsWith("[Dictation processing"))) {
            // Do not call handleFetchTranscript directly here to avoid potential infinite loops with useCallback dependencies.
            // It will be triggered by the currentTranscriptionStatus change if needed, or manually by user.
          }

        } else {
          setOriginalReading({ id: requestData.originalReadingId, userId: requestData.userId, readingDate: requestData.requestDate, photoStorageUrls: [], aiSymbolsDetected: [], aiInterpretation: "Original AI reading data not found.", manualSymbolsDetected: [], manualInterpretation: "" });
          setFormInitialData({ manualSymbols: [{ symbol: '', position: undefined }], manualInterpretation: '' });
        }
      } else {
        setFormInitialData({ manualSymbols: [{ symbol: '', position: undefined }], manualInterpretation: '' });
      }
    } catch (err: unknown) {
      setPageError(err instanceof Error ? err.message : "Failed to load request details.");
    } finally {
      setIsLoadingData(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId, user, userProfile]); 

  useEffect(() => {
    if (authLoading || loadingProfile) return;
    if (!user || !userProfile || userProfile.role !== 'tassologist') {
      setPageError("Access Denied. You must be a Tassologist to view this page.");
      setIsLoadingData(false);
      return;
    }
    if (requestId) {
      fetchFullRequestData();
    } else {
      setPageError("Request ID is missing.");
      setIsLoadingData(false);
    }
  }, [requestId, user, userProfile, authLoading, loadingProfile, fetchFullRequestData]);


  const handleFetchTranscript = useCallback(async (operationIdParam?: string | null, currentRequestIdParam?: string | null, currentOriginalReadingIdParam?: string | null) => {
    const opId = operationIdParam || request?.transcriptionOperationId;
    const reqId = currentRequestIdParam || request?.id;
    const origReadingId = currentOriginalReadingIdParam || request?.originalReadingId;

    if (!opId || !reqId ) {
      toast({ variant: 'default', title: 'No Dictation', description: 'No dictation was processed for this request.' });
      return;
    }
    
    setIsFetchingTranscript(true);
    toast({ title: 'Checking Dictation...', description: 'Attempting to fetch transcript.' });
    try {
      const result = await getTranscriptionResultAction(opId, reqId, origReadingId || null);
      if (result.success && result.transcript) {
        setFormInitialData(prev => ({ ...prev, manualInterpretation: result.transcript }));
        setCurrentTranscriptionStatus('completed'); // Update local status
        // Optionally call fetchFullRequestData to get the latest overall request state from DB if transcriptionStatus update in DB is critical for other UI elements
        // await fetchFullRequestData(); 
        toast({ title: 'Transcript Fetched!', description: 'Dictation added to interpretation field.' });
      } else if (result.status === 'processing') {
        setCurrentTranscriptionStatus('pending'); // Update local status
        toast({ title: 'Still Processing', description: 'Dictation is still being transcribed. Please try again in a moment.' });
      } else {
        setCurrentTranscriptionStatus('failed'); // Update local status
        toast({ variant: 'destructive', title: 'Transcript Error', description: result.error || 'Failed to fetch transcript.' });
      }
    } catch (fetchTranscriptError: unknown) {
      setCurrentTranscriptionStatus('failed');
      const description = fetchTranscriptError instanceof Error ? fetchTranscriptError.message : 'An error occurred while fetching transcript.';
      toast({ variant: 'destructive', title: 'Fetch Error', description });
    } finally {
      setIsFetchingTranscript(false);
    }
  }, [request, toast]); // fetchFullRequestData removed from dependencies to avoid loops


  const handleFormSubmit = async (data: TassologistInterpretationFormValues, saveType: SaveTassologistInterpretationType) => {
    if (!requestId) {
      toast({ variant: "destructive", title: "Error", description: "Request ID is missing." });
      return;
    }
    if (!request?.originalReadingId) {
        toast({ variant: "destructive", title: "Error", description: "Original reading ID is missing from the request. Cannot save interpretation." });
        return;
    }
    if (!user || userProfile?.role !== 'tassologist') {
        toast({ variant: "destructive", title: "Authentication Error", description: "You must be logged in as a Tassologist." });
        return;
    }

    setIsSubmittingForm(true);
    try {
      const functions = getFunctions(firebaseApp);
      const saveTassologistInterpretation = httpsCallable<
        SaveTassologistInterpretationCallableInput,
        { success: boolean; message?: string }
      >(functions, 'saveTassologistInterpretationCallable');

      const payload: SaveTassologistInterpretationCallableInput = {
        requestId,
        originalReadingId: request.originalReadingId,
        manualSymbols: data.manualSymbols.map(s => ({ symbol: s.symbol, position: s.position })),
        manualInterpretation: data.manualInterpretation,
        saveType,
      };
      
      await saveTassologistInterpretation(payload); // Direct call to callable, result handled via its own success/message

      toast({ title: "Success!", description: `Interpretation ${saveType === 'complete' ? 'completed and user notified' : 'draft saved'}.` });
      router.push('/tassologist/dashboard');
      
    } catch (err: unknown) {
      // HttpsError from callable will be caught here
      const errMessage = err instanceof Error ? ((err as Error & { details?: { message?: string } }).details?.message || err.message) : "An unexpected error occurred.";
      toast({ variant: "destructive", title: "Error Saving Interpretation", description: errMessage });
    } finally {
      setIsSubmittingForm(false);
    }
  };
  
  const getInitialsFallback = (name?: string, email?: string) => {
    if (name) return name.charAt(0).toUpperCase();
    if (email) return email.charAt(0).toUpperCase();
    return <UserIcon className="h-5 w-5" />;
  };

  if (authLoading || loadingProfile || isLoadingData) {
    return (
      <div className="container mx-auto min-h-[calc(100vh-56px)] flex flex-col items-center justify-center py-8">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-lg text-muted-foreground">
          {authLoading || loadingProfile ? "Verifying access..." : "Loading request details..."}
        </p>
      </div>
    );
  }

  if (pageError) {
    return (
      <div className="container mx-auto min-h-[calc(100vh-56px)] flex flex-col items-center justify-center py-8 px-4">
        <Alert variant="destructive" className="max-w-lg w-full">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{pageError}</AlertDescription>
        </Alert>
        <Button onClick={() => router.push('/tassologist/dashboard')} className="mt-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="container mx-auto min-h-[calc(100vh-56px)] flex flex-col items-center justify-center py-8 px-4">
        <Alert className="max-w-lg w-full">
          <HelpCircle className="h-4 w-4" />
          <AlertTitle>Request Not Found</AlertTitle>
          <AlertDescription>The personalized reading request could not be found.</AlertDescription>
        </Alert>
         <Button onClick={() => router.push('/tassologist/dashboard')} className="mt-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>
      </div>
    );
  }
  
  const requestDate = request.requestDate ? format((request.requestDate as Timestamp).toDate(), 'PPP p') : 'N/A';

  return (
    <div className="container mx-auto py-8 px-4 md:px-6">
      <header className="mb-8">
        <Button onClick={() => router.push('/tassologist/dashboard')} variant="outline" className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
                <h1 className="text-3xl md:text-4xl font-headline text-primary mb-1 tracking-tight">Process Reading Request</h1>
                <p className="text-sm text-muted-foreground">Request ID: {request.id}</p>
            </div>
             {request.transcriptionOperationId && (
                <Button 
                    onClick={() => handleFetchTranscript()} 
                    variant="outline" 
                    size="sm" 
                    disabled={isFetchingTranscript || currentTranscriptionStatus === 'completed'}
                    className="mt-2 sm:mt-0 self-start sm:self-center"
                >
                    {isFetchingTranscript ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                    {currentTranscriptionStatus === 'completed' ? 'Transcript Loaded' : (currentTranscriptionStatus === 'pending' ? 'Refresh Transcript' : 'Check Transcript')}
                </Button>
            )}
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card className="md:col-span-2 mb-0">
            <CardHeader>
                <CardTitle className="flex items-center font-headline">
                <UserIcon className="mr-3 h-7 w-7 text-primary" />
                Requester Information
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col sm:flex-row items-start gap-x-6 gap-y-4">
                    <Avatar className="h-24 w-24 sm:h-28 sm:w-28 ring-2 ring-primary ring-offset-background ring-offset-2 shrink-0">
                        <AvatarImage src={requesterProfile?.profilePicUrl || undefined} alt={requesterProfile?.name || request.userEmail} data-ai-hint="person avatar"/>
                        <AvatarFallback className="text-3xl">
                            {getInitialsFallback(requesterProfile?.name, request.userEmail)}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex-grow space-y-1.5 text-sm">
                        <p><strong className="font-medium text-card-foreground">Name:</strong> {requesterProfile?.name || 'N/A'}</p>
                        <p><strong className="font-medium text-card-foreground">Email:</strong> {request.userEmail}</p>
                        <p><strong className="font-medium text-card-foreground">Requested on:</strong> {requestDate}</p>
                        {requesterProfile?.bio && (
                        <div className="pt-1">
                            <p><strong className="font-medium text-card-foreground">Bio:</strong></p>
                            <p className="text-card-foreground whitespace-pre-wrap bg-muted/30 p-2 rounded-md max-h-28 overflow-y-auto text-xs">
                                {requesterProfile.bio}
                            </p>
                        </div>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>

        <section className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center font-headline"><HelpCircle className="mr-2 h-5 w-5 text-primary" /> Original User Question</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-card-foreground">{originalReading?.userQuestion || "No specific question was asked for the original AI reading."}</p>
            </CardContent>
          </Card>
          
          <Accordion type="multiple" className="w-full space-y-1">
            {originalReading && (
              <Card className="overflow-hidden rounded-lg">
                <AccordionItem value="user-symbols" className="border-b-0">
                  <AccordionTrigger className="px-6 py-4 hover:no-underline text-left">
                    <h3 className="text-lg font-semibold flex items-center text-card-foreground">
                      <Tag className="mr-2 h-5 w-5 text-primary" /> User Identified Symbols (Original)
                    </h3>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="px-6 pb-4 pt-0">
                      {originalReading.userSymbolNames && originalReading.userSymbolNames.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {originalReading.userSymbolNames.map((symbolName, index) => (
                            <Badge key={index} variant="secondary">{symbolName}</Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-sm">User did not identify any specific symbols for the original AI reading.</p>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Card>
            )}

            {originalReading && (
              <Card className="overflow-hidden rounded-lg">
                <AccordionItem value="ai-reading" className="border-b-0">
                  <AccordionTrigger className="px-6 py-4 hover:no-underline text-left">
                     <h3 className="text-lg font-semibold flex items-center text-card-foreground">
                      <Brain className="mr-2 h-5 w-5 text-primary" /> AI Reading (Original)
                    </h3>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="px-6 pb-4 pt-0">
                      <InterpretationDisplay
                        aiSymbolsDetected={originalReading.aiSymbolsDetected || []}
                        aiInterpretation={originalReading.aiInterpretation || "No AI interpretation available from original reading."}
                        symbolsTitleText="Detected Symbols:"
                        interpretationTitleText="Interpretation:"
                      />
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Card>
            )}
          </Accordion>
          
          {originalReading?.photoStorageUrls && originalReading.photoStorageUrls.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center font-headline"><ImageIcon className="mr-2 h-5 w-5 text-primary" /> User&apos;s Tea Cup Images</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  {originalReading.photoStorageUrls.map((url, index) => (
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
                          <ShadDialogTitle className="sr-only">Enlarged tea cup image ${index + 1}</ShadDialogTitle>
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
          {(!originalReading?.photoStorageUrls || originalReading.photoStorageUrls.length === 0) && (
            <Alert>
                <ImageIcon className="h-4 w-4" />
                <AlertTitle>No Images</AlertTitle>
                <AlertDescription>No images were associated with the original AI reading, or the original reading was not found.</AlertDescription>
            </Alert>
          )}
        </section>

        <section>
            <TassologistInterpretationForm
                personalizedReadingRequestId={request.id}
                onSubmit={handleFormSubmit}
                isSubmittingForm={isSubmittingForm}
                initialData={formInitialData}
                onNewOperationId={(operationName) => {
                   // This callback could be used to update the request document with new operation ID
                   // or trigger a re-fetch if needed, but might not be directly necessary
                   // if the parent (this page) already knows the operation ID from the initial request load.
                   // For now, it can be used to update the currentTranscriptionStatus locally if desired.
                   setCurrentTranscriptionStatus('pending'); 
                }}
                currentTranscriptionStatus={currentTranscriptionStatus}
             />
        </section>
      </div>

      <footer className="text-center mt-16 py-6 text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} Sip-n-Read Tassologist Portal. Handle with care.</p>
      </footer>
    </div>
  );
}
