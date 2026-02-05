const { Chess } = require('chess.js');

const PIECE_VALUES = {
    p: 100,
    n: 320,
    b: 330,
    r: 500,
    q: 900,
    k: 20000
};

// PSTs (Piece-Square Tables)
// Oriented from White's perspective: Index 0 is Rank 8 (Top), Index 7 is Rank 1 (Bottom).
const PST = {
    p: [
        [0,  0,  0,  0,  0,  0,  0,  0],
        [50, 50, 50, 50, 50, 50, 50, 50],
        [10, 10, 20, 30, 30, 20, 10, 10],
        [5,  5, 10, 25, 25, 10,  5,  5],
        [0,  0,  0, 20, 20,  0,  0,  0],
        [5, -5,-10,  0,  0,-10, -5,  5],
        [5, 10, 10,-20,-20, 10, 10,  5],
        [0,  0,  0,  0,  0,  0,  0,  0]
    ],
    n: [
        [-50,-40,-30,-30,-30,-30,-40,-50],
        [-40,-20,  0,  0,  0,  0,-20,-40],
        [-30,  0, 10, 15, 15, 10,  0,-30],
        [-30,  5, 15, 20, 20, 15,  5,-30],
        [-30,  0, 15, 20, 20, 15,  0,-30],
        [-30,  5, 10, 15, 15, 10,  5,-30],
        [-40,-20,  0,  5,  5,  0,-20,-40],
        [-50,-40,-30,-30,-30,-30,-40,-50]
    ],
    b: [
        [-20,-10,-10,-10,-10,-10,-10,-20],
        [-10,  0,  0,  0,  0,  0,  0,-10],
        [-10,  0,  5, 10, 10,  5,  0,-10],
        [-10,  5,  5, 10, 10,  5,  5,-10],
        [-10,  0, 10, 10, 10, 10,  0,-10],
        [-10, 10, 10, 10, 10, 10, 10,-10],
        [-10,  5,  0,  0,  0,  0,  5,-10],
        [-20,-10,-10,-10,-10,-10,-10,-20]
    ],
    r: [
        [0,  0,  0,  0,  0,  0,  0,  0],
        [5, 10, 10, 10, 10, 10, 10,  5],
        [-5,  0,  0,  0,  0,  0,  0, -5],
        [-5,  0,  0,  0,  0,  0,  0, -5],
        [-5,  0,  0,  0,  0,  0,  0, -5],
        [-5,  0,  0,  0,  0,  0,  0, -5],
        [-5,  0,  0,  0,  0,  0,  0, -5],
        [0,  0,  0,  5,  5,  0,  0,  0]
    ],
    q: [
        [-20,-10,-10, -5, -5,-10,-10,-20],
        [-10,  0,  0,  0,  0,  0,  0,-10],
        [-10,  0,  5,  5,  5,  5,  0,-10],
        [-5,  0,  5,  5,  5,  5,  0, -5],
        [0,  0,  5,  5,  5,  5,  0, -5],
        [-10,  5,  5,  5,  5,  5,  0,-10],
        [-10,  0,  5,  0,  0,  0,  0,-10],
        [-20,-10,-10, -5, -5,-10,-10,-20]
    ],
    k: [
        [-30,-40,-40,-50,-50,-40,-40,-30],
        [-30,-40,-40,-50,-50,-40,-40,-30],
        [-30,-40,-40,-50,-50,-40,-40,-30],
        [-30,-40,-40,-50,-50,-40,-40,-30],
        [-20,-30,-30,-40,-40,-30,-30,-20],
        [-10,-20,-20,-20,-20,-20,-20,-10],
        [20, 20,  0,  0,  0,  0, 20, 20],
        [20, 30, 10,  0,  0, 10, 30, 20]
    ]
};

function evaluateBoard(game) {
    let totalEvaluation = 0;
    const board = game.board();

    for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
            totalEvaluation += getPieceValue(board[i][j], i, j);
        }
    }
    return totalEvaluation;
}

function getPieceValue(piece, x, y) {
    if (piece === null) {
        return 0;
    }

    const absoluteValue = PIECE_VALUES[piece.type];
    const isWhite = piece.color === 'w';

    // If white, use index as is (0 = rank 8).
    // If black, mirror rows (0 becomes 7).
    const pstValue = isWhite ?
        PST[piece.type][x][y] :
        PST[piece.type][7 - x][y];

    return isWhite ? (absoluteValue + pstValue) : -(absoluteValue + pstValue);
}

function minimax(game, depth, alpha, beta, isMaximizingPlayer) {
    if (depth === 0 || game.isGameOver()) {
        if (game.isCheckmate()) {
            // If current turn is White, White is mated (loss for White -> very low score)
            // If current turn is Black, Black is mated (loss for Black -> very high score for White)
            return game.turn() === 'w' ? -1000000 : 1000000;
        }
        if (game.isDraw()) {
            return 0;
        }
        return evaluateBoard(game);
    }

    // Move Ordering: Prioritize captures to improve Alpha-Beta pruning
    // Using verbose: true to identify captures
    const moves = game.moves({ verbose: true });

    // Simple heuristic sort: Captures first
    moves.sort((a, b) => {
        if (a.captured && !b.captured) return -1;
        if (!a.captured && b.captured) return 1;
        return 0;
    });

    if (isMaximizingPlayer) {
        let maxEval = -Infinity;
        for (const move of moves) {
            game.move(move);
            const eval = minimax(game, depth - 1, alpha, beta, false);
            game.undo();
            maxEval = Math.max(maxEval, eval);
            alpha = Math.max(alpha, eval);
            if (beta <= alpha) {
                break;
            }
        }
        return maxEval;
    } else {
        let minEval = Infinity;
        for (const move of moves) {
            game.move(move);
            const eval = minimax(game, depth - 1, alpha, beta, true);
            game.undo();
            minEval = Math.min(minEval, eval);
            beta = Math.min(beta, eval);
            if (beta <= alpha) {
                break;
            }
        }
        return minEval;
    }
}

function getBestMove(game, difficulty) {
    // For root search, we also want sorting to pick the best move faster (if iterating)
    // Actually, root move ordering helps if we use Alpha-Beta at root.
    // Here we just iterate all root moves.
    // But since we are not passing alpha/beta between root moves effectively (we reset logic),
    // we iterate all.
    // However, we should use verbose moves to return the SAN string correctly.

    const moves = game.moves({ verbose: true });
    if (moves.length === 0) return null;

    if (difficulty === 'Facile') {
        // Random move
        const randomIndex = Math.floor(Math.random() * moves.length);
        return moves[randomIndex].san;
    }

    const depth = difficulty === 'Moyen' ? 2 : 3;
    let bestMove = null;
    let bestValue = game.turn() === 'w' ? -Infinity : Infinity;
    const isMaximizing = game.turn() === 'w';

    // Sort root moves too (Captures first)
    moves.sort((a, b) => {
        if (a.captured && !b.captured) return -1;
        if (!a.captured && b.captured) return 1;
        return 0;
    });

    for (const move of moves) {
        game.move(move);
        const boardValue = minimax(game, depth - 1, -Infinity, Infinity, !isMaximizing);
        game.undo();

        if (isMaximizing) {
            if (boardValue > bestValue) {
                bestValue = boardValue;
                bestMove = move;
            }
            // Optimization: If found a winning line (mate), stop searching
            if (boardValue >= 90000) break;
        } else {
            if (boardValue < bestValue) {
                bestValue = boardValue;
                bestMove = move;
            }
            // Optimization: If found a winning line (mate for black), stop searching
            if (boardValue <= -90000) break;
        }
    }

    // Fallback if no best move found (shouldn't happen unless bug)
    return bestMove ? bestMove.san : moves[0].san;
}

module.exports = {
    getBestMove,
    evaluateBoard
};
