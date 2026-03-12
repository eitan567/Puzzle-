import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Piece, PuzzleSettings, Point, PieceShape } from '../types';
import confetti from 'canvas-confetti';
import { playSnapSound } from '../utils/audio';

interface PuzzleBoardProps {
  image: HTMLImageElement;
  settings: PuzzleSettings;
  onComplete: () => void;
}

export const PuzzleBoard: React.FC<PuzzleBoardProps> = ({ image, settings, onComplete }) => {
  try {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
    const [boardSize, setBoardSize] = useState({ width: 0, height: 0 });
    const [boardOffset, setBoardOffset] = useState({ x: 0, y: 0 });
    const [pieces, setPieces] = useState<Piece[]>([]);
    const [draggingPieceId, setDraggingPieceId] = useState<number | null>(null);
    const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
    const [renderError, setRenderError] = useState<string | null>(null);

    const pieceWidth = boardSize.width / settings.gridSize.cols;
    const pieceHeight = boardSize.height / settings.gridSize.rows;

    // Handle resizing
    useEffect(() => {
      console.log('PuzzleBoard: Resize effect triggered');
      if (!containerRef.current) return;

      const updateSize = () => {
        if (!containerRef.current) return;
        
        const containerWidth = containerRef.current.clientWidth;
        const isMobile = window.innerWidth < 768;
        
        // Maximize height usage
        const maxHeight = isMobile ? window.innerHeight * 0.9 : window.innerHeight - 140; 
        
        const cWidth = containerWidth || 300;
        const cHeight = Math.max(maxHeight, 450);
        
        setCanvasSize({ width: cWidth, height: cHeight });

        // Minimal padding to maximize puzzle size
        const padding = isMobile ? 10 : 40;
        const availableWidth = cWidth - padding;
        const availableHeight = cHeight - padding;

        if (image.width === 0 || image.height === 0) return;

        let bWidth = availableWidth;
        let scale = bWidth / image.width;
        let bHeight = image.height * scale;

        if (bHeight > availableHeight) {
          bHeight = availableHeight;
          scale = bHeight / image.height;
          bWidth = image.width * scale;
        }

        setBoardSize({ width: bWidth, height: bHeight });
        const newOffset = {
          x: (cWidth - bWidth) / 2,
          y: (cHeight - bHeight) / 2
        };
        setBoardOffset(newOffset);
      };

      const observer = new ResizeObserver(updateSize);
      observer.observe(containerRef.current);
      updateSize();

      return () => observer.disconnect();
    }, [image]);

    // Initialize pieces
    useEffect(() => {
      if (boardSize.width === 0 || canvasSize.width === 0) {
        console.log('PuzzleBoard: Skipping piece init - sizes not ready', { boardSize, canvasSize });
        return;
      }

      console.log('PuzzleBoard: Initializing pieces');
      const rows = settings.gridSize.rows;
      const cols = settings.gridSize.cols;
      
      const hTabs: number[][] = Array(rows + 1).fill(0).map(() => Array(cols).fill(0));
      const vTabs: number[][] = Array(rows).fill(0).map(() => Array(cols + 1).fill(0));

      for (let r = 1; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          hTabs[r][c] = Math.random() > 0.5 ? 1 : -1;
        }
      }
      for (let r = 0; r < rows; r++) {
        for (let c = 1; c < cols; c++) {
          vTabs[r][c] = Math.random() > 0.5 ? 1 : -1;
        }
      }

      const newPieces: Piece[] = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const id = r * cols + c;
          const pWidth = boardSize.width / cols;
          const pHeight = boardSize.height / rows;
          
          const margin = 20;
          const scatterX = Math.max(0, canvasSize.width - pWidth - margin * 2);
          const scatterY = Math.max(0, canvasSize.height - pHeight - margin * 2);
          
          newPieces.push({
            id,
            correctPos: { 
              x: boardOffset.x + c * pWidth, 
              y: boardOffset.y + r * pHeight 
            },
            currentPos: { 
              x: margin + Math.random() * scatterX, 
              y: margin + Math.random() * scatterY 
            },
            isLocked: false,
            tabs: {
              top: -hTabs[r][c],
              right: vTabs[r][c+1],
              bottom: hTabs[r+1][c],
              left: -vTabs[r][c]
            },
            neighbors: {
              top: r > 0 ? (r - 1) * cols + c : null,
              right: c < cols - 1 ? r * cols + (c + 1) : null,
              bottom: r < rows - 1 ? (r + 1) * cols + c : null,
              left: c > 0 ? r * cols + (c - 1) : null,
            }
          });
        }
      }
      setPieces(newPieces);
    }, [settings, boardSize.width, boardSize.height, canvasSize.width, canvasSize.height, boardOffset.x, boardOffset.y]);

    // Check for completion
    useEffect(() => {
      if (pieces.length > 0 && pieces.every(p => p.isLocked)) {
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 }
        });
        onComplete();
      }
    }, [pieces, onComplete]);

    const drawPiecePath = (ctx: CanvasRenderingContext2D, pieceWidth: number, pieceHeight: number, shape: PieceShape, tabs: Piece['tabs']) => {
      ctx.beginPath();
      if (shape === 'square') {
        ctx.rect(0, 0, pieceWidth, pieceHeight);
      } else if (shape === 'hexagon') {
        const size = Math.min(pieceWidth, pieceHeight);
        const tabDepth = size * 0.2;

        ctx.moveTo(0, 0);

        if (tabs.top !== 0) {
          const dir = tabs.top;
          ctx.lineTo(pieceWidth * 0.35, 0);
          ctx.lineTo(pieceWidth * 0.4, -tabDepth * dir);
          ctx.lineTo(pieceWidth * 0.6, -tabDepth * dir);
          ctx.lineTo(pieceWidth * 0.65, 0);
        }
        ctx.lineTo(pieceWidth, 0);

        if (tabs.right !== 0) {
          const dir = tabs.right;
          ctx.lineTo(pieceWidth, pieceHeight * 0.35);
          ctx.lineTo(pieceWidth + tabDepth * dir, pieceHeight * 0.4);
          ctx.lineTo(pieceWidth + tabDepth * dir, pieceHeight * 0.6);
          ctx.lineTo(pieceWidth, pieceHeight * 0.65);
        }
        ctx.lineTo(pieceWidth, pieceHeight);

        if (tabs.bottom !== 0) {
          const dir = tabs.bottom;
          ctx.lineTo(pieceWidth * 0.65, pieceHeight);
          ctx.lineTo(pieceWidth * 0.6, pieceHeight + tabDepth * dir);
          ctx.lineTo(pieceWidth * 0.4, pieceHeight + tabDepth * dir);
          ctx.lineTo(pieceWidth * 0.35, pieceHeight);
        }
        ctx.lineTo(0, pieceHeight);

        if (tabs.left !== 0) {
          const dir = tabs.left;
          ctx.lineTo(0, pieceHeight * 0.65);
          ctx.lineTo(-tabDepth * dir, pieceHeight * 0.6);
          ctx.lineTo(-tabDepth * dir, pieceHeight * 0.4);
          ctx.lineTo(0, pieceHeight * 0.35);
        }
        ctx.lineTo(0, 0);
        ctx.closePath();
      } else {
        const size = Math.min(pieceWidth, pieceHeight);
        const tabDepth = size * 0.15;

        ctx.moveTo(0, 0);

        if (tabs.top !== 0) {
          const dir = tabs.top;
          ctx.lineTo(pieceWidth * 0.35, 0);
          ctx.bezierCurveTo(pieceWidth * 0.35, -tabDepth * dir, pieceWidth * 0.4, -tabDepth * 1.3 * dir, pieceWidth * 0.5, -tabDepth * 1.3 * dir);
          ctx.bezierCurveTo(pieceWidth * 0.6, -tabDepth * 1.3 * dir, pieceWidth * 0.65, -tabDepth * dir, pieceWidth * 0.65, 0);
        }
        ctx.lineTo(pieceWidth, 0);

        if (tabs.right !== 0) {
          const dir = tabs.right;
          ctx.lineTo(pieceWidth, pieceHeight * 0.35);
          ctx.bezierCurveTo(pieceWidth + tabDepth * dir, pieceHeight * 0.35, pieceWidth + tabDepth * 1.3 * dir, pieceHeight * 0.4, pieceWidth + tabDepth * 1.3 * dir, pieceHeight * 0.5);
          ctx.bezierCurveTo(pieceWidth + tabDepth * 1.3 * dir, pieceHeight * 0.6, pieceWidth + tabDepth * dir, pieceHeight * 0.65, pieceWidth, pieceHeight * 0.65);
        }
        ctx.lineTo(pieceWidth, pieceHeight);

        if (tabs.bottom !== 0) {
          const dir = tabs.bottom;
          ctx.lineTo(pieceWidth * 0.65, pieceHeight);
          ctx.bezierCurveTo(pieceWidth * 0.65, pieceHeight + tabDepth * dir, pieceWidth * 0.6, pieceHeight + tabDepth * 1.3 * dir, pieceWidth * 0.5, pieceHeight + tabDepth * 1.3 * dir);
          ctx.bezierCurveTo(pieceWidth * 0.4, pieceHeight + tabDepth * 1.3 * dir, pieceWidth * 0.35, pieceHeight + tabDepth * dir, pieceWidth * 0.35, pieceHeight);
        }
        ctx.lineTo(0, pieceHeight);

        if (tabs.left !== 0) {
          const dir = tabs.left;
          ctx.lineTo(0, pieceHeight * 0.65);
          ctx.bezierCurveTo(-tabDepth * dir, pieceHeight * 0.65, -tabDepth * 1.3 * dir, pieceHeight * 0.6, -tabDepth * 1.3 * dir, pieceHeight * 0.5);
          ctx.bezierCurveTo(-tabDepth * 1.3 * dir, pieceHeight * 0.4, -tabDepth * dir, pieceHeight * 0.35, 0, pieceHeight * 0.35);
        }
        ctx.lineTo(0, 0);
        ctx.closePath();
      }
    };

    const drawPiece = useCallback((ctx: CanvasRenderingContext2D, piece: Piece) => {
      try {
        const { x, y } = piece.currentPos;
        const { x: cx, y: cy } = piece.correctPos;

        ctx.save();
        ctx.translate(x, y);

        drawPiecePath(ctx, pieceWidth, pieceHeight, settings.shape, piece.tabs);
        ctx.clip();
        
        ctx.drawImage(
          image,
          0, 0, image.width, image.height,
          boardOffset.x - cx, boardOffset.y - cy, boardSize.width, boardSize.height
        );

        ctx.restore();
        
        ctx.save();
        ctx.translate(x, y);
        ctx.strokeStyle = piece.isLocked ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)';
        ctx.lineWidth = piece.isLocked ? 1 : 2;
        drawPiecePath(ctx, pieceWidth, pieceHeight, settings.shape, piece.tabs);
        ctx.stroke();
        ctx.restore();
      } catch (err) {
        console.error('Error drawing piece:', err);
      }
    }, [image, boardSize, boardOffset, pieceWidth, pieceHeight, settings.shape]);

    const render = useCallback(() => {
      try {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw board background
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.beginPath();
        ctx.rect(boardOffset.x, boardOffset.y, boardSize.width, boardSize.height);
        ctx.fill();

        // Draw grid lines
        ctx.strokeStyle = 'rgba(0,0,0,0.05)';
        ctx.lineWidth = 1;
        for (let r = 0; r <= settings.gridSize.rows; r++) {
          ctx.beginPath();
          ctx.moveTo(boardOffset.x, boardOffset.y + r * pieceHeight);
          ctx.lineTo(boardOffset.x + boardSize.width, boardOffset.y + r * pieceHeight);
          ctx.stroke();
        }
        for (let c = 0; c <= settings.gridSize.cols; c++) {
          ctx.beginPath();
          ctx.moveTo(boardOffset.x + c * pieceWidth, boardOffset.y);
          ctx.lineTo(boardOffset.x + c * pieceWidth, boardOffset.y + boardSize.height);
          ctx.stroke();
        }

        const sortedPieces = [...pieces].sort((a, b) => {
          if (a.id === draggingPieceId) return 1;
          if (b.id === draggingPieceId) return -1;
          if (a.isLocked && !b.isLocked) return -1;
          if (!a.isLocked && b.isLocked) return 1;
          return 0;
        });

        sortedPieces.forEach(piece => drawPiece(ctx, piece));
      } catch (err) {
        console.error('Error in render:', err);
        setRenderError(err instanceof Error ? err.message : String(err));
      }
    }, [pieces, draggingPieceId, boardSize, boardOffset, pieceWidth, pieceHeight, settings.gridSize, drawPiece]);

    useEffect(() => {
      render();
    }, [render]);

    const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const clientX = 'touches' in e ? (e as React.TouchEvent).touches[0].clientX : (e as React.MouseEvent).clientX;
      const clientY = 'touches' in e ? (e as React.TouchEvent).touches[0].clientY : (e as React.MouseEvent).clientY;
      const x = clientX - rect.left;
      const y = clientY - rect.top;

      const piece = [...pieces].reverse().find(p => 
        !p.isLocked && 
        x >= p.currentPos.x - 5 && x <= p.currentPos.x + pieceWidth + 5 &&
        y >= p.currentPos.y - 5 && y <= p.currentPos.y + pieceHeight + 5
      );

      if (piece) {
        setDraggingPieceId(piece.id);
        setOffset({
          x: x - piece.currentPos.x,
          y: y - piece.currentPos.y
        });
      }
    };

    const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
      if (draggingPieceId === null) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const clientX = 'touches' in e ? (e as React.TouchEvent).touches[0].clientX : (e as React.MouseEvent).clientX;
      const clientY = 'touches' in e ? (e as React.TouchEvent).touches[0].clientY : (e as React.MouseEvent).clientY;
      const x = clientX - rect.left;
      const y = clientY - rect.top;

      setPieces(prev => prev.map(p => 
        p.id === draggingPieceId 
          ? { ...p, currentPos: { x: x - offset.x, y: y - offset.y } }
          : p
      ));
    };

    const handleMouseUp = () => {
      if (draggingPieceId === null) return;

      const piece = pieces.find(p => p.id === draggingPieceId);
      if (piece) {
        const dist = Math.sqrt(
          Math.pow(piece.currentPos.x - piece.correctPos.x, 2) +
          Math.pow(piece.currentPos.y - piece.correctPos.y, 2)
        );
        
        const snapDistance = 30;

        if (dist < snapDistance) {
          setPieces(prev => {
            const newPieces = prev.map(p => 
              p.id === draggingPieceId 
                ? { ...p, currentPos: { ...p.correctPos }, isLocked: true }
                : p
            );
            
            // Check if it just locked
            const wasLocked = prev.find(p => p.id === draggingPieceId)?.isLocked;
            if (!wasLocked) {
              playSnapSound();
            }
            
            return newPieces;
          });
        }
      }

      setDraggingPieceId(null);
    };

    if (renderError) {
      return (
        <div className="w-full h-96 flex flex-col items-center justify-center bg-red-50 dark:bg-red-900/30 rounded-3xl p-8 text-center">
          <p className="text-red-600 dark:text-red-400 font-bold mb-2">Rendering Error</p>
          <p className="text-sm opacity-60 dark:text-zinc-400">{renderError}</p>
          <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-red-600 text-white rounded-xl">Reload App</button>
        </div>
      );
    }

    return (
      <div ref={containerRef} className="relative bg-zinc-100/30 dark:bg-zinc-900/30 p-0 rounded-xl sm:rounded-3xl shadow-inner border border-zinc-200 dark:border-white/10 w-full mx-auto flex justify-center items-center overflow-hidden min-h-[60vh] sm:min-h-[75vh]">
        <canvas
          ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          className="touch-none cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleMouseDown}
          onTouchMove={handleMouseMove}
          onTouchEnd={handleMouseUp}
        />
      </div>
    );
  } catch (err) {
    console.error('Critical PuzzleBoard error:', err);
    return (
      <div className="p-8 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-3xl">
        Critical error in PuzzleBoard component.
      </div>
    );
  }
};
