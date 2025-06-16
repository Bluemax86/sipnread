
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import type { RoxyPersonalizedReadingRequest as BaseRoxyPersonalizedReadingRequest, ReadingType } from '../../actions';


import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, AlertCircle, Inbox, Eye, UserX, CalendarDays, Leaf, Coffee, Layers, Languages } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

// Interface for requests with ID
interface RoxyPersonalizedReadingRequestWithId extends BaseRoxyPersonalizedReadingRequest {
  id: string;
}

export default function TassologistDashboardPage() {
  const { user, loading: authLoading, userProfile, loadingProfile } = useAuth();
  const router = useRouter();
  const [actionableRequests, setActionableRequests] = useState<RoxyPersonalizedReadingRequestWithId[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || loadingProfile) {
      return;
    }

    if (!user || !userProfile || userProfile.role !== 'tassologist') {
      setError("Access denied. You must be a Tassologist to view this page.");
      setIsLoadingData(false);
      return;
    }


    const fetchData = async () => {
      setIsLoadingData(true);
      setError(null);
      try {
        const requestsQuery = query(
          collection(db, 'personalizedReadings'),
          where('status', 'in', ['new', 'in-progress']), 
          orderBy('requestDate', 'asc') 
        );
        const requestsSnapshot = await getDocs(requestsQuery);
        const fetchedRequests = requestsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RoxyPersonalizedReadingRequestWithId));

        setActionableRequests(fetchedRequests);

      } catch (err: unknown) {
        console.error("[TassologistDashboardPage] Error fetching actionable requests:", err);
        setError(err instanceof Error ? err.message : "Failed to load actionable reading requests.");
      } finally {
        setIsLoadingData(false);
      }
    };
    fetchData();
  }, [user, authLoading, userProfile, loadingProfile, router]);


  if (authLoading || loadingProfile || isLoadingData) {
    return (
      <div className="container mx-auto min-h-[calc(100vh-56px)] flex flex-col items-center justify-center py-8">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-lg text-muted-foreground">
          {authLoading || loadingProfile ? "Verifying access..." : "Loading dashboard..."}
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto min-h-[calc(100vh-56px)] flex flex-col items-center justify-center py-8">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!user || !userProfile || userProfile.role !== 'tassologist') { 
     return (
      <div className="container mx-auto min-h-[calc(100vh-56px)] flex flex-col items-center justify-center py-8">
        <Alert variant="destructive" className="max-w-md">
          <UserX className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            You must be logged in as a Tassologist to view this page.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const ReadingTypeIcon = ({ type }: { type: ReadingType | null | undefined }) => {
    if (!type) return null;
    switch (type) {
      case 'tea': return <Leaf className="mr-1.5 h-3.5 w-3.5" />;
      case 'coffee': return <Coffee className="mr-1.5 h-3.5 w-3.5" />;
      case 'tarot': return <Layers className="mr-1.5 h-3.5 w-3.5" />;
      case 'runes': return <Languages className="mr-1.5 h-3.5 w-3.5" />;
      default: return null;
    }
  };

  const RequestCard = ({ request }: { request: RoxyPersonalizedReadingRequestWithId }) => {
    const router = useRouter(); 

    let badgeVariant: "default" | "secondary" | "outline" = "secondary"; 
    let statusIcon = <AlertCircle className="mr-2 h-4 w-4" />; // Default icon
    let statusTextDisplay: string = request.status;

    if (request.status === 'new') {
        badgeVariant = 'default'; // Example: Primary color for 'new'
        statusIcon = <AlertCircle className="mr-2 h-4 w-4 text-primary-foreground" />;
    } else if (request.status === 'in-progress') {
        badgeVariant = 'secondary'; // Example: Secondary color for 'in-progress'
        statusIcon = <Loader2 className="mr-2 h-4 w-4 animate-spin" />;
    }

    return (
        <Card key={request.id} className="shadow-md hover:shadow-lg transition-shadow">
        <CardHeader>
            <div className="flex justify-between items-start mb-1">
                <Badge
                    variant={badgeVariant}
                    className="capitalize"
                >
                    {statusIcon} {statusTextDisplay}
                </Badge>
                {request.readingType && (
                    <Badge variant="outline" className="capitalize text-xs flex items-center">
                        <ReadingTypeIcon type={request.readingType} />
                        {request.readingType.charAt(0).toUpperCase() + request.readingType.slice(1)}
                    </Badge>
                )}
            </div>
            <CardTitle className="text-xl pt-1">Request from {request.userEmail || 'N/A'}</CardTitle>
            <CardDescription className="flex items-center text-sm pt-1">
            <CalendarDays className="mr-2 h-4 w-4 text-muted-foreground" />
            Requested: {request.requestDate ? format((request.requestDate as Timestamp).toDate(), 'PPP p') : 'N/A'}
            </CardDescription>
            {request.originalReadingId && (
                <CardDescription className="text-xs text-muted-foreground">
                    Linked to AI Reading ID: {request.originalReadingId}
                </CardDescription>
            )}
        </CardHeader>
        <CardContent>
            <p className="text-sm text-card-foreground mb-1">Price: ${request.price}</p>
            <p className="text-sm text-card-foreground">Payment: {request.paymentStatus}</p>
        </CardContent>
        <CardFooter>
            <Button
            onClick={async () => {
              router.push(`/tassologist/request/${request.id}`);
            }}
            className="w-full"            
            >
            <Eye className="mr-2 h-4 w-4" />
            View and Process
            </Button>
        </CardFooter>
        </Card>
    );
  };


  return (
    <div className="container mx-auto py-8 px-4 md:px-6 selection:bg-accent selection:text-accent-foreground">
      <header className="mb-10 text-center">
        <h1 className="text-4xl md:text-5xl font-headline text-primary mb-3 tracking-tight">Tassologist Dashboard</h1>
        <p className="text-lg text-muted-foreground">Manage new and in-progress personalized reading requests.</p>
      </header>
      

      <section className="mb-12">
        <h2 className="text-2xl md:text-3xl font-headline text-primary mb-6">Open Requests ({actionableRequests.length})</h2>
        {actionableRequests.length === 0 && !isLoadingData && (
          <Alert className="bg-chart-2">
            <Inbox className="h-4 w-4" />
            <AlertTitle>No Open Requests</AlertTitle>
            <AlertDescription>There are currently no new or in-progress reading requests.</AlertDescription>
          </Alert>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {actionableRequests.map(request => <RequestCard key={request.id} request={request} />)}
        </div>
      </section>

      <footer className="text-center mt-16 py-6 text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} Sip-n-Read Tassologist Portal. Handle with care.</p>
      </footer>
    </div>
  );
}

