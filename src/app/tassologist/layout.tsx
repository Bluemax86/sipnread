
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext'; // UserProfile type is imported from AuthContext
// import { Header } from '@/components/layout/Header'; // Header was unused
import { Loader2 } from 'lucide-react';

export default function TassologistLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, userProfile, loading: authLoading, loadingProfile } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Wait if general auth state or profile specific data is still loading
    if (authLoading || loadingProfile) {
      return; 
    }

    // If auth and profile loading are done, and there's no user, redirect to login
    if (!user) {
      router.replace('/login');
      return;
    }

    // User is authenticated, profile loading is done. Now check profile and role.
    if (userProfile && userProfile.role === 'tassologist') {
      // User is a tassologist, allow access
    } else {
      // User is not a tassologist, or profile is null (e.g., not found in DB), or profile undefined
      router.replace('/');
    }
  }, [user, userProfile, authLoading, loadingProfile, router]);

  // Show a loader while auth state or profile is being determined
  if (authLoading || loadingProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg text-muted-foreground">Verifying access...</p>
      </div>
    );
  }

  // If user is confirmed tassologist (useEffect didn't redirect), render content
  // This check is secondary; the useEffect is the primary guard.
  if (user && userProfile && userProfile.role === 'tassologist') {
    return (
      <div className="flex min-h-screen flex-col">
        {/* <Header /> // Consider if a different header is needed for tassologist section */}
        <main className="flex-1">{children}</main>
      </div>
    );
  }

  // Fallback, should ideally be covered by loader or redirect from useEffect.
  // This state could occur if redirection is pending or if logic has an edge case.
  return (
    <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg text-muted-foreground">Finalizing...</p>
      </div>
  );
}
