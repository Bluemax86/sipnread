
'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Send, Coffee, Droplets, Repeat, Filter, Camera, UploadCloud, Clock3, Clock6, Clock9, Clock12, ShieldAlert, Info, X, Edit3 } from 'lucide-react';
import Image from 'next/image'; 
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

const DISCLAIMER_SESSION_STORAGE_KEY = 'disclaimerAcknowledged_sipnread_session';
const PROFILE_REMINDER_SESSION_STORAGE_KEY = 'profileReminderDismissed_sipnread_session';

export default function SipnreadHomePage() {
  const router = useRouter();
  const { user, userProfile, loading: authLoading, loadingProfile } = useAuth();
  
  const [disclaimerAcknowledgedThisSession, setDisclaimerAcknowledgedThisSession] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem(DISCLAIMER_SESSION_STORAGE_KEY) === 'true';
    }
    return false;
  });

  const [profileReminderDismissedThisSession, setProfileReminderDismissedThisSession] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem(PROFILE_REMINDER_SESSION_STORAGE_KEY) === 'true';
    }
    return false;
  });
  const [showProfileReminderBanner, setShowProfileReminderBanner] = useState(false);

  useEffect(() => {
    // Redirect Tassologist to their dashboard if they land on the homepage
    if (!authLoading && !loadingProfile && user && userProfile) {
      if (userProfile.role === 'tassologist') {
        router.replace('/tassologist/dashboard');
      }
    }
  }, [user, userProfile, authLoading, loadingProfile, router]);

  useEffect(() => {
    if (!user || authLoading || loadingProfile || (userProfile && userProfile.role !== 'user')) {
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(DISCLAIMER_SESSION_STORAGE_KEY);
        sessionStorage.removeItem(PROFILE_REMINDER_SESSION_STORAGE_KEY);
      }
      if (disclaimerAcknowledgedThisSession) {
        setDisclaimerAcknowledgedThisSession(false);
      }
      if (profileReminderDismissedThisSession) {
        setProfileReminderDismissedThisSession(false);
      }
      setShowProfileReminderBanner(false); 
    }
  }, [user, userProfile, authLoading, loadingProfile, disclaimerAcknowledgedThisSession, profileReminderDismissedThisSession]);

  // Effect to decide whether to show the profile reminder banner
  useEffect(() => {
    if (user && userProfile && userProfile.role === 'user' && !authLoading && !loadingProfile) {
      if (!profileReminderDismissedThisSession) {
        const needsProfileCompletion = !userProfile.profilePicUrl || !userProfile.bio || userProfile.bio.trim() === '';
        setShowProfileReminderBanner(needsProfileCompletion);
      } else {
        setShowProfileReminderBanner(false);
      }
    } else {
      setShowProfileReminderBanner(false);
    }
  }, [user, userProfile, authLoading, loadingProfile, profileReminderDismissedThisSession]);


  const handleAcknowledgeDisclaimerCard = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(DISCLAIMER_SESSION_STORAGE_KEY, 'true');
    }
    setDisclaimerAcknowledgedThisSession(true);
  };

  const handleDismissProfileReminder = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(PROFILE_REMINDER_SESSION_STORAGE_KEY, 'true');
    }
    setProfileReminderDismissedThisSession(true);
    setShowProfileReminderBanner(false);
  };

  const handleReadyClick = () => {
    router.push('/get-reading');
  };

  const shouldShowDisclaimerCard = user && userProfile && userProfile.role === 'user' && !disclaimerAcknowledgedThisSession && !authLoading && !loadingProfile;

  // Prevent rendering the main content of the landing page for Tassologists while redirecting
  if (!authLoading && !loadingProfile && user && userProfile && userProfile.role === 'tassologist') {
    return null; // Or a loading spinner if the redirect takes a noticeable amount of time
  }

  return (
    <div className="container mx-auto min-h-screen flex flex-col items-center justify-center py-8 selection:bg-accent selection:text-accent-foreground">
      <header className="text-center mb-10">
        <Image 
          src="/swirl-logo.png" 
          alt="SipnRead Swirl Logo" 
          width={77} 
          height={77} 
          className="mx-auto mb-4"
          data-ai-hint="logo swirl"
        />
        <h1 className="text-5xl md:text-6xl font-headline text-primary mb-3 tracking-tight">
          Welcome to<span className="md:inline"> </span><br className="md:hidden" />Sip-n-Read!
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground">Discover the secrets hidden in your tea leaves.</p>
      </header>

      <main className="w-full max-w-2xl space-y-8">
        {shouldShowDisclaimerCard && (
          <Card className="shadow-lg border-amber-500/50 bg-amber-50/50 dark:bg-amber-900/10">
            <CardHeader className="items-center">
              <ShieldAlert className="h-10 w-10 mb-2 text-primary" />
              <CardTitle className="text-center text-xl font-headline text-primary">
                Important Disclaimer
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-sm text-card-foreground leading-relaxed mb-4">
                This application, Sip-n-Read, and its interpretations are provided for entertainment purposes only.
                The readings and any information provided should not be taken as advice or relied upon for making
                personal, financial, medical, or any other decisions. Users are solely responsible for their own
                actions and choices.
              </p>
              <Button
                onClick={handleAcknowledgeDisclaimerCard}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              >
                I Understand &amp; Acknowledge
              </Button>
            </CardContent>
          </Card>
        )}

        {showProfileReminderBanner && (
          <Alert variant="default" className="relative shadow-md border-primary/30 bg-primary/5 dark:bg-primary/10">
            <Info className="h-5 w-5 text-primary" />
            <AlertTitle className="font-headline text-primary">Complete Your Profile</AlertTitle>
            <AlertDescription className="text-muted-foreground">
              Enhance your experience by adding a profile picture and bio. Roxy can use this to personalize your readings even more!
              <Button 
                variant="link" 
                onClick={() => router.push('/profile')} 
                className="p-0 h-auto ml-1 text-primary font-semibold hover:underline"
              >
                Go to Profile <Edit3 className="ml-1 h-3 w-3" />
              </Button>
            </AlertDescription>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleDismissProfileReminder} 
              className="absolute top-2 right-2 h-6 w-6 p-0 text-muted-foreground hover:text-primary"
              aria-label="Dismiss profile reminder"
            > 
              <X className="h-4 w-4" /> 
            </Button>
          </Alert>
        )}

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline text-2xl flex items-center">
              How It Works
            </CardTitle>
            <CardDescription>Follow these simple steps to get your tea leaf reading:</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-card-foreground">
            <div className="flex items-start">
              <Coffee className="h-5 w-5 text-primary mr-3 mt-0.5 shrink-0" />
              <p><span className="font-semibold">Brew Your Tea:</span> Prepare your favorite loose-leaf tea in a cup.</p>
            </div>
            <div className="flex items-start">
              <Droplets className="h-5 w-5 text-primary mr-3 mt-0.5 shrink-0" />
              <p><span className="font-semibold">Enjoy &amp; Prepare:</span> Drink your tea, leaving a very small amount of liquid and the leaves at the bottom.</p>
            </div>
            <div className="flex items-start">
              <Repeat className="h-5 w-5 text-primary mr-3 mt-0.5 shrink-0" />
              <p><span className="font-semibold">The Ritual:</span> Gently swirl the cup three times, anticlockwise. Ensure no one else touches your cup.</p>
            </div>
            <div className="flex items-start">
              <Filter className="h-5 w-5 text-primary mr-3 mt-0.5 shrink-0" />
              <p><span className="font-semibold">Drain Excess:</span> Invert the cup onto a saucer and let it drain for about a minute.</p>
            </div>
            <div className="flex items-start">
              <Camera className="h-5 w-5 text-primary mr-3 mt-0.5 shrink-0" />
              <div>
                <p><span className="font-semibold">Capture the Moment (4 Photos):</span> Turn the cup upright. Starting with the cup handle in the 3 o&apos;clock position take four clear photos from above the cup. Make sure the entire cup including the handle are clearly visible, rotating the cup for each shot, with the handle at these positions:</p>
                <ul className="list-none pl-0 mt-2 space-y-1 text-xs sm:text-sm">
                  
                  <li className="flex items-center"><Clock3 className="h-4 w-4 text-primary mr-2 shrink-0" /> Handle at 3 o&apos;clock (handle right side)</li>
                  <li className="flex items-center"><Clock6 className="h-4 w-4 text-primary mr-2 shrink-0" /> Handle at 6 o&apos;clock (handle towards you)</li>
                  <li className="flex items-center"><Clock9 className="h-4 w-4 text-primary mr-2 shrink-0" /> Handle at 9 o&apos;clock (handle left side)</li>
                  <li className="flex items-center"><Clock12 className="h-4 w-4 text-primary mr-2 shrink-0" /> Handle at 12 o&apos;clock (handle away from you)</li>
                </ul>
              </div>
            </div>
            <div className="flex items-start">
              <UploadCloud className="h-5 w-5 text-primary mr-3 mt-0.5 shrink-0" />
              <p><span className="font-semibold">Get Your Reading:</span> Upload your photo(s). You can also ask a specific question to guide the AI.</p>
            </div>
            <div className="flex items-start">
              <Image 
                src="/swirl-logo.png" 
                alt="SipnRead Swirl Detail" 
                width={20}
                height={20} 
                className="text-primary mr-3 mt-0.5 shrink-0"
                data-ai-hint="logo swirl"
              />
              <p><span className="font-semibold">Unveil Your Destiny:</span> Our AI will analyze the symbols and provide your unique interpretation!</p>
            </div>
          </CardContent>
        </Card>

        <div className="text-center">
          <Button onClick={handleReadyClick} size="lg" className="shadow-md">
            <Send className="mr-2 h-5 w-5" />
            OK, I&apos;m Ready!
          </Button>
        </div>
      </main>

      <footer className="text-center mt-12 py-6 text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} Sip-n-Read. All mystical rights reserved.</p>
      </footer>
    </div>
  );
}

    