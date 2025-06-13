
'use client';

import type { AiSymbol } from '@/app/actions'; // Import the updated AiSymbol type
import { Badge } from '@/components/ui/badge';
import { BookOpenText, Feather, Tag, Info } from 'lucide-react';

interface InterpretationDisplayProps {
  aiSymbolsDetected: AiSymbol[];
  aiInterpretation: string;
  titleIcon?: React.ReactNode; // Kept for potential future use
  titleText?: string; // Kept for potential future use
  symbolsTitleText?: string;
  interpretationTitleText?: string;
}

export function InterpretationDisplay({ 
  aiSymbolsDetected, 
  aiInterpretation,
  symbolsTitleText = "AI Symbols Detected:",
  interpretationTitleText = "AI Interpretation:"
}: InterpretationDisplayProps) {

  return (
    <div className="space-y-8">
      {aiSymbolsDetected && aiSymbolsDetected.length > 0 && (
        <div>
          <h3 className="text-xl font-semibold mb-4 font-headline text-primary flex items-center">
            <Feather className="mr-2 h-5 w-5" />
            {symbolsTitleText}
          </h3>
          <ul className="space-y-5">
            {aiSymbolsDetected.map((symbol, index) => (
              <li key={index} className="p-4 border rounded-lg shadow-sm bg-card/50">
                <h4 className="text-lg font-semibold text-primary mb-2 flex items-center">
                   <Tag className="mr-2 h-4 w-4 text-primary" /> {symbol.symbolName}
                </h4>
                <div className="space-y-1.5 text-sm text-card-foreground">
                  <p><strong className="font-medium">Description:</strong> {symbol.symbolDescription}</p>
                  <p><strong className="font-medium">Position in Cup (Reference: Handle at 3 o&apos;clock):</strong> {symbol.truePositionInCup}</p>
                  <p><strong className="font-medium">Best Seen In View(s):</strong> {symbol["bestSeenInView(s)"]}</p>
                  {symbol.appearanceNotes && (
                    <p><strong className="font-medium">Appearance Notes:</strong> {symbol.appearanceNotes}</p>
                  )}
                  <p><strong className="font-medium">Traditional Meaning:</strong> {symbol.traditionalMeaning}</p>
                  <div className="flex items-center">
                    <strong className="font-medium mr-1.5">Origin:</strong> 
                    <Badge 
                      variant={
                        symbol.origin === 'ai-discovered' ? 'secondary' 
                        : symbol.origin === 'user-identified and confirmed' ? 'outline' 
                        : 'default'
                      }
                      className={
                        symbol.origin === 'user-identified and confirmed' ? 'border-primary text-primary bg-primary/10'
                        : '' // Default secondary will apply otherwise for 'ai-discovered'
                      }
                    >
                      {symbol.origin || 'Unknown'}
                    </Badge>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      
      <div>
        <h3 className="text-xl font-semibold mb-3 font-headline text-primary flex items-center">
           <BookOpenText className="mr-2 h-5 w-5" />
          {interpretationTitleText}
        </h3>
        <div className="text-card-foreground whitespace-pre-wrap leading-relaxed prose prose-sm dark:prose-invert max-w-none">
          {aiInterpretation.split('\n').map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
      </div>

      {(!aiSymbolsDetected || aiSymbolsDetected.length === 0) && !aiInterpretation && (
        <div className="text-center py-4">
            <Info className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-muted-foreground">No interpretation details available.</p>
        </div>
      )}
    </div>
  );
}
