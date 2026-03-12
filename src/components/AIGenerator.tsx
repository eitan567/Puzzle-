import { useState } from 'react';
import { GoogleGenAI } from "@google/genai";
import { motion } from 'motion/react';
import { Sparkles, Loader2, Image as ImageIcon } from 'lucide-react';

interface AIGeneratorProps {
  onImageGenerated: (url: string, prompt: string) => void;
}

export function AIGenerator({ onImageGenerated }: AIGeneratorProps) {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateImage = async () => {
    if (!prompt.trim()) return;
    
    setIsGenerating(true);
    setError(null);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { 
          parts: [{ text: `A high-quality, vibrant, and detailed image suitable for a jigsaw puzzle. The subject is: ${prompt}. Style: artistic and clear.` }] 
        },
        config: {
          imageConfig: {
            aspectRatio: "9:16"
          }
        }
      });

      let imageUrl = '';
      const candidate = response.candidates?.[0];
      if (candidate?.content?.parts) {
        for (const part of candidate.content.parts) {
          if (part.inlineData) {
            imageUrl = `data:image/png;base64,${part.inlineData.data}`;
            break;
          }
        }
      }

      if (imageUrl) {
        onImageGenerated(imageUrl, prompt);
      } else {
        throw new Error('No image was generated. Please try a different prompt.');
      }
    } catch (err) {
      console.error('AI Generation error:', err);
      setError('Failed to generate image. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-6 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm rounded-2xl border border-[#141414]/10 dark:border-white/10">
      <div className="flex items-center gap-2 mb-4 text-[#141414]/60 dark:text-zinc-400">
        <Sparkles className="w-5 h-5" />
        <h3 className="font-medium">AI Image Generator</h3>
      </div>
      
      <div className="space-y-4">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the puzzle you want to create... (e.g., 'A magical forest with glowing mushrooms')"
          className="w-full h-32 p-4 bg-white dark:bg-zinc-800 border border-[#141414]/10 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#141414]/20 dark:focus:ring-white/20 resize-none dark:text-zinc-100 dark:placeholder-zinc-500"
          disabled={isGenerating}
        />
        
        {error && (
          <p className="text-red-500 text-sm">{error}</p>
        )}
        
        <button
          onClick={generateImage}
          disabled={isGenerating || !prompt.trim()}
          className="w-full py-4 bg-[#141414] dark:bg-zinc-100 text-[#E4E3E0] dark:text-zinc-900 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-[#141414]/90 dark:hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Generating Magic...
            </>
          ) : (
            <>
              <ImageIcon className="w-5 h-5" />
              Generate Puzzle Image
            </>
          )}
        </button>
      </div>
    </div>
  );
}
