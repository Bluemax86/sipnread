
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import type { TeaReadingDocument as BaseTeaReadingDocument, RoxyPersonalizedReadingRequest as BaseRoxyPersonalizedReadingRequest } from '../actions';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, AlertCircle, Inbox, Wand2, CalendarDays, HelpCircle, ChevronRight, UserX, CheckCircle, Hourglass } from 'lucide-react';
import { format } from 'date-fns';

interface TeaReadingDocument extends BaseTeaReadingDocument {
  id: string;
}
interface RoxyPersonalizedReadingRequest extends BaseRoxyPersonalizedReadingRequest {
  id: string;
}

const getSnippet = (text: string | undefined, maxLength = 100): string => {
  if (!text) return 'No interpretation available.';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

export default function MyReadingsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [pendingPersonalizedRequests, setPendingPersonalizedRequests] = useState<RoxyPersonalizedReadingRequest[]>([]);
  const [completedOnlyPersonalizedRequests, setCompletedOnlyPersonalizedRequests] = useState<RoxyPersonalizedReadingRequest[]>([]);
  const [actionablePersonalizedReadings, setActionablePersonalizedReadings] = useState<RoxyPersonalizedReadingRequest[]>([]); // Used for 'All Past Readings' linking
  const [allUserInterpretations, setAllUserInterpretations] = useState<TeaReadingDocument[]>([]);
  
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user && !authLoading) {
      setIsLoadingData(false);
      return;
    }

    if (user) {
      const fetchData = async () => {
        setIsLoadingData(true);
        setError(null);
        try {
          // Fetch all Roxy personalized requests for the user
          const personalizedRequestsQuery = query(
            collection(db, 'personalizedReadings'),
            where('userId', '==', user.uid),
            orderBy('requestDate', 'desc')
          );
          const personalizedRequestsSnapshot = await getDocs(personalizedRequestsQuery);
          const fetchedPersonalizedRequests = personalizedRequestsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RoxyPersonalizedReadingRequest));

          const pendingReqs: RoxyPersonalizedReadingRequest[] = [];
          const completedOnlyReqs: RoxyPersonalizedReadingRequest[] = []; // Only status 'completed'
          const allActionableReqs: RoxyPersonalizedReadingRequest[] = []; // Status 'completed' or 'read'


          fetchedPersonalizedRequests.forEach(req => {
            if (req.status === 'new' || req.status === 'in-progress') {
              pendingReqs.push(req);
            } else if (req.status === 'completed') {
              completedOnlyReqs.push(req);
              allActionableReqs.push(req); 
            } else if (req.status === 'read') {
              allActionableReqs.push(req); 
            }
          });
          setPendingPersonalizedRequests(pendingReqs);
          setCompletedOnlyPersonalizedRequests(completedOnlyReqs);
          setActionablePersonalizedReadings(allActionableReqs);


          // Fetch all tea reading interpretations (documents from 'readings' collection)
          const interpretationsQuery = query(
            collection(db, 'readings'),
            where('userId', '==', user.uid),
            orderBy('readingDate', 'desc')
          );
          const interpretationsSnapshot = await getDocs(interpretationsQuery);
          const fetchedInterpretations = interpretationsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeaReadingDocument));
          setAllUserInterpretations(fetchedInterpretations);

        } catch (err: unknown) {
          console.error("Error fetching readings:", err);
          setError(err instanceof Error ? err.message : "Failed to load your readings. Please try again.");
        } finally {
          setIsLoadingData(false);
        }
      };
      fetchData();
    }
  }, [user, authLoading]);

  if (authLoading || (isLoadingData && user)) {
    return (
      <div className="container mx-auto min-h-[calc(100vh-56px)] flex flex-col items-center justify-center py-8">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-lg text-muted-foreground">Loading your readings...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto min-h-[calc(100vh-56px)] flex flex-col items-center justify-center py-8">
        <Alert variant="destructive" className="max-w-md">
          <UserX className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            Please{' '}
            <Button variant="link" className="p-0 h-auto" onClick={() => router.push('/login')}>log in</Button> or{' '}
            <Button variant="link" className="p-0 h-auto" onClick={() => router.push('/signup')}>sign up</Button>
            {' '}to view your readings.
          </AlertDescription>
        </Alert>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="container mx-auto min-h-[calc(100vh-56px)] flex flex-col items-center justify-center py-8">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Loading Readings</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const PersonalizedReadingRequestCard = ({ request }: { request: RoxyPersonalizedReadingRequest; }) => {
    const targetPath = (request.status === 'completed' || request.status === 'read') && request.originalReadingId 
      ? `/my-readings/${request.originalReadingId}?roxyRequestId=${request.id}` 
      : '#'; 

    let statusIcon = <Hourglass className="mr-2 h-4 w-4 text-primary" />; // Default for pending
    let statusTextDisplay: string = request.status; // Use a different variable name for display string
    let actionButtonText = "View Your Personalized Reading";
    let isActionable = false;

    if (request.status === 'completed') {
        statusIcon = <CheckCircle className="mr-2 h-4 w-4 text-primary" />;
        statusTextDisplay = "Ready to View";
        isActionable = true;
    } else if (request.status === 'read') { 
        statusIcon = <CheckCircle className="mr-2 h-4 w-4 text-secondary" />; // Use secondary for 'read'
        statusTextDisplay = "Viewed";
        actionButtonText = "View Again";
        isActionable = true;
    } else if (request.status === 'new' || request.status === 'in-progress') {
        statusTextDisplay = request.status === 'new' ? 'New Request' : 'In Progress';
    }

    return (
      <Card key={request.id} className="shadow-md hover:shadow-lg transition-shadow">
        <CardHeader>
          <CardTitle className="text-xl flex items-center justify-between">
            <span>Roxy&apos;s Personalized Reading</span>
            <Badge variant={(request.status === 'new') ? 'secondary' : (request.status === 'in-progress' ? 'secondary' : 'outline')} className="capitalize">
                {statusIcon} {statusTextDisplay}
            </Badge>
          </CardTitle>
           <CardDescription className="flex items-center text-sm">
            <CalendarDays className="mr-2 h-4 w-4 text-muted-foreground" />
            Requested on: {request.requestDate ? format((request.requestDate as Timestamp).toDate(), 'PPP') : 'N/A'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-card-foreground">
            {request.status === 'new' || request.status === 'in-progress' 
              ? "Roxy is preparing your personalized interpretation. You will receive an email when it's ready."
              : "Your personalized reading from Roxy is available."
            }
          </p>
        </CardContent>
        {isActionable && request.originalReadingId && (
          <CardFooter>
             <Button asChild variant="default" className="w-full">
               <Link href={targetPath}>
                 {actionButtonText} <ChevronRight className="ml-1 h-4 w-4" />
               </Link>
             </Button>
          </CardFooter>
        )}
      </Card>
    );
  };


  return (
    <div className="container mx-auto py-8 px-4 md:px-6 selection:bg-accent selection:text-accent-foreground">
      <header className="mb-10 text-center">
        <h1 className="text-4xl md:text-5xl font-headline text-primary mb-3 tracking-tight">My Readings</h1>
        <p className="text-lg text-muted-foreground">Track your requests and revisit past insights.</p>
      </header>

      {/* Pending Personalized Readings Section */}
      {pendingPersonalizedRequests.length > 0 && (
        <section className="mb-12">
          <h2 className="text-2xl md:text-3xl font-headline text-primary mb-6">Pending Personalized Readings</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {pendingPersonalizedRequests.map(request => (
              <PersonalizedReadingRequestCard key={request.id} request={request} />
            ))}
          </div>
        </section>
      )}

      {/* Completed (but not yet read) Personalized Readings Section */}
      {completedOnlyPersonalizedRequests.length > 0 && (
         <section className="mb-12">
          <h2 className="text-2xl md:text-3xl font-headline text-primary mb-6">Your Completed Personalized Readings</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {completedOnlyPersonalizedRequests.map(request => (
              <PersonalizedReadingRequestCard key={request.id} request={request} />
            ))}
          </div>
        </section>
      )}

      {/* All Past Readings Section */}
      <section>
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6">
          <h2 className="text-2xl md:text-3xl font-headline text-primary mb-3 sm:mb-0">All Past Readings</h2>
          <Button onClick={() => router.push('/get-reading')}>
            <Wand2 className="mr-2 h-4 w-4" />
            Get New Reading
          </Button>
        </div>

        {allUserInterpretations.length === 0 && 
         pendingPersonalizedRequests.length === 0 && 
         completedOnlyPersonalizedRequests.length === 0 && 
         !isLoadingData && (
          <Alert>
            <Inbox className="h-4 w-4" />
            <AlertTitle>No Readings Yet</AlertTitle>
            <AlertDescription>
              You haven&apos;t received any tea leaf readings yet. Click the button above to get started!
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {allUserInterpretations.map(reading => {
            const hasManualInterpretation = reading.manualInterpretation && reading.manualInterpretation.trim() !== '';
            let displayCard = false;
            let badgeText = "AI Reading";
            let linkHref = `/my-readings/${reading.id}`;
            let associatedRoxyRequest: RoxyPersonalizedReadingRequest | undefined;

            if (hasManualInterpretation) {
              associatedRoxyRequest = actionablePersonalizedReadings.find( 
                pr => pr.originalReadingId === reading.id
              );
              if (associatedRoxyRequest) { // It's a personalized reading with a completed/read request
                displayCard = true;
                badgeText = "Personalized"; 
                linkHref = `/my-readings/${reading.id}?roxyRequestId=${associatedRoxyRequest.id}`;
              }
              // If hasManualInterpretation but no matching actionableRoxyRequest, it's likely an older format or in-progress by Tassologist
              // but not yet in 'completed'/'read' state for the user. We don't show it here as "Personalized" yet.
            } else {
              // It's an AI-only reading, always display
              displayCard = true;
              badgeText = "AI Reading";
            }

            if (!displayCard) {
              return null; 
            }
            
            const displayDate = reading.readingDate ? format((reading.readingDate as Timestamp).toDate(), 'PPP') : 'Date unknown';
            const thumbnailUrl = reading.photoStorageUrls && reading.photoStorageUrls.length > 0 ? reading.photoStorageUrls[0] : 'https://placehold.co/300x300.png';

            return (
              <Link href={linkHref} key={reading.id} className="block group">
                <Card className="h-full flex flex-col overflow-hidden shadow-md hover:shadow-xl transition-shadow duration-300">
                  <div className="relative w-full aspect-video">
                    <Image
                      src={thumbnailUrl}
                      alt="Tea leaf reading thumbnail"
                      layout="fill"
                      objectFit="cover"
                      className="group-hover:scale-105 transition-transform duration-300"
                      data-ai-hint="tea cup leaves"
                      unoptimized
                    />
                  </div>
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start mb-1">
                      <CardTitle className="text-xl leading-tight group-hover:text-accent transition-colors">
                        Reading from {displayDate}
                      </CardTitle>
                      <Badge variant={badgeText === "Personalized" ? "default" : "secondary"} className="ml-2 shrink-0">
                        {badgeText}
                      </Badge>
                    </div>
                    {reading.userQuestion && (
                       <CardDescription className="flex items-start text-sm pt-1">
                         <HelpCircle className="mr-2 h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                         <span className="line-clamp-2">Q: {reading.userQuestion}</span>
                       </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="flex-grow">
                    <p className="text-sm text-card-foreground line-clamp-3">
                      {getSnippet(hasManualInterpretation ? reading.manualInterpretation : reading.aiInterpretation)}
                    </p>
                  </CardContent>
                  <CardFooter className="pt-3">
                     <Button variant="link" className="p-0 h-auto text-primary group-hover:underline">
                       View Details <ChevronRight className="ml-1 h-4 w-4" />
                     </Button>
                  </CardFooter>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>
      
      <footer className="text-center mt-16 py-6 text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} Sip-n-Read. All mystical rights reserved.</p>
      </footer>
    </div>
  );
}

    
