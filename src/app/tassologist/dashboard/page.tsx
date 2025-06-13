
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import type { RoxyPersonalizedReadingRequest as BaseRoxyPersonalizedReadingRequest } from '../../actions';
// Removed import for sendTestEmailToRoxyAction
// import { useToast } from '@/hooks/use-toast'; // Import useToast was unused


import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, AlertCircle, Inbox, Eye, UserX, CalendarDays } from 'lucide-react'; // Removed MailCheck
import { format } from 'date-fns';
// import { cn } from '@/lib/utils'; // cn was unused

// Interface for requests with ID
interface RoxyPersonalizedReadingRequestWithId extends BaseRoxyPersonalizedReadingRequest {
  id: string;
}

export default function TassologistDashboardPage() {
  const { user, loading: authLoading, userProfile, loadingProfile } = useAuth();
  const router = useRouter();
  // const { toast } = useToast(); // toast was unused
  const [actionableRequests, setActionableRequests] = useState<RoxyPersonalizedReadingRequestWithId[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  // Removed isSendingTestEmail state
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || loadingProfile) {
      return;
    }

    if (!user || !userProfile || userProfile.role !== 'tassologist') {
      setError("Access denied. You must be a Tassologist to view this page.");
      setIsLoadingData(false);
      // router.replace('/'); // Layout should handle this
      return;
    }


    const fetchData = async () => {
      setIsLoadingData(true);
      setError(null);
      try {
        const requestsQuery = query(
          collection(db, 'personalizedReadings'),
          where('status', 'in', ['new', 'in-progress']), // Fetch 'new' OR 'in-progress' requests
          orderBy('requestDate', 'asc') // Show oldest requests first
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

  // Removed handleSendTestEmail function

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

  if (!user || !userProfile || userProfile.role !== 'tassologist') { // Fallback check
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

  const RequestCard = ({ request }: { request: RoxyPersonalizedReadingRequestWithId }) => {
    const router = useRouter(); // For navigation
    // Access 'user' and 'userProfile' from the TassologistDashboardPage scope

    let badgeVariant: "default" | "secondary" | "outline" = "secondary"; // Default to secondary
    if (request.status === 'new') {
        badgeVariant = 'default';
    } else if (request.status === 'in-progress') {
        badgeVariant = 'secondary';
    }

    return (
        <Card key={request.id} className="shadow-md hover:shadow-lg transition-shadow">
        <CardHeader>
            <div className="flex flex-col items-start"> {/* Changed to flex-col and items-start */}
            <Badge
                variant={badgeVariant}
                className="capitalize mb-1" // Added mb-1 for spacing
            >
                {request.status}
            </Badge>
            <CardTitle className="text-xl">Request from {request.userEmail || 'N/A'}</CardTitle>
            </div>
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
            onClick={() => {
              console.log(
                `[TassologistDashboardPage] 'View and Process' clicked. Auth State:\n` +
                `  User Object Present: ${!!user}\n` +
                `  User UID: ${user?.uid || 'N/A'}\n` +
                `  User Email: ${user?.email || 'N/A'}\n` +
                `  User Profile Present: ${!!userProfile}\n` +
                `  User Profile Role: ${userProfile?.role || 'N/A'}\n` +
                `  User Profile Name: ${userProfile?.name || 'N/A'}\n` +
                `  Is Tassologist: ${userProfile?.role === 'tassologist'}\n` +
                `  Full User Profile (JSON): ${JSON.stringify(userProfile, null, 2)}`
              );
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
      
      {/* Removed the test email button and its container div */}

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
