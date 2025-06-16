
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth, type UserProfile } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import type { TeaReadingDocument as BaseTeaReadingDocument, RoxyPersonalizedReadingRequest as BaseRoxyPersonalizedReadingRequest } from '../../../actions'; // AiSymbol removed

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'; // CardDescription removed
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, AlertCircle, ArrowLeft, ImageIcon, HelpCircle, BookOpenText, UserCircle as UserIcon, Brain, Feather, CheckSquare, Gem, MessageCircle, ListTree } from 'lucide-react'; // Tag removed
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle as ShadDialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { InterpretationDisplay } from '@/components/sipnread/InterpretationDisplay';
import { cn } from '@/lib/utils';

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

export default function ViewCompletedRequestPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading, userProfile, loadingProfile } = useAuth();
  
  const requestId = typeof params.requestId === 'string' ? params.requestId : undefined;

  const [request, setRequest] = useState<RoxyPersonalizedReadingRequest | null>(null);
  const [originalReading, setOriginalReading] = useState<TeaReadingDocument | null>(null);
  const [requesterProfile, setRequesterProfile] = useState<RequesterProfileData | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || loadingProfile) return;

    if (!user || !userProfile || userProfile.role !== 'tassologist') {
      setError("Access Denied. You must be a Tassologist to view this page.");
      setIsLoadingData(false);
      return;
    }

    if (!requestId) {
      setError("Request ID is missing.");
      setIsLoadingData(false);
      return;
    }

    const fetchData = async () => {
      setIsLoadingData(true);
      setError(null);
      setRequesterProfile(null);
      try {
        const requestDocRef = doc(db, 'personalizedReadings', requestId);
        const requestDocSnap = await getDoc(requestDocRef);

        if (!requestDocSnap.exists()) {
          setError("Personalized reading request not found.");
          setIsLoadingData(false);
          return;
        }
        const requestData = { id: requestDocSnap.id, ...requestDocSnap.data() } as RoxyPersonalizedReadingRequest;
        
        if (requestData.status !== 'completed' && requestData.status !== 'read') {
            setError("This request is not yet completed. Please process it first.");
            setIsLoadingData(false);
            setRequest(null); // Clear request if not completed
            return;
        }
        setRequest(requestData);


        if (requestData.userId) {
          try {
            const profileDocRef = doc(db, 'profiles', requestData.userId);
            const profileDocSnap = await getDoc(profileDocRef);
            if (profileDocSnap.exists()) {
              const profile = profileDocSnap.data() as UserProfile;
              setRequesterProfile({
                name: profile.name,
                email: profile.email,
                profilePicUrl: profile.profilePicUrl,
                bio: profile.bio,
              });
            } else {
              console.warn(`Profile not found for userId: ${requestData.userId}`);
              setRequesterProfile({ email: requestData.userEmail });
            }
          } catch (profileError) {
            console.error("Error fetching requester profile:", profileError);
            setRequesterProfile({ email: requestData.userEmail });
          }
        } else {
           setRequesterProfile({ email: requestData.userEmail });
        }

        if (requestData.originalReadingId) {
          const readingDocRef = doc(db, 'readings', requestData.originalReadingId);
          const readingDocSnap = await getDoc(readingDocRef);
          if (readingDocSnap.exists()) {
            setOriginalReading({ id: readingDocSnap.id, ...readingDocSnap.data() } as TeaReadingDocument);
          } else {
            console.warn(`Original reading with ID ${requestData.originalReadingId} not found.`);
            // Set a minimal originalReading if not found, to avoid errors later
            setOriginalReading({ 
              id: requestData.originalReadingId, 
              userId: requestData.userId, 
              readingDate: requestData.requestDate, // Or some default
              photoStorageUrls: [],
              aiSymbolsDetected: [],
              aiInterpretation: "Original AI reading data not found.",
              manualSymbolsDetected: [],
              manualInterpretation: ""
            });
          }
        }
      } catch (err: unknown) {
        console.error("Error fetching request details:", err);
        setError(err instanceof Error ? err.message : "Failed to load request details.");
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchData();
  }, [requestId, user, userProfile, authLoading, loadingProfile, router]);
  
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

  if (error) {
    return (
      <div className="container mx-auto min-h-[calc(100vh-56px)] flex flex-col items-center justify-center py-8 px-4">
        <Alert variant="destructive" className="max-w-lg w-full">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button onClick={() => router.push('/tassologist/past-readings')} className="mt-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Past Readings
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
          <AlertDescription>The personalized reading request could not be found or is not completed.</AlertDescription>
        </Alert>
         <Button onClick={() => router.push('/tassologist/past-readings')} className="mt-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Past Readings
        </Button>
      </div>
    );
  }
  
  const requestDate = request.requestDate ? format((request.requestDate as Timestamp).toDate(), 'PPP p') : 'N/A';
  const completionDate = request.completionDate ? format((request.completionDate as Timestamp).toDate(), 'PPP p') : 'N/A';
  const statusText = request.status === 'read' ? 'Viewed by User' : 'Completed';

  return (
    <div className="container mx-auto py-8 px-4 md:px-6">
      <header className="mb-8">
        <Button onClick={() => router.push('/tassologist/past-readings')} variant="outline" className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Past Readings
        </Button>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
                <h1 className="text-3xl md:text-4xl font-headline text-primary mb-1 tracking-tight">View Completed Reading</h1>
                <p className="text-sm text-muted-foreground">Request ID: {request.id}</p>
            </div>
            <Badge variant={request.status === 'read' ? 'secondary' : 'default'} className={cn("mt-2 sm:mt-0 text-sm px-3 py-1.5 self-start sm:self-center capitalize", request.status === 'read' ? "bg-secondary/80 text-secondary-foreground" : "bg-primary/80 text-primary-foreground" )}>
                <CheckSquare className="mr-2 h-4 w-4" /> {statusText}
            </Badge>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="md:col-span-2 space-y-6">
            <Card>
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
                            <p><strong className="font-medium text-card-foreground">Completed on:</strong> {completionDate}</p>
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
        </div>
        
        <div className="md:col-span-2 space-y-6">
            <h2 className="text-2xl font-headline text-primary mt-4 mb-4 flex items-center">
                <MessageCircle className="mr-3 h-6 w-6" /> User&apos;s Original Input
            </h2>
            {originalReading?.userQuestion && (
                <Card>
                    <CardHeader>
                    <CardTitle className="flex items-center font-headline"><HelpCircle className="mr-2 h-5 w-5 text-primary" /> Original User Question</CardTitle>
                    </CardHeader>
                    <CardContent>
                    <p className="text-card-foreground">{originalReading.userQuestion}</p>
                    </CardContent>
                </Card>
            )}
             {originalReading && (
                <Card className="overflow-hidden rounded-lg">
                    <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="user-symbols" className="border-b-0">
                        <AccordionTrigger className="px-6 py-4 hover:no-underline text-left">
                            <h3 className="text-lg font-semibold flex items-center text-card-foreground">
                            <ListTree className="mr-2 h-5 w-5 text-primary" /> User Identified Symbols (Original)
                            </h3>
                        </AccordionTrigger>
                        <AccordionContent>
                            <div className="px-6 pb-4 pt-0">
                            {(originalReading.userSymbolNames && originalReading.userSymbolNames.length > 0) ? (
                                <div className="flex flex-wrap gap-2">
                                    {originalReading.userSymbolNames.map((symbolName, index) => (
                                        <Badge key={index} variant="secondary">{symbolName}</Badge>
                                    ))}
                                </div>
                            ) : <p className="text-muted-foreground text-sm">User did not identify any specific symbols.</p>
                            }
                            </div>
                        </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </Card>
            )}
        </div>

        <div className="md:col-span-2 space-y-6">
            <h2 className="text-2xl font-headline text-primary mt-4 mb-4 flex items-center">
                <Brain className="mr-3 h-6 w-6" /> Original AI Analysis &amp; Images
            </h2>
            {originalReading && (
            <Card className="overflow-hidden rounded-lg">
                 <Accordion type="single" collapsible className="w-full">
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
                </Accordion>
            </Card>
            )}
          
            {originalReading?.photoStorageUrls && originalReading.photoStorageUrls.length > 0 && (
                <Card>
                <CardHeader>
                    <CardTitle className="flex items-center font-headline"><ImageIcon className="mr-2 h-5 w-5 text-primary" /> User&apos;s Tea Cup Images</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
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
        </div>
        
        <div className="md:col-span-2 space-y-6">
             <Card className="border-2 border-accent shadow-xl">
                <CardHeader>
                    <CardTitle className="flex items-center font-headline text-2xl text-accent">
                        <Gem className="mr-3 h-7 w-7" />
                        Roxy&apos;s Personalized Interpretation
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {originalReading?.manualSymbolsDetected && originalReading.manualSymbolsDetected.length > 0 && (
                        <div>
                            <h3 className="text-lg font-semibold mb-2 font-headline text-primary flex items-center">
                                <Feather className="mr-2 h-5 w-5" />
                                Symbols Highlighted by Roxy:
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                {originalReading.manualSymbolsDetected.map((item, index) => (
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
                        <div className="text-card-foreground whitespace-pre-wrap leading-relaxed prose prose-sm dark:prose-invert max-w-none p-3 bg-muted/30 rounded-md">
                            {originalReading?.manualInterpretation ? originalReading.manualInterpretation.split('\n').map((paragraph, index) => (
                                <p key={index}>{paragraph}</p>
                            )) : <p>No manual interpretation provided.</p>}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
      </div>

      <footer className="text-center mt-16 py-6 text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} Sip-n-Read Tassologist Portal.</p>
      </footer>
    </div>
  );
}


    