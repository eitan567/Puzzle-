/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PuzzleBoard } from './components/PuzzleBoard';
import { ImageUpload } from './components/ImageUpload';
import { AIGenerator } from './components/AIGenerator';
import { PuzzleGallery } from './components/PuzzleGallery';
import { PuzzleSettings, PieceShape, Puzzle } from './types';
import { Settings, RefreshCw, ChevronLeft, Trophy, Grid3X3, Shapes, LogIn, LogOut, Share2, Library, Sparkles, Lock, Clock, Moon, Sun } from 'lucide-react';
import { auth, db } from './firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User } from 'firebase/auth';
import { collection, addDoc, serverTimestamp, updateDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { compressImage, handleFirestoreError, OperationType } from './utils';
import { playClickSound, playCompleteSound } from './utils/audio';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [currentPuzzleId, setCurrentPuzzleId] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [view, setView] = useState<'home' | 'gallery' | 'ai' | 'game'>('home');
  const [gameState, setGameState] = useState<'preview' | 'playing' | 'complete'>('preview');
  const [showHint, setShowHint] = useState(false);
  const [settings, setSettings] = useState<PuzzleSettings>(() => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    return {
      gridSize: isMobile ? { rows: 4, cols: 4 } : { rows: 3, cols: 3 },
      shape: 'classic',
      aspectRatio: '9:16'
    };
  });
  const [showSettings, setShowSettings] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const [hideSuccessOverlay, setHideSuccessOverlay] = useState(false);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('darkMode');
      if (saved !== null) return JSON.parse(saved);
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', JSON.stringify(isDarkMode));
  }, [isDarkMode]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      const fetchSettings = async () => {
        try {
          const docRef = doc(db, 'users', user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists() && docSnap.data().settings) {
            setSettings(docSnap.data().settings);
          }
        } catch (err) {
          console.error("Error fetching user settings:", err);
        }
      };
      fetchSettings();
    }
  }, [user]);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleSettingChange = (newSettings: PuzzleSettings) => {
    setSettings(newSettings);
    setCurrentPuzzleId(null);
    setHasSaved(false);
    
    if (user) {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(async () => {
        try {
          await setDoc(doc(db, 'users', user.uid), { settings: newSettings }, { merge: true });
        } catch (err) {
          console.error("Error saving user settings:", err);
        }
      }, 500);
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setTimeElapsed(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  useEffect(() => {
    if (imageUrl) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = imageUrl;
      img.onload = () => {
        setImage(img);
        setGameState('preview');
        setView('game');
      };
      img.onerror = () => {
        alert('Failed to load image. Please try another one.');
      };
    }
  }, [imageUrl]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (err) {
      console.error('Login error:', err);
    }
  };

  const handleLogout = () => signOut(auth);

  const savePuzzle = async (isPublic: boolean) => {
    if (!user || !imageUrl) return;
    setIsSaving(true);
    try {
      if (currentPuzzleId) {
        // If it's already saved, just update the visibility
        await updateDoc(doc(db, 'puzzles', currentPuzzleId), {
          isPublic
        });
        alert(isPublic ? 'Puzzle shared with the community!' : 'Puzzle saved to your collection.');
      } else {
        // Compress image before saving to Firestore (1MB limit)
        const compressedUrl = await compressImage(imageUrl);
        
        const docRef = await addDoc(collection(db, 'puzzles'), {
          imageUrl: compressedUrl,
          creatorEmail: user.email,
          isPublic,
          createdAt: Date.now(),
          settings,
          id: Math.random().toString(36).substr(2, 9)
        });
        setCurrentPuzzleId(docRef.id);
        alert(isPublic ? 'Puzzle shared with the community!' : 'Puzzle saved to your collection.');
      }
    } catch (err) {
      handleFirestoreError(err, currentPuzzleId ? OperationType.UPDATE : OperationType.CREATE, 'puzzles');
      alert('Failed to save puzzle. The image might be too large.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    const currentUrl = imageUrl;
    setImageUrl(null);
    setImage(null);
    setIsComplete(false);
    setGameState('playing');
    setHideSuccessOverlay(false);
    setTimeElapsed(0);
    setIsTimerRunning(true);
    setTimeout(() => setImageUrl(currentUrl), 50);
  };

  const handleBack = () => {
    setImageUrl(null);
    setImage(null);
    setCurrentPuzzleId(null);
    setHasSaved(false);
    setIsComplete(false);
    setGameState('preview');
    setHideSuccessOverlay(false);
    setIsTimerRunning(false);
    setTimeElapsed(0);
    setView('home');
  };

  const handleSelectFromGallery = (puzzle: Puzzle) => {
    setSettings(puzzle.settings);
    setImageUrl(puzzle.imageUrl);
    setCurrentPuzzleId(puzzle.id);
    setHasSaved(false);
  };

  return (
    <div className="min-h-screen bg-[#E4E3E0] dark:bg-zinc-950 text-[#141414] dark:text-zinc-100 font-sans selection:bg-[#141414] selection:text-[#E4E3E0] dark:selection:bg-zinc-100 dark:selection:text-zinc-950">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 px-6 py-4 flex justify-between items-center border-b border-[#141414]/10 dark:border-white/10 backdrop-blur-md bg-[#E4E3E0]/80 dark:bg-zinc-950/80">
        <div className="flex items-center gap-4">
          {view !== 'home' && (
            <button 
              onClick={() => { playClickSound(); handleBack(); }}
              className="p-2 hover:bg-[#141414]/5 dark:hover:bg-white/10 rounded-full transition-colors"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}
          <h1 className="text-xl font-bold tracking-tight italic font-serif hidden sm:block">PUZZLE MASTER</h1>
          
          {view === 'game' && gameState !== 'preview' && (
            <div className="flex items-center gap-2 bg-[#141414]/5 dark:bg-white/5 px-4 py-1.5 rounded-full font-mono font-bold text-lg">
              <Clock className="w-4 h-4 opacity-50" />
              {formatTime(timeElapsed)}
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => { playClickSound(); setIsDarkMode(!isDarkMode); }} 
            className="p-2 hover:bg-[#141414]/5 dark:hover:bg-white/10 rounded-full transition-colors"
            title="Toggle Dark Mode"
          >
            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          {user ? (
            <div className="flex items-center gap-3">
              <span className="hidden sm:block text-xs font-medium opacity-60">{user.email}</span>
              <button onClick={() => { playClickSound(); handleLogout(); }} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/30 text-red-500 dark:text-red-400 rounded-full transition-colors" title="Logout">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <button onClick={() => { playClickSound(); handleLogin(); }} className="flex items-center gap-2 px-4 py-2 bg-[#141414] dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity">
              <LogIn className="w-4 h-4" />
              Login
            </button>
          )}
          {view === 'game' && !isComplete && (
            <div className="flex items-center gap-2">
              <button 
                onMouseDown={() => setShowHint(true)}
                onMouseUp={() => setShowHint(false)}
                onMouseLeave={() => setShowHint(false)}
                onTouchStart={() => setShowHint(true)}
                onTouchEnd={() => setShowHint(false)}
                className={`p-2 rounded-full transition-colors ${showHint ? 'bg-[#141414] dark:bg-zinc-100 text-[#E4E3E0] dark:text-zinc-900' : 'hover:bg-[#141414]/5 dark:hover:bg-white/10'}`}
                title="Hold to see hint"
              >
                <Sparkles className="w-5 h-5" />
              </button>
              <button 
                onClick={() => { playClickSound(); handleReset(); }}
                className="p-2 hover:bg-[#141414]/5 dark:hover:bg-white/10 rounded-full transition-colors"
                title="Shuffle"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>
          )}
          <button 
            onClick={() => { playClickSound(); setShowSettings(!showSettings); }}
            className={`p-2 rounded-full transition-colors ${showSettings ? 'bg-[#141414] dark:bg-zinc-100 text-[#E4E3E0] dark:text-zinc-900' : 'hover:bg-[#141414]/5 dark:hover:bg-white/10'}`}
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className={`w-full pt-20 pb-8 px-2 sm:px-6 flex flex-col items-center ${view === 'game' ? 'justify-start' : 'justify-center'} min-h-screen`}>
        <AnimatePresence mode="wait">
          {view === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-4xl flex flex-col items-center"
            >
              <div className="text-center mb-12">
                <h2 className="text-4xl md:text-7xl font-bold mb-4 tracking-tighter uppercase px-4">Create Your Challenge</h2>
                <p className="text-base md:text-lg opacity-60 max-w-lg mx-auto px-4">Turn any memory or AI creation into a beautiful interactive puzzle.</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full px-4 items-stretch">
                <button 
                  onClick={() => { playClickSound(); setView('ai'); }}
                  className="p-8 bg-white dark:bg-zinc-900 rounded-3xl border border-[#141414]/10 dark:border-white/10 hover:shadow-xl transition-all flex flex-col items-center text-center gap-4 group h-full"
                >
                  <div className="w-16 h-16 bg-purple-50 dark:bg-purple-900/30 rounded-2xl flex items-center justify-center text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform">
                    <Sparkles className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-1">AI Generator</h3>
                    <p className="text-sm opacity-60">Create unique images from text prompts</p>
                  </div>
                </button>

                <div className="h-full" onClick={() => playClickSound()}>
                  <ImageUpload onImageUpload={(url) => { setImageUrl(url); setCurrentPuzzleId(null); setHasSaved(false); }} />
                </div>

                <button 
                  onClick={() => { playClickSound(); setView('gallery'); }}
                  className="p-8 bg-white dark:bg-zinc-900 rounded-3xl border border-[#141414]/10 dark:border-white/10 hover:shadow-xl transition-all flex flex-col items-center text-center gap-4 group h-full"
                >
                  <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                    <Library className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-1">Gallery</h3>
                    <p className="text-sm opacity-60">Browse and play community puzzles</p>
                  </div>
                </button>
              </div>
            </motion.div>
          )}

          {view === 'ai' && (
            <motion.div
              key="ai"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="w-full"
            >
              <AIGenerator onImageGenerated={(url) => { setImageUrl(url); setCurrentPuzzleId(null); setHasSaved(false); }} />
            </motion.div>
          )}

          {view === 'gallery' && (
            <motion.div
              key="gallery"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="w-full"
            >
              <PuzzleGallery onSelect={handleSelectFromGallery} currentUserEmail={user?.email} />
            </motion.div>
          )}

          {view === 'game' && (
            <motion.div
              key="game"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full flex flex-col items-center gap-4 sm:gap-8"
            >
              {image ? (
                <div className="relative w-full flex flex-col items-center">
                  {gameState === 'preview' ? (
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex flex-col items-center gap-8 max-w-2xl w-full px-4"
                    >
                      <div className="relative w-full aspect-[9/16] max-h-[70vh] rounded-3xl overflow-hidden shadow-2xl border-4 border-white dark:border-zinc-800">
                        <img 
                          src={imageUrl!} 
                          alt="Preview" 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end justify-center p-8">
                          <p className="text-white text-lg font-medium italic">Study the image carefully...</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => {
                          playClickSound();
                          setGameState('playing');
                          setTimeElapsed(0);
                          setIsTimerRunning(true);
                        }}
                        className="px-12 py-4 bg-[#141414] dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-2xl font-bold text-xl hover:scale-105 transition-transform shadow-xl"
                      >
                        Start Puzzle
                      </button>
                    </motion.div>
                  ) : (
                    <div className="relative w-full flex justify-center">
                      <PuzzleBoard 
                        image={image} 
                        settings={settings} 
                        onComplete={() => {
                          playCompleteSound();
                          setIsComplete(true);
                          setGameState('complete');
                          setIsTimerRunning(false);
                        }} 
                      />
                      
                      {/* Hint Overlay */}
                      <AnimatePresence>
                        {showHint && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 0.4 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 pointer-events-none flex justify-center items-center"
                          >
                            <div className="w-full h-full max-w-6xl mx-auto rounded-xl sm:rounded-3xl overflow-hidden">
                              <img 
                                src={imageUrl!} 
                                alt="Hint" 
                                className="w-full h-full object-contain"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                      
                      {isComplete && (
                        <div 
                          className={`absolute inset-0 flex flex-col items-center justify-center transition-all duration-500 ${hideSuccessOverlay ? 'bg-transparent pointer-events-none' : 'bg-[#E4E3E0]/20 dark:bg-zinc-950/40 backdrop-blur-[2px] z-10'}`}
                        >
                          {!hideSuccessOverlay ? (
                            <motion.div 
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className="bg-[#141414] dark:bg-zinc-900 text-[#E4E3E0] dark:text-zinc-100 p-8 rounded-3xl shadow-2xl text-center max-w-sm mx-4"
                            >
                              <Trophy className="w-16 h-16 mx-auto mb-4 text-yellow-400" />
                              <h2 className="text-3xl font-bold mb-2">Masterpiece Complete!</h2>
                              <p className="opacity-70 mb-2">You've solved the puzzle with precision.</p>
                              <div className="flex items-center justify-center gap-2 text-xl font-mono font-bold text-yellow-400 mb-6 bg-white/10 py-2 rounded-xl">
                                <Clock className="w-5 h-5" />
                                {formatTime(timeElapsed)}
                              </div>
                              
                              {user && !currentPuzzleId && !hasSaved && (
                                <div className="flex flex-col gap-2 mb-6">
                                  <button 
                                    onClick={() => { playClickSound(); savePuzzle(true); }}
                                    disabled={isSaving}
                                    className="w-full py-3 bg-white dark:bg-zinc-100 text-[#141414] dark:text-zinc-900 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-zinc-100 dark:hover:bg-white disabled:opacity-50"
                                  >
                                    <Share2 className="w-4 h-4" />
                                    Share Publicly
                                  </button>
                                  <button 
                                    onClick={() => { playClickSound(); savePuzzle(false); }}
                                    disabled={isSaving}
                                    className="w-full py-3 border border-white/20 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-white/10 disabled:opacity-50"
                                  >
                                    <Lock className="w-4 h-4" />
                                    Save Privately
                                  </button>
                                </div>
                              )}
                              
                              {user && hasSaved && (
                                <div className="flex flex-col gap-2 mb-6">
                                  <div className="w-full py-3 bg-green-500/20 text-green-400 rounded-xl font-bold flex items-center justify-center gap-2">
                                    <Trophy className="w-4 h-4" />
                                    Saved to Gallery!
                                  </div>
                                </div>
                              )}

                              <div className="flex gap-4 justify-center mb-4">
                                <button 
                                  onClick={() => { playClickSound(); handleReset(); }}
                                  className="flex-1 py-3 bg-zinc-800 text-white rounded-xl font-bold hover:bg-zinc-700 transition-colors"
                                >
                                  Shuffle
                                </button>
                                <button 
                                  onClick={() => { playClickSound(); handleBack(); }}
                                  className="flex-1 py-3 border border-white/10 rounded-xl font-bold hover:bg-white/5 transition-colors"
                                >
                                  Home
                                </button>
                              </div>

                              <button 
                                onClick={() => { playClickSound(); setHideSuccessOverlay(true); }}
                                className="text-xs opacity-50 hover:opacity-100 transition-opacity underline"
                              >
                                View Completed Puzzle
                              </button>
                            </motion.div>
                          ) : (
                            <button 
                              onClick={() => { playClickSound(); setHideSuccessOverlay(false); }}
                              className="absolute bottom-8 px-6 py-3 bg-[#141414] dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-full font-bold shadow-xl hover:scale-105 transition-transform z-20 pointer-events-auto"
                            >
                              Show Menu
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-96 h-96 bg-[#141414]/5 dark:bg-white/5 rounded-3xl flex items-center justify-center animate-pulse">
                  <p className="text-sm opacity-40 uppercase tracking-widest">Loading Image...</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 bottom-0 w-full sm:w-80 bg-white dark:bg-zinc-900 shadow-2xl z-[60] border-l border-[#141414]/10 dark:border-white/10 flex flex-col"
          >
            <div className="p-8 pb-4 flex justify-between items-center">
              <h3 className="text-2xl font-bold italic font-serif">Settings</h3>
              <button onClick={() => { playClickSound(); setShowSettings(false); }} className="p-2 hover:bg-zinc-100 dark:hover:bg-white/10 rounded-full">
                <ChevronLeft className="w-6 h-6 rotate-180" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 pt-4 space-y-10">
              <section>
                <div className="flex items-center justify-between mb-4 opacity-50">
                  <div className="flex items-center gap-2">
                    <Grid3X3 className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-widest">Grid Size</span>
                  </div>
                  <span className="text-xs font-mono">{settings.gridSize.cols} x {settings.gridSize.rows}</span>
                </div>
                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="font-medium">Columns</span>
                      <span className="font-mono bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md">{settings.gridSize.cols}</span>
                    </div>
                    <input 
                      type="range" 
                      min="2" max="10" 
                      value={settings.gridSize.cols}
                      onChange={(e) => {
                        handleSettingChange({ ...settings, gridSize: { ...settings.gridSize, cols: parseInt(e.target.value) } });
                      }}
                      className="w-full accent-[#141414] dark:accent-zinc-100"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="font-medium">Rows</span>
                      <span className="font-mono bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md">{settings.gridSize.rows}</span>
                    </div>
                    <input 
                      type="range" 
                      min="2" max="10" 
                      value={settings.gridSize.rows}
                      onChange={(e) => {
                        handleSettingChange({ ...settings, gridSize: { ...settings.gridSize, rows: parseInt(e.target.value) } });
                      }}
                      className="w-full accent-[#141414] dark:accent-zinc-100"
                    />
                  </div>
                </div>
              </section>

              <section>
                <div className="flex items-center gap-2 mb-4 opacity-50">
                  <Shapes className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-widest">Piece Shape</span>
                </div>
                <div className="space-y-2">
                  {(['classic', 'square', 'hexagon'] as PieceShape[]).map(shape => (
                    <button
                      key={shape}
                      onClick={() => { 
                        playClickSound(); 
                        handleSettingChange({ ...settings, shape });
                      }}
                      className={`w-full py-3 px-4 rounded-xl border-2 transition-all flex items-center justify-between ${
                        settings.shape === shape 
                          ? 'border-[#141414] dark:border-zinc-100 bg-[#141414] dark:bg-zinc-100 text-white dark:text-zinc-900' 
                          : 'border-zinc-100 dark:border-white/10 hover:border-zinc-300 dark:hover:border-white/30'
                      }`}
                    >
                      <span className="capitalize">{shape}</span>
                      <div className={`w-4 h-4 rounded-sm border ${settings.shape === shape ? 'border-white/50 dark:border-zinc-900/50' : 'border-black/20 dark:border-white/20'}`} />
                    </button>
                  ))}
                </div>
              </section>
            </div>

            <div className="p-8 pt-4 border-t border-[#141414]/5 dark:border-white/5">
              <button 
                onClick={() => {
                  playClickSound();
                  setShowSettings(false);
                  if (imageUrl) handleReset();
                }}
                className="w-full py-4 bg-[#141414] dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-2xl font-bold hover:opacity-90 transition-opacity"
              >
                Apply & Shuffle
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Background Decor */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none opacity-20 dark:opacity-10">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-zinc-400 dark:bg-zinc-800 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-zinc-300 dark:bg-zinc-700 blur-[120px]" />
      </div>
    </div>
  );
}
