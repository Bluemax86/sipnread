// src/components/sipnread/WelcomeInstructions.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, AlertCircle, CheckCircle, ArrowRight, ArrowLeft, Info } from 'lucide-react';

interface WelcomeInstructionsProps {
  readingType: string | null;
}

interface InstructionSet {
  title: string;
  imageSrc: string;
  imageAlt: string;
  aiHint: string;
  steps: string[];
  importantNotes?: string[];
}

const instructionsData: Record<string, InstructionSet> = {
  tea: {
    title: "Preparing for Your Tea Leaf Reading",
    imageSrc: "/images/instructions/tea-preparation.jpg",
    imageAlt: "Cup of tea with loose leaves",
    aiHint: "tea cup leaves",
    steps: [
      "Brew your favorite loose-leaf tea directly in your cup. Avoid using a tea bag or strainer.",
      "Drink your tea, leaving a very small amount of liquid (about a teaspoon) and the leaves at the bottom.",
      "Hold the cup in your dominant hand. Gently swirl the cup three times anticlockwise, ensuring the leaves move around.",
      "Carefully invert the cup onto a saucer. Let it drain for about a minute. Do not lift it during this time.",
      "Turn the cup upright. You're now ready to take photos!",
      "Photo 1: Handle at 3 o'clock (right side).",
      "Photo 2: Handle at 6 o'clock (towards you).",
      "Photo 3: Handle at 9 o'clock (left side).",
      "Photo 4: Handle at 12 o'clock (away from you).",
      "Ensure photos are clear, well-lit, and show the entire inside of the cup including the handle's position."
    ],
    importantNotes: [
      "Use a plain, light-colored cup for best results.",
      "Focus your intention or question while drinking and swirling the tea.",
      "Try to capture as much of the cup's interior as possible in each photo."
    ]
  },
  coffee: {
    title: "Preparing for Your Coffee Ground Reading",
    imageSrc: "/images/instructions/coffee-preparation.jpg",
    imageAlt: "Turkish coffee cup with grounds",
    aiHint: "coffee grounds cup",
    steps: [
      "Prepare Turkish coffee or a similar unfiltered coffee, allowing sediment to settle.",
      "Drink the coffee, leaving the thick sediment at the bottom.",
      "Cover the cup with the saucer.",
      "With the saucer held firmly against the cup, make a few circular motions to distribute the grounds.",
      "Invert the cup and saucer together. Let it sit for 5-10 minutes for the grounds to settle and dry slightly.",
      "Carefully lift the cup. The patterns are now ready to be photographed.",
      "Take clear, well-lit photos of the patterns inside the cup from various angles.",
      "Also, take photos of any patterns that may have transferred onto the saucer."
    ],
     importantNotes: [
      "Traditional readings often interpret different sections of the cup (handle area, rim, bottom).",
      "Note any prominent shapes or symbols you see immediately."
    ]
  },
  tarot: {
    title: "Preparing for Your Tarot Reading",
    imageSrc: "/images/instructions/tarot-spread.jpg",
    imageAlt: "Tarot cards laid out in a spread",
    aiHint: "tarot cards spread",
    steps: [
      "Find a quiet space where you won't be disturbed.",
      "Take a few deep breaths to center yourself. Clear your mind of distractions.",
      "If you have a specific question, hold it in your mind as you prepare.",
      "Shuffle your tarot deck thoroughly while focusing on your question or general intention for the reading.",
      "When you feel ready, cut the deck if that's part of your practice.",
      "Lay out the cards according to the spread you wish to use (e.g., Three Card Spread, Celtic Cross). Ensure the cards are clearly visible and distinguishable.",
      "Take one clear, well-lit photo of the entire spread. Make sure all cards are in the frame and their orientation (upright/reversed) is clear."
    ],
    importantNotes: [
      "The AI will provide an interpretation based on common meanings. Your personal intuition is also valuable.",
      "If a card's meaning seems unclear, reflect on how it might relate to your current situation."
    ]
  },
  runes: {
    title: "Preparing for Your Rune Casting",
    imageSrc: "/images/instructions/runes-cast.jpg",
    imageAlt: "Runes cast on a cloth",
    aiHint: "runes casting cloth",
    steps: [
      "Find a calm, dedicated space for your rune cast.",
      "Hold your runes in your hands or bag, focusing on your question or seeking general guidance.",
      "Gently mix the runes.",
      "When ready, cast or draw the runes onto a clean, plain surface (like a cloth). The number of runes depends on the type of reading (e.g., single rune, three-rune spread).",
      "Observe which runes are face up, their orientation (if applicable to your rune set/system), and their positions relative to each other.",
      "Take one clear, well-lit photo of the cast runes exactly as they have fallen. Ensure all relevant runes are visible and their orientations are clear."
    ],
    importantNotes: [
      "Note any runes that landed particularly close or far from others.",
      "If your runes have a blank one, its meaning (or lack thereof) can also be significant."
    ]
  },
};

export function WelcomeInstructions({ readingType }: WelcomeInstructionsProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [instructions, setInstructions] = useState<InstructionSet | null>(null);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    if (readingType && instructionsData[readingType]) {
      setInstructions(instructionsData[readingType]);
    } else if (readingType) {
      setError(`Instructions for "${readingType}" are not available yet. Please select another method.`);
      setInstructions(null);
    } else {
      setError("No reading type selected. Please go back and choose a divination method.");
      setInstructions(null);
    }
    setIsLoading(false);
  }, [readingType]);

  if (isLoading) {
    return (
      <div className="container mx-auto min-h-[calc(100vh-120px)] flex flex-col items-center justify-center py-8">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-lg text-muted-foreground">Loading Instructions...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto min-h-[calc(100vh-120px)] flex flex-col items-center justify-center py-8 px-4">
        <Alert variant="destructive" className="max-w-lg w-full">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button onClick={() => router.push('/')} className="mt-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Choices
        </Button>
      </div>
    );
  }

  if (!instructions) {
     return (
      <div className="container mx-auto min-h-[calc(100vh-120px)] flex flex-col items-center justify-center py-8 px-4">
        <Alert variant="default" className="max-w-lg w-full">
          <Info className="h-4 w-4" />
          <AlertTitle>Instructions Not Found</AlertTitle>
          <AlertDescription>Detailed instructions for the selected reading type are currently unavailable.</AlertDescription>
        </Alert>
        <Button onClick={() => router.push('/')} className="mt-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Choices
        </Button>
      </div>
    );
  }


  return (
    <Card className="w-full max-w-2xl mx-auto shadow-xl">
      <CardHeader className="text-center">
        <Image
          src={instructions.imageSrc}
          alt={instructions.imageAlt}
          width={150}
          height={100}
          className="mx-auto mb-4 rounded-lg shadow-md object-cover"
          data-ai-hint={instructions.aiHint}
          priority={readingType === 'tea'} // Prioritize tea image if it's the most common first view
        />
        <CardTitle className="font-headline text-3xl text-primary">{instructions.title}</CardTitle>
        <CardDescription className="text-md text-muted-foreground pt-1">
          Follow these steps carefully to ensure the best possible reading.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h3 className="font-semibold text-lg mb-3 text-secondary-foreground flex items-center">
            <CheckCircle className="h-5 w-5 mr-2 text-primary" />
            Preparation Steps:
          </h3>
          <ul className="space-y-2.5 pl-5 list-decimal list-outside text-card-foreground">
            {instructions.steps.map((step, index) => (
              <li key={index} className="leading-relaxed">{step}</li>
            ))}
          </ul>
        </div>

        {instructions.importantNotes && instructions.importantNotes.length > 0 && (
          <div>
            <h3 className="font-semibold text-lg mb-3 text-secondary-foreground flex items-center">
              <Info className="h-5 w-5 mr-2 text-primary" />
              Important Notes:
            </h3>
            <ul className="space-y-2 pl-5 list-disc list-outside text-card-foreground">
              {instructions.importantNotes.map((note, index) => (
                <li key={index} className="leading-relaxed">{note}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 pt-4">
          <Button onClick={() => router.push('/')} variant="outline" className="w-full sm:w-auto">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Choices
          </Button>
          <Button onClick={() => router.push('/get-reading')} className="w-full sm:w-auto">
            OK, I&apos;m Ready!
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
