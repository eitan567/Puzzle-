import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, limit, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Puzzle } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Grid, Clock, User, Globe, Lock, Trash2, AlertTriangle, Share2 } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../utils';

interface PuzzleGalleryProps {
  onSelect: (puzzle: Puzzle) => void;
  currentUserEmail?: string | null;
}

export function PuzzleGallery({ onSelect, currentUserEmail }: PuzzleGalleryProps) {
  const [puzzles, setPuzzles] = useState<Puzzle[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'public' | 'mine'>('public');
  const [deletingPuzzleId, setDeletingPuzzleId] = useState<string | null>(null);

  const handleDelete = async (puzzleId: string) => {
    try {
      await deleteDoc(doc(db, 'puzzles', puzzleId));
      setDeletingPuzzleId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `puzzles/${puzzleId}`);
    }
  };

  const handleTogglePublic = async (puzzle: Puzzle, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await updateDoc(doc(db, 'puzzles', puzzle.id), {
        isPublic: !puzzle.isPublic
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `puzzles/${puzzle.id}`);
    }
  };

  useEffect(() => {
    setLoading(true);
    let q;
    
    if (filter === 'mine' && currentUserEmail) {
      q = query(
        collection(db, 'puzzles'),
        where('creatorEmail', '==', currentUserEmail),
        orderBy('createdAt', 'desc'),
        limit(20)
      );
    } else {
      q = query(
        collection(db, 'puzzles'),
        where('isPublic', '==', true),
        orderBy('createdAt', 'desc'),
        limit(20)
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Puzzle));
      setPuzzles(docs);
      setLoading(false);
    }, (error) => {
      setLoading(false);
      handleFirestoreError(error, OperationType.LIST, 'puzzles');
    });

    return () => unsubscribe();
  }, [filter, currentUserEmail]);

  return (
    <div className="w-full max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-serif italic">Puzzle Gallery</h2>
        <div className="flex bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm p-1 rounded-xl border border-[#141414]/10 dark:border-white/10">
          <button
            onClick={() => setFilter('public')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filter === 'public' ? 'bg-[#141414] dark:bg-zinc-100 text-[#E4E3E0] dark:text-zinc-900' : 'text-[#141414]/60 dark:text-zinc-400 hover:text-[#141414] dark:hover:text-zinc-100'}`}
          >
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Public
            </div>
          </button>
          {currentUserEmail && (
            <button
              onClick={() => setFilter('mine')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filter === 'mine' ? 'bg-[#141414] dark:bg-zinc-100 text-[#E4E3E0] dark:text-zinc-900' : 'text-[#141414]/60 dark:text-zinc-400 hover:text-[#141414] dark:hover:text-zinc-100'}`}
            >
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4" />
                My Puzzles
              </div>
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="aspect-[9/16] bg-white/20 dark:bg-white/10 animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : puzzles.length === 0 ? (
        <div className="text-center py-20 bg-white/30 dark:bg-zinc-900/30 rounded-3xl border border-dashed border-[#141414]/20 dark:border-white/20">
          <p className="text-[#141414]/40 dark:text-zinc-500">No puzzles found. Be the first to create one!</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {puzzles.map((puzzle) => (
            <motion.div
              key={puzzle.id}
              whileHover={{ y: -8 }}
              onClick={() => onSelect(puzzle)}
              className="group cursor-pointer"
            >
              <div className="relative aspect-[9/16] rounded-2xl overflow-hidden border border-[#141414]/10 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-sm group-hover:shadow-xl transition-all">
                <img
                  src={puzzle.imageUrl}
                  alt={puzzle.prompt || 'Puzzle'}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                
                {currentUserEmail === puzzle.creatorEmail && (
                  <div className="absolute top-3 right-3 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => handleTogglePublic(puzzle, e)}
                      className="p-2 bg-[#141414]/80 dark:bg-zinc-100/80 hover:bg-[#141414] dark:hover:bg-zinc-100 text-white dark:text-zinc-900 rounded-full backdrop-blur-sm"
                      title={puzzle.isPublic ? "Make private" : "Make public"}
                    >
                      {puzzle.isPublic ? <Globe className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingPuzzleId(puzzle.id);
                      }}
                      className="p-2 bg-red-500/80 hover:bg-red-600 text-white rounded-full backdrop-blur-sm"
                      title="Delete puzzle"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-4 flex flex-col justify-end pointer-events-none">
                  <div className="flex items-center gap-2 text-white/80 text-xs mb-1">
                    <Grid className="w-3 h-3" />
                    <span>{puzzle.settings.gridSize.cols}x{puzzle.settings.gridSize.rows}</span>
                  </div>
                  <div className="flex items-center gap-2 text-white/80 text-xs">
                    <User className="w-3 h-3" />
                    <span className="truncate">{puzzle.creatorEmail.split('@')[0]}</span>
                  </div>
                </div>
              </div>
              <p className="mt-3 text-sm font-medium truncate px-1 text-[#141414]/80 dark:text-zinc-400 group-hover:text-[#141414] dark:group-hover:text-zinc-100">
                {puzzle.prompt || 'Custom Puzzle'}
              </p>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {deletingPuzzleId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => setDeletingPuzzleId(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-zinc-900 rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center"
            >
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold mb-2 dark:text-zinc-100">Delete Puzzle?</h3>
              <p className="text-gray-600 dark:text-zinc-400 mb-6">
                Are you sure you want to delete this puzzle? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeletingPuzzleId(null)}
                  className="flex-1 py-3 px-4 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-800 dark:text-zinc-100 rounded-xl font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(deletingPuzzleId)}
                  className="flex-1 py-3 px-4 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium transition-colors"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
