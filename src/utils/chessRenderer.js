/**
 * Generates a URL for the chess board image based on the FEN.
 * Uses an external API for rendering.
 * @param {string} fen The Forsyth-Edwards Notation string.
 * @returns {string} The URL of the board image.
 */
function getBoardImageUrl(fen) {
    // Encode the FEN string to be safe in a URL
    const encodedFen = encodeURIComponent(fen);
    return `https://www.chess.com/dynboard?fen=${encodedFen}&board=green&piece=neo&size=600`;
}

module.exports = { getBoardImageUrl };
