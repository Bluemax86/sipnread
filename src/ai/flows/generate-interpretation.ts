'use server';

/**
 * @fileOverview Generates an interpretation of a tea leaf reading based on an image and optional user question.
 *
 * - generateInterpretation - A function that generates the tea leaf reading interpretation.
 * - GenerateInterpretationInput - The input type for the generateInterpretation function.
 * - GenerateInterpretationOutput - The return type for the generateInterpretation function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateInterpretationInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo of the tea leaves in a cup, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  userQuestion: z
    .string()
    .optional()
    .describe('An optional question from the user to guide the interpretation.'),
});
export type GenerateInterpretationInput = z.infer<typeof GenerateInterpretationInputSchema>;

const GenerateInterpretationOutputSchema = z.object({
  interpretation: z.string().describe('The interpretation of the tea leaf reading.'),
});
export type GenerateInterpretationOutput = z.infer<typeof GenerateInterpretationOutputSchema>;

export async function generateInterpretation(
  input: GenerateInterpretationInput
): Promise<GenerateInterpretationOutput> {
  return generateInterpretationFlow(input);
}

const generateInterpretationPrompt = ai.definePrompt({
  name: 'generateInterpretationPrompt',
  input: {schema: GenerateInterpretationInputSchema},
  output: {schema: GenerateInterpretationOutputSchema},
  prompt: `You are an expert tea leaf reader. Analyze the tea leaves in the provided image and generate an interpretation.

  Consider traditional tea leaf reading meanings and symbols.

  If the user provided a question, focus the interpretation on answering that question.

  Image: {{media url=photoDataUri}}

  Question: {{#if userQuestion}}{{{userQuestion}}}{{else}}No question provided. Provide a general reading.{{/if}}
  `,
});

const generateInterpretationFlow = ai.defineFlow(
  {
    name: 'generateInterpretationFlow',
    inputSchema: GenerateInterpretationInputSchema,
    outputSchema: GenerateInterpretationOutputSchema,
  },
  async input => {
    const {output} = await generateInterpretationPrompt(input);
    return output!;
  }
);
