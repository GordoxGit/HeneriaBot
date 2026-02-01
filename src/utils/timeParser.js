/**
 * Parses a duration string (e.g., "1d", "2h", "30m") into seconds.
 * @param {string} str - The duration string.
 * @returns {number|null} The duration in seconds, or null if invalid.
 */
function parseDuration(str) {
  if (!str) return null;
  const regex = /^(\d+)([smhd])$/i; // case insensitive
  const match = str.match(regex);
  if (!match) return null;

  const value = parseInt(match[1]);
  const unit = match[2].toLowerCase();

  switch(unit) {
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * 3600;
    case 'd': return value * 86400;
    default: return null;
  }
}

module.exports = { parseDuration };
