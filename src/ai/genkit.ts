
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

// Try with minimal configuration, relying on Application Default Credentials
// and environment auto-detection for projectId.
// The googleAI plugin will attempt to discover the project ID from the environment.
const googleAiPlugin = googleAI();

export const ai = genkit({
  plugins: [googleAiPlugin],
  model: 'googleai/gemini-2.0-flash', // Default model for text, not directly for speech
});
