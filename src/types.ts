export interface Point {
  x: number;
  y: number;
}

export type PieceShape = 'classic' | 'square' | 'hexagon';

export interface Puzzle {
  id: string;
  imageUrl: string;
  prompt?: string;
  creatorEmail: string;
  isPublic: boolean;
  createdAt: number;
  settings: PuzzleSettings;
}

export interface PuzzleSettings {
  gridSize: { rows: number; cols: number };
  shape: PieceShape;
  aspectRatio: '9:16' | '1:1' | '4:3';
}

export interface Piece {
  id: number;
  correctPos: Point;
  currentPos: Point;
  isLocked: boolean;
  tabs: {
    top: number;    // 1 for male, -1 for female, 0 for flat
    right: number;
    bottom: number;
    left: number;
  };
  neighbors: {
    top: number | null;
    right: number | null;
    bottom: number | null;
    left: number | null;
  };
}
