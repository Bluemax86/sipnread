
// src/ai/flows/extract-symbols-from-text.ts
'use server';
/**
 * @fileOverview Extracts tea leaf symbols and their clock positions from a given text.
 *
 * - extractSymbolsFromText - A function that handles the symbol extraction process.
 * - ExtractSymbolsInput - The input type for the extractSymbolsFromText function.
 * - ExtractSymbolsOutput - The return type for the extractSymbolsFromText function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ExtractSymbolsInputSchema = z.object({
  interpretationText: z.string().describe('The tea leaf interpretation text to analyze.'),
});
export type ExtractSymbolsInput = z.infer<typeof ExtractSymbolsInputSchema>;

const ExtractedSymbolSchema = z.object({
  symbolName: z.string().describe('The name of the symbol identified.'),
  position: z.number().int().min(0).max(12).optional().describe('The clock position (0-12) of the symbol, if specified. Omit if not a clear clock position or if "general area".'),
});
export type ExtractedSymbol = z.infer<typeof ExtractedSymbolSchema>;

const ExtractSymbolsOutputSchema = z.object({
  extractedSymbols: z.array(ExtractedSymbolSchema).describe('An array of extracted symbols with their names and optional positions.'),
});
export type ExtractSymbolsOutput = z.infer<typeof ExtractSymbolsOutputSchema>;

export async function extractSymbolsFromText(input: ExtractSymbolsInput): Promise<ExtractSymbolsOutput> {
  return extractSymbolsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractSymbolsPrompt',
  input: {schema: ExtractSymbolsInputSchema},
  output: {schema: ExtractSymbolsOutputSchema},
  prompt: `You are an AI assistant specialized in Tasseography (tea leaf reading).
    Your task is to read the provided tea leaf interpretation text and extract any mentioned tea leaf symbols and their corresponding clock positions.

    Rules for extraction:
    1.  Identify distinct tea leaf symbols (e.g., "Anchor", "Bird", "Mountain", "Letter A").
    2.  If a clock position is mentioned with a symbol (e.g., "at 3 o'clock", "near 9", "around 6 o'clock position"), extract the numerical value of the hour (0 through 12).
        *   If "12 o'clock" is mentioned, use 12.
        *   If "0 o'clock" or "center" or "bottom without a number" is mentioned related to the clock, use 0 or simply omit position if it's more general.
    3.  If a symbol is described as being in a "general area", "top", "bottom", "left side", "right side" WITHOUT a specific clock number, then the 'position' field for that symbol should be omitted (undefined).
    4.  Provide the output as a JSON object strictly adhering to the following format:
        {
          "extractedSymbols": [
            { "symbolName": "Example Symbol One", "position": 3 },
            { "symbolName": "Example Symbol Two" } // No position specified or general area
          ]
        }
    5.  If no symbols are found, return an empty "extractedSymbols" array.
    6.  Focus only on explicit symbol names and their direct clock positions. Do not infer symbols or positions not clearly stated.

    Interpretation Text to Analyze:
    \`\`\`
    {{{interpretationText}}}
    \`\`\`
    `,
});

const extractSymbolsFlow = ai.defineFlow(
  {
    name: 'extractSymbolsFlow',
    inputSchema: ExtractSymbolsInputSchema,
    outputSchema: ExtractSymbolsOutputSchema,
  },
  async (input: ExtractSymbolsInput) => {
    // Ensure Gemini safety filters are not overly restrictive for this text analysis task.
    const customConfig = {
      safetySettings: [
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      ],
    };

    const {output} = await prompt(input, {config: customConfig});
    return output || { extractedSymbols: [] }; // Ensure a valid output even if AI returns null
  }
);
