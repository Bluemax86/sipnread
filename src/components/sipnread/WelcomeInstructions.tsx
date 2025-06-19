
'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Send, Coffee, Droplets, Repeat, Filter, Camera, UploadCloud, Clock3, Clock6, Clock9, Clock12, Layers, Languages, ShieldAlert, Info, Edit3, X, Pyramid, Scroll, Wand2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

const DISCLAIMER_SESSION_STORAGE_KEY = 'disclaimerAcknowledged_sipnread_session';
const PROFILE_REMINDER_SESSION_STORAGE_KEY = 'profileReminderDismissed_sipnread_session';


interface InstructionStep {
  icon: React.ElementType;
  title: string;
  description: string | React.ReactNode;
}

interface InstructionSet {
  pageTitle: string; // e.g., "Preparing for Your Tea Leaf Reading"
  pageTagline: string; // e.g., "Follow these steps carefully..."
  cardTitle: string; // e.g., "How It Works"
  cardDescription: string; // e.g., "Follow these simple steps for your tea leaf reading:"
  steps: InstructionStep[];
  importantNotes?: string[]; // Optional important notes section
  imageSrc?: string; // Optional image for the header of this instruction page
  imageAlt?: string;
  imageAiHint?: string;
}

const instructionsData: Record<string, InstructionSet> = {
  tea: {
    pageTitle: "Preparing for Your Tea Leaf Reading",
    pageTagline: "Follow these steps carefully to ensure the best possible reading.",
    cardTitle: "How It Works",
    cardDescription: "Follow these simple steps for your tea leaf reading:",
    steps: [
      { icon: Coffee, title: "Brew Your Tea:", description: "Prepare your favorite loose-leaf tea in a cup." },
      { icon: Droplets, title: "Enjoy & Prepare:", description: "Drink your tea, leaving a very small amount of liquid and leaves at the bottom." },
      { icon: Repeat, title: "The Ritual:", description: "Gently swirl the cup three times anticlockwise. Ensure no one else touches your cup." },
      { icon: Filter, title: "Drain Excess:", description: "Invert the cup onto a saucer and let it drain for about a minute." },
      {
        icon: Camera, title: "Capture the Moment (4 Photos):", description: (
          <>
            Turn the cup upright. Starting with the cup handle in the 3 o&apos;clock position, take four clear photos from above the cup. Make sure the entire cup including the handle are clearly visible, rotating the cup for each shot, with the handle at these positions:
            <ul className="list-none pl-0 mt-2 space-y-1 text-xs sm:text-sm">
              <li className="flex items-center"><Clock3 className="h-4 w-4 text-primary mr-2 shrink-0" /> Handle at 3 o&apos;clock (handle right side)</li>
              <li className="flex items-center"><Clock6 className="h-4 w-4 text-primary mr-2 shrink-0" /> Handle at 6 o&apos;clock (handle towards you)</li>
              <li className="flex items-center"><Clock9 className="h-4 w-4 text-primary mr-2 shrink-0" /> Handle at 9 o&apos;clock (handle left side)</li>
              <li className="flex items-center"><Clock12 className="h-4 w-4 text-primary mr-2 shrink-0" /> Handle at 12 o&apos;clock (handle away from you)</li>
            </ul>
          </>
        )
      },
      { icon: UploadCloud, title: "Get Your Reading:", description: "Upload your photo(s). You can also ask a specific question to guide the AI." },
      { icon: Wand2, title: "Unveil Your Destiny:", description: "Our AI will analyze the symbols and provide your unique interpretation!" }
    ],
    importantNotes: [
      "Use a plain, light-colored cup for best results.",
      "Focus your intention or question while drinking and swirling the tea.",
      "Try to capture as much of the cup's interior as possible in each photo."
    ],
    imageSrc: "/swirl-logo.png",
    imageAlt: "SipnRead Swirl Logo",
    imageAiHint: "logo swirl",
  },
  coffee: {
    pageTitle: "Preparing for Your Coffee Ground Reading",
    pageTagline: "Unlock the wisdom held within your coffee grounds.",
    cardTitle: "The Coffee Ritual",
    cardDescription: "Follow these steps for an insightful coffee ground reading:",
    steps: [
      { icon: Coffee, title: "Brew Your Coffee:", description: "Prepare Turkish coffee or a similar unfiltered coffee, allowing sediment to settle. A cup with angled sidewalls works best." },
      { icon: Droplets, title: "Sip and Swirl:", description: "Drink the coffee, leaving the thick sediment and a tiny bit of liquid at the bottom. Gently swirl the cup three times." },
      { icon: Repeat, title: "Invert and Wait:", description: "Cover the cup with the saucer and invert them together. Let it sit for 5-10 minutes for the grounds to settle and dry slightly." },
      { icon: Camera, title: "Capture the Patterns:", description: "Carefully lift the cup. Take clear, well-lit photos of the patterns inside the cup from various angles. Also, photograph any patterns on the saucer." },
      { icon: UploadCloud, title: "Submit for Interpretation:", description: "Upload your images. You can ask a specific question if you have one." }
    ],
    importantNotes: [
      "Traditional readings often interpret different sections of the cup (handle area, rim, bottom).",
      "Note any prominent shapes or symbols you see immediately."
    ],
    imageSrc: "/images/instructions/coffee-cup.png",
    imageAlt: "Coffee cup with grounds",
    imageAiHint: "coffee grounds",
  },
  tarot: {
    pageTitle: "Preparing for Your Tarot Reading",
    pageTagline: "Consult the cards for guidance and clarity.",
    cardTitle: "The Tarot Spread",
    cardDescription: "Prepare for your AI-assisted Tarot reading with these steps:",
    steps: [
      { icon: Layers, title: "Center Yourself:", description: "Find a quiet space. Take a few deep breaths and focus on your question or intention for the reading." },
      { icon: Repeat, title: "Shuffle and Cut:", description: "Shuffle your tarot deck thoroughly. When ready, cut the deck if that's part of your practice." },
      { icon: Pyramid, title: "Lay Your Spread:", description: "Lay out the cards according to the spread you wish to use (e.g., Three Card Spread, Celtic Cross). Ensure cards are clearly visible." },
      { icon: Camera, title: "Photograph the Spread:", description: "Take one clear, well-lit photo of the entire spread. Make sure all cards and their orientation (upright/reversed) are clear." },
      { icon: UploadCloud, title: "Receive Your Reading:", description: "Upload the photo of your spread. Our AI will interpret the cards for you." }
    ],
    importantNotes: [
      "The AI provides interpretations based on common card meanings.",
      "Consider how the reading resonates with your intuition and current situation."
    ],
    imageSrc: "/images/instructions/tarot-cards.png",
    imageAlt: "Tarot cards",
    imageAiHint: "tarot cards",
  },
  runes: {
    pageTitle: "Preparing for Your Rune Casting",
    pageTagline: "Seek wisdom from the ancient runes.",
    cardTitle: "Casting the Runes",
    cardDescription: "Follow these steps for your AI-assisted rune reading:",
    steps: [
      { icon: Languages, title: "Focus Your Intent:", description: "Hold your runes in your hands or bag. Concentrate on your question or seek general guidance." },
      { icon: Repeat, title: "Mix and Cast:", description: "Gently mix the runes. When ready, cast or draw them onto a clean, plain surface (like a cloth)." },
      { icon: Scroll, title: "Observe the Cast:", description: "Note which runes are face up, their orientation (if applicable), and their positions relative to each other." },
      { icon: Camera, title: "Photograph the Runes:", description: "Take one clear, well-lit photo of the runes exactly as they have fallen. Ensure all relevant runes and their orientations are clear." },
      { icon: UploadCloud, title: "Get Your Interpretation:", description: "Upload the photo of your rune cast. Our AI will provide insights based on their meanings." }
    ],
    importantNotes: [
      "Consider runes that landed close together or far apart.",
      "If your set includes a blank rune, its appearance (or absence) can be significant."
    ],
    imageSrc: "/images/instructions/runes-set.png",
    imageAlt: "Set of runes",
    imageAiHint: "runes stones",
  },
};


interface WelcomeInstructionsProps {
  readingType: "tea" | "coffee" | "tarot" | "runes";
}

export function WelcomeInstructions({ readingType }: WelcomeInstructionsProps) {
  const router = useRouter();
  const { user, userProfile, loading: authLoading, loadingProfile } = useAuth();

  const [instructions, setInstructions] = useState<InstructionSet | null>(null);
  const [isLoadingContent, setIsLoadingContent] = useState(true);

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
    const data = instructionsData[readingType];
    if (data) {
      setInstructions(data);
    } else {
      // Fallback or error handling if readingType is invalid
      router.replace('/'); // Or show an error message
    }
    setIsLoadingContent(false);
  }, [readingType, router]);

  useEffect(() => {
    // Redirect Tassologist to their dashboard if they land on a welcome page
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

  if (authLoading || loadingProfile || isLoadingContent) {
    return (
      <div className="container mx-auto min-h-screen flex flex-col items-center justify-center py-8">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-lg text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!instructions) {
    // This case should ideally be handled by the redirect in the first useEffect if readingType is invalid
    return (
        <div className="container mx-auto min-h-screen flex flex-col items-center justify-center py-8">
            <p>Instructions not found for {readingType}.</p>
            <Button onClick={() => router.push('/')} className="mt-4">Back to Choices</Button>
        </div>
    );
  }


  return (
    <div className="container mx-auto min-h-screen flex flex-col items-center justify-center py-8 selection:bg-accent selection:text-accent-foreground">
      <header className="text-center mb-10">
        <Image
          src={instructions.imageSrc || "/swirl-logo.png"}
          alt={instructions.imageAlt || "SipnRead Logo"}
          width={77}
          height={77}
          className="mx-auto mb-4"
          data-ai-hint={instructions.imageAiHint || "logo swirl"}
        />
        <h1 className="text-5xl md:text-6xl font-headline text-primary mb-3 tracking-tight">
          {instructions.pageTitle}
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground">{instructions.pageTagline}</p>
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
              {instructions.cardTitle}
            </CardTitle>
            <CardDescription>{instructions.cardDescription}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-card-foreground">
            {instructions.steps.map((step, index) => (
              <div key={index} className="flex items-start">
                <step.icon className="h-5 w-5 text-primary mr-3 mt-0.5 shrink-0" />
                <p><span className="font-semibold">{step.title}</span> {step.description}</p>
              </div>
            ))}
             {instructions.importantNotes && instructions.importantNotes.length > 0 && (
              <div className="pt-4">
                <h3 className="font-semibold text-md mb-2 text-secondary-foreground flex items-center">
                  <Info className="h-4 w-4 mr-2 text-primary" />
                  Important Notes:
                </h3>
                <ul className="space-y-1.5 pl-5 list-disc list-outside text-sm">
                  {instructions.importantNotes.map((note, index) => (
                    <li key={index} className="leading-relaxed">{note}</li>
                  ))}
                </ul>
              </div>
            )}
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
