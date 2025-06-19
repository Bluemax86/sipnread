'use client';

// Import the user's manually created component for coffee instructions
import { WelcomeInstructions } from '@/components/sipnread/WelcomeInstructions';

export default function CoffeeWelcomePage() {
  // Render the user's specific coffee instructions component
  return <WelcomeInstructions readingType="coffee" />;
}
